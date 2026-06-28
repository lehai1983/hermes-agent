# 05 — Data Flow Contracts

## 1. Purpose

This document defines the formal data shapes that flow between modules. It
specifies the exact fields, types, and optionality for every cross-boundary
data exchange. These contracts are the source of truth for both Python
runtime validation and TypeScript type definitions.

The format is "Zod-style" (describing shapes as if for validation) but without
importing Zod — these are documentation-only contracts that should be mirrored
in actual Zod schemas in `apps/shared/src/schemas.ts` once the shared package
matures.

---

## 2. Notation

| Symbol | Meaning |
|--------|---------|
| `string` | UTF-8 string |
| `number` | Integer or float |
| `boolean` | true/false |
| `T \| null` | Nullable |
| `T \| undefined` | Optional (may be absent) |
| `Record<string, T>` | String-keyed map of T |
| `T[]` | Array of T |
| `{ ... }` | Object with listed fields |
| `enum(...)` | One of the listed literal values |

---

## 3. Core Data Shapes

### 3.1 Session

```typescript
// Canonical session shape (as stored in _sessions dict)
interface Session {
  session_key: string;           // Unique session key (UUID or composite)
  session_id: string;            // Live session ID (may change on compression)
  model: string;                 // e.g. "anthropic/claude-sonnet-4.6"
  provider: string;              // e.g. "anthropic", "openai"
  profile: string;               // Profile name, "" = default
  project: string | null;        // Project name if session is project-scoped
  history: Message[];            // Conversation history
  history_lock: unknown;         // threading.Lock (Python) / undefined (TS)
  transport: Transport | null;   // Current transport (stdio, WS, or null)
  agent: Agent | null;           // Agent instance
  slash_worker: SlashWorker | null; // Persistent slash subprocess
  running: boolean;              // Is agent loop active?
  close_on_disconnect: boolean;  // Close session when transport disconnects
  active_session_lease: unknown; // Lease for active-session slot
  _finalized: boolean;           // Has _finalize_session run?
  _notif_stop: unknown;          // threading.Event for notification stop
  _session_messages: Message[];  // Last persisted snapshot
}
```

### 3.2 Message

```typescript
// Conversation message
interface Message {
  role: "user" | "assistant" | "system" | "tool_result";
  content: string | ContentBlock[];
  timestamp?: number;           // Unix epoch seconds
  message_id?: string;           // Unique message ID
  tool_calls?: ToolCall[];       // Present when role="assistant" and calling tools
  tool_call_id?: string;         // Present when role="tool_result"
  metadata?: Record<string, unknown>;  // Additional metadata
}

interface ContentBlock {
  type: "text" | "tool_use" | "tool_result" | "image";
  text?: string;
  tool_use?: ToolCall;
  tool_result?: ToolResult;
  image?: ImageBlock;
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface ImageBlock {
  type: "image";
  source: {
    type: "base64" | "url";
    media_type: string;
    data: string;
  };
}
```

### 3.3 GatewayEvent

```typescript
// Event emitted by gateway via _emit()
interface GatewayEvent {
  type: GatewayEventName;
  session_id?: string;
  payload?: unknown;
}

type GatewayEventName =
  | "gateway.ready"
  | "session.info"
  | "message.start"
  | "message.delta"
  | "message.complete"
  | "thinking.delta"
  | "reasoning.delta"
  | "reasoning.available"
  | "status.update"
  | "tool.start"
  | "tool.progress"
  | "tool.complete"
  | "tool.generating"
  | "clarify.request"
  | "approval.request"
  | "sudo.request"
  | "secret.request"
  | "background.complete"
  | "error"
  | "skin.changed"
  | "pet.generate.progress"
  | "pet.hatch.progress"
  | "preview.restart.progress";
```

### 3.4 Config

