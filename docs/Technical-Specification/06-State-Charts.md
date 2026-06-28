# 06 — State Charts

## 1. Purpose

This document describes the state machines governing the three most complex
lifecycles in the Hermes Agent system:

1. **Session Lifecycle** — from creation through execution to termination
2. **Tool Execution Lifecycle** — from invocation through approval to result
3. **Attachment Lifecycle** — from file selection through upload to agent consumption

Each state machine is described with states, transitions, guards, and actions.

---

## 2. Session Lifecycle State Machine

### 2.1 States

```
                    ┌─────────────┐
                    │  NONEXISTENT │
                    └──────┬──────┘
                           │ session.create
                           ▼
                    ┌─────────────┐
            ┌──────│  INITIALIZING │
            │      └──────┬──────┘
            │             │ agent init OK
            │             ▼
            │      ┌─────────────┐
            │      │    ACTIVE    │◄──────────────────────────┐
            │      └──────┬──────┘                           │
            │             │                                   │
            │    ┌────────┼────────┬──────────┐              │
            │    │        │        │          │              │
            │    ▼        ▼        ▼          ▼              │
            │ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐         │
            │ │PROMPT │ │THINK │ │TOOL  │ │COMPACT │         │
            │ │WAIT  │ │ING   │ │EXEC  │ │        │         │
            │ └──┬───┘ └──┬───┘ └──┬───┘ └───┬────┘         │
            │    │        │        │          │              │
            │    └────────┴────────┴──────────┘              │
            │                 │                               │
            │                 │ (turn complete)               │
            │                 └───────────────────────────────┘
            │
            │ agent init fail
            ▼
     ┌─────────────┐
     │   ERROR     │
     └──────┬──────┘
            │ session.close
            ▼
     ┌─────────────┐
     │   CLOSED    │
     └─────────────┘
```

### 2.2 State Descriptions

| State | Description | Allowed Operations |
|-------|-------------|-------------------|
| `NONEXISTENT` | Session does not exist yet | `session.create` |
| `INITIALIZING` | Agent is being constructed, model validated | None (transient) |
| `ACTIVE` | Session ready, waiting for input | `prompt.submit`, `session.close`, `session.interrupt` |
| `PROMPT_WAIT` | User prompt submitted, waiting for LLM response | `session.interrupt` |
| `THINKING` | LLM is processing (thinking/reasoning blocks) | `session.interrupt` |
| `TOOL_EXEC` | Tool is being executed | `session.interrupt`, `approval.respond` |
| `COMPACT` | Session is being auto-compressed | `session.interrupt` |
| `ERROR` | Session encountered an error | `session.close`, `session.resume` |
| `CLOSED` | Session finalized, history persisted | `session.resume` (creates new) |

### 2.3 Transitions

| From | To | Trigger | Guard | Action |
|------|----|---------|-------|--------|
| NONEXISTENT | INITIALIZING | `session.create` RPC | Model is available | Construct agent, load skills |
| INITIALIZING | ACTIVE | Agent init success | Agent constructed | Emit `session.info` |
| INITIALIZING | ERROR | Agent init failure | — | Emit `error` event |
| ACTIVE | PROMPT_WAIT | `prompt.submit` RPC | `running == false` | Set `running = true` |
| PROMPT_WAIT | THINKING | LLM starts responding | — | Emit `message.start` |
| THINKING | TOOL_EXEC | LLM requests tool call | — | Emit `tool.start` |
| TOOL_EXEC | THINKING | Tool completes | — | Emit `tool.complete` |
| THINKING | PROMPT_WAIT | LLM continues text | — | Emit `message.delta` |
| PROMPT_WAIT | ACTIVE | Turn completes | — | Emit `message.complete` |
| THINKING | ACTIVE | Turn completes (text only) | — | Emit `message.complete` |
| ACTIVE | COMPACT | Auto-compaction trigger | Context > threshold | Summarize history |
| COMPACT | ACTIVE | Compaction completes | — | Emit `session.info` |
| ACTIVE | ERROR | Unhandled exception | — | Store error, emit `error` |
| ERROR | ACTIVE | `session.resume` RPC | — | Re-initialize agent |
| ACTIVE | CLOSED | `session.close` RPC | — | Finalize, persist memory |
| ERROR | CLOSED | `session.close` RPC | — | Finalize, persist memory |
| CLOSED | ACTIVE | `session.resume` RPC | — | Load history, create new session |

