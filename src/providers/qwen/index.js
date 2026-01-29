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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.QwenProvider = void 0;
const types_1 = require("../../core/types");
const proxy_1 = require("../../core/proxy");
const crypto = __importStar(require("crypto"));
const CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56";
const DEVICE_CODE_URL = "https://chat.qwen.ai/api/v1/oauth2/device/code";
const TOKEN_URL = "https://chat.qwen.ai/api/v1/oauth2/token";
const SCOPE = "openid profile email model.completion";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
function generateCodeVerifier() {
    return base64URLEncode(crypto.randomBytes(32));
}
function generateCodeChallenge(verifier) {
    return base64URLEncode(crypto.createHash('sha256').update(verifier).digest());
}
function base64URLEncode(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}
class QwenProvider {
    static getHeaders(account) {
        const headers = {
            'content-type': 'application/json',
        };
        if (account.tokens.accessToken) {
            headers['authorization'] = `Bearer ${account.tokens.accessToken}`;
        }
        return headers;
    }
    static getUrl(model, account) {
        return "https://chat.qwen.ai/api/v1/chat/completions";
    }
    static async refreshTokens(account) {
        if (!account.tokens.refreshToken) {
            return account;
        }
        try {
            const response = await (0, proxy_1.proxyFetch)(TOKEN_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: account.tokens.refreshToken,
                    client_id: CLIENT_ID,
                }).toString()
            });
            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status}`);
            }
            const json = await response.json();
            return {
                ...account,
                tokens: {
                    ...account.tokens,
                    accessToken: json.access_token,
                    refreshToken: json.refresh_token || account.tokens.refreshToken,
                    expiryDate: Date.now() + json.expires_in * 1000,
                    tokenType: json.token_type || 'Bearer',
                },
                lastUsed: Date.now(),
            };
        }
        catch (error) {
            console.error('Failed to refresh Qwen tokens:', error);
            return {
                ...account,
                isHealthy: false
            };
        }
    }
    static async login() {
        // 1. Generate PKCE
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier);
        // 2. Initiate Device Flow
        const deviceResp = await (0, proxy_1.proxyFetch)(DEVICE_CODE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                scope: SCOPE,
                code_challenge: challenge,
                code_challenge_method: 'S256'
            }).toString()
        });
        if (!deviceResp.ok) {
            throw new Error(`Device flow initiation failed: ${deviceResp.status} ${await deviceResp.text()}`);
        }
        const deviceData = await deviceResp.json();
        const deviceCode = deviceData.device_code;
        const userCode = deviceData.user_code;
        const verificationUri = deviceData.verification_uri_complete || deviceData.verification_uri;
        const interval = deviceData.interval || 5;
        console.log(`\nTo authenticate with Qwen, please visit:`);
        console.log(`\x1b[36m${verificationUri}\x1b[0m`);
        console.log(`And enter code: \x1b[1m${userCode}\x1b[0m\n`);
        console.log(`Waiting for confirmation...`);
        // 3. Poll for token
        while (true) {
            await new Promise(resolve => setTimeout(resolve, interval * 1000));
            const tokenResp = await (0, proxy_1.proxyFetch)(TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: GRANT_TYPE,
                    client_id: CLIENT_ID,
                    device_code: deviceCode,
                    code_verifier: verifier
                }).toString()
            });
            if (tokenResp.ok) {
                const json = await tokenResp.json();
                return {
                    accessToken: json.access_token,
                    refreshToken: json.refresh_token,
                    expiryDate: Date.now() + (json.expires_in * 1000),
                    tokenType: json.token_type || 'Bearer'
                };
            }
            const errorText = await tokenResp.text();
            let errorData = {};
            try {
                errorData = JSON.parse(errorText);
            }
            catch { }
            if (errorData.error === 'authorization_pending') {
                continue;
            }
            else if (errorData.error === 'slow_down') {
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }
            else {
                throw new Error(`Polling failed: ${tokenResp.status} ${errorText}`);
            }
        }
    }
}
exports.QwenProvider = QwenProvider;
QwenProvider.provider = types_1.AuthProvider.Qwen;
