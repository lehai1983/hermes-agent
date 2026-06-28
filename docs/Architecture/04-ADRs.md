# Architecture Decision Records

> **Audience:** Engineers, architects, and future contributors
> **Last updated:** 2026-06-28
> **Scope:** Web-first migration — key architectural choices and their rationale
> **Related:** [Current Architecture](01-Current-Architecture.md) · [Future Architecture](02-Future-Architecture.md) · [Migration Strategy](03-Migration-Strategy.md)

---

This document records the significant architectural decisions made during the Hermes Web-first migration. Each ADR follows the Michael Nygard template: **Status**, **Context**, **Decision**, **Consequences**, and **Alternatives considered**.

ADRs are immutable once marked *accepted* — they record the decision and its rationale at the time it was made. If a later decision supersedes an ADR, the ADR's status is changed to *superseded* with a pointer to the new ADR.

---

## ADR-001: Web-Native React Chat Renderer

**Status:** proposed

### Context

Hermes today renders chat inside the Desktop app using React components under `apps/desktop/src/components/assistant-ui/`. These components are tightly coupled to the Electron shell:

- They import Electron-specific APIs (`ipcRenderer`, `remote`) for file access, window management, and theme detection.
- The message stream is consumed via Electron IPC, not HTTP/WS.
- The `Ink`-based TUI renderer can also be embedded in the Web SPA via an iframe or xterm.js, but this re-introduces terminal-isms (VT100 escapes, cursor addressing) into a browser context.

The Web SPA currently has 18 pages but its chat experience is a thin wrapper that boots the embedded TUI over `/api/pty`. This means:

