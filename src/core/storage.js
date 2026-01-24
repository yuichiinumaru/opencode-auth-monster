"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const xdg_basedir_1 = require("xdg-basedir");
const proper_lockfile_1 = require("proper-lockfile");
class StorageManager {
    constructor(customPath) {
        const configDir = customPath || path_1.default.join(xdg_basedir_1.xdgConfig || '', 'opencode');
        if (!fs_1.default.existsSync(configDir)) {
            fs_1.default.mkdirSync(configDir, { recursive: true });
        }
        this.storagePath = path_1.default.join(configDir, 'auth-monster-accounts.json');
    }
    async loadAccounts() {
        if (!fs_1.default.existsSync(this.storagePath)) {
            return [];
        }
        try {
            const release = await (0, proper_lockfile_1.lock)(this.storagePath, { retries: 5 });
            try {
                const data = fs_1.default.readFileSync(this.storagePath, 'utf8');
                return JSON.parse(data);
            }
            finally {
                await release();
            }
        }
        catch (error) {
            console.error('Failed to load accounts:', error);
            return [];
        }
    }
    async saveAccounts(accounts) {
        const dir = path_1.default.dirname(this.storagePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        // Ensure file exists for locking
        if (!fs_1.default.existsSync(this.storagePath)) {
            fs_1.default.writeFileSync(this.storagePath, '[]', 'utf8');
        }
        try {
            const release = await (0, proper_lockfile_1.lock)(this.storagePath, { retries: 5 });
            try {
                fs_1.default.writeFileSync(this.storagePath, JSON.stringify(accounts, null, 2), 'utf8');
            }
            finally {
                await release();
            }
        }
        catch (error) {
            console.error('Failed to save accounts:', error);
            throw error;
        }
    }
    async addAccount(account) {
        const accounts = await this.loadAccounts();
        const index = accounts.findIndex(a => a.id === account.id || (a.email === account.email && a.provider === account.provider));
        if (index >= 0) {
            accounts[index] = { ...accounts[index], ...account };
        }
        else {
            accounts.push(account);
        }
        await this.saveAccounts(accounts);
    }
    async deleteAccount(id) {
        const accounts = await this.loadAccounts();
        const filtered = accounts.filter(a => a.id !== id);
        if (accounts.length !== filtered.length) {
            await this.saveAccounts(filtered);
        }
    }
    async getAccountsByProvider(provider) {
        const accounts = await this.loadAccounts();
        return accounts.filter(a => a.provider === provider);
    }
}
exports.StorageManager = StorageManager;