### 2.4 Terminal States

- `CLOSED` — session is finalized. Can only be revived via `session.resume` (which creates a new session_id).

### 2.5 Error Recovery

| Error | Recovery |
|-------|----------|
| Model API timeout | Auto-retry (3 attempts), then ERROR |
| Context overflow | Auto-compact, stay ACTIVE |
| Tool crash | Emit `tool.complete` with error, continue |
| Agent crash | ERROR state, emit `error`, allow resume |

---

## 3. Tool Execution Lifecycle State Machine

### 3.1 States

```
                    ┌─────────────┐
                    │  DISCOVERED  │
                    └──────┬──────┘
                           │ LLM requests tool call
                           ▼
                    ┌─────────────┐
                    │  REQUESTED   │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
             ┌──────────┐  ┌──────────┐
             │ APPROVAL │  │  AUTO-    │
             │ PENDING  │  │  APPROVED │
             └────┬─────┘  └────┬─────┘
                  │             │
    ┌─────────────┤             │
    │             │             │
    ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│ DENIED │  │ APPROVAL │  │EXECUTING │
│        │  │ GRANTED  │  │          │
└────┬───┘  └────┬─────┘  └────┬─────┘
     │           │             │
     │           │        ┌────┴────┐
     │           │        │         │
     │           │        ▼         ▼
     │           │   ┌────────┐ ┌────────┐
     │           │   │SUCCESS │ │ FAILED │
     │           │   └───┬────┘ └───┬────┘
     │           │       │          │
     │           ▼       ▼          ▼
     │      ┌──────────────────────────┐
     │      │       COMPLETED          │
     │      └──────────────────────────┘
     │
     ▼
┌────────────┐
│  DENIED    │──────────→ (agent continues without result)
└────────────┘
```

### 3.2 State Descriptions

| State | Description | Emitted Events |
|-------|-------------|----------------|
| `DISCOVERED` | Tool registered in registry | — |
| `REQUESTED` | LLM decided to call tool | `tool.start` |
| `APPROVAL_PENDING` | Waiting for user approval | `approval.request` |
| `AUTO_APPROVED` | Approval not needed (safe tool) | — |
| `EXECUTING` | Tool handler running | `tool.progress` (optional) |
| `SUCCESS` | Tool completed successfully | `tool.complete` |
| `FAILED` | Tool execution failed | `tool.complete` (with error) |
| `DENIED` | User denied approval | `status.update` |
| `COMPLETED` | Terminal state (success or failure) | — |

### 3.3 Transitions

| From | To | Trigger | Guard | Action |
|------|----|---------|-------|--------|
| DISCOVERED | REQUESTED | LLM outputs tool_call | — | Parse args, emit `tool.start` |
| REQUESTED | APPROVAL_PENDING | Security policy requires approval | `approvals.mode == "ask"` | Emit `approval.request` |
| REQUESTED | AUTO_APPROVED | No approval needed | `approvals.mode == "yolo"` OR tool is safe | — |
| APPROVAL_PENDING | APPROVAL_GRANTED | `approval.respond {approved: true}` | — | — |
| APPROVAL_PENDING | DENIED | `approval.respond {approved: false}` | — | Emit `status.update` |
| AUTO_APPROVED | EXECUTING | — | — | Call tool handler |
| APPROVAL_GRANTED | EXECUTING | — | — | Call tool handler |
| EXECUTING | SUCCESS | Handler returns result | Exit code 0 | Emit `tool.complete` |
| EXECUTING | FAILED | Handler throws/timeout | Exit code ≠ 0 | Emit `tool.complete` (error) |
| SUCCESS | COMPLETED | — | — | Return result to LLM |
| FAILED | COMPLETED | — | — | Return error to LLM |
| DENIED | COMPLETED | — | — | Return denial to LLM |

### 3.4 Approval Flow Detail

