"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMonster = void 0;
exports.createAuthMonster = createAuthMonster;
const types_1 = require("./core/types");
const storage_1 = require("./core/storage");
const rotation_1 = require("./core/rotation");
const hub_1 = require("./core/hub");
const sanitizer_1 = require("./utils/sanitizer");
const proxy_1 = require("./core/proxy");
// Import Providers
const gemini_1 = require("./providers/gemini");
const anthropic_1 = require("./providers/anthropic");
const cursor_1 = require("./providers/cursor");
const windsurf_1 = require("./providers/windsurf");
const qwen_1 = require("./providers/qwen");
const iflow_1 = require("./providers/iflow");
const kiro_1 = require("./providers/kiro");
const zhipu_1 = require("./providers/zhipu");
const minimax_1 = require("./providers/minimax");
const azure_1 = require("./providers/azure");
const grok_1 = require("./providers/grok");
const deepseek_1 = require("./providers/deepseek");
class AuthMonster {
    constructor(context) {
        this.accounts = [];
        this.lastUsedAccountId = null;
        this.lastWarmupTime = new Map();
        this.config = context.config;
        this.storage = new storage_1.StorageManager(context.storagePath);
        this.rotator = new rotation_1.AccountRotator();
        this.hub = new hub_1.UnifiedModelHub();
    }
    async init() {
        this.accounts = await this.storage.loadAccounts();
    }
    async getAuthDetails(modelOrProvider) {
        // 1. Try routing via Unified Model Hub if it looks like a model name
        if (modelOrProvider && typeof modelOrProvider === 'string' &&
            !Object.values(types_1.AuthProvider).includes(modelOrProvider)) {
            const modelChain = this.hub.resolveModelChain(modelOrProvider, this.config);
            for (const modelName of modelChain) {
                const hubChoice = this.hub.selectModelAccount(modelName, this.accounts);
                if (hubChoice) {
                    const details = this.selectAccount(hubChoice.provider, [hubChoice.account], hubChoice.modelInProvider);
                    if (details)
                        return details;
                }
            }
        }
        // 2. Default provider-based selection
        const targetProvider = modelOrProvider || this.config.active;
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
    selectAccount(provider, accounts, modelInProvider) {
        const account = this.rotator.selectAccount(accounts, this.config.method);
        if (!account) {
            return null;
        }
        // Thinking Warmup: Triggered when switching to a new account
        if (this.lastUsedAccountId !== account.id) {
            this.runThinkingWarmup(account.id).catch(err => console.error(`[AuthMonster] Warmup background task failed for ${account.email}:`, err));
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
     * Performs a request with transparent model fallback and retries.
     * If a model in the chain fails with a quota error, it automatically
     * reports the error and moves to the next model in the chain.
     */
    async request(model, url, options) {
        const modelChain = this.hub.resolveModelChain(model, this.config);
        let lastError = new Error(`No available accounts for model chain: ${modelChain.join(', ')}`);
        for (const currentModel of modelChain) {
            const auth = await this.getAuthDetails(currentModel);
            if (!auth)
                continue;
            try {
                const headers = { ...options.headers, ...auth.headers };
                let body = options.body;
                // Transform body if it's an object (AI request)
                if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
                    body = JSON.stringify(this.transformRequest(auth.provider, body, auth.modelInProvider));
                }
                const targetUrl = this.getRequestUrl(auth.provider, auth.modelInProvider || model, auth.account) || url;
                if (auth.provider === types_1.AuthProvider.Windsurf) {
                    return this.handleWindsurfRequest(auth, options);
                }
                const response = await (0, proxy_1.proxyFetch)(targetUrl, {
                    ...options,
                    headers,
                    body
                });
                if (response.status === 429 || response.status === 403) {
                    const text = await response.clone().text().catch(() => '');
                    if (text.toLowerCase().includes('quota') || text.toLowerCase().includes('rate limit')) {
                        console.warn(`[AuthMonster] Quota exceeded for ${auth.account.email} (${auth.provider}). Falling back...`);
                        await this.reportRateLimit(auth.account.id, 60000, 'QUOTA_EXHAUSTED');
                        continue; // Try next in chain
                    }
                }
                if (!response.ok) {
                    const errorText = await response.clone().text().catch(() => 'Unknown error');
                    console.warn(`[AuthMonster] Request failed for ${auth.account.email} (${auth.provider}): ${response.status} ${errorText}`);
                    // For non-quota errors, we might still want to report failure but maybe not fallback?
                    // Actually, let's report failure and see if we should continue.
                    await this.reportFailure(auth.account.id);
                    // If it's a 5xx error, maybe we should try another model too.
                    if (response.status >= 500)
                        continue;
                }
                else {
                    await this.reportSuccess(auth.account.id);
                }
                return response;
            }
            catch (error) {
                console.error(`[AuthMonster] Error during request with ${auth.account.email}:`, error);
                await this.reportFailure(auth.account.id);
                lastError = error;
                continue; // Try next in chain
            }
        }
        throw lastError;
    }
    /**
     * Sends a lightweight request to 'wake up' reasoning models
     */
    async runThinkingWarmup(accountId) {
        const account = this.accounts.find(a => a.id === accountId);
        if (!account)
            return;
        // Only warmup reasoning models (Anthropic Claude 4.5 Opus / Thinking)
        if (account.provider !== types_1.AuthProvider.Anthropic)
            return;
        // Throttle warmups to once every 5 minutes per account
        const lastWarmup = this.lastWarmupTime.get(accountId) ?? 0;
        if (Date.now() - lastWarmup < 5 * 60 * 1000)
            return;
        const isReasoningModel = account.metadata?.model?.includes('opus') ||
            account.metadata?.model?.includes('thinking') ||
            !account.metadata?.model; // Assume reasoning if model unknown for Anthropic
        if (!isReasoningModel)
            return;
        try {
            const headers = this.getHeadersForAccount(account.provider, account);
            const url = account.apiKey
                ? "https://api.anthropic.com/v1/messages"
                : "https://console.anthropic.com/api/v1/messages";
            const body = {
                model: account.metadata?.model || "claude-4.5-opus-thinking",
                max_tokens: 1,
                messages: [{ role: "user", content: "Hello" }]
            };
            // Enable thinking if supported
            if (body.model.includes('thinking') || body.model.includes('opus')) {
                body.thinking = { type: "enabled", budget_tokens: 1024 };
            }
            await (0, proxy_1.proxyFetch)(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(5000) // Don't hang on warmup
            });
            this.lastWarmupTime.set(accountId, Date.now());
        }
        catch (error) {
            // Warmup failures are non-critical, but log them
            console.warn(`[AuthMonster] Thinking warmup failed for ${account.email}:`, error);
        }
    }
    /**
     * Generates headers using provider-specific logic
     */
    getHeadersForAccount(provider, account) {
        switch (provider) {
            case types_1.AuthProvider.Gemini:
                return gemini_1.GeminiProvider.getHeaders(account);
            case types_1.AuthProvider.Anthropic:
                return anthropic_1.AnthropicProvider.getHeaders(account);
            case types_1.AuthProvider.Cursor:
                return cursor_1.cursorProvider.getHeaders(account);
            case types_1.AuthProvider.Windsurf:
                return windsurf_1.WindsurfProvider.getHeaders(account);
            case types_1.AuthProvider.Qwen:
                return qwen_1.QwenProvider.getHeaders(account);
            case types_1.AuthProvider.IFlow:
                return iflow_1.IFlowProvider.getHeaders(account);
            case types_1.AuthProvider.Kiro:
                return kiro_1.KiroProvider.getHeaders(account);
            case types_1.AuthProvider.Zhipu:
                return zhipu_1.ZhipuProvider.getHeaders(account);
            case types_1.AuthProvider.Minimax:
                return minimax_1.MinimaxProvider.getHeaders(account);
            case types_1.AuthProvider.Azure:
                return azure_1.AzureProvider.getHeaders(account);
            case types_1.AuthProvider.Grok:
                return grok_1.GrokProvider.getHeaders(account);
            case types_1.AuthProvider.DeepSeek:
                return deepseek_1.DeepSeekProvider.getHeaders(account);
            default:
                // Default header generation fallback
                const headers = {};
                if (account.apiKey) {
                    headers['Authorization'] = `Bearer ${account.apiKey}`;
                }
                else if (account.tokens.accessToken) {
                    headers['Authorization'] = `Bearer ${account.tokens.accessToken}`;
                }
                return headers;
        }
    }
    /**
     * Provider-specific request transformations
     */
    transformRequest(provider, body, modelInProvider) {
        // 1. Cross-model signature sanitization (Gemini <-> Claude conflicts)
        const sanitizedBody = (0, sanitizer_1.sanitizeCrossModelRequest)(body);
        // 2. Inject hub-selected model if present
        if (modelInProvider) {
            sanitizedBody.model = modelInProvider;
        }
        // 3. Provider-specific transformations
        switch (provider) {
            case types_1.AuthProvider.Anthropic:
                return (0, anthropic_1.transformRequest)(sanitizedBody);
            case types_1.AuthProvider.Gemini:
                return gemini_1.GeminiProvider.transformRequest(sanitizedBody);
            default:
                return sanitizedBody;
        }
    }
    /**
     * Provider-specific response transformations
     */
    transformResponse(provider, text) {
        switch (provider) {
            case types_1.AuthProvider.Anthropic:
                return (0, anthropic_1.transformResponseText)(text);
            default:
                return text;
        }
    }
    getRequestUrl(provider, model, account) {
        if (provider === types_1.AuthProvider.Generic ||
            (this.config.providers && this.config.providers[provider]?.options?.baseUrl)) {
            const baseUrl = this.config.providers[provider]?.options?.baseUrl;
            if (baseUrl) {
                return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
            }
        }
        switch (provider) {
            case types_1.AuthProvider.Gemini: return gemini_1.GeminiProvider.getUrl(model, account);
            case types_1.AuthProvider.Anthropic: return anthropic_1.AnthropicProvider.getUrl(model, account);
            case types_1.AuthProvider.Cursor: return cursor_1.cursorProvider.getUrl(model, account);
            case types_1.AuthProvider.Windsurf: return windsurf_1.WindsurfProvider.getUrl(model, account);
            case types_1.AuthProvider.Qwen: return qwen_1.QwenProvider.getUrl(model, account);
            case types_1.AuthProvider.Azure: return azure_1.AzureProvider.getUrl(model, account);
            case types_1.AuthProvider.Grok: return grok_1.GrokProvider.getUrl(model, account);
            case types_1.AuthProvider.DeepSeek: return deepseek_1.DeepSeekProvider.getUrl(model, account);
            default: return null;
        }
    }
    async handleWindsurfRequest(auth, options) {
        let messages = [];
        let model = auth.modelInProvider || 'default';
        try {
            const bodyObj = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            if (bodyObj) {
                messages = bodyObj.messages || [];
                if (bodyObj.model)
                    model = bodyObj.model;
            }
        }
        catch (e) { }
        const credentials = {
            apiKey: auth.account.apiKey || auth.account.tokens.accessToken,
            port: auth.account.metadata?.port,
            csrfToken: auth.account.metadata?.csrfToken,
            version: auth.account.metadata?.version
        };
        if (!credentials.apiKey || !credentials.port || !credentials.csrfToken) {
            throw new Error("Missing Windsurf credentials (port, csrfToken, or apiKey)");
        }
        const text = await (0, windsurf_1.streamChat)(credentials, { model, messages });
        return new Response(JSON.stringify({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                    index: 0,
                    message: { role: 'assistant', content: text },
                    finish_reason: 'stop'
                }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    /**
     * Returns all managed accounts (including tokens)
     */
    getAccounts() {
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
    async addAccount(account) {
        await this.storage.addAccount(account);
        await this.init(); // Refresh local cache
    }
    async deleteAccount(id) {
        await this.storage.deleteAccount(id);
        await this.init(); // Refresh local cache
    }
    async reportSuccess(accountId) {
        const account = this.accounts.find(a => a.id === accountId);
        if (account) {
            this.rotator.recordSuccess(account);
            await this.storage.saveAccounts(this.accounts);
        }
    }
    async reportFailure(accountId) {
        const account = this.accounts.find(a => a.id === accountId);
        if (account) {
            this.rotator.recordFailure(account);
            await this.storage.saveAccounts(this.accounts);
        }
    }
    async reportRateLimit(accountId, retryAfterMs, reason = 'UNKNOWN') {
        const account = this.accounts.find(a => a.id === accountId);
        if (account) {
            this.rotator.recordRateLimit(account, retryAfterMs, reason);
            await this.storage.saveAccounts(this.accounts);
        }
    }
}
exports.AuthMonster = AuthMonster;
// Example usage/factory
function createAuthMonster(context) {
    return new AuthMonster(context);
}
