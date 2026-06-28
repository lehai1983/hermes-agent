# 03 — Event Mapping

## 1. Purpose

This document maps every event type emitted by the Hermes Agent gateway to its
producer, consumer, payload shape, and the new per-session equivalents for the
Web-first migration.

Events are JSON-RPC `method: "event"` frames sent over the transport (stdio or
WebSocket). They are unidirectional — no response expected.

---

## 2. Event Transport Architecture

### 2.1 Legacy (stdio / PTY)

```
[tui_gateway/server.py]  →  _emit()  →  write_json()  →  stdout
                                                              ↓
[hermes --tui subprocess]  →  reads stdin  →  parses JSON-RPC event
                                                              ↓
[ui-tui/src/app/createGatewayEventHandler.ts]  →  maps to React state
```

### 2.2 Dashboard (WebSocket relay)

```
[tui_gateway/server.py]  →  _emit()  →  transport.write()  →  WsPublisherTransport
                                                              ↓ (WebSocket)
[hermes_cli/web_server.py /api/pub]  →  rebroadcast  →  /api/events WebSocket
                                                              ↓
[browser sidebar]  →  EventSource/WS  →  renders activity
```

### 2.3 Web-first (direct WebSocket)

```
[tui_gateway/server.py]  →  _emit()  →  transport.write()  →  /api/ws WebSocket
                                                              ↓
[browser ChatPage.tsx]  →  GatewayClient.on()  →  React state update
```

---

## 3. Event Type Registry

All events are emitted via `_emit(event_type, session_id, payload)` in
`tui_gateway/server.py` (line 967). The TypeScript mirror is the
`GatewayEventName` union type in `web/src/lib/gatewayClient.ts` (line 18).

### 3.1 Lifecycle Events

| Event Type | Producer | Consumer (Legacy) | Consumer (Web-first) | Payload Shape |
|------------|----------|-------------------|----------------------|---------------|
| `gateway.ready` | `tui_gateway/ws.py` `handle_ws()` on connect | `createGatewayEventHandler.ts` | `GatewayClient.onState()` | `{skin: string}` |
| `session.info` | `tui_gateway/server.py` `_init_session()`, `_resume_session()`, model switch, project change | TUI session info panel | ChatPage session state | `{session_id, model, profile, project, skills, ...}` |
| `error` | Any `_emit()` call site with error info | TUI error display | ChatPage error banner | `{message: string}` |

### 3.2 Message Streaming Events

| Event Type | Producer | Consumer (Legacy) | Consumer (Web-first) | Payload Shape |
|------------|----------|-------------------|----------------------|---------------|
| `message.start` | `tui_gateway/server.py` `run_conversation()` | TUI message list | ChatPage message list | `{session_id}` (no payload) |
| `message.delta` | `tui_gateway/server.py` `message_callback` | TUI renders token | ChatPage appends to message | `{text: string}` |
| `message.complete` | `tui_gateway/server.py` after turn ends | TUI finalizes | ChatPage marks complete | `{text: string}` (summary) |

### 3.3 Thinking & Reasoning Events

| Event Type | Producer | Consumer (Legacy) | Consumer (Web-first) | Payload Shape |
|------------|----------|-------------------|----------------------|---------------|
| `thinking.delta` | `tui_gateway/server.py` `thinking_callback` | TUI thinking block | ChatPage thinking block | `{text: string}` |
| `reasoning.delta` | `tui_gateway/server.py` `reasoning_callback` | TUI reasoning block | ChatPage reasoning panel | `{text: string}` |
| `reasoning.available` | `tui_gateway/server.py` on reasoning model output | TUI reasoning display | ChatPage reasoning panel | `{text: string, preview: string}` |

### 3.4 Tool Execution Events

| Event Type | Producer | Consumer (Legacy) | Consumer (Web-first) | Payload Shape |
|------------|----------|-------------------|----------------------|---------------|
| `tool.start` | `tui_gateway/server.py` `_on_tool_start()` | TUI tool call display | ChatPage tool card | `{tool_call_id, name, args}` |
| `tool.progress` | `tui_gateway/server.py` `tool_progress()` | TUI tool progress | ChatPage tool progress bar | `{event_type, name?, preview}` |
| `tool.complete` | `tui_gateway/server.py` `_on_tool_complete()` | TUI tool result | ChatPage tool result | `{tool_call_id, name, result}` |
| `tool.generating` | `tui_gateway/server.py` for image-gen tools | TUI generating indicator | ChatPage spinner | `{name: string}` |

