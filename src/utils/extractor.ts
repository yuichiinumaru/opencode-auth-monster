import { execSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { AuthProvider, ManagedAccount } from '../core/types';

export interface ExtractedToken {
  provider: AuthProvider;
  token: string;
  email?: string;
}

export class TokenExtractor {

  /**
   * Auto-discover accounts from local environment (Cursor, Windsurf, Env Vars).
   */
  static async discoverAll(): Promise<ManagedAccount[]> {
    const accounts: ManagedAccount[] = [];

    // 1. Cursor (Keychain)
    try {
      const cursorToken = this.getCursorToken();
      if (cursorToken) {
        accounts.push({
          id: 'cursor-local',
          email: 'local-cursor@device',
          provider: AuthProvider.Cursor,
          tokens: { accessToken: cursorToken },
          isHealthy: true,
          healthScore: 100,
          metadata: { source: 'keychain' }
        });
      }
    } catch (e) {
      // Ignore missing cursor
    }

    // 2. Windsurf (SQLite)
    try {
      const windsurfAuth = this.getWindsurfAuth();
      if (windsurfAuth) {
        accounts.push({
          id: 'windsurf-local',
          email: 'local-windsurf@device',
          provider: AuthProvider.Windsurf,
          tokens: { accessToken: windsurfAuth },
          isHealthy: true,
          healthScore: 100,
          metadata: { source: 'sqlite' }
        });
      }
    } catch (e) {
      // Ignore missing windsurf
    }

    // 3. Qwen (File)
    try {
        const qwenToken = this.getQwenToken();
        if (qwenToken) {
            accounts.push({
                id: 'qwen-local',
                email: 'local-qwen@device',
                provider: AuthProvider.Qwen,
                tokens: { accessToken: qwenToken },
                isHealthy: true,
                healthScore: 100,
                metadata: { source: 'file' }
            });
        }
    } catch (e) {
        // Ignore missing qwen
    }

    return accounts;
  }

  /**
   * Extract Cursor token from macOS Keychain.
   */
  private static getCursorToken(): string | null {
    if (process.platform !== 'darwin') return null;
    try {
      return execSync('security find-generic-password -s "cursor-access-token" -w', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract Windsurf auth status from SQLite DB.
   */
  private static getWindsurfAuth(): string | null {
    const home = os.homedir();
    // Common path on macOS/Linux
    const dbPath = path.join(home, 'Library/Application Support/Windsurf/User/globalStorage/state.vscdb');
    
    if (!fs.existsSync(dbPath)) return null;

    try {
      // Query SQLite directly
      const query = "SELECT value FROM ItemTable WHERE key = 'windsurfAuthStatus';";
      const result = execSync(`sqlite3 "${dbPath}" "${query}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      if (!result) return null;

      // Parse JSON result to get access token
      const json = JSON.parse(result);
      return json.accessToken || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract Qwen token from local creds file.
   */
  private static getQwenToken(): string | null {
      const home = os.homedir();
      const credsPath = path.join(home, '.qwen/oauth_creds.json');

      if (!fs.existsSync(credsPath)) return null;

      try {
          const data = fs.readFileSync(credsPath, 'utf8');
          const json = JSON.parse(data);
          return json.access_token || null;
      } catch (e) {
          return null;
      }
  }
}

// Export for direct usage
export const autoDiscoverAccounts = () => TokenExtractor.discoverAll();
