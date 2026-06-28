# Future Architecture (Web-First)

> **Audience:** Engineers planning the Web migration  
> **Last updated:** 2026-06-28  
> **Status:** design draft — pending approval  
> **Goal:** Desktop becomes optional, Web SPA becomes primary GUI, Agent core unchanged

---

## 1. Guiding Principles

1. **Agent core is sacred** — no behavioral change to `run_agent.py`, `model_tools.py`, `toolsets.py`, `hermes_state.py`
2. **Web/ is the future** — new features land in `web/src/` first; desktop is feature-frozen
3. **Pluggable frontends** — multiple frontends via shared JSON-RPC (same model as TUI)
4. **Reuse desktop components** — lift React chat renderer from `apps/desktop/src/components/assistant-ui/`
5. **Transport is a detail** — frontends don't care if they run over WS, IPC, or stdio
6. **No behavioral compromise** — web chat must be at least as capable as today's embedded TUI

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          TARGET: WEB-FIRST                                    │
│                                                                                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────────────┐  │
│  │  Classic CLI  │   │  Terminal TUI │   │        Web SPA (PRIMARY)        │  │
│  │  cli.py       │   │  ui-tui/      │   │        web/                     │  │
│  │  (unchanged)  │   │  (unchanged)  │   │        React 19 + Vite          │  │
│  └──────┬───────┘   └──────┬───────┘   └────────────┬─────────────────────┘  │
│         │                   │                          │                         │
│         │                   │ stdio JSON-RPC           │ WS JSON-RPC + SSE       │
│         │                   │                          │ + REST                  │
│         └───────┬───────────┴──────────────────────────┘                         │
│                 │                                                               │
│  ┌──────────────▼──────────────────────────────────────────────────────────────┐ │
│  │              tui_gateway/server.py (JSON-RPC dispatcher, 123 methods)      │ │
│  │                    AIAgent pool (LRU 128, idle-TTL 3600s)                 │ │
│  └──────────────────────────────┬─────────────────────────────────────────────┘ │
│                                                                  │              │
│  ┌──────────────────────────────▼─────────────────────────────────────────────┐ │
│  │              hermes_cli/web_server.py (REST 181 + WS 5)                   │ │
│  │         dashboard_auth/ (OAuth, session tokens, WS tickets)               │ │
│  └──────────────────────────────┬─────────────────────────────────────────────┘ │
│                                                                  │              │
│  ┌──────────────────────────────▼─────────────────────────────────────────────┐ │
│  │              ~/.hermes/ (config.yaml, state.db, .env, logs/)             │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  DEPRECATED (Phase 4+):                                                      │
│  ┌──────────────┐                                                            │
│  │  Desktop      │  → maintained for critical bugs only                     │
│  │  apps/desktop │  → no new features                                        │
│  └──────────────┘                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. New Components

### 3.1 Web Chat Renderer (`web/src/app/chat/`)

**Status:** NEW — will replace the embedded PTY chat  
**Source material to lift:** `apps/desktop/src/components/assistant-ui/`

```
web/src/app/chat/
  index.tsx                  # ChatPage host + session lifecycle
  composer/
    Composer.tsx              # Rich markdown editor (lifted from desktop)
    SlashPopover.tsx          # @-mention + /command completions
    VoiceControls.tsx         # Push-to-talk mic (Web Audio API)
    AttachmentDrop.tsx        # DnD files
  messages/
    MessageThread.tsx         # Message list (virtualized)
    AssistantMessage.tsx      # Streaming markdown + tool cards
    UserMessage.tsx           # Editable, emoji reactions
    ToolCallCard.tsx          # Expandable tool execution
  panels/
    RightRail.tsx             # Preview + terminal + files (tabbed)
    PreviewPane.tsx           # HTML/MD/CSV preview
  hooks/
    useMessageStream.ts       # WebSocket/SSE subscription
    useComposer.ts            # Editor state + send
    useSession.ts             # Session lifecycle
```

### 3.2 Per-Session Event Stream (NEW endpoint)

**Problem:** Today `/api/ws` broadcasts globally. Desktop subscribes internally. Web embedded-TUI gets events as ANSI over PTY. Web-native chat needs **per-session** events as JSON.

**Solution:** SSE endpoint filtered by session:

```
GET /api/sessions/{session_id}/events
  → text/event-stream
  → events: message.delta, tool.start, tool.progress, etc.
  → scoped to session_id
```

Alternative: WebSocket upgrade on `/api/ws?session_id=xxx` (existing infrastructure).

### 3.3 Auth v2 (Multi-user)

**Why:** Desktop today is single-machine. Web served publicly needs per-user auth.

```
/dashboard         → OAuth (Google/GitHub) or password
/api/*             → per-user JWT (not shared session token)
sessions           → per-user scoped (user_id column in state.db)
profiles           → user owns profiles (ACL)
shared profiles    → optional team sharing (future)
```

**Migration:** today's profile-scoped mode → user × profile scoped mode.

---

## 4. API Extensions Needed

