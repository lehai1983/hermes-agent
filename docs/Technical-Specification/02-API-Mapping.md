# 02 — API Mapping

## 1. Purpose

This document is a complete reference mapping every REST endpoint in
`hermes_cli/web_server.py` to:

1. **Purpose** — what the endpoint does
2. **JSON-RPC equivalent** — the corresponding method in `tui_gateway/server.py`
3. **Desktop IPC equivalent** — how the desktop app invokes the same function
   (via its embedded gateway or stdio pipe)
4. **Auth** — whether the endpoint requires the session token
5. **Profile-scoped** — whether it honors `?profile=<name>`

All REST endpoints are served under the `BASE` path (usually `/`, configurable
via `HERMES_BASE_PATH` or `X-Forwarded-Prefix`).

---

## 2. Conventions

| Column | Meaning |
|--------|---------|
| **Method** | HTTP method |
| **Path** | URL path (relative to `BASE`) |
| **Purpose** | One-line description |
| **JSON-RPC** | Method name in `tui_gateway/server.py` (e.g. `session.create`) |
| **Desktop IPC** | How the desktop app triggers this (usually a JSON-RPC call over the stdio pipe) |
| **Auth** | `public` = no auth needed; `token` = requires session token; `token-or-ticket` = accepts either |
| **Profile** | `yes` = honors `?profile=` query param; `no` = machine-global |

---

## 3. System & Status

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/status` | Gateway status (pid, uptime, model, busy state) | `gateway.status` | Same method name | public | yes |
| GET | `/api/system/stats` | System resource stats (cpu, mem, disk) | N/A (backend-only) | N/A | token | no |
| GET | `/api/portal` | Portal/health check for orchestrators | N/A | N/A | public | no |
| GET | `/api/curator` | Curator state (paused, active tasks) | `curator.status` | Same | token | no |
| PUT | `/api/curator/paused` | Pause/resume curator | `curator.pause` | Same | token | no |
| POST | `/api/curator/run` | Trigger curator run | `curator.run` | Same | token | no |
| GET | `/api/actions/{name}/status` | Status of a long-running action | `actions.status` | Same | token | no |

---

## 4. Configuration

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/config` | Read current config (merged with defaults) | `config.get` | Same | token | yes |
| GET | `/api/config/defaults` | Read DEFAULT_CONFIG schema | N/A | N/A | token | no |
| GET | `/api/config/schema` | Build UI schema from DEFAULT_CONFIG | N/A | N/A | token | no |
| PUT | `/api/config` | Write config (validates + persists) | `config.set` | Same | token | yes |
| GET | `/api/env` | List environment variables (redacted) | `env.list` | Same | token | no |
| PUT | `/api/env` | Set an env var | `env.set` | Same | token | no |
| DELETE | `/api/env` | Delete an env var | `env.delete` | Same | token | no |
| POST | `/api/env/reveal` | Reveal a secret env var value | `env.reveal` | Same | token | no |
| POST | `/api/providers/validate` | Validate provider credentials | `providers.validate` | Same | token | no |

---

## 5. Model Management

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/model/info` | Current model + capabilities | `model.info` | Same | token | yes |
| GET | `/api/model/options` | Available models (from catalog + custom) | `model.options` | Same | token | yes |
| GET | `/api/model/recommended-default` | Recommended default model | N/A | N/A | token | no |
| GET | `/api/model/auxiliary` | Auxiliary model config (image, voice) | `model.auxiliary` | Same | token | yes |
| GET | `/api/model/moa` | Multi-model orchestration config | `model.moa` | Same | token | yes |
| PUT | `/api/model/moa` | Update MOA config | `model.moa.set` | Same | token | yes |
| POST | `/api/model/set` | Switch active model | `model.set` | Same | token | yes |

---

## 6. Sessions

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/sessions` | List sessions (paginated) | `session.list` | Same | token | yes |
| GET | `/api/profiles/sessions` | List sessions across all profiles | `session.list` (profile="all") | Same | token | no |
| GET | `/api/sessions/search` | FTS5 search over session messages | `session.search` | Same | token | yes |
| GET | `/api/sessions/stats` | Session store statistics | `session.stats` | Same | token | yes |
| GET | `/api/sessions/{id}` | Session detail (metadata) | `session.info` | Same | token | yes |
| GET | `/api/sessions/{id}/messages` | Session message history | `session.messages` | Same | token | yes |
| GET | `/api/sessions/{id}/latest-descendant` | Latest descendant after compression | `session.latest_descendant` | Same | token | no |
| PATCH | `/api/sessions/{id}` | Rename session | `session.rename` | Same | token | yes |
| DELETE | `/api/sessions/{id}` | Delete a session | `session.delete` | Same | token | yes |
| GET | `/api/sessions/{id}/export` | Export session as Markdown/JSON | `session.export` | Same | token | yes |
| POST | `/api/sessions/prune` | Prune sessions older than N days | `session.prune` | Same | token | yes |
| POST | `/api/sessions/bulk-delete` | Delete multiple sessions | `session.bulk_delete` | Same | token | yes |
| GET | `/api/sessions/empty/count` | Count empty sessions | `session.empty.count` | Same | token | yes |
| DELETE | `/api/sessions/empty` | Delete all empty sessions | `session.empty.delete` | Same | token | yes |

