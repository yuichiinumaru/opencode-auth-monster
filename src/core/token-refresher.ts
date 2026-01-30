import { ManagedAccount, AuthProvider } from './types';
import { proxyFetch } from './proxy';

export class TokenRefresher {

  /**
   * Checks if an account's token is near expiry and refreshes it if possible.
   * Returns true if refresh was successful or not needed, false if failed.
   */
  static async refreshIfNeeded(account: ManagedAccount): Promise<boolean> {
    if (!account.tokens || !account.tokens.refreshToken) {
        return true; // Nothing to refresh
    }

    // Default expiry buffer: 5 minutes
    const now = Date.now();
    const expiry = account.tokens.expiryDate || 0;

    // If not expired or close to expiry, no need to refresh
    if (expiry > now + 5 * 60 * 1000) {
        return true;
    }

    console.log(`[TokenRefresher] Refreshing token for ${account.email} (${account.provider})...`);

    try {
        const newTokens = await this.performRefresh(account.provider, account.tokens.refreshToken);

        if (newTokens) {
            account.tokens.accessToken = newTokens.accessToken;
            if (newTokens.refreshToken) account.tokens.refreshToken = newTokens.refreshToken;
            if (newTokens.expiryDate) account.tokens.expiryDate = newTokens.expiryDate;
            // Persist logic should happen in the caller (AuthMonster) after this returns true
            return true;
        }
    } catch (error) {
        console.error(`[TokenRefresher] Failed to refresh ${account.email}:`, error);
        return false;
    }

    return false;
  }

  private static async performRefresh(provider: AuthProvider, refreshToken: string): Promise<any> {
    switch (provider) {
        case AuthProvider.Gemini:
            return this.refreshGoogle(refreshToken);
        // Add other OAuth providers here (Microsoft/Azure, etc.)
        default:
            throw new Error(`Refresh not implemented for provider ${provider}`);
    }
  }

  private static async refreshGoogle(refreshToken: string): Promise<any> {
      // This requires client ID/Secret. In a real CLI app, these might be baked in
      // or provided via env vars. For the "Mark VI" suite, we assume env vars.
      const clientId = process.env.GEMINI_CLIENT_ID;
      const clientSecret = process.env.GEMINI_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
          throw new Error("Missing GEMINI_CLIENT_ID or GEMINI_CLIENT_SECRET env vars");
      }

      const response = await proxyFetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              grant_type: "refresh_token"
          }).toString()
      });

      if (!response.ok) {
          const text = await response.text();
          throw new Error(`Google refresh failed: ${response.status} ${text}`);
      }

      const data = await response.json();
      return {
          accessToken: data.access_token,
          // Google doesn't always rotate refresh tokens, but if they do, capture it
          refreshToken: data.refresh_token,
          expiryDate: Date.now() + (data.expires_in * 1000)
      };
  }
}