- Limited styling and interaction control (it's a terminal, not a React tree).
- Cannot progressively render rich content (images, cards, collapsible sections) — the TUI only knows character cells.
- Keyboard shortcuts and input handling fight between the browser and the embedded terminal.

### Decision

Build a **web-native React chat renderer** in `web/src/app/chat/` that directly consumes JSON-RPC events over the shared WebSocket (and, per ADR-002, SSE per-session streams). This renderer reuses the **component structure** and **message model** from `assistant-ui/*` but replaces all Electron/IPC dependencies with HTTP+WS equivalents.

Key implementation details:

| Desktop path | Web path | Change |
|---|---|---|
| `assistant-ui/MessageList` | `web/src/app/chat/MessageList` | IPC → fetch/SSE |
| `assistant-ui/Composer` | `web/src/app/chat/composer/` | Electron dialog → browser APIs |
| `assistant-ui/ToolCallCard` | `web/src/app/chat/ToolCallCard` | Remove `ipcRenderer` calls |

### Consequences

**Positive**

- Full control over rendering: progressive token streaming, rich content blocks, accessible markup.
- No VT100 escape-sequence parsing in the browser — simpler, faster.
- Chat components are first-class React citizens in the Web SPA: testable, themeable, composable.
- Paves the way for mobile-responsive chat without terminal emulation hacks.

**Negative**

- Duplicate component code until desktop is sunset (Phase 3). Mitigated by extracting shared sub-components into `@hermes/shared/ui`.
- Requires re-implementing features the TUI already provides: syntax highlighting, scrollback, search-in-chat. Most have mature React libraries (Shiki, virtua, cmdk).
- Larger initial payload than "just embed the TUI" — the chat renderer ships its own JS bundle.

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Embed TUI via xterm.js** (current approach) | Cannot render rich content; fights browser input handling; limited accessibility; no progressive rendering. |
| **Ship Ink components as WASM** | Ink's React-for-terminal is fundamentally a terminal renderer; WASM doesn't change the output medium. |
| **iframe embedding of Desktop chat** | Requires Electron shell in the browser; pulls in the entire desktop runtime; no isolation of chat concerns. |
| **Native Web Components (no React)** | Loses component ecosystem, state management, and 90% of the existing desktop chat code that is already React. |

---

## ADR-002: SSE for Per-Session Events

**Status:** proposed

### Context

Hermes currently has a single global WebSocket at `/api/ws` that **broadcasts all events to all connected clients**. There is no per-session or per-user filtering. This was acceptable for a single-user Desktop app where "all events" means "my events," but it breaks down for the Web SPA where:

- Multiple browser tabs may be open, each viewing a different session.
- A user should only see events for sessions they have access to.
- The global WS channel mixes high-frequency PTY byte streams with chat token deltas, making selective subscription impossible.
- Reconnection after a WS drop means re-subscribing to the entire firehose.

The Web SPA needs a way to subscribe to events for **one specific session** without receiving noise from all other sessions.

### Decision

Introduce a **Server-Sent Events (SSE) endpoint** at `/api/sessions/{id}/events` that streams only events belonging to session `{id}`. SSE is chosen over a per-session WebSocket because:

1. **SSE is HTTP** — it fits naturally into the existing `web_server.py` REST infrastructure (181 endpoints, 24 categories). No new WS handshake protocol needed.
2. **Auto-reconnect** — browsers natively retry SSE on disconnect with `Last-Event-ID` for gap-free replay.
3. **Unidirectional** — session events flow server→client only; client→server already uses JSON-RPC over the existing global WS or REST `POST`.
4. **Per-session isolation** — each SSE connection is scoped to one session; no multiplexing logic needed in the client.

The existing global `/api/ws` remains for:
- Connection-level events (agent online/offline, config changes)
- Outbound JSON-RPC requests (client → server)
- PTY byte streams (`/api/pty`)

### Consequences

**Positive**

- Clean separation: real-time session events via SSE, control-plane via WS/REST.
- Browser-native reconnection with `Last-Event-ID` — no custom heartbeat logic.
- Per-session filtering is trivial — the endpoint path is the filter.
- SSE works through corporate proxies and CDNs that block or upgrade WS frames.

**Negative**

- Two transport mechanisms (SSE + WS) to monitor in observability dashboards.
- SSE is unidirectional — if we later need client→server per-session streams, we'd add a REST endpoint (already the pattern for `POST /api/sessions/{id}/messages`).
- SSE connections are long-lived HTTP responses — server must manage connection limits (default Linux `somaxconn` is typically 4096; sufficient for personal-agent scale).

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Per-session WebSocket** (`/api/sessions/{id}/ws`) | Full-duplex is overkill — session events are server→client only; adds WS handshake overhead per session; harder to proxy/CDN. |
| **Filter on existing global WS** (client-side) | Leaks all events to all clients — security and privacy issue at multi-user scale; wastes bandwidth. |
| **Long-polling REST** | Higher latency, more header overhead, no native reconnect; strictly worse than SSE for streaming. |
| **GraphQL subscriptions** | Requires adding a GraphQL server layer; Hermes is JSON-RPC, not GraphQL. Massive architectural mismatch. |

---

## ADR-003: @hermes/shared as Canonical Type Catalog

**Status:** proposed

### Context

Hermes has two TypeScript frontends (Desktop and Web SPA) and a Python backend (`tui_gateway/server.py` with 123 JSON-RPC methods). Today, type consistency between frontend and backend is maintained **manually**:

- `@hermes/shared` exports only a handful of transport types: `JsonRpcGatewayClient`, `GatewayEvent`, `ConnectionState`, `WebSocketLike`, etc.
- Request/response shapes for the 123 JSON-RPC methods are implicitly defined in Python docstrings and doc pages, not in TypeScript.
- The Desktop and Web frontends each define their own ad-hoc interfaces for the same backend shapes, leading to drift.

As migration proceeds, the probability of type drift between frontends and backend approaches 1.0 without a canonical source of truth.

### Decision

Establish **`@hermes/shared` as the canonical type catalog** for all JSON-RPC method signatures, event payloads, and shared domain models. The workflow is:

1. **Human-authored TypeScript types** in `@hermes/shared` are the source of truth.
2. Both frontends import types from `@hermes/shared` — no duplicate definitions.
3. Python-side validation uses **Pydantic models** that are **hand-kept in sync** with the TypeScript types (validated by integration tests, not code generation).
4. A CI check (`typecheck-cross`) serializes Pydantic schemas to JSON Schema and compares against `@hermes/shared`'s exported TypeScript types, failing on drift.

What goes into `@hermes/shared`:
- All JSON-RPC method request/response types (e.g., `SessionCreateRequest`, `ShellExecResponse`)
- All SSE event payload types (e.g., `TokenDeltaEvent`, `ToolCallStartEvent`)
- Domain enums (e.g., `SessionState`, `ToolCallStatus`, `ConnectionState`)
- Shared transport interfaces (`JsonRpcGatewayClient`, `GatewayEvent`)
- Shared UI primitives (timestamp formatters, markdown config — **not** full components)

### Consequences

**Positive**

- Single source of truth — no type drift between Desktop and Web frontends.
- TypeScript types naturally document the API for frontend engineers.
- CI drift detection catches mismatches before they reach production.
- No code-generation toolchain to maintain, debug, or upgrade.
- `@hermes/shared` is a pure TypeScript package — no build-time dependency on Python.

**Negative**

- Manual sync between TypeScript types and Pydantic models — humans must update both sides.
- CI check is only as good as its coverage — new methods added without types won't be caught until the check is added to the method registry.
- `@hermes/shared` becomes a high-traffic package; changes here potentially affect both frontends simultaneously.

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Code generation from Python** (e.g., `pydantic → Typescript`) | Requires running Python at frontend build time; fragile across Python/TS version bumps; generated code is hard to read and debug; couples frontend CI to Python runtime. |
| **OpenAPI / JSON Schema codegen** | Hermes uses JSON-RPC, not REST — OpenAPI doesn't natively describe JSON-RPC method signatures without custom extensions. |
| **Code generation from TypeScript → Python** | Inverts the natural authority (backend defines behavior, types should match it); TS→Python generators are less mature; Python loses Pydantic runtime validation if types are generated. |
| **No shared types (status quo)** | Guaranteed type drift as migration proceeds; already causing bugs between Desktop and Web frontends. |

---

## ADR-004: Progressive Migration

**Status:** proposed

### Context

The Hermes Web-first migration affects:

- **123 JSON-RPC methods** in the gateway
- **181 REST endpoints** in the web server
- **5 WebSocket endpoints**
- **~30 desktop React components** that must be adapted or replaced
- **~10 desktop routes** that must be mapped to web SPA pages
- **Build tooling** (Electron → Vite, native modules → browser APIs)

A big-bang rewrite (tear down Desktop, ship Web) would touch every layer simultaneously. The team is small (≤5 engineers) and the system is in production with active users on both Desktop and Web.

### Decision

Adopt **progressive migration** in three independently-shippable phases (as detailed in [03-Migration-Strategy.md](03-Migration-Strategy.md)):

| Phase | Duration | Deliverable | Rollback |
|---|---|---|---|
| **1 — Foundation** | Months 1–3 | `@hermes/shared` type catalog; SSE endpoint; web-native chat renderer (alpha behind feature flag) | Feature flag off → existing embedded TUI |
| **2 — Migration** | Months 4–6 | Web-native chat is default; embedded TUI at `/embed`; desktop feature-frozen | User toggle back to `/embed` for 60 days |
| **3 — Sunset** | Months 7–12 | Desktop in maintenance mode; web is primary; desktop-only features dropped per ADR-005 | Desktop remains available (no removal, just no new features) |

Key principles:
- **Each phase is independently deployable.** Phase 1 does not require Phase 2 to be valuable.
- **Feature flags** guard every new web-native path. If something breaks, users fall back instantly.
- **Desktop is never forcibly removed.** It transitions to maintenance mode, not deletion.
- **Agent core (`run_agent.py`, `model_tools.py`, `toolsets.py`, `hermes_state.py`) is unchanged throughout.**

### Consequences

**Positive**

- Zero user downtime — each phase is additive.
- Risk is bounded — a bad phase-1 deploy doesn't affect existing Desktop users.
- Team can ship incremental value and get feedback every sprint, not after a 6-month rewrite.
- Preserves the agent core — the most complex and highest-risk code is untouched.

**Negative**

- Longer total project duration than big-bang (12 months vs. 6 months of concentrated effort).
- Temporary code duplication: both old and new chat renderers coexist during Phase 2.
- Feature-flag proliferation — need disciplined cleanup in Phase 3.
- "Two systems to maintain" period during Phases 1–2 — bug fixes may need to be applied twice.

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Big-bang rewrite** (6-month branch, merge all at once) | Unbounded risk: 123 methods + 181 endpoints + 30 components all change simultaneously. Merge conflicts compound. No partial value until the entire branch lands. |
| **Strangler fig** (route-by-route redirect) | Hermes is a SPA, not a page-per-route server app — you can't gradually redirect individual React routes to a "new" SPA. The granularity is the whole frontend. |
| **Parallel implementation** (build new Web SPA from scratch alongside Desktop) | Doubles maintenance burden with no shared code; drift between implementations is guaranteed; no incremental user value. |

---

## ADR-005: Desktop Feature Drop Policy

**Status:** proposed

### Context

The Desktop (Electron) app has features with no natural web equivalent or that depend on OS-level APIs unavailable in the browser. These include:

| Desktop feature | Depends on |
|---|---|
| Pet overlay (transparent always-on-top window) | Electron `BrowserWindow` transparency + always-on-top |
| PTY terminal (`pt_Terminal`) | Node `pty.js` — OS-level pseudoterminal |
| Git review (file diffs in sidebar) | Node `fs` + `child_process` for git |
| Right-sidebar file browser | Node `fs` for directory traversal |
| Multi-window / split-pane | Electron multi-`BrowserWindow` |
| Haptics (vibration, force-touch) | OS haptic APIs |
| Translucency / vibrancy | Electron window `vibrancy` flag |

Some of these can be **reimagined** for the web; others must be **dropped** with no replacement.

### Decision

Apply a three-category classification to every desktop-only feature:

#### Category A — Reimagine for Web
The feature's **user goal** is preserved, but the **implementation** changes to use web-native capabilities.

| Desktop feature | Web reimagining |
|---|---|
| Git review sidebar | In-browser diff viewer (Monaco diff editor); `GET /api/files/diff` endpoint instead of local `git` |
| Right-sidebar file browser | Cloud file browser using `GET /api/files/tree`; already partially implemented in Web SPA |
| PTY terminal | WebPTTY via WASM, rendered by `xterm.js` (see ADR-007) |

#### Category B — Drop with Graceful Degradation
The feature has no web equivalent. The UI explicitly communicates its absence and, where possible, offers a reduced fallback.

| Desktop feature | Web fallback |
|---|---|
| Pet overlay | No overlay in browser (windowless rendering is impossible). Badge notification on the web tab instead. |
| Multi-window / split-pane | Single-window with tabs. Users can open multiple browser tabs for split workflows. |
| Haptics | No replacement — web has limited `navigator.vibrate()` support. Feature silently disabled. |
| Translucency / vibrancy | Standard web theming with CSS `backdrop-filter`. Visually similar, not identical. |

#### Category C — Drop Without Fallback
Feature is desktop-only by nature and cannot be approximated.

| Desktop feature | Rationale |
|---|---|
| Electron auto-updater | Replaced by PWA service-worker update flow — different mechanism, not a "fallback". |
| Native filesystem watch (`chokidar`) | Replaced by SSE file-change events from server — fundamentally different. |

#### Decision Framework (for new features)

When a desktop feature not listed above is encountered during migration:

1. **Does a browser API approximate it?** → Category A (reimagine).
2. **Can we accept reduced functionality?** → Category B (drop with degradation).
3. **Is it inherently OS-level?** → Category C (drop without fallback).
4. **Is it high-impact and irreplaceable?** → Escalate to architecture review — may block web-first completion until resolved.

### Consequences

**Positive**

- Explicit policy prevents endless debate over each desktop feature.
- Users get clear messaging: "This feature is desktop-only" rather than silent breakage.
- Reimagined features (Category A) often end up **better** on the web (e.g., cloud file browser works on mobile; in-browser diffs don't require local git).
- Category B/C drops are documented — no surprises.

**Negative**

- Power users who rely on pet overlay or multi-window will lose functionality.
- "Open multiple browser tabs" is a weaker UX than true split-pane (no synchronized scrolling, shared state requires broadcast channel API).
- The decision framework is qualitative — edge cases will require architecture review, slowing migration.

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Keep all features via Electron-in-browser (CEF)** | Defeats the purpose of web-first — we'd be shipping Electron again, just in a browser tab. |
| **Feature parity at all costs** | Blocks migration indefinitely; some features (pet overlay) are literally impossible in a browser. |
| **Drop everything, no fallbacks** | Abrupt UX regression; users lose functionality with zero notice or workaround. |
| **Plugin-based reimplementation** ("let the community reimagine") | Offloads core UX decisions to plugin authors; no guarantee of quality or timeline. |

---

## ADR-006: Auth v2 — JWT + Per-User RBAC

**Status:** proposed

### Context

Hermes today runs as a **single-user local agent**. Authentication, if present, is a single API key shared across all clients. Authorization is binary: you either have the key (full access) or you don't (no access). This model is sufficient for:

- Personal Desktop use (one user, one machine)
- Local network access from trusted devices

It **breaks down** for:

- **Multi-tab web usage** — all tabs share one API key; no way to track which tab initiated a request.
- **Shared deployments** — a team or household running one Hermes instance with multiple users who should have different permissions (e.g., a guest who can chat but not modify skills/cron).
- **Remote access** — exposing the Web SPA beyond localhost requires real authentication; the API key in a URL or local storage is a weak bearer token.
- **Audit** — with one identity per instance, per-user action logging is impossible.

### Decision

Introduce **Auth v2: JWT-based authentication + per-user Role-Based Access Control (RBAC)** when any of the following triggers are met:

| Trigger | Threshold |
|---|---|
| Web SPA exposed beyond `localhost` | Remote access → auth required |
| ≥2 named users in `hermes_state.db` | Multi-user → RBAC required |
| Audit logging enabled | Per-user identity → JWT required |

**Implementation plan** (NOT in Phase 1 — deferred to Phase 2 or later):

1. **JWT issuance** — `/api/auth/login` accepts credentials (Hermes-local or OAuth proxy), returns signed JWT.
2. **JWT validation middleware** — all REST/WS/SSE endpoints validate JWT from `Authorization: Bearer <token>` or cookie.
3. **Per-user RBAC** — `users` table in `hermes_state.db` with roles: `admin`, `user`, `viewer`. Role determines which JSON-RPC methods and REST categories are accessible.
4. **API key backward compat** — existing `?api_key=` query-param auth continues to work as a legacy `admin` role. Deprecated, not removed.
5. **SSE scoping** — SSE connections (per ADR-002) are scoped to both session ID **and** the authenticated user. A user cannot subscribe to another user's session events.

**What does NOT change:**
- Agent core is unaware of auth — the gateway middleware strips auth before forwarding to `run_agent.py`.
- Single-user localhost mode continues without JWT — zero-friction local dev.

### Consequences

**Positive**

- Web SPA can be safely exposed beyond localhost.
- Per-user session isolation — browser tabs for different users don't leak events.
- Foundation for team/household shared deployments.
- Audit trail: every request is attributed to a named user.
- Backward compatible — existing API-key auth continues to work.

**Negative**

- Added complexity in the gateway — JWT validation on every request is ~0.5 ms overhead.
- Credential management UX — login page, token refresh, session expiry. Complexity that doesn't exist today.
- Risk of over-engineering for a product that may remain single-user. Mitigated by making auth opt-in (only when trigger conditions are met).
- Integration testing complexity — every endpoint test now needs a valid JWT.

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **API key per user** (no JWT) | API keys are long-lived, not scoped; can't encode role or expiry; must be stored server-side for revocation. JWT is self-contained. |
| **OAuth-only** (delegate to GitHub/Google) | Requires internet and external IdP; Hermes is a local-first tool that should work offline. OAuth can be a *provider* for JWT, not a replacement. |
| **HTTP Basic Auth** | Credentials sent on every request; no session concept; no role encoding; works but is strictly worse than JWT for this use case. |
| **No auth (status quo forever)** | Blocks remote access and multi-user; security liability if Web SPA is exposed. |

---

## ADR-007: No New pt_Terminal Emulation for Web — Use WebPTTY (WASM) via xterm.js Addon

**Status:** proposed

### Context

Hermes provides a terminal (PTY) experience through the Desktop app using Node.js's `pty.js`, which creates a real OS-level pseudoterminal. The PTY byte stream flows over the `/api/pty` WebSocket.

For the Web SPA, we need terminal functionality for:

- **Tool output** — some agent tools (shell, python) produce terminal-formatted output (ANSI escapes, colors, progress bars).
- **Interactive shell sessions** — users want a real terminal inside the web UI.
- **Session scrollback** — terminal history persists across page reloads.

The Desktop uses `pt_Terminal`, a custom terminal component built on xterm.js with native PTY integration. We could port `pt_Terminal` to the web, but it depends on Node.js `pty.js` for the PTY — which doesn't exist in the browser.

### Decision

**Do not build a new `pt_Terminal` emulation layer for the Web.** Instead, use **WebPTTY** (a WASM-based PTY) via the existing `xterm.js` addon system:

```
┌─────────────────────┐     ┌──────────────────────┐
│  xterm.js (v5+)     │◄────│  WebPTTY WASM addon  │
│  (rendering only)   │     │  (provides PTY in    │
│                     │     │   browser via WASM)  │
└─────────────────────┘     └──────────┬───────────┘
                                       │
                              PTY byte stream
                                       │
                            ┌──────────▼───────────┐
                            │  /api/pty WebSocket   │
                            │  (unchanged)          │
                            └──────────────────────┘
```

How it works:

1. **WebPTTY** compiles a minimal PTY (derived from vscode's WASM terminal or similar) to WebAssembly.
2. The WASM PTY runs **in the browser** — it handles ANSI parsing, line discipline, and scrollback.
3. The actual shell process still runs **on the server** (you can't `fork()` in WASM). The WASM PTY sends keystrokes to `/api/pty` and receives byte frames back.
4. **xterm.js** renders the PTY output — its addon system (`Terminal.loadAddon()`) makes integration clean.

Why not port `pt_Terminal`:
- `pt_Terminal` is ~3000 LOC of desktop-specific code with deep Node.js integration (child_process, fs, native modules).
- Porting it means rewriting the PTY layer anyway — and we'd write a worse one than the WASM projects that already exist.
- The xterm.js + WASM PTY approach is the same architecture VS Code uses for its remote terminal — battle-tested.

### Consequences

**Positive**

- No custom PTY emulation to maintain — leverage existing WASM PTY projects.
- xterm.js is already a dependency (Desktop uses it); no new rendering library.
- WASM PTY + xterm.js is the VS Code remote-terminal architecture — well-understood, well-documented.
- Terminal sessions work identically on Desktop and Web — same xterm.js rendering.
- Server-side `/api/pty` WebSocket is unchanged — no backend changes.

**Negative**

- WASM PTY binary is ~2 MB added to the web bundle (lazy-loaded, not in initial chunk).
- Latency: every keystake traverses network to server PTY and back. On high-latency connections, typing feels laggy. Mitigated by xterm.js local echo.
- WASM has browser compatibility constraints — requires WebAssembly support (all modern browsers since 2018; IE not supported, which is fine).
- Two terminal implementations temporarily: Desktop's native `pt_Terminal` and Web's WASM PTY. Divergence risk mitigated by sharing xterm.js configuration.

### Alternatives Considered

| Alternative | Why rejected |
|---|---|
| **Port `pt_Terminal` to web with polyfills** | 3000 LOC of Node.js-specific code; polyfilling `child_process` + `pty.js` in the browser is essentially what WASM PTY does, but worse — we'd be writing a custom PTY emulator. |
| **Server-side rendering, stream to client** (no WASM) | Server renders terminal to HTML/ANSI, streams to client. Loses interactivity (no keystroke handling, no cursor movement). Only suitable for read-only output, not interactive shells. |
| **Embed terminal provider via iframe** (e.g., ttyd, webssh) | Adds a second HTTP server; framing issues; can't share auth context; security risk of exposing a separate terminal service. |
| **Drop terminal entirely from web** | Unacceptable for a developer tool — terminal access is a core part of the Hermes experience. |

---

## Appendix: ADR Index

| ADR | Title | Status |
|---|---|---|
| ADR-001 | Web-Native React Chat Renderer | proposed |
| ADR-002 | SSE for Per-Session Events | proposed |
| ADR-003 | @hermes/shared as Canonical Type Catalog | proposed |
| ADR-004 | Progressive Migration | proposed |
| ADR-005 | Desktop Feature Drop Policy | proposed |
| ADR-006 | Auth v2 — JWT + Per-User RBAC | proposed |
| ADR-007 | No New pt_Terminal Emulation for Web | proposed |
