const SCHEMA_FIELDS_TO_STRIP = [
  'const',
  '$ref',
  '$defs',
  'default',
  'examples',
  'additionalProperties',
  '$schema',
  'title'
];

function isThinkingBlock(block: any): boolean {
  if (!block || typeof block !== 'object') return false;
  const type = String(block.type || '').toLowerCase();
  return block.thought === true || ['thinking', 'reasoning', 'thought'].includes(type);
}

export function cleanJsonSchemaForProvider(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  if (Array.isArray(schema)) {
    return schema.map(cleanJsonSchemaForProvider);
  }

  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (SCHEMA_FIELDS_TO_STRIP.includes(key)) {
      continue;
    }

    if (key === 'const') {
      cleaned.enum = [value];
      continue;
    }

    if (key === 'properties' && value && typeof value === 'object') {
      const nextProps: Record<string, any> = {};
      for (const [propKey, propValue] of Object.entries(value)) {
        nextProps[propKey] = cleanJsonSchemaForProvider(propValue);
      }
      cleaned.properties = nextProps;
      continue;
    }

    cleaned[key] = cleanJsonSchemaForProvider(value);
  }

  if (cleaned.type === 'object') {
    const props = cleaned.properties ?? {};
    if (Object.keys(props).length === 0) {
      cleaned.properties = {
        reason: {
          type: 'string',
          description: 'Placeholder field required by provider schema validation.'
        }
      };
    }
  }

  return cleaned;
}

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
          newMsg.content = newMsg.content
            .filter((block: any) => !isThinkingBlock(block))
            .map((block: any) => {
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

/**
 * Applies strict header spoofing to bypass WAFs and identify as an official client.
 *
 * @param headers Original headers
 * @param accountId Account ID (for Openai-Account-Id)
 * @param provider Provider type (affects spoofing strategy)
 */
export function applyHeaderSpoofing(headers: Record<string, string>, accountId: string, provider: string): Record<string, string> {
  const spoofed = { ...headers };

  // 1. Remove dangerous headers that leak identity
  const forbiddenHeaders = [
    'x-stainless-lang',
    'x-stainless-package-version',
    'x-stainless-os',
    'x-stainless-arch',
    'x-stainless-runtime',
    'x-stainless-runtime-version',
    'user-agent' // We will replace it
  ];

  for (const h of forbiddenHeaders) {
    // Case-insensitive deletion
    Object.keys(spoofed).forEach(k => {
      if (k.toLowerCase() === h) delete spoofed[k];
    });
  }

  // 2. Inject Official Client Fingerprints
  spoofed['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

  if (provider === 'gemini') {
    spoofed['X-Goog-Api-Client'] = 'gl-node/1.0.0 gdcl/25.0.0';
  } else if (provider === 'anthropic') {
    spoofed['Anthropic-Client'] = 'claude-web-client';
  } else {
    // Default OpenAI-like spoofing
    spoofed['Openai-Account-Id'] = accountId;
    spoofed['Openai-Intent'] = 'conversation-edits';
    spoofed['Openai-Internal-Beta'] = 'responses-v1';
    spoofed['X-Openai-Originator'] = 'codex';
  }

  return spoofed;
}
