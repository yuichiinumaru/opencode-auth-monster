"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const xdg_basedir_1 = require("xdg-basedir");
const types_1 = require("./types");
class ConfigManager {
    constructor(customPath) {
        this.configDir = customPath || path_1.default.join(xdg_basedir_1.xdgConfig || '', 'opencode');
        if (!fs_1.default.existsSync(this.configDir)) {
            fs_1.default.mkdirSync(this.configDir, { recursive: true });
        }
        this.configPath = path_1.default.join(this.configDir, 'auth-monster-config.json');
    }
    getConfigDir() {
        return this.configDir;
    }
    loadConfig() {
        if (!fs_1.default.existsSync(this.configPath)) {
            return types_1.AuthMonsterConfigSchema.parse({});
        }
        try {
            const data = fs_1.default.readFileSync(this.configPath, 'utf8');
            const parsed = JSON.parse(data);
            return types_1.AuthMonsterConfigSchema.parse(parsed);
        }
        catch (error) {
            console.error('Failed to load config, using defaults:', error);
            return types_1.AuthMonsterConfigSchema.parse({});
        }
    }
    saveConfig(config) {
        const dir = path_1.default.dirname(this.configPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    }
    setActiveProvider(provider) {
        const config = this.loadConfig();
        config.active = provider;
        this.saveConfig(config);
    }
}
exports.ConfigManager = ConfigManager;
