import { ManagedAccount } from '../../core/types';

export class DeepSeekProvider {
  static getHeaders(account: ManagedAccount): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${account.apiKey || ''}`
    };
  }

  static getUrl(model: string, account: ManagedAccount): string {
    return 'https://api.deepseek.com/chat/completions';
  }
}
