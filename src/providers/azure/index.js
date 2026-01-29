"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureProvider = void 0;
const types_1 = require("../../core/types");
class AzureProvider {
    static getHeaders(account) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (account.apiKey) {
            headers['api-key'] = account.apiKey;
        }
        else if (account.tokens.accessToken) {
            // Azure AD auth support
            headers['Authorization'] = `Bearer ${account.tokens.accessToken}`;
        }
        return headers;
    }
    static getUrl(model, account) {
        const resourceName = account.metadata?.resourceName;
        const deploymentId = account.metadata?.deploymentId || model;
        const apiVersion = account.metadata?.apiVersion || '2024-02-15-preview';
        if (!resourceName) {
            // Fallback or error? For now return a placeholder that will likely fail DNS if not set,
            // reminding user to set metadata.
            return `https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;
        }
        return `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;
    }
}
exports.AzureProvider = AzureProvider;
AzureProvider.provider = types_1.AuthProvider.Azure;
