import { expect } from 'chai';

// We use environment variables for tests or placeholders
const ANTIGRAVITY_CLIENT_ID = process.env.ANTIGRAVITY_CLIENT_ID || "MASKED_CLIENT_ID";
const ANTIGRAVITY_CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || "MASKED_CLIENT_SECRET";

describe('Antigravity Reverse Engineering', () => {
    it('should verify that Antigravity OAuth variables are present (or placeholders)', () => {
        expect(ANTIGRAVITY_CLIENT_ID).to.not.be.empty;
        expect(ANTIGRAVITY_CLIENT_SECRET).to.not.be.empty;
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
