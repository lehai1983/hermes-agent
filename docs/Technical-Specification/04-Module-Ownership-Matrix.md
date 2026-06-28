# 04 — Module Ownership Matrix

## 1. Purpose

This document assigns every module in the Hermes Agent codebase to an owner
and defines the written contract (interface) that module exposes to other
parts of the system. It is the canonical reference for "who owns what"
during the Web-first migration.

---

## 2. Ownership Model

| Owner | Responsibility |
|-------|---------------|
| **@hermes/web-team** | Frontend (React SPA), shared types (`@hermes/shared`) |
| **@hermes/backend-team** | REST/WS server (`hermes_cli/web_server.py`), auth, cron scheduler |
| **@hermes/gateway-team** | JSON-RPC dispatcher (`tui_gateway/`), session management, event publisher |
| **@hermes/agent-team** | Agent loop (`agent/`), tool registry (`tools/`), model tools |
| **@hermes/platform-team** | Platform adapters (API server, Telegram, Discord, etc.) |
| **@hermes/infra-team** | Build, CI, packaging, shared tooling |

---

## 3. Module Registry

### 3.1 Frontend Modules

| Module | Path | Owner | Contract |
|--------|------|-------|----------|
| API client | `web/src/lib/api.ts` | web-team | Exports `api` object wrapping all REST endpoints. Exports `fetchJSON<T>()`, `authedFetch()`, `buildWsUrl()`, `buildWsAuthParam()`, `getWsTicket()`. |
| Gateway client | `web/src/lib/gatewayClient.ts` | web-team | Exports `GatewayClient` class, `GatewayEventName` type, `GatewayEvent<P>` interface, `ConnectionState` type. |
| Chat page | `web/src/pages/ChatPage.tsx` | web-team | Exports `ChatPage` React component. Currently embeds xterm PTY; will be replaced with native React chat. |
| Theme system | `web/src/themes/` | web-team | Exports `useTheme()`, `ThemeProvider`, `DashboardTheme` type, theme presets. |
| Plugin SDK | `web/src/plugins/` | web-team | Exports `usePlugins()`, `PluginSlot`, `Plugin` type. |
| Session refresh | `web/src/lib/session-refresh.ts` | web-team | Exports session token refresh logic. |
| Chat title | `web/src/lib/chat-title.ts` | web-team | Exports `normalizeSessionTitle()` for session list display. |
| Cron job types | `web/src/lib/cron-job.ts` | web-team | Exports `CronJob`, `CronJobMutation` types. |
| Dashboard flags | `web/src/lib/dashboard-flags.ts` | web-team | Exports feature flags for dashboard capabilities. |
| i18n | `web/src/i18n/` | web-team | Exports translations for 15+ languages. |
| Shared package | `apps/shared/src/` | web-team | Exports `JsonRpcGatewayClient` (will grow to include shared types). |

### 3.2 Backend Modules

| Module | Path | Owner | Contract |
|--------|------|-------|----------|
| Web server | `hermes_cli/web_server.py` | backend-team | Exports `app: FastAPI`. Entry point: `start_server()`. 181 REST endpoints, 4 WebSocket endpoints. |
| Auth middleware | `hermes_cli/dashboard_auth/` | backend-team | Exports `gated_auth_middleware`, `token_auth_middleware`, `public_paths`. |
| Config loader | `hermes_cli/config.py` | backend-team | Exports `load_config()`, `save_config()`, `DEFAULT_CONFIG`, `cfg_get()`, `get_config_path()`. |
| Env loader | `hermes_cli/env_loader.py` | backend-team | Exports `load_hermes_dotenv()`. |
| Memory providers | `hermes_cli/memory_providers.py` | backend-team | Exports `MemoryProvider`, `get_memory_provider()`. |
| Memory OAuth | `hermes_cli/memory_oauth.py` | backend-team | Exports `router: APIRouter` for OAuth flows. |
| Active sessions | `hermes_cli/active_sessions.py` | backend-team | Exports `try_acquire_active_session()`, `transfer_active_session()`. |
| Plugins | `hermes_cli/plugins.py` | backend-team | Exports `invoke_hook()`. |
| Gateway status | `gateway/status.py` | backend-team | Exports `derive_gateway_busy()`, `read_runtime_status()`, `get_running_pid()`. |
| Restart | `gateway/restart.py` | backend-team | Exports `DEFAULT_GATEWAY_RESTART_DRAIN_TIMEOUT`. |
| Update check | `hermes_cli/banner.py` | backend-team | Exports `prefetch_update_check()`. |

### 3.3 Gateway Modules

