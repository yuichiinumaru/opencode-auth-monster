"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekProvider = void 0;
const types_1 = require("../../core/types");
class DeepSeekProvider {
    static getHeaders(account) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (account.apiKey) {
            headers['Authorization'] = `Bearer ${account.apiKey}`;
        }
        else if (account.tokens.accessToken) {
            headers['Authorization'] = `Bearer ${account.tokens.accessToken}`;
        }
        return headers;
    }
    static getUrl(model, account) {
        return "https://api.deepseek.com/chat/completions";
    }
}
exports.DeepSeekProvider = DeepSeekProvider;
DeepSeekProvider.provider = types_1.AuthProvider.DeepSeek;