```
[tui_gateway/server.py]
  │  Agent decides to run: rm -rf /important/data
  │  → Tirith security analysis
  │  → risk_level = "critical"
  │  → _emit_approval_request(sid, {
  │      command: "rm -rf /important/data",  (redacted)
  │      risk_level: "critical",
  │      explanation: "This will delete all data under /important",
  │      tool_name: "shell"
  │    })
  │
  ▼
[Browser: ApprovalModal]
  │  Shows: "Agent wants to run: rm -rf /important/data"
  │          Risk: Critical
  │          [Approve] [Deny]
  │  User clicks [Approve]
  │  → GatewayClient.request("approval.respond", {session_id, approved: true})
  │
  ▼
[tui_gateway/server.py]
  │  Resolves pending future
  │  → Tool execution continues
```

### 3.5 Timeout Handling

| Phase | Timeout | Action |
|-------|---------|--------|
| Approval wait | 120s (configurable) | Auto-deny, emit `status.update` |
| Tool execution | Per-tool default (30s-300s) | Kill process, emit `tool.complete` (error) |
| Tool with output | 30s after last output | Kill process, return partial output |

---

## 4. Attachment Lifecycle State Machine

### 4.1 States

```
                    ┌─────────────┐
                    │  IDLE        │
                    └──────┬──────┘
                           │ User selects file (DnD or picker)
                           ▼
                    ┌─────────────┐
                    │  SELECTED    │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
             ┌──────────┐  ┌──────────┐
             │VALIDATING│  │  ABORTED │
             └────┬─────┘  └──────────┘
                  │
           ┌──────┴──────┐
           │             │
           ▼             ▼
    ┌──────────┐  ┌──────────┐
    │VALIDATED │  │ REJECTED │
    └────┬─────┘  └──────────┘
         │
         ▼
    ┌──────────┐
    │UPLOADING │
    └────┬─────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│UPLOADED│ │ FAILED │
└────┬───┘ └────────┘
     │
     ▼
┌─────────────┐
│  ATTACHED    │──────→ (included in next prompt.submit)
└──────┬──────┘
       │
       │ User removes / session ends
       ▼
┌─────────────┐
│  DETACHED    │
└─────────────┘
```

### 4.2 State Descriptions

| State | Description | UI Indicator |
|-------|-------------|--------------|
| `IDLE` | No file selected | Drop zone visible, idle |
| `SELECTED` | File selected, pending validation | File name shown, spinner |
| `VALIDATING` | Checking size/type/path | "Validating..." |
| `VALIDATED` | File passes validation | "Ready to upload" |
| `UPLOADING` | Streaming to server | Progress bar |
| `UPLOADED` | File on server, ready to attach | File card with name/size |
| `ATTACHED` | Included in next prompt | File shown in composer |
| `DETACHED` | Removed from prompt | — |
| `REJECTED` | Failed validation | Error message |
| `FAILED` | Upload failed | Error + retry option |
| `ABORTED` | User cancelled | — |

### 4.3 Transitions

| From | To | Trigger | Guard | Action |
|------|----|---------|-------|--------|
| IDLE | SELECTED | `onDrop` or `onChange` | File(s) present | Read file metadata |
| SELECTED | VALIDATING | — | — | Check size, type, name |
| VALIDATING | VALIDATED | Validation passes | Size < max, type allowed | — |
| VALIDATING | REJECTED | Validation fails | — | Show error message |
| VALIDATED | UPLOADING | — | — | `api.uploadFile()` |
| UPLOADING | UPLOADED | HTTP 200 | — | Store path, size |
| UPLOADED | FAILED | HTTP ≠ 200 | — | Show error |
| UPLOADED | ATTACHED | User confirms | — | Add to attachment list |
| ATTACHED | DETACHED | User removes | — | Remove from list |
| SELECTED | ABORTED | User cancels | — | Clear selection |
| REJECTED | IDLE | User dismisses error | — | Clear |
| FAILED | IDLE | User dismisses error | — | Clear |
| FAILED | UPLOADING | User retries | — | Re-upload |

### 4.4 Validation Rules

| Rule | Limit | Error Message |
|------|-------|---------------|
| Max file size | 100 MB (configurable) | "File too large (max 100MB)" |
| Allowed types | All (configurable blocklist) | "File type not allowed" |
| Path traversal | No `..` in filename | "Invalid filename" |
| Max attachments per prompt | 10 | "Maximum 10 attachments" |
| Total size per prompt | 200 MB | "Total attachment size exceeds 200MB" |

### 4.5 Upload Flow (Web-first)