| Module | Path | Owner | Contract |
|--------|------|-------|----------|
| Server dispatcher | `tui_gateway/server.py` | gateway-team | Exports `dispatch()`, `_emit()`, `_load_cfg()`, `_SlashWorker`, `_finalize_session()`, `_init_session()`, `_close_session_by_id()`. 123 JSON-RPC methods. |
| WS handler | `tui_gateway/ws.py` | gateway-team | Exports `handle_ws(ws)` — async handler for WebSocket connections. |
| Transport | `tui_gateway/transport.py` | gateway-team | Exports `StdioTransport`, `WSTransport`, `Transport`, `bind_transport()`, `current_transport()`. |
| Event publisher | `tui_gateway/event_publisher.py` | gateway-team | Exports `WsPublisherTransport` — best-effort WS publisher for `/api/pub`. |
| Entry point | `tui_gateway/entry.py` | gateway-team | Exports `main()` — CLI entry for `hermes --tui`. |
| Slash worker | `tui_gateway/slash_worker.py` | gateway-team | Exports `main()` — CLI entry for `tui_gateway.slash_worker`. |
| Render | `tui_gateway/render.py` | gateway-team | Exports `make_stream_renderer()`, `render_diff()`, `render_message()`. |
| Git probe | `tui_gateway/git_probe.py` | gateway-team | Exports git repository probing utilities. |
| Project tree | `tui_gateway/project_tree.py` | gateway-team | Exports project tree discovery. |

### 3.4 Agent Core Modules

| Module | Path | Owner | Contract |
|--------|------|-------|----------|
| Agent loop | `agent/run_agent.py` | agent-team | Exports `run_conversation()` — main LLM loop. Takes `callbacks` dict. |
| Conversation compression | `agent/conversation_compression.py` | agent-team | Exports `COMPACTION_STATUS_MARKER`, compression logic. |
| Tool MCP server | `agent/transports/hermes_tools_mcp_server.py` | agent-team | Exports MCP server for tool access. |
| Codex app server | `agent/transports/codex_app_server.py` | agent-team | Exports Codex app server. |
| Tool registry | `tools/registry.py` | agent-team | Exports `registry` singleton, `ToolEntry` class, `discover_builtin_tools()`. |
| Model tools | `model_tools.py` | agent-team | Exports Anthropic/OpenAI tool format translators. |
| Tool: shell | `tools/terminal_tool.py` | agent-team | Terminal/shell execution tool. |
| Tool: browser | `tools/web_tools.py` | agent-team | Browser automation tool. |
| Tool: vision | `tools/vision_tools.py` | agent-team | Vision/image analysis tool. |
| Tool: TTS | `tools/tts_tool.py` | agent-team | Text-to-speech tool. |
| Tool: voice | `tools/voice_mode.py` | agent-team | Voice mode tool. |
| Tool: STT | `tools/transcription_tools.py` | agent-team | Speech-to-text tool. |
| Tool: skills | `tools/skills_tool.py` | agent-team | Skills management tool. |
| Tool: skills hub | `tools/skills_hub.py` | agent-team | Skills hub tool. |
| Tool: skills sync | `tools/skills_sync.py` | agent-team | Skills sync tool. |
| Tool: skills guard | `tools/skills_guard.py` | agent-team | Skills guard tool. |
| Tool: skills AST audit | `tools/skills_ast_audit.py` | agent-team | Skills AST audit tool. |
| Tool: skills manager | `tools/skill_manager_tool.py` | agent-team | Skills manager tool. |
| Tool: session search | `tools/session_search_tool.py` | agent-team | Session search tool (FTS5). |
| Tool: todo | `tools/todo_tool.py` | agent-team | Todo list tool. |
| Tool: process | `tools/process_registry.py` | agent-team | Process registry tool. |
| Tool: tool search | `tools/tool_search.py` | agent-team | Tool search/discovery tool. |
| Tool: tool result storage | `tools/tool_result_storage.py` | agent-team | Tool result storage. |
| Tool: tool output limits | `tools/tool_output_limits.py` | agent-team | Tool output limits. |
| Tool: slash confirm | `tools/slash_confirm.py` | agent-team | Slash command confirmation. |
| Tool: write approval | `tools/write_approval.py` | agent-team | Write approval tool. |
| Tool: approval | `tools/approval.py` | agent-team | Approval flow (exports `unregister_gateway_notify`). |
| Tool: Tirith security | `tools/tirith_security.py` | agent-team | Tirith security analysis. |
| Tool: threat patterns | `tools/threat_patterns.py` | agent-team | Threat pattern detection. |
| Tool: URL safety | `tools/url_safety.py` | agent-team | URL safety checks. |
| Tool: website policy | `tools/website_policy.py` | agent-team | Website access policy. |
| Tool: x search | `tools/x_search_tool.py` | agent-team | X/Twitter search tool. |
| Tool: xAI HTTP | `tools/xai_http.py` | agent-team | xAI HTTP tool. |
| Tool: Yuanbao | `tools/yuanbao_tools.py` | agent-team | Yuanbao tools. |
| Tool: video generation | `tools/video_generation_tool.py` | agent-team | Video generation tool. |
| Tool: skill usage | `tools/skill_usage.py` | agent-team | Skill usage tracking. |
| Tool: skill provenance | `tools/skill_provenance.py` | agent-team | Skill provenance tracking. |
| Tool: thread context | `tools/thread_context.py` | agent-team | Thread context tool. |
| Tool: tool backend helpers | `tools/tool_backend_helpers.py` | agent-team | Backend helper utilities. |
| Toolsets | `toolsets.py` | agent-team | Exports toolset definitions. |
| Toolset distributions | `toolset_distributions.py` | agent-team | Exports toolset distribution configs. |