---

## 7. Session Lifecycle (JSON-RPC native)

These are not REST endpoints but JSON-RPC methods the gateway exposes. The
REST endpoints above are the dashboard's HTTP wrappers for some of these.

| JSON-RPC Method | Purpose | Emitted Events |
|-----------------|---------|----------------|
| `session.create` | Create new session (model, profile, project) | `session.info` |
| `session.resume` | Resume existing session by ID | `session.info` |
| `session.branch` | Branch from a message in existing session | `session.info` |
| `session.compress` | Summarize/compact session history | `session.info` |
| `session.close` | Close and finalize session | `session.info` (final) |
| `session.interrupt` | Interrupt mid-turn execution | `status.update` |
| `prompt.submit` | Submit user prompt to agent | `message.start`, `message.delta`, `message.complete`, `tool.*` |
| `approval.respond` | Approve/deny a tool execution | (resolves pending approval) |

---

## 8. Files & Filesystem

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/files` | List managed files | `files.list` | Same | token | no |
| GET | `/api/files/read` | Read file content (text) | `files.read` | Same | token | no |
| GET | `/api/files/download` | Download file (binary) | `files.download` | Same | token-or-ticket | no |
| POST | `/api/files/upload` | Upload file (base64 JSON) | `files.upload` | Same | token | no |
| POST | `/api/files/upload-stream` | Upload file (multipart) | `files.upload` | Same | token | no |
| POST | `/api/files/mkdir` | Create directory | `files.mkdir` | Same | token | no |
| DELETE | `/api/files` | Delete file/directory | `files.delete` | Same | token | no |
| GET | `/api/fs/list` | List arbitrary filesystem path | `fs.list` | Same | token | no |
| GET | `/api/fs/read-text` | Read arbitrary file as text | `fs.read_text` | Same | token | no |
| POST | `/api/fs/write-text` | Write arbitrary file as text | `fs.write_text` | Same | token | no |
| GET | `/api/fs/read-data-url` | Read file as data URL | `fs.read_data_url` | Same | token | no |
| GET | `/api/fs/git-root` | Resolve git root for CWD | `fs.git_root` | Same | token | no |
| GET | `/api/fs/default-cwd` | Get default working directory | `fs.default_cwd` | Same | token | no |

---

## 9. Audio / Voice

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| POST | `/api/audio/transcribe` | Speech-to-text (upload audio blob) | `audio.transcribe` | Same | token | no |
| GET | `/api/audio/elevenlabs/voices` | List ElevenLabs voices | `audio.voices` | Same | token | no |
| POST | `/api/audio/speak` | Text-to-speech | `audio.speak` | Same | token | no |

---

## 10. Cron & Automation

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/cron/jobs` | List cron jobs | `cron.list` | Same | token | yes |
| GET | `/api/cron/jobs/{id}` | Get single cron job | `cron.get` | Same | token | yes |
| GET | `/api/cron/jobs/{id}/runs` | List cron job run history | `cron.runs` | Same | token | yes |
| POST | `/api/cron/jobs` | Create cron job | `cron.create` | Same | token | yes |
| PUT | `/api/cron/jobs/{id}` | Update cron job | `cron.update` | Same | token | yes |
| POST | `/api/cron/jobs/{id}/pause` | Pause cron job | `cron.pause` | Same | token | yes |
| POST | `/api/cron/jobs/{id}/resume` | Resume cron job | `cron.resume` | Same | token | yes |
| POST | `/api/cron/jobs/{id}/trigger` | Manually trigger cron job | `cron.trigger` | Same | token | yes |
| DELETE | `/api/cron/jobs/{id}` | Delete cron job | `cron.delete` | Same | token | yes |
| POST | `/api/cron/fire` | Fire a one-shot cron expression | `cron.fire` | Same | token | yes |
| GET | `/api/cron/delivery-targets` | List delivery targets | `cron.delivery_targets` | Same | token | no |
| GET | `/api/cron/blueprints` | List automation blueprints | `cron.blueprints` | Same | token | no |
| POST | `/api/cron/blueprints/instantiate` | Instantiate blueprint → CronJob | `cron.blueprint.instantiate` | Same | token | yes |

