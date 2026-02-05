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
exports.autoDiscoverAccounts = exports.TokenExtractor = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const types_1 = require("../core/types");
class TokenExtractor {
    static extractCursorFromKeychain() {
        const token = this.getCursorToken();
        if (!token)
            return null;
        return { accessToken: token, source: "keychain" };
    }
    static extractCursorFromSQLite() {
        return null;
    }
    static extractWindsurfFromSQLite() {
        return this.getWindsurfAuth();
    }
    /**
     * Auto-discover accounts from local environment (Cursor, Windsurf, Env Vars).
     */
    static async discoverAll() {
        const accounts = [];
        // 1. Cursor (Keychain)
        try {
            const cursorToken = this.getCursorToken();
            if (cursorToken) {
                accounts.push({
                    id: 'cursor-local',
                    email: 'local-cursor@device',
                    provider: types_1.AuthProvider.Cursor,
                    tokens: { accessToken: cursorToken },
                    isHealthy: true,
                    healthScore: 100,
                    metadata: { source: 'keychain' }
                });
            }
        }
        catch (e) {
            // Ignore missing cursor
        }
        // 2. Windsurf (SQLite)
        try {
            const windsurfAuth = this.getWindsurfAuth();
            if (windsurfAuth) {
                accounts.push({
                    id: 'windsurf-local',
                    email: 'local-windsurf@device',
                    provider: types_1.AuthProvider.Windsurf,
                    tokens: { accessToken: windsurfAuth },
                    isHealthy: true,
                    healthScore: 100,
                    metadata: { source: 'sqlite' }
                });
            }
        }
        catch (e) {
            // Ignore missing windsurf
        }
        // 3. Qwen (File)
        try {
            const qwenToken = this.getQwenToken();
            if (qwenToken) {
                accounts.push({
                    id: 'qwen-local',
                    email: 'local-qwen@device',
                    provider: types_1.AuthProvider.Qwen,
                    tokens: { accessToken: qwenToken },
                    isHealthy: true,
                    healthScore: 100,
                    metadata: { source: 'file' }
                });
            }
        }
        catch (e) {
            // Ignore missing qwen
        }
        return accounts;
    }
    /**
     * Extract Cursor token from macOS Keychain.
     */
    static getCursorToken() {
        if (process.platform !== 'darwin')
            return null;
        try {
            return (0, child_process_1.execSync)('security find-generic-password -s "cursor-access-token" -w', {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
            }).trim();
        }
        catch (e) {
            return null;
        }
    }
    /**
     * Extract Windsurf auth status from SQLite DB.
     */
    static getWindsurfAuth() {
        const home = os.homedir();
        // Common path on macOS/Linux
        const dbPath = path.join(home, 'Library/Application Support/Windsurf/User/globalStorage/state.vscdb');
        if (!fs.existsSync(dbPath))
            return null;
        try {
            // Query SQLite directly
            const query = "SELECT value FROM ItemTable WHERE key = 'windsurfAuthStatus';";
            const result = (0, child_process_1.execSync)(`sqlite3 "${dbPath}" "${query}"`, {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            }).trim();
            if (!result)
                return null;
            // Parse JSON result to get access token
            const json = JSON.parse(result);
            return json.accessToken || null;
        }
        catch (e) {
            return null;
        }
    }
    /**
     * Extract Qwen token from local creds file.
     */
    static getQwenToken() {
        const home = os.homedir();
        const credsPath = path.join(home, '.qwen/oauth_creds.json');
        if (!fs.existsSync(credsPath))
            return null;
        try {
            const data = fs.readFileSync(credsPath, 'utf8');
            const json = JSON.parse(data);
            return json.access_token || null;
        }
        catch (e) {
            return null;
        }
    }
}
exports.TokenExtractor = TokenExtractor;
// Export for direct usage
const autoDiscoverAccounts = () => TokenExtractor.discoverAll();
exports.autoDiscoverAccounts = autoDiscoverAccounts;
