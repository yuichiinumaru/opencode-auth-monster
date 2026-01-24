"use strict";
/**
 * Model name to enum mappings for Windsurf gRPC protocol
 *
 * Maps OpenAI-compatible model names to Windsurf protobuf enum values.
 * These values were extracted from Windsurf's extension.js.
 *
 * To discover/verify these values:
 * 1. Find: /Applications/Windsurf.app/Contents/Resources/app/extensions/windsurf/dist/extension.js
 * 2. Search: grep -oE 'CLAUDE[A-Z0-9_]+\s*=\s*[0-9]+' extension.js
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveModel = resolveModel;
exports.modelNameToEnum = modelNameToEnum;
exports.enumToModelName = enumToModelName;
exports.getSupportedModels = getSupportedModels;
exports.isModelSupported = isModelSupported;
exports.getDefaultModel = getDefaultModel;
exports.getDefaultModelEnum = getDefaultModelEnum;
exports.getCanonicalModels = getCanonicalModels;
exports.getModelVariants = getModelVariants;
const types_1 = require("./types");
// ==========================================================================
// Variant Catalog
// ==========================================================================
const VARIANT_CATALOG = {
    // Claude thinking variants
    'claude-3.7-sonnet': {
        id: 'claude-3.7-sonnet',
        defaultEnum: types_1.ModelEnum.CLAUDE_3_7_SONNET_20250219,
        variants: {
            thinking: { enumValue: types_1.ModelEnum.CLAUDE_3_7_SONNET_20250219_THINKING, description: 'Thinking mode' },
        },
    },
    'claude-4.5-sonnet': {
        id: 'claude-4.5-sonnet',
        defaultEnum: types_1.ModelEnum.CLAUDE_4_5_SONNET,
        variants: {
            thinking: { enumValue: types_1.ModelEnum.CLAUDE_4_5_SONNET_THINKING, description: 'Thinking mode' },
        },
    },
    'claude-4.5-opus': {
        id: 'claude-4.5-opus',
        defaultEnum: types_1.ModelEnum.CLAUDE_4_5_OPUS,
        variants: {
            thinking: { enumValue: types_1.ModelEnum.CLAUDE_4_5_OPUS_THINKING, description: 'Thinking mode' },
        },
    },
    'claude-4.1-opus': {
        id: 'claude-4.1-opus',
        defaultEnum: types_1.ModelEnum.CLAUDE_4_1_OPUS,
        variants: {
            thinking: { enumValue: types_1.ModelEnum.CLAUDE_4_1_OPUS_THINKING, description: 'Thinking mode' },
        },
        aliases: ['claude-4-1-opus'],
    },
    'claude-4-opus': {
        id: 'claude-4-opus',
        defaultEnum: types_1.ModelEnum.CLAUDE_4_OPUS,
        variants: {
            thinking: { enumValue: types_1.ModelEnum.CLAUDE_4_OPUS_THINKING, description: 'Thinking mode' },
        },
    },
    'claude-4-sonnet': {
        id: 'claude-4-sonnet',
        defaultEnum: types_1.ModelEnum.CLAUDE_4_SONNET,
        variants: {
            thinking: { enumValue: types_1.ModelEnum.CLAUDE_4_SONNET_THINKING, description: 'Thinking mode' },
        },
    },
    // Google Gemini 2.5 / 3.0
    'gemini-2.5-flash': {
        id: 'gemini-2.5-flash',
        defaultEnum: types_1.ModelEnum.GEMINI_2_5_FLASH,
        variants: {
            thinking: { enumValue: types_1.ModelEnum.GEMINI_2_5_FLASH_THINKING, description: 'Thinking budget enabled' },
            lite: { enumValue: types_1.ModelEnum.GEMINI_2_5_FLASH_LITE, description: 'Lite / lower cost' },
        },
        aliases: ['gemini-2-5-flash'],
    },
    // Google Gemini 3.0 Pro
    'gemini-3.0-pro': {
        id: 'gemini-3.0-pro',
        defaultEnum: types_1.ModelEnum.GEMINI_3_0_PRO_MEDIUM,
        variants: {
            minimal: { enumValue: types_1.ModelEnum.GEMINI_3_0_PRO_MINIMAL, description: 'Cheaper, least reasoning' },
            low: { enumValue: types_1.ModelEnum.GEMINI_3_0_PRO_LOW, description: 'Lower cost / speed' },
            medium: { enumValue: types_1.ModelEnum.GEMINI_3_0_PRO_MEDIUM, description: 'Balanced (default)' },
            high: { enumValue: types_1.ModelEnum.GEMINI_3_0_PRO_HIGH, description: 'Higher reasoning budget' },
        },
        aliases: ['gemini-3-0-pro'],
    },
    // Google Gemini 3.0 Flash
    'gemini-3.0-flash': {
        id: 'gemini-3.0-flash',
        defaultEnum: types_1.ModelEnum.GEMINI_3_0_FLASH_MEDIUM,
        variants: {
            minimal: { enumValue: types_1.ModelEnum.GEMINI_3_0_FLASH_MINIMAL, description: 'Cheapest, lowest latency' },
            low: { enumValue: types_1.ModelEnum.GEMINI_3_0_FLASH_LOW, description: 'Low thinking budget' },
            medium: { enumValue: types_1.ModelEnum.GEMINI_3_0_FLASH_MEDIUM, description: 'Balanced (default)' },
            high: { enumValue: types_1.ModelEnum.GEMINI_3_0_FLASH_HIGH, description: 'Higher reasoning budget' },
        },
        aliases: ['gemini-3-0-flash'],
    },
    // GPT 5.2
    'gpt-5.2': {
        id: 'gpt-5.2',
        defaultEnum: types_1.ModelEnum.GPT_5_2_MEDIUM,
        variants: {
            low: { enumValue: types_1.ModelEnum.GPT_5_2_LOW, description: 'Lower cost' },
            medium: { enumValue: types_1.ModelEnum.GPT_5_2_MEDIUM, description: 'Balanced (default)' },
            high: { enumValue: types_1.ModelEnum.GPT_5_2_HIGH, description: 'Higher capability' },
            xhigh: { enumValue: types_1.ModelEnum.GPT_5_2_XHIGH, description: 'Maximum capability' },
            priority: { enumValue: types_1.ModelEnum.GPT_5_2_MEDIUM_PRIORITY, description: 'Priority routing (medium)' },
            'low-priority': { enumValue: types_1.ModelEnum.GPT_5_2_LOW_PRIORITY, description: 'Priority routing (low)' },
            'high-priority': { enumValue: types_1.ModelEnum.GPT_5_2_HIGH_PRIORITY, description: 'Priority routing (high)' },
            'xhigh-priority': { enumValue: types_1.ModelEnum.GPT_5_2_XHIGH_PRIORITY, description: 'Priority routing (xhigh)' },
        },
        aliases: ['gpt-5-2'],
    },
    // GPT 5
    'gpt-5': {
        id: 'gpt-5',
        defaultEnum: types_1.ModelEnum.GPT_5,
        variants: {
            low: { enumValue: types_1.ModelEnum.GPT_5_LOW, description: 'Lower cost' },
            high: { enumValue: types_1.ModelEnum.GPT_5_HIGH, description: 'Higher capability' },
            nano: { enumValue: types_1.ModelEnum.GPT_5_NANO, description: 'Small footprint' },
        },
    },
    // GPT 5.1 Codex families
    'gpt-5.1-codex-mini': {
        id: 'gpt-5.1-codex-mini',
        defaultEnum: types_1.ModelEnum.GPT_5_1_CODEX_MINI_MEDIUM,
        variants: {
            low: { enumValue: types_1.ModelEnum.GPT_5_1_CODEX_MINI_LOW },
            medium: { enumValue: types_1.ModelEnum.GPT_5_1_CODEX_MINI_MEDIUM },
            high: { enumValue: types_1.ModelEnum.GPT_5_1_CODEX_MINI_HIGH },
        },
        aliases: ['gpt-5-1-codex-mini'],
    },
    'gpt-5.1-codex': {
        id: 'gpt-5.1-codex',
        defaultEnum: types_1.ModelEnum.GPT_5_1_CODEX_MEDIUM,
        variants: {
            low: { enumValue: types_1.ModelEnum.GPT_5_1_CODEX_LOW },
            medium: { enumValue: types_1.ModelEnum.GPT_5_1_CODEX_MEDIUM },
            high: { enumValue: types_1.ModelEnum.GPT_5_1_CODEX_HIGH },
        },
        aliases: ['gpt-5-1-codex'],
    },
    'gpt-5.1-codex-max': {
        id: 'gpt-5.1-codex-max',
        defaultEnum: types_1.ModelEnum.GPT_5_1_CODEX_MAX_MEDIUM,
        variants: {
            low: { enumValue: types_1.ModelEnum.GPT_5_1_CODEX_MAX_LOW },
            medium: { enumValue: types_1.ModelEnum.GPT_5_1_CODEX_MAX_MEDIUM },
            high: { enumValue: types_1.ModelEnum.GPT_5_1_CODEX_MAX_HIGH },
        },
        aliases: ['gpt-5-1-codex-max'],
    },
    // O series
    o3: {
        id: 'o3',
        defaultEnum: types_1.ModelEnum.O3,
        variants: {
            low: { enumValue: types_1.ModelEnum.O3_LOW },
            high: { enumValue: types_1.ModelEnum.O3_HIGH },
        },
    },
    'o3-pro': {
        id: 'o3-pro',
        defaultEnum: types_1.ModelEnum.O3_PRO,
        variants: {
            low: { enumValue: types_1.ModelEnum.O3_PRO_LOW },
            high: { enumValue: types_1.ModelEnum.O3_PRO_HIGH },
        },
    },
    'o4-mini': {
        id: 'o4-mini',
        defaultEnum: types_1.ModelEnum.O4_MINI,
        variants: {
            low: { enumValue: types_1.ModelEnum.O4_MINI_LOW },
            high: { enumValue: types_1.ModelEnum.O4_MINI_HIGH },
        },
    },
};
const VARIANT_NAME_SET = new Set();
for (const entry of Object.values(VARIANT_CATALOG)) {
    if (entry.variants) {
        for (const variantKey of Object.keys(entry.variants)) {
            VARIANT_NAME_SET.add(`${entry.id}-${variantKey}`);
            if (entry.aliases) {
                for (const alias of entry.aliases) {
                    VARIANT_NAME_SET.add(`${alias}-${variantKey}`);
                }
            }
        }
    }
}
// Mapping of alias -> canonical id for quick lookup
const ALIAS_TO_ID = Object.values(VARIANT_CATALOG).reduce((acc, entry) => {
    acc[entry.id] = entry.id;
    for (const alias of entry.aliases || []) {
        acc[alias] = entry.id;
    }
    return acc;
}, {});
function normalizeModelId(modelName) {
    return modelName.toLowerCase().trim();
}
function splitModelAndVariant(raw) {
    const normalized = normalizeModelId(raw);
    // Allow colon-delimited (opencode variants) or suffix "-<variant>"
    const colonIdx = normalized.indexOf(':');
    if (colonIdx !== -1) {
        const base = normalized.slice(0, colonIdx);
        const variant = normalized.slice(colonIdx + 1).trim();
        return { base, variant: variant || undefined };
    }
    const parts = normalized.split('-');
    if (parts.length > 1) {
        const maybeVariant = parts[parts.length - 1];
        const base = parts.slice(0, -1).join('-');
        if (VARIANT_CATALOG[ALIAS_TO_ID[base] || base]?.variants?.[maybeVariant]) {
            return { base, variant: maybeVariant };
        }
    }
    return { base: normalized };
}
// ============================================================================
// Model Name Mappings (legacy fallback)
// ============================================================================
/**
 * Map of model name strings to their protobuf enum values
 * Supports multiple aliases for each model
 */
