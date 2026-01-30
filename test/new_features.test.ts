import { expect } from 'chai';
import { ManagedAccount, AuthProvider } from '../src/core/types';
import { TokenRefresher } from '../src/core/token-refresher';
import { AzureProvider } from '../src/providers/azure';
import { GrokProvider } from '../src/providers/grok';
import { DeepSeekProvider } from '../src/providers/deepseek';
import { CostEstimator } from '../src/core/cost-estimator';

describe('New Features Verification', () => {

  describe('TokenRefresher', () => {
    it('should return true if token is not near expiry', async () => {
        const account: ManagedAccount = {
            id: 'test',
            email: 'test@example.com',
            provider: AuthProvider.Gemini,
            tokens: { accessToken: 'valid', refreshToken: 'refresh', expiryDate: Date.now() + 3600000 },
            isHealthy: true
        };
        const result = await TokenRefresher.refreshIfNeeded(account);
        expect(result).to.be.true;
    });

    it('should return true if no refresh token', async () => {
        const account: ManagedAccount = {
            id: 'test',
            email: 'test@example.com',
            provider: AuthProvider.Gemini,
            tokens: { accessToken: 'valid' },
            isHealthy: true
        };
        const result = await TokenRefresher.refreshIfNeeded(account);
        expect(result).to.be.true;
    });
  });

  describe('New Providers', () => {
    const mockAccount: ManagedAccount = {
        id: 'p-test',
        email: 'test@provider',
        provider: AuthProvider.Azure, // Placeholder
        tokens: { accessToken: 'access-token' },
        apiKey: 'api-key',
        isHealthy: true,
        metadata: {
            resourceName: 'my-resource',
            deploymentId: 'my-deployment'
        }
    };

    it('AzureProvider should generate correct URL', () => {
        const url = AzureProvider.getUrl('gpt-4', mockAccount);
        expect(url).to.contain('https://my-resource.openai.azure.com/openai/deployments/my-deployment/chat/completions');
    });

    it('AzureProvider should throw if resourceName missing', () => {
        const badAccount = { ...mockAccount, metadata: {} };
        expect(() => AzureProvider.getUrl('gpt-4', badAccount)).to.throw("Azure provider requires 'resourceName'");
    });

    it('GrokProvider should return xAI URL', () => {
        const url = GrokProvider.getUrl('grok-beta', mockAccount);
        expect(url).to.equal('https://api.x.ai/v1/chat/completions');
    });

    it('DeepSeekProvider should return DeepSeek URL', () => {
        const url = DeepSeekProvider.getUrl('deepseek-chat', mockAccount);
        expect(url).to.equal('https://api.deepseek.com/chat/completions');
    });
  });

  describe('CostEstimator Upgrade', () => {
      it('should estimate cost for DeepSeek R1', () => {
          const cost = CostEstimator.calculateCost('deepseek-reasoner', 1000000, 1000000);
          // Input: 0.55, Output: 2.19 -> Total 2.74
          expect(cost).to.be.closeTo(2.74, 0.01);
      });

      it('should estimate cost for Grok', () => {
          const cost = CostEstimator.calculateCost('grok-beta', 1000000, 1000000);
          expect(cost).to.be.closeTo(20.00, 0.01);
      });
  });
});
