import { ManagedAccount } from './types';

/**
 * Session Recovery Module
 *
 * Ported and improved from opencode-antigravity-auth.
 * Handles common session errors such as missing tool results or thinking blocks.
 */

export interface RecoveryAction {
  type: 'synthetic_tool_result' | 'synthetic_thinking' | 'reset_session';
  messages: any[];
}

/**
 * Detects if a session needs recovery based on the error message or request state.
 */
export function detectRecoveryNeed(error: any, requestBody: any): RecoveryAction | null {
  const errorMessage = typeof error === 'string' ? error : error?.message || '';

  // 1. Tool result missing error
  // "tool_use ids were found without tool_result blocks immediately after"
  if (errorMessage.includes('tool_use') && errorMessage.includes('without tool_result')) {
    return handleMissingToolResults(requestBody);
  }

  // 2. Thinking block order error
  // "Expected thinking but found text"
  if (errorMessage.includes('Expected thinking') && errorMessage.includes('found text')) {
    return {
        type: 'reset_session',
        messages: [] // Signal to the caller to reset or close the turn
    };
  }

  return null;
}

/**
 * Injects synthetic tool results to close an open tool call loop.
 */
function handleMissingToolResults(requestBody: any): RecoveryAction | null {
  if (!requestBody || !Array.isArray(requestBody.contents)) return null;

  const syntheticMessages: any[] = [];

  // Find the last message with tool_use
  for (const content of requestBody.contents) {
    if (content.role === 'model' || content.role === 'assistant') {
      const toolUses = content.parts?.filter((p: any) => p.toolCall || p.functionCall);
      if (toolUses && toolUses.length > 0) {
        // We found the culprit. In a real scenario, we'd check if results are missing.
        // For recovery, we provide synthetic "cancelled" results for each.

        const results = toolUses.map((tu: any) => ({
          role: 'user',
          parts: [{
            toolResponse: {
              name: tu.toolCall?.name || tu.functionCall?.name,
              content: { error: "Operation cancelled or interrupted" }
            }
          }]
        }));

        syntheticMessages.push(...results);
      }
    }
  }

  if (syntheticMessages.length === 0) return null;

  return {
    type: 'synthetic_tool_result',
    messages: syntheticMessages
  };
}

/**
 * Ensures Claude thinking models have proper thinking blocks before tool use.
 */
export function ensureThinkingBeforeToolUse(contents: any[]): any[] {
    if (!Array.isArray(contents)) return contents;

    let lastThinking: any = null;

    return contents.map((content, index) => {
        if (content.role === 'model' || content.role === 'assistant') {
            const hasThinking = content.parts?.some((p: any) => p.thought || p.reasoning);
            const hasToolUse = content.parts?.some((p: any) => p.toolCall || p.functionCall);

            if (hasThinking) {
                lastThinking = content.parts.find((p: any) => p.thought || p.reasoning);
            }

            if (hasToolUse && !hasThinking && lastThinking) {
                // Inject cached thinking before tool use
                return {
                    ...content,
                    parts: [lastThinking, ...content.parts]
                };
            }
        }
        return content;
    });
}
