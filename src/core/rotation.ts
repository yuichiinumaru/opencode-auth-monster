import { ManagedAccount, AuthMethod } from './types';
import { isOnCooldown } from './quota-manager';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

export type RateLimitReason = 
  | "QUOTA_EXHAUSTED"
  | "RATE_LIMIT_EXCEEDED" 
  | "MODEL_CAPACITY_EXHAUSTED"
  | "SERVER_ERROR"
  | "UNKNOWN";

const QUOTA_EXHAUSTED_BACKOFFS = [60_000, 300_000, 1_800_000, 7_200_000] as const;
const RATE_LIMIT_EXCEEDED_BACKOFF = 30_000;
const MODEL_CAPACITY_EXHAUSTED_BACKOFF = 15_000;
const SERVER_ERROR_BACKOFF = 20_000;
const UNKNOWN_BACKOFF = 60_000;
const MIN_BACKOFF_MS = 2_000;
const RATE_LIMIT_DEDUP_WINDOW_MS = 2_000;

export interface HealthScoreConfig {
  initial: number;
  successReward: number;
  rateLimitPenalty: number;
  failurePenalty: number;
  recoveryRatePerHour: number;
  minUsable: number;
  maxScore: number;
}

export const DEFAULT_HEALTH_SCORE_CONFIG: HealthScoreConfig = {
  initial: 70,
  successReward: 1,
  rateLimitPenalty: -10,
  failurePenalty: -20,
  recoveryRatePerHour: 2,
  minUsable: 50,
  maxScore: 100,
};

// ============================================================================
// TOKEN BUCKET SYSTEM
// ============================================================================

export interface TokenBucketConfig {
  maxTokens: number;
  regenerationRatePerMinute: number;
  initialTokens: number;
}

export const DEFAULT_TOKEN_BUCKET_CONFIG: TokenBucketConfig = {
  maxTokens: 50,
  regenerationRatePerMinute: 6,
  initialTokens: 50,
};

interface TokenBucketState {
  tokens: number;
  lastUpdated: number;
}

export class TokenBucketTracker {
  private buckets = new Map<string, TokenBucketState>();
  private config: TokenBucketConfig;

  constructor(config: Partial<TokenBucketConfig> = {}) {
    this.config = { ...DEFAULT_TOKEN_BUCKET_CONFIG, ...config };
  }

  getTokens(accountId: string): number {
    const state = this.buckets.get(accountId);
    if (!state) {
      return this.config.initialTokens;
    }

    const now = Date.now();
    const minutesSinceUpdate = (now - state.lastUpdated) / (1000 * 60);
    const recoveredTokens = minutesSinceUpdate * this.config.regenerationRatePerMinute;

    return Math.min(
      this.config.maxTokens,
      state.tokens + recoveredTokens
    );
  }

  hasTokens(accountId: string, cost: number = 1): boolean {
    return this.getTokens(accountId) >= cost;
  }

  consume(accountId: string, cost: number = 1): boolean {
    const current = this.getTokens(accountId);
    if (current < cost) {
      return false;
    }

    this.buckets.set(accountId, {
      tokens: current - cost,
      lastUpdated: Date.now(),
    });
    return true;
  }

  getMaxTokens(): number {
    return this.config.maxTokens;
  }
}

// ============================================================================
// HEALTH SCORE TRACKER
// ============================================================================

export class HealthScoreTracker {
  private config: HealthScoreConfig;
  private lastUpdateTimes: Map<string, number> = new Map();

  constructor(config: Partial<HealthScoreConfig> = {}) {
    this.config = { ...DEFAULT_HEALTH_SCORE_CONFIG, ...config };
  }

  getScore(account: ManagedAccount): number {
    const currentScore = account.healthScore ?? this.config.initial;
    const lastUpdate = this.lastUpdateTimes.get(account.id) ?? Date.now();
    
    const now = Date.now();
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
    
    if (hoursSinceUpdate > 0) {
      const recoveredPoints = Math.floor(hoursSinceUpdate * this.config.recoveryRatePerHour);
      return Math.min(this.config.maxScore, currentScore + recoveredPoints);
    }
    
    return currentScore;
  }

  recordSuccess(account: ManagedAccount): void {
    const current = this.getScore(account);
    account.healthScore = Math.min(this.config.maxScore, current + this.config.successReward);
    account.consecutiveFailures = 0;
    account.isHealthy = account.healthScore >= this.config.minUsable;
    this.lastUpdateTimes.set(account.id, Date.now());
  }

  recordRateLimit(account: ManagedAccount): void {
    const current = this.getScore(account);
    account.healthScore = Math.max(0, current + this.config.rateLimitPenalty);
    account.consecutiveFailures = (account.consecutiveFailures ?? 0) + 1;
    account.isHealthy = account.healthScore >= this.config.minUsable;
    this.lastUpdateTimes.set(account.id, Date.now());
  }

  recordFailure(account: ManagedAccount): void {
    const current = this.getScore(account);
    account.healthScore = Math.max(0, current + this.config.failurePenalty);
    account.consecutiveFailures = (account.consecutiveFailures ?? 0) + 1;
    account.isHealthy = account.healthScore >= this.config.minUsable;
    this.lastUpdateTimes.set(account.id, Date.now());
  }

  isUsable(account: ManagedAccount): boolean {
    return this.getScore(account) >= this.config.minUsable;
  }
}

// ============================================================================
// ACCOUNT ROTATOR
// ============================================================================

export class AccountRotator {
  private healthTracker: HealthScoreTracker;
  private tokenTracker: TokenBucketTracker;
  private cursor: number = 0;
  private lastRateLimitTimes: Map<string, number> = new Map();
  private currentAccountId: string | null = null;

