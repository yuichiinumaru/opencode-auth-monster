# Project Structure Map

## Root Directory
- `AGENTS.md`: Workspace Federation Constitution.
- `README.md`: Project overview and documentation.
- `package.json`: Dependencies and scripts.
- `tsconfig.json`: TypeScript configuration.
- `cli.ts`: CLI entry point.
- `index.ts`: Library entry point.

## src/
### core/ (Key Logic)
- `hub.ts`: Unified Model Hub - Likely the main controller.
- `rotation.ts`: Account rotation logic (Sticky, Round-robin, etc.).
- `config.ts`: Configuration management.
- `storage.ts`: Persistence layer for accounts/state.
- `transport.ts`: Networking layer.
- `proxy.ts`: Proxy handling.
- `quota-manager.ts`: Rate limiting and quota tracking.
- `cost-estimator.ts`: Usage cost calculation.
- `mcp-bridge.ts`: Model Context Protocol integration.
- `dialectics.ts`: Reasoning/logic handling.
- `history.ts`: Request/Response history.
- `reasoning.ts`: Advanced model reasoning logic.
- `redactor.ts`: PII or sensitive data redaction.
- `secret-storage.ts`: Secure storage for tokens.
- `thinking-validator.ts`: Validation for "thinking" models.
- `endpoints.ts`: API endpoint definitions.
- `types.ts`: Type definitions.

### providers/ (Model Implementations)
- `anthropic/`: Anthropic specific logic.
- `azure/`: Azure OpenAI logic.
- `cursor/`: Cursor IDE token logic.
- `deepseek/`: Deepseek logic.
- `gemini/`: Google Gemini logic.
- `generic/`: Base classes or generic implementations.
- `grok/`: xAI Grok logic.
- `iflow/`: iFlow logic.
- `kiro/`: Kiro logic.
- `minimax/`: Minimax logic.
- `qwen/`: Qwen logic.
- `windsurf/`: Windsurf IDE logic.
- `zhipu/`: Zhipu AI logic.

### utils/ (Utilities)
- `oauth-server.ts`: Local server for OAuth callbacks.
- `wizard.ts`: Interactive setup wizard.
- `sanitizer.ts`: Request/Header sanitization.
- `extractor.ts`: Token extraction from local apps (Cursor, Windsurf).
- `github-sync.ts`: Synchronization with GitHub Secrets.

### server/
- `index.ts`: Server entry point.

### ui/
- `dashboard.ts`: CLI Dashboard.

### test/
- `core.test.js`: Core logic tests.
- `generic_provider.test.ts`: Provider tests.
- `integration.test.ts`: Integration tests.
- `test_extractor.ts`: Extractor tests.
- `test_guardian.ts`: Guardian tests.
- `test_mcp.ts`: MCP tests.
- `test_transport.ts`: Transport tests.

## scripts/
- Analysis and deployment scripts.
