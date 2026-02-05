"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheThinkingBlocks = cacheThinkingBlocks;
exports.injectCachedThinking = injectCachedThinking;
exports.cacheThinkingFromResponse = cacheThinkingFromResponse;
const thinkingCache = new Map();
function isThinkingBlock(block) {
    const type = String(block.type || '').toLowerCase();
    return block.thought === true || ['thinking', 'reasoning', 'thought'].includes(type);
}
function cloneThinkingBlock(block) {
    return { ...block };
}
function cacheThinkingBlocks(messages, sessionKey) {
    if (!messages || messages.length === 0)
        return;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (!message || !Array.isArray(message.content))
            continue;
        for (let j = message.content.length - 1; j >= 0; j -= 1) {
            const block = message.content[j];
            if (block && isThinkingBlock(block)) {
                thinkingCache.set(sessionKey, cloneThinkingBlock(block));
                return;
            }
        }
    }
}
function injectCachedThinking(messages, sessionKey) {
    if (!messages || messages.length === 0)
        return;
    const cached = thinkingCache.get(sessionKey);
    if (!cached)
        return;
    messages.forEach(message => {
        if (!message || !Array.isArray(message.content))
            return;
        const hasToolUse = message.content.some(block => block?.type === 'tool_use');
        if (!hasToolUse)
            return;
        const hasThinking = message.content.some(block => block && isThinkingBlock(block));
        if (hasThinking)
            return;
        message.content.unshift(cloneThinkingBlock(cached));
    });
}
function cacheThinkingFromResponse(payload, sessionKey) {
    if (!payload || typeof payload !== 'object')
        return;
    const content = Array.isArray(payload.content) ? payload.content : undefined;
    if (!content)
        return;
    cacheThinkingBlocks([
        {
            role: 'assistant',
            content
        }
    ], sessionKey);
}
