"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProviderEndpoint = getProviderEndpoint;
const types_1 = require("./types");
function getProviderEndpoint(provider, account, model) {
    switch (provider) {
        case types_1.AuthProvider.Anthropic:
            return account?.apiKey
                ? "https://api.anthropic.com/v1/messages"
                : "https://console.anthropic.com/api/v1/messages";
        case types_1.AuthProvider.Gemini:
            // Gemini requires model in URL often
            const modelName = model || account?.metadata?.model || 'gemini-2.0-flash';
            return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
        case types_1.AuthProvider.OpenAI:
        case types_1.AuthProvider.Copilot: // Copilot is often OpenAI compatible or routed via GitHub
            return "https://api.openai.com/v1/chat/completions";
        case types_1.AuthProvider.Qwen:
            return "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
        case types_1.AuthProvider.Zhipu:
            return "https://open.bigmodel.cn/api/paas/v4/chat/completions";
        case types_1.AuthProvider.Minimax:
            return "https://api.minimax.chat/v1/text/chatcompletion_v2";
        // For Cursor and Windsurf, since they use gRPC/Proto and AuthMonster doesn't fully abstract the protocol conversion
        // from JSON to Proto for 'request()', we might return a dummy URL or handle it if we knew the JSON proxy.
        // For now, we return a URL that might work if there's a JSON bridge, otherwise it might fail.
        case types_1.AuthProvider.Cursor:
            return "https://api2.cursor.sh/llm/chat";
        case types_1.AuthProvider.Windsurf:
            return "https://codeium.com/api/v1/chat";
        default:
            return "https://api.openai.com/v1/chat/completions";
    }
}
