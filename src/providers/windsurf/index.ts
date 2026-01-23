import { AuthProvider, ManagedAccount } from '../../core/types';
import { getCredentials, WindsurfCredentials } from './auth';

export class WindsurfProvider {
  static readonly provider = AuthProvider.Windsurf;

  static getHeaders(account: ManagedAccount): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/grpc',
    };

    if (account.metadata?.csrfToken) {
      headers['x-codeium-csrf-token'] = account.metadata.csrfToken;
    }

    return headers;
  }

  static async refreshTokens(account: ManagedAccount): Promise<ManagedAccount> {
    try {
      // Re-discover credentials
      const credentials = getCredentials();
      
      // Update account with new credentials
      return {
        ...account,
        apiKey: credentials.apiKey,
        metadata: {
          ...account.metadata,
          csrfToken: credentials.csrfToken,
          port: credentials.port,
          version: credentials.version,
          lastRefreshed: Date.now()
        },
        isHealthy: true
      };
    } catch (error) {
      console.error('Failed to refresh Windsurf credentials:', error);
      return {
        ...account,
        isHealthy: false,
        lastSwitchReason: error instanceof Error ? error.message : 'Unknown error during refresh'
      };
    }
  }
  
  // Helper to initialize a new account from environment
  static async discoverAccount(): Promise<ManagedAccount> {
      const credentials = getCredentials();
      return {
          id: `windsurf-local-${Date.now()}`,
          email: 'local@windsurf',
          provider: AuthProvider.Windsurf,
          tokens: { accessToken: credentials.apiKey }, // Use API key as access token placeholder
          apiKey: credentials.apiKey,
          metadata: {
              csrfToken: credentials.csrfToken,
              port: credentials.port,
              version: credentials.version
          },
          isHealthy: true
      };
  }
}

export * from './grpc-client';
export * from './auth';
export * from './types';
export * from './models';