### 3.5 Platform Modules

| Module | Path | Owner | Contract |
|--------|------|-------|----------|
| API server | `gateway/platforms/api_server.py` | platform-team | Exports `create_app()` — aiohttp app with OpenAI-compatible endpoints. |
| Platform base | `gateway/platforms/base.py` | platform-team | Exports `BasePlatformAdapter`, `SendResult`, `is_network_accessible()`. |
| Gateway config | `gateway/config.py` | platform-team | Exports `Platform`, `PlatformConfig`. |
| Gateway run | `gateway/run.py` | platform-team | Exports gateway run logic, `_redact_approval_command()`. |
| Restart | `gateway/restart.py` | platform-team | Exports restart drain logic. |
| Status | `gateway/status.py` | platform-team | Exports gateway status derivation. |

### 3.6 Infrastructure Modules

| Module | Path | Owner | Contract |
|--------|------|-------|----------|
| Utils | `utils.py` | infra-team | Exports `env_var_enabled()`, `is_truthy_value()`. |
| Constants | `hermes_constants.py` | infra-team | Exports `get_hermes_home()`, path utilities. |
| Trajectory compressor | `trajectory_compressor.py` | infra-team | Exports trajectory compression utilities. |
| Lazy deps | `tools/lazy_deps.py` | infra-team | Exports `ensure()` for lazy dependency installation. |

---

## 4. Cross-Module Dependencies

### 4.1 Dependency Graph

```
web/src/  ──imports──→  apps/shared/src/
    │
    └──fetch──→  hermes_cli/web_server.py  ──spawns──→  tui_gateway/server.py
                                                        │
                                                        ├──imports──→  tools/registry.py
                                                        ├──imports──→  agent/run_agent.py
                                                        ├──imports──→  hermes_cli/config.py
                                                        ├──imports──→  hermes_cli/plugins.py
                                                        └──imports──→  gateway/status.py
```

### 4.2 Forbidden Dependencies

| Module | MUST NOT import from | Reason |
|--------|---------------------|--------|
| `tools/registry.py` | `agent/run_agent.py`, `model_tools.py` | Circular import safety — registry is the leaf |
| `agent/run_agent.py` | `tui_gateway/server.py` | Agent core must not know about transport |
| `tui_gateway/server.py` | `tools/registry.py` (at module level) | Gateway imports registry lazily inside handlers |
| `hermes_cli/web_server.py` | `tools/registry.py` | Backend doesn't run tools |
| `web/src/` | Any Python module | Browser can't import Python |
| `apps/shared/src/` | `web/src/` or `hermes_cli/` | Shared package is dependency-free |

### 4.3 Shared Code (`@hermes/shared`)

The `apps/shared/` package is the ONLY code that may be imported by both
the frontend (`web/src/`) and potentially the backend (if shared utilities
are needed server-side). Currently it contains:

- `apps/shared/src/json-rpc-gateway.ts` — `JsonRpcGatewayClient` class

Planned additions:
- TypeScript mirror of `GatewayEvent` types
- Zod-style validation schemas for API responses
- Shared error codes

---

## 5. Module Contracts (Formal)

### 5.1 `tools/registry.py` Contract

