"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendSyntheticToolResults = appendSyntheticToolResults;
function appendSyntheticToolResults(messages, fallbackContent = 'Operation cancelled.') {
    if (!messages || messages.length === 0) {
        return messages;
    }
    const pendingToolUseIds = new Set();
    for (const message of messages) {
        if (!Array.isArray(message.content)) {
            continue;
        }
        for (const block of message.content) {
            if (!block || typeof block !== 'object') {
                continue;
            }
            if (block.type === 'tool_use' && typeof block.id === 'string') {
                pendingToolUseIds.add(block.id);
            }
            if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
                pendingToolUseIds.delete(block.tool_use_id);
            }
        }
    }
    if (pendingToolUseIds.size === 0) {
        return messages;
    }
    const syntheticResults = Array.from(pendingToolUseIds).map(id => ({
        type: 'tool_result',
        tool_use_id: id,
        content: fallbackContent
    }));
    return [
        ...messages,
        {
            role: 'user',
            content: syntheticResults
        }
    ];
}
