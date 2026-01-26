"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeCrossModelRequest = sanitizeCrossModelRequest;
exports.applyHeaderSpoofing = applyHeaderSpoofing;
/**
 * Sanitizes the request body to remove model-specific fields that might cause
 * conflicts when rotating between different model families.
 *
 * This prevents 'Invalid signature' errors when rotating from Gemini (which adds signatures)
 * to Anthropic/OpenAI (which don't expect them).
 */
function sanitizeCrossModelRequest(body) {
    if (typeof body !== 'object' || body === null) {
        return body;
    }
    // Create a shallow copy if it's an object
    var sanitized = Array.isArray(body) ? __spreadArray([], body, true) : __assign({}, body);
    // Fields to strip from the top-level
    var fieldsToStrip = [
        'thoughtSignature',
        'thinkingMetadata',
        'signature',
        'thought_signature',
        'thoughtSignatureJson'
    ];
    if (!Array.isArray(sanitized)) {
        for (var _i = 0, fieldsToStrip_1 = fieldsToStrip; _i < fieldsToStrip_1.length; _i++) {
            var field = fieldsToStrip_1[_i];
            if (field in sanitized) {
                delete sanitized[field];
            }
        }
    }
    // Recursively sanitize messages if present
    if (sanitized.messages && Array.isArray(sanitized.messages)) {
        sanitized.messages = sanitized.messages.map(function (msg) {
            if (typeof msg === 'object' && msg !== null) {
                var newMsg = __assign({}, msg);
                for (var _i = 0, fieldsToStrip_2 = fieldsToStrip; _i < fieldsToStrip_2.length; _i++) {
                    var field = fieldsToStrip_2[_i];
                    if (field in newMsg) {
                        delete newMsg[field];
                    }
                }
                // Also check inside content if it's an array (Anthropic style)
                if (Array.isArray(newMsg.content)) {
                    newMsg.content = newMsg.content.map(function (block) {
                        if (typeof block === 'object' && block !== null) {
                            var newBlock = __assign({}, block);
                            for (var _i = 0, fieldsToStrip_3 = fieldsToStrip; _i < fieldsToStrip_3.length; _i++) {
                                var field = fieldsToStrip_3[_i];
                                if (field in newBlock) {
                                    delete newBlock[field];
                                }
                            }
                            return newBlock;
                        }
                        return block;
                    });
                }
                return newMsg;
            }
            return msg;
        });
    }
    return sanitized;
}
/**
 * Applies strict header spoofing to bypass WAFs and identify as an official client.
 *
 * @param headers Original headers
 * @param accountId Account ID (for Openai-Account-Id)
 * @param provider Provider type (affects spoofing strategy)
 */
function applyHeaderSpoofing(headers, accountId, provider) {
    var spoofed = __assign({}, headers);
    // 1. Remove dangerous headers that leak identity
    var forbiddenHeaders = [
        'x-stainless-lang',
        'x-stainless-package-version',
        'x-stainless-os',
        'x-stainless-arch',
        'x-stainless-runtime',
        'x-stainless-runtime-version',
        'user-agent' // We will replace it
    ];
    var _loop_1 = function (h) {
        // Case-insensitive deletion
        Object.keys(spoofed).forEach(function (k) {
            if (k.toLowerCase() === h)
                delete spoofed[k];
        });
    };
    for (var _i = 0, forbiddenHeaders_1 = forbiddenHeaders; _i < forbiddenHeaders_1.length; _i++) {
        var h = forbiddenHeaders_1[_i];
        _loop_1(h);
    }
    // 2. Inject Official Client Fingerprints
    spoofed['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    if (provider === 'gemini') {
        spoofed['X-Goog-Api-Client'] = 'gl-node/1.0.0 gdcl/25.0.0';
    }
    else if (provider === 'anthropic') {
        spoofed['Anthropic-Client'] = 'claude-web-client';
    }
    else {
        // Default OpenAI-like spoofing
        spoofed['Openai-Account-Id'] = accountId;
        spoofed['Openai-Intent'] = 'conversation-edits';
        spoofed['Openai-Internal-Beta'] = 'responses-v1';
        spoofed['X-Openai-Originator'] = 'codex';
    }
    return spoofed;
}
