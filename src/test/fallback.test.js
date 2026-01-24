"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const types_1 = require("../core/types");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
async function testFallback() {
    const testStorage = path_1.default.join(__dirname, '../../test-fallback-storage');
    if (fs_1.default.existsSync(testStorage)) {
        fs_1.default.rmSync(testStorage, { recursive: true });
    }
    const monster = new index_1.AuthMonster({
        config: {
            active: types_1.AuthProvider.Gemini,
            fallback: [],
            method: 'sticky',
            providers: {},
            modelPriorities: {
                'gemini-3-pro-preview': ['claude-4.5-opus-thinking', 'gpt-5.2-codex']
            },
            fallbackDirection: 'down'
        },
        storagePath: testStorage
    });
    await monster.init();
    // Add accounts for different providers
    const geminiAcc = {
        id: 'gemini-acc',
        email: 'gemini@example.com',
        provider: types_1.AuthProvider.Gemini,
        tokens: { accessToken: 'g-token' },
        isHealthy: true,
        healthScore: 100
    };
    const anthropicAcc = {
        id: 'anthropic-acc',
        email: 'anthropic@example.com',
        provider: types_1.AuthProvider.Anthropic,
        tokens: { accessToken: 'a-token' },
        isHealthy: true,
        healthScore: 100
    };
    await monster.addAccount(geminiAcc);
    await monster.addAccount(anthropicAcc);
    console.log('--- Testing resolveModelChain ---');
    const chain = monster.hub.resolveModelChain('gemini-3-pro-preview', monster.config);
    console.log('Chain:', chain);
    if (chain.length === 3 && chain[1] === 'claude-4.5-opus-thinking') {
        console.log('SUCCESS: resolveModelChain works');
    }
    else {
        console.log('FAILURE: resolveModelChain failed', chain);
        process.exit(1);
    }
    console.log('--- Testing getAuthDetails Fallback ---');
    // First, it should pick Gemini
    const details1 = await monster.getAuthDetails('gemini-3-pro-preview');
    console.log('Details 1:', details1?.account.email, details1?.provider);
    if (details1?.provider === types_1.AuthProvider.Gemini) {
        console.log('SUCCESS: Picked Gemini first');
    }
    else {
        console.log('FAILURE: Did not pick Gemini first');
        process.exit(1);
    }
    // Now, report rate limit on Gemini
    console.log('Reporting rate limit on Gemini account...');
    await monster.reportRateLimit(geminiAcc.id, 60000, 'QUOTA_EXHAUSTED');
    // Now it should pick Anthropic (claude-4.5-opus-thinking)
    const details2 = await monster.getAuthDetails('gemini-3-pro-preview');
    console.log('Details 2:', details2?.account.email, details2?.provider);
    if (details2?.provider === types_1.AuthProvider.Anthropic) {
        console.log('SUCCESS: Picked Anthropic as fallback');
    }
    else {
        console.log('FAILURE: Did not pick Anthropic as fallback');
        process.exit(1);
    }
    console.log('--- Testing request with Transparent Fallback ---');
    // Reset health
    monster.accounts.forEach((a) => {
        a.isHealthy = true;
        a.rateLimitResetTime = 0;
    });
    let callCount = 0;
    let modelRequests = [];
    // Mock global fetch
    global.fetch = async (url, init) => {
        // Ignore warmup calls for accounting
        if (url.includes('messages') && init.body && JSON.parse(init.body).max_tokens === 1) {
            return { ok: true, text: async () => 'warmup' };
        }
        callCount++;
        const body = JSON.parse(init.body);
        modelRequests.push(body.model);
        if (body.model === 'gemini-3-pro') {
            return {
                status: 429,
                ok: false,
                clone: () => ({
                    text: async () => 'Quota exceeded'
                }),
                text: async () => 'Quota exceeded'
            };
        }
        return {
            status: 200,
            ok: true,
            text: async () => 'Success from ' + body.model
        };
    };
    const response = await monster.request('gemini-3-pro-preview', 'https://api.example.com', {
        method: 'POST',
        body: { prompt: 'Hello' }
    });
    const responseText = await response.text();
    console.log('Response text:', responseText);
    console.log('Model requests:', modelRequests);
    if (modelRequests.length === 2 && modelRequests[0] === 'gemini-3-pro' && modelRequests[1] === 'claude-4.5-opus-thinking') {
        console.log('SUCCESS: Transparent fallback works in request()');
    }
    else {
        console.log('FAILURE: Transparent fallback failed in request()', modelRequests, responseText);
        process.exit(1);
    }
    console.log('Fallback test completed successfully.');
}
testFallback().catch(err => {
    console.error(err);
    process.exit(1);
});
