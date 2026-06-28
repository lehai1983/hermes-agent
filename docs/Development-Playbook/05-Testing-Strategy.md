# 05 — Testing Strategy

> Testing strategy for new web chat components and migration code.

The web migration requires a multi-layered testing approach. Each layer catches different classes of bugs.

---

## Testing Pyramid

```
              ┌─────────────┐
              │    E2E      │  ← Playwright (few, critical paths)
              ├─────────────┤
              │ Integration │  ← Vitest + MSW + mock WS (moderate)
              ├─────────────┤
              │    Unit     │  ← Vitest (many, fast)
              └─────────────┘
```

**Distribution target:** 70% unit, 20% integration, 10% E2E.

---

## Layer 1: Unit Tests (Vitest)

**What to test:** Pure utility functions, type guards, validators, data transformations, constants.

```ts
import { describe, it, expect } from "vitest";
import { sortMessages, validateConversation } from "@/utils/messageUtils";

describe("sortMessages", () => {
  it("sorts by timestamp ascending", () => {
    const input = [
      { id: "1", timestamp: 300 },
      { id: "2", timestamp: 100 },
      { id: "3", timestamp: 200 },
    ];
    const result = sortMessages(input);
    expect(result.map(m => m.id)).toEqual(["2", "3", "1"]);
  });

  it("returns empty array for empty input", () => {
    expect(sortMessages([])).toEqual([]);
  });
});
```

**Rules:** One test file per source file. Tests must be deterministic. Test edge cases. Mock external dependencies. **Coverage target:** 90% for `utils/`, 80% for all new files.

---

## Layer 2: Component Tests (Testing Library)

**What to test:** Rendering, user interactions, conditional rendering, accessibility.

```ts
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MessageBubble } from "@/components/chat/MessageBubble";

describe("MessageBubble", () => {
  it("renders content text", () => {
    render(<MessageBubble content="Hello world" role="assistant" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("calls onCopy when copy button is clicked", async () => {
    const onCopy = vi.fn();
    render(<MessageBubble content="Copy me" role="assistant" onCopy={onCopy} />);
    await userEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(onCopy).toHaveBeenCalledWith("Copy me");
  });
});
```

**Rules:** Test behavior, not implementation. Use `getByRole`/`getByText` over `getByTestId`. Use `userEvent` over `fireEvent`. Wrap in providers via a custom `renderWithProviders`.

---

## Layer 3: Hook Tests (renderHook)

**What to test:** Custom hooks, state changes, side effects.

```ts
import { renderHook, act } from "@testing-library/react";
import { useStreamConnection } from "@/hooks/useStreamConnection";

describe("useStreamConnection", () => {
  it("starts in disconnected state", () => {
    const { result } = renderHook(() => useStreamConnection("session-1"));
    expect(result.current.isConnected).toBe(false);
  });

  it("connects and updates state", async () => {
    const { result } = renderHook(() => useStreamConnection("session-1"));
    await act(async () => { await result.current.connect(); });
    expect(result.current.isConnected).toBe(true);
  });
});
```

**Rules:** Test the public interface. Mock WebSocket. Test cleanup on unmount.

---

## Layer 4: Store Tests (Vitest)

**What to test:** Zustand store actions, state transitions, selectors.

```ts
import { useSessionStore } from "@/stores/sessionStore";
import { fetchSession } from "@/api/session";
vi.mock("@/api/session");

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.setState({ current: null, status: "idle" });
  });

  it("fetches and sets session", async () => {
    const session = { id: "s1", title: "Test", messages: [] };
    vi.mocked(fetchSession).mockResolvedValue(session);
    await useSessionStore.getState().loadSession("s1");
    expect(useSessionStore.getState().current).toEqual(session);
  });
});
```

**Rules:** Reset state between tests. Mock API functions. Test success and error paths. Verify immutability.

---

## Layer 5: API Tests (Vitest + MSW)

**What to test:** HTTP API functions, request construction, response parsing, error handling.

```ts
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { fetchSession } from "@/api/session";

const server = setupServer(
  http.get("/api/sessions/:id", () => {
    return HttpResponse.json({ id: "s1", title: "Test", messages: [] });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("fetchSession", () => {
  it("returns session data on success", async () => {
    const session = await fetchSession("s1");
    expect(session.id).toBe("s1");
  });
});
```

**Rules:** Use MSW for HTTP mocking. Test timeout, retry, and error scenarios. Verify request headers.

---

## Layer 6: Integration Tests (Vitest + RTL)

**What to test:** Multi-component compositions, store + component interaction, API + store + component data flow.

```ts
import { renderWithProviders } from "@/test-utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPage } from "@/pages/ChatPage";

describe("ChatPage integration", () => {
  it("loads and displays messages", async () => {
    renderWithProviders(<ChatPage sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });
  });
});
```

**Rules:** Use full provider stack. Mock only the network layer. One flow per test.

---

## Layer 7: E2E Tests (Playwright)

**What to test:** Critical user flows, visual regression, real WebSocket streaming.

```ts
import { test, expect } from "@playwright/test";

test.describe("Chat Flow", () => {
  test("user sends message and receives streamed response", async ({ page }) => {
    await page.goto("/chat/session-1");
    await expect(page.getByText("Test Session")).toBeVisible();
    const input = page.getByRole("textbox", { name: /message/i });
    await input.fill("What is Hermes?");
    await input.press("Enter");
    await expect(page.getByText("What is Hermes?")).toBeVisible();
    const assistantMessage = page.locator("[data-role='assistant']").last();
    await expect(assistantMessage).toBeVisible({ timeout: 30000 });
  });
});
```

**Rules:** Use role-based selectors. Tests must be idempotent. Run in CI on every PR.

---

## CI Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Lint &  │───▶│  Unit &  │───▶│   Int.   │───▶│   E2E    │
│  Format  │    │  Comp.   │    │  Tests   │    │  Tests   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
   ~30s           ~2min           ~3min          ~5min
```

1. **Pre-commit (local):** lint-staged runs ESLint and Prettier.
2. **PR CI:** lint, format, type-check, unit tests, component tests, integration tests.
3. **Main branch CI:** all of the above + E2E tests.
4. **Nightly:** full E2E suite + performance benchmarks.

---

## Test Data

Use factory functions to create test data:

```ts
import type { ChatMessage, Session } from "@/types";

export function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content: "Test message",
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: crypto.randomUUID(),
    title: "Test Session",
    messages: [],
    createdAt: Date.now(),
    ...overrides,
  };
}
```

---

## Debugging Failed Tests

1. Read the error message carefully.
2. Reproduce locally: `vitest run -t "test name"`.
3. Check for race conditions — use `waitFor`.
4. Check for stale mocks — reset between tests.
5. Use `--reporter=verbose` for detailed output.
6. For Playwright: `npx playwright test --debug`.

---

## Summary

| Layer | Tool | Speed | Scope | Count |
|---|---|---|---|---|
| Unit | Vitest | Instant | Single function | Many |
| Component | Testing Library | Fast | Single component | Many |
| Hook | renderHook | Fast | Single hook | Moderate |
| Store | Vitest | Fast | Store actions | Moderate |
| API | Vitest + MSW | Fast | API functions | Moderate |
| Integration | Vitest + RTL | Medium | Multi-component | Some |
| E2E | Playwright | Slow | Full flows | Few |