```typescript
// Hermes configuration (subset — full schema in DEFAULT_CONFIG)
interface HermesConfig {
  model: string;
  model_context_length: number;
  provider: string;
  terminal: TerminalConfig;
  display: DisplayConfig;
  agent: AgentConfig;
  security: SecurityConfig;
  memory: MemoryConfig;
  cron: CronConfig;
  voice: VoiceConfig;
  tts: TTSConfig;
  stt: STTConfig;
  dashboard: DashboardConfig;
  delegation: DelegationConfig;
  browser: BrowserConfig;
  logging: LoggingConfig;
  updates: UpdatesConfig;
}

interface TerminalConfig {
  backend: "local" | "docker" | "ssh" | "modal" | "daytona" | "singularity";
  modal_mode: "sandbox" | "function";
}

interface DisplayConfig {
  skin: "default" | "ares" | "mono" | "slate";
  resume_display: "minimal" | "full" | "off";
  busy_input_mode: "interrupt" | "queue" | "steer";
}

interface AgentConfig {
  service_tier: "" | "auto" | "default" | "flex";
  context_engine: "default" | "custom";
}

interface SecurityConfig {
  approvals: {
    mode: "ask" | "yolo" | "deny";
  };
}

interface MemoryConfig {
  provider: "builtin" | "honcho";
}

interface DashboardConfig {
  theme: "default" | "midnight" | "ember" | "mono" | "cyberpunk" | "rose";
}

interface TTSConfig {
  provider: "edge" | "elevenlabs" | "openai" | "neutts";
}

interface STTConfig {
  provider: "local" | "groq" | "openai" | "xai" | "elevenlabs";
  elevenlabs_model_id: "scribe_v2" | "scribe_v1";
}

interface DelegationConfig {
  reasoning_effort: "" | "low" | "medium" | "high";
}

interface LoggingConfig {
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
}

interface UpdatesConfig {
  non_interactive_local_changes: "stash" | "discard";
}
```

---

## 4. REST API Request/Response Contracts

### 4.1 `GET /api/status` → `StatusResponse`

```typescript
interface StatusResponse {
  status: "running" | "stopped" | "starting";
  pid: number | null;
  uptime_seconds: number;
  model: string;
  provider: string;
  busy: boolean;
  drainable: boolean;
  version: string;
  release_date: string;
  active_sessions: number;
  gateway_mode: string;
}
```

### 4.2 `GET /api/sessions` → `PaginatedSessions`

```typescript
interface PaginatedSessions {
  sessions: SessionSummary[];
  total: number;
  limit: number;
  offset: number;
}

interface SessionSummary {
  session_id: string;
  title: string;
  model: string;
  profile: string;
  created: number;          // Unix epoch
  updated: number;          // Unix epoch
  message_count: number;
  has_tool_calls: boolean;
  status: "idle" | "running" | "closed";
  is_empty: boolean;        // No user messages
}
```

### 4.3 `GET /api/sessions/{id}` → `SessionInfo`

```typescript
interface SessionInfo {
  session_id: string;
  session_key: string;
  model: string;
  provider: string;
  profile: string;
  project: string | null;
  title: string;
  created: number;
  updated: number;
  message_count: number;
  context_used: number;
  context_limit: number;
  compaction_count: number;
  skills: string[];
  mcp_servers: string[];
  status: "idle" | "running" | "compacting" | "error";
  tags: string[];
}
```

### 4.4 `GET /api/sessions/{id}/messages` → `SessionMessagesResponse`

```typescript
interface SessionMessagesResponse {
  session_id: string;
  messages: Message[];
  total: number;
  has_more: boolean;
}
```

### 4.5 `POST /api/sessions` (create) → `SessionCreateResponse`

```typescript
// Request body
interface SessionCreateRequest {
  model?: string;
  profile?: string;
  project?: string;
  title?: string;
}

// Response
interface SessionCreateResponse {
  session_id: string;
  session_key: string;
  model: string;
  provider: string;
  profile: string;
  created: number;
}
```

### 4.6 `POST /api/sessions/{id}/fork` → `SessionForkResponse`

```typescript
// Request body
interface SessionForkRequest {
  message_id?: string;       // Fork point (null = fork at end)
}

// Response
interface SessionForkResponse {
  session_id: string;        // New branched session
  source_session_id: string;
  message_count: number;
}
```

### 4.7 `GET /api/model/info` → `ModelInfoResponse`

```typescript
interface ModelInfoResponse {
  model: string;
  provider: string;
  context_length: number;
  supports_vision: boolean;
  supports_tools: boolean;
  supports_streaming: boolean;
  max_output_tokens: number;
  pricing: {
    input_per_1m: number;
    output_per_1m: number;
    cache_read_per_1m: number;
    cache_write_per_1m: number;
  };
}
```

### 4.8 `POST /api/model/set` → `ModelAssignmentResponse`

```typescript
// Request body
interface ModelAssignmentRequest {
  model: string;             // e.g. "anthropic/claude-sonnet-4.6"
  provider?: string;          // Optional override
  profile?: string;           // Scope to specific profile
}

// Response
interface ModelAssignmentResponse {
  ok: boolean;
  previous_model: string;
  current_model: string;
  provider: string;
}
```

### 4.9 `GET /api/cron/jobs` → `CronJob[]`