### 3.5 Status & Approval Events

| Event Type | Producer | Consumer (Legacy) | Consumer (Web-first) | Payload Shape |
|------------|----------|-------------------|----------------------|---------------|
| `status.update` | `tui_gateway/server.py` `_status_update()` | TUI status bar | ChatPage status indicator | `{kind: string, text: string}` |
| `approval.request` | `tui_gateway/server.py` `_emit_approval_request()` | TUI approval dialog | ChatPage approval modal | `{command, risk_level, explanation, tool_name}` |
| `clarify.request` | `tui_gateway/server.py` `clarify_callback` | TUI clarify prompt | ChatPage clarify UI | `{question: string, choices: string[]}` |
| `secret.request` | `tui_gateway/server.py` secret prompt callback | TUI secret input | ChatPage password prompt | `{key: string, prompt: string}` |
| `sudo.request` | `tui_gateway/server.py` sudo prompt callback | TUI sudo prompt | ChatPage sudo prompt | `{prompt: string}` |

### 3.6 Background & Subagent Events

| Event Type | Producer | Consumer (Legacy) | Consumer (Web-first) | Payload Shape |
|------------|----------|-------------------|----------------------|---------------|
| `background.complete` | `tui_gateway/server.py` `background_review_callback` | TUI background task display | ChatPage background indicator | `{message: string}` |

### 3.7 UI/Skin Events

| Event Type | Producer | Consumer (Legacy) | Consumer (Web-first) | Payload Shape |
|------------|----------|-------------------|----------------------|---------------|
| `skin.changed` | `tui_gateway/server.py` on config change | TUI skin reload | ChatPage theme update | `{skin: string}` |

### 3.8 Pet Events (Easter Eggs)

| Event Type | Producer | Consumer (Legacy) | Consumer (Web-first) | Payload Shape |
|------------|----------|-------------------|----------------------|---------------|
| `pet.generate.progress` | `tui_gateway/server.py` pet generation | TUI pet display | ChatPage pet display | `{token: string, count: number}` |
| `pet.hatch.progress` | `tui_gateway/server.py` pet hatching | TUI pet display | ChatPage pet display | `{...}` |

### 3.9 Preview/Restart Events

| Event Type | Producer | Consumer (Legacy) | Consumer (Web-first) | Payload Shape |
|------------|----------|-------------------|----------------------|---------------|
| `preview.restart.progress` | `tui_gateway/server.py` preview restart | TUI progress | ChatPage progress | `{task_id, level, text}` |

---

## 4. Event Payload Schemas (TypeScript)

The canonical TypeScript event type is in `web/src/lib/gatewayClient.ts`:

```typescript
export type GatewayEventName =
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
  | (string & {});

export interface GatewayEvent<P = unknown> {
  type: GatewayEventName;
  session_id?: string;
  payload?: P;
}
```

### 4.1 Detailed Payload Types

```typescript
// session.info payload
interface SessionInfoPayload {
  session_id: string;
  model: string;
  provider: string;
  profile: string;
  project?: string;
  skills: string[];
  mcp_servers: string[];
  context_used?: number;
  context_limit?: number;
  compaction_count?: number;
  status: "idle" | "running" | "compacting" | "error";
}

// message.delta payload
interface MessageDeltaPayload {
  text: string;
}

// tool.start payload
interface ToolStartPayload {
  tool_call_id: string;
  name: string;
  args: Record<string, unknown>;
}

// tool.complete payload
interface ToolCompletePayload {
  tool_call_id: string;
  name: string;
  result: string;
}

// status.update payload
interface StatusUpdatePayload {
  kind: "status" | "compacting" | "lifecycle" | "error";
  text: string;
}

// approval.request payload
interface ApprovalRequestPayload {
  command: string;        // Redacted by _redact_approval_command
  risk_level: "low" | "medium" | "high" | "critical";
  explanation: string;
  tool_name: string;
}

// clarify.request payload
interface ClarifyRequestPayload {
  question: string;
  choices: string[];
}

// error payload
interface ErrorPayload {
  message: string;
}

// gateway.ready payload
interface GatewayReadyPayload {
  skin: string;
}
```

