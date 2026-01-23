import fs from 'fs';
import path from 'path';
import { xdgConfig } from 'xdg-basedir';
import { lock } from 'proper-lockfile';
import { ManagedAccount, AuthProvider } from './types';

export class StorageManager {
  private storagePath: string;

  constructor(customPath?: string) {
    const configDir = customPath || path.join(xdgConfig || '', 'opencode');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.storagePath = path.join(configDir, 'auth-monster-accounts.json');
  }

  async loadAccounts(): Promise<ManagedAccount[]> {
    if (!fs.existsSync(this.storagePath)) {
      return [];
    }

    try {
      const release = await lock(this.storagePath, { retries: 5 });
      try {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        return JSON.parse(data);
      } finally {
        await release();
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      return [];
    }
  }

  async saveAccounts(accounts: ManagedAccount[]): Promise<void> {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Ensure file exists for locking
    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, '[]', 'utf8');
    }

    try {
      const release = await lock(this.storagePath, { retries: 5 });
      try {
        fs.writeFileSync(this.storagePath, JSON.stringify(accounts, null, 2), 'utf8');
      } finally {
        await release();
      }
    } catch (error) {
      console.error('Failed to save accounts:', error);
      throw error;
    }
  }

  async addAccount(account: ManagedAccount): Promise<void> {
    const accounts = await this.loadAccounts();
    const index = accounts.findIndex(a => a.id === account.id || (a.email === account.email && a.provider === account.provider));
    
    if (index >= 0) {
      accounts[index] = { ...accounts[index], ...account };
    } else {
      accounts.push(account);
    }
    
    await this.saveAccounts(accounts);
  }

  async deleteAccount(id: string): Promise<void> {
    const accounts = await this.loadAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    if (accounts.length !== filtered.length) {
      await this.saveAccounts(filtered);
    }
  }

  async getAccountsByProvider(provider: AuthProvider): Promise<ManagedAccount[]> {
    const accounts = await this.loadAccounts();
    return accounts.filter(a => a.provider === provider);
  }
}