```python
# Owner: @hermes/agent-team
# Consumers: tui_gateway/server.py (via discover_builtin_tools)

class ToolEntry:
    name: str
    description: str
    input_schema: dict
    handler: Callable
    toolset: str
    enabled: bool
    available_check: Optional[Callable[[dict], bool]]

class Registry:
    def register(
        self,
        name: str,
        description: str,
        input_schema: dict,
        handler: Callable,
        toolset: str = "builtin",
        enabled: bool = True,
        available_check: Optional[Callable] = None,
    ) -> None: ...

    def get_handler(self, name: str) -> Optional[Callable]: ...
    def list_tools(self, cfg: dict) -> List[ToolEntry]: ...
    def discover(self, tools_dir: Optional[Path] = None) -> List[str]: ...

registry = Registry()
```

### 5.2 `tui_gateway/server.py` Contract

```python
# Owner: @hermes/gateway-team
# Consumers: tui_gateway/entry.py, tui_gateway/ws.py, hermes_cli/web_server.py

def dispatch(req: dict, transport: Transport) -> Optional[dict]:
    """Dispatch a JSON-RPC request. Returns response dict or None (async)."""

def _emit(event: str, sid: str, payload: dict | None = None) -> None:
    """Emit an event to the current transport."""

def _load_cfg() -> dict:
    """Load and cache config."""

def _init_session(params: dict, transport: Transport) -> dict:
    """Create a new session."""

def _resume_session(params: dict, transport: Transport) -> dict:
    """Resume an existing session."""

def _close_session_by_id(sid: str, *, end_reason: str = "tui_close") -> bool:
    """Tear down a session."""

def _finalize_session(session: dict | None, end_reason: str = "tui_close") -> None:
    """Finalize: persist memory, fire hooks, mark ended."""
```

### 5.3 `agent/run_agent.py` Contract

```python
# Owner: @hermes/agent-team
# Consumers: tui_gateway/server.py

def run_conversation(
    session: dict,
    agent: Any,
    callbacks: dict[str, Callable],
    *,
    transport: Any = None,
) -> None:
    """
    Main LLM loop. Calls callbacks:
      - message_callback(text, state)
      - thinking_callback(text)
      - reasoning_callback(text)
      - tool_start_callback(tool_call_id, name, args)
      - tool_complete_callback(tool_call_id, name, result)
      - tool_progress_callback(event_type, name, preview)
      - clarify_callback(question, choices) -> choices
      - notice_callback(text)
      - notice_clear_callback(key)
    """
```

### 5.4 `web/src/lib/api.ts` Contract

```typescript
// Owner: @hermes/web-team
// Consumers: All frontend components

interface API {
  getStatus(): Promise<StatusResponse>;
  getSessions(limit?, offset?, profile?, order?): Promise<PaginatedSessions>;
  getSessionMessages(id, profile?): Promise<SessionMessagesResponse>;
  getSessionDetail(id, profile?): Promise<SessionInfo>;
  deleteSession(id, profile?): Promise<{ok: boolean}>;
  uploadFile(path, file, overwrite?): Promise<ManagedFileWriteResponse>;
  getConfig(): Promise<Record<string, unknown>>;
  saveConfig(config): Promise<{ok: boolean}>;
  getModelInfo(): Promise<ModelInfoResponse>;
  getCronJobs(profile?): Promise<CronJob[]>;
  getSkills(profile?): Promise<SkillInfo[]>;
  getToolsets(profile?): Promise<ToolsetInfo[]>;
  searchSessions(q, profile?): Promise<SessionSearchResponse>;
  getLogs(params): Promise<LogsResponse>;
  getOAuthProviders(): Promise<OAuthProvidersResponse>;
  startOAuthLogin(providerId): Promise<OAuthStartResponse>;
  createProfile(body): Promise<{ok: boolean; name: string; path: string}>;
  getProfiles(): Promise<{profiles: ProfileInfo[]}>;
}

export function fetchJSON<T>(url: string, init?: RequestInit, options?: FetchJSONOptions): Promise<T>;
export function authedFetch(url: string, init?: RequestInit): Promise<Response>;
export function buildWsUrl(path: string, params?: Record<string, string>): Promise<string>;
export function buildWsAuthParam(): Promise<[string, string]>;
export function getWsTicket(): Promise<{ticket: string; ttl_seconds: number}>;
export function getSessionToken(): Promise<string>;
```

### 5.5 `web/src/lib/gatewayClient.ts` Contract

```typescript
// Owner: @hermes/web-team
// Consumers: ChatPage.tsx, future chat components

export class GatewayClient {
  constructor();
  get state(): ConnectionState;
  async connect(): Promise<void>;
  async request<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  on<P = unknown>(type: GatewayEventName, cb: (ev: GatewayEvent<P>) => void): () => void;
  onAny(cb: (ev: GatewayEvent) => void): () => void;
  onState(cb: (s: ConnectionState) => void): () => void;
  disconnect(): void;
}

export type ConnectionState = "idle" | "connecting" | "open" | "closed" | "error";
export type GatewayEventName = "gateway.ready" | "session.info" | ... ;
export interface GatewayEvent<P = unknown> {
  type: GatewayEventName;
  session_id?: string;
  payload?: P;
}
```

