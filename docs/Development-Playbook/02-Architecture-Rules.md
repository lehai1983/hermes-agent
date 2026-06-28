# 02 — Architecture Rules

> The 11 rules that prevent regressions during the Web-first migration.

These rules are **non-negotiable**. Violations will block PR merge. Each one was learned from a real regression during the migration from desktop-first to web-first.

---

## Rule 1: Single State Owner

**Every piece of state has exactly one owner.**

State must not be duplicated across stores, components, or layers. If session state lives in `useSessionStore`, no component may hold a local copy of session data as its source of truth.

- Identify the canonical owner before adding new state.
- Derive values via selectors, not by copying into local state.
- If two domains need overlapping data, one store subscribes to the other — they do not both own the data.

```ts
// ❌ Two sources of truth
function ChatPanel() {
  const session = useSessionStore(s => s.current);
  const [localSession, setLocalSession] = useState(session); // copy!
}

// ✅ Single owner, derived locally
function ChatPanel() {
  const session = useSessionStore(s => s.current); // always fresh
}
```

---

## Rule 2: No Business Logic in React Components

**Components render UI and delegate. They do not compute.**

Business logic (message formatting, retry decisions, permission checks, data transformations) belongs in pure utility functions, custom hooks, or store actions. A component body should contain at most conditional rendering, event delegation, and hook calls.

- Extract any non-trivial computation to a named function outside the component.
- If a `useEffect` body exceeds 5 lines of non-trivial logic, extract it to a custom hook.

```ts
// ❌ Business logic inline
function MessageList({ messages }: Props) {
  const sorted = [...messages].sort((a, b) => { /* 20 lines */ });
}

// ✅ Delegated to a pure function
const sortMessages = (msgs: Message[]): Message[] => { … };
function MessageList({ messages }: Props) {
  const sorted = sortMessages(messages);
}
```

---

## Rule 3: Cache Safety

**WebSocket responses must be validated against the current request context before state mutation.**

The WebSocket stream is shared. By the time a response arrives, the user may have switched sessions, navigated away, or the component may have unmounted.

- Every WebSocket handler must check that the incoming message's `sessionId` matches the active session.
- Use an epoch counter or AbortController to invalidate stale callbacks.
- Never mutate React state from a WebSocket callback without a freshness check.

```ts
// ❌ No freshness check
ws.onmessage = (event) => {
  setMessages(prev => [...prev, event.data]); // might be from old session
};

// ✅ Epoch-guarded
useEffect(() => {
  let epoch = 0;
  const handler = (event: MessageEvent) => {
    if (event.data.sessionId !== currentSessionId) return;
    if (epoch !== currentEpoch) return; // stale
    setMessages(prev => [...prev, event.data]);
  };
  ws.addEventListener("message", handler);
  return () => { epoch++; ws.removeEventListener("message", handler); };
}, [currentSessionId]);
```

---

## Rule 4: Role Alternation

**User and assistant messages must strictly alternate in conversation arrays.**

The backend enforces this invariant. The frontend must never construct a conversation array that violates it.

- Validate conversation arrays before sending to the backend.
- Use a `validateConversation()` utility that checks alternation.
- If a tool call or system message breaks alternation, insert a synthetic separator or merge appropriately.

```ts
export function validateConversation(msgs: ChatMessage[]): boolean {
  for (let i = 1; i < msgs.length; i++) {
    if (msgs[i]!.role === msgs[i - 1]!.role && msgs[i]!.role !== "tool") {
      return false;
    }
  }
  return true;
}
```

---

## Rule 5: No God Files

**No file may exceed 5000 LOC.** If a file approaches 2000 LOC, begin planning an extraction.

- Run `npx cloc web/src/**/*.tsx` weekly to monitor file sizes.
- If a file exceeds 3000 LOC, file a tech-debt ticket for extraction.
- If a file exceeds 5000 LOC, extraction is a **blocking** PR.

**Extraction strategy:** Identify cohesive sub-sections → Extract logic to `utils/` or `hooks/` → Extract sub-components → Keep main file as thin composition layer.

---

## Rule 6: API Boundary Isolation

**All HTTP and WebSocket calls go through the `api/` layer. No component or store calls `fetch` or instantiates `WebSocket` directly.**