```
[Browser]
  │  1. User drops file onto drop zone
  │  2. Validate file (size, type)
  │  3. api.uploadFile(path, file)
  │     → POST /api/files/upload-stream (multipart)
  │
  ▼
[Backend: web_server.py]
  │  1. Validate path (sandboxed)
  │  2. Stream to disk (write_temp → rename)
  │  3. Return {ok, path, size, overwritten}
  │
  ▼
[Browser]
  │  4. Show file in composer as attachment chip
  │  5. On submit: include attachment in prompt.submit
  │     → GatewayClient.request("prompt.submit", {
  │         session_id, text, attachments: [{type: "file", path}]
  │       })
  │
  ▼
[Gateway]
  │  6. Agent reads file via tools
  │  7. Emits tool.start → tool.complete events
  │
  ▼
[Browser]
  │  8. Shows tool execution in message
```

---

## 5. WebSocket Connection Lifecycle

### 5.1 States

```
┌────────┐    connect()    ┌───────────┐    accept()    ┌──────┐
│  IDLE  │ ──────────────→ │ CONNECTING │ ─────────────→ │ OPEN │
└────────┘                 └───────────┘                └──┬───┘
                                                           │
                                                      disconnect
                                                           │
                                                           ▼
┌────────┐    reconnect()    ┌───────────┐          ┌──────────┐
│ CLOSED │ ←──────────────── │RECONNECTING│ ←────────│ CLOSING  │
└────────┘                   └───────────┘          └──────────┘
```

### 5.2 Transitions

| From | To | Trigger | Action |
|------|----|---------|--------|
| IDLE | CONNECTING | `gatewayClient.connect()` | Open WebSocket |
| CONNECTING | OPEN | `ws.accept()` + `gateway.ready` event | Start heartbeat |
| CONNECTING | CLOSED | Connection error | Emit error state |
| OPEN | CLOSING | Server disconnect or `client.disconnect()` | Close WS |
| CLOSING | CLOSED | WS close event | Clean up |
| CLOSED | RECONNECTING | Auto-reconnect timer | Attempt reconnect |
| RECONNECTING | CONNECTING | — | Open new WS |
| OPEN | OPEN | `session.create/resume` RPC | Normal operation |

---

## 6. Gateway Process Lifecycle

### 6.1 States

```
┌──────────┐   start    ┌────────────┐   ready    ┌──────────┐
│ STOPPED  │ ─────────→ │ STARTING   │ ─────────→ │  READY   │
└──────────┘            └────────────┘            └────┬─────┘
                                                       │
                                                  drain/restart
                                                       │
                                                       ▼
┌──────────┐   exit     ┌────────────┐          ┌──────────┐
│  EXITED  │ ←───────── │ DRAINING   │ ←────────│  BUSY    │
└──────────┘            └────────────┘          └──────────┘
```

### 6.2 Transitions

| From | To | Trigger | Action |
|------|----|---------|--------|
| STOPPED | STARTING | `hermes gateway run` or `hermes --tui` | Load config, init transport |
| STARTING | READY | Transport bound, config loaded | Start accepting RPCs |
| READY | BUSY | `session.create` | Start agent loop |
| BUSY | READY | `session.close` or turn complete | Accept new sessions |
| READY | DRAINING | `gateway.drain` RPC | Stop new sessions, wait for active |
| BUSY | DRAINING | `gateway.drain` RPC | Wait for active sessions to finish |
| DRAINING | EXITED | All sessions closed | Clean up, exit |
| READY | EXITED | `gateway.restart` RPC | Spawn new process, drain old |
| STARTING | EXITED | Init failure | Log error, exit |

---

## 7. Dashboard Backend Lifecycle

### 7.1 States

```
┌──────────┐   start    ┌────────────┐   request   ┌──────────┐
│ STOPPED  │ ─────────→ │  LISTENING │ ─────────→ │ HANDLING │
└──────────┘            └────────────┘            └────┬─────┘
                                                       │
                                                  response
                                                       │
                                                       ▼
                                                  ┌──────────┐
                                                  │LISTENING │
                                                  └──────────┘
```

### 7.2 Key Behaviors

| Behavior | Description |
|----------|-------------|
| Lifespan startup | Initialize event channels, warm gateway module, start cron ticker (desktop mode) |
| Request auth | Check session token → OAuth gate → public paths |
| WS proxy | `/api/pty` spawns `hermes --tui` subprocess; `/api/ws` connects to running gateway |
| Event relay | `/api/pub` → `/api/events` rebroadcast for sidebar |