---

## 6. Module Change Ownership

During the Web-first migration, the following modules change ownership or
receive new responsibilities:

| Module | Current Owner | Migration Change |
|--------|--------------|-----------------|
| `web/src/pages/ChatPage.tsx` | web-team | Major rewrite: xterm PTY → React chat consuming GatewayClient events |
| `web/src/lib/gatewayClient.ts` | web-team | New file: WebSocket JSON-RPC client |
| `apps/shared/src/` | web-team | Expand: add shared types, validation schemas |
| `hermes_cli/web_server.py` | backend-team | Add per-session SSE endpoint; may add embedded JSON-RPC route |
| `tui_gateway/server.py` | gateway-team | Add HTTP server capability (or separate into gateway + server) |
| `tui_gateway/ws.py` | gateway-team | Enhance: per-session routing, channel multiplexing |
| `tools/voice_mode.py` | agent-team | Add Web Audio API capture support (browser-side) |
| `tools/tts_tool.py` | agent-team | Add browser-side playback path |

---

## 7. Testing Boundaries

Each module owner is also responsible for tests:

| Module | Test Location | Coverage Target |
|--------|--------------|-----------------|
| `web/src/lib/api.ts` | `web/src/lib/*.test.ts` | 80% |
| `web/src/lib/gatewayClient.ts` | `web/src/lib/*.test.ts` | 80% |
| `web/src/pages/ChatPage.tsx` | `web/src/pages/*.test.tsx` | 70% |
| `hermes_cli/web_server.py` | `tests/test_web_server.py` | 85% |
| `tui_gateway/server.py` | `tests/test_tui_gateway_server.py` | 75% |
| `tui_gateway/ws.py` | `tests/test_tui_gateway_server.py` | 75% |
| `tools/registry.py` | `tests/test_tools.py` | 90% |
| `agent/run_agent.py` | `tests/test_agent.py` | 70% |

---

## 8. Versioning & Breaking Changes

| Package | Version | Breaking Change Policy |
|---------|---------|----------------------|
| `@hermes/shared` | 0.0.0 | SemVer once 1.0; currently experimental |
| `hermes_cli/web_server.py` | N/A (monorepo) | REST endpoints follow API version in URL path once stabilized |
| `tui_gateway/server.py` | N/A (monorepo) | JSON-RPC method names are stable; new methods additive only |
| `tools/registry.py` | N/A (monorepo) | Tool schemas are stable; removal requires deprecation period |

---

## 9. Code Review Requirements

| Change Type | Required Reviewers |
|-------------|-------------------|
| New REST endpoint | backend-team + gateway-team (if it wraps JSON-RPC) |
| New JSON-RPC method | gateway-team + agent-team (if it touches agent state) |
| New event type | gateway-team + web-team (if it has frontend consumer) |
| New tool | agent-team only |
| New frontend component | web-team only |
| Shared package change | web-team + backend-team (all consumers) |
| Config schema change | backend-team + gateway-team (config consumers) |

---

## 10. Module File Count Summary

| Category | Module Count | File Count |
|----------|-------------|------------|
| Frontend | 11 | ~50 files |
| Backend | 11 | ~15 files |
| Gateway | 9 | ~12 files |
| Agent Core | 40+ | ~45 files |
| Platform | 6 | ~10 files |
| Infrastructure | 4 | ~5 files |
| **Total** | **~81** | **~137 files** |

---

## 11. Key File Line Counts (approximate)

| File | Lines | Role |
|------|-------|------|
| `hermes_cli/web_server.py` | 13,734 | Largest file; REST + WS server |
| `tui_gateway/server.py` | 13,517 | JSON-RPC dispatcher + session management |
| `gateway/platforms/api_server.py` | 4,620 | OpenAI-compatible API server |
| `web/src/lib/api.ts` | 2,319 | Frontend REST client |
| `web/src/pages/ChatPage.tsx` | 1,132 | Chat page (xterm embed) |
| `tools/registry.py` | 589 | Tool registry |
| `tui_gateway/ws.py` | 340 | WebSocket handler |
| `tui_gateway/event_publisher.py` | 126 | Event publisher transport |
| `web/src/lib/gatewayClient.ts` | 253 | Gateway WebSocket client |
| `apps/shared/src/json-rpc-gateway.ts` | ~100 | Shared JSON-RPC client |
