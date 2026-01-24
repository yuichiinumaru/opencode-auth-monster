"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOnboardingWizard = runOnboardingWizard;
const types_1 = require("../core/types");
const anthropic_1 = require("../providers/anthropic");
const gemini_1 = require("../providers/gemini");
const windsurf_1 = require("../providers/windsurf");
const cursor_1 = require("../providers/cursor");
const extractor_1 = require("./extractor");
// enquirer types are sometimes missing or incompatible with ESM/TS named imports
const { MultiSelect, Confirm } = require('enquirer');
async function runOnboardingWizard(monster) {
    console.log("\n=== OpenCode Auth Monster Onboarding ===\n");
    const autoDetect = await new Confirm({
        message: 'Would you like to auto-detect local accounts (Cursor, Windsurf)?',
        initial: true
    }).run();
    if (autoDetect) {
        const discovered = await (0, extractor_1.autoDiscoverAccounts)();
        if (discovered.length > 0) {
            for (const account of discovered) {
                await monster.addAccount(account);
                console.log(`[Auto-detect] Added local ${account.provider} account.`);
            }
        }
        else {
            console.log("No local accounts detected.");
        }
    }
    const providersResponse = await new MultiSelect({
        name: 'providers',
        message: 'Which providers do you have accounts for?',
        choices: [
            { name: types_1.AuthProvider.Gemini, message: 'Gemini' },
            { name: types_1.AuthProvider.Anthropic, message: 'Anthropic' },
            { name: types_1.AuthProvider.Cursor, message: 'Cursor' },
            { name: types_1.AuthProvider.Windsurf, message: 'Windsurf' },
            { name: types_1.AuthProvider.OpenAI, message: 'OpenAI' },
            { name: types_1.AuthProvider.Qwen, message: 'Qwen' },
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
                    if (provider === types_1.AuthProvider.Anthropic) {
                        const tokens = await anthropic_1.AnthropicProvider.login();
                        await monster.addAccount({
                            id: Math.random().toString(36).substring(2, 11),
                            email: 'interactive@anthropic.com',
                            provider: types_1.AuthProvider.Anthropic,
                            tokens,
                            isHealthy: true,
                            healthScore: 100
                        });
                    }
                    else if (provider === types_1.AuthProvider.Gemini) {
                        const result = await gemini_1.GeminiProvider.login();
                        await monster.addAccount({
                            id: Math.random().toString(36).substring(2, 11),
                            email: result.email,
                            provider: types_1.AuthProvider.Gemini,
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
                    }
                    else if (provider === types_1.AuthProvider.Windsurf) {
                        const account = await windsurf_1.WindsurfProvider.discoverAccount();
                        await monster.addAccount(account);
                        console.log(`Discovered local Windsurf account: ${account.email}`);
                    }
                    else if (provider === types_1.AuthProvider.Cursor) {
                        const account = await cursor_1.cursorProvider.discover();
                        if (account) {
                            await monster.addAccount(account);
                            console.log(`Discovered local Cursor account.`);
                        }
                        else {
                            console.log("Could not discover local Cursor account. Please ensure you are logged in to Cursor.");
                        }
                    }
                    else {
                        console.log(`Interactive login not yet implemented for ${provider}. Please use 'add' command manually.`);
                        break;
                    }
                    console.log(`Successfully added ${provider} account.`);
                }
                catch (error) {
                    console.error(`Failed to add ${provider} account: ${error.message}`);
                }
                addAnother = await new Confirm({
                    message: `Would you like to add another account for ${provider}?`,
                    initial: false
                }).run();
            }
            else {
                addAnother = false;
            }
        }
    }
    await monster.init(); // Reload accounts to be sure
    const accountsStatus = monster.getAllAccountsStatus();
    const healthyCount = accountsStatus.filter(a => a.isHealthy).length;
    const score = accountsStatus.length > 0 ? Math.round((healthyCount / accountsStatus.length) * 100) : 0;
    console.log(`\nAll accounts added! System health is ${score}. Configuration saved.`);
}