```typescript
interface CronJob {
  id: string;                  // UUID
  name: string;
  schedule: string;            // Cron expression or "natural:..."
  task: string;                // Prompt to run
  enabled: boolean;
  profile: string;
  model: string | null;
  delivery_targets: CronDeliveryTarget[];
  created: number;
  last_run: number | null;
  next_run: number | null;
  run_count: number;
  last_status: "success" | "failure" | "pending" | null;
  metadata: Record<string, unknown>;
}

interface CronDeliveryTarget {
  type: "telegram" | "discord" | "webhook" | "local";
  target_id: string;
  config: Record<string, unknown>;
}
```

### 4.10 `GET /api/profiles` → `ProfileListResponse`

```typescript
interface ProfileListResponse {
  profiles: ProfileInfo[];
}

interface ProfileInfo {
  name: string;
  path: string;               // Filesystem path to profile dir
  model_set: boolean;
  mcp_written: number;
  skills_disabled: number;
  hub_installs: Array<{ identifier: string; pid: number | null }>;
  description: string;
  description_auto: boolean;
  is_active: boolean;
}
```

### 4.11 `GET /api/skills` → `SkillInfo[]`

```typescript
interface SkillInfo {
  name: string;
  category: string;
  enabled: boolean;
  description: string;
  content_length: number;
  file_path: string;
}
```

### 4.12 `GET /api/tools/toolsets` → `ToolsetInfo[]`

```typescript
interface ToolsetInfo {
  name: string;
  enabled: boolean;
  provider: string;
  description: string;
  config: Record<string, string>;
}
```

### 4.13 `GET /api/logs` → `LogsResponse`

```typescript
interface LogsResponse {
  entries: LogEntry[];
  total: number;
  file: string;
}

interface LogEntry {
  timestamp: number;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  component: string;
  message: string;
}
```

### 4.14 `POST /api/files/upload-stream` → `ManagedFileWriteResponse`

```typescript
// Response
interface ManagedFileWriteResponse {
  ok: boolean;
  path: string;
  size: number;
  overwritten: boolean;
}
```

### 4.15 `GET /api/files` → `ManagedFilesResponse`

```typescript
interface ManagedFilesResponse {
  files: ManagedFileInfo[];
  path: string;
}

interface ManagedFileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  mime_type: string;
}
```

### 4.16 `POST /api/audio/transcribe` → `TranscriptionResponse`

```typescript
interface TranscriptionResponse {
  text: string;
  language: string;
  duration_seconds: number;
  provider: string;
}
```

### 4.17 `POST /api/audio/speak` → `TTSResponse`

```typescript
interface TTSRequest {
  text: string;
  provider?: string;
  voice?: string;
}

interface TTSResponse {
  ok: boolean;
  duration_seconds: number;
  provider: string;
  format: string;
}
```

### 4.18 `GET /api/oauth/providers` → `OAuthProvidersResponse`

```typescript
interface OAuthProvidersResponse {
  providers: OAuthProviderInfo[];
}

interface OAuthProviderInfo {
  id: string;
  name: string;
  connected: boolean;
  scopes: string[];
  expires_at: number | null;
}
```

### 4.19 `POST /api/providers/oauth/{id}/start` → `OAuthStartResponse`

```typescript
interface OAuthStartResponse {
  url: string;                 // URL to open in browser for consent
  session_id: string;          // Poll with this ID
  expires_in: number;          // Session expires in N seconds
}
```

### 4.20 `GET /api/sessions/search` → `SessionSearchResponse`

```typescript
interface SessionSearchResponse {
  results: SessionSearchResult[];
  total: number;
  query: string;
}

interface SessionSearchResult {
  session_id: string;
  title: string;
  snippet: string;             // Matching text snippet with highlights
  message_id: string;
  score: number;               // FTS5 relevance score
}
```

---

## 5. JSON-RPC Request/Response Contracts

### 5.1 Request

```typescript
interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id: string | number | null;
}
```

### 5.2 Success Response

```typescript
interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  result: unknown;
  id: string | number;
}
```

### 5.3 Error Response

```typescript
interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number | null;
}
```

### 5.4 Event Notification

```typescript
interface JsonRpcEvent {
  jsonrpc: "2.0";
  method: "event";
  params: {
    type: GatewayEventName;
    session_id: string;
    payload?: unknown;
  };
}
```

---

## 6. Key JSON-RPC Method Signatures

### 6.1 `session.create`

```typescript
interface SessionCreateParams {
  model?: string;
  profile?: string;
  project?: string;
  title?: string;
  fresh?: boolean;
}

interface SessionCreateResult {
  session_id: string;
  session_key: string;
  model: string;
  provider: string;
  profile: string;
  created: number;
}
```

