"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IFlowProvider = void 0;
const types_1 = require("../../core/types");
const proxy_1 = require("../../core/proxy");
const oauth_server_1 = require("../../utils/oauth-server");
const CLIENT_ID = "10009311001";
const CLIENT_SECRET = process.env.IFLOW_CLIENT_SECRET || "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW";
const AUTH_URL = "https://iflow.cn/oauth";
const TOKEN_URL = "https://iflow.cn/oauth/token";
const USER_INFO_URL = "https://iflow.cn/api/oauth/getUserInfo";
const CALLBACK_PORT = 11451;
class IFlowProvider {
    static getHeaders(account) {
        const headers = {
            'content-type': 'application/json',
        };
        if (account.apiKey) {
            headers['Authorization'] = `Bearer ${account.apiKey}`;
        }
        else if (account.tokens.accessToken) {
            headers['Authorization'] = `Bearer ${account.tokens.accessToken}`;
        }
        return headers;
    }
    static async refreshTokens(account) {
        if (!account.tokens.refreshToken) {
            return account;
        }
        try {
            const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
            const response = await (0, proxy_1.proxyFetch)(TOKEN_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                    "Authorization": `Basic ${basic}`
                },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: account.tokens.refreshToken,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET
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
            console.error('Failed to refresh iFlow tokens:', error);
            return {
                ...account,
                isHealthy: false
            };
        }
    }
    static async login() {
        const redirectUri = `http://localhost:${CALLBACK_PORT}/oauth2callback`;
        const state = Math.random().toString(36).substring(7);
        const params = new URLSearchParams({
            loginMethod: "phone",
            type: "phone",
            redirect: redirectUri,
            state: state,
            client_id: CLIENT_ID
        });
        const authUrl = `${AUTH_URL}?${params.toString()}`;
        console.log(`\nTo authenticate with iFlow, please open your browser and visit:`);
        console.log(`\x1b[36m${authUrl}\x1b[0m\n`);
        console.log(`Waiting for callback on port ${CALLBACK_PORT}...`);
        const codeWithState = await (0, oauth_server_1.listenForCode)(CALLBACK_PORT);
        const code = codeWithState.split('#')[0];
        console.log('Code received, exchanging for tokens...');
        const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const response = await (0, proxy_1.proxyFetch)(TOKEN_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
                "Authorization": `Basic ${basic}`
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            }).toString()
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to exchange code for tokens: ${response.status} ${errorText}`);
        }
        const json = await response.json();
        const accessToken = json.access_token;
        // Fetch User Info to get API Key
        let apiKey = undefined;
        let email = undefined;
        if (accessToken) {
            try {
                const userInfoResp = await (0, proxy_1.proxyFetch)(`${USER_INFO_URL}?accessToken=${encodeURIComponent(accessToken)}`, {
                    headers: { "Accept": "application/json" }
                });
                if (userInfoResp.ok) {
                    const userInfo = await userInfoResp.json();
                    if (userInfo.success && userInfo.data) {
                        apiKey = userInfo.data.apiKey;
                        email = userInfo.data.email || userInfo.data.phone;
                    }
                }
            }
            catch (e) {
                console.warn("Failed to fetch iFlow user info:", e);
            }
        }
        return {
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
            expiryDate: Date.now() + (json.expires_in * 1000),
            tokenType: json.token_type || 'Bearer',
            apiKey,
            email
        };
    }
}
exports.IFlowProvider = IFlowProvider;
IFlowProvider.provider = types_1.AuthProvider.IFlow;
