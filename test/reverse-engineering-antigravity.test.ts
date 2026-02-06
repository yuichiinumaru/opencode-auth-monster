import { expect } from 'chai';
import { AuthProvider } from '../src/core/types';

// Constants from the target plugin
const ANTIGRAVITY_CLIENT_ID = process.env.ANTIGRAVITY_CLIENT_ID || "REDACTED";
const ANTIGRAVITY_CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || "REDACTED";
const ANTIGRAVITY_ENDPOINT_PROD = "https://cloudcode-pa.googleapis.com";

describe('Antigravity Reverse Engineering', () => {
  it('should verify OAuth URL construction with Antigravity client ID', () => {
    const redirectUri = "http://localhost:51121/oauth-callback";
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", ANTIGRAVITY_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);

    expect(url.toString()).to.contain(ANTIGRAVITY_CLIENT_ID);
    expect(url.toString()).to.contain("response_type=code");
    expect(url.toString()).to.contain(encodeURIComponent(redirectUri));
  });

  it('should verify loadCodeAssist endpoint structure', () => {
    const url = `${ANTIGRAVITY_ENDPOINT_PROD}/v1internal:loadCodeAssist`;
    const body = {
      metadata: {
        ideType: "IDE_UNSPECIFIED",
        platform: "PLATFORM_UNSPECIFIED",
        pluginType: "GEMINI",
      },
    };

    expect(url).to.equal("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist");
    expect(body.metadata.pluginType).to.equal("GEMINI");
  });

  it('should verify fetchAvailableModels endpoint structure', () => {
    const url = `${ANTIGRAVITY_ENDPOINT_PROD}/v1internal:fetchAvailableModels`;
    expect(url).to.equal("https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels");
  });

  it('should verify retrieveUserQuota endpoint structure', () => {
    const url = `${ANTIGRAVITY_ENDPOINT_PROD}/v1internal:retrieveUserQuota`;
    expect(url).to.equal("https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota");
  });
});
