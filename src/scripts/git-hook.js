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
const index_1 = require("../index");
const config_1 = require("../core/config");
const endpoints_1 = require("../core/endpoints");
const types_1 = require("../core/types");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
async function main() {
    const commitMsgFile = process.argv[2];
    const source = process.argv[3];
    if (source === 'message' || source === 'merge' || source === 'squash') {
        process.exit(0);
    }
    let diff = '';
    try {
        diff = (0, child_process_1.execSync)('git diff --cached').toString();
    }
    catch (e) {
        process.exit(0);
    }
    if (!diff.trim()) {
        process.exit(0);
    }
    const configManager = new config_1.ConfigManager();
    const config = configManager.loadConfig();
    const monster = (0, index_1.createAuthMonster)({
        config,
        storagePath: configManager.getConfigDir()
    });
    await monster.init();
    // Prefer a fast model, or fallback to config active
    const model = 'gemini-3-flash-preview';
    const details = await monster.getAuthDetails(model) || await monster.getAuthDetails(config.active);
    if (!details) {
        console.error('AuthMonster: No active account found for commit generation.');
        process.exit(0);
    }
    const url = (0, endpoints_1.getProviderEndpoint)(details.provider, details.account, details.modelInProvider);
    const prompt = `Generate a concise and descriptive commit message for the following changes.
  Follow the conventional commits specification (e.g. feat: ..., fix: ...).
  Only output the commit message, no explanations.

  Diff:
  ${diff.substring(0, 8000)}`;
    try {
        console.log('AuthMonster: Generating commit message...');
        const response = await monster.request(model, url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
                messages: [{ role: 'user', content: prompt }],
                model: details.modelInProvider,
                temperature: 0.3
            }
        });
        const json = await response.json();
        let message = '';
        if (details.provider === types_1.AuthProvider.Gemini) {
            message = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
        else if (details.provider === types_1.AuthProvider.Anthropic) {
            message = json.content?.[0]?.text || '';
        }
        else {
            message = json.choices?.[0]?.message?.content || '';
        }
        if (message) {
            const currentContent = fs.readFileSync(commitMsgFile, 'utf-8');
            fs.writeFileSync(commitMsgFile, `${message.trim()}\n\n${currentContent}`);
        }
    }
    catch (e) {
        console.error('AuthMonster: Failed to generate commit message.', e);
    }
}
main().catch(() => process.exit(0));
