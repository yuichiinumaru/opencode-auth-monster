import { AuthProvider, ManagedAccount, OAuthTokens } from '../../core/types';
import { listenForCode, generatePKCE } from '../../utils/oauth-server';
import { proxyFetch } from '../../core/proxy';

// Antigravity Constants
const ANTIGRAVITY_CLIENT_ID = process.env.ANTIGRAVITY_CLIENT_ID || "";
const ANTIGRAVITY_CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || "";
const ANTIGRAVITY_ENDPOINT_PROD = "https://cloudcode-pa.googleapis.com";
const ANTIGRAVITY_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/cclog",
  "https://www.googleapis.com/auth/experimentsandconfigs",
];

const GEMINI_CLIENT_ID = process.env.GEMINI_CLIENT_ID || ANTIGRAVITY_CLIENT_ID;
const GEMINI_CLIENT_SECRET = process.env.GEMINI_CLIENT_SECRET || ANTIGRAVITY_CLIENT_SECRET;
const GEMINI_SCOPES = ANTIGRAVITY_SCOPES;

export class GeminiProvider {
  static readonly provider = AuthProvider.Gemini;

  static getHeaders(account: ManagedAccount): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Antigravity/1.15.8',
      'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
    };

    if (account.apiKey) {
      headers['x-goog-api-key'] = account.apiKey;
    } else if (account.tokens.accessToken) {
      headers['Authorization'] = `Bearer ${account.tokens.accessToken}`;
    }

    if (account.metadata?.projectId) {
      headers['x-goog-user-project'] = account.metadata.projectId;
    }

    return headers;
  }

  static getUrl(model: string, account: ManagedAccount): string {
    // If it's an antigravity model, we might want to use the sandbox endpoint
    // but for now we'll stick to the production generative language endpoint
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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

  static async fetchProjectID(accessToken: string): Promise<string> {
    try {
      const response = await proxyFetch(`${ANTIGRAVITY_ENDPOINT_PROD}/v1internal:loadCodeAssist`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "google-cloud-sdk vscode_cloudshelleditor/0.1",
        },
        body: JSON.stringify({
          metadata: {
            ideType: "IDE_UNSPECIFIED",
            platform: "PLATFORM_UNSPECIFIED",
            pluginType: "GEMINI",
          },
        }),
      });

      if (!response.ok) return "";

      const data = await response.json() as any;
      return data.cloudaicompanionProject?.id || data.cloudaicompanionProject || "";
    } catch {
      return "";
    }
  }

  static async checkQuota(account: ManagedAccount): Promise<ManagedAccount> {
    if (!account.tokens.accessToken) return account;

    try {
      const projectId = account.metadata?.projectId || await this.fetchProjectID(account.tokens.accessToken);

      const response = await proxyFetch(`${ANTIGRAVITY_ENDPOINT_PROD}/v1internal:fetchAvailableModels`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.tokens.accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Antigravity/1.15.8",
        },
        body: JSON.stringify({ project: projectId }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        // Process data.models to extract quotaInfo
        // For simplicity, we'll just check if any model has remaining quota
        let minRemaining = 1.0;
        if (data.models) {
          for (const model of Object.values(data.models) as any[]) {
            if (model.quotaInfo && model.quotaInfo.remainingFraction !== undefined) {
              minRemaining = Math.min(minRemaining, model.quotaInfo.remainingFraction);
            }
          }
        }

        return {
          ...account,
          quota: {
            limit: 100,
            remaining: Math.floor(minRemaining * 100),
            resetTime: undefined // Could parse from data.models[...].quotaInfo.resetTime
          },
          metadata: {
            ...account.metadata,
            projectId
          }
        };
      }
    } catch (error) {
      console.error('Failed to check Gemini quota:', error);
    }

    return account;
  }

  static async login(): Promise<OAuthTokens & { email: string, metadata?: any }> {
    const port = 51121;
    const redirectUri = `http://localhost:${port}/oauth-callback`;
    const pkce = await generatePKCE();
    
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", GEMINI_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", GEMINI_SCOPES.join(" "));
    url.searchParams.set("code_challenge", pkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", Buffer.from(JSON.stringify({ verifier: pkce.verifier })).toString('base64'));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    console.log(`\nPlease visit the following URL to authorize Gemini (Antigravity Mode):\n`);
    console.log(`\x1b[36m${url.toString()}\x1b[0m\n`);
    console.log(`Waiting for callback on port ${port}...`);

    const codeWithState = await listenForCode(port);
    const [code, state] = codeWithState.split('#');

    const { verifier } = JSON.parse(Buffer.from(state, 'base64').toString());

    const response = await proxyFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
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
    
    const userInfoResponse = await proxyFetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
      headers: {
        "Authorization": `Bearer ${json.access_token}`
      }
    });
    
    const userInfo = userInfoResponse.ok ? await userInfoResponse.json() as any : { email: 'unknown@google.com' };
    const projectId = await this.fetchProjectID(json.access_token);

    return {
      accessToken: json.access_token,
      refreshToken: `${json.refresh_token}|${projectId || ""}`,
      expiryDate: Date.now() + (json.expires_in * 1000),
      tokenType: json.token_type || 'Bearer',
      email: userInfo.email,
      metadata: {
        projectId
      }
    };
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
