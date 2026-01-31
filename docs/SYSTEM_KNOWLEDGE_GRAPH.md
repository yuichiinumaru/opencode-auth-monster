# System Knowledge Graph: OpenCode Auth Monster

> **Version:** 1.0
> **Last Updated:** Current Session
> **Status:** ACTIVE

This document serves as the primary cognitive context for the OpenCode Auth Monster codebase. It maps the architecture, data flow, key entities, and operational constraints derived from deep code analysis.

## 1. High-Level Architecture

```mermaid
graph TD
    User([User / IDE Request]) --> AuthMonster[AuthMonster Entry Point]
    AuthMonster --> Hub[Unified Model Hub]

    subgraph "Routing & Selection"
        Hub -->|Resolve Model Chain| Config[Config]
        Hub -->|Get Candidates| Rotator[Account Rotator]
        Rotator -->|Filter| Health[Health Score Tracker]
        Rotator -->|Check| Quota[Quota Manager]
        Rotator -->|Check| RateLimit[Rate Limit Dedup]
    end

    Rotator -->|Selected Account| AuthMonster
    AuthMonster -->|Warmup (If Reasoning)| Warmup[Thinking Warmup]

    subgraph "Request Execution"
        AuthMonster -->|Transform| Sanitizer[Cross-Model Sanitizer]
        AuthMonster -->|Enforce| ThinkingVal[Thinking Validator]
        AuthMonster -->|Fetch| Transport[Transport Layer]
    end

    Transport -->|HTTP/SOCKS| Proxy[Proxy Manager]
    Transport -->|Protobuf/Connect| WindsurfProto[Windsurf ProtoWriter]

    Proxy --> ExternalAPI[External Provider APIs]
    WindsurfProto --> ExternalAPI

    ExternalAPI --> Response
    Response -->|Async| Stats[Stats & History Collector]
    Response --> User
```

## 2. Component Registry

| Component | File | Responsibility | Key Logic |
| :--- | :--- | :--- | :--- |
| **AuthMonster** | `src/index.ts` | Main library entry, request orchestration. | `request()`, `selectAccount()`, `runThinkingWarmup()` |
| **UnifiedModelHub** | `src/core/hub.ts` | Routes generic models to provider-specific IDs. | Hardcoded `initializeDefaultMappings`, `selectModelAccount` |
| **AccountRotator** | `src/core/rotation.ts` | Selects the best account from a list. | Strategies: Sticky, Round-Robin, Hybrid (Score+LRU), PID Offset. |
| **HealthScoreTracker** | `src/core/rotation.ts` | Tracks account health (0-100). | Passive recovery (+2/hr), Penalties for failure/rate-limit. |
| **ThinkingValidator** | `src/core/thinking-validator.ts` | Validates/Clamps thinking budgets. | `validateThinking`, maps `low/med/high` to token counts. |
| **ProxyManager** | `src/core/proxy.ts` | Manages HTTP/SOCKS proxies. | Detects env vars (`HTTPS_PROXY`), creates Agents. |
| **Sanitizer** | `src/utils/sanitizer.ts` | Cleans requests for cross-model compatibility. | `sanitizeCrossModelRequest` (strips signatures), `applyHeaderSpoofing`. |
| **ProtoWriter** | `src/core/transport.ts` | Low-level Protobuf writer. | Used by Windsurf provider for manual gRPC/Connect frame construction. |
| **Providers** | `src/providers/*` | Provider implementations. | `Gemini`, `Anthropic`, `Windsurf`, `Generic` (Ollama), etc. |

## 3. Entity-Relationship Model

*   **AuthMonster** manages 1 **UnifiedModelHub**.
*   **AuthMonster** manages 1 **AccountRotator**.
*   **AuthMonster** manages N **ManagedAccounts**.
*   **UnifiedModelHub** maps "Generic Model Names" (e.g., `gemini-3-flash`) to N **ModelHubEntries**.
*   **ModelHubEntry** links a Provider + ModelID.
*   **AccountRotator** uses **HealthScoreTracker** to filter **ManagedAccounts**.
*   **ManagedAccount** belongs to 1 **AuthProvider**.
*   **ManagedAccount** has 0..1 **Quota**.
*   **ManagedAccount** has 0..1 **HealthScore**.

