import { expect } from 'chai';
import { GeminiProvider } from '../src/providers/gemini';
import { AuthProvider, ManagedAccount } from '../src/core/types';
import { AccountRotator } from '../src/core/rotation';

describe('Antigravity Integration', () => {
  it('should generate correct URL for antigravity models', () => {
    const account: ManagedAccount = {
      id: 'acc1',
      email: 'test@gmail.com',
      provider: AuthProvider.Gemini,
      tokens: { accessToken: 'token1' },
      isHealthy: true
    };
    const url = GeminiProvider.getUrl('antigravity-gemini-3-pro', account);
    expect(url).to.equal('https://cloudcode-pa.googleapis.com/v1beta/models/antigravity-gemini-3-pro:generateContent');
  });

  it('should generate correct URL for standard gemini models', () => {
    const account: ManagedAccount = {
      id: 'acc1',
      email: 'test@gmail.com',
      provider: AuthProvider.Gemini,
      tokens: { accessToken: 'token1' },
      isHealthy: true
    };
    const url = GeminiProvider.getUrl('gemini-1.5-pro', account);
    expect(url).to.equal('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent');
  });

  it('should rotate accounts using hybrid strategy with stickiness', () => {
    const rotator = new AccountRotator();
    const accounts: ManagedAccount[] = [
      { id: 'acc1', email: 'a1@gmail.com', provider: AuthProvider.Gemini, tokens: { accessToken: 't1' }, isHealthy: true, healthScore: 100 },
      { id: 'acc2', email: 'a2@gmail.com', provider: AuthProvider.Gemini, tokens: { accessToken: 't2' }, isHealthy: true, healthScore: 100 }
    ];

    const first = rotator.selectAccount(accounts, 'hybrid');
    expect(first).to.not.be.null;

    // With stickiness, second call should return the same account
    const second = rotator.selectAccount(accounts, 'hybrid');
    expect(second!.id).to.equal(first!.id);
  });
});
