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
exports.MCPBridge = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
class MCPBridge {
    constructor(tokenPath) {
        this.child = null;
        this.tokenPath = tokenPath || path.join(os.homedir(), '.auth-mcp-token.json');
    }
    /**
     * Starts the auth-mcp server process.
     * Assumes `auth-mcp` is in the PATH or references/auth-mcp/auth-mcp exists.
     */
    start() {
        const binPath = path.resolve(__dirname, '../../references/auth-mcp/auth-mcp');
        // In a real scenario, we might prefer a configured path
        // For now, we spawn it as a node process directly if possible, or use the wrapper
        // Check if bin exists, else fallback
        const cmd = fs.existsSync(binPath) ? binPath : 'auth-mcp';
        this.child = (0, child_process_1.spawn)(cmd, [], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env
        });
        this.child.stderr?.on('data', (data) => {
            // Log MCP debug output
            // console.error(`[MCP] ${data.toString()}`);
        });
        this.child.on('close', (code) => {
            // console.log(`[MCP] exited with code ${code}`);
            this.child = null;
        });
    }
    /**
     * Performs the JSON-RPC handshake to initialize the session.
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            if (!this.child || !this.child.stdin || !this.child.stdout) {
                return reject(new Error('MCP server not running'));
            }
            const initMsg = {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'opencode-monster', version: '1.0.0' }
                }
            };
            const handler = (chunk) => {
                const msg = chunk.toString();
                try {
                    const json = JSON.parse(msg);
                    if (json.id === 1 && json.result) {
                        this.child?.stdout?.off('data', handler);
                        resolve();
                    }
                }
                catch (e) {
                    // Ignore partial chunks for this simple MVP
                }
            };
            this.child.stdout.on('data', handler);
            this.child.stdin.write(JSON.stringify(initMsg) + '\n');
            // Timeout
            setTimeout(() => {
                this.child?.stdout?.off('data', handler);
                reject(new Error('MCP handshake timeout'));
            }, 5000);
        });
    }
    /**
     * Reads the token generated/stored by the MCP server.
     */
    getToken() {
        if (!fs.existsSync(this.tokenPath))
            return null;
        try {
            const data = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
            return data.token || null;
        }
        catch {
            return null;
        }
    }
    stop() {
        this.child?.kill();
    }
}
exports.MCPBridge = MCPBridge;
