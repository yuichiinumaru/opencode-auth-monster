import { AuthProvider, ManagedAccount, AuthMonsterConfig } from './types';
import { isOnCooldown } from './quota-manager';

export interface ModelHubEntry {
  provider: AuthProvider;
  modelInProvider: string;
}

/**
 * Unified Model Hub
 * Maps generic model names (e.g., 'claude-3-7-sonnet') to provider-specific IDs.
 * Handles cross-provider fallbacks and global load balancing.
 */
export class UnifiedModelHub {
  private modelMap: Map<string, ModelHubEntry[]> = new Map();

  constructor() {
    this.initializeMappings();
  }

  private initializeMappings() {
    // Gemini 3 & Claude 4.5 (Antigravity Suite)
    this.addMapping('gemini-3-pro', [
        { provider: AuthProvider.Gemini, modelInProvider: 'antigravity-gemini-3-pro' },
        { provider: AuthProvider.Gemini, modelInProvider: 'gemini-3-pro-preview' }
    ]);
    this.addMapping('gemini-3-flash', [
        { provider: AuthProvider.Gemini, modelInProvider: 'antigravity-gemini-3-flash' },
        { provider: AuthProvider.Gemini, modelInProvider: 'gemini-3-flash-preview' }
    ]);
    this.addMapping('claude-4.5-sonnet', [
        { provider: AuthProvider.Gemini, modelInProvider: 'antigravity-claude-sonnet-4-5' },
        { provider: AuthProvider.Anthropic, modelInProvider: 'claude-4-5-sonnet-20251001' }
    ]);
    this.addMapping('claude-4.5-sonnet-thinking', [
        { provider: AuthProvider.Gemini, modelInProvider: 'antigravity-claude-sonnet-4-5-thinking' }
    ]);
    this.addMapping('claude-4.5-opus-thinking', [
        { provider: AuthProvider.Gemini, modelInProvider: 'antigravity-claude-opus-4-5-thinking' }
    ]);

    // Antigravity Specific Direct Mappings
    this.addMapping('antigravity-gemini-3-pro', [{ provider: AuthProvider.Gemini, modelInProvider: 'antigravity-gemini-3-pro' }]);
    this.addMapping('antigravity-gemini-3-flash', [{ provider: AuthProvider.Gemini, modelInProvider: 'antigravity-gemini-3-flash' }]);
    this.addMapping('antigravity-claude-sonnet-4-5', [{ provider: AuthProvider.Gemini, modelInProvider: 'antigravity-claude-sonnet-4-5' }]);

    // Anthropic: Claude 3.7 & 3.5
    this.addMapping('claude-3-7-sonnet', [
        { provider: AuthProvider.Anthropic, modelInProvider: 'claude-3-7-sonnet-20250219' },
        { provider: AuthProvider.Windsurf, modelInProvider: 'claude-3-7-sonnet' }
    ]);
    this.addMapping('claude-3-5-sonnet', [
        { provider: AuthProvider.Anthropic, modelInProvider: 'claude-3-5-sonnet-20241022' },
        { provider: AuthProvider.Cursor, modelInProvider: 'claude-3-5-sonnet' }
    ]);

    // Gemini: 2.5 Family
    this.addMapping('gemini-2.5-pro', [
        { provider: AuthProvider.Gemini, modelInProvider: 'gemini-2.5-pro' },
        { provider: AuthProvider.Windsurf, modelInProvider: 'gemini-2.5-pro' }
    ]);
    this.addMapping('gemini-2.5-flash', [
        { provider: AuthProvider.Gemini, modelInProvider: 'gemini-2.5-flash' },
        { provider: AuthProvider.Windsurf, modelInProvider: 'gemini-2.5-flash' }
    ]);

    // OpenAI: GPT-5 Family
    this.addMapping('gpt-5.2-pro', [
        { provider: AuthProvider.OpenAI, modelInProvider: 'gpt-5.2-pro' },
        { provider: AuthProvider.Copilot, modelInProvider: 'gpt-5.2-pro' }
    ]);

    // Qwen Models
    this.addMapping('qwen-max', [
        { provider: AuthProvider.Qwen, modelInProvider: 'qwen-max' }
    ]);

    // Kiro (AWS) Models
    this.addMapping('codewhisperer', [
        { provider: AuthProvider.Kiro, modelInProvider: 'codewhisperer-analysis' }
    ]);
    this.addMapping('amazon-q-dev', [
        { provider: AuthProvider.Kiro, modelInProvider: 'amazon-q-developer' }
    ]);
  }

  public resolveModelChain(requestedModel: string, config: AuthMonsterConfig): string[] {
    const modelName = requestedModel.toLowerCase();
    const fallbacks = config.modelPriorities[modelName] || [];
    const chain = [modelName, ...fallbacks];
    return Array.from(new Set(chain));
  }

  public addMapping(modelName: string, entries: ModelHubEntry[]) {
    this.modelMap.set(modelName.toLowerCase(), entries);
  }

  public validateRequest(
    provider: AuthProvider,
    modelId: string,
    thinking?: string | number
  ): { valid: boolean; value?: string | number; warning?: string } {
      if (thinking === undefined) return { valid: true };
      // Simplified validation
      return { valid: true, value: thinking };
  }

  public selectModelAccount(
    modelName: string, 
    allAccounts: ManagedAccount[],
    config?: AuthMonsterConfig
  ): { provider: AuthProvider, account: ManagedAccount, modelInProvider: string } | null {

    let modelsToTry = [modelName];

    if (config) {
        modelsToTry = this.resolveModelChain(modelName, config);
    }

    for (const model of modelsToTry) {
        const selection = this.attemptSelectModelAccount(model, allAccounts);
        if (selection) {
            return selection;
        }
    }

    return null;
  }

  private attemptSelectModelAccount(
    modelName: string,
    allAccounts: ManagedAccount[]
  ): { provider: AuthProvider, account: ManagedAccount, modelInProvider: string } | null {
    const hubEntries = this.modelMap.get(modelName.toLowerCase());
    if (!hubEntries) return null;

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

    candidates.sort((a, b) => {
      const hasQuotaA = a.remainingQuota > 0 ? 1 : 0;
      const hasQuotaB = b.remainingQuota > 0 ? 1 : 0;
      if (hasQuotaA !== hasQuotaB) {
        return hasQuotaB - hasQuotaA;
      }

      if (Math.abs(a.score - b.score) > 5) {
        return b.score - a.score;
      }

      if (a.remainingQuota !== b.remainingQuota) {
        return b.remainingQuota - a.remainingQuota;
      }

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

  private isAccountUsable(account: ManagedAccount): boolean {
    const now = Date.now();
    if (account.rateLimitResetTime && now < account.rateLimitResetTime) return false;
    if (account.cooldownUntil && now < account.cooldownUntil) return false;
    if (isOnCooldown(account.provider, account.id)) return false;
    if (account.healthScore !== undefined && account.healthScore < 50) return false;

    // Soft Quota Check (Threshold from defaults)
    if (account.quota && account.quota.limit > 0) {
        const usage = (account.quota.limit - account.quota.remaining) / account.quota.limit;
        if (usage > 0.9) return false;
    }

    return account.isHealthy !== false;
  }

  private getRemainingQuota(account: ManagedAccount, model: string): number {
    if (!account.quota) return 1000;
    if (account.quota.modelSpecific?.[model]) {
      return account.quota.modelSpecific[model].remaining;
    }
    return account.quota.remaining;
  }

  private simpleHash(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
