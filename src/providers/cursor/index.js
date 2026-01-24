"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cursorProvider = exports.CursorProvider = void 0;
const node_crypto_1 = require("node:crypto");
const types_1 = require("../../core/types");
const proto_1 = require("./proto");
const extractor_1 = require("../../utils/extractor");
const proxy_1 = require("../../core/proxy");
const CURSOR_API_BASE_URL = "https://api2.cursor.sh";
const REFRESH_ENDPOINT = "/auth/refresh";
class CursorProvider {
    /**
     * Get request headers for Cursor API
     */
    getHeaders(account) {
        const accessToken = account.tokens.accessToken;
        const checksum = (0, proto_1.generateChecksum)(accessToken);
        return {
            "authorization": `Bearer ${accessToken}`,
            "content-type": "application/grpc-web+proto",
            "user-agent": "connect-es/1.4.0",
            "x-cursor-checksum": checksum,
            "x-cursor-client-version": "cli-2025.11.25-d5b3271",
            "x-cursor-client-type": "cli",
            "x-cursor-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
            "x-ghost-mode": "true",
            "x-request-id": (0, node_crypto_1.randomUUID)(),
            "host": new URL(CURSOR_API_BASE_URL).host,
        };
    }
    /**
     * Refresh the access token using the refresh token
     */
    async refreshTokens(refreshToken) {
        try {
            const response = await (0, proxy_1.proxyFetch)(`${CURSOR_API_BASE_URL}${REFRESH_ENDPOINT}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${refreshToken}`,
                },
                body: JSON.stringify({}),
            });
            if (!response.ok) {
                return null;
            }
            const result = await response.json();
            if (typeof result === "object" &&
                result !== null &&
                "accessToken" in result &&
                "refreshToken" in result) {
                return {
                    accessToken: result.accessToken,
                    refreshToken: result.refreshToken,
                    // Cursor tokens are JWTs, but we don't parse them here to get expiry.
                    // The consumer can parse the JWT if needed.
                    tokenType: 'Bearer'
                };
            }
        }
        catch (error) {
            console.error("Failed to refresh Cursor tokens:", error);
        }
        return null;
    }
    /**
     * Automatically discover local Cursor accounts
     */
    async discover() {
        const data = extractor_1.TokenExtractor.extractCursorFromKeychain() || extractor_1.TokenExtractor.extractCursorFromSQLite();
        if (!data)
            return null;
        return {
            id: `cursor-local-${Date.now()}`,
            email: 'local@cursor',
            provider: types_1.AuthProvider.Cursor,
            tokens: {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
            },
            isHealthy: true,
            metadata: {
                discoveredAt: Date.now(),
                method: data.refreshToken ? 'keychain' : 'sqlite'
            }
        };
    }
}
exports.CursorProvider = CursorProvider;
exports.cursorProvider = new CursorProvider();