---

## 11. MCP Servers

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/mcp/servers` | List MCP server configs | `mcp.list` | Same | token | no |
| POST | `/api/mcp/servers` | Add MCP server config | `mcp.add` | Same | token | no |
| DELETE | `/api/mcp/servers/{name}` | Remove MCP server | `mcp.remove` | Same | token | no |
| POST | `/api/mcp/servers/{name}/test` | Test MCP server connection | `mcp.test` | Same | token | no |
| PUT | `/api/mcp/servers/{name}/enabled` | Enable/disable MCP server | `mcp.enabled` | Same | token | no |
| GET | `/api/mcp/catalog` | Browse MCP skill catalog | `mcp.catalog` | Same | token | no |
| POST | `/api/mcp/catalog/install` | Install from catalog | `mcp.install` | Same | token | no |

---

## 12. Memory

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/memory/providers/{name}/config` | Get memory provider config | `memory.provider.config` | Same | token | no |
| PUT | `/api/memory/providers/{name}/config` | Update memory provider config | `memory.provider.set` | Same | token | no |

---

## 13. Profiles

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/profiles` | List all profiles | `profile.list` | Same | token | no |
| GET | `/api/profiles/active` | Get active profile | `profile.active` | Same | token | no |
| POST | `/api/profiles/active` | Set active profile | `profile.set_active` | Same | token | no |
| POST | `/api/profiles` | Create new profile | `profile.create` | Same | token | no |
| PATCH | `/api/profiles/{name}` | Rename profile | `profile.rename` | Same | token | no |
| DELETE | `/api/profiles/{name}` | Delete profile | `profile.delete` | Same | token | no |
| GET | `/api/profiles/{name}/setup-command` | Get setup command for profile | `profile.setup_command` | Same | token | no |
| GET | `/api/profiles/{name}/soul` | Read profile soul file | `profile.soul` | Same | token | no |
| PUT | `/api/profiles/{name}/soul` | Write profile soul file | `profile.soul.set` | Same | token | no |
| POST | `/api/profiles/{name}/describe-auto` | Auto-generate profile description | `profile.describe_auto` | Same | token | no |
| PUT | `/api/profiles/{name}/model` | Set profile model | `profile.model.set` | Same | token | no |
| GET | `/api/profiles/{name}/sessions` | List sessions for profile | `session.list` (profile=...) | Same | token | no |

---

## 14. Skills & Toolsets

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/skills` | List installed skills | `skills.list` | Same | token | yes |
| PUT | `/api/skills/toggle` | Enable/disable a skill | `skills.toggle` | Same | token | yes |
| GET | `/api/skills/content` | Read skill content | `skills.content` | Same | token | yes |
| POST | `/api/skills` | Create new skill | `skills.create` | Same | token | yes |
| PUT | `/api/skills/content` | Update skill content | `skills.update` | Same | token | yes |
| GET | `/api/tools/toolsets` | List toolsets | `toolsets.list` | Same | token | yes |
| PUT | `/api/tools/toolsets/{name}` | Enable/disable toolset | `toolsets.toggle` | Same | token | yes |
| GET | `/api/tools/toolsets/{name}/config` | Read toolset config | `toolsets.config` | Same | token | yes |
| PUT | `/api/tools/toolsets/{name}/provider` | Set toolset provider | `toolsets.provider` | Same | token | yes |
| PUT | `/api/tools/toolsets/{name}/env` | Set toolset env vars | `toolsets.env` | Same | token | yes |
| POST | `/api/tools/toolsets/{name}/post-setup` | Run toolset post-setup | `toolsets.post_setup` | Same | token | yes |

---

