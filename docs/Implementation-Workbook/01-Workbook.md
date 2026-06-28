# Implementation Workbook

> **Audience:** Engineers executing tasks, reviewers verifying work  
> **Last updated:** 2026-06-28  
> **Status:** skeleton — full entries per task in Phase 4

---

## Workbook Structure

Each entry below corresponds to a Task ID from the Task-Manifest.
Each entry includes: objective, dependencies, expected files, completion criteria.

>[CRITICAL]: Every task entry MUST also list a **Decision Log** section — architectural decisions, tradeoffs, and alternatives considered WHILE performing the task.

---

## EPIC-1: Foundation (Months 1-3)

### TASK-101: Create @hermes/shared type catalog

**Objective:** Extract TypeScript type definitions from `apps/desktop/src/types/hermes.ts` and `web/src/lib/api.ts` into a canonical `@hermes/shared` package so both frontends share one source of truth.

**Dependencies:** none  
**Expected files:**
- `apps/shared/src/types/session.ts` — SessionInfo, SessionMessage, PaginatedSessions, etc.
- `apps/shared/src/types/config.ts` — HermesConfig, HermesConfigRecord
- `apps/shared/src/types/model.ts` — ModelInfoResponse, ModelOptionsResponse
- `apps/shared/src/types/cron.ts` — CronJob, CronJobCreatePayload
- `apps/shared/src/types/skill.ts` — SkillInfo
- `apps/shared/src/types/tool.ts` — ToolsetConfig, ToolsetInfo
- `apps/shared/src/index.ts` — re-export all types

