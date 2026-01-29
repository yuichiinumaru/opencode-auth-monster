"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindsurfProvider = void 0;
const types_1 = require("../../core/types");
const auth_1 = require("./auth");
const extractor_1 = require("../../utils/extractor");
class WindsurfProvider {
    static getHeaders(account) {
        const headers = {
            'Content-Type': 'application/grpc',
        };
        if (account.metadata?.csrfToken) {
            headers['x-codeium-csrf-token'] = account.metadata.csrfToken;
        }
        return headers;
    }
    static getUrl(model, account) {
        const port = account.metadata?.port || 0;
        return `http://localhost:${port}/exa.language_server_pb.LanguageServerService/RawGetChatMessage`;
    }
    static async refreshTokens(account) {
        try {
            // Re-discover credentials
            const credentials = (0, auth_1.getCredentials)();
            // Update account with new credentials
            return {
                ...account,
                apiKey: credentials.apiKey,
                metadata: {
                    ...account.metadata,
                    csrfToken: credentials.csrfToken,
                    port: credentials.port,
                    version: credentials.version,
                    lastRefreshed: Date.now()
                },
                isHealthy: true
            };
        }
        catch (error) {
            console.error('Failed to refresh Windsurf credentials:', error);
            return {
                ...account,
                isHealthy: false,
                lastSwitchReason: error instanceof Error ? error.message : 'Unknown error during refresh'
            };
        }
    }
    /**
     * Automatically discover local Windsurf accounts
     */
    static async discover() {
        try {
            const credentials = (0, auth_1.getCredentials)();
            return {
                id: `windsurf-local-${Date.now()}`,
                email: 'local@windsurf',
                provider: types_1.AuthProvider.Windsurf,
                tokens: { accessToken: credentials.apiKey },
                apiKey: credentials.apiKey,
                metadata: {
                    csrfToken: credentials.csrfToken,
                    port: credentials.port,
                    version: credentials.version,
                    discoveredAt: Date.now()
                },
                isHealthy: true
            };
        }
        catch (error) {
            // If process not running, try direct SQLite extraction via TokenExtractor
            const apiKey = extractor_1.TokenExtractor.extractWindsurfFromSQLite();
            if (apiKey) {
                return {
                    id: `windsurf-local-${Date.now()}`,
                    email: 'local@windsurf',
                    provider: types_1.AuthProvider.Windsurf,
                    tokens: { accessToken: apiKey },
                    apiKey: apiKey,
                    isHealthy: true,
                    metadata: {
                        discoveredAt: Date.now(),
                        method: 'sqlite'
                    }
                };
            }
            return null;
        }
    }
    // Helper to initialize a new account from environment
    static async discoverAccount() {
        const account = await this.discover();
        if (!account) {
            throw new Error('Could not discover local Windsurf account');
        }
        return account;
    }
}
exports.WindsurfProvider = WindsurfProvider;
WindsurfProvider.provider = types_1.AuthProvider.Windsurf;
__exportStar(require("./grpc-client"), exports);
__exportStar(require("./auth"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./models"), exports);
