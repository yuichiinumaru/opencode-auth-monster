import { AuthProvider, ManagedAccount, OAuthTokens } from '../../core/types';
import { listenForCode, generatePKCE } from '../../utils/oauth-server';
import { proxyFetch } from '../../core/proxy';

const ANTIGRAVITY_CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const ANTIGRAVITY_CLIENT_SECRET = "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";
const ANTIGRAVITY_VERSION = "1.15.8";

const GEMINI_CLIENT_ID = process.env.GEMINI_CLIENT_ID || ANTIGRAVITY_CLIENT_ID;
const GEMINI_CLIENT_SECRET = process.env.GEMINI_CLIENT_SECRET || ANTIGRAVITY_CLIENT_SECRET;

const GEMINI_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email", 
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/cclog",
  "https://www.googleapis.com/auth/experimentsandconfigs"
];

const ANTIGRAVITY_HEADERS = {
  "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/${ANTIGRAVITY_VERSION} Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36`,
  "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
  "Client-Metadata": '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
};

const ANTIGRAVITY_ENDPOINTS = [
    "https://daily-cloudcode-pa.sandbox.googleapis.com",
    "https://autopush-cloudcode-pa.sandbox.googleapis.com",
    "https://cloudcode-pa.googleapis.com"
];

export class GeminiProvider {
  static readonly provider = AuthProvider.Gemini;