This ensures centralized error handling, consistent request headers and auth, and easy mocking in tests.

- Every API function lives in `web/src/api/`.
- Components call hooks or store actions, which call API functions.
- The `api/` layer exposes typed functions, not raw responses.

```
web/src/api/
├── session.ts      # fetchSession, createSession, deleteSession
├── message.ts      # sendMessage, fetchHistory
├── stream.ts       # createStreamConnection (WebSocket factory)
└── types.ts        # API response/request types
```

---

## Rule 7: Dependency Direction

**Dependencies point inward: pages → components → hooks/utils → types.**

- `types/` depends on nothing in the project.
- `utils/` depends only on `types/` and external libs.
- `hooks/` depends on `utils/`, `types/`, and stores.
- `components/` depends on `hooks/`, `utils/`, `types/`.
- `pages/` depends on `components/`, `hooks/`, stores.

**No reverse dependencies.** A `utils/` file must never import from `components/`.

- Run `npx madge --circular web/src` in CI to detect cycles.
- If two modules need bidirectional communication, introduce an event bus or shared store.

---

## Rule 8: Immutable State Updates

**State is never mutated in place. Always produce a new value.**

- Use spread operators, `map`, `filter`, `slice` — never `push`, `splice`, direct assignment.
- In Zustand, return new objects from actions rather than mutating `state` directly.
- Use `structuredClone` for deep copies when nested objects need full isolation.

```ts
// ❌ Mutation
const addMessage = (msg: Message) => {
  state.messages.push(msg);
};

// ✅ New reference
const addMessage = (msg: Message) => {
  set({ messages: [...get().messages, msg] });
};
```

---

## Rule 9: Explicit Over Implicit

**Prefer explicit code over "magic" abstractions.**

During migration, debugging time is more expensive than writing a few extra lines. Favor explicit function calls over dependency injection, named constants over magic numbers, direct conditionals over complex polymorphism, plain objects over class hierarchies.

- No metaprogramming (dynamic property access, `eval`, `Function` constructor).
- No implicit type coercion — use `===`, explicit `Boolean()`, `Number()`, etc.
- Configuration is always in plain objects, not decorators or DSLs.

---

## Rule 10: Test Coverage for New Code

**All new code in `web/` must have tests.**

- Pure utility functions → unit tests (Vitest).
- Custom hooks → render-hook tests (Testing Library).
- Components → interaction tests (Testing Library + user-event).
- API functions → mock tests (MSW or Vitest mock).
- Critical user flows → Playwright E2E tests.

Every PR adding new code must include corresponding test files. Coverage threshold: 80% line coverage on new files. If a bug is found and fixed, a regression test must accompany the fix.

---

## Rule 11: Documentation for Public APIs

- Every exported function, type, and component prop must have a JSDoc comment.
- Every store action must have a comment explaining when/why to call it.
- Every API function must document expected errors and edge cases.
- JSDoc must include `@param`, `@returns`, and `@throws` where applicable.
- Complex types must include `@example` blocks.

```ts
/**
 * Establishes a WebSocket connection for streaming assistant responses.
 * @param sessionId - The active session to stream messages for.
 * @param epoch - Incremented on each reconnection to invalidate stale callbacks.
 * @returns A cleanup function that closes the WebSocket and invalidates the epoch.
 * @throws {WebSocketError} If the connection cannot be established within 5 seconds.
 */
export function createStreamConnection(sessionId: string, epoch: number): () => void { … }
```

---

## Summary Checklist

| # | Rule | Key Question |
|---|---|---|
| 1 | Single State Owner | Is there one canonical source for every piece of state? |
| 2 | No Business Logic in Components | Does the component only render and delegate? |
| 3 | Cache Safety | Are WebSocket handlers guarded against stale context? |
| 4 | Role Alternation | Does the conversation array pass validation? |
| 5 | No God Files | Is every file under 5000 LOC? |
| 6 | API Boundary Isolation | Do all network calls go through `api/`? |
| 7 | Dependency Direction | Do imports point inward only? |
| 8 | Immutable State Updates | Are all state updates producing new references? |
| 9 | Explicit Over Implicit | Is the code free of magic/implicit behavior? |
| 10 | Test Coverage | Does every new file have corresponding tests? |
| 11 | Documentation for Public APIs | Are all exports documented with JSDoc? |
