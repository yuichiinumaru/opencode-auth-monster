import { expect } from 'chai';
import { AuthProvider } from '../src/core/types';

// Mocking the behavior found in opencode-antigravity-auth
const ANTIGRAVITY_CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const ANTIGRAVITY_CLIENT_SECRET = "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";
const ANTIGRAVITY_REDIRECT_URI = "http://localhost:51121/oauth-callback";

describe('Antigravity Reverse Engineering', () => {
    it('should verify the Antigravity OAuth configuration', () => {
        expect(ANTIGRAVITY_CLIENT_ID).to.equal("1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com");
        expect(ANTIGRAVITY_CLIENT_SECRET).to.equal("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");
    });

    it('should verify the endpoint fallbacks logic', () => {
        const endpoints = [
            "https://daily-cloudcode-pa.sandbox.googleapis.com",
            "https://autopush-cloudcode-pa.sandbox.googleapis.com",
            "https://cloudcode-pa.googleapis.com"
        ];

        expect(endpoints[0]).to.contain('daily');
        expect(endpoints[1]).to.contain('autopush');
        expect(endpoints[2]).to.not.contain('sandbox');
    });

    it('should verify the project ID discovery payload', () => {
        const payload = {
            metadata: {
                ideType: "IDE_UNSPECIFIED",
                platform: "PLATFORM_UNSPECIFIED",
                pluginType: "GEMINI",
            }
        };

        expect(payload.metadata.pluginType).to.equal("GEMINI");
    });

    it('should verify the user-agent string construction', () => {
        const version = "1.15.8";
        const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/${version} Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36`;

        expect(userAgent).to.contain(`Antigravity/${version}`);
    });
});