**Implementation notes:**
- Start with desktop types (more comprehensive)
- Add web-only types from api.ts (GatewayEventName already in shared)
- Export `HermesGateway` desktop class from shared too (it's transport-agnostic)

**Verification steps:**
- ✅ `cd apps/shared && ./node_modules/.bin/tsc --noEmit -p apps/shared/tsconfig.json` passes clean
- web/src imports from @hermes/shared — pending migration sub-task (phase integration)
- apps/desktop imports types from @hermes/shared — pending migration sub-task (phase integration)
- CI typecheck green on all workspaces — passes for shared; desktop/web pre-existing errors unrelated

**Decision Log:**
- Scope reduced: only 24 types had identical field sets across both frontends. 16 of 40 candidate "shared" types had genuinely diverged shapes (frontend-specific fields).
- Decision: extract only the 24 clean types to `shared/types/core.ts`. Create `shared/types/diverged.ts` for 5 types referenced by clean types but themselves diverged (desktop-superset used as canonical).
- Remaining 11 diverged types kept in their frontend-local declarations.
- Desktop `tsconfig.json` and `web/tsconfig.json` errors were pre-existing (missing node_modules before `npm install`), not caused by this task.

---

### TASK-102: Add per-session SSE event stream endpoint

**Objective:** Support web-native React chat by providing server-sent events scoped to a single session.

**Dependencies:** TASK-101 (for event types)  
**Expected files:**
- `hermes_cli/web_server.py` — new `GET /api/sessions/{session_id}/events` route
- `docs/API.md` (new, auto-generated)

**Implementation notes:**
- Use FastAPI's `StreamingResponse` + async generator
- Filter by `session_id` from path parameter
- Subscribe to tui_gateway broadcast, filter session_id
- Fallback: if no early consumer, SSE connection is idle (heartbeat every 15s)
- Content-Type: text/event-stream

**Verification steps:**
- curl `http://127.0.0.1:9119/api/sessions/{id}/events` returns event stream
- Test with two simultaneous SSE clients — both receive correct events
- Test with invalid session_id → 404

**Test checklist:**
- unit: mock event generator, verify filter logic
- e2e: start hermes dashboard, open SSE, send a prompt, verify message.delta received

**Decision Log:**
- Subagent implemented `_broadcast_sse()` at web_server.py L12377
- Hooked into `_broadcast_event()` L12038 for automatic fan-out
- `_sse_auth_ok()` L12427: X-Hermes-Session-Token (SPA), Bearer, ?ticket=/?token=
- 15s heartbeat, maxsize=256 queue, SSE headers (nginx compat)
- Existing 4 WS routes unchanged

---

### TASK-103: Lift desktop composer + voice
**Objective:** Reuse desktop's React chat renderer for web-native chat.

**Dependencies:** TASK-101  
**Expected files:**
- `web/src/app/chat/index.tsx` — ChatPage host (replaces embedded TUI primarily)
- `web/src/app/chat/messages/Thread.tsx` — from `assistant-ui/thread.tsx`
- `web/src/app/chat/messages/AssistantMessage.tsx` — from `assistant-ui/markdown-text.tsx`
- `web/src/app/chat/messages/UserMessage.tsx` — from `assistant-ui/user-message-edit.tsx`
- `web/src/app/chat/messages/ToolApprovalCard.tsx` — from `assistant-ui/tool-approval.tsx`
- `web/src/app/chat/composer/Composer.tsx` — from `desktop/composer/index.tsx` + adapters

**Implementation notes:**
- Replace `window.hermesDesktop.*` calls with direct `fetch()` to `/api/*`
- Reposition hooks to accept `GatewayClient` (WS-based) instead of IPC
- Replace nanostores atom with React `useReducer` + context
- Slash popover styled for browser (different than terminal)

**Verification steps:**
- Desktop and web chat render the same message for the same input
- Tool approval, slash commands, /voice work in web composer
- No `import { ipcRenderer }` in web bundle

**Test checklist:**
- vitest: unit test each lifted component (mock GatewayClient)
- e2e: playright test of "send message → receive streaming reply"
- integration: full round trip with real agent

**Decision Log:**
- (To be filled during implementation)

---

### TASK-104: Add new REST endpoints for web chat

**Objective:** Web-native chat needs submit prompt, interrupt, status — today only available via RPC.

**Dependencies:** TASK-102  
**Expected files:**
- `hermes_cli/web_server.py` — 5 new routes (see API-Mapping.md)
- `docs/API.md` (auto-generated)

**New endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/sessions/{id}/messages` | Submit prompt |
| POST | `/api/sessions/{id}/interrupt` | Stop generation |
| GET | `/api/sessions/{id}/status` | Current status poll |
| POST | `/api/sessions/{id}/branch` | Branch session |
| GET | `/api/sessions/{id}/stream` | SSE stream alias |

**Implementation notes:**
- `/messages` handler: create AIAgent via tui_gateway WS proxy OR call internal agent dispatch
- Simpler path: proxy the JSON-RPC `prompt.submit` to tui_gateway
- Keep auth as-is (session token + auth gate)

**Verification steps:**
- curl POST `/api/sessions/{id}/messages` with text → response confirms queued
- curl GET `/api/sessions/{id}/status` returns model, agent_state
- Interrupt interrupts (generate a long response, interrupt, verify stop)

**Test checklist:**
- pytest: endpoint returns expected JSON shapes
- integration: web composer → POST messages → SSE stream shows deltas

**Decision Log:**
- (To be filled during implementation)

---

## EPIC-2: Migration (Months 4-6)

### TASK-201: Lift desktop composer + voice controls

**Objective:** Complete web chat composer (rich editor, slash, voice, attachments).

**Dependencies:** TASK-103  
**Expected files:**
- `web/src/app/chat/composer/Composer.tsx`
- `web/src/app/chat/composer/SlashPopover.tsx`
- `web/src/app/chat/composer/VoiceControls.tsx`
- `web/src/app/chat/composer/AttachmentDrop.tsx`

**Verification steps:**
- Voice recording works in Chrome, Firefox, Safari (Safari may need workaround)
- Slash commands execute via same Backend surface as desktop
- Drag and drop works for images, PDFs, plain files

**Test checklist:**
- e2e (playwright): compose with each attachment type, verify upload + attach
- e2e: voice record → STT transcription → agent response
- e2e: /help command → help output

**Decision Log:**
- (To be filled during implementation)

---

### TASK-202: Lift desktop right-side preview + terminal

**Objective:** Web/ has xterm.js — wire it to /api/pty for preview + terminal panels.

**Dependencies:** TASK-102  
**Expected files:**
- `web/src/app/chat/panels/PreviewPane.tsx` — HTML/MD/CSV render
- `web/src/app/chat/panels/TerminalPane.tsx` — xterm.js + /api/pty
- `web/src/app/chat/RightRail.tsx` — Tab container

**Verification steps:**
- Preview renders HTML, Markdown, CSV, images correctly
- Terminal connects via /api/pty WS, shows working shell
- Web user can switch between tabs

**Test checklist:**
- vitest: panel switching logic
- e2e (playwright): terminal accepts input, shows output

**Decision Log:**
- (To be filled during implementation)

---

### TASK-203: Freeze desktop feature development

**Objective:** Announce desktop maintenance mode; no new features.

**Dependencies:** TASK-201 (web feature parity achieved)  
**Expected files:**
- `apps/desktop/README.md` — update with maintenance notice
- `website/docs/` — deprecation announcement (separate PR)
- GitHub — mark issues as "desktop-deprecation" label

**Verification steps:**
- Desktop builds still pass CI
- No new feature PRs accepted for `apps/desktop/` (only bugfixes + security)
- README clearly states "maintenance mode"

**Decision Log:**
- (Announcement date + migration timeline for users)

---

## EPIC-3: Sunset (Months 7-12)

### TASK-301: Implement pet system for web

**Objective:** Animated equivalent of desktop's pet overlay.

**Dependencies:** TASK-201  
**Expected files:**
- `web/src/app/pet/PetCanvas.tsx` — Canvas 2D or SVG pet renderer
- `web/src/app/pet/PetGallery.tsx` — adoption UI
- `web/src/app/pet/petStore.ts` — Zustand store

**Verification steps:**
- Pet animates smoothly at 60fps in browser
- User can adopt, customize, enable/disable

**Test checklist:**
- vitest: pet state transitions
- perf: 60fps during animation

**Decision Log:**
- (To be filled during implementation)

---

### TASK-302: Implement git review panel for web

**Objective:** Codex-style code review adapted for browser.

**Dependencies:** TASK-202  
**Expected files:**
- `web/src/app/chat/panels/ReviewPane.tsx` — file diff UI
- `web/src/app/chat/panels/review/` — tree, file-diff, stage/unstage

**Verification steps:**
- git diff shown with syntax highlighting
- Stage, unstage, commit, push work from browser

**Test checklist:**
- e2e: file diff → stage → commit → push
- integration: use real repo + staging area

**Decision Log:**
- (To be filled during implementation)

---

### TASK-303: Desktop binary CI deprecation

**Objective:** Remove Electron builder CI; archive last-good binaries.

**Dependencies:** TASK-302 (feature parity complete)  
**Expected files:**
- `.github/workflows/desktop*.yml` — DELETE or disable
- `website/docs/user-guide/desktop.md` — add sunset notice
- GitHub Release: archive last good binaries

**Verification steps:**
- Desktop not built in CI
- Last-good binaries available as GitHub Release assets
- Sunset docs published

**Decision Log:**
- (To be filled during implementations)

---

## TBD — candidates for future epics

These tasks are NOT yet defined in the task-manifest.yaml. Candidates for expansion after foundational migration.

| Candidate ID | Title | Notes |
|---|---|---|
| TASK-105 | Auth v2 (JWT + per-user RBAC) | scope TBD — may extend EPIC-1 |
| TASK-204 | Web chat locale parity | depends on TASK-201 |
| TASK-304 | Plugin IPA audit + web SDK docs | IA canonical surface |

---

**See also:** [Project Backlog](../Project-Backlog/01-Epics-and-Milestones.md) · [Task Manifest](../Task-Manifest/task-manifest.yaml)
