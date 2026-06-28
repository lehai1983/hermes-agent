# Module Ownership

> **Audience:** All engineers — know before you touch  
> **Last updated:** 2026-06-28  
> **M[DULE]: rules = Forbidden + Out-of-scope

---

## 1. Module Ownership Matrix

### tools/registry.py

**Responsibilities:** Built-in tool registration, discovery, dispatch  
**Owned state:** `_TOOLS` dict (registry), `_LAZY` lazy-import cache  
**Public interfaces:** `register()`, `discover()`, `list()`, `get_handler()`, `check_fn()`  
**Allowed dependencies:** none (imported first by all tools)  
**Forbidden dependencies:** hermes_cli.* (would import-string cycle)  
**Forbidden responsibilities:** tool *behavior* — just plumbing, not logic  
**Out of scope:** Provider-specific backend logic  
**Communication rules:** Tools call registry to register themselves at import time

---

### tools/*.py (~50 files)

**Responsibilities:** Single-tool implementations (web_search, terminal, read_file, ...)  
**Owned state:** none (stateless — pure input → JSON string output)  
**Public interfaces:** function named after tool  
**Allowed dependencies:** tools/registry.py, stdlib only  
**Forbidden dependencies:** hermes_cli.* , gateway.*  
**Forbidden responsibilities:** composing multi-step orchestration (delegate instead)  
**Out of scope:** UI rendering (all text/JSON only)  
**Communication rules:** `registry.register()` at top of file; return JSON string

---

### run_agent.py (AIAgent)

