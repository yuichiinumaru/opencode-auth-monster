#!/usr/bin/env node
import { Command } from 'commander';
import { createAuthMonster } from './index';
import { ConfigManager } from './core/config';
import { StorageManager } from './core/storage';
import { AuthProvider, ManagedAccount, OAuthTokens } from './core/types';
import { extractQuota, getCooldownStatus } from './core/quota-manager';

 import { AnthropicProvider } from './providers/anthropic';
 import { GeminiProvider } from './providers/gemini';
 import { syncToGitHub } from './utils/github-sync';
 import { runOnboardingWizard } from './utils/wizard';
 
 async function main() {

  const configManager = new ConfigManager();
  const config = configManager.loadConfig();
  const storageManager = new StorageManager(configManager.getConfigDir());

  const monster = createAuthMonster({
    config,
    storagePath: configManager.getConfigDir()
  });

  const program = new Command();

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
      const authProvider = provider as AuthProvider;
      if (!Object.values(AuthProvider).includes(authProvider)) {
        console.error(`Invalid provider: ${provider}. Valid providers are: ${Object.values(AuthProvider).join(', ')}`);
        process.exit(1);
      }

      let accountEmail = email;
      let accountTokens: OAuthTokens = { accessToken: token || '' };
      let apiKey = authProvider === AuthProvider.Gemini ? token : undefined;
      let metadata = {};

      if (options.interactive) {
        if (authProvider === AuthProvider.Anthropic) {
          const result = await AnthropicProvider.login();
          accountTokens = result;
          // For Anthropic we don't always get email from OAuth response in console mode easily without extra calls
          // but let's assume we want user to provide it or we use 'interactive@anthropic'
          if (!accountEmail) {
            accountEmail = 'interactive@anthropic.com';
          }
        } else if (authProvider === AuthProvider.Gemini) {
          const result = await GeminiProvider.login();
          accountTokens = {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiryDate: result.expiryDate,
            tokenType: result.tokenType
          };
          accountEmail = result.email;
          metadata = result.metadata || {};
          apiKey = undefined; // Using OAuth
        } else {
          console.error(`Interactive login not supported for provider: ${provider}`);
          process.exit(1);
        }
      } else if (!email || !token) {
        console.error('Email and Token are required for non-interactive add.');
        process.exit(1);
      }

      const account: ManagedAccount = {
        id: Math.random().toString(36).substring(2, 11),
        email: accountEmail!,
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

        const quota = extractQuota(a);
        if (quota.remaining < 1000) {
           quotaInfo = `${quota.remaining.toFixed(1)}%`;
        }

        const cooldownStatus = getCooldownStatus(a.provider, a.id);
        if (cooldownStatus.active && cooldownStatus.until) {
          const minLeft = Math.ceil((cooldownStatus.until - Date.now()) / 60000);
          cooldown = `Cooldown (${minLeft}m)`;
        } else if (a.cooldownUntil && a.cooldownUntil > Date.now()) {
           const minLeft = Math.ceil((a.cooldownUntil - Date.now()) / 60000);
           cooldown = `Cooldown (${minLeft}m)`;
        } else if (!a.isHealthy) {
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
      const authProvider = provider as AuthProvider;
      if (!Object.values(AuthProvider).includes(authProvider)) {
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
      const authProvider = provider as AuthProvider;
      if (!Object.values(AuthProvider).includes(authProvider)) {
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
       } else {
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
          await syncToGitHub(repo, accounts);
        } catch (err: any) {
          // Error already logged in syncToGitHub
          process.exit(1);
        }
      });

    program.command('onboard')
      .alias('setup')
      .description('Run interactive onboarding wizard to add accounts')
      .action(async () => {
        await monster.init();
        await runOnboardingWizard(monster);
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
        } else {
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
          currentConfig.modelPriorities[model.toLowerCase()] = fallbacks.map((m: string) => m.toLowerCase());
          console.log(`Fallback chain for ${model}: ${fallbacks.join(' -> ')}`);
        } else {
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

    await program.parseAsync(process.argv);

}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