### 6.2 `session.resume`

```typescript
interface SessionResumeParams {
  session_id: string;
}

interface SessionResumeResult {
  session_id: string;
  session_key: string;
  model: string;
  message_count: number;
  resumed: boolean;
}
```

### 6.3 `session.close`

```typescript
interface SessionCloseParams {
  session_id: string;
}

interface SessionCloseResult {
  ok: boolean;
  session_id: string;
  end_reason: string;
}
```

### 6.4 `prompt.submit`

```typescript
interface PromptSubmitParams {
  session_id: string;
  text: string;
  attachments?: AttachmentParam[];
}

interface AttachmentParam {
  type: "file" | "image";
  path?: string;
  content?: string;            // Base64 for images
  name: string;
}

interface PromptSubmitResult {
  accepted: boolean;
  session_id: string;
  message_id: string;
}
```

### 6.5 `session.interrupt`

```typescript
interface SessionInterruptParams {
  session_id: string;
}

interface SessionInterruptResult {
  ok: boolean;
  session_id: string;
  was_running: boolean;
}
```

### 6.6 `approval.respond`

```typescript
interface ApprovalRespondParams {
  session_id: string;
  approved: boolean;
  reason?: string;
}

interface ApprovalRespondResult {
  ok: boolean;
  session_id: string;
}
```

### 6.7 `shell.exec`

```typescript
interface ShellExecParams {
  command: string;
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

interface ShellExecResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}
```

### 6.8 `config.get`

```typescript
interface ConfigGetParams {
  profile?: string;
}

// Response: full HermesConfig (see §3.4)
```

### 6.9 `model.set`

```typescript
interface ModelSetParams {
  model: string;
  provider?: string;
  profile?: string;
}

// Response: ModelAssignmentResponse (see §4.8)
```

---

## 7. File Data Flow

### 7.1 Upload Flow (Web-first)

```
[Browser]
  │  Drag & Drop file
  │  → api.uploadFile(path, file)
  │  → POST /api/files/upload-stream (multipart/form-data)
  │
  ▼
[Backend: web_server.py]
  │  Validates path (sandboxed to HERMES_HOME)
  │  Streams to disk
  │  → 200 {ok, path, size, overwritten}
  │
  ▼
[Browser]
  │  Sends JSON-RPC: prompt.submit with attachment
  │  → GatewayClient.request("prompt.submit", {session_id, text, attachments})
  │
  ▼
[Gateway: tui_gateway/server.py]
  │  Dispatches to prompt.submit handler
  │  → Agent reads file via tools
  │  → Emits tool.start → tool.complete events
  │
  ▼
[Browser]
  │  Receives tool events → updates UI
```

### 7.2 Download Flow

```
[Browser]
  │  api.readFile(path) or api.listFiles()
  │  → GET /api/files/read?path=...
  │  → GET /api/files?path=...
  │
  ▼
[Backend]
  │  Validates path
  │  Returns file content or directory listing
  │
  ▼
[Browser]
  │  Renders file content or directory browser
```

---

## 8. Voice Data Flow

### 8.1 Speech-to-Text (Web-first)

```
[Browser]
  │  navigator.mediaDevices.getUserMedia()
  │  → MediaRecorder → audio blob
  │  → POST /api/audio/transcribe (multipart/form-data)
  │
  ▼
[Backend]
  │  Proxies to STT provider (Groq, OpenAI, etc.)
  │  → {text, language, duration_seconds}
  │
  ▼
[Browser]
  │  Sends prompt.submit with transcribed text
```

### 8.2 Text-to-Speech

```
[Browser]
  │  POST /api/audio/speak {text, provider, voice}
  │
  ▼
[Backend]
  │  Proxies to TTS provider (ElevenLabs, Edge, etc.)
  │  → binary audio response
  │
  ▼
[Browser]
  │  new Audio(blob).play()
```

---

## 9. Error Data Shapes

### 9.1 REST Error

```typescript
interface RestError {
  detail: string;
}
```

### 9.2 JSON-RPC Error

```typescript
interface JsonRpcError {
  code: number;
  message: string;
  data?: {
    session_id?: string;
    tool_name?: string;
    command?: string;
    [key: string]: unknown;
  };
}
```

### 9.3 Common Error Codes

| Code | Message | Meaning |
|------|---------|---------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid request | Malformed request object |
| -32601 | Method not found | Unknown method name |
| -32602 | Invalid params | Missing or wrong params |
| -32603 | Internal error | Unhandled exception |
| -32000 | Session not found | session_id doesn't exist |
| -32001 | Session closed | Attempted operation on closed session |
| -32002 | Agent busy | Agent loop already running |
| -32003 | Approval denied | User denied approval request |
| -32004 | Tool error | Tool execution failed |
| -32005 | Model error | LLM API call failed |
| -32006 | Config error | Invalid config value |

