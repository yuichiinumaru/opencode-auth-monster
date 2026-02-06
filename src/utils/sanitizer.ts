/**
 * Sanitizes the request body to remove model-specific fields that might cause
 * conflicts when rotating between different model families.
 */
export function sanitizeCrossModelRequest(body: any): any {
  if (typeof body !== 'object' || body === null) {
    return body;
  }

  const sanitized = Array.isArray(body) ? [...body] : { ...body };
  
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

  if (sanitized.messages && Array.isArray(sanitized.messages)) {
    sanitized.messages = sanitized.messages.map((msg: any) => {
      if (typeof msg === 'object' && msg !== null) {
        const newMsg = { ...msg };
        for (const field of fieldsToStrip) {
          if (field in newMsg) {
            delete newMsg[field];
          }
        }
        
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

const ANTIGRAVITY_USER_AGENTS = [
  "Antigravity/1.15.8 (windows/amd64)",
  "Antigravity/1.15.8 (darwin/arm64)",
  "Antigravity/1.15.8 (linux/amd64)"
];

const GEMINI_CLI_USER_AGENTS = [
  "google-api-nodejs-client/10.3.0",
  "google-api-nodejs-client/9.15.1"
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Applies strict header spoofing to bypass WAFs and identify as an official client.
 */
export function applyHeaderSpoofing(headers: Record<string, string>, accountId: string, provider: string, model?: string): Record<string, string> {
  const spoofed = { ...headers };

  const forbiddenHeaders = [
    'x-stainless-lang',
    'x-stainless-package-version',
    'x-stainless-os',
    'x-stainless-arch',
    'x-stainless-runtime',
    'x-stainless-runtime-version',
    'user-agent'
  ];

  for (const h of forbiddenHeaders) {
    Object.keys(spoofed).forEach(k => {
      if (k.toLowerCase() === h) delete spoofed[k];
    });
  }

  if (provider === 'gemini') {
    if (model?.includes('antigravity') || model?.includes('claude')) {
      spoofed['User-Agent'] = randomFrom(ANTIGRAVITY_USER_AGENTS);
      spoofed['X-Goog-Api-Client'] = 'google-cloud-sdk vscode_cloudshelleditor/0.1';
      spoofed['Client-Metadata'] = '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}';
    } else {
      spoofed['User-Agent'] = randomFrom(GEMINI_CLI_USER_AGENTS);
      spoofed['X-Goog-Api-Client'] = 'gl-node/22.18.0';
      spoofed['Client-Metadata'] = 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI';
    }
  } else if (provider === 'anthropic') {
    spoofed['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    spoofed['Anthropic-Client'] = 'claude-web-client';
  } else {
    spoofed['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    spoofed['Openai-Account-Id'] = accountId;
    spoofed['Openai-Intent'] = 'conversation-edits';
    spoofed['Openai-Internal-Beta'] = 'responses-v1';
    spoofed['X-Openai-Originator'] = 'codex';
  }

  return spoofed;
}
