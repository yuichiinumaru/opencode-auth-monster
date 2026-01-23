import { AuthProvider, ManagedAccount } from './types';
import { AccountRotator } from './rotation';

/**
 * Entry in the Model Hub mapping a generic model name 
 * to a specific provider's model identifier.
 */
export interface ModelHubEntry {
  provider: AuthProvider;
  modelInProvider: string;
}

/**
 * UnifiedModelHub manages the mapping between generic model names 
 * and the pool of providers/accounts that can serve them.
 * 
 * It implements global load balancing across different providers
 * based on health, quota, and PID-based offsets.
 */
export class UnifiedModelHub {
  private modelMap: Map<string, ModelHubEntry[]> = new Map();

  constructor() {
    this.initializeDefaultMappings();
  }

  /**
   * Set up default mappings for common models.
   * In a real-world scenario, this could be loaded from a config file.
   */
  private initializeDefaultMappings() {
    // Gemini 2.0 Flash
    this.addMapping('gemini-2.0-flash', [
      { provider: AuthProvider.Gemini, modelInProvider: 'gemini-2.0-flash' },
      { provider: AuthProvider.Windsurf, modelInProvider: 'gemini-2.0-flash' },
      { provider: AuthProvider.Kiro, modelInProvider: 'gemini-2.0-flash' }
    ]);

    // Claude 3.5 Sonnet
    this.addMapping('claude-3.5-sonnet', [
      { provider: AuthProvider.Anthropic, modelInProvider: 'claude-3-5-sonnet-20241022' },
      { provider: AuthProvider.Windsurf, modelInProvider: 'claude-3.5-sonnet' },
      { provider: AuthProvider.Cursor, modelInProvider: 'claude-3.5-sonnet' }
    ]);

    // GPT-4o
    this.addMapping('gpt-4o', [
      { provider: AuthProvider.OpenAI, modelInProvider: 'gpt-4o' },
      { provider: AuthProvider.Windsurf, modelInProvider: 'gpt-4o' },
      { provider: AuthProvider.Copilot, modelInProvider: 'gpt-4o' }
    ]);
  }

  /**
   * Adds or updates a mapping for a generic model name.
   */
  public addMapping(modelName: string, entries: ModelHubEntry[]) {
    this.modelMap.set(modelName.toLowerCase(), entries);
  }

  /**
   * Selects the best (Provider, Account) combination to serve a request for a model.
   * 
   * @param modelName Generic model name (e.g., 'gemini-2.0-flash')
   * @param allAccounts List of all managed accounts across all providers
   * @returns The selected provider, account, and provider-specific model name
   */
  public selectModelAccount(
    modelName: string, 
    allAccounts: ManagedAccount[]
  ): { provider: AuthProvider, account: ManagedAccount, modelInProvider: string } | null {
    const hubEntries = this.modelMap.get(modelName.toLowerCase());
    
    // If no explicit mapping, we can't route via Hub
    if (!hubEntries) return null;

    // 1. Gather all candidates (Account + Provider Model Info)
    const candidates: Array<{ 
      provider: AuthProvider, 
      account: ManagedAccount, 
      modelInProvider: string,
      score: number,
      remainingQuota: number
    }> = [];

    for (const entry of hubEntries) {
      const providerAccounts = allAccounts.filter(a => a.provider === entry.provider);
      
      for (const account of providerAccounts) {
        // Filter out unhealthy or rate-limited accounts
        if (!this.isAccountUsable(account)) continue;

        const remainingQuota = this.getRemainingQuota(account, entry.modelInProvider);
        const healthScore = account.healthScore ?? 70;

        candidates.push({
          provider: entry.provider,
          account,
          modelInProvider: entry.modelInProvider,
          score: healthScore,
          remainingQuota
        });
      }
    }

    if (candidates.length === 0) return null;

    // 2. Global Load Balancing Logic
    candidates.sort((a, b) => {
      // 0. Quota availability (Binary check: Does it have any quota left?)
      const hasQuotaA = a.remainingQuota > 0 ? 1 : 0;
      const hasQuotaB = b.remainingQuota > 0 ? 1 : 0;
      if (hasQuotaA !== hasQuotaB) {
        return hasQuotaB - hasQuotaA;
      }

      // Primary: Health Score (with 5-point buffer to allow secondary sorting)
      if (Math.abs(a.score - b.score) > 5) {
        return b.score - a.score;
      }

      // Secondary: Quota availability (fine-grained)
      if (a.remainingQuota !== b.remainingQuota) {
        return b.remainingQuota - a.remainingQuota;
      }

      // Tertiary: PID-based offset to prevent parallel collisions
      // We use a combination of account ID hash and PID
      const hashA = this.simpleHash(a.account.id) + process.pid;
      const hashB = this.simpleHash(b.account.id) + process.pid;
      return (hashA % 100) - (hashB % 100);
    });

    const choice = candidates[0];
    return {
      provider: choice.provider,
      account: choice.account,
      modelInProvider: choice.modelInProvider
    };
  }

  /**
   * Basic usability check for an account
   */
  private isAccountUsable(account: ManagedAccount): boolean {
    const now = Date.now();
    if (account.rateLimitResetTime && now < account.rateLimitResetTime) return false;
    if (account.cooldownUntil && now < account.cooldownUntil) return false;
    if (account.healthScore !== undefined && account.healthScore < 50) return false; // MIN_USABLE
    return account.isHealthy !== false;
  }

  /**
   * Retrieves remaining quota for a specific model on an account
   */
  private getRemainingQuota(account: ManagedAccount, model: string): number {
    if (!account.quota) return 1000; // Default high value if untracked
    
    if (account.quota.modelSpecific?.[model]) {
      return account.quota.modelSpecific[model].remaining;
    }
    
    return account.quota.remaining;
  }

  /**
   * Simple string hash for tie-breaking
   */
  private simpleHash(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