---

## 10. Validation Rules

### 10.1 Session

| Field | Rule |
|-------|------|
| `session_key` | `string` matching `/^[a-f0-9-]{36,}$/` or composite format |
| `model` | Non-empty string, format `provider/model` |
| `profile` | Non-empty string, `[a-zA-Z0-9_-]+` |
| `history` | Array of `Message` objects |

### 10.2 Config

| Field | Rule |
|-------|------|
| `model` | Must be in model catalog or custom model list |
| `terminal.backend` | One of: local, docker, ssh, modal, daytona, singularity |
| `display.skin` | One of: default, ares, mono, slate |
| `dashboard.theme` | One of: default, midnight, ember, mono, cyberpunk, rose |
| `tts.provider` | One of: edge, elevenlabs, openai, neutts |
| `stt.provider` | One of: local, groq, openai, xai, elevenlabs |
| `logging.level` | One of: DEBUG, INFO, WARNING, ERROR |

### 10.3 File Paths

| Rule | Description |
|------|-------------|
| Must be under HERMES_HOME | Paths outside the Hermes home directory are rejected |
| No symlink traversal | Symlinks pointing outside HERMES_HOME are blocked |
| Max path length | 4096 bytes |
| Allowed characters | UTF-8, no null bytes |

---

## 11. Data Flow Diagrams

### 11.1 Config Read Flow

```
[Browser]                    [Backend]                    [Gateway]
   │                            │                            │
   │  GET /api/config           │                            │
   │ ─────────────────────────→ │                            │
   │                            │  _load_cfg()               │
   │                            │  (cached)                  │
   │                            │ ← cached cfg ───────────── │
   │  200 {config: ...}         │                            │
   │ ←───────────────────────── │                            │
```

### 11.2 Config Write Flow

```
[Browser]                    [Backend]                    [Gateway]
   │                            │                            │
   │  PUT /api/config           │                            │
   │ ─────────────────────────→ │                            │
   │                            │  save_config()             │
   │                            │  → write YAML              │
   │                            │  → invalidate cache        │
   │                            │  → notify gateway          │
   │                            │ ─────────────────────────→ │
   │  200 {ok: true}            │                            │  _load_cfg() re-read
   │ ←───────────────────────── │                            │
```

### 11.3 Prompt Submission Flow

```
[Browser]                    [Gateway]                    [Agent Core]
   │                            │                            │
   │  prompt.submit RPC         │                            │
   │ ─────────────────────────→ │                            │
   │                            │  run_conversation()        │
   │                            │ ─────────────────────────→ │
   │                            │                            │  LLM call
   │                            │  event: message.start      │
   │  ← event: message.start ── │                            │
   │                            │  event: message.delta     │
   │  ← event: message.delta ─ │  (token-by-token)          │
   │                            │  event: tool.start         │
   │  ← event: tool.start ──── │                            │  tool exec
   │                            │  event: tool.complete      │
   │  ← event: tool.complete ─ │                            │
   │                            │  event: message.complete   │
   │  ← event: message.complete │                            │
   │                            │  result: {ok: true}        │
   │  ← result ──────────────── │                            │
```

---

## 12. Schema Evolution Rules

| Rule | Description |
|------|-------------|
| Additive only | New fields may be added; existing fields may not be removed or renamed |
| Optional first | New fields must be optional (`T \| undefined`) until all consumers update |
| Deprecation period | Removed fields must be deprecated for 2 minor versions |
| Type widening | Field types may widen (e.g., `string` → `string \| number`) but not narrow |
| Default values | New fields with defaults must use `T \| undefined` with runtime default |

---

## 13. Python ↔ TypeScript Mapping

| Python | TypeScript | Notes |
|--------|-----------|-------|
| `dict` | `Record<string, unknown>` | Or specific interface |
| `str` | `string` | |
| `int` | `number` | |
| `float` | `number` | |
| `bool` | `boolean` | |
| `None` | `null` | |
| `list[T]` | `T[]` | |
| `tuple[T, U]` | `[T, U]` | |
| `Optional[T]` | `T \| null` | |
| `Union[T, U]` | `T \| U` | |
| `@dataclass` | `interface` | |
| `Enum` | `type` (string union) | |
| `Path` | `string` | Paths are strings across the wire |
| `datetime` | `number` (epoch) | Or ISO 8601 string |