## 15. Messaging & Channels

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/messaging/platforms` | List messaging platforms | `messaging.platforms.list` | Same | token | no |
| PUT | `/api/messaging/platforms/{id}` | Update platform config | `messaging.platforms.update` | Same | token | no |
| POST | `/api/messaging/platforms/{id}/test` | Test platform connection | `messaging.platforms.test` | Same | token | no |
| POST | `/api/messaging/telegram/onboarding/start` | Start Telegram onboarding | `telegram.onboarding.start` | Same | token | no |
| GET | `/api/messaging/telegram/onboarding/{id}` | Poll onboarding status | `telegram.onboarding.status` | Same | token | no |
| POST | `/api/messaging/telegram/onboarding/{id}/apply` | Apply onboarding result | `telegram.onboarding.apply` | Same | token | no |
| DELETE | `/api/messaging/telegram/onboarding/{id}` | Cancel onboarding | `telegram.onboarding.cancel` | Same | token | no |

---

## 16. OAuth Providers

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/providers/oauth` | List OAuth providers | `oauth.list` | Same | token | no |
| DELETE | `/api/providers/oauth/{id}` | Disconnect OAuth provider | `oauth.disconnect` | Same | token | no |
| POST | `/api/providers/oauth/{id}/start` | Start OAuth flow | `oauth.start` | Same | token | no |
| POST | `/api/providers/oauth/{id}/submit` | Submit OAuth code | `oauth.submit` | Same | token | no |
| GET | `/api/providers/oauth/{id}/poll/{sid}` | Poll OAuth session | `oauth.poll` | Same | token | no |
| DELETE | `/api/providers/oauth/sessions/{sid}` | Cancel OAuth session | `oauth.session.cancel` | Same | token | no |

---

## 17. Pairing & Security

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/pairing` | Get pairing request | `pairing.status` | Same | token | no |
| POST | `/api/pairing/approve` | Approve pairing request | `pairing.approve` | Same | token | no |

---

## 18. Logs & Diagnostics

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/logs` | Read agent logs (paginated, filterable) | `logs.read` | Same | token | no |
| POST | `/api/ops/prompt-size` | Calculate prompt token size | `ops.prompt_size` | Same | token | no |
| POST | `/api/ops/dump` | Create diagnostic dump | `ops.dump` | Same | token | no |
| POST | `/api/ops/config-migrate` | Migrate config schema | `ops.config_migrate` | Same | token | no |
| POST | `/api/ops/debug-share` | Create debug share bundle | `ops.debug_share` | Same | token | no |

---

## 19. Gateway Control

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| POST | `/api/gateway/restart` | Restart the gateway process | `gateway.restart` | Same | token | no |
| POST | `/api/gateway/drain` | Drain gateway (stop accepting new sessions) | `gateway.drain` | Same | token | no |
| POST | `/api/hermes/update` | Trigger self-update | `hermes.update` | Same | token | no |
| GET | `/api/hermes/update/check` | Check for updates | `hermes.update.check` | Same | token | no |

---

## 20. Media

| Method | Path | Purpose | JSON-RPC | Desktop IPC | Auth | Profile |
|--------|------|---------|----------|-------------|------|---------|
| GET | `/api/media` | Serve media files (images, etc.) | N/A | N/A | token | no |

---

## 21. WebSocket Endpoints

| Path | Direction | Purpose | Protocol |
|------|-----------|---------|----------|
| `/api/ws` | Bidirectional | JSON-RPC 2.0 for chat (replaces stdio) | Newline-delimited JSON |
| `/api/pty` | Bidirectional | Legacy PTY bridge to `hermes --tui` subprocess | Raw bytes (VT100) |
| `/api/pub` | Gateway → Backend | Event rebroadcast (tool/reasoning/status) | Newline-delimited JSON dicts |
| `/api/events` | Backend → Browser | Dashboard sidebar event stream | Rebroadcast of `/api/pub` frames |

---

## 22. Auth Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/auth/ws-ticket` | Mint single-use WS ticket (gated mode) | Cookie session |
| GET | `/api/auth/me` | Get verified session identity (gated mode) | Cookie session |
| POST | `/auth/logout` | Destroy session cookie | Cookie session |

---

## 23. API Server (OpenAI-compatible)

