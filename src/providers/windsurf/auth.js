"use strict";
/**
 * Windsurf Credential Discovery Module
 *
 * Automatically discovers credentials from the running Windsurf language server:
 * - CSRF token from process arguments
 * - Port from process arguments (extension_server_port + 2)
 * - API key from VSCode state database (~/Library/Application Support/Windsurf/User/globalStorage/state.vscdb)
 * - Version from process arguments
 */
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
exports.WindsurfError = exports.WindsurfErrorCode = void 0;
exports.getCSRFToken = getCSRFToken;
exports.getPort = getPort;
exports.getApiKey = getApiKey;
exports.getWindsurfVersion = getWindsurfVersion;
exports.getCredentials = getCredentials;
exports.isWindsurfRunning = isWindsurfRunning;
exports.isWindsurfInstalled = isWindsurfInstalled;
exports.validateCredentials = validateCredentials;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
var WindsurfErrorCode;
(function (WindsurfErrorCode) {
    WindsurfErrorCode["NOT_RUNNING"] = "NOT_RUNNING";
    WindsurfErrorCode["CSRF_MISSING"] = "CSRF_MISSING";
    WindsurfErrorCode["API_KEY_MISSING"] = "API_KEY_MISSING";
    WindsurfErrorCode["CONNECTION_FAILED"] = "CONNECTION_FAILED";
    WindsurfErrorCode["AUTH_FAILED"] = "AUTH_FAILED";
    WindsurfErrorCode["STREAM_ERROR"] = "STREAM_ERROR";
})(WindsurfErrorCode || (exports.WindsurfErrorCode = WindsurfErrorCode = {}));
class WindsurfError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'WindsurfError';
        this.code = code;
        this.details = details;
    }
}
exports.WindsurfError = WindsurfError;
// ============================================================================
// Config Paths
// ============================================================================
// Paths for API key discovery
const VSCODE_STATE_PATHS = {
    darwin: path.join(os.homedir(), 'Library/Application Support/Windsurf/User/globalStorage/state.vscdb'),
    linux: path.join(os.homedir(), '.config/Windsurf/User/globalStorage/state.vscdb'),
    win32: path.join(os.homedir(), 'AppData/Roaming/Windsurf/User/globalStorage/state.vscdb'),
};
// Legacy config path (fallback)
const LEGACY_CONFIG_PATH = path.join(os.homedir(), '.codeium', 'config.json');
// Platform-specific process names
const LANGUAGE_SERVER_PATTERNS = {
    darwin: 'language_server_macos',
    linux: 'language_server_linux',
    win32: 'language_server_windows',
};
// ============================================================================
// Process Discovery
// ============================================================================
/**
 * Get the language server process pattern for the current platform
 */
function getLanguageServerPattern() {
    const platform = process.platform;
    return LANGUAGE_SERVER_PATTERNS[platform] || 'language_server';
}
/**
 * Get process listing for language server
 */
function getLanguageServerProcess() {
    const pattern = getLanguageServerPattern();
    try {
        if (process.platform === 'win32') {
            // Windows: use WMIC
            const output = (0, child_process_1.execSync)(`wmic process where "name like '%${pattern}%'" get CommandLine /format:list`, { encoding: 'utf8', timeout: 5000 });
            return output;
        }
        else {
            // Unix-like: use ps
            const output = (0, child_process_1.execSync)(`ps aux | grep ${pattern}`, { encoding: 'utf8', timeout: 5000 });
            return output;
        }
    }
    catch {
        return null;
    }
}
/**
 * Extract CSRF token from running Windsurf language server process
 */
function getCSRFToken() {
    const processInfo = getLanguageServerProcess();
    if (!processInfo) {
        throw new WindsurfError('Windsurf language server not found. Is Windsurf running?', WindsurfErrorCode.NOT_RUNNING);
    }
    const match = processInfo.match(/--csrf_token\s+([a-f0-9-]+)/);
    if (match?.[1]) {
        return match[1];
    }
    throw new WindsurfError('CSRF token not found in Windsurf process. Is Windsurf running?', WindsurfErrorCode.CSRF_MISSING);
}
/**
 * Get the language server gRPC port dynamically using lsof
 * The port offset from extension_server_port varies (--random_port flag), so we use lsof
 */
