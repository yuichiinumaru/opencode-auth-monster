"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountRotator = exports.HealthScoreTracker = exports.DEFAULT_HEALTH_SCORE_CONFIG = void 0;
const QUOTA_EXHAUSTED_BACKOFFS = [60000, 300000, 1800000, 7200000];
const RATE_LIMIT_EXCEEDED_BACKOFF = 30000;
const MODEL_CAPACITY_EXHAUSTED_BACKOFF = 15000;
const SERVER_ERROR_BACKOFF = 20000;
const UNKNOWN_BACKOFF = 60000;
const MIN_BACKOFF_MS = 2000;
const RATE_LIMIT_DEDUP_WINDOW_MS = 2000;
exports.DEFAULT_HEALTH_SCORE_CONFIG = {
    initial: 70,
    successReward: 1,
    rateLimitPenalty: -10,
    failurePenalty: -20,
    recoveryRatePerHour: 2,
    minUsable: 50,
    maxScore: 100,
};
// ============================================================================
// HEALTH SCORE TRACKER
// ============================================================================
class HealthScoreTracker {
    constructor(config = {}) {
        // Map account ID to last update timestamp for passive recovery calculation
        this.lastUpdateTimes = new Map();
        this.config = { ...exports.DEFAULT_HEALTH_SCORE_CONFIG, ...config };
    }
    getScore(account) {
        const currentScore = account.healthScore ?? this.config.initial;
        const lastUpdate = this.lastUpdateTimes.get(account.id) ?? Date.now();
        // Apply passive recovery
        const now = Date.now();
        const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 0) {
            const recoveredPoints = Math.floor(hoursSinceUpdate * this.config.recoveryRatePerHour);
            return Math.min(this.config.maxScore, currentScore + recoveredPoints);
        }
        return currentScore;
    }
    recordSuccess(account) {
        const current = this.getScore(account);
        account.healthScore = Math.min(this.config.maxScore, current + this.config.successReward);
        account.consecutiveFailures = 0;
        account.isHealthy = account.healthScore >= this.config.minUsable;
        this.lastUpdateTimes.set(account.id, Date.now());
    }
    recordRateLimit(account) {
        const current = this.getScore(account);
        account.healthScore = Math.max(0, current + this.config.rateLimitPenalty);
        account.consecutiveFailures = (account.consecutiveFailures ?? 0) + 1;
        account.isHealthy = account.healthScore >= this.config.minUsable;
        this.lastUpdateTimes.set(account.id, Date.now());
    }
    recordFailure(account) {
        const current = this.getScore(account);
        account.healthScore = Math.max(0, current + this.config.failurePenalty);
        account.consecutiveFailures = (account.consecutiveFailures ?? 0) + 1;
        account.isHealthy = account.healthScore >= this.config.minUsable;
        this.lastUpdateTimes.set(account.id, Date.now());
    }
    isUsable(account) {
        return this.getScore(account) >= this.config.minUsable;
    }
}
exports.HealthScoreTracker = HealthScoreTracker;
// ============================================================================
// ACCOUNT ROTATOR
// ============================================================================
class AccountRotator {
    constructor(healthConfig) {
        this.cursor = 0;
        this.lastRateLimitTimes = new Map();
        this.healthTracker = new HealthScoreTracker(healthConfig);
        // PID-based initial offset for round-robin to maximize throughput across parallel instances
        this.cursor = process.pid;
    }
    selectAccount(accounts, strategy = 'sticky') {
        if (!accounts.length)
            return null;
        // Filter out accounts that are cooling down or rate limited OR unhealthy
        const availableAccounts = accounts.filter(acc => {
            const now = Date.now();
            if (acc.rateLimitResetTime && now < acc.rateLimitResetTime)
                return false;
            if (acc.cooldownUntil && now < acc.cooldownUntil)
                return false;
            // Check health
            if (!this.healthTracker.isUsable(acc))
                return false;
            return true;
        });
        if (availableAccounts.length === 0)
            return null;
        switch (strategy) {
            case 'round-robin':
                return this.selectRoundRobin(availableAccounts);
            case 'hybrid':
                return this.selectHybrid(availableAccounts);
            case 'sticky':
            default:
                return this.selectSticky(availableAccounts);
        }
    }
    selectRoundRobin(accounts) {
        const account = accounts[this.cursor % accounts.length];
        this.cursor++;
        return account;
    }
    selectSticky(accounts) {
        // Incorporate a process-based offset to ensure different IDE instances 
        // or subagents pick different starting accounts.
        const offset = process.pid % accounts.length;
        return accounts[offset];
    }
    selectHybrid(accounts) {
        // Sort by health score (descending) and then by last used (ascending - LRU)
        // We want the healthiest account that hasn't been used recently.
        const scored = accounts.map(acc => ({
            account: acc,
            score: this.healthTracker.getScore(acc),
            lastUsed: acc.lastUsed ?? 0
        }));
        // Apply PID-based rotation to the base list to break ties in a way that
        // maximizes throughput across parallel instances.
        const pidOffset = process.pid % scored.length;
        const rotatedScored = [
            ...scored.slice(pidOffset),
            ...scored.slice(0, pidOffset)
        ];
        rotatedScored.sort((a, b) => {
            // Primary: Health Score
            if (Math.abs(a.score - b.score) > 5) { // 5 point buffer
                return b.score - a.score;
            }
            // Secondary: LRU (Least Recently Used)
            return a.lastUsed - b.lastUsed;
        });
        return rotatedScored[0].account;
    }
    recordSuccess(account) {
        this.healthTracker.recordSuccess(account);
        account.lastUsed = Date.now();
    }
    recordFailure(account) {
        this.healthTracker.recordFailure(account);
    }
    recordRateLimit(account, retryAfterMs, reason = 'UNKNOWN') {
        const now = Date.now();
        const lastAt = this.lastRateLimitTimes.get(account.id) ?? 0;
        // Deduplicate concurrent 429s within 2000ms window
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
    calculateBackoff(reason, consecutiveFailures) {
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
exports.AccountRotator = AccountRotator;
