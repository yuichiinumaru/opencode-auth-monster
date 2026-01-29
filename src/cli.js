#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const index_1 = require("./index");
const config_1 = require("./core/config");
const storage_1 = require("./core/storage");
const types_1 = require("./core/types");
const quota_manager_1 = require("./core/quota-manager");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const anthropic_1 = require("./providers/anthropic");
const gemini_1 = require("./providers/gemini");
const github_sync_1 = require("./utils/github-sync");
const wizard_1 = require("./utils/wizard");
const dialectics_1 = require("./core/dialectics");
const endpoints_1 = require("./core/endpoints");
const child_process_1 = require("child_process");
async function main() {
    const configManager = new config_1.ConfigManager();
    const config = configManager.loadConfig();
    const storageManager = new storage_1.StorageManager(configManager.getConfigDir());
    const monster = (0, index_1.createAuthMonster)({
        config,
        storagePath: configManager.getConfigDir()
    });
    const program = new commander_1.Command();
    program
        .name('opencode-monster')
        .description('CLI for OpenCode Auth Monster')
        .version('1.0.0');
    program.command('list')
        .description('List all accounts, their providers, emails, and health scores')
        .action(async () => {
        await monster.init();
        const accounts = monster.getAllAccountsStatus();
        if (accounts.length === 0) {
            console.log('No accounts found.');
            return;
        }
        console.table(accounts.map(a => ({
            id: a.id,
            provider: a.provider,
            email: a.email,
            isHealthy: a.isHealthy,
            healthScore: a.healthScore
        })));
    });
    program.command('add')
        .description('Add a new account')
        .argument('<provider>', 'Provider (e.g., gemini, anthropic, cursor, etc.)')
        .argument('[email]', 'Account email')
        .argument('[token]', 'API Key or Access Token')
        .option('-i, --interactive', 'Use interactive OAuth login')
        .action(async (provider, email, token, options) => {
        const authProvider = provider;
        if (!Object.values(types_1.AuthProvider).includes(authProvider)) {
            console.error(`Invalid provider: ${provider}. Valid providers are: ${Object.values(types_1.AuthProvider).join(', ')}`);
            process.exit(1);
        }
        let accountEmail = email;
        let accountTokens = { accessToken: token || '' };
        let apiKey = authProvider === types_1.AuthProvider.Gemini ? token : undefined;
        let metadata = {};
        if (options.interactive) {
            if (authProvider === types_1.AuthProvider.Anthropic) {
                const result = await anthropic_1.AnthropicProvider.login();
                accountTokens = result;
                // For Anthropic we don't always get email from OAuth response in console mode easily without extra calls
                // but let's assume we want user to provide it or we use 'interactive@anthropic'
                if (!accountEmail) {
                    accountEmail = 'interactive@anthropic.com';
                }
            }
            else if (authProvider === types_1.AuthProvider.Gemini) {
                const result = await gemini_1.GeminiProvider.login();
                accountTokens = {
                    accessToken: result.accessToken,
                    refreshToken: result.refreshToken,
                    expiryDate: result.expiryDate,
                    tokenType: result.tokenType
                };
                accountEmail = result.email;
                metadata = result.metadata || {};
                apiKey = undefined; // Using OAuth
            }
            else {
                console.error(`Interactive login not supported for provider: ${provider}`);
                process.exit(1);
            }
        }
        else if (!email || !token) {
            console.error('Email and Token are required for non-interactive add.');
            process.exit(1);
        }
        const account = {
            id: Math.random().toString(36).substring(2, 11),
            email: accountEmail,
            provider: authProvider,
            tokens: accountTokens,
            apiKey,
            metadata,
            isHealthy: true,
            healthScore: 100
        };
        await monster.addAccount(account);
        console.log(`Account added successfully: ${accountEmail} (${provider})`);
    });
    program.command('delete')
        .description('Remove an account')
        .argument('<id>', 'Account ID')
        .action(async (id) => {
        await monster.deleteAccount(id);
        console.log(`Account ${id} deleted.`);
    });
    program.command('status')
        .description('Show general system health and current active provider')
        .action(async () => {
        console.log(`\n=== System Status ===`);
        console.log(`Active Provider: ${config.active}`);
        console.log(`Fallback Providers: ${config.fallback.join(', ') || 'None'}`);
        console.log(`Rotation Method: ${config.method}`);
        const accounts = await storageManager.loadAccounts();
        const healthyCount = accounts.filter(a => a.isHealthy).length;
        console.log(`Total Accounts: ${accounts.length}`);
        console.log(`Healthy Accounts: ${healthyCount}`);
    });
    program.command('quota')
        .description('Show detailed quota usage for all accounts')
        .action(async () => {
        const accounts = await storageManager.loadAccounts();
        if (accounts.length === 0) {
            console.log('No accounts found.');
            return;
        }
        console.log('\n=== Quota Usage ===\n');
        const tableData = accounts.map(a => {
            let quotaInfo = 'Unlimited';
            let cooldown = 'Active';
            const quota = (0, quota_manager_1.extractQuota)(a);
            if (quota.remaining < 1000) {
                quotaInfo = `${quota.remaining.toFixed(1)}%`;
            }
            const cooldownStatus = (0, quota_manager_1.getCooldownStatus)(a.provider, a.id);
            if (cooldownStatus.active && cooldownStatus.until) {
                const minLeft = Math.ceil((cooldownStatus.until - Date.now()) / 60000);
                cooldown = `Cooldown (${minLeft}m)`;
            }
            else if (a.cooldownUntil && a.cooldownUntil > Date.now()) {
                const minLeft = Math.ceil((a.cooldownUntil - Date.now()) / 60000);
                cooldown = `Cooldown (${minLeft}m)`;
            }
            else if (!a.isHealthy) {
                cooldown = 'Unhealthy';
            }
            return {
                ID: a.id.substring(0, 8),
                Provider: a.provider,
                Email: a.email,
                Quota: quotaInfo,
                Status: cooldown
            };
        });
        console.table(tableData);
    });
    program.command('switch')
        .description('Change the active provider in the config')
        .argument('<provider>', 'Provider to switch to')
        .action(async (provider) => {
        const authProvider = provider;
        if (!Object.values(types_1.AuthProvider).includes(authProvider)) {
            console.error(`Invalid provider: ${provider}`);
            process.exit(1);
        }
        configManager.setActiveProvider(authProvider);
        console.log(`Switched active provider to: ${provider}`);
    });
    program.command('test')
        .description('Attempt to get auth details for a provider and report if it works')
        .argument('<provider>', 'Provider to test')
        .action(async (provider) => {
        const authProvider = provider;
        if (!Object.values(types_1.AuthProvider).includes(authProvider)) {
            console.error(`Invalid provider: ${provider}`);
            process.exit(1);
        }
        await monster.init();
        const details = await monster.getAuthDetails(authProvider);
        if (details) {
            console.log(`Success! Found working account for ${provider}:`);
            console.log(`Email: ${details.account.email}`);
            console.log(`ID: ${details.account.id}`);
            console.log(`Headers:`, details.headers);
        }
        else {
            console.log(`Failed to find a working account for ${provider}.`);
        }
    });
    program.command('sync')
        .description('Sync all accounts to a GitHub repository secrets')
        .argument('<repo>', 'Target repository (owner/repo)')
        .action(async (repo) => {
        await monster.init();
        const accounts = monster.getAccounts();
        if (accounts.length === 0) {
            console.log('No accounts to sync.');
            return;
        }
        try {
            await (0, github_sync_1.syncToGitHub)(repo, accounts);
        }
        catch (err) {
            // Error already logged in syncToGitHub
            process.exit(1);
        }
    });
    program.command('onboard')
        .alias('setup')
        .description('Run interactive onboarding wizard to add accounts')
        .action(async () => {
        await monster.init();
        await (0, wizard_1.runOnboardingWizard)(monster);
    });
    program.command('proxy')
        .description('Set or view persistent proxy URL')
        .argument('[url]', 'Proxy URL (e.g., http://user:pass@host:port or socks5://host:port). Pass "none" to disable.')
        .action(async (url) => {
        const currentConfig = configManager.loadConfig();
        if (!url) {
            console.log(`Current proxy: ${currentConfig.proxy || 'None'}`);
            return;
        }
        if (url.toLowerCase() === 'none') {
            currentConfig.proxy = undefined;
            configManager.saveConfig(currentConfig);
            console.log('Proxy disabled.');
        }
        else {
            currentConfig.proxy = url;
            configManager.saveConfig(currentConfig);
            console.log(`Proxy set to: ${url}`);
        }
    });
    program.command('fallback')
        .description('Configure dynamic model fallbacks')
        .argument('<model>', 'The primary model name')
        .argument('[fallbacks...]', 'Ordered list of fallback models')
        .option('--direction <up|down>', 'Fallback direction: up (smarter first) or down (cheaper first)', 'down')
        .action(async (model, fallbacks, options) => {
        const currentConfig = configManager.loadConfig();
        if (!currentConfig.modelPriorities) {
            currentConfig.modelPriorities = {};
        }
        if (fallbacks && fallbacks.length > 0) {
            currentConfig.modelPriorities[model.toLowerCase()] = fallbacks.map((m) => m.toLowerCase());
            console.log(`Fallback chain for ${model}: ${fallbacks.join(' -> ')}`);
        }
        else {
            delete currentConfig.modelPriorities[model.toLowerCase()];
            console.log(`Cleared fallbacks for ${model}`);
        }
        if (options.direction) {
            currentConfig.fallbackDirection = options.direction;
            console.log(`Fallback direction set to: ${options.direction}`);
        }
        configManager.saveConfig(currentConfig);
        console.log('Configuration updated.');
    });
    program.command('dialectics')
        .description('Run a dialectics session: split prompt between two models and synthesize.')
        .argument('<prompt>', 'The prompt to process')
        .option('-a, --model-a <model>', 'First model', 'gemini-3-flash-preview')
        .option('-b, --model-b <model>', 'Second model', 'claude-3-7-sonnet-20250219')
        .option('-s, --synthesizer <model>', 'Synthesizer model', 'gemini-3-pro-preview')
        .action(async (prompt, options) => {
        await monster.init();
        const engine = new dialectics_1.DialecticsEngine(monster);
        try {
            const result = await engine.synthesize(prompt, options.modelA, options.modelB, options.synthesizer);
            console.log('\n=== Synthesis Result ===\n');
            console.log(result);
        }
        catch (error) {
            console.error('Dialectics failed:', error);
            process.exit(1);
        }
    });
    program.command('install-hook')
        .description('Install the prepare-commit-msg git hook')
        .action(() => {
        const gitDir = path.resolve(process.cwd(), '.git');
        if (!fs.existsSync(gitDir)) {
            console.error('Error: .git directory not found. Are you in a git repository?');
            process.exit(1);
        }
        const hooksDir = path.join(gitDir, 'hooks');
        if (!fs.existsSync(hooksDir)) {
            fs.mkdirSync(hooksDir, { recursive: true });
        }
        const hookPath = path.join(hooksDir, 'prepare-commit-msg');
        // Determine path to the script
        const isTs = __filename.endsWith('.ts');
        let scriptPath;
        let runner;
        if (isTs) {
            scriptPath = path.resolve(__dirname, 'scripts/git-hook.ts');
            runner = 'npx ts-node';
        }
        else {
            scriptPath = path.resolve(__dirname, 'scripts/git-hook.js');
            runner = 'node';
        }
        const hookContent = `#!/bin/sh
# OpenCode Auth Monster Hook
${runner} "${scriptPath}" "$@"
`;
        fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
        console.log(`Hook installed at ${hookPath}`);
    });
    program.command('review')
        .description('Perform a code review on a file or git diff')
        .argument('[file]', 'File to review (if omitted, reviews staged git diff)')
        .option('-m, --model <model>', 'Model to use', 'claude-4.5-opus-thinking')
        .action(async (file, options) => {
        await monster.init();
        let content = '';
        if (file) {
            try {
                content = fs.readFileSync(file, 'utf-8');
            }
            catch (e) {
                console.error(`Could not read file: ${file}`);
                process.exit(1);
            }
        }
        else {
            try {
                content = (0, child_process_1.execSync)('git diff --cached').toString();
                if (!content.trim()) {
                    console.log('No staged changes to review.');
                    return;
                }
            }
            catch (e) {
                console.error('Error getting git diff. Are you in a git repo?');
                process.exit(1);
            }
        }
        const prompt = `Please review the following code changes.
          Focus on:
          1. Bugs and potential runtime errors.
          2. Security vulnerabilities.
          3. Code style and best practices.
          4. Performance improvements.

          Code/Diff:
          ${content.substring(0, 10000)}
          `;
        const details = await monster.getAuthDetails(options.model);
        if (!details) {
            console.error(`Could not resolve model: ${options.model}`);
            process.exit(1);
        }
        const url = (0, endpoints_1.getProviderEndpoint)(details.provider, details.account, details.modelInProvider);
        console.log(`Reviewing with ${options.model}...`);
        try {
            const response = await monster.request(options.model, url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    messages: [{ role: 'user', content: prompt }],
                    model: details.modelInProvider,
                    temperature: 0.2
                }
            });
            const json = await response.json();
            let review = '';
            if (details.provider === types_1.AuthProvider.Gemini) {
                review = json.candidates?.[0]?.content?.parts?.[0]?.text;
            }
            else if (details.provider === types_1.AuthProvider.Anthropic) {
                review = json.content?.[0]?.text;
            }
            else {
                review = json.choices?.[0]?.message?.content;
            }
            console.log('\n=== Code Review ===\n');
            console.log(review || 'No review generated or error parsing response.');
        }
        catch (error) {
            console.error('Review failed:', error);
        }
    });
    await program.parseAsync(process.argv);
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
