# Codebase Health Report

**Date:** 2023-10-27
**Analyst:** Jules

## 1. Discrepancies between Documentation and Code

### 1.1 Supported Providers
- **Issue:** `README.md` and `src/core/types.ts` list **OpenAI** and **Copilot** as supported providers. However, `src/index.ts` does not import or instantiate `OpenAIProvider` or `CopilotProvider`.
- **Impact:** Requests routed to `AuthProvider.OpenAI` or `AuthProvider.Copilot` (e.g., via `UnifiedModelHub` mappings for `gpt-5.2-codex`) may fail or behave unexpectedly if the provider logic is missing from the main registry.
- **Location:** `src/index.ts`, `src/core/types.ts`, `src/core/hub.ts`.

### 1.2 Missing Provider Implementations
- **Issue:** While `AuthProvider` enum includes `OpenAI` and `Copilot`, there are no corresponding files in `src/providers/openai/` or `src/providers/copilot/` visible in the file structure (based on `src/providers/` listing).
- **Impact:** Completely missing implementation for advertised features.

## 2. Technical Debt & Anti-Patterns

### 2.1 Synchronous I/O in Utilities
- **Issue:** `src/utils/extractor.ts` uses `execSync` (e.g., `security`, `sqlite3`).
- **Impact:** Blocks the Node.js event loop. While acceptable for a CLI `setup` command, this is dangerous if `TokenExtractor` is called during request handling in a server context.
- **Note:** `AGENTS.md` mentions this was accepted in "Stark Audit", but it remains a performance risk.

### 2.2 Security - Weak Key Derivation
- **Issue:** `src/core/secret-storage.ts` derives encryption keys using a hardcoded salt (`auth-monster-salt-v1`) and machine identifiers (MAC address/hostname).
- **Impact:** This provides "obfuscation" rather than strong security. If a malicious actor knows the algorithm and the machine details, they can decrypt the secrets file. Root access can trivially bypass this.

### 2.3 Platform Support
- **Issue:** `TokenExtractor` has extensive hardcoded paths for macOS (`Library/Application Support/...`) but limited support for Windows/Linux in some methods (e.g., `getWindsurfAuth` only checks `os.homedir()` with a macOS-like path structure).
- **Impact:** "Write once, run everywhere" is not fully realized. Windows users may face issues with auto-discovery.

### 2.4 Hardcoded Client IDs
- **Issue:** `src/providers/anthropic/index.ts` contains a hardcoded `CLIENT_ID`.
- **Impact:** If this client ID is revoked or changes, the tool breaks until updated. It should ideally be configurable.

## 3. Code Structure

- **Good:** Clear separation of concerns between `Core` (logic), `Providers` (adapters), and `Utils`.
- **Good:** Unified Model Hub (`src/core/hub.ts`) provides a strong abstraction layer for model routing.
- **Good:** `AuthMonster` class serves as a clean facade.

## 4. Verification Status

- **Build:** Success (tsc compiled without errors).
- **Tests:** Success (11 passing tests).
- **Manual Review:** Completed. Discrepancies noted above.
