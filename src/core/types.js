"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMonsterConfigSchema = exports.AuthProvider = void 0;
const zod_1 = require("zod");
var AuthProvider;
(function (AuthProvider) {
    AuthProvider["Gemini"] = "gemini";
    AuthProvider["Windsurf"] = "windsurf";
    AuthProvider["Anthropic"] = "anthropic";
    AuthProvider["Cursor"] = "cursor";
    AuthProvider["Qwen"] = "qwen";
    AuthProvider["IFlow"] = "iflow";
    AuthProvider["OpenAI"] = "openai";
    AuthProvider["Copilot"] = "copilot";
    AuthProvider["Kiro"] = "kiro";
})(AuthProvider || (exports.AuthProvider = AuthProvider = {}));
exports.AuthMonsterConfigSchema = zod_1.z.object({
    active: zod_1.z.nativeEnum(AuthProvider).default(AuthProvider.Gemini),
    fallback: zod_1.z.array(zod_1.z.nativeEnum(AuthProvider)).default([]),
    method: zod_1.z.enum(['sticky', 'round-robin', 'hybrid', 'quota-optimized']).default('sticky'),
    proxy: zod_1.z.string().optional(),
    modelPriorities: zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.string())).default({
        'gemini-3-pro-preview': ['claude-4.5-opus-thinking', 'gpt-5.2-codex'],
        'claude-4.5-opus-thinking': ['gpt-5.2-codex', 'gemini-3-pro-preview'],
        'gpt-5.2-codex': ['claude-4.5-opus-thinking', 'gemini-3-pro-preview']
    }),
    fallbackDirection: zod_1.z.enum(['up', 'down']).default('down'),
    providers: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        profile: zod_1.z.string().optional(),
        port: zod_1.z.number().optional(),
        options: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
    })).default({})
});
