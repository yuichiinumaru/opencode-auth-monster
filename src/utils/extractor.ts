import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { AuthProvider, ManagedAccount } from '../core/types';

/**
 * Utility to extract tokens from local application storage
 */
export class TokenExtractor {
  /**
   * Extract Cursor tokens from macOS Keychain
   */
  static extractCursorFromKeychain(): { accessToken: string; refreshToken?: string } | null {
    if (process.platform !== 'darwin') return null;

    try {
      // Use security tool to find generic password
      // -s: service name
      // -w: display only the password
      const accessToken = execSync('security find-generic-password -s "cursor-access-token" -w', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      let refreshToken: string | undefined;
      try {
        refreshToken = execSync('security find-generic-password -s "cursor-refresh-token" -w', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
      } catch (e) {
        // Refresh token might not be present if not logged in fully or different version
      }

      if (accessToken) {
        return { accessToken, refreshToken };
      }
    } catch (e) {
      // Failed to extract from keychain or not found
    }
    return null;
  }

  /**
   * Extract tokens from a VS Code-like SQLite state database
   */
  static extractFromSQLite(statePath: string, key: string): string | null {
    if (!fs.existsSync(statePath)) return null;

    try {
      // Direct SQL query on ItemTable
      const query = `SELECT value FROM ItemTable WHERE key = '${key}';`;
      const result = execSync(`sqlite3 "${statePath}" "${query}"`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      return result || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract Cursor tokens from SQLite (Fallback for macOS or primary for Linux)
   */
  static extractCursorFromSQLite(): { accessToken: string; refreshToken?: string } | null {
    const paths = {
      darwin: path.join(os.homedir(), 'Library/Application Support/Cursor/User/globalStorage/state.vscdb'),
      linux: path.join(os.homedir(), '.config/Cursor/User/globalStorage/state.vscdb'),
      win32: path.join(os.homedir(), 'AppData/Roaming/Cursor/User/globalStorage/state.vscdb'),
    };

    const statePath = paths[process.platform as keyof typeof paths];
    if (!statePath) return null;

    const accessToken = this.extractFromSQLite(statePath, 'cursor::accessToken');
    // Refresh token might not be in SQLite or under different key
    
    if (accessToken) {
      return { accessToken };
    }
    return null;
  }

  /**
   * Extract Windsurf API key from SQLite database
   */
  static extractWindsurfFromSQLite(): string | null {
    const paths = {
      darwin: path.join(os.homedir(), 'Library/Application Support/Windsurf/User/globalStorage/state.vscdb'),
      linux: path.join(os.homedir(), '.config/Windsurf/User/globalStorage/state.vscdb'),
      win32: path.join(os.homedir(), 'AppData/Roaming/Windsurf/User/globalStorage/state.vscdb'),
    };

    const statePath = paths[process.platform as keyof typeof paths];
    if (!statePath) return null;

    const result = this.extractFromSQLite(statePath, 'windsurfAuthStatus');
    if (result) {
      try {
        const parsed = JSON.parse(result);
        return parsed.apiKey || null;
      } catch (e) {
        // Some versions might store it differently
        return result;
      }
    }
    return null;
  }
}

/**
 * Unified discovery function that scans for all supported local accounts
 */
export async function autoDiscoverAccounts(): Promise<ManagedAccount[]> {
  const accounts: ManagedAccount[] = [];

  // --- Discover Cursor ---
  let cursorData = TokenExtractor.extractCursorFromKeychain();
  if (!cursorData) {
    cursorData = TokenExtractor.extractCursorFromSQLite();
  }

  if (cursorData) {
    accounts.push({
      id: `cursor-local`,
      email: 'local@cursor',
      provider: AuthProvider.Cursor,
      tokens: {
        accessToken: cursorData.accessToken,
        refreshToken: cursorData.refreshToken,
      },
      isHealthy: true,
      metadata: {
        discoveredAt: Date.now(),
        method: cursorData.refreshToken ? 'keychain' : 'sqlite'
      }
    });
  }

  // --- Discover Windsurf ---
  const windsurfApiKey = TokenExtractor.extractWindsurfFromSQLite();
  if (windsurfApiKey) {
    accounts.push({
      id: `windsurf-local`,
      email: 'local@windsurf',
      provider: AuthProvider.Windsurf,
      tokens: {
        accessToken: windsurfApiKey,
      },
      apiKey: windsurfApiKey,
      isHealthy: true,
      metadata: {
        discoveredAt: Date.now(),
        method: 'sqlite'
      }
    });
  }

  return accounts;
}
