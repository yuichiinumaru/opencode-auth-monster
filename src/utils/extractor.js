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
exports.TokenExtractor = void 0;
exports.autoDiscoverAccounts = autoDiscoverAccounts;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const types_1 = require("../core/types");
/**
 * Utility to extract tokens from local application storage
 */
class TokenExtractor {
    /**
     * Extract Cursor tokens from macOS Keychain
     */
    static extractCursorFromKeychain() {
        if (process.platform !== 'darwin')
            return null;
        try {
            // Use security tool to find generic password
            // -s: service name
            // -w: display only the password
            const accessToken = (0, node_child_process_1.execSync)('security find-generic-password -s "cursor-access-token" -w', {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
            }).trim();
            let refreshToken;
            try {
                refreshToken = (0, node_child_process_1.execSync)('security find-generic-password -s "cursor-refresh-token" -w', {
                    encoding: 'utf8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }).trim();
            }
            catch (e) {
                // Refresh token might not be present if not logged in fully or different version
            }
            if (accessToken) {
                return { accessToken, refreshToken };
            }
        }
        catch (e) {
            // Failed to extract from keychain or not found
        }
        return null;
    }
    /**
     * Extract tokens from a VS Code-like SQLite state database
     */
    static extractFromSQLite(statePath, key) {
        if (!fs.existsSync(statePath))
            return null;
        try {
            // Direct SQL query on ItemTable
            const query = `SELECT value FROM ItemTable WHERE key = '${key}';`;
            const result = (0, node_child_process_1.execSync)(`sqlite3 "${statePath}" "${query}"`, {
                encoding: 'utf8',
                timeout: 5000,
                stdio: ['pipe', 'pipe', 'pipe'],
            }).trim();
            return result || null;
        }
        catch (e) {
            return null;
        }
    }
    /**
     * Extract Cursor tokens from SQLite (Fallback for macOS or primary for Linux)
     */
    static extractCursorFromSQLite() {
        const paths = {
            darwin: path.join(os.homedir(), 'Library/Application Support/Cursor/User/globalStorage/state.vscdb'),
            linux: path.join(os.homedir(), '.config/Cursor/User/globalStorage/state.vscdb'),
            win32: path.join(os.homedir(), 'AppData/Roaming/Cursor/User/globalStorage/state.vscdb'),
        };
        const statePath = paths[process.platform];
        if (!statePath)
            return null;
        const accessToken = this.extractFromSQLite(statePath, 'cursor::accessToken');
        // Refresh token might not be in SQLite or under different key
        if (accessToken) {
            return { accessToken };
        }
        return null;
    }
    /**
     * Extract Windsurf API key from SQLite database
     */
    static extractWindsurfFromSQLite() {
        const paths = {
            darwin: path.join(os.homedir(), 'Library/Application Support/Windsurf/User/globalStorage/state.vscdb'),
            linux: path.join(os.homedir(), '.config/Windsurf/User/globalStorage/state.vscdb'),
            win32: path.join(os.homedir(), 'AppData/Roaming/Windsurf/User/globalStorage/state.vscdb'),
        };
        const statePath = paths[process.platform];
        if (!statePath)
            return null;
        const result = this.extractFromSQLite(statePath, 'windsurfAuthStatus');
        if (result) {
            try {
                const parsed = JSON.parse(result);
                return parsed.apiKey || null;
            }
            catch (e) {
                // Some versions might store it differently
                return result;
            }
        }
        return null;
    }
}
exports.TokenExtractor = TokenExtractor;
/**
 * Unified discovery function that scans for all supported local accounts
 */
async function autoDiscoverAccounts() {
    const accounts = [];
    // --- Discover Cursor ---
    let cursorData = TokenExtractor.extractCursorFromKeychain();
    if (!cursorData) {
        cursorData = TokenExtractor.extractCursorFromSQLite();
    }
    if (cursorData) {
        accounts.push({
            id: `cursor-local`,
            email: 'local@cursor',
            provider: types_1.AuthProvider.Cursor,
            tokens: {
                accessToken: cursorData.accessToken,
                refreshToken: cursorData.refreshToken,
            },
            isHealthy: true,
            metadata: {
                discoveredAt: Date.now(),
                method: cursorData.refreshToken ? 'keychain' : 'sqlite'
            }
        });
    }
    // --- Discover Windsurf ---
    const windsurfApiKey = TokenExtractor.extractWindsurfFromSQLite();
    if (windsurfApiKey) {
        accounts.push({
            id: `windsurf-local`,
            email: 'local@windsurf',
            provider: types_1.AuthProvider.Windsurf,
            tokens: {
                accessToken: windsurfApiKey,
            },
            apiKey: windsurfApiKey,
            isHealthy: true,
            metadata: {
                discoveredAt: Date.now(),
                method: 'sqlite'
            }
        });
    }
    return accounts;
}