---

## 8. State Machine Summary Table

| Machine | States | Terminal States | Error Recovery |
|---------|--------|-----------------|----------------|
| Session | 9 | CLOSED | Resume from ERROR |
| Tool Execution | 9 | COMPLETED, DENIED | Return error to LLM |
| Attachment | 11 | DETACHED, ABORTED | Retry upload |
| WebSocket | 6 | CLOSED | Auto-reconnect |
| Gateway Process | 6 | EXITED | Restart |
| Dashboard Backend | 3 | STOPPED | Restart process |

---

## 9. State Transition Matrix (Session)

|  | NONEXISTENT | INITIALIZING | ACTIVE | PROMPT_WAIT | THINKING | TOOL_EXEC | COMPACT | ERROR | CLOSED |
|--|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **NONEXISTENT** | — | create | — | — | — | — | — | — | — |
| **INITIALIZING** | — | — | init OK | — | — | — | — | init fail | — |
| **ACTIVE** | — | — | — | submit | — | — | compact | crash | close |
| **PROMPT_WAIT** | — | — | turn done | — | LLM resp | — | — | interrupt | close |
| **THINKING** | — | — | turn done | LLM cont | — | tool call | — | interrupt | close |
| **TOOL_EXEC** | — | — | — | — | tool done | — | — | interrupt | close |
| **COMPACT** | — | — | done | — | — | — | — | interrupt | close |
| **ERROR** | — | — | resume | — | — | — | — | — | close |
| **CLOSED** | — | — | resume | — | — | — | — | — | — |

---

## 10. Implementation Reference

| State Machine | Implementation File | Key Functions |
|---------------|--------------------|---------------|
| Session | `tui_gateway/server.py` | `_init_session()`, `_resume_session()`, `_close_session_by_id()`, `_finalize_session()` |
| Tool Execution | `tui_gateway/server.py` + `agent/run_agent.py` | `_on_tool_start()`, `_on_tool_complete()`, tool handler dispatch |
| Attachment | `web/src/pages/ChatPage.tsx` + `hermes_cli/web_server.py` | `api.uploadFile()`, `/api/files/upload-stream` |
| WebSocket | `web/src/lib/gatewayClient.ts` + `tui_gateway/ws.py` | `GatewayClient.connect()`, `handle_ws()` |
| Gateway Process | `gateway/run.py` + `tui_gateway/entry.py` | `run()`, `main()` |
| Dashboard Backend | `hermes_cli/web_server.py` | `_lifespan()`, `start_server()` |

---

## 11. State Persistence

| State | Persisted In | Persistence Timing |
|-------|-------------|-------------------|
| Session (ACTIVE→CLOSED) | `state.db` (SQLite) | On `_finalize_session()` |
| Session (COMPACT) | `state.db` | On compaction completion |
| Tool results | `state.db` (as message history) | On tool completion |
| Attachments | Filesystem (HERMES_HOME) | On upload |
| Gateway process | Not persisted | — |
| WebSocket connection | Not persisted | — |

---

## 12. Concurrency Notes

| Concern | Mechanism |
|---------|-----------|
| Session state mutation | `_sessions_lock` (threading.RLock) |
| History append | `session["history_lock"]` (threading.Lock) |
| Transport write | `_stdout_lock` (threading.Lock) |
| Event channel | `app.state.event_lock` (asyncio.Lock) |
| Slash worker | `_SlashWorker._lock` (threading.Lock) |
| Config cache | `_cfg_lock` (threading.Lock) |
| Active session slot | `active_session_lease` (file lock) |

---

## 13. State Observation

Each state machine emits observable events for monitoring:

| Machine | Observation Point | Event |
|---------|------------------|-------|
| Session | `_init_session()` | `session.info` |
| Session | `_close_session_by_id()` | `session.info` (final) |
| Tool | `_on_tool_start()` | `tool.start` |
| Tool | `_on_tool_complete()` | `tool.complete` |
| Attachment | Upload complete | `attachment.uploading` (new) |
| WebSocket | `handle_ws()` | `gateway.ready` |
| Gateway | `run()` | `gateway.ready` |
| Dashboard | `_lifespan()` | `HERMES_DASHBOARD_READY` env var |
