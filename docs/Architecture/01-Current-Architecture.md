# Current Architecture

> **Audience:** Engineers working on Hermes Web migration
> **Last updated:** 2026-06-28
> **Verified against:** source code on `main` branch (commit 190e1ffa)

This document describes the architecture **as-is** — not the desired future state.

---

## 1. System Overview

Hermes is a personal AI agent that runs the same agent core across multiple frontends.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              HERMES ECOSYSTEM                                    │
│                                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │  Classic CLI  │   │  Terminal TUI │   │   Web SPA    │   │   Desktop    │     │
│  │  cli.py       │   │  ui-tui/      │   │   web/       │   │  Electron    │     │
│  │  (714KB LOC)  │   │  (Ink fork)   │   │  (Vite 8)    │   │  apps/       │     │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘     │
│         │                   │                   │                   │             │
│         └───────┬───────────┴─────────┬─────────┴───────────────────┘             │
│                 │                     │                                            │
│         stdin/stdout          JSON-RPC over stdio     JSON-RPC over WS / IPC       │
│                 │                     │                                            │
│         ┌───────▼─────────────────────▼────────────────────────────────┐          │
│         │              tui_gateway/server.py (13.5k LOC)               │          │
│         │         JSON-RPC dispatcher (123 methods) + AIAgent          │          │
│         └──────────────────────────┬───────────────────────────────────┘          │
│                                                     │                            │
│         ┌───────────────────────────────────────────┼────────────────────┐       │
│         │              hermes_cli/web_server.py     │  (13.7k LOC)       │       │
│         │   FastAPI — REST (181 endpoints) + WS (5)  │ + dashboard_auth   │       │
│         └───────────────────────────────────────────┼────────────────────┘       │
│                                                     │                            │
│         ┌───────────────────┐   ┌───────────────────▼────────────────────┐       │
│         │  ~/.hermes/       │   │  gateway/run.py (GatewayRunner)        │       │
│         │  config.yaml      │   │  20+ platform adapters, session mgmt   │       │
│         │  state.db (SQLite)│   │  stream dispatch, slash commands       │       │
│         │  .env, logs/       │   └────────────────────────────────────────┘       │
│         └───────────────────┘                                                     │
│                                                                                  │
│  Legend: ─── data flow   ┌┐ container   ▼ entry point                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Deployment Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        production deployment                             │
│                                                                         │
│  docker-compose.yml                                                      │
│    ├── gateway service     (command: gateway run)                       │
│    │     └─ connects to 20+ messaging platforms                        │
│    │     └─ serves /api/* REST when API_SERVER_KEY is set              │
│    │                                                                    │
│    └── dashboard service   (command: dashboard --host 127.0.0.1)        │
│          └─ serves web/ SPA + /api/* REST + /api/pty WS                │
│          └─ PID 1 = s6-overlay (reaps zombies, supervises)             │
│          └─ binds localhost only (use SSH tunnel for remote)           │
│                                                                         │
│  Alternative local:                                                      │
│    $ hermes dashboard          → starts web_server.py on :9119          │
│    $ hermes --tui              → starts tui_gateway over stdio          │
│    $ hermes gateway run        → starts gateway/run.py (platforms)      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. Frontend Inventory

### 3.1 Classic CLI — `cli.py`

- **Stack:** prompt_toolkit, Rich (banner/spinners), KawaiiSpinner
- **Entry:** `hermes` (no subcommand) → `HermesCLI.cmdloop()`
- **LOC:** ~11,000 (714 KB file)
- **Role:** primary terminal interface for power users
- **Lifecycle:** runs a single AIAgent, persists to SQLite, exits on /exit
- **NOT in scope for web migration** — stays as-is

### 3.2 Terminal TUI — `ui-tui/`

- **Stack:** Ink (custom fork `hermes-ink`), nanostores, React 19
- **Entry:** `node ui-tui/dist/entry.tsx` → connects to tui_gateway over stdio
- **LOC:** ~150 TypeScript files
- **Role:** primary terminal UI with full features (slash picker, tool rows, markdown)
- **Status:** production, installed with `hermes --tui` or `HERMES_TUI=1`
- **NOT in scope for web migration** — stays as-is

### 3.3 Web SPA — `web/`

- **Stack:** Vite 8, React 19, Tailwind 4, xterm.js, React Router 7, @nous-research/ui
- **Entry:** `npm run dev` (dev) / `npm run build` (prod, served by web_server.py)
- **Pages:** 18 (chat, sessions, files, analytics, models, logs, cron, skills, plugins, MCP, profiles, config, env, docs, channels, webhooks, pairing, system)
- **Chat:** embeds `hermes --tui` via PTY WebSocket (`/api/pty`)
- **Auth:** OAuth gate or session token in X-Hermes-Session-Token header
- **Role:** management dashboard + chat surface
- **IN SCOPE — becomes primary GUI**

### 3.4 Desktop App — `apps/desktop/`

- **Stack:** Electron 40, React 19, @assistant-ui/react, nanostores (80+ atoms), Tailwind 4
- **Entry:** `electron/main.cjs` (main) → React renderer in `src/`
- **Routes:** 10 (new chat, command-center, skills, messaging, artifacts, cron, profiles, agents)
- **Settings:** 26 panels
- **Chat:** custom React composer + tui_gateway over IPC (NOT PTY)
- **Native:** node-pty terminal, safeStorage, powerMonitor, autoUpdater, translucency, session-windows
- **LOC:** ~700 .tsx/.ts, ~60+ .cjs, ~1200 total source files
- **Status:** production (v0.17.0)
- **TARGET FOR DEPRECATION**

### 3.5 Bootstrap Installer — `apps/bootstrap-installer/`

- **Stack:** Tauri (Rust + React)
- **Role:** first-launch installer (Windows)
- **NOT in scope**

### 3.6 Documentation Site — `website/`

- **Stack:** Docusaurus (separate build, separate deploy)
- **Role:** user-facing documentation at hermes-agent.nousresearch.com
- **NOT in scope**

## 4. Backend Shared Surfaces

### 4.1 Agent Core — `run_agent.py`

- `AIAgent` class with ~60 parameters
- `run_conversation()` — synchronous agent loop, interruptible
- ~12k LOC, handles provider adapters, tool dispatch, memory, caching

### 4.2 Model Tools — `model_tools.py`

- `discover_builtin_tools()` — auto-imports all `tools/*.py`
- `handle_function_call()` — central tool dispatch
- Tool registration via `registry.register()` at module import time

### 4.3 Toolsets — `toolsets.py`

- `TOOLSETS` dict defines per-platform tool bundles
- `_HERMES_CORE_TOOLS` — default bundle every platform inherits
- `toolset_distributions.py` — vendored copies for lean installs

### 4.4 Session Store — `hermes_state.py`

- SQLite + FTS5 full-text search
- Per-profile state.db (profile-aware via HERMES_HOME)
- ~233 KB god-file

### 4.5 Config/Env — `hermes_cli/config.py`

- DEFAULT_CONFIG with _config_version
- `cfg_get()` / `load_config()` / `save_config()`
- Profile-aware via `get_hermes_home()`

### 4.6 Constants — `hermes_constants.py`

- `get_hermes_home()` — reads HERMES_HOME env var (set by `_apply_profile_override()`)
- `display_hermes_home()` — user-facing path (shows `~/.hermes`)

## 5. State Ownership

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STATE OWNERSHIP MAP                                   │
│                                                                        │
│  config.yaml          ← file system (hermes_cli/config.save_config)    │
│  .env                 ← file system (secrets only)                     │
│  state.db (SQLite)    ← hermes_state.py (sessions, messages, FTS5)   │
│  agent cache (LRU)    ← tui_gateway/server.py (per-session AIAgent)   │
│  platform adapters    ← gateway/run.py (in-memory registry)            │
│  ui session state     ← per-frontend (React state / nanostores / Ink)  │
│  slash command state  ← agent/skill_commands.py (user messages)        │
│  WS session registry  ← ws.py (transport-attached sessions)            │
│  plugin configurations← hermes_cli/plugins.py (manifest cache)        │
│  cron job store       ← cron/jobs.py (SQLite)                          │
│  kanban board         ← plugins/kanban/ (SQLite)                       │
└────────────────────────────────────────────────────────────────────────┘
```

**Key invariant:** mutable state lives in ONE owner. Frontends read SQL directly but mutations go through REST/RPC.

## 6. Transport Architecture

### 6.1 JSON-RPC (Agent-facing)

- Server: `tui_gateway/server.py` (`handle_request` → `_methods[method]`)
- Registration: `@method("name")` decorator (112 direct + 11 via `@_projects_method`)
- Transport: `StdioTransport` (TUI) or WebSocket (`ws.py` for dashboard/desktop)
- Long handlers → `ThreadPoolExecutor` (4 workers)
- Protocol: newline-delimited JSON-RPC 2.0

### 6.2 REST (Dashboard-facing)

- Server: `hermes_cli/web_server.py` (FastAPI on uvicorn)
- 181 endpoints across 24 categories
- Auth: `X-Hermes-Session-Token` header, or `?token=` for WS (browser limitation)
- Public paths (no auth): `/login`, `/auth/*`, `/api/auth/providers`

### 6.3 WebSocket (Real-time)

| Endpoint | Purpose |
|----------|---------|
| `/api/pty` | PTY byte stream (embedded TUI chat) |
| `/api/ws` | Gateway event stream (broadcast) |
| `/api/pub` | Publisher channel |
| `/api/events` | Event channel |

### 6.4 Electron IPC (Desktop-only)

- Preload exposes `window.hermesDesktop.*` (60+ methods)
- All calls proxy to `ipcRenderer.invoke('hermes:api', ...)` in main process
- Categories: api, pet-overlay, connection-config, git (19), terminal (5), fs

## 7. Data Flow — User Sends a Message

```
User types → frontend (tui / web/embed / desktop)
  → JSON-RPC prompt.submit {session_id, text}
    → tui_gateway/server.py :: handle_prompt_submit
      → AIAgent.chat() (run_agent.py loop)
        → providers LLM API call (streaming)
          → tool_calls detected
            → handle_function_call → tools/*.py
              → tool.start/progress/complete events → frontend
          → text deltas stream back
            → message.delta events → frontend updates
            → message.complete → session appended to SQLite
```

## 8. Current Strengths

1. **Transport abstraction** — stdio OR WS over same dispatcher (web migration enabler)
2. **Profile isolation** — filesystem-level, copy-at-creation
3. **Plugin system** — 50+ plugins, ABI-stable (memory/model-providers/platforms/image-gen)
4. **Skill curation** — background agent-maintained (curator.py)
5. **SessionDB** — single source of truth, FTS5 search, append-only
6. **Dashboard SPA** — 18 admin pages + 16 locales + plugin SDK already built
7. **Skin engine** — data-driven YAML themes, no code changes
8. **Slash command registry** — single source-of-truth COMMAND_REGISTRY
9. **Gateway platform isolation** — adapters are independent, hot-loadable
10. **Build reproducibility** — exact-pinned deps, SHA-pinned GH Actions, uv.lock hashes

## 9. Current Limitations

1. **God-files** — cli.py (714KB), web_server.py (545KB), server.py (527KB), run_agent.py (248KB)
2. **Single-process gateway** — per-session AIAgent in-memory, no horizontal scaling
3. **PTY overhead per chat tab** — each dashboard chat spawns a full `hermes --tui` process
4. **Three competing chat UX** — TUI (terminal), dashboard (embedded PTY ANSI), desktop (React)
5. **No shared TS types** — `web/src/lib/api.ts`, `apps/desktop/types/hermes.ts`, `apps/shared/src/` all define types separately
6. **Profile-scoped only** — no per-user RBAC, no multi-tenant ACL
7. **Messaging gateway is separate service** — desktop talks to it over WS, not directly
8. **Binary auto-update only for desktop** — web is always-current, desktop uses electron-updater

## 10. Technical Debt Registry

| ID | Debt | Location | Impact |
|----|------|----------|--------|
| TD-001 | God-file: cli.py 714KB | cli.py | review cost |
| TD-002 | God-file: web_server.py 545KB | hermes_cli/web_server.py | cold-start + review |
| TD-003 | God-file: server.py 527KB | tui_gateway/server.py | single-point regress |
| TD-004 | God-file: run_agent.py 248KB | run_agent.py | coupling |
| TD-005 | Ink fork (hermes-ink) | ui-tui/packages/hermes-ink/ | upstream drift |
| TS-006 | No shared TS types | web/ + desktop/ + shared/ | type drift |
| TS-007 | Two plugin systems | web/src/plugins/ + hermes_cli/plugins.py | confusion |
| TS-008 | PTY per web chat tab | web/src/pages/ChatPage.tsx | resource cost |
| API-009 | /api/ws broadcasts globally | tui_gateway/ws.py | no per-session filter |
| SEC-010 | safeStorage in desktop only | electron/main.cjs | drop risk |

---

**See also:** [Future Architecture](Future-Architecture.md) · [Migration Strategy](Migration-Strategy.md)