const MODEL_NAME_TO_ENUM = {
    // ============================================================================
    // Claude Models
    // ============================================================================
    'claude-3-opus': types_1.ModelEnum.CLAUDE_3_OPUS_20240229,
    'claude-3-opus-20240229': types_1.ModelEnum.CLAUDE_3_OPUS_20240229,
    'claude-3-sonnet': types_1.ModelEnum.CLAUDE_3_SONNET_20240229,
    'claude-3-sonnet-20240229': types_1.ModelEnum.CLAUDE_3_SONNET_20240229,
    'claude-3-haiku': types_1.ModelEnum.CLAUDE_3_HAIKU_20240307,
    'claude-3-haiku-20240307': types_1.ModelEnum.CLAUDE_3_HAIKU_20240307,
    'claude-3.5-sonnet': types_1.ModelEnum.CLAUDE_3_5_SONNET_20241022,
    'claude-3-5-sonnet': types_1.ModelEnum.CLAUDE_3_5_SONNET_20241022,
    'claude-3-5-sonnet-20241022': types_1.ModelEnum.CLAUDE_3_5_SONNET_20241022,
    'claude-3.5-haiku': types_1.ModelEnum.CLAUDE_3_5_HAIKU_20241022,
    'claude-3-5-haiku': types_1.ModelEnum.CLAUDE_3_5_HAIKU_20241022,
    'claude-3-5-haiku-20241022': types_1.ModelEnum.CLAUDE_3_5_HAIKU_20241022,
    'claude-3.7-sonnet': types_1.ModelEnum.CLAUDE_3_7_SONNET_20250219,
    'claude-3-7-sonnet': types_1.ModelEnum.CLAUDE_3_7_SONNET_20250219,
    'claude-3-7-sonnet-20250219': types_1.ModelEnum.CLAUDE_3_7_SONNET_20250219,
    'claude-3.7-sonnet-thinking': types_1.ModelEnum.CLAUDE_3_7_SONNET_20250219_THINKING,
    'claude-3-7-sonnet-thinking': types_1.ModelEnum.CLAUDE_3_7_SONNET_20250219_THINKING,
    'claude-4-opus': types_1.ModelEnum.CLAUDE_4_OPUS,
    'claude-4-opus-thinking': types_1.ModelEnum.CLAUDE_4_OPUS_THINKING,
    'claude-4-sonnet': types_1.ModelEnum.CLAUDE_4_SONNET,
    'claude-4-sonnet-thinking': types_1.ModelEnum.CLAUDE_4_SONNET_THINKING,
    'claude-4.1-opus': types_1.ModelEnum.CLAUDE_4_1_OPUS,
    'claude-4-1-opus': types_1.ModelEnum.CLAUDE_4_1_OPUS,
    'claude-4.1-opus-thinking': types_1.ModelEnum.CLAUDE_4_1_OPUS_THINKING,
    'claude-4-1-opus-thinking': types_1.ModelEnum.CLAUDE_4_1_OPUS_THINKING,
    'claude-4.5-sonnet': types_1.ModelEnum.CLAUDE_4_5_SONNET,
    'claude-4-5-sonnet': types_1.ModelEnum.CLAUDE_4_5_SONNET,
    'claude-4.5-sonnet-thinking': types_1.ModelEnum.CLAUDE_4_5_SONNET_THINKING,
    'claude-4-5-sonnet-thinking': types_1.ModelEnum.CLAUDE_4_5_SONNET_THINKING,
    // NOTE: claude-4.5-sonnet-1m is defined in enum but not available via API
    'claude-4.5-opus': types_1.ModelEnum.CLAUDE_4_5_OPUS,
    'claude-4-5-opus': types_1.ModelEnum.CLAUDE_4_5_OPUS,
    'claude-4.5-opus-thinking': types_1.ModelEnum.CLAUDE_4_5_OPUS_THINKING,
    'claude-4-5-opus-thinking': types_1.ModelEnum.CLAUDE_4_5_OPUS_THINKING,
    'claude-code': types_1.ModelEnum.CLAUDE_CODE,
    // ============================================================================
    // GPT Models
    // ============================================================================
    'gpt-4': types_1.ModelEnum.GPT_4,
    'gpt-4-turbo': types_1.ModelEnum.GPT_4_1106_PREVIEW,
    'gpt-4-1106-preview': types_1.ModelEnum.GPT_4_1106_PREVIEW,
    'gpt-4o': types_1.ModelEnum.GPT_4O_2024_08_06,
    'gpt-4o-2024-08-06': types_1.ModelEnum.GPT_4O_2024_08_06,
    'gpt-4o-mini': types_1.ModelEnum.GPT_4O_MINI_2024_07_18,
    'gpt-4o-mini-2024-07-18': types_1.ModelEnum.GPT_4O_MINI_2024_07_18,
    // NOTE: gpt-4.5 is defined in enum but not available via API
    'gpt-4.1': types_1.ModelEnum.GPT_4_1_2025_04_14,
    'gpt-4-1': types_1.ModelEnum.GPT_4_1_2025_04_14,
    'gpt-4.1-mini': types_1.ModelEnum.GPT_4_1_MINI_2025_04_14,
    'gpt-4-1-mini': types_1.ModelEnum.GPT_4_1_MINI_2025_04_14,
    'gpt-4.1-nano': types_1.ModelEnum.GPT_4_1_NANO_2025_04_14,
    'gpt-4-1-nano': types_1.ModelEnum.GPT_4_1_NANO_2025_04_14,
    'gpt-5': types_1.ModelEnum.GPT_5,
    'gpt-5-nano': types_1.ModelEnum.GPT_5_NANO,
    'gpt-5-low': types_1.ModelEnum.GPT_5_LOW,
    'gpt-5-high': types_1.ModelEnum.GPT_5_HIGH,
    'gpt-5-codex': types_1.ModelEnum.GPT_5_CODEX,
    // GPT 5.1 Codex variants
    'gpt-5.1-codex-mini-low': types_1.ModelEnum.GPT_5_1_CODEX_MINI_LOW,
    'gpt-5.1-codex-mini-medium': types_1.ModelEnum.GPT_5_1_CODEX_MINI_MEDIUM,
    'gpt-5.1-codex-mini-high': types_1.ModelEnum.GPT_5_1_CODEX_MINI_HIGH,
    'gpt-5.1-codex-mini': types_1.ModelEnum.GPT_5_1_CODEX_MINI_MEDIUM,
    'gpt-5.1-codex-low': types_1.ModelEnum.GPT_5_1_CODEX_LOW,
    'gpt-5.1-codex-medium': types_1.ModelEnum.GPT_5_1_CODEX_MEDIUM,
    'gpt-5.1-codex-high': types_1.ModelEnum.GPT_5_1_CODEX_HIGH,
    'gpt-5.1-codex': types_1.ModelEnum.GPT_5_1_CODEX_MEDIUM,
    'gpt-5.1-codex-max-low': types_1.ModelEnum.GPT_5_1_CODEX_MAX_LOW,
    'gpt-5.1-codex-max-medium': types_1.ModelEnum.GPT_5_1_CODEX_MAX_MEDIUM,
    'gpt-5.1-codex-max-high': types_1.ModelEnum.GPT_5_1_CODEX_MAX_HIGH,
    'gpt-5.1-codex-max': types_1.ModelEnum.GPT_5_1_CODEX_MAX_MEDIUM,
    // GPT 5.2 variants
    'gpt-5.2': types_1.ModelEnum.GPT_5_2_MEDIUM,
    'gpt-5-2': types_1.ModelEnum.GPT_5_2_MEDIUM,
    'gpt-5.2-low': types_1.ModelEnum.GPT_5_2_LOW,
    'gpt-5-2-low': types_1.ModelEnum.GPT_5_2_LOW,
    'gpt-5.2-high': types_1.ModelEnum.GPT_5_2_HIGH,
    'gpt-5-2-high': types_1.ModelEnum.GPT_5_2_HIGH,
    'gpt-5.2-xhigh': types_1.ModelEnum.GPT_5_2_XHIGH,
    'gpt-5-2-xhigh': types_1.ModelEnum.GPT_5_2_XHIGH,
    'gpt-5.2-priority': types_1.ModelEnum.GPT_5_2_MEDIUM_PRIORITY,
    'gpt-5.2-low-priority': types_1.ModelEnum.GPT_5_2_LOW_PRIORITY,
    'gpt-5.2-high-priority': types_1.ModelEnum.GPT_5_2_HIGH_PRIORITY,
    'gpt-5.2-xhigh-priority': types_1.ModelEnum.GPT_5_2_XHIGH_PRIORITY,
    // ============================================================================
    // O-Series (OpenAI Reasoning)
    // NOTE: o1, o1-mini, o1-preview are deprecated - use o3/o4 series instead
    // ============================================================================
    'o3': types_1.ModelEnum.O3,
    'o3-mini': types_1.ModelEnum.O3_MINI,
    'o3-low': types_1.ModelEnum.O3_LOW,
    'o3-high': types_1.ModelEnum.O3_HIGH,
    'o3-pro': types_1.ModelEnum.O3_PRO,
    'o3-pro-low': types_1.ModelEnum.O3_PRO_LOW,
    'o3-pro-high': types_1.ModelEnum.O3_PRO_HIGH,
    'o4-mini': types_1.ModelEnum.O4_MINI,
    'o4-mini-low': types_1.ModelEnum.O4_MINI_LOW,
    'o4-mini-high': types_1.ModelEnum.O4_MINI_HIGH,
    // ============================================================================
    // Google Gemini
    // NOTE: gemini-1.0-pro and gemini-1.5-pro are deprecated - use 2.x+ versions
    // ============================================================================
    'gemini-2.0-flash': types_1.ModelEnum.GEMINI_2_0_FLASH,
    'gemini-2-0-flash': types_1.ModelEnum.GEMINI_2_0_FLASH,
    'gemini-2.5-pro': types_1.ModelEnum.GEMINI_2_5_PRO,
    'gemini-2-5-pro': types_1.ModelEnum.GEMINI_2_5_PRO,
    'gemini-2.5-flash': types_1.ModelEnum.GEMINI_2_5_FLASH,
    'gemini-2-5-flash': types_1.ModelEnum.GEMINI_2_5_FLASH,
    'gemini-2.5-flash-thinking': types_1.ModelEnum.GEMINI_2_5_FLASH_THINKING,
    'gemini-2-5-flash-thinking': types_1.ModelEnum.GEMINI_2_5_FLASH_THINKING,
    'gemini-2.5-flash-lite': types_1.ModelEnum.GEMINI_2_5_FLASH_LITE,
    'gemini-2-5-flash-lite': types_1.ModelEnum.GEMINI_2_5_FLASH_LITE,
    'gemini-3.0-pro-low': types_1.ModelEnum.GEMINI_3_0_PRO_LOW,
    'gemini-3-0-pro-low': types_1.ModelEnum.GEMINI_3_0_PRO_LOW,
    'gemini-3.0-pro-high': types_1.ModelEnum.GEMINI_3_0_PRO_HIGH,
    'gemini-3-0-pro-high': types_1.ModelEnum.GEMINI_3_0_PRO_HIGH,
    'gemini-3.0-pro': types_1.ModelEnum.GEMINI_3_0_PRO_MEDIUM,
    'gemini-3-0-pro': types_1.ModelEnum.GEMINI_3_0_PRO_MEDIUM,
    'gemini-3.0-pro-minimal': types_1.ModelEnum.GEMINI_3_0_PRO_MINIMAL,
    'gemini-3-0-pro-minimal': types_1.ModelEnum.GEMINI_3_0_PRO_MINIMAL,
    'gemini-3.0-pro-medium': types_1.ModelEnum.GEMINI_3_0_PRO_MEDIUM,
    'gemini-3-0-pro-medium': types_1.ModelEnum.GEMINI_3_0_PRO_MEDIUM,
    'gemini-3.0-flash': types_1.ModelEnum.GEMINI_3_0_FLASH_MEDIUM,
    'gemini-3-0-flash': types_1.ModelEnum.GEMINI_3_0_FLASH_MEDIUM,
    'gemini-3.0-flash-minimal': types_1.ModelEnum.GEMINI_3_0_FLASH_MINIMAL,
    'gemini-3-0-flash-minimal': types_1.ModelEnum.GEMINI_3_0_FLASH_MINIMAL,
    'gemini-3.0-flash-low': types_1.ModelEnum.GEMINI_3_0_FLASH_LOW,
    'gemini-3-0-flash-low': types_1.ModelEnum.GEMINI_3_0_FLASH_LOW,
    'gemini-3.0-flash-medium': types_1.ModelEnum.GEMINI_3_0_FLASH_MEDIUM,
    'gemini-3-0-flash-medium': types_1.ModelEnum.GEMINI_3_0_FLASH_MEDIUM,
    'gemini-3.0-flash-high': types_1.ModelEnum.GEMINI_3_0_FLASH_HIGH,
    'gemini-3-0-flash-high': types_1.ModelEnum.GEMINI_3_0_FLASH_HIGH,
    // ============================================================================
    // DeepSeek
    // ============================================================================
    'deepseek-v3': types_1.ModelEnum.DEEPSEEK_V3,
    'deepseek-v3-2': types_1.ModelEnum.DEEPSEEK_V3_2,
    'deepseek-r1': types_1.ModelEnum.DEEPSEEK_R1,
    'deepseek-r1-fast': types_1.ModelEnum.DEEPSEEK_R1_FAST,
    'deepseek-r1-slow': types_1.ModelEnum.DEEPSEEK_R1_SLOW,
    // ============================================================================
    // Llama
    // ============================================================================
    'llama-3.1-8b': types_1.ModelEnum.LLAMA_3_1_8B_INSTRUCT,
    'llama-3-1-8b': types_1.ModelEnum.LLAMA_3_1_8B_INSTRUCT,
    'llama-3.1-70b': types_1.ModelEnum.LLAMA_3_1_70B_INSTRUCT,
    'llama-3-1-70b': types_1.ModelEnum.LLAMA_3_1_70B_INSTRUCT,
    'llama-3.1-405b': types_1.ModelEnum.LLAMA_3_1_405B_INSTRUCT,
    'llama-3-1-405b': types_1.ModelEnum.LLAMA_3_1_405B_INSTRUCT,
    'llama-3.3-70b': types_1.ModelEnum.LLAMA_3_3_70B_INSTRUCT,
    'llama-3-3-70b': types_1.ModelEnum.LLAMA_3_3_70B_INSTRUCT,
    'llama-3.3-70b-r1': types_1.ModelEnum.LLAMA_3_3_70B_INSTRUCT_R1,
    'llama-3-3-70b-r1': types_1.ModelEnum.LLAMA_3_3_70B_INSTRUCT_R1,
    // ============================================================================
    // Qwen
    // ============================================================================
    'qwen-2.5-7b': types_1.ModelEnum.QWEN_2_5_7B_INSTRUCT,
    'qwen-2-5-7b': types_1.ModelEnum.QWEN_2_5_7B_INSTRUCT,
    'qwen-2.5-32b': types_1.ModelEnum.QWEN_2_5_32B_INSTRUCT,
    'qwen-2-5-32b': types_1.ModelEnum.QWEN_2_5_32B_INSTRUCT,
    'qwen-2.5-72b': types_1.ModelEnum.QWEN_2_5_72B_INSTRUCT,
    'qwen-2-5-72b': types_1.ModelEnum.QWEN_2_5_72B_INSTRUCT,
    'qwen-3-235b': types_1.ModelEnum.QWEN_3_235B_INSTRUCT,
    'qwen-3-coder-480b': types_1.ModelEnum.QWEN_3_CODER_480B_INSTRUCT,
    'qwen-3-coder-480b-fast': types_1.ModelEnum.QWEN_3_CODER_480B_INSTRUCT_FAST,
    'qwen-3-coder': types_1.ModelEnum.QWEN_3_CODER_480B_INSTRUCT,
    'qwen-2.5-32b-r1': types_1.ModelEnum.QWEN_2_5_32B_INSTRUCT_R1,
    'qwen-2-5-32b-r1': types_1.ModelEnum.QWEN_2_5_32B_INSTRUCT_R1,
    // ============================================================================
    // XAI Grok
    // ============================================================================
    'grok-2': types_1.ModelEnum.GROK_2,
    'grok-3': types_1.ModelEnum.GROK_3,
    'grok-3-mini': types_1.ModelEnum.GROK_3_MINI_REASONING,
    'grok-code-fast': types_1.ModelEnum.GROK_CODE_FAST,
    // ============================================================================
    // Other Models
    // ============================================================================
    'mistral-7b': types_1.ModelEnum.MISTRAL_7B,
    'kimi-k2': types_1.ModelEnum.KIMI_K2,
    'kimi-k2-thinking': types_1.ModelEnum.KIMI_K2_THINKING,
    'glm-4.5': types_1.ModelEnum.GLM_4_5,
    'glm-4-5': types_1.ModelEnum.GLM_4_5,
    'glm-4.5-fast': types_1.ModelEnum.GLM_4_5_FAST,
    'glm-4-5-fast': types_1.ModelEnum.GLM_4_5_FAST,
    'glm-4.6': types_1.ModelEnum.GLM_4_6,
    'glm-4-6': types_1.ModelEnum.GLM_4_6,
    'glm-4.6-fast': types_1.ModelEnum.GLM_4_6_FAST,
    'glm-4-6-fast': types_1.ModelEnum.GLM_4_6_FAST,
    'glm-4.7': types_1.ModelEnum.GLM_4_7,
    'glm-4-7': types_1.ModelEnum.GLM_4_7,
    'glm-4.7-fast': types_1.ModelEnum.GLM_4_7_FAST,
    'glm-4-7-fast': types_1.ModelEnum.GLM_4_7_FAST,
    'minimax-m2': types_1.ModelEnum.MINIMAX_M2,
    'minimax-m2.1': types_1.ModelEnum.MINIMAX_M2_1,
    'minimax-m2-1': types_1.ModelEnum.MINIMAX_M2_1,
    'swe-1.5': types_1.ModelEnum.SWE_1_5,
    'swe-1-5': types_1.ModelEnum.SWE_1_5,
    'swe-1.5-thinking': types_1.ModelEnum.SWE_1_5_THINKING,
    'swe-1-5-thinking': types_1.ModelEnum.SWE_1_5_THINKING,
    'swe-1.5-slow': types_1.ModelEnum.SWE_1_5_SLOW,
    'swe-1-5-slow': types_1.ModelEnum.SWE_1_5_SLOW,
};
/**
 * Reverse mapping from enum values to canonical model names
 */
