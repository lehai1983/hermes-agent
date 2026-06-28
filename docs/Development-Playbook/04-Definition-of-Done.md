# 04 — Definition of Done

> What "done" means for a migration task.

A migration task is not complete when the code compiles. It is complete when the web implementation is functionally equivalent to the desktop original, tested, documented, and merged without regressions.

---

## DoD for a Component Migration

### 1. Implementation Complete

- [ ] The component exists in `web/src/components/` (or appropriate subdirectory).
- [ ] All props match the desktop component's public interface (or the documented web adaptation).
- [ ] The component uses the web's state management (Zustand stores, not nanostores).
- [ ] The component uses Tailwind for styling, not desktop's styling approach.
- [ ] The component is registered in the router (if it's a page) or imported by its parent.

### 2. Behavior Parity Verified

- [ ] Every user interaction available in the desktop version works identically in the web version.
- [ ] Loading, empty, and error states are handled.
- [ ] Keyboard shortcuts are implemented or explicitly deferred with a tracked issue.
- [ ] Responsive behavior is verified (the component works at mobile, tablet, and desktop viewports).

### 3. Tests Written and Passing

- [ ] Unit tests for all extracted business logic (Vitest).
- [ ] Component interaction tests (Testing Library).
- [ ] Playwright test for the user flow (if it's a primary flow).
- [ ] All tests pass in CI.
- [ ] Coverage meets the 80% threshold for new files.

### 4. Code Quality

- [ ] Zero ESLint errors.
- [ ] Zero Prettier formatting violations.
- [ ] Zero TypeScript errors (`tsc --noEmit` clean).
- [ ] No `any` types without justification comments.
- [ ] No file exceeds 5000 LOC.
- [ ] All 11 architecture rules are satisfied.

### 5. Documentation

- [ ] All exports have JSDoc comments.
- [ ] The component's purpose and usage are clear from its file and types.
- [ ] Any deviation from the desktop behavior is documented with rationale.
- [ ] Architecture Decision Record (ADR) is written if the migration introduces a new pattern.

### 6. Review and Approval

- [ ] PR passes the full review checklist (03-Review-Checklist.md).
- [ ] At least one reviewer from the web team approves.
- [ ] No unresolved review comments.
- [ ] Screenshots/video attached for visual verification.

### 7. Integration

- [ ] The component integrates with the existing web app without breaking other features.
- [ ] Navigation to/from the component works correctly.
- [ ] State is correctly wired to the appropriate stores.
- [ ] WebSocket connections (if applicable) are established and cleaned up properly.

### 8. Cleanup

- [ ] The corresponding desktop component is marked deprecated (with `@deprecated` JSDoc tag).
- [ ] Dead code from the desktop version is not carried over.
- [ ] Feature flags (if used) have a tracking issue for removal.
- [ ] No `console.log` debug statements remain in production code.

---

## DoD for an API Layer Migration

### 1. Implementation

- [ ] All desktop API calls have corresponding functions in `web/src/api/`.
- [ ] Functions are typed with request/response interfaces.
- [ ] Error handling is centralized (retry logic, user-facing messages).

### 2. Testing

- [ ] Each API function is tested with mocked responses.
- [ ] Error paths are tested (network failure, timeout, invalid response).
- [ ] WebSocket functions are tested with a mock WS server.

### 3. Integration

- [ ] Stores and hooks consume the new API functions.
- [ ] No component calls `fetch` or `WebSocket` directly.

---

## DoD for a Store Migration

### 1. Implementation

- [ ] The store exists in `web/src/stores/` using Zustand.
- [ ] State shape matches the desktop nanostores equivalent.
- [ ] Actions are immutable.
- [ ] Selectors are provided for derived state.

### 2. Testing

- [ ] Store actions are tested in isolation.
- [ ] State transitions are verified.
- [ ] Selectors return correct derived values.

### 3. Integration

- [ ] Components subscribe to the store via selectors.
- [ ] No component holds a stale copy of store state.

---

## DoD for a Type Migration

### 1. Implementation

- [ ] Types are defined in `web/src/types/` or co-located with their primary module.
- [ ] Types are shared between components that need them (not duplicated).
- [ ] Branded types are used for IDs.

### 2. Verification

- [ ] `tsc --noEmit` passes.
- [ ] Types are exported from the appropriate barrel file (if applicable).

---

## DoD for a Testing-Only Task

Sometimes a task exists to add test coverage for already-migrated code:

- [ ] Tests cover the happy path, error path, and edge cases.
- [ ] Tests are deterministic (no flaky tests).
- [ ] Tests run in CI and pass consistently.
- [ ] Coverage report shows improvement.

---

## DoD for a Documentation Task

- [ ] Document is written in the correct `docs/` subdirectory.
- [ ] Content is technically accurate (verified against the codebase).
- [ ] Links to related documents are correct.
- [ ] Formatting follows the project's markdown style.

---

## The "Not Done" List

A task is **NOT done** if:

- It compiles but hasn't been tested in the browser.
- It works but has no tests.
- It passes tests but breaks accessibility.
- It implements new behavior without documenting deviations from desktop.
- It introduces dead code from the desktop version.
- It has unresolved `// TODO` or `// FIXME` comments without tracking issues.
- It has formatting or lint violations.
- The desktop component hasn't been marked deprecated (if applicable).

---

## Escalation

If a task cannot meet the DoD due to:

- **Missing backend support:** File an issue and tag it `blocked`. Link it from the PR.
- **Ambiguous desktop behavior:** Consult the desktop source code and write an ADR for the chosen approach.
- **Performance regression:** Profile, document the tradeoff, and bring it to the team for a decision.

---

## Summary

| Criterion | Requirement |
|---|---|
| Implementation | Code exists, compiles, integrates |
| Behavior | Matches desktop (or documented deviation) |
| Tests | Written, passing, coverage ≥ 80% |
| Quality | Lint, format, types all clean |
| Architecture | All 11 rules satisfied |
| Documentation | JSDoc, ADRs, migration notes |
| Review | Approved, checklist passed |
| Cleanup | Desktop code deprecated, dead code removed |
