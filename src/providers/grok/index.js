"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrokProvider = void 0;
const types_1 = require("../../core/types");
class GrokProvider {
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
        return "https://api.x.ai/v1/chat/completions";
    }
}
exports.GrokProvider = GrokProvider;
GrokProvider.provider = types_1.AuthProvider.Grok;
