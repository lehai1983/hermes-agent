# 01 — System Boundaries

## 1. Purpose

This document defines the ownership boundaries between the four runtime surfaces
in the Hermes Agent system:

| Surface | Code root | Runs where |
|---------|-----------|------------|
| **Frontend** (SPA) | `web/src/` | Browser |
| **Backend** (REST/WS server) | `hermes_cli/web_server.py` | Dashboard process (`hermes dashboard`) |
| **Gateway** (JSON-RPC dispatcher) | `tui_gateway/server.py` | Agent subprocess (`hermes --tui` or embedded) |
| **Agent Core** (LLM loop) | `agent/`, `tools/`, `model_tools.py` | Inside the gateway process |

The Web-first migration collapses the historical 4-surface split into 3
surfaces (Frontend + Backend + Gateway/Agent co-located in a single browser-
side WebSocket contract) while preserving the same logical boundaries.

---

## 2. Logical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (web/src/)                                                 │
│                                                                     │
│  ChatPage.tsx  ←─ new React chat (replaces xterm PTY embed)        │
│  gatewayClient.ts  ←─ WebSocket JSON-RPC client                    │
│  api.ts         ←─ REST client (/api/*)                            │
│  themes/        ←─ Design tokens, CSS variables                    │
│  plugins/       ←─ Dashboard plugins (kanban, webhooks, etc.)      │
│                                                                     │
│  Owns:                                                              │
│    • All UI rendering (React components, terminal emulator)         │
│    • Theme state, profile scope, sidebar state                      │
│    • Session-list, file-browser, config pages                      │
│    • Voice capture (Web Audio API → /api/audio/transcribe)         │
│    • File drag-and-drop (DnD → /api/files/upload-stream)           │
│    • Per-session SSE stream (EventSource or fetch-stream)          │
│                                                                     │
│  MUST NOT:                                                          │
│    • Import Python modules or reference server internals             │
│    • Access SQLite / filesystem directly                            │
│    • Construct JSON-RPC method strings (delegates to GatewayClient) │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  WebSocket (/api/ws) + REST (/api/*)
                           │  Auth: X-Hermes-Session-Token header
                           │         OR ?ticket=<single-use> (gated)
┌──────────────────────────▼──────────────────────────────────────────┐
│  BACKEND (hermes_cli/web_server.py)                                 │
│                                                                     │
│  FastAPI app serving:                                               │
│    • REST endpoints (/api/config, /api/sessions, /api/files, ...)  │
│    • WebSocket endpoints (/api/ws, /api/pty, /api/pub,             │
│      /api/events)                                                   │
│    • Static SPA (web_dist/)                                         │
│    • Auth middleware (session token, OAuth gate, host header)      │
│                                                                     │
│  Owns:                                                              │
│    • AuthN/Z (session tokens, OAuth flow, host-header guard)       │
│    • Config read/write (YAML → SQLite cache)                       │
│    • Session CRUD against state.db                                 │
│    • File I/O (sandboxed to HERMES_HOME)                           │
│    • Cron scheduling (cron.scheduler_provider)                     │
│    • Memory provider OAuth handshake                               │
│    • Audio transcription proxy (/api/audio/transcribe)              │
│    • TTS proxy (/api/audio/speak)                                  │
│    • MCP server CRUD                                               │
│    • Profile management                                            │
│                                                                     │
│  MUST NOT:                                                          │
│    • Run the LLM loop (no agent import except status queries)      │
│    • Hold tool state (tool registry lives in gateway)              │
│    • Execute shell commands (except PTY spawn for legacy TUI)      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  stdio (legacy) OR WebSocket tunnel
                           │  JSON-RPC 2.0 protocol
┌──────────────────────────▼──────────────────────────────────────────┐
│  GATEWAY (tui_gateway/server.py)                                    │
│                                                                     │
│  JSON-RPC dispatcher:                                               │
│    • 123 registered methods (session.*, shell.*, config.*,         │
│      model.*, tool.*, project.*, skills.*, cron.*, mcp.*, ...)      │
│    • Transport-agnostic (stdio OR WebSocket)                       │
│    • Event publisher (_emit → transport.write)                     │
│                                                                     │
│  Owns:                                                              │
│    • Agent lifecycle (create, resume, branch, compress, close)     │
│    • Tool registry (tools/registry.py)                              │
│    • Conversation history (in-memory + SQLite persist)             │
│    • Slash-command worker subprocess (_SlashWorker)                 │
│    • Approval flow (Tirith security → approval.request event)       │
│    • Model switching                                                │
│    • Memory commit/retrieve                                        │
│    • Background review callback                                    │
│    • Event publisher (session.info, message.*, tool.*, etc.)       │
│                                                                     │
│  MUST NOT:                                                          │
│    • Serve HTTP (no FastAPI, no static files)                      │
│    • Know about HTTP auth (receives transport, not Request)        │
│    • Access browser APIs (DOM, Web Audio, etc.)                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  Python function calls
┌──────────────────────────▼──────────────────────────────────────────┐
│  AGENT CORE (agent/, tools/, model_tools.py)                        │
│                                                                     │
│  • run_agent.py  — conversation loop (LLM call → tool exec → repeat)│
│  • tools/registry.py — self-registering tool schema + handler map   │
│  • model_tools.py — Anthropic/OpenAI tool-format translator         │
│  • agent/conversation_compression.py — auto-summarization          │
│  • agent/transports/ — MCP server (hermes_tools_mcp_server.py)     │
│                                                                     │
│  Owns:                                                              │
│    • LLM API call formatting                                        │
│    • Tool execution (sandboxed shell, file ops, browser, etc.)     │
│    • Context window management                                      │
│    • Thinking/reasoning block parsing                               │
│    • Subagent delegation                                            │
│                                                                     │
│  MUST NOT:                                                          │
│    • Know about WebSocket, HTTP, or stdio transports               │
│    • Call _emit / write_json (gateway does that on its behalf)     │
│    • Access config directly (gateway passes cfg dict)              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Boundary Rules

### 3.1 Frontend ↔ Backend

| Rule | Detail |
|------|--------|
| Transport | HTTP(S) for REST; WebSocket for real-time. No shared memory. |
| Auth | `X-Hermes-Session-Token` header (loopback) or `?ticket=<ticket>` (gated). Session token injected into `index.html` by backend. |
| Data format | JSON for REST. Newline-delimited JSON-RPC 2.0 over WebSocket. |
| Profile scope | Frontend appends `?profile=<name>` to profile-scoped endpoints (see `PROFILE_SCOPED_PREFIXES` in `web/src/lib/api.ts`). |
| File ops | Multipart upload to `/api/files/upload-stream`; never raw base64 JSON. |
| Binary | `authedFetch()` returns raw `Response` for blob/stream; `fetchJSON<T>()` parses JSON and handles 401→reload. |

### 3.2 Backend ↔ Gateway

| Rule | Detail |
|------|--------|
| Transport | **Legacy (dashboard subprocess)**: backend spawns `hermes --tui` and communicates over stdio pipes. **Web migration**: WebSocket tunnel (`/api/ws`) — backend is a WebSocket client to the gateway. |
| Auth | Backend forwards the same session token the browser presented; gateway validates it via `_ws_auth_ok`. |
| Direction | Backend → Gateway: only JSON-RPC requests (method calls). Gateway → Backend: JSON-RPC responses + `event` notifications. |
| Session ownership | Backend owns session token minting; gateway owns session state (`_sessions` dict). Backend may send `session.close` to force-terminate. |

### 3.3 Gateway ↔ Agent Core

| Rule | Detail |
|------|--------|
| Transport | In-process Python function calls. No serialization boundary. |
| Interface | Gateway passes `callbacks` dict to `run_conversation()` — agent core calls `message_callback`, `thinking_callback`, `reasoning_callback`, `tool_start_callback`, etc. to emit events. |
| Tool registry | `tools/registry.py` is imported at gateway startup via `discover_builtin_tools()`. Agent core calls `registry.get_handler(name)`. |
| Config | Gateway loads config once (`_load_cfg()`) and passes `cfg` dict to agent constructor. Agent never reads `hermes_cli/config.py` directly. |

### 3.4 Frontend ↔ Gateway (NEW in Web-first)

| Rule | Detail |
|------|--------|
| Transport | Direct WebSocket (`/api/ws`) — the browser speaks JSON-RPC 2.0 to the gateway directly, bypassing the PTY subprocess model. |
| Client | `web/src/lib/gatewayClient.ts` — `GatewayClient` class wraps WebSocket, handles request/response correlation, event subscription. |
| RPC methods | Same 123 methods the TUI uses. `session.create`, `prompt.submit`, `session.interrupt`, `approval.respond`, etc. |
| Events | Gateway pushes `GatewayEvent` objects: `message.start`, `message.delta`, `message.complete`, `tool.start`, `tool.complete`, `thinking.delta`, `reasoning.delta`, `status.update`, `session.info`, `approval.request`, `error`. |
| Auth | Same token/ticket model as Backend ↔ Gateway. `buildWsAuthParam()` in `api.ts` handles both modes. |

---

## 4. Code Path Reference

| Concern | File | Key function/class |
|---------|------|--------------------|
| Frontend REST client | `web/src/lib/api.ts` | `api` object (line ~314), `fetchJSON<T>()` |
| Frontend WS client | `web/src/lib/gatewayClient.ts` | `GatewayClient` class |
| Frontend WS auth | `web/src/lib/api.ts` | `buildWsAuthParam()`, `getWsTicket()` |
| Frontend chat page | `web/src/pages/ChatPage.tsx` | `ChatPage` component (xterm PTY embed → to be replaced) |
| Backend app | `hermes_cli/web_server.py` | `app = FastAPI(...)` (line ~249) |
| Backend auth middleware | `hermes_cli/web_server.py` | `auth_middleware`, `_dashboard_auth_gate` |
| Backend WS handler | `hermes_cli/web_server.py` | `@app.websocket("/api/ws")` (line ~12252) |
| Backend PTY handler | `hermes_cli/web_server.py` | `@app.websocket("/api/pty")` (line ~12081) |
| Backend pub rebroadcast | `hermes_cli/web_server.py` | `@app.websocket("/api/pub")` (line ~12283) |
| Backend events | `hermes_cli/web_server.py` | `@app.websocket("/api/events")` (line ~12311) |
| Gateway dispatcher | `tui_gateway/server.py` | `dispatch()` (line ~1048) |
| Gateway event emit | `tui_gateway/server.py` | `_emit()` (line ~967) |
| Gateway WS handler | `tui_gateway/ws.py` | `handle_ws()` (line ~173) |
| Gateway transport | `tui_gateway/transport.py` | `StdioTransport`, `WSTransport` |
| Gateway publisher | `tui_gateway/event_publisher.py` | `WsPublisherTransport` |
| Tool registry | `tools/registry.py` | `registry.register()`, `discover_builtin_tools()` |
| Agent loop | `agent/run_agent.py` | `run_conversation()` |
| Shared package | `apps/shared/src/json-rpc-gateway.ts` | `JsonRpcGatewayClient` |
| Shared package index | `apps/shared/src/index.ts` | Re-exports |

---

## 5. Migration-Specific Boundary Changes

### 5.1 Removed Boundaries

| Old boundary | Why removed | Replacement |
|-------------|-------------|-------------|
| Backend → PTY → Gateway stdio | PTY subprocess model is replaced by direct WS | Backend proxies WebSocket or gateway runs in-process |
| xterm.js terminal in ChatPage | No PTY needed when gateway speaks WS directly | React chat components render `message.delta` events |
| `hermes --tui` subprocess per chat tab | One gateway serves multiple tabs | Single gateway process, session-key multiplexing |

### 5.2 New Boundaries

| New boundary | What crosses it |
|-------------|-----------------|
| Browser → Gateway (direct WS) | JSON-RPC 2.0 over WebSocket |
| Browser → Backend (SSE) | Per-session `EventSource` for tool progress (alternative to WS events for specific sessions) |
| Browser → Backend (Web Audio API) | Audio blobs for voice mode (STT) |

### 5.3 Invariant Boundaries (unchanged)

| Boundary | Invariant |
|----------|----------|
| Gateway ↔ Agent Core | Callbacks dict interface; no transport awareness in agent |
| Backend ↔ Config | Backend is the sole writer of `config.yaml`; gateway reads via `_load_cfg()` |
| Tool registry ↔ Tools | Self-registration via `registry.register()` at import time |

---

## 6. Deployment Topology Variants

### 6.1 Legacy Desktop (current)

```
[Desktop App] → spawns → [hermes dashboard (web_server.py)]
                        → spawns → [hermes --tui (gateway)]
                                   → runs → [Agent Core]
```

### 6.2 Dashboard-only (current)

```
[browser] → HTTP → [hermes dashboard (web_server.py)]
                         → spawns → [hermes --tui (gateway)]
                                    → runs → [Agent Core]
```

### 6.3 Web-first (target)

```
[browser] → WebSocket → [gateway (embedded or standalone)]
                         → runs → [Agent Core]
           → REST     → [backend (optional, for config/files/cron)]
```

In variant 6.3, the gateway may run as:
- A standalone process with its own HTTP/WS server (replacing `web_server.py`)
- Embedded in the backend process (FastAPI adds JSON-RPC dispatch routes)
- A service worker in the browser (future, for offline-capable chat)

The boundary rules above are designed to work regardless of deployment variant.

---

## 7. Cross-Boundary Data Shapes

All four surfaces exchange data through well-defined shapes. The canonical
definitions live in:

| Shape | Defined in | Referenced by |
|-------|-----------|---------------|
| `GatewayEvent` | `web/src/lib/gatewayClient.ts` (line 18) | Frontend consumers |
| `StatusResponse` | `web/src/lib/api.ts` (type) | `/api/status` |
| `SessionInfo` | `web/src/lib/api.ts` (type) | `/api/sessions/{id}` |
| `CronJob` | `web/src/lib/cron-job.ts` | `/api/cron/jobs` |
| `ModelAssignmentRequest` | `web/src/lib/api.ts` (type) | `/api/model/set` |
| `GatewayEvent` (Python) | `tui_gateway/server.py` `_emit()` params | TUI handler (`ui-tui/src/app/createGatewayEventHandler.ts`) |
| `ToolEntry` | `tools/registry.py` `ToolEntry` class | All tool handlers |
| `ProfileInfo` | `web/src/lib/api.ts` (type) | `/api/profiles` |

The Web-first migration adds a TypeScript mirror of `GatewayEvent` in
`gatewayClient.ts` and a `GatewayClient` class that implements the same
request/response/event protocol the TUI uses over stdio.

---

## 8. Boundary Violations (Known & Planned Resolution)

| Violation | Location | Resolution |
|-----------|----------|------------|
| `ChatPage.tsx` imports xterm and manages PTY lifecycle | `web/src/pages/ChatPage.tsx` | Replace with React chat that consumes `GatewayClient` events |
| Backend imports `hermes_cli.gateway` for status queries | `hermes_cli/web_server.py` `_warm_gateway_module()` | Acceptable: read-only import for status, not tool execution |
| Gateway imports `hermes_cli.plugins` for hooks | `tui_gateway/server.py` `_notify_session_boundary()` | Acceptable: plugin hooks are cross-cutting by design |
| `apps/shared` is currently empty except `JsonRpcGatewayClient` | `apps/shared/src/index.ts` | Will grow to hold shared types (GatewayEvent TS types, Zod schemas) |
| Frontend constructs WebSocket URLs manually in some components | Various `web/src/components/` | Migrate to `buildWsUrl()` from `api.ts` consistently |

---

## 9. Summary

The system is organized into four surfaces with strict unidirectional
dependencies:

```
Frontend → Backend → Gateway → Agent Core
   ↕                         ↕
   └───── direct WS (NEW) ───┘
```

Each surface owns its domain state and communicates with adjacent surfaces
only through the documented protocols. The Web-first migration adds a
direct Frontend ↔ Gateway WebSocket path while preserving all other
boundaries unchanged.