### 4.1 New REST Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/sessions/{id}/messages` | Web-native submit prompt (no PTY) |
| POST | `/api/sessions/{id}/interrupt` | Stop generation |
| GET | `/api/sessions/{id}/status` | Live status poll |
| GET | `/api/sessions/{id}/events` | SSE event stream |
| POST | `/api/sessions/{id}/clarify` | UI-driven clarify |
| POST | `/api/sessions/{id}/approval` | Tool approval response |
| POST | `/api/sessions/{id}/branch` | Branch from message |
| POST | `/api/sessions/{id}/compress` | Trigger compression |
| GET | `/api/user/me` | Current user identity |
| POST | `/api/user/keys/{provider}` | Per-user credential |

### 4.2 Extended WebSocket

| URL | Purpose |
|-----|---------|
| `/api/ws?session_id=xxx` | Scoped event stream (today is global) |

### 4.3 JSON-RPC Pass-through

If web talks to tui_gateway directly (over WS to `/api/ws` → bridge), no new endpoints needed. Desktop calls over IPC today can be mirrored.

**Tradeoff:**
- Option A: web REST ↔ web_server.py ↔ tui_gateway (extra hop)
- Option B: web WS ↔ tui_gateway directly (bypasses dashboard auth)

**Recommendation:** Option A with REST additions (Option C layered on existing auth chain).

---

## 5. Desktop Deprecation Path

```
Phase 0 (current)         Phase 1 (3 months)       Phase 2 (6 months)       Phase 3 (12 months)
─────────────────         ──────────────────       ──────────────────       ──────────────────
Web = embedded TUI        Web = embed + new       Web = native React       Web = sole GUI
Desktop = primary         chat renderer            chat = primary           Desktop = bugfixes
                          Desktop = parity         Desktop = frozen          only
                                                                             Desktop sunset
```

---

## 6. Component Lifecycle

### Desktop components → Web (lift)

| Desktop Component | Web Reuse | Status |
|-------------------|-----------|--------|
| `assistant-ui/thread.tsx` | → web/src/app/chat/messages/Thread.tsx | ✅ Direct reuse |
| `assistant-ui/markdown-text.tsx` | → web/ Markdown renderer | ✅ Direct reuse |
| `assistant-ui/tool-approval.tsx` | → web/ tool approval | ✅ Direct reuse |
| `assistant-ui/streaming.tsx` | → web/ streaming handler | ✅ Direct reuse |
| `assistant-ui/user-message-edit.tsx` | → web/ edit | ✅ Direct reuse |
| `assistant-ui/embeds/` | → web/ embeds | ✅ Direct reuse |
| `composer/index.tsx` | → web/src/app/chat/composer/Composer.tsx | ✅ Direct reuse |
| `composer/attachments.tsx` | → web/ DnD | ✅ Direct reuse |
| `composer/hooks/*` | → web/ hooks | ✅ Adapt (replace IPC) |
| `right-sidebar/terminal/` | → web/ terminal panel | ⚠️ PTY → wasmPTY |
| `right-sidebar/review/` | → web/ review panel | ⚠️ Git via REST |
| `pet-overlay/` | → web/ optional feature | ✅ Buildable (Canvas) |

### Desktop-only (drop)

| Feature | Web Equivalent | Decision |
|---------|----------------|----------|
| safeStorage | Browser Credential Management API | ⚠️ Partial |
| powerMonitor | Page Visibility API | ⚠️ Drop |
| autoUpdater | N/A (web is always-current) | ✅ Drop (not needed) |
| nativeTheme | prefers-color-scheme | ✅ Drop (works natively) |
| session-windows | Browser tabs | ⚠️ Drop |
| globalShortcut | In-app keybinds only | ⚠️ Drop |

---

## 7. Security Model

### Current

```
session token → any user with token has full access
profile scoping → separate state.db per profile
OAuth gate → /auth/* routes for public deployments
```

### Target

```
JWT (user identity) + session token (operator auth)
per-user RBAC on sessions (owner, shared, admin)
per-user credential isolation (never shared)
```

---

## 8. Build & Deploy

### Current

```
web/: npm run build → static files → FastAPI serves
Desktop: electron-builder → platform binaries
Docker: s6-overlay + nginx/gunicorn/python
```

### Target

```
web/: npm run build → static → bundled with dashboard (same as today!)
Desktop: feature-frozen; build pipeline stays for 12 months
Remote deployments: HTTPS + OAuth + Cloudflare Tunnel (no nginx needed)
```

**No build system changes required** — web/ already builds correctly.

---

## 9. Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Chat UX choices | 3 (TUI, embed, desktop) | 2 (TUI, web-native) |
| New feature velocity | split (×3 frontends) | web-only |
| Mobile support | none | responsive web |
| Setup friction | install Electron | bookmark URL, SSO |
| Admin surface parity | desktop > web | web ≥ desktop |
| Desktop binary CI | yes (4 platforms) | no |

---

**See also:** [Current Architecture](Current-Architecture.md) · [Migration Strategy](Migration-Strategy.md) · [ADR-001: Web Native Chat Renderer](../../affected)
