import { ManagedAccount } from '../../core/types';

export class AzureProvider {
  static getHeaders(account: ManagedAccount): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'api-key': account.apiKey || account.tokens.accessToken || ''
    };
  }

  static getUrl(model: string, account: ManagedAccount): string {
    const resource = account.metadata?.resourceName;
    const deployment = account.metadata?.deploymentId || model; // Fallback to model name if deployment not specified
    const apiVersion = account.metadata?.apiVersion || '2023-05-15';

    if (!resource) {
        throw new Error("Azure provider requires 'resourceName' in account metadata.");
    }

    return `https://${resource}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  }
}
