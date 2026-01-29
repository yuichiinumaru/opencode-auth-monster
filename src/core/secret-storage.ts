import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SecretStorage {
  private useKeychain: boolean;
  private storagePath: string;

  constructor(storageDir: string) {
    this.storagePath = path.join(storageDir, 'auth-monster-secrets.json');
    this.useKeychain = os.platform() === 'darwin';
  }

  async saveSecret(service: string, account: string, secret: string): Promise<void> {
    if (this.useKeychain) {
      try {
        // macOS Keychain
        // security add-generic-password -a "account" -s "service" -w "secret" -U
        // -U updates if exists
        await execAsync(`security add-generic-password -a "${account}" -s "${service}" -w "${secret}" -U`);
        return;
      } catch (e) {
        console.warn('Failed to save to keychain, falling back to file:', e);
      }
    }

    // Fallback: Encrypted file (mock encryption for now, or simple obfuscation)
    await this.saveToFile(service, account, secret);
  }

  async getSecret(service: string, account: string): Promise<string | null> {
    if (this.useKeychain) {
      try {
        // security find-generic-password -a "account" -s "service" -w
        const { stdout } = await execAsync(`security find-generic-password -a "${account}" -s "${service}" -w`);
        return stdout.trim();
      } catch (e) {
        // Not found or error
      }
    }

    return this.getFromFile(service, account);
  }

  async deleteSecret(service: string, account: string): Promise<void> {
    if (this.useKeychain) {
      try {
        await execAsync(`security delete-generic-password -a "${account}" -s "${service}"`);
      } catch (e) {}
    }
    await this.deleteFromFile(service, account);
  }

  // Simple file-based fallback
  private async saveToFile(service: string, account: string, secret: string) {
    let data: Record<string, string> = {};
    if (fs.existsSync(this.storagePath)) {
      try {
          data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
      } catch(e) {}
    }
    const key = `${service}:${account}`;
    data[key] = Buffer.from(secret).toString('base64'); // Simple obfuscation
    fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  private async getFromFile(service: string, account: string): Promise<string | null> {
    if (!fs.existsSync(this.storagePath)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
        const key = `${service}:${account}`;
        if (data[key]) {
          return Buffer.from(data[key], 'base64').toString('utf8');
        }
    } catch (e) {}
    return null;
  }

  private async deleteFromFile(service: string, account: string) {
    if (!fs.existsSync(this.storagePath)) return;
    try {
        const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
        const key = `${service}:${account}`;
        if (data[key]) {
          delete data[key];
          fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), { mode: 0o600 });
        }
    } catch (e) {}
  }
}
