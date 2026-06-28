# 06 — Commit Conventions

> Commit message rules for the Hermes web migration.

Consistent commit messages enable automatic changelogs, clear git history, and efficient code review.

---

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Required. One of: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `style`, `wip`.

### Scope

Required for migration-related commits: `chat`, `session`, `stream`, `api`, `store`, `types`, `ui`, `layout`, `auth`, `test`, `ci`, `deps`, `config`.

### Subject

Required. Imperative mood, lowercase start, no period, max 72 chars.

- ✅ "feat(chat): migrate MessageList from desktop"
- ❌ "Migrated MessageList"

### Body

Optional for simple changes. **Required** for migrations, breaking changes, and complex changes. Explain **what** and **why**, not **how**. Wrap at 72 chars.

### Footer

Used for `BREAKING CHANGE:`, `Closes #issue`, `Refs #issue`, `Co-authored-by:`.

---

## Migration-Specific Patterns

### Component Migration

```
feat(chat): migrate MessageList from desktop

- Port MessageList.tsx from desktop/components/ to web/src/components/chat/
- Replace nanostores with Zustand useSessionStore
- Replace desktop CSS modules with Tailwind utilities
- Add keyboard navigation (arrow keys, Enter to select)
- Preserve all existing desktop behaviors: copy, edit, delete

Refs #123
```

### API Migration

```
feat(api): add streaming endpoint client

Implement createStreamConnection() in api/stream.ts:
- WebSocket connection with automatic reconnection
- Epoch-based freshness guard (invalidates stale callbacks)
- Typed message parsing with Zod validation
- Cleanup function for proper unmount handling

Closes #45
```

### Store Migration

```
refactor(store): migrate session store from nanostores to Zustand

- Replace $sessionAtom with useSessionStore
- Add async actions for session CRUD
- Implement selector-based subscriptions
- Add optimistic updates for session switching

Refs #78
```

### Bug Fix

```
fix(stream): prevent stale messages after session switch

WebSocket callbacks were mutating state for the previous session
after the user switched. Added epoch counter that increments on
session change, invalidating all pending callbacks.

Closes #89
```

### Test Addition

```
test(chat): add integration tests for message sending

- Test successful message send and response display
- Test error handling when API returns 500
- Test loading state during send
- Mock API layer with MSW

Refs #56
```

### Documentation

```
docs(playbook): add testing strategy guide

Document the seven-layer testing pyramid for web migration:
unit, component, hook, store, API, integration, and E2E.

Closes #12
```

---

## Breaking Changes

Breaking changes require:
1. A `!` after the type/scope: `feat(api)!: remove legacy endpoint`
2. A `BREAKING CHANGE:` footer with migration instructions.

```
feat(api)!: remove /api/v1/sessions endpoint

The legacy v1 session endpoint has been removed. All clients must
use /api/v2/sessions which supports pagination and filtering.

BREAKING CHANGE: The /api/v1/sessions endpoint is removed. Update
all API clients to use /api/v2/sessions. See docs/migrations/v2.md
for the full migration guide.

Refs #100
```

---

## Commit Frequency

- **When:** After completing a logical unit of work. Before switching context.
- **Ideal:** 1-5 commits per PR. **Maximum:** 10.
- **Squashing:** `wip` and `fixup` commits must be squashed before merge.

---

## Branch Naming

```
<type>/<issue-number>-<short-description>
```

Examples: `feat/123-migrate-message-list`, `fix/89-stale-websocket-messages`

---

## Pre-Commit Hooks

The project uses `husky` and `lint-staged`:
1. **ESLint** on staged `.ts`/`.tsx` files.
2. **Prettier** formats staged files.
3. **Type checking** (`tsc --noEmit`) on changed files.
4. **Commit message lint** validates Conventional Commits format.

**Bypass** (`--no-verify`): Only for emergency hotfixes or interactive rebase.

---

## Examples by Scenario

### New Feature (not migration)

```
feat(chat): add message search

Implement full-text search within a session's messages:
- Search input in chat header
- Highlight matching text in results
- Keyboard shortcut (Ctrl/Cmd+F) to focus search
- Debounced input (300ms) to avoid excessive filtering

Closes #112
```

### Refactoring

```
refactor(store): extract connection state to dedicated store

Move connection-related state (isConnected, retryCount, lastError)
from useSessionStore to a new useConnectionStore. This reduces
coupling and makes connection logic independently testable.

No behavior change.

Refs #95
```

### Dependency Update

```
chore(deps): bump react to 19.1.0

Update React and related packages:
- react 19.0.0 → 19.1.0
- react-dom 19.0.0 → 19.1.0
- @types/react 19.0.0 → 19.1.0

No breaking changes. All tests pass.

Refs #130
```

---

## Anti-Patterns

| Anti-pattern | Why it's bad | Correct approach |
|---|---|---|
| `fix: bug fix` | No context | `fix(stream): handle reconnection after network drop` |
| `feat: new feature` | No scope, no detail | `feat(chat): add typing indicator during stream` |
| `WIP` as final commit | Incomplete work merged | Squash WIP commits into meaningful units |
| `update` as type | Not recognized | Use `chore`, `fix`, or `refactor` |
| `feat: did a bunch of things` | Multiple unrelated changes | Split into separate commits |

---

## Changelog Generation

| Type | Section in Changelog |
|---|---|
| `feat` | 🚀 Features |
| `fix` | 🐛 Bug Fixes |
| `perf` | ⚡ Performance |
| `refactor` | ♻️ Refactoring |
| `feat!` / `BREAKING CHANGE` | 💥 Breaking Changes |

Types `chore`, `test`, `docs`, `ci`, `style` are excluded from the changelog by default.

---

## Summary

```
feat(chat): migrate MessageList from desktop

- Port component to web/src/components/chat/
- Replace nanostores with Zustand
- Use Tailwind for styling
- Preserve all desktop behaviors

Refs #123
```

**Checklist before committing:**
- [ ] Type is correct (feat, fix, refactor, etc.)
- [ ] Scope is included
- [ ] Subject is imperative, lowercase, no period, ≤72 chars
- [ ] Body explains what and why (for non-trivial changes)
- [ ] Footer references related issues
- [ ] Breaking changes are clearly marked