const ENUM_TO_MODEL_NAME = {
    // Claude
    [types_1.ModelEnum.CLAUDE_3_OPUS_20240229]: 'claude-3-opus',
    [types_1.ModelEnum.CLAUDE_3_SONNET_20240229]: 'claude-3-sonnet',
    [types_1.ModelEnum.CLAUDE_3_HAIKU_20240307]: 'claude-3-haiku',
    [types_1.ModelEnum.CLAUDE_3_5_SONNET_20241022]: 'claude-3.5-sonnet',
    [types_1.ModelEnum.CLAUDE_3_5_HAIKU_20241022]: 'claude-3.5-haiku',
    [types_1.ModelEnum.CLAUDE_3_7_SONNET_20250219]: 'claude-3.7-sonnet',
    [types_1.ModelEnum.CLAUDE_3_7_SONNET_20250219_THINKING]: 'claude-3.7-sonnet-thinking',
    [types_1.ModelEnum.CLAUDE_4_OPUS]: 'claude-4-opus',
    [types_1.ModelEnum.CLAUDE_4_OPUS_THINKING]: 'claude-4-opus-thinking',
    [types_1.ModelEnum.CLAUDE_4_SONNET]: 'claude-4-sonnet',
    [types_1.ModelEnum.CLAUDE_4_SONNET_THINKING]: 'claude-4-sonnet-thinking',
    [types_1.ModelEnum.CLAUDE_4_1_OPUS]: 'claude-4.1-opus',
    [types_1.ModelEnum.CLAUDE_4_1_OPUS_THINKING]: 'claude-4.1-opus-thinking',
    [types_1.ModelEnum.CLAUDE_4_5_SONNET]: 'claude-4.5-sonnet',
    [types_1.ModelEnum.CLAUDE_4_5_SONNET_THINKING]: 'claude-4.5-sonnet-thinking',
    // NOTE: CLAUDE_4_5_SONNET_1M not available via API
    [types_1.ModelEnum.CLAUDE_4_5_OPUS]: 'claude-4.5-opus',
    [types_1.ModelEnum.CLAUDE_4_5_OPUS_THINKING]: 'claude-4.5-opus-thinking',
    [types_1.ModelEnum.CLAUDE_CODE]: 'claude-code',
    // GPT
    [types_1.ModelEnum.GPT_4]: 'gpt-4',
    [types_1.ModelEnum.GPT_4_1106_PREVIEW]: 'gpt-4-turbo',
    [types_1.ModelEnum.GPT_4O_2024_08_06]: 'gpt-4o',
    [types_1.ModelEnum.GPT_4O_MINI_2024_07_18]: 'gpt-4o-mini',
    // NOTE: GPT_4_5 not available via API
    [types_1.ModelEnum.GPT_4_1_2025_04_14]: 'gpt-4.1',
    [types_1.ModelEnum.GPT_4_1_MINI_2025_04_14]: 'gpt-4.1-mini',
    [types_1.ModelEnum.GPT_4_1_NANO_2025_04_14]: 'gpt-4.1-nano',
    [types_1.ModelEnum.GPT_5]: 'gpt-5',
    [types_1.ModelEnum.GPT_5_NANO]: 'gpt-5-nano',
    [types_1.ModelEnum.GPT_5_LOW]: 'gpt-5-low',
    [types_1.ModelEnum.GPT_5_HIGH]: 'gpt-5-high',
    [types_1.ModelEnum.GPT_5_CODEX]: 'gpt-5-codex',
    [types_1.ModelEnum.GPT_5_1_CODEX_MINI_MEDIUM]: 'gpt-5.1-codex-mini',
    [types_1.ModelEnum.GPT_5_1_CODEX_MEDIUM]: 'gpt-5.1-codex',
    [types_1.ModelEnum.GPT_5_1_CODEX_MAX_MEDIUM]: 'gpt-5.1-codex-max',
    [types_1.ModelEnum.GPT_5_2_LOW]: 'gpt-5.2-low',
    [types_1.ModelEnum.GPT_5_2_MEDIUM]: 'gpt-5.2',
    [types_1.ModelEnum.GPT_5_2_HIGH]: 'gpt-5.2-high',
    [types_1.ModelEnum.GPT_5_2_XHIGH]: 'gpt-5.2-xhigh',
    [types_1.ModelEnum.GPT_5_2_MEDIUM_PRIORITY]: 'gpt-5.2-priority',
    // O-Series (o1 series deprecated - use o3/o4)
    [types_1.ModelEnum.O3]: 'o3',
    [types_1.ModelEnum.O3_MINI]: 'o3-mini',
    [types_1.ModelEnum.O3_LOW]: 'o3-low',
    [types_1.ModelEnum.O3_HIGH]: 'o3-high',
    [types_1.ModelEnum.O3_PRO]: 'o3-pro',
    [types_1.ModelEnum.O3_PRO_LOW]: 'o3-pro-low',
    [types_1.ModelEnum.O3_PRO_HIGH]: 'o3-pro-high',
    [types_1.ModelEnum.O4_MINI]: 'o4-mini',
    [types_1.ModelEnum.O4_MINI_LOW]: 'o4-mini-low',
    [types_1.ModelEnum.O4_MINI_HIGH]: 'o4-mini-high',
    // Gemini (1.x series deprecated - use 2.x+)
    [types_1.ModelEnum.GEMINI_2_0_FLASH]: 'gemini-2.0-flash',
    [types_1.ModelEnum.GEMINI_2_5_PRO]: 'gemini-2.5-pro',
    [types_1.ModelEnum.GEMINI_2_5_FLASH]: 'gemini-2.5-flash',
    [types_1.ModelEnum.GEMINI_2_5_FLASH_THINKING]: 'gemini-2.5-flash-thinking',
    [types_1.ModelEnum.GEMINI_2_5_FLASH_LITE]: 'gemini-2.5-flash-lite',
    [types_1.ModelEnum.GEMINI_3_0_PRO_LOW]: 'gemini-3.0-pro-low',
    [types_1.ModelEnum.GEMINI_3_0_PRO_HIGH]: 'gemini-3.0-pro-high',
    [types_1.ModelEnum.GEMINI_3_0_PRO_MEDIUM]: 'gemini-3.0-pro',
    [types_1.ModelEnum.GEMINI_3_0_FLASH_MEDIUM]: 'gemini-3.0-flash',
    [types_1.ModelEnum.GEMINI_3_0_FLASH_HIGH]: 'gemini-3.0-flash-high',
    // DeepSeek
    [types_1.ModelEnum.DEEPSEEK_V3]: 'deepseek-v3',
    [types_1.ModelEnum.DEEPSEEK_V3_2]: 'deepseek-v3-2',
    [types_1.ModelEnum.DEEPSEEK_R1]: 'deepseek-r1',
    [types_1.ModelEnum.DEEPSEEK_R1_FAST]: 'deepseek-r1-fast',
    [types_1.ModelEnum.DEEPSEEK_R1_SLOW]: 'deepseek-r1-slow',
    // Llama
    [types_1.ModelEnum.LLAMA_3_1_8B_INSTRUCT]: 'llama-3.1-8b',
    [types_1.ModelEnum.LLAMA_3_1_70B_INSTRUCT]: 'llama-3.1-70b',
    [types_1.ModelEnum.LLAMA_3_1_405B_INSTRUCT]: 'llama-3.1-405b',
    [types_1.ModelEnum.LLAMA_3_3_70B_INSTRUCT]: 'llama-3.3-70b',
    [types_1.ModelEnum.LLAMA_3_3_70B_INSTRUCT_R1]: 'llama-3.3-70b-r1',
    // Qwen
    [types_1.ModelEnum.QWEN_2_5_7B_INSTRUCT]: 'qwen-2.5-7b',
    [types_1.ModelEnum.QWEN_2_5_32B_INSTRUCT]: 'qwen-2.5-32b',
    [types_1.ModelEnum.QWEN_2_5_72B_INSTRUCT]: 'qwen-2.5-72b',
    [types_1.ModelEnum.QWEN_2_5_32B_INSTRUCT_R1]: 'qwen-2.5-32b-r1',
    [types_1.ModelEnum.QWEN_3_235B_INSTRUCT]: 'qwen-3-235b',
    [types_1.ModelEnum.QWEN_3_CODER_480B_INSTRUCT]: 'qwen-3-coder-480b',
    [types_1.ModelEnum.QWEN_3_CODER_480B_INSTRUCT_FAST]: 'qwen-3-coder-480b-fast',
    // Grok
    [types_1.ModelEnum.GROK_2]: 'grok-2',
    [types_1.ModelEnum.GROK_3]: 'grok-3',
    [types_1.ModelEnum.GROK_3_MINI_REASONING]: 'grok-3-mini',
    [types_1.ModelEnum.GROK_CODE_FAST]: 'grok-code-fast',
    // Other
    [types_1.ModelEnum.MISTRAL_7B]: 'mistral-7b',
    [types_1.ModelEnum.KIMI_K2]: 'kimi-k2',
    [types_1.ModelEnum.KIMI_K2_THINKING]: 'kimi-k2-thinking',
    [types_1.ModelEnum.GLM_4_5]: 'glm-4.5',
    [types_1.ModelEnum.GLM_4_5_FAST]: 'glm-4.5-fast',
    [types_1.ModelEnum.GLM_4_6]: 'glm-4.6',
    [types_1.ModelEnum.GLM_4_6_FAST]: 'glm-4.6-fast',
    [types_1.ModelEnum.GLM_4_7]: 'glm-4.7',
    [types_1.ModelEnum.GLM_4_7_FAST]: 'glm-4.7-fast',
    [types_1.ModelEnum.MINIMAX_M2]: 'minimax-m2',
    [types_1.ModelEnum.MINIMAX_M2_1]: 'minimax-m2.1',
    [types_1.ModelEnum.SWE_1_5]: 'swe-1.5',
    [types_1.ModelEnum.SWE_1_5_THINKING]: 'swe-1.5-thinking',
    [types_1.ModelEnum.SWE_1_5_SLOW]: 'swe-1.5-slow',
};
// ============================================================================
// Public API
// ============================================================================
function resolveModel(modelName, variantOverride) {
    const { base, variant } = splitModelAndVariant(modelName);
    const baseId = ALIAS_TO_ID[base] || base;
    const entry = VARIANT_CATALOG[baseId];
    if (entry) {
        const effectiveVariant = (variantOverride || variant || '').trim().toLowerCase();
        if (effectiveVariant && entry.variants?.[effectiveVariant]) {
            return {
                enumValue: entry.variants[effectiveVariant].enumValue,
                modelId: entry.id,
                variant: effectiveVariant,
            };
        }
        return { enumValue: entry.defaultEnum, modelId: entry.id };
    }
    // Fallback to legacy map
    const normalized = normalizeModelId(modelName);
    const enumValue = MODEL_NAME_TO_ENUM[normalized];
    if (enumValue) {
        return { enumValue, modelId: normalized };
    }
    return { enumValue: types_1.ModelEnum.CLAUDE_3_5_SONNET_20241022, modelId: 'claude-3.5-sonnet' };
}
/**
 * Convert a model name string (optionally including variant) to enum
 */