**Responsibilities:** Agent lifecycle, conversation loop, tool dispatch, context compression  
**Owned state:** per-AIAgent LLM clients, tool schemas, memory provider, iteration budget  
**Public interfaces:** `AIAgent.__init__()`, `chat()`, `run_conversation()`  
**Allowed dependencies:** agent/* , tools/registry.py, model_tools.py, hermes_state.py  
**Forbidden dependencies:** hermes_cli.* , gateway.* , web.*  
**Forbidden responsibilities:** UI state, WS transport, rendering  
**Out of scope:** Memory provider backend specifics; provider LLM streaming details  
**Communication rules:** Tools called via `handle_function_call()` → JSON string result

---

### model_tools.py

**Responsibilities:** Tool orchestration, schema collection, tool availability by platform  
**Owned state:** `_last_resolved_tool_names` (global; saved/restored in subagent)  
**Public interfaces:** `discover_builtin_tools()`, `get_tool_definitions()`, `handle_function_call()`  
**Allowed dependencies:** tools/registry.py, agent/*  
**Forbidden dependencies:** FastAPI, gunicorn, any web framework  
**Forbidden responsibilities:** auth enforcement, rate limiting, request validation  
**Out of scope:** UI tool display logic  
**Communication rules:** handlers expect `args: dict`, return JSON string

---

### toolsets.py

**Responsibilities:** Toolset definitions (per-platform tool bundles), distribution config  
**Owned state:** `TOOLSETS` dict (module import time)  
**Public interfaces:** `TOOLSETS`, `_HERMES_CORE_TOOLS`, `list_toolsets()`  
**Allowed dependencies:** tools/registry.py  
**Forbidden dependencies:** run_agent.py, gateway.*  
**Forbidden responsibilities:** tool execution (just declarations)  
**Out of scope:** platform adapter logic  
**Communication rules:** only declarations; no side effects on import

---

### hermes_cli/web_server.py (Dashboard)

**Responsibilities:** REST API, static file serving, PTY bridge, dashboard auth  
**Owned state:** ephemeral per-request, session token registry  
**Public interfaces:** FastAPI routes, `@app.websocket` handlers  
**Allowed dependencies:** hermes_cli.*, gateway/status.py, tools/lazy_deps  
**Forbidden dependencies:** run_agent.py direct (via tui_gateway or gateway)  
**Forbidden responsibilities:** tool execution logic (delegate)  
**Out of scope:** agent internals  
**Communication rules:** All REST response JSON; errors as HTTP 4xx/5xx

---

### hermes_cli/config.py

**Responsibilities:** Config YAML load/save, env var load, redacted display  
**Owned state:** `DEFAULT_CONFIG`, cached parsed YAML, loaded .env  
**Public interfaces:** `load_config()`, `save_config()`, `cfg_get()`, `load_env()`  
**Allowed dependencies:** hermes_constants, ruamel.yaml, stdlib  
**Forbidden dependencies:** FastAPI, any HTTP handler  
**Forbidden responsibilities:** validation beyond schema (agents validate their own)  
**Out of scope:** config migrations (see migrate.py)

---

### tui_gateway/server.py

**Responsibilities:** JSON-RPC dispatcher (123 methods), per-session state, tool dispatch  
**Owned state:** `_sessions` dict (per TUI session), `_db` (SQLite handle), `_cfg_cache`  
**Public interfaces:** `dispatch()`, `handle_request()` (called by entry.py and WS)  
**Allowed dependencies:** run_agent.py, model_tools.py, hermes_state.py, hermes_cli.config  
**Forbidden dependencies:** FastAPI (must stay transport-agnostic)  
**Forbidden responsibilities:** tool execution (delegate to handle_function_call)  
**Out of scope:** HTTP route logic (web_server.py handles that)  
**Communication rules:** all writes via `transport.write()`

---

### tui_gateway/ws.py

**Responsibilities:** WebSocket transport adapter (multiplexes over `/api/ws`)  
**Owned state:** WS session registry  
**Public interfaces:** `handle_ws(websocket)`  
**Allowed dependencies:** tui_gateway.server, tui_gateway.transport  
**Forbidden dependencies:** FastAPI direct (only for WebSocket route wiring)  
**Forbidden responsibilities:** event generation (consumes from tui_gateway events)  
**Out of scope:** auth enforcement (caller handles)

---

### gateway/run.py (GatewayRunner)

**Responsibilities:** Messaging platform adapter lifecycle, session routing, stream dispatch  
**Owned state:** adapter instances, agent cache (LRU 128), platform registry  
**Public interfaces:** `start_gateway()`, `GatewayRunner`  
**Allowed dependencies:** agent/* , hermes_state.py, gateway/* , tools/registry.py  
**Forbidden dependencies:** FastAPI, web.*  
**Forbidden responsibilities:** REST route handling (different service)  
**Out of scope:** per-platform adapter internals (each adapter own their module)  
**Communication rules:** `MessageEvent` → session key → AIAgent → response → adapter

---

### agent/*.py (Agent Internals)

**Responsibilities:** Provider adapters, memory, context, caching, compression  
**Owned state:** per-provider LLM clients, memory embeddings, context cache  
**Public interfaces:** per-module (`MemoryProvider`, `compress_context()`, ...)  
**Allowed dependencies:** openai, anthropic, pydantic, stdlib  
**Forbidden dependencies:** run_agent.py (would cycle), FastAPI, web.*  
**Forbidden responsibilities:** conversation loop orchestration (that's run_agent)  
**Out of scope:** tool definitions (tools/registry.py owns)

---

### web/src/ (Web SPA)

**Responsibilities:** User-facing SPA (18 admin pages + new chat), REST consumer  
**Owned state:** React component state, React Query cache, plugin registry (client)  
**Public interfaces:** React components, `GatewayClient`, plugin SDK  
**Allowed dependencies:** @hermes/shared, React 19, Tailwind 4, xterm.js  
**Forbidden dependencies:** tools/*.py, run_agent.py, gateway/run.py, fs.writeFileSync  
**Forbidden responsibilities:** agent business logic, tool execution, session store writes (REST only)  
**Out of scope:** backend server logic (web_server.py handles)  
**Communication rules:** fetch() to /api/* REST; WebSocket to /api/ws for events

---

### web/src/lib/api.ts

**Responsibilities:** Typed REST client for dashboard SPA  
**Owned state:** `_managementProfile`, `_sessionToken` (module-level)  
**Public interfaces:** `fetchJSON()`, exported typed functions  
**Allowed dependencies:** window.__HERMES_SESSION_TOKEN__  
**Forbidden dependencies:** React (pure TS utility)  
**Forbidden responsibilities:** event streaming (gatewayClient.ts)  
**Out of scope:** WebSocket event subscriptions

---

### web/src/lib/gatewayClient.ts

**Responsibilities:** Browser WebSocket client for JSON-RPC  
**Owned state:** WS connection, pending requests Map, event listeners  
**Public interfaces:** `GatewayClient`, `GatewayEvent`, `GatewayEventName`  
**Allowed dependencies:** native WebSocket  
**Forbidden dependencies:** Node.js APIs, Electron IPC  
**Forbidden responsibilities:** auth handshake (caller handles)  
**Out of scope:** REST (api.ts handles)

---

### apps/desktop/ (Electron App — DEPRECATING)

**Responsibilities:** Desktop GUI, native features, local terminal, multi-window  
**Owned state:** nanostores atoms, IPC connection pool  
**Public interfaces:** N/A (frozen)  
**Allowed dependencies:** everything Electron allows  
**Forbidden responsibilities:** new feature development (maintenance mode from Phase 2)  
**Out of scope:** being the primary GUI  
**Communication rules:** IPC proxy → tui_gateway REST

---

### @hermes/shared/

**Responsibilities:** Canonical TypeScript types + transport-agnostic RPC client  
**Owned state:** none  
**Public interfaces:** `JsonRpcGatewayClient`, types, future types  
**Allowed dependencies:** none (zero-dep)  
**Forbidden dependencies:** React, Electron, FastAPI — anything environment-specific  
**Forbidden responsibilities:** platform detection, runtime behavior  
**Out of scope:** UI state management  
**Communication rules:** imported by web/, desktop/ subprojects

---

### ui-tui/ (Terminal TUI)

**Responsibilities:** Terminal UI (Ink/React), JSON-RPC stdio transport  
**Owned state:** Ink component tree, terminal events  
**Public interfaces:** `node ui-tui/dist/entry.tsx`  
**Allowed dependencies:** ink, @nanostores/react, hermes-ink  
**Forbidden dependencies:** React DOM, FastAPI  
**Forbidden responsibilities:** REST routes, WS server  
**Out of scope:** web presence  
**Communication rules:** stdin/stdout JSON-RPC ↔ tui_gateway

---

### cli.py (Interactive CLI)

**Responsibilities:** prompt_toolkit interactive mode, spinner, skins, slash command dispatch  
**Owned state:** AIAgent (per-process), prompt history, current session  
**Public interfaces:** `HermesCLI.cmdloop()`, `process_command()`  
**Allowed dependencies:** prompt_toolkit, rich, hermes_cli.*, run_agent.py, toolsets.py  
**Forbidden dependencies:** FastAPI, React, any web framework  
**Forbidden responsibilities:** REST route handling (web_server.py handles /api/*)  
**Out of scope:** multi-session WS multiplexing  
**Communication rules:** stdin/stdout text + ANSI; AIAgent.call via run_conversation()

---

## 2. Dependency Rules

```
Direction of allowed dependency (top → bottom = allowed):

tools/registry.py
    ↑ tools/*.py (register themselves)
    ↑ model_tools.py (imports all tools via discover)
    ↑ run_agent.py (calls handle_function_call)
    ↑ tui_gateway/server.py (creates AIAgent)
    ↑ gateway/run.py (creates AIAgent per session)
    ↑ web_server.py (imports gateway/status for /api/status)

hermes_constants.py ← imported by anything (no deps on project code)
hermes_state.py ← imported by anything needing SQLite session data
agent/* ← imported by run_agent.py only
hermes_cli/main.py ← imported by hermes script entry point

web/src/ ← imports @hermes/shared (never web_server.py directly)
apps/desktop/ ← imports @hermes/shared (never IPC from web/)
```

**Cycles that MUST NOT exist:**
- hermes_cli → tools/*.py (config can read, never write tools)
- web/src → tools/*.py (never import tools directly)
- web/src → run_agent.py (never in browser bundle)
- agent/* → run_agent.py (never cycle)

---

## 3. Bus Factor

| Component | Min maintainers | Current | Risk |
|-----------|----------------|---------|------|
| tools/registry.py | 2 | 1 (core) | HIGH |
| tui_gateway/server.py | 2 | 1 (core) | HIGH |
| web_server.py | 2 | 2 | MEDIUM |
| web/src/ (SPA) | 2 | 2 | LOW |
| agent/* | 3 | 2 | MEDIUM |
| hermes_state.py | 2 | 1 | HIGH |

---

**See also:** [Review Checklist](../Development-Playbook/03-Review-Checklist.md) · [Architecture](../Architecture/01-Current-Architecture.md)
