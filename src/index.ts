import { 
  AuthProvider, 
  AuthMonsterConfig, 
  ManagedAccount, 
  AuthDetails,
  PluginContext
} from './core/types';
import { StorageManager } from './core/storage';
import { AccountRotator, RateLimitReason } from './core/rotation';
import { UnifiedModelHub } from './core/hub';
import { sanitizeCrossModelRequest } from './utils/sanitizer';

// Import Providers
import { GeminiProvider } from './providers/gemini';
import { AnthropicProvider, transformRequest as anthropicTransformRequest, transformResponseText as anthropicTransformResponse } from './providers/anthropic';
import { cursorProvider } from './providers/cursor';
import { WindsurfProvider } from './providers/windsurf';

export { RateLimitReason };

export class AuthMonster {
  private storage: StorageManager;
  private accounts: ManagedAccount[] = [];
  private config: AuthMonsterConfig;
  private rotator: AccountRotator;
  private hub: UnifiedModelHub;
  private lastUsedAccountId: string | null = null;
  private lastWarmupTime: Map<string, number> = new Map();

  constructor(context: PluginContext) {
    this.config = context.config;
    this.storage = new StorageManager(context.storagePath);
    this.rotator = new AccountRotator();
    this.hub = new UnifiedModelHub();
  }

  async init() {
    this.accounts = await this.storage.loadAccounts();
  }

  async getAuthDetails(modelOrProvider?: string | AuthProvider): Promise<AuthDetails | null> {
    // 1. Try routing via Unified Model Hub if it looks like a model name
    if (modelOrProvider && typeof modelOrProvider === 'string' && 
        !Object.values(AuthProvider).includes(modelOrProvider as AuthProvider)) {
      
      const hubChoice = this.hub.selectModelAccount(modelOrProvider, this.accounts);
      if (hubChoice) {
        return this.selectAccount(hubChoice.provider, [hubChoice.account], hubChoice.modelInProvider);
      }
    }

    // 2. Default provider-based selection
    const targetProvider = (modelOrProvider as AuthProvider) || this.config.active;
    const providerAccounts = this.accounts.filter(a => a.provider === targetProvider);

    if (providerAccounts.length === 0) {
      // Try fallback
      for (const fallbackProvider of this.config.fallback) {
        const fallbackAccounts = this.accounts.filter(a => a.provider === fallbackProvider);
        if (fallbackAccounts.length > 0) {
          return this.selectAccount(fallbackProvider, fallbackAccounts);
        }
      }
      return null;
    }

    return this.selectAccount(targetProvider, providerAccounts);
  }

  private selectAccount(provider: AuthProvider, accounts: ManagedAccount[], modelInProvider?: string): AuthDetails | null {
    const account = this.rotator.selectAccount(accounts, this.config.method);
    
    if (!account) {
      return null;
    }

    // Thinking Warmup: Triggered when switching to a new account
    if (this.lastUsedAccountId !== account.id) {
      this.runThinkingWarmup(account.id).catch(err => 
        console.error(`[AuthMonster] Warmup background task failed for ${account.email}:`, err)
      );
      this.lastUsedAccountId = account.id;
    }
    
    const headers = this.getHeadersForAccount(provider, account);

    return {
      provider,
      account,
      headers,
      modelInProvider
    };
  }

