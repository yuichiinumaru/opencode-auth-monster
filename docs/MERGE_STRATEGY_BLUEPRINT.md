# Merge Strategy Blueprint: Grand Unification

## 1. Executive Summary
This document outlines the strategy to consolidate the `opencode-auth-monster` repository. The goal is to integrate the "CodexBar" cost tracking and "Phase 5" core logic improvements into the `master` branch while discarding stale UI experiments and polluted artifact branches.

## 2. Branch Inventory & Status

| Branch Name | Status | Classification | Action |
| :--- | :--- | :--- | :--- |
| `master` | **Baseline** | Stable Core | **Target** |
| `codexbar-integration` | **Active** | New Feature | **MERGE** |
| `jules-integrate-phase-5-features` | **Active** | Core Fixes | **MERGE** |
| `feat-phase-4-ui` | Stale | Regression | **DISCARD** |
| `phase-5-features` | Polluted | Artifacts (`.js`) | **DISCARD** |
| `phase2-providers-protocol` | Redundant | Integrated | **DISCARD** |

## 3. Conflict Matrix & Risk Assessment

The following files are touched by multiple active branches (`codexbar` and `jules-integrate`), posing potential conflicts.

| File | `codexbar-integration` | `jules-integrate-phase-5` | Conflict Risk | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `src/index.ts` | Modified (Async headers) | Modified (Reasoning middleware) | **Medium** | Semantic merge required. |
| `src/providers/generic/index.ts` | Modified (Cookie logic) | **DELETED** | **HIGH** | `jules-integrate` deletes this. **Decision: PRESERVE File.** |
| `test/generic_provider.test.ts` | Modified | **DELETED** | **HIGH** | `jules-integrate` deletes this. **Decision: PRESERVE File.** |
| `src/core/hub.ts` | - | Modified | Low | Clean merge expected. |
| `src/core/secret-storage.ts` | - | Modified | Low | Clean merge expected. |

### Critical Conflict Resolution: Generic Provider & Tests
*   **Issue:** `jules-integrate-phase-5-features` deletes the `GenericProvider` and its tests. `codexbar-integration` enhances them.
*   **Risk:** Simply restoring the file might cause compatibility issues if the Core interfaces have changed in `jules-integrate`.
*   **Strategy:**
    1.  **Reject the deletion** of `GenericProvider` and `test/generic_provider.test.ts` during the merge (Checkout from `codexbar`).
    2.  **Adaptation:** After restoring, verify if `GenericProvider` implements the updated `AuthProvider` interface (if changed). Modify the code to ensure compatibility.

## 4. Integration Sequence

The integration will proceed in the following order to maximize stability:

1.  **Checkout Master**: Ensure we are on the latest `master`.
2.  **Merge `codexbar-integration`**:
    *   `git merge origin/codexbar-integration-17035081268374258021`
    *   *Expectation:* Fast-forward or clean merge.
3.  **Merge `jules-integrate-phase-5-features`**:
    *   `git merge --no-commit origin/jules-integrate-phase-5-features-15337185734724250253`
    *   *Action:* Manually resolve `src/index.ts` to include both `enforceReasoning` and `cookie` logic.
    *   *Action:* **Restore `src/providers/generic/index.ts`** and **`test/generic_provider.test.ts`** (checkout from HEAD/Ours).
    *   *Action:* **Compile Check:** Run `npx tsc --noEmit` to verify `GenericProvider` is compatible with the new core. Fix any interface errors.
    *   Commit the merge.
4.  **Sanitation**:
    *   Ensure no `.js` files from `phase-5` polluted the tree.
    *   Run `npm test` to verify integration.

## 5. Verification Plan
1.  **File Check**: Verify `src/providers/generic/index.ts` exists and contains cookie logic.
2.  **Logic Check**: Verify `src/index.ts` contains `enforceReasoning` call AND async header generation.
3.  **Test**: Run `npm test` to ensure no regressions.

## 6. Approval Request
Awaiting user approval to execute this strategy.