---

## 5. Event Subscription Model

### 5.1 Legacy TUI (stdio)

The TUI's `createGatewayEventHandler.ts` receives every event and maps it to
state mutations. It subscribes to ALL event types by default.

### 5.2 Web-first (GatewayClient)

```typescript
const gw = new GatewayClient();
await gw.connect();

// Subscribe to specific events
gw.on("message.delta", (ev) => {
  console.log(ev.payload?.text);
});

// Subscribe to ALL events
gw.onAny((ev) => {
  console.log("event:", ev.type, ev.payload);
});

// Subscribe to connection state changes
gw.onState((state) => {
  console.log("connection:", state);
});
```

### 5.3 Per-Session Event Filtering

In the Web-first model, each browser tab opens a WebSocket to `/api/ws` with
a specific `session_id` query parameter. The gateway scopes events to that
session automatically — the `GatewayClient` receives only events for its
session.

For the dashboard sidebar (which shows events from ALL active sessions), a
separate WebSocket to `/api/events` subscribes to the global event channel.

---

## 6. Event Flow: User Sends a Prompt

```
1. Browser → GatewayClient.request("prompt.submit", {session_id, text})
2. Gateway dispatches to prompt.submit handler
3. Gateway emits: message.start (session_id)     → Browser: create message bubble
4. Gateway emits: thinking.delta (session_id)    → Browser: show thinking text
5. Gateway emits: reasoning.delta (session_id)   → Browser: show reasoning text
6. Gateway emits: message.delta (session_id)     → Browser: stream tokens
7. Gateway emits: tool.start (session_id)        → Browser: show tool call card
8. Gateway emits: tool.progress (session_id)      → Browser: update progress
9. Gateway emits: tool.complete (session_id)      → Browser: show tool result
10. Gateway emits: message.complete (session_id)  → Browser: finalize message
11. Gateway emits: status.update (session_id)     → Browser: update status bar
```

---

## 7. Event Flow: Approval Required

```
1. Agent decides to run a dangerous command
2. Gateway emits: approval.request (session_id)  → Browser: show approval modal
3. User clicks Approve/Deny
4. Browser → GatewayClient.request("approval.respond", {session_id, approved: true})
5. Gateway resolves the pending approval future
6. If approved: Gateway emits: tool.start → tool.complete
7. If denied: Gateway emits: status.update with "denied" message
```

---

## 8. Event Flow: Session Lifecycle

```
1. Browser → GatewayClient.request("session.create", {model, profile})
2. Gateway creates session, emits: session.info (session_id)
3. Browser receives session_id, stores it
4. ... (prompt/response cycles) ...
5. Browser → GatewayClient.request("session.close", {session_id})
6. Gateway emits: session.info (session_id, {status: "closed"})
7. Gateway emits: session.info (session_id) with final state
```

---

## 9. Event Flow: Session Resume

```
1. Browser → GatewayClient.request("session.resume", {session_id})
2. Gateway loads history from state.db
3. Gateway emits: session.info (session_id) with full history
4. Browser renders historical messages
5. ... (ready for new prompts) ...
```

---

## 10. Event-to-UI Mapping

| Event | ChatPage Component | Visual Effect |
|-------|-------------------|---------------|
| `gateway.ready` | `ChatPage` root | Connection indicator → green |
| `session.info` | `SessionInfoPanel` | Model name, context bar, skills list |
| `message.start` | `MessageList` | New empty message bubble appears |
| `message.delta` | `MessageBubble` | Text streams in token-by-token |
| `message.complete` | `MessageBubble` | Streaming stops, message finalized |
| `thinking.delta` | `ThinkingBlock` | Thinking text expands |
| `reasoning.delta` | `ReasoningPanel` | Reasoning text expands |
| `tool.start` | `ToolCard` | Tool card appears with spinner |
| `tool.progress` | `ToolCard` | Progress bar updates |
| `tool.complete` | `ToolCard` | Result appears, spinner stops |
| `tool.generating` | `ToolCard` | "Generating..." indicator |
| `status.update` | `StatusBar` | Status text changes |
| `approval.request` | `ApprovalModal` | Modal dialog with approve/deny buttons |
| `clarify.request` | `ClarifyDialog` | Question with choice buttons |
| `error` | `ErrorBanner` | Red error banner appears |
| `skin.changed` | `ThemeProvider` | Theme CSS variables update |

