"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedQuota = getCachedQuota;
exports.setCachedQuota = setCachedQuota;
exports.isOnCooldown = isOnCooldown;
exports.getCooldownStatus = getCooldownStatus;
exports.applyCooldown = applyCooldown;
exports.extractQuota = extractQuota;
exports.findHealthyAccount = findHealthyAccount;
exports.preflightCheck = preflightCheck;
// ============================================================================
// QUOTA MANAGER
// ============================================================================
const CACHE_TTL_MS = 30000;
const quotaCache = new Map();
const cooldownMap = new Map();
function getCacheKey(provider, accountId) {
    return `${provider}:${accountId}`;
}
/**
 * Get cached quota result if still valid
 */
function getCachedQuota(provider, accountId) {
    const key = getCacheKey(provider, accountId);
    const entry = quotaCache.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        quotaCache.delete(key);
        return null;
    }
    return entry.result;
}
/**
 * Cache quota result
 */
function setCachedQuota(provider, accountId, result) {
    const key = getCacheKey(provider, accountId);
    quotaCache.set(key, { result, timestamp: Date.now() });
}
/**
 * Check if account is on cooldown
 */
function isOnCooldown(provider, accountId) {
    const key = getCacheKey(provider, accountId);
    const entry = cooldownMap.get(key);
    if (!entry)
        return false;
    if (Date.now() > entry.until) {
        cooldownMap.delete(key);
        return false;
    }
    return true;
}
function getCooldownStatus(provider, accountId) {
    const key = getCacheKey(provider, accountId);
    const entry = cooldownMap.get(key);
    if (!entry)
        return { active: false };
    if (Date.now() > entry.until) {
        cooldownMap.delete(key);
        return { active: false };
    }
    return { active: true, until: entry.until };
}
/**
 * Apply cooldown to an exhausted account
 */
function applyCooldown(provider, accountId, minutes) {
    const key = getCacheKey(provider, accountId);
    cooldownMap.set(key, { until: Date.now() + minutes * 60 * 1000 });
}
/**
 * Extract quota from ManagedAccount object.
 * This effectively replaces "fetchAccountQuota" by using the state we already have.
 */
function extractQuota(account) {
    if (!account.quota) {
        // If no quota tracking, assume healthy/unlimited
        return {
            success: true,
            remaining: 1000,
            models: [],
            lastUpdated: Date.now()
        };
    }
    const models = [];
    if (account.quota.modelSpecific) {
        for (const [name, info] of Object.entries(account.quota.modelSpecific)) {
            models.push({
                name,
                percentage: info.limit > 0 ? (info.remaining / info.limit) * 100 : 100,
                resetTime: info.resetTime || null
            });
        }
    }
    return {
        success: true,
        remaining: account.quota.remaining,
        models,
        lastUpdated: Date.now()
    };
}
/**
 * Find healthy account with remaining quota
 */
function findHealthyAccount(provider, allAccounts, excludeIds = []) {
    // Filter available accounts
    const available = allAccounts.filter((a) => a.provider === provider &&
        !excludeIds.includes(a.id) &&
        !isOnCooldown(provider, a.id) &&
        a.isHealthy !== false);
    if (available.length === 0)
        return null;
    // Sort by health score + quota
    available.sort((a, b) => {
        // Health Score
        const scoreA = a.healthScore ?? 70;
        const scoreB = b.healthScore ?? 70;
        if (Math.abs(scoreA - scoreB) > 5) {
            return scoreB - scoreA;
        }
        // Quota
        const quotaA = a.quota?.remaining ?? 1000;
        const quotaB = b.quota?.remaining ?? 1000;
        return quotaB - quotaA;
    });
    return available[0];
}
/**
 * Perform pre-flight quota check before session start
 */
function preflightCheck(provider, currentAccount, allAccounts) {
    // Check cooldown
    if (isOnCooldown(provider, currentAccount.id)) {
        const alt = findHealthyAccount(provider, allAccounts, [currentAccount.id]);
        if (alt) {
            return {
                proceed: true,
                accountId: alt.id,
                switchedFrom: currentAccount.id,
                reason: 'Current account on cooldown'
            };
        }
        return { proceed: false, accountId: currentAccount.id, reason: 'Account on cooldown and no alternatives' };
    }
    // Check quota
    const quota = extractQuota(currentAccount);
    if (quota.remaining <= 0) {
        applyCooldown(provider, currentAccount.id, 5); // 5 min cooldown
        const alt = findHealthyAccount(provider, allAccounts, [currentAccount.id]);
        if (alt) {
            return {
                proceed: true,
                accountId: alt.id,
                switchedFrom: currentAccount.id,
                reason: 'Quota exhausted'
            };
        }
    }
    return {
        proceed: true,
        accountId: currentAccount.id,
        quotaPercent: quota.remaining // simplified
    };
}