function modelNameToEnum(modelName, variantOverride) {
    return resolveModel(modelName, variantOverride).enumValue;
}
/**
 * Convert a protobuf enum value to a canonical model name
 * @param enumValue - The enum value
 * @returns The canonical model name string
 */
function enumToModelName(enumValue) {
    return ENUM_TO_MODEL_NAME[enumValue] ?? 'claude-3.5-sonnet';
}
/**
 * Get all supported model names (includes legacy aliases)
 */
function getSupportedModels() {
    const fromVariants = Object.keys(VARIANT_CATALOG);
    const aliases = [];
    for (const entry of Object.values(VARIANT_CATALOG)) {
        if (entry.aliases)
            aliases.push(...entry.aliases);
        if (entry.variants) {
            for (const variantKey of Object.keys(entry.variants)) {
                aliases.push(`${entry.id}-${variantKey}`);
                for (const alias of entry.aliases || []) {
                    aliases.push(`${alias}-${variantKey}`);
                }
            }
        }
    }
    return Array.from(new Set([...fromVariants, ...aliases, ...Object.keys(MODEL_NAME_TO_ENUM)]));
}
/**
 * Check if a model name is supported (canonical or alias or variant)
 */
function isModelSupported(modelName) {
    const normalized = normalizeModelId(modelName);
    const { base, variant } = splitModelAndVariant(normalized);
    const baseId = ALIAS_TO_ID[base] || base;
    if (variant && VARIANT_CATALOG[baseId]?.variants?.[variant])
        return true;
    if (VARIANT_CATALOG[baseId])
        return true;
    return normalized in MODEL_NAME_TO_ENUM;
}
/** Default canonical model */
function getDefaultModel() {
    return 'claude-3.5-sonnet';
}
function getDefaultModelEnum() {
    return types_1.ModelEnum.CLAUDE_3_5_SONNET_20241022;
}
/**
 * Canonical models (no variants), aligned with OpenCode listing
 */
function getCanonicalModels() {
    const bases = new Set(Object.keys(VARIANT_CATALOG));
    // Add non-variant canonical names derived from enum mapping
    for (const name of Object.values(ENUM_TO_MODEL_NAME)) {
        if (!name)
            continue;
        if (VARIANT_NAME_SET.has(name))
            continue; // skip variant entries
        if (!bases.has(name))
            bases.add(name);
    }
    return Array.from(bases).sort();
}
function getModelVariants(modelId) {
    const baseId = ALIAS_TO_ID[normalizeModelId(modelId)] || normalizeModelId(modelId);
    return VARIANT_CATALOG[baseId]?.variants;
}