  static getHeaders(account: ManagedAccount): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': ANTIGRAVITY_HEADERS['User-Agent'],
      'X-Goog-Api-Client': ANTIGRAVITY_HEADERS['X-Goog-Api-Client'],
    };

    if (account.apiKey) {
      headers['x-goog-api-key'] = account.apiKey;
    } else if (account.tokens.accessToken) {
      headers['Authorization'] = `Bearer ${account.tokens.accessToken}`;
    }

    if (account.metadata?.projectId) {
      headers['x-goog-user-project'] = account.metadata.projectId;
    }

    // Skip thought signature validation for thinking models (official Google feature)
    headers['x-goog-skip-thought-signature-validator'] = 'true';

    return headers;
  }

  static getUrl(model: string, account: ManagedAccount): string {
    // Determine base endpoint
    let baseEndpoint = "https://generativelanguage.googleapis.com";

    if (model.includes('antigravity')) {
        // Use daily endpoint for antigravity models
        baseEndpoint = ANTIGRAVITY_ENDPOINTS[0];
    }

    return `${baseEndpoint}/v1beta/models/${model}:generateContent`;
  }

  static async refreshTokens(account: ManagedAccount): Promise<ManagedAccount> {
    if (!account.tokens.refreshToken) {
      return account;
    }

    try {
      const [refreshToken, projectId = ""] = account.tokens.refreshToken.split('|');

      const response = await proxyFetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: GEMINI_CLIENT_ID,
          client_secret: GEMINI_CLIENT_SECRET,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const json = await response.json() as any;
      
      return {
        ...account,
        tokens: {
          ...account.tokens,
          accessToken: json.access_token,
          refreshToken: json.refresh_token ? `${json.refresh_token}|${projectId}` : account.tokens.refreshToken,
          expiryDate: Date.now() + (json.expires_in * 1000),
          tokenType: json.token_type || 'Bearer',
        },
        lastUsed: Date.now(),
        isHealthy: true
      };
    } catch (error) {
      console.error('Failed to refresh Gemini tokens:', error);
      return {
        ...account,
        isHealthy: false
      };
    }
  }

  static async login(): Promise<OAuthTokens & { email: string, metadata?: any }> {
    const port = 51121;
    const redirectUri = `http://localhost:${port}/oauth-callback`;
    const pkce = await generatePKCE();
    
    console.log("\n=== Google Gemini (Antigravity Mode) OAuth Setup ===");
    
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", GEMINI_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", GEMINI_SCOPES.join(" "));
    url.searchParams.set("code_challenge", pkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", Buffer.from(JSON.stringify({ verifier: pkce.verifier, projectId: "" })).toString('base64'));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    console.log(`\nPlease visit the following URL to authorize Gemini:\n`);
    console.log(`\x1b[36m${url.toString()}\x1b[0m\n`);
    console.log(`Waiting for callback on port ${port}...`);

    const codeWithState = await listenForCode(port);
    const [code, state] = codeWithState.split('#');

    console.log('Code received, exchanging for tokens...');
    
    const { verifier } = JSON.parse(Buffer.from(state, 'base64').toString());

    const response = await proxyFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": ANTIGRAVITY_HEADERS["User-Agent"],
      },
      body: new URLSearchParams({
        client_id: GEMINI_CLIENT_ID,
        client_secret: GEMINI_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange Gemini code: ${response.status} ${errorText}`);
    }

    const json = await response.json() as any;
    
    let projectId = await this.fetchProjectID(json.access_token);

    const userInfoResponse = await proxyFetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
      headers: {
        "Authorization": `Bearer ${json.access_token}`
      }
    });
    
    const userInfo = userInfoResponse.ok ? await userInfoResponse.json() as any : { email: 'unknown@google.com' };

    return {
      accessToken: json.access_token,
      refreshToken: `${json.refresh_token}|${projectId || ""}`,
      expiryDate: Date.now() + (json.expires_in * 1000),
      tokenType: json.token_type || 'Bearer',
      email: userInfo.email,
      metadata: {
        projectId: projectId
      }
    };
  }

  static async fetchProjectID(accessToken: string): Promise<string> {
    for (const endpoint of [ANTIGRAVITY_ENDPOINTS[2], ANTIGRAVITY_ENDPOINTS[0]]) {
        try {
            const response = await proxyFetch(`${endpoint}/v1internal:loadCodeAssist`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    ...ANTIGRAVITY_HEADERS
                },
                body: JSON.stringify({
                    metadata: {
                        ideType: "IDE_UNSPECIFIED",
                        platform: "PLATFORM_UNSPECIFIED",
                        pluginType: "GEMINI",
                    },
                }),
            });

            if (!response.ok) continue;

            const data = await response.json() as any;
            const pid = data.cloudaicompanionProject?.id || data.cloudaicompanionProject || "";
            if (pid) return pid;
        } catch {
            continue;
        }
    }
    return "";
  }

  static async checkQuota(account: ManagedAccount): Promise<any> {
    const results: any = { antigravity: null, geminiCli: null };

    try {
        const antResp = await proxyFetch(`${ANTIGRAVITY_ENDPOINTS[2]}/v1internal:fetchAvailableModels`, {
            method: "POST",
            headers: this.getHeaders(account),
            body: JSON.stringify(account.metadata?.projectId ? { project: account.metadata.projectId } : {}),
        });
        if (antResp.ok) results.antigravity = await antResp.json();

        const geminiCliUserAgent = "GeminiCLI/1.0.0/gemini-2.5-pro (darwin; arm64)";
        const cliResp = await proxyFetch(`${ANTIGRAVITY_ENDPOINTS[2]}/v1internal:retrieveUserQuota`, {
            method: "POST",
            headers: {
                ...this.getHeaders(account),
                "User-Agent": geminiCliUserAgent
            },
            body: JSON.stringify(account.metadata?.projectId ? { project: account.metadata.projectId } : {}),
        });
        if (cliResp.ok) results.geminiCli = await cliResp.json();

    } catch (e) {
        console.error("Quota check failed", e);
    }

    return results;
  }

  static transformRequest(body: any): any {
    if (body.contents) return body;

    const transformed: any = {
      contents: []
    };

    if (body.messages && Array.isArray(body.messages)) {
      transformed.contents = body.messages.map((msg: any) => {
        let role = msg.role;
        if (role === 'assistant') role = 'model';
        if (role === 'system') role = 'user';

        let parts = [];
        if (typeof msg.content === 'string') {
          parts = [{ text: msg.content }];
        } else if (Array.isArray(msg.content)) {
          parts = msg.content.map((part: any) => {
            if (part.type === 'text') return { text: part.text };
            if (part.type === 'image_url') {
               return { text: '[Image]' };
            }
            return part;
          });
        }

        return { role, parts };
      });
    }

    if (body.model) {
      transformed.model = body.model;
    }

    transformed.generationConfig = {
      temperature: body.temperature,
      maxOutputTokens: body.max_tokens,
      topP: body.top_p,
      topK: body.top_k,
      stopSequences: body.stop
    };

    return transformed;
  }
}
