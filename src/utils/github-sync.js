"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncToGitHub = syncToGitHub;
const child_process_1 = require("child_process");
/**
 * Syncs accounts to GitHub secrets for a target repository.
 * Standardizes the secret name as OPENCODE_MONSTER_ACCOUNTS.
 *
 * @param repo Repository in 'owner/repo' format.
 * @param accounts List of managed accounts to sync.
 */
async function syncToGitHub(repo, accounts) {
    try {
        // Check if gh CLI is installed
        try {
            (0, child_process_1.execSync)('gh --version', { stdio: 'ignore' });
        }
        catch (e) {
            throw new Error('GitHub CLI (gh) is not installed or not in PATH. Please install it from https://cli.github.com/');
        }
        const secretName = 'OPENCODE_MONSTER_ACCOUNTS';
        // Clean accounts for storage: remove transient health/rotation fields to keep it clean
        const accountsToSync = accounts.map(acc => ({
            id: acc.id,
            email: acc.email,
            provider: acc.provider,
            tokens: acc.tokens,
            apiKey: acc.apiKey,
            metadata: acc.metadata,
            isHealthy: true, // Reset health on sync
            healthScore: 100
        }));
        const jsonData = JSON.stringify(accountsToSync, null, 2);
        // Use gh secret set with stdin to handle potentially large data safely
        const command = `gh secret set ${secretName} --repo ${repo}`;
        console.log(`Syncing ${accounts.length} accounts to GitHub secret ${secretName} in ${repo}...`);
        (0, child_process_1.execSync)(command, {
            input: jsonData,
            stdio: ['pipe', 'inherit', 'inherit'],
            encoding: 'utf8'
        });
        console.log(`Successfully synced!`);
    }
    catch (error) {
        if (error.message.includes('gh --version')) {
            // Handled above but just in case
        }
        throw error;
    }
}
