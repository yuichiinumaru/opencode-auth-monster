/**
 * Sanitizes the request body to remove model-specific fields that might cause
 * conflicts when rotating between different model families.
 * 
 * This prevents 'Invalid signature' errors when rotating from Gemini (which adds signatures)
 * to Anthropic/OpenAI (which don't expect them).
 */
export function sanitizeCrossModelRequest(body: any): any {
  if (typeof body !== 'object' || body === null) {
    return body;
  }

  // Create a shallow copy if it's an object
  const sanitized = Array.isArray(body) ? [...body] : { ...body };
  
  // Fields to strip from the top-level
  const fieldsToStrip = [
    'thoughtSignature',
    'thinkingMetadata',
    'signature',
    'thought_signature',
    'thoughtSignatureJson'
  ];

  if (!Array.isArray(sanitized)) {
    for (const field of fieldsToStrip) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }
  }

  // Recursively sanitize messages if present
  if (sanitized.messages && Array.isArray(sanitized.messages)) {
    sanitized.messages = sanitized.messages.map((msg: any) => {
      if (typeof msg === 'object' && msg !== null) {
        const newMsg = { ...msg };
        for (const field of fieldsToStrip) {
          if (field in newMsg) {
            delete newMsg[field];
          }
        }
        
        // Also check inside content if it's an array (Anthropic style)
        if (Array.isArray(newMsg.content)) {
          newMsg.content = newMsg.content.map((block: any) => {
            if (typeof block === 'object' && block !== null) {
              const newBlock = { ...block };
              for (const field of fieldsToStrip) {
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
