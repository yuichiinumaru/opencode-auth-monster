export interface ToolRecoveryMessage {
  role: string;
  content?: Array<{
    type?: string;
    id?: string;
    tool_use_id?: string;
    content?: string;
    [key: string]: any;
  }> | string;
  [key: string]: any;
}

export function appendSyntheticToolResults(
  messages: ToolRecoveryMessage[] | undefined,
  fallbackContent = 'Operation cancelled.'
): ToolRecoveryMessage[] | undefined {
  if (!messages || messages.length === 0) {
    return messages;
  }

  const pendingToolUseIds = new Set<string>();

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