  private static readonly STICKINESS_BONUS = 150;
  private static readonly SWITCH_THRESHOLD = 100;

  constructor(healthConfig?: Partial<HealthScoreConfig>, tokenConfig?: Partial<TokenBucketConfig>) {
    this.healthTracker = new HealthScoreTracker(healthConfig);
    this.tokenTracker = new TokenBucketTracker(tokenConfig);
    this.cursor = process.pid;
  }

  selectAccount(accounts: ManagedAccount[], strategy: AuthMethod = 'sticky'): ManagedAccount | null {
    if (!accounts.length) return null;

    const availableAccounts = accounts.filter(acc => {
      const now = Date.now();
      if (acc.rateLimitResetTime && now < acc.rateLimitResetTime) return false;
      if (acc.cooldownUntil && now < acc.cooldownUntil) return false;
      if (isOnCooldown(acc.provider, acc.id)) return false;
      if (acc.quota && acc.quota.remaining <= 0) return false;
      if (!this.healthTracker.isUsable(acc)) return false;
      if (!this.tokenTracker.hasTokens(acc.id)) return false;

      return true;
    });

    if (availableAccounts.length === 0) return null;

    let selected: ManagedAccount;
    switch (strategy) {
      case 'round-robin':
        selected = this.selectRoundRobin(availableAccounts);
        break;
      case 'hybrid':
        selected = this.selectHybrid(availableAccounts);
        break;
      case 'quota-optimized':
        selected = this.selectQuotaOptimized(availableAccounts);
        break;
      case 'sticky':
      default:
        selected = this.selectSticky(availableAccounts);
        break;
    }

    this.currentAccountId = selected.id;
    return selected;
  }

  private selectQuotaOptimized(accounts: ManagedAccount[]): ManagedAccount {
    const sorted = [...accounts].sort((a, b) => {
      const quotaA = a.quota?.remaining ?? 1000;
      const quotaB = b.quota?.remaining ?? 1000;
      return quotaB - quotaA;
    });
    return sorted[0];
  }

  private selectRoundRobin(accounts: ManagedAccount[]): ManagedAccount {
    const account = accounts[this.cursor % accounts.length];
    this.cursor++;
    return account;
  }

  private selectSticky(accounts: ManagedAccount[]): ManagedAccount {
    if (this.currentAccountId) {
        const current = accounts.find(a => a.id === this.currentAccountId);
        if (current) return current;
    }
    const offset = process.pid % accounts.length;
    return accounts[offset];
  }

  private selectHybrid(accounts: ManagedAccount[]): ManagedAccount {
    const maxTokens = this.tokenTracker.getMaxTokens();
    const scored = accounts.map(acc => {
      const healthComponent = this.healthTracker.getScore(acc) * 2;
      const tokenComponent = (this.tokenTracker.getTokens(acc.id) / maxTokens) * 100 * 5;
      const secondsSinceUsed = (Date.now() - (acc.lastUsed ?? 0)) / 1000;
      const freshnessComponent = Math.min(secondsSinceUsed, 3600) * 0.1;

      const baseScore = healthComponent + tokenComponent + freshnessComponent;
      const stickinessBonus = acc.id === this.currentAccountId ? AccountRotator.STICKINESS_BONUS : 0;

      return {
        account: acc,
        baseScore,
        score: baseScore + stickinessBonus,
        isCurrent: acc.id === this.currentAccountId
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const currentCandidate = scored.find(s => s.isCurrent);

    if (currentCandidate && !best.isCurrent) {
      const advantage = best.baseScore - currentCandidate.baseScore;
      if (advantage < AccountRotator.SWITCH_THRESHOLD) {
        return currentCandidate.account;
      }
    }

    return best.account;
  }

  recordSuccess(account: ManagedAccount): void {
    this.healthTracker.recordSuccess(account);
    this.tokenTracker.consume(account.id);
    account.lastUsed = Date.now();
  }

  recordFailure(account: ManagedAccount): void {
    this.healthTracker.recordFailure(account);
  }

  recordRateLimit(account: ManagedAccount, retryAfterMs?: number, reason: RateLimitReason = 'UNKNOWN'): void {
    const now = Date.now();
    const lastAt = this.lastRateLimitTimes.get(account.id) ?? 0;

    if (now - lastAt < RATE_LIMIT_DEDUP_WINDOW_MS) {
      if (retryAfterMs) {
        account.rateLimitResetTime = now + retryAfterMs;
      }
      return;
    }

    this.lastRateLimitTimes.set(account.id, now);
    this.healthTracker.recordRateLimit(account);
    
    const backoff = retryAfterMs ?? this.calculateBackoff(reason, account.consecutiveFailures ?? 1);
    account.rateLimitResetTime = now + backoff;
    account.lastSwitchReason = 'rate-limit';
  }

  private calculateBackoff(reason: RateLimitReason, consecutiveFailures: number): number {
    switch (reason) {
      case "QUOTA_EXHAUSTED": {
        const index = Math.min(consecutiveFailures, QUOTA_EXHAUSTED_BACKOFFS.length - 1);
        return QUOTA_EXHAUSTED_BACKOFFS[index];
      }
      case "RATE_LIMIT_EXCEEDED":
        return RATE_LIMIT_EXCEEDED_BACKOFF;
      case "MODEL_CAPACITY_EXHAUSTED":
        return MODEL_CAPACITY_EXHAUSTED_BACKOFF;
      case "SERVER_ERROR":
        return SERVER_ERROR_BACKOFF;
      case "UNKNOWN":
      default:
        return UNKNOWN_BACKOFF;
    }
  }
}
