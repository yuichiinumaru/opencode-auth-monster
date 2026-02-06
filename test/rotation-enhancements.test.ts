import { expect } from 'chai';
import { AccountRotator } from '../src/core/rotation';
import { ManagedAccount, AuthProvider } from '../src/core/types';

describe('AccountRotator Enhancements', () => {
  let rotator: AccountRotator;
  let accounts: ManagedAccount[];

  beforeEach(() => {
    rotator = new AccountRotator();
    accounts = [
      {
        id: 'acc1',
        email: 'acc1@gmail.com',
        provider: AuthProvider.Gemini,
        tokens: { accessToken: 'token1' },
        isHealthy: true,
        healthScore: 100
      },
      {
        id: 'acc2',
        email: 'acc2@gmail.com',
        provider: AuthProvider.Gemini,
        tokens: { accessToken: 'token2' },
        isHealthy: true,
        healthScore: 100
      }
    ];
  });

  it('should use token bucket to limit requests', () => {
    // Consume all tokens for acc1
    for (let i = 0; i < 50; i++) {
      rotator.recordSuccess(accounts[0]);
    }

    // Now acc1 should have 0 tokens and should not be selected if we use a strategy that checks tokens
    const selected = rotator.selectAccount(accounts, 'round-robin');
    // round-robin with process.pid might select acc1 or acc2 first.
    // But if acc1 is out of tokens, it should skip it.
    expect(selected?.id).to.equal('acc2');
  });

  it('should apply stickiness bonus in hybrid strategy', () => {
    const selected1 = rotator.selectAccount(accounts, 'hybrid');
    expect(selected1).to.not.be.null;

    const id1 = selected1!.id;

    // Select again, should stay with the same one due to stickiness
    const selected2 = rotator.selectAccount(accounts, 'hybrid');
    expect(selected2?.id).to.equal(id1);
  });

  it('should switch if health difference exceeds threshold', () => {
    const selected1 = rotator.selectAccount(accounts, 'hybrid');
    const id1 = selected1!.id;
    const other = accounts.find(a => a.id !== id1)!;

    // Tank the health of the current account
    for(let i=0; i<5; i++) {
        rotator.recordFailure(selected1!);
    }

    const selected2 = rotator.selectAccount(accounts, 'hybrid');
    expect(selected2?.id).to.equal(other.id);
  });

  it('should add jitter to backoff', () => {
    const account = accounts[0];
    rotator.recordRateLimit(account, 10000, 'RATE_LIMIT_EXCEEDED');

    expect(account.rateLimitResetTime).to.be.greaterThan(Date.now());
    const backoff = (account.rateLimitResetTime || 0) - Date.now();
    // Base was 10000, with jitter it should be between 8000 and 12000
    // (Actually the code uses retryAfterMs if provided, but adds jitter if NOT provided or also to it?)
    // Wait, my code does: let backoff = retryAfterMs ?? ...; and then adds jitter.
    expect(backoff).to.be.closeTo(10000, 3000);
  });
});
