# 03 — Review Checklist

> PR review checklist specifically for Web migration PRs.

Every PR that touches `web/` or shared frontend code must satisfy this checklist. Reviewers should verify each item before approving.

---

## Pre-Review: Author's Self-Check

Before requesting a review, the author must confirm:

- [ ] I have run `npm run lint` and `npm run format` locally with zero errors.
- [ ] I have run `npm run test` and all tests pass.
- [ ] I have run `npx tsc --noEmit` and there are no type errors.
- [ ] I have tested the change in the browser (not just the test suite).
- [ ] My PR description explains what desktop behavior is being migrated and how it maps to the web implementation.

---

## Functional Correctness

### Behavior Parity

- [ ] The new web implementation matches the desktop behavior for the same user action.
- [ ] Edge cases (empty states, error states, loading states) are handled identically to desktop.
- [ ] Keyboard shortcuts from desktop are replicated or intentionally deferred with a tracked TODO.

### State Management

- [ ] New state has a clear single owner (Rule 1).
- [ ] No state is duplicated between stores or between store and local state.
- [ ] Zustand store actions use immutable updates (Rule 8).
- [ ] WebSocket handlers include session/epoch freshness checks (Rule 3).

### Data Flow

- [ ] All API calls go through the `api/` layer (Rule 6).
- [ ] No `fetch` or `WebSocket` instantiation outside `api/`.
- [ ] Conversation arrays pass `validateConversation()` before submission (Rule 4).
- [ ] Props are typed with interfaces, not inline types.

### Error Handling

- [ ] Async operations have try/catch with user-facing error messages.
- [ ] No empty catch blocks.
- [ ] Error boundaries wrap new routes or major UI sections.
- [ ] WebSocket disconnections are handled gracefully (reconnect or user notification).

---

## Code Quality

### Architecture

- [ ] Dependencies point inward (Rule 7): no `utils/` importing from `components/`.
- [ ] No circular dependencies (check with `npx madge --circular web/src`).
- [ ] Business logic is extracted from components (Rule 2).
- [ ] No file exceeds 5000 LOC (Rule 5); files approaching 2000 LOC have a noted extraction plan.

### Type Safety

- [ ] No `any` types without a `// FIXME(any)` comment.
- [ ] All exported functions have explicit return types.
- [ ] Type-only imports use `import type` (satisfies `verbatimModuleSyntax`).
- [ ] Branded types are used for ID fields where applicable.

### Naming

- [ ] Components are PascalCase files with named exports (except page-level).
- [ ] Hooks use the `use` prefix.
- [ ] Stores use the `use…Store` naming pattern.
- [ ] Event handlers use the `handle` prefix internally, `on` prefix for props.

### Styling

- [ ] Tailwind utilities are used (no inline styles except dynamic values).
- [ ] No CSS Modules or styled-components introduced.
- [ ] Responsive design is implemented (mobile-first).

---

## Testing

### Unit Tests (Vitest)

- [ ] All new utility functions in `utils/` have corresponding tests.
- [ ] All new custom hooks have render-hook tests.
- [ ] All API functions are tested with mocked responses (MSW or Vitest mock).

### Component Tests (Testing Library)

- [ ] New components have interaction tests covering:
  - [ ] Rendering with minimal props.
  - [ ] User interactions (click, type, submit).
  - [ ] Error and loading states.

### Integration / E2E (Playwright)

- [ ] New user flows (e.g., send message, receive stream, switch session) have Playwright tests.
- [ ] WebSocket streaming is tested with a mock WS server.
- [ ] Tests run in CI against the dev server.

### Coverage

- [ ] New files have at least 80% line coverage.
- [ ] Bug fixes include a regression test that fails without the fix.

---

## Performance

- [ ] No unnecessary re-renders (verified with React DevTools Profiler).
- [ ] Large lists use virtualization (`@tanstack/react-virtual` or equivalent).
- [ ] Images and heavy assets are lazy-loaded.
- [ ] No expensive computation on every render without `useMemo`.

---

## Accessibility

- [ ] Interactive elements are keyboard-navigable.
- [ ] ARIA labels are provided for icon-only buttons.
- [ ] Color contrast meets WCAG AA.
- [ ] Screen reader flow is logical (tested or verified with axe).

---

## Documentation

- [ ] All exported functions, types, and component props have JSDoc.
- [ ] Complex logic has inline comments explaining "why", not "what".
- [ ] New architecture decisions are documented in `docs/Architecture/`.
- [ ] Breaking changes to the API layer are noted in the PR description.

---

## Migration-Specific Checks

### Desktop Parity

- [ ] The PR explicitly states which desktop component/feature is being migrated.
- [ ] Screenshots or screen recordings are attached showing parity (or intentional divergence with justification).
- [ ] Desktop-specific features that don't apply to web are cleanly removed, not left as dead code.

### Feature Flags

- [ ] New features behind feature flags use the existing `useFeatureFlag()` hook.
- [ ] Feature flags have a tracking issue for removal (if temporary).

### Backward Compatibility

- [ ] Existing desktop functionality is not broken by shared code changes.
- [ ] Shared types/interfaces are backward-compatible or migration steps are documented.
- [ ] API contracts are not changed without versioning.

---

## CI/CD

- [ ] All CI checks pass (lint, format, type-check, test, build).
- [ ] No new security vulnerabilities introduced (`npm audit` clean).
- [ ] Build output size has not regressed significantly.

---

## Post-Merge

- [ ] The corresponding desktop code is marked as deprecated (if applicable).
- [ ] The migration tracking issue is updated.
- [ ] A release note entry is added if the change is user-facing.

---

## Reviewer Sign-off

```
Reviewer: _______________
Date: _______________
Approved with comments: [ ] Yes  [ ] No
Requires re-review: [ ] Yes  [ ] No
```