  /**
   * Sends a lightweight request to 'wake up' reasoning models
   */
  async runThinkingWarmup(accountId: string) {
    const account = this.accounts.find(a => a.id === accountId);
    if (!account) return;

    // Only warmup reasoning models (Anthropic Claude 3.5 Sonnet/Opus)
    if (account.provider !== AuthProvider.Anthropic) return;

    // Throttle warmups to once every 5 minutes per account
    const lastWarmup = this.lastWarmupTime.get(accountId) ?? 0;
    if (Date.now() - lastWarmup < 5 * 60 * 1000) return;

    const isReasoningModel = account.metadata?.model?.includes('sonnet-3-5') || 
                            account.metadata?.model?.includes('opus') ||
                            !account.metadata?.model; // Assume reasoning if model unknown for Anthropic

    if (!isReasoningModel) return;

    try {
      const headers = this.getHeadersForAccount(account.provider, account);
      const url = account.apiKey 
        ? "https://api.anthropic.com/v1/messages" 
        : "https://console.anthropic.com/api/v1/messages";

      const body: any = {
        model: account.metadata?.model || "claude-3-5-sonnet-20241022",
        max_tokens: 1,
        messages: [{ role: "user", content: "Hello" }]
      };

      // Enable thinking if supported
      if (body.model.includes('sonnet-3-5')) {
        body.thinking = { type: "enabled", budget_tokens: 1024 };
      }

      await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000) // Don't hang on warmup
      });

      this.lastWarmupTime.set(accountId, Date.now());
    } catch (error) {
      // Warmup failures are non-critical, but log them
      console.warn(`[AuthMonster] Thinking warmup failed for ${account.email}:`, error);
    }
  }

  /**
   * Generates headers using provider-specific logic
   */
  private getHeadersForAccount(provider: AuthProvider, account: ManagedAccount): Record<string, string> {
    switch (provider) {
      case AuthProvider.Gemini:
        return GeminiProvider.getHeaders(account);
      case AuthProvider.Anthropic:
        return AnthropicProvider.getHeaders(account);
      case AuthProvider.Cursor:
        return cursorProvider.getHeaders(account);
      case AuthProvider.Windsurf:
        return WindsurfProvider.getHeaders(account);
      default:
        // Default header generation fallback
        const headers: Record<string, string> = {};
        if (account.apiKey) {
          headers['Authorization'] = `Bearer ${account.apiKey}`;
        } else if (account.tokens.accessToken) {
          headers['Authorization'] = `Bearer ${account.tokens.accessToken}`;
        }
        return headers;
    }
  }

  /**
   * Provider-specific request transformations
   */
  transformRequest(provider: AuthProvider, body: any, modelInProvider?: string): any {
    // 1. Cross-model signature sanitization (Gemini <-> Claude conflicts)
    const sanitizedBody = sanitizeCrossModelRequest(body);

    // 2. Inject hub-selected model if present
    if (modelInProvider) {
      sanitizedBody.model = modelInProvider;
    }

    // 3. Provider-specific transformations
    switch (provider) {
      case AuthProvider.Anthropic:
        return anthropicTransformRequest(sanitizedBody);
      case AuthProvider.Gemini:
        return GeminiProvider.transformRequest(sanitizedBody);
      default:
        return sanitizedBody;
    }
  }

  /**
   * Provider-specific response transformations
   */
  transformResponse(provider: AuthProvider, text: string): string {
    switch (provider) {
      case AuthProvider.Anthropic:
        return anthropicTransformResponse(text);
      default:
        return text;
    }
  }

  /**
   * Returns all managed accounts (including tokens)
   */
  getAccounts(): ManagedAccount[] {
    return this.accounts;
  }

  /**
   * Returns health info for all accounts
   */
  getAllAccountsStatus() {
    return this.accounts.map(acc => ({
      id: acc.id,
      email: acc.email,
      provider: acc.provider,
      isHealthy: acc.isHealthy,
      healthScore: acc.healthScore ?? 70, // Default initial score if not set
      consecutiveFailures: acc.consecutiveFailures ?? 0,
      lastUsed: acc.lastUsed,
      cooldownUntil: acc.cooldownUntil,
      rateLimitResetTime: acc.rateLimitResetTime,
      lastSwitchReason: acc.lastSwitchReason
    }));
  }

  async addAccount(account: ManagedAccount) {
    await this.storage.addAccount(account);
    await this.init(); // Refresh local cache
  }

  async deleteAccount(id: string) {
    await this.storage.deleteAccount(id);
    await this.init(); // Refresh local cache
  }

  async reportSuccess(accountId: string) {
    const account = this.accounts.find(a => a.id === accountId);
    if (account) {
      this.rotator.recordSuccess(account);
      await this.storage.saveAccounts(this.accounts);
    }
  }

  async reportFailure(accountId: string) {
    const account = this.accounts.find(a => a.id === accountId);
    if (account) {
      this.rotator.recordFailure(account);
      await this.storage.saveAccounts(this.accounts);
    }
  }

  async reportRateLimit(accountId: string, retryAfterMs?: number, reason: RateLimitReason = 'UNKNOWN') {
    const account = this.accounts.find(a => a.id === accountId);
    if (account) {
      this.rotator.recordRateLimit(account, retryAfterMs, reason);
      await this.storage.saveAccounts(this.accounts);
    }
  }
}

// Example usage/factory
export function createAuthMonster(context: PluginContext) {
  return new AuthMonster(context);
}
