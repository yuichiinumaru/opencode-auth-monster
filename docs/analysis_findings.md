# Analysis Findings

## ProxyPilot
*   **Kiro (AWS CodeWhisperer) Support**: Found extensive support for "Kiro" (AWS CodeWhisperer) in `internal/auth/kiro`.
    *   It supports `LoginWithBuilderID` (AWS Builder ID) and `LoginWithGoogle`/`LoginWithGitHub` (via Kiro's social auth).
    *   Endpoints: `https://prod.us-east-1.auth.desktop.kiro.dev`, `https://codewhisperer.us-east-1.amazonaws.com`.
    *   Use of `~/.aws/sso/cache/kiro-auth-token.json`.
*   **Minimax & Zhipu AI**: Mentioned in README, likely API key based.
*   **Amazon Q CLI**: "Import from CLI" (`q login` first).
*   **Prompt Caching**: Implements prompt caching logic (`internal/cache`).
*   **System Tray**: Has a system tray app (Golang).

## ZeroLimit
*   Seems to be a frontend/Tauri app.
*   Likely relies on `CLIProxyAPI` or similar for the backend logic.

## Desktop Apps (CodMate, Quotio, ProxyPal, VibeProxy)
*   These are mostly Swift/Native wrappers.
*   **VibeProxy**: Native macOS app. Might store tokens in Keychain or `~/Library/Application Support/VibeProxy`.
*   **CodMate**: Swift app. Check if it exposes tokens.
*   **Quotio**: Swift app.

## Proposed Integrations
1.  **Kiro Provider**: Implement `KiroProvider` in `src/providers/kiro`. This is a major addition.
2.  **Amazon Q / Kiro Import**: Add logic to `TokenExtractor` to read `~/.aws/sso/cache/` tokens (for "Amazon Q CLI" import).
3.  **Core Update**: Add `Kiro` to `AuthProvider` enum.
4.  **Minimax/Zhipu**: Add as simple API Key providers if easy.