The `gateway/platforms/api_server.py` exposes a separate HTTP server
(port 8642) for OpenAI-compatible access:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/chat/completions` | OpenAI Chat Completions |
| POST | `/v1/responses` | OpenAI Responses API |
| GET | `/v1/responses/{id}` | Retrieve stored response |
| DELETE | `/v1/responses/{id}` | Delete stored response |
| GET | `/v1/models` | List available models |
| GET | `/v1/capabilities` | API capabilities |
| GET | `/api/sessions` | List client-visible sessions |
| POST | `/api/sessions` | Create session |
| GET/PATCH/DELETE | `/api/sessions/{id}` | Read/update/delete session |
| POST | `/api/sessions/{id}/fork` | Branch session |
| POST | `/api/sessions/{id}/chat` | Chat with session |
| POST | `/v1/runs` | Start a run |
| GET | `/v1/runs/{id}` | Get run status |
| GET | `/v1/runs/{id}/events` | SSE stream of run events |
| POST | `/v1/runs/{id}/approval` | Resolve approval |
| POST | `/v1/runs/{id}/stop` | Interrupt run |
| GET | `/health` | Health check |
| GET | `/health/detailed` | Detailed health |

---

## 24. Endpoint Count Summary

| Category | REST endpoints | JSON-RPC methods |
|----------|---------------|-----------------|
| System/Status | 7 | 3 |
| Config | 4 | 2 |
| Model | 6 | 5 |
| Sessions (REST) | 13 | 7 (lifecycle) |
| Files/Filesystem | 13 | 13 |
| Audio/Voice | 3 | 3 |
| Cron/Automation | 13 | 13 |
| MCP | 7 | 7 |
| Memory | 2 | 2 |
| Profiles | 12 | 12 |
| Skills/Toolsets | 11 | 11 |
| Messaging | 7 | 7 |
| OAuth | 6 | 6 |
| Pairing | 2 | 2 |
| Logs/Diagnostics | 5 | 5 |
| Gateway Control | 4 | 4 |
| Media | 1 | 0 |
| Auth | 3 | 0 |
| **Total** | **~181** | **~123** |

---

## 25. Frontend API Surface

The TypeScript client in `web/src/lib/api.ts` wraps these REST endpoints.
The mapping from `api.*` method to REST endpoint:

| TypeScript `api.*` method | REST Endpoint | Returns |
|---------------------------|---------------|---------|
| `api.getStatus()` | `GET /api/status` | `StatusResponse` |
| `api.getSessions()` | `GET /api/sessions` | `PaginatedSessions` |
| `api.getSessionMessages(id)` | `GET /api/sessions/{id}/messages` | `SessionMessagesResponse` |
| `api.getSessionDetail(id)` | `GET /api/sessions/{id}` | `SessionInfo` |
| `api.deleteSession(id)` | `DELETE /api/sessions/{id}` | `{ok: boolean}` |
| `api.uploadFile(path, file)` | `POST /api/files/upload-stream` | `ManagedFileWriteResponse` |
| `api.getConfig()` | `GET /api/config` | `Record<string, unknown>` |
| `api.saveConfig(config)` | `PUT /api/config` | `{ok: boolean}` |
| `api.getModelInfo()` | `GET /api/model/info` | `ModelInfoResponse` |
| `api.getCronJobs()` | `GET /api/cron/jobs` | `CronJob[]` |
| `api.getSkills()` | `GET /api/skills` | `SkillInfo[]` |
| `api.getToolsets()` | `GET /api/tools/toolsets` | `ToolsetInfo[]` |
| `api.searchSessions(q)` | `GET /api/sessions/search` | `SessionSearchResponse` |
| `api.getLogs(params)` | `GET /api/logs` | `LogsResponse` |
| `api.getOAuthProviders()` | `GET /api/providers/oauth` | `OAuthProvidersResponse` |
| `api.startOAuthLogin(id)` | `POST /api/providers/oauth/{id}/start` | `OAuthStartResponse` |
| `api.createProfile(body)` | `POST /api/profiles` | `{ok: boolean, ...}` |
| `api.getProfiles()` | `GET /api/profiles` | `{profiles: ProfileInfo[]}` |

---

## 26. Key Differences: REST vs JSON-RPC

| Aspect | REST (`web_server.py`) | JSON-RPC (`tui_gateway/server.py`) |
|--------|----------------------|-------------------------------------|
| Session management | HTTP session token in header | `session.create` / `session.close` methods |
| Streaming | Not supported (request/response) | Event stream via `_emit()` → transport |
| Tool execution | N/A (backend doesn't run tools) | `shell.exec`, `browser.manage`, etc. |
| State | Stateless (per-request) | Stateful (session dict in `_sessions`) |
| Auth | Token in header or cookie | Implicit (transport is authenticated) |
| Error format | HTTP status codes | JSON-RPC error envelope (`code`, `message`) |
| Notification | None (pull model) | Push events (`message.delta`, `tool.start`, etc.) |

The Web-first migration unifies these: the browser speaks JSON-RPC directly
to the gateway (via WebSocket), eliminating the REST-to-JSON-RPC translation
layer for chat operations. REST remains for config, files, cron, and
management operations that don't need streaming.
