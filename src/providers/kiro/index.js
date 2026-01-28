"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KiroProvider = void 0;
const types_1 = require("../../core/types");
const extractor_1 = require("../../utils/extractor");
class KiroProvider {
    static getHeaders(account) {
        const headers = {
            'content-type': 'application/x-amz-json-1.0',
        };
        if (account.tokens.accessToken) {
            headers['Authorization'] = `Bearer ${account.tokens.accessToken}`;
        }
        return headers;
    }
    static async discoverAccount() {
        const token = await extractor_1.TokenExtractor.extractKiroFromSSOCache();
        if (!token)
            return null;
        return {
            id: `kiro-local-${Date.now()}`,
            email: token.email || 'local-kiro@aws',
            provider: types_1.AuthProvider.Kiro,
            tokens: {
                accessToken: token.token,
            },
            isHealthy: true,
            healthScore: 100,
            metadata: {
                source: 'aws-sso-cache'
            }
        };
    }
}
exports.KiroProvider = KiroProvider;
KiroProvider.provider = types_1.AuthProvider.Kiro;
