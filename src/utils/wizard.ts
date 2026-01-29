import { AuthMonster } from '../index';
import { AuthProvider } from '../core/types';
import { ConfigManager } from '../core/config';
import { AnthropicProvider } from '../providers/anthropic';
import { GeminiProvider } from '../providers/gemini';
import { WindsurfProvider } from '../providers/windsurf';
import { cursorProvider } from '../providers/cursor';
import { autoDiscoverAccounts } from './extractor';

// enquirer types are sometimes missing or incompatible with ESM/TS named imports
const { MultiSelect, Confirm, Input } = require('enquirer');

export async function runOnboardingWizard(monster: AuthMonster) {
  const configManager = new ConfigManager();
  console.log("\n=== OpenCode Auth Monster Onboarding ===\n");

  const autoDetect = await new Confirm({
    message: 'Would you like to auto-detect local accounts (Cursor, Windsurf)?',
    initial: true
  }).run();

  if (autoDetect) {
    const discovered = await autoDiscoverAccounts();
    if (discovered.length > 0) {
      for (const account of discovered) {
        await monster.addAccount(account);
        console.log(`[Auto-detect] Added local ${account.provider} account.`);
      }
    } else {
      console.log("No local accounts detected.");
    }
  }

  const providersResponse = await new MultiSelect({
    name: 'providers',
    message: 'Which providers do you have accounts for?',
    choices: [
      { name: AuthProvider.Gemini, message: 'Gemini' },
      { name: AuthProvider.Anthropic, message: 'Anthropic' },
      { name: AuthProvider.Cursor, message: 'Cursor' },
      { name: AuthProvider.Windsurf, message: 'Windsurf' },
      { name: AuthProvider.OpenAI, message: 'OpenAI' },
      { name: AuthProvider.Qwen, message: 'Qwen' },
    ]
  }).run();

  if (providersResponse.length === 0) {
    console.log("No providers selected. Setup skipped.");
    return;
  }

  for (const provider of providersResponse) {
    let addAnother = true;
    while (addAnother) {
      const confirmAdd = await new Confirm({
        message: `Add account for ${provider}?`,
        initial: true
      }).run();

      if (confirmAdd) {
        try {
          if (provider === AuthProvider.Anthropic) {
            const tokens = await AnthropicProvider.login();
            await monster.addAccount({
              id: Math.random().toString(36).substring(2, 11),
              email: 'interactive@anthropic.com',
              provider: AuthProvider.Anthropic,
              tokens,
              isHealthy: true,
              healthScore: 100
            });
          } else if (provider === AuthProvider.Gemini) {
            const result = await GeminiProvider.login();
            await monster.addAccount({
              id: Math.random().toString(36).substring(2, 11),
              email: result.email,
              provider: AuthProvider.Gemini,
              tokens: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiryDate: result.expiryDate,
                tokenType: result.tokenType
              },
              metadata: result.metadata,
              isHealthy: true,
              healthScore: 100
            });
          } else if (provider === AuthProvider.Windsurf) {
             const account = await WindsurfProvider.discoverAccount();
              await monster.addAccount(account);
              console.log(`Discovered local Windsurf account: ${account.email}`);
          } else if (provider === AuthProvider.Cursor) {
             const account = await cursorProvider.discover();
             if (account) {
               await monster.addAccount(account);
               console.log(`Discovered local Cursor account.`);
             } else {
               console.log("Could not discover local Cursor account. Please ensure you are logged in to Cursor.");
             }
          } else {

            console.log(`Interactive login not yet implemented for ${provider}. Please use 'add' command manually.`);
            break;
          }
          
          console.log(`Successfully added ${provider} account.`);
        } catch (error: any) {
          console.error(`Failed to add ${provider} account: ${error.message}`);
        }

        addAnother = await new Confirm({
          message: `Would you like to add another account for ${provider}?`,
          initial: false
        }).run();
      } else {
        addAnother = false;
      }
    }
  }

  await monster.init(); // Reload accounts to be sure

  // --- Model Priority Configuration ---
  const configureFallbacks = await new Confirm({
    message: 'Would you like to configure model fallback priorities?',
    initial: false
  }).run();

  if (configureFallbacks) {
    let continueConfig = true;
    while (continueConfig) {
      const primaryModel = await new Input({
        message: 'Enter primary model name (e.g., claude-3-7-sonnet):',
        initial: 'claude-3-7-sonnet-20250219'
      }).run();

      const fallbackInput = await new Input({
        message: 'Enter fallback models (comma-separated, e.g., claude-3-5-sonnet, gemini-2.5-pro):'
      }).run();

      const fallbacks = fallbackInput.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);

      if (fallbacks.length > 0) {
        const config = configManager.loadConfig();
        if (!config.modelPriorities) config.modelPriorities = {};
        config.modelPriorities[primaryModel.toLowerCase()] = fallbacks.map((f: string) => f.toLowerCase());
        configManager.saveConfig(config);
        console.log(`Fallback chain saved for ${primaryModel}.`);
      } else {
        console.log("No fallbacks provided. Skipping.");
      }

      continueConfig = await new Confirm({
        message: 'Configure another model?',
        initial: false
      }).run();
    }
  }

  const accountsStatus = monster.getAllAccountsStatus();
  const healthyCount = accountsStatus.filter(a => a.isHealthy).length;
  const score = accountsStatus.length > 0 ? Math.round((healthyCount / accountsStatus.length) * 100) : 0;

  console.log(`\nAll accounts added! System health is ${score}. Configuration saved.`);
}