function getPort() {
    const processInfo = getLanguageServerProcess();
    if (!processInfo) {
        throw new WindsurfError('Windsurf language server not found. Is Windsurf running?', WindsurfErrorCode.NOT_RUNNING);
    }
    // Extract PID from ps output (second column)
    const pidMatch = processInfo.match(/^\s*\S+\s+(\d+)/);
    const pid = pidMatch ? pidMatch[1] : null;
    // Get extension_server_port as a reference point
    const portMatch = processInfo.match(/--extension_server_port\s+(\d+)/);
    const extPort = portMatch ? parseInt(portMatch[1], 10) : null;
    // Use lsof to find actual listening ports for this specific PID
    if (process.platform !== 'win32' && pid) {
        try {
            const lsof = (0, child_process_1.execSync)(`lsof -p ${pid} -i -P -n 2>/dev/null | grep LISTEN`, { encoding: 'utf8', timeout: 15000 });
            // Extract all listening ports
            const portMatches = lsof.matchAll(/:(\d+)\s+\(LISTEN\)/g);
            const ports = Array.from(portMatches).map(m => parseInt(m[1], 10));
            if (ports.length > 0) {
                // If we have extension_server_port, prefer the port closest to it (usually +3)
                if (extPort) {
                    // Sort by distance from extPort and pick the closest one > extPort
                    const candidatePorts = ports.filter(p => p > extPort).sort((a, b) => a - b);
                    if (candidatePorts.length > 0) {
                        return candidatePorts[0]; // Return the first port after extPort
                    }
                }
                // Otherwise just return the first listening port
                return ports[0];
            }
        }
        catch {
            // Fall through to offset-based approach
        }
    }
    // Fallback: try common offsets (+3, +2, +4)
    if (extPort) {
        return extPort + 3;
    }
    throw new WindsurfError('Windsurf language server port not found. Is Windsurf running?', WindsurfErrorCode.NOT_RUNNING);
}
/**
 * Read API key from VSCode state database (windsurfAuthStatus)
 *
 * The API key is stored in the SQLite database at:
 * ~/Library/Application Support/Windsurf/User/globalStorage/state.vscdb
 *
 * It's stored in the 'windsurfAuthStatus' key as JSON containing apiKey.
 */
function getApiKey() {
    const platform = process.platform;
    const statePath = VSCODE_STATE_PATHS[platform];
    if (!statePath) {
        throw new WindsurfError(`Unsupported platform: ${process.platform}`, WindsurfErrorCode.API_KEY_MISSING);
    }
    // Try to get API key from VSCode state database
    if (fs.existsSync(statePath)) {
        try {
            const result = (0, child_process_1.execSync)(`sqlite3 "${statePath}" "SELECT value FROM ItemTable WHERE key = 'windsurfAuthStatus';"`, { encoding: 'utf8', timeout: 5000 }).trim();
            if (result) {
                const parsed = JSON.parse(result);
                if (parsed.apiKey) {
                    return parsed.apiKey;
                }
            }
        }
        catch (error) {
            // Fall through to legacy config
        }
    }
    // Try legacy config file
    if (fs.existsSync(LEGACY_CONFIG_PATH)) {
        try {
            const config = fs.readFileSync(LEGACY_CONFIG_PATH, 'utf8');
            const parsed = JSON.parse(config);
            if (parsed.apiKey) {
                return parsed.apiKey;
            }
        }
        catch {
            // Fall through
        }
    }
    throw new WindsurfError('API key not found. Please login to Windsurf first.', WindsurfErrorCode.API_KEY_MISSING);
}
/**
 * Get Windsurf version from process arguments
 */
function getWindsurfVersion() {
    const processInfo = getLanguageServerProcess();
    if (processInfo) {
        const match = processInfo.match(/--windsurf_version\s+([^\s]+)/);
        if (match) {
            // Extract just the version number (before + if present)
            const version = match[1].split('+')[0];
            return version;
        }
    }
    // Default fallback version
    return '1.13.104';
}
// ============================================================================
// Public API
// ============================================================================
/**
 * Get all credentials needed to communicate with Windsurf
 */
function getCredentials() {
    return {
        csrfToken: getCSRFToken(),
        port: getPort(),
        apiKey: getApiKey(),
        version: getWindsurfVersion(),
    };
}
/**
 * Check if Windsurf is running and accessible
 */
function isWindsurfRunning() {
    try {
        getCSRFToken();
        getPort();
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if Windsurf is installed (app exists)
 */
function isWindsurfInstalled() {
    if (process.platform === 'darwin') {
        return fs.existsSync('/Applications/Windsurf.app');
    }
    else if (process.platform === 'linux') {
        return (fs.existsSync('/usr/share/windsurf') ||
            fs.existsSync(path.join(os.homedir(), '.local/share/windsurf')));
    }
    else if (process.platform === 'win32') {
        return (fs.existsSync('C:\\Program Files\\Windsurf') ||
            fs.existsSync(path.join(os.homedir(), 'AppData\\Local\\Programs\\Windsurf')));
    }
    return false;
}
/**
 * Validate credentials structure
 */
function validateCredentials(credentials) {
    return (typeof credentials.csrfToken === 'string' &&
        credentials.csrfToken.length > 0 &&
        typeof credentials.port === 'number' &&
        credentials.port > 0 &&
        typeof credentials.apiKey === 'string' &&
        credentials.apiKey.length > 0 &&
        typeof credentials.version === 'string');
}
