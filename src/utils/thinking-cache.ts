type ThinkingBlock = {
  type?: string;
  thought?: boolean;
  text?: string;
  thoughtSignature?: string;
  signature?: string;
  [key: string]: any;
};

type MessageBlock = {
  type?: string;
  [key: string]: any;
};

type Message = {
  role?: string;
  content?: string | MessageBlock[];
  [key: string]: any;
};

const thinkingCache = new Map<string, ThinkingBlock>();

function isThinkingBlock(block: MessageBlock): block is ThinkingBlock {
  const type = String(block.type || '').toLowerCase();
  return block.thought === true || ['thinking', 'reasoning', 'thought'].includes(type);
}

function cloneThinkingBlock(block: ThinkingBlock): ThinkingBlock {
  return { ...block };
}

export function cacheThinkingBlocks(messages: Message[] | undefined, sessionKey: string): void {
  if (!messages || messages.length === 0) return;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || !Array.isArray(message.content)) continue;

    for (let j = message.content.length - 1; j >= 0; j -= 1) {
      const block = message.content[j];
      if (block && isThinkingBlock(block)) {
        thinkingCache.set(sessionKey, cloneThinkingBlock(block));
        return;
      }
    }
  }
}

export function injectCachedThinking(messages: Message[] | undefined, sessionKey: string): void {
  if (!messages || messages.length === 0) return;

  const cached = thinkingCache.get(sessionKey);
  if (!cached) return;

  messages.forEach(message => {
    if (!message || !Array.isArray(message.content)) return;

    const hasToolUse = message.content.some(block => block?.type === 'tool_use');
    if (!hasToolUse) return;

    const hasThinking = message.content.some(block => block && isThinkingBlock(block));
    if (hasThinking) return;

    message.content.unshift(cloneThinkingBlock(cached));
  });
}

export function cacheThinkingFromResponse(payload: any, sessionKey: string): void {
  if (!payload || typeof payload !== 'object') return;

  const content = Array.isArray(payload.content) ? payload.content : undefined;
  if (!content) return;

  cacheThinkingBlocks(
    [
      {
        role: 'assistant',
        content
      }
    ],
    sessionKey
  );
}
