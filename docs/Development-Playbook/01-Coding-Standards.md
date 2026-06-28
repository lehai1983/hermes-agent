# 01 — Coding Standards

> TypeScript style conventions for the `web/` directory and shared frontend code.

## 1. TypeScript Strictness

All code in `web/` **MUST** compile under the strictest settings. The project's `tsconfig.json` already enables:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true
  }
}
```

Consequences of these settings:

- `noUncheckedIndexedAccess` → every `obj[key]` access is `T | undefined`. Handle it.
- `verbatimModuleSyntax` → `import type { … }` is mandatory for type-only imports.
- `exactOptionalPropertyTypes` → `foo?: T` means "absent or `T`", **not** "absent, `T`, or `undefined`". Do not explicitly assign `undefined` to optional props.

**Do not** use `@ts-ignore` or `@ts-expect-error` without a comment explaining the specific compiler limitation being worked around. If you must suppress, prefer narrowing the suppression to a single expression.

## 2. Type Discipline

### 2.1 Prefer `interface` over `type` for object shapes

```ts
// ✅ Good
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

// ❌ Avoid for plain objects
type ChatMessage = { … };
```

Use `type` for unions, intersections, mapped types, and tuples.

### 2.2 No `any` without justification

- `unknown` is the safe fallback for truly unknown data (e.g., parsed JSON, WebSocket payloads).
- If `any` is unavoidable (third-party library gap), wrap it in a typed boundary function and add a `// FIXME(any): <reason>` comment.

### 2.3 Branded types for IDs

Use branded types to prevent mixing up string IDs at call sites:

```ts
type SessionId = string & { __brand: "SessionId" };
type MessageId = string & { __brand: "MessageId" };

function fetchMessage(id: MessageId): Promise<Message> { … }
```

### 2.4 Return-type annotations on exported functions

All exported functions **MUST** have an explicit return-type annotation. Internal helpers may omit it when the return type is trivially inferred.

```ts
// ✅ Required
export function parseStreamEvent(raw: unknown): StreamEvent { … }

// ✅ Allowed (internal, trivially inferred)
const isActive = (s: State) => s.status === "active";
```

## 3. Import Conventions

### 3.1 Import order

Imports are grouped and ordered as follows, separated by blank lines:

1. Node built-ins (`node:fs`, `node:path`, etc.)
2. External dependencies (React, Vite, etc.)
3. Internal absolute aliases (`@/…`, `@chat/…`, `@shared/…`)
4. Relative imports (`./foo`, `../bar`)

```ts
import { useEffect, useState } from "react";
import { create } from "zustand";

import { useSessionStore } from "@/stores/session";
import { StreamEvent } from "@/types/stream";

import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
```

### 3.2 Type-only imports

With `verbatimModuleSyntax`, type imports **MUST** use `import type`:

```ts
import type { ChatMessage } from "@/types";
import { type SessionId, fetchSession } from "@/api";
```

### 3.3 No barrel imports from large modules

Avoid `import * as Foo from "@/utils"`. Import specific symbols. This keeps tree-shaking effective and reduces coupling.

### 3.4 No circular imports

Circular imports are a maintenance hazard. If two modules need each other, extract a third module holding the shared types or logic.

## 4. Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `MessageList.tsx` |
| Files (utilities) | camelCase | `streamParser.ts` |
| Files (types) | PascalCase or camelCase | `ChatMessage.ts` or `chatMessage.types.ts` |
| Components | PascalCase | `function MessageBubble({ … })` |
| Props interfaces | Component name + `Props` | `MessageBubbleProps` |
| Hooks | `use` prefix (camelCase) | `useStreamConnection` |
| Stores (Zustand) | `use…Store` | `useSessionStore` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Enums (const objects) | PascalSCREAMING_SNAKE | `const Status = { Active: "active" … }` |
| Type aliases | PascalCase | `type RetryPolicy = …` |
| Booleans | `is`, `has`, `can`, `should` prefix | `isConnected`, `hasError` |

### 4.1 Event handlers

Use the `handle` prefix for component-internal handlers:

```ts
const handleSubmit = (e: FormEvent) => { … };
```

Do **not** prefix prop callbacks — those are `on` prefixed by the parent:

```ts
<ChatInput onSubmit={handleSubmit} />
```

## 5. React Component Rules

### 5.1 Function components only

No class components. Every component is a function.

### 5.2 Props destructuring

Destructure props in the function signature, not in the body:

```ts
// ✅ Good
function MessageBubble({ id, content, timestamp }: MessageBubbleProps) { … }

// ❌ Avoid
function MessageBubble(props: MessageBubbleProps) {
  const { id, content, timestamp } = props;
}
```

### 5.3 Default exports

Only the page-level component (the one referenced by the router) may use a default export. All other files use named exports.

### 5.4 Component size

If a component exceeds **200 lines**, extract sub-components or custom hooks. If it exceeds **400 lines**, it **MUST** be split.

### 5.5 Hooks rules

- Follow the Rules of Hooks (no conditional calls).
- Custom hooks must be pure functions that use other hooks — no side effects at the top level of a custom hook.
- `useEffect` must include a dependency array (no "run every render" effects).

### 5.6 State colocation

Keep state as close to where it's used as possible. Lift only when multiple siblings need it. Prefer React Context for mid-tree sharing; use Zustand stores for cross-cutting concerns (session, connection status).

## 6. Styling

### 6.1 Tailwind CSS

The project uses Tailwind CSS. Use utility classes directly in JSX. Avoid inline `style` props unless the value is computed at runtime (e.g., a dynamic position).

### 6.2 No CSS Modules or styled-components

Tailwind is the sole styling solution. Do not introduce alternative styling approaches.

### 6.3 Responsive design

Mobile-first. Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) to layer desktop enhancements.

## 7. Error Handling

### 7.1 Boundaries

Every route and every major UI section must be wrapped in a React Error Boundary. The project provides `<ErrorBoundary>` in `@/components/common`.

### 7.2 Async errors

Never swallow errors from async operations. At minimum, log to the console in development and surface via the app's error notification system in production.

```ts
// ✅ Good
try {
  const data = await fetchSession(id);
  setData(data);
} catch (err) {
  notify.error("Failed to load session");
  console.error("[SessionLoader] fetch failed", err);
}
```

### 7.3 No empty catch blocks

`catch {}` (without even a variable) is forbidden. If you truly want to ignore an error, add a comment explaining why.

## 8. Code Formatting

- **Formatter:** Prettier (config in `.prettierrc`).
- **Line length:** 100 characters.
- **Semicolons:** Required.
- **Quotes:** Single quotes for JS/TS, double quotes for JSX attributes.
- **Trailing commas:** Required in multi-line structures.

Formatting is enforced in CI. Run `npm run format` before pushing.

## 9. Linting

ESLint runs with the following non-negotiable rules:

- `no-console`: warn (allowed only in dev-only code paths)
- `no-unused-vars`: error
- `prefer-const`: error
- `no-magic-numbers`: warn (use named constants)

Run `npm run lint` before pushing.

## 10. File Organization

```
web/src/
├── api/            # HTTP and WebSocket client functions
├── components/     # UI components (common/, chat/, layout/)
├── hooks/          # Custom React hooks
├── stores/         # Zustand stores
├── types/          # Shared TypeScript types
├── utils/          # Pure utility functions
├── pages/          # Route-level page components
└── lib/            # Third-party library configuration
```

- One component per file.
- Co-locate related test files: `MessageBubble.tsx` → `MessageBubble.test.tsx`.
- Shared types go in `types/`, not in component files.
