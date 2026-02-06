import { AuthProvider, ManagedAccount, OAuthTokens } from '../../core/types';
import { listenForCode, generatePKCE } from '../../utils/oauth-server';
import { proxyFetch } from '../../core/proxy';

const GEMINI_CLIENT_ID = process.env.GEMINI_CLIENT_ID || "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const GEMINI_CLIENT_SECRET = process.env.GEMINI_CLIENT_SECRET || "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";
const GEMINI_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email", 
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/cclog",
  "https://www.googleapis.com/auth/experimentsandconfigs"
];

const ANTIGRAVITY_ENDPOINT_PROD = "https://cloudcode-pa.googleapis.com";
const ANTIGRAVITY_HEADERS = {
  "User-Agent": "Antigravity/1.15.8",
  "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
  "Client-Metadata": '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
};

export class GeminiProvider {
  static readonly provider = AuthProvider.Gemini;

  static getHeaders(account: ManagedAccount): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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
    if (model.includes('antigravity') || model.includes('claude')) {
      return `${ANTIGRAVITY_ENDPOINT_PROD}/v1beta/models/${model}:generateContent`;
    }
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
      
      let effectiveProjectId = projectId;
      if (!effectiveProjectId) {
         effectiveProjectId = await this.fetchProjectID(json.access_token);
      }

      return {
        ...account,
        tokens: {
          ...account.tokens,
          accessToken: json.access_token,
          refreshToken: json.refresh_token ? `${json.refresh_token}|${effectiveProjectId}` : account.tokens.refreshToken,
          expiryDate: Date.now() + (json.expires_in * 1000),
          tokenType: json.token_type || 'Bearer',
        },
        metadata: {
          ...account.metadata,
          projectId: effectiveProjectId
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
          "User-Agent": ANTIGRAVITY_HEADERS["User-Agent"],
          "X-Goog-Api-Client": ANTIGRAVITY_HEADERS["X-Goog-Api-Client"],
          "Client-Metadata": ANTIGRAVITY_HEADERS["Client-Metadata"],
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
      if (typeof data.cloudaicompanionProject === 'string') return data.cloudaicompanionProject;
      if (data.cloudaicompanionProject?.id) return data.cloudaicompanionProject.id;

      return "";
    } catch {
      return "";
    }
  }

  static async login(): Promise<OAuthTokens & { email: string, metadata?: any }> {
    const port = 1455;
    const redirectUri = `http://localhost:${port}/callback`;
    const pkce = await generatePKCE();
    
    const projectId = ""; 

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", GEMINI_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", GEMINI_SCOPES.join(" "));
    url.searchParams.set("code_challenge", pkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", Buffer.from(JSON.stringify({ verifier: pkce.verifier, projectId })).toString('base64'));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    console.log(`\nPlease visit the following URL to authorize Gemini:\n`);
    console.log(`\x1b[36m${url.toString()}\x1b[0m\n`);

    const codeWithState = await listenForCode(port);
    const [code, state] = codeWithState.split('#');
    
    const { verifier, projectId: stateProjectId } = JSON.parse(Buffer.from(state, 'base64').toString());

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
      throw new Error(`Failed to exchange Gemini code: ${response.status}`);
    }

    const json = await response.json() as any;
    
    let effectiveProjectId = stateProjectId;
    if (!effectiveProjectId) {
      effectiveProjectId = await this.fetchProjectID(json.access_token);
    }

    const userInfoResponse = await proxyFetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
      headers: {
        "Authorization": `Bearer ${json.access_token}`
      }
    });
    
    const userInfo = userInfoResponse.ok ? await userInfoResponse.json() as any : { email: 'unknown@google.com' };

    return {
      accessToken: json.access_token,
      refreshToken: `${json.refresh_token}|${effectiveProjectId || ""}`,
      expiryDate: Date.now() + (json.expires_in * 1000),
      tokenType: json.token_type || 'Bearer',
      email: userInfo.email,
      metadata: {
        projectId: effectiveProjectId
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
            if (part.type === 'image_url') return { text: '[Image]' };
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

  static async checkQuota(account: ManagedAccount): Promise<any> {
    const accessToken = account.tokens.accessToken;
    const projectId = account.metadata?.projectId || "";

    const response = await proxyFetch(`${ANTIGRAVITY_ENDPOINT_PROD}/v1internal:fetchAvailableModels`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": ANTIGRAVITY_HEADERS["User-Agent"],
      },
      body: JSON.stringify(projectId ? { project: projectId } : {}),
    });

    if (!response.ok) {
      throw new Error(`fetchAvailableModels failed: ${response.status}`);
    }

    const data = await response.json();

    // Update account quota state
    if (data.models) {
      account.quota = account.quota || { limit: 1000, remaining: 1000 };
      account.quota.modelSpecific = account.quota.modelSpecific || {};

      for (const [modelId, info] of Object.entries(data.models)) {
        const quotaInfo = (info as any).quotaInfo;
        if (quotaInfo) {
          account.quota.modelSpecific[modelId] = {
            limit: 100, // Assumption
            remaining: Math.floor((quotaInfo.remainingFraction || 0) * 100),
            resetTime: quotaInfo.resetTime ? Date.parse(quotaInfo.resetTime) : undefined
          };

          // Update global remaining as the minimum of all models
          account.quota.remaining = Math.min(account.quota.remaining, account.quota.modelSpecific[modelId].remaining);
        }
      }
    }

    return data;
  }
}