---

## 11. New Web-First Events

The following events are new or significantly changed for the Web-first
migration:

| Event | New/Changed | Purpose |
|-------|-------------|---------|
| `session.info` (enhanced) | Changed | Now includes `ws_channel_id` for per-session WS routing |
| `status.update` (kinds) | New kinds | `kind: "uploading"` for file upload progress |
| `tool.progress` (file DnD) | New | Emitted during drag-and-drop file upload |
| `gateway.ready` (per-tab) | Changed | Now includes `server_version`, `auth_mode` |
| `voice.listening` | New | Voice capture started (Web Audio API) |
| `voice.transcribing` | New | Voice → text in progress |
| `attachment.uploading` | New | File attachment upload progress |
| `code_review.available` | New | Code review panel has content |

---

## 12. Event Reliability

### 12.1 Delivery Guarantees

| Scenario | Guarantee |
|----------|-----------|
| Event during connected WebSocket | At-most-once (fire and forget) |
| Event during disconnected WebSocket | Dropped (client must reconnect and resume) |
| Event during session.resume | Buffered until transport reattached |
| Event for orphaned session | Routed to `_DropTransport` (silently discarded) |

### 12.2 Reconnect Behavior

On WebSocket disconnect:
1. Gateway detaches transport → `_DropTransport`
2. Client reconnects with `?resume=<session_id>`
3. Gateway reattaches transport
4. Gateway emits `session.info` with current state (catch-up)
5. New events flow normally

### 12.3 Event Ordering

Events for the same session are ordered (FIFO) because they are emitted from
the same thread (the agent loop thread). However, events from different
sessions may interleave — the `session_id` field is the ordering key.

---

## 13. Event Backpressure

The `WsPublisherTransport` (used for the `/api/pub` relay) has a bounded queue
(`_QUEUE_MAX = 256`). When the queue is full, events are silently dropped.
This prevents a slow dashboard backend from blocking the agent loop.

The direct WebSocket transport (`WSTransport` in `tui_gateway/ws.py`) has no
explicit backpressure — TCP flow control applies.

---

## 14. Python Event Emitter Reference

All events are emitted via `_emit()` in `tui_gateway/server.py`:

```python
def _emit(event: str, sid: str, payload: dict | None = None):
    params = {"type": event, "session_id": sid}
    if payload is not None:
        params["payload"] = payload
    write_json({"jsonrpc": "2.0", "method": "event", "params": params})
```

Specializations:
- `_emit_approval_request(sid, data)` — redacts command before emitting
- `_status_update(sid, kind, text)` — auto-compaction re-tagging
- `_emit_session_info_for_session(sid, session)` — emits session.info

---

## 15. Event Count by Category

| Category | Event Types | Emissions per Session (typical) |
|----------|-------------|--------------------------------|
| Lifecycle | `gateway.ready`, `session.info`, `error` | 3-5 |
| Message | `message.start`, `message.delta`, `message.complete` | 2 + N deltas |
| Thinking | `thinking.delta` | M deltas |
| Reasoning | `reasoning.delta`, `reasoning.available` | O deltas + 1 |
| Tool | `tool.start`, `tool.progress`, `tool.complete`, `tool.generating` | 3P + Q progress |
| Status | `status.update` | 2-5 |
| Approval | `approval.request` | 0-2 |
| Clarify | `clarify.request` | 0-1 |
| Other | `skin.changed`, `pet.*`, `preview.*`, `background.complete` | 0-3 |
| **Total** | **~20 types** | **~50-200 per session** |

---

## 16. Migration Impact on Events

| Concern | Legacy | Web-first |
|---------|--------|-----------|
| Event transport | stdio → TUI parser | WebSocket → GatewayClient |
| Event subscription | All events to single TUI | Per-session filtering |
| Event ordering | In-process (guaranteed) | Per-session FIFO (same) |
| Event replay | TUI re-reads on mount | `session.info` carries state |
| Multi-tab | Single TUI window | Each tab = separate WS = separate session |
| Dashboard sidebar | `/api/pub` → `/api/events` | Same (or new global WS) |
| Voice events | N/A (voice was TTS only) | New: `voice.listening`, `voice.transcribing` |
| File events | N/A | New: `attachment.uploading` |
