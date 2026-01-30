# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Token Refresher**: Proactive background token refresh for OAuth providers (Google).
- **New Providers**:
    - **Azure OpenAI**: Support for enterprise deployments via `resourceName` and `deploymentId`.
    - **Grok (xAI)**: Native support for Grok beta API.
    - **DeepSeek**: Native support for DeepSeek chat and reasoner models.
    - **Generic**: Support for local LLMs (Ollama) and custom OpenAI-compatible endpoints.
- **Security**: AES-256 encryption for file-based secret storage using machine-derived keys.
- **Cost Estimation**: Updated pricing models for DeepSeek R1, Grok Beta, and Azure models.
- **Documentation**: Comprehensive System Knowledge Graph and Codebase Health Report.

### Changed
- **Secret Storage**: Deprecated plain-text/base64 JSON storage in favor of encrypted storage.
- **Integration**: Merged critical features from `jules-integrate` branch (Quota checks, Reasoning enforcement).
- **Cleanup**: Removed stale branches and artifacts from source tree.