## 4. Operational Constraints & Rules

### A. Request Lifecycle & Rotation
1.  **Resolution**: Request for `gemini-3-flash` is resolved to a chain of candidates via `Hub`.
2.  **Selection**: `Rotator` filters accounts:
    *   **Rate Limited?** Check `rateLimitResetTime`.
    *   **Cooldown?** Check `cooldownUntil`.
    *   **Unhealthy?** Score < 50 (`minUsable`).
    *   **Strategy**: Applies Sticky/Round-Robin/Hybrid.
    *   **Concurrency**: Uses `process.pid` to offset round-robin cursors (prevents collisions in multi-process setups).
3.  **Parking**: If *all* accounts are rate-limited, the request "parks" (sleeps) for up to 60s waiting for the earliest reset.

### B. "Thinking Warmup" Protocol
*   **Trigger**: When switching to a *new* account that hasn't been used recently.
*   **Target**: Only `Anthropic` accounts with reasoning models (`opus`, `thinking`).
*   **Action**: Sends a 1-token dummy request ("Hello") to `api.anthropic.com`.
*   **Throttle**: Max once every 5 minutes per account.
*   **Mode**: Fire-and-forget (does not block the main user request).

### C. Cross-Model Sanitization
*   **Problem**: Switching from Gemini (which uses `thoughtSignature`) to Anthropic causes 400 Bad Request if unknown fields are present.
*   **Solution**: `sanitizeCrossModelRequest` recursively strips:
    *   `thoughtSignature`
    *   `thinkingMetadata`
    *   `signature`
    *   `thought_signature`

### D. Rate Limit Deduplication
*   **Problem**: Parallel requests hitting 429 simultaneously cause "Backoff Explosion" (health score tanking).
*   **Solution**: If a 429 is recorded, any subsequent 429s for the same account within **2 seconds** are ignored (deduplicated).

### E. Windsurf Provider Specifics
*   **Protocol**: Uses gRPC-over-HTTP (Connect protocol).
*   **Implementation**: Does NOT use a standard gRPC library. Uses `src/core/transport.ts` to manually write Protobuf Varints and length-delimited frames.
*   **Complexity**: High. Requires `port`, `csrfToken`, and `version` in account metadata.

## 5. Data Flow: Request Execution

1.  **Input**: `model`, `url`, `options`.
2.  **Hub**: Resolves `model` -> `[Candidate Models]`.
3.  **Loop**: For each candidate:
    *   `selectAccount()` -> Returns `AuthDetails`.
    *   **If None**: Check for rate-limit parking. If parked, wait and retry. Else, continue.
    *   **Transform**: `JSON.stringify` body -> `sanitize` -> `enforceReasoning`.
    *   **Execute**:
        *   If `Windsurf`: Call `handleWindsurfRequest` (Stream/Protobuf).
        *   Else: Call `proxyFetch` (HTTP/SOCKS).
    *   **Stats (Async)**:
        *   Clone response.
        *   Estimate/Extract tokens.
        *   Calculate Cost (`CostEstimator`).
        *   Update `account.usage`.
        *   Write to `HistoryManager`.
    *   **Error Handling**:
        *   429/403 (Quota): Report Rate Limit -> Retry next candidate.
        *   Other Error: Report Failure -> Retry next candidate.
        *   Success: Report Success -> Return Response.

## 6. Known Limitations (from Code Analysis)
*   **Hardcoded Mappings**: `Hub` mappings are hardcoded in TS, not loaded from dynamic config.
*   **Windsurf Fragility**: Manual Protobuf encoding is brittle to protocol changes.
*   **Stats Reliability**: Stats collection is "fire-and-forget" and may be lost if the process terminates immediately after response.
