# Epics and Milestones

> **Audience:** Product owners, engineering managers  
> **Last updated:** 2026-06-28  
> **Status:** planning draft — pending review

---

## Epic Overview

```
EPIC-1: Foundation          EPIC-2: Migration          EPIC-3: Sunset
(Months 1-3)                (Months 4-6)                (Months 7-12)
─────────────────────       ─────────────────────       ─────────────────────
Shared types catalog        Web chat = primary          Pet system
Per-session SSE             Voice + slash lift           Git review panel
Web chat renderer alpha     Preview + terminal           Desktop CI sunset
New REST endpoints          Desktop freeze               Plugin IPA docs

MILESTONE 0.1               MILESTONE 0.2               MILESTONE 1.0
Web chat feature-           Desktop feature-            Desktop deprecated
   complete alpha              frozen                     Web sole GUI
                             Web chat default
```

---

## EPIC-1: Foundation

**Goal:** Build the scaffolding that allows new web-native chat.

| Task ID | Title | Priority | Estimate | Owner |
|---------|-------|----------|----------|-------|
| TASK-101 | @hermes/shared type catalog | P0 | 2 weeks | shared maintainer |
| TASK-102 | Per-session SSE event stream | P0 | 2 weeks | gateway maintainer |
| TASK-103 | Lift assistant-ui chat components | P0 | 3 weeks | web maintainer |
| TASK-104 | New REST endpoints for web chat | P0 | 2 weeks | web_server maintainer |

**Exit criteria for EPIC-1:**
- ✅ Desktop and web share types from @hermes/shared
- ✅ Web can subscribe to `/api/sessions/{id}/events` SSE stream
- ✅ Web can render a chat message stream using React (not PTY)
- ✅ Web can submit a prompt via `POST /api/sessions/{id}/messages`
- ✅ Web can interrupt generation via `POST /api/sessions/{id}/interrupt`
- ✅ Desktop still works in full

---

## EPIC-2: Migration

**Goal:** Make web the primary chat surface; freeze desktop.

| Task ID | Title | Priority | Estimate | Owner |
|---------|-------|----------|----------|-------|
| TASK-201 | Lift desktop composer + voice | P0 | 3 weeks | web maintainer |
| TASK-202 | Lift preview + terminal + review | P1 | 3 weeks | web maintainer |
| TASK-203 | Freeze desktop feature development | P0 | 1 week | all |

**Exit criteria for EPIC-2:**
- ✅ Web chat UX ≥ desktop chat UX (composer, voice, slash, attachments)
- ✅ Web right-sidebar: preview + terminal functional
- ✅ Desktop is in maintenance mode (announced, documented)
- ✅ Default chat UI on dashboard switchable (embed ↔ web)
- ✅ Performance: web chat latency ≤ desktop chat latency

---

## EPIC-3: Sunset

**Goal:** Deprecate desktop; complete web parity.

| Task ID | Title | Priority | Estimate | Owner |
|---------|-------|----------|----------|-------|
| TASK-301 | Implement pet system for web | P2 | 2 weeks | web maintainer |
| TASK-302 | Implement git review panel | P1 | 3 weeks | web maintainer |
| TASK-303 | Desktop binary CI deprecation | P0 | 1 week | CI maintainer |

**Exit criteria for EPIC-3:**
- ✅ Web has pet, git review, all desktop features (or documented drop)
- ✅ Desktop sunset announced with 6-month notice
- ✅ No more desktop binary CI runs
- ✅ Web docs are sole user-facing documentation
- ✅ Plugin IPA guidance published for web SDK

---

## Milestones

### MILESTONE 0.1 (End of EPIC-1)

- **Name:** "Web Chat Alpha"
- **Date target:** T+3 months
- **Success metrics:**
  - Web chat renders simple conversation (prompt → response)
  - Web chat shows tool cards (read_file, terminal, web_search)
  - Users can opt-in via `?webchat=1` URL param
  - Zero regression in desktop app
- **Demo:** "send a message in web chat assistant, receive streaming reply, approve a tool"

### MILESTONE 0.2 (End of EPIC-2)

- **Name:** "Web Default"
- **Date target:** T+6 months
- **Success metrics:**
  - web/ chat is default on dashboard
  - embedded TUI available via URL param `?embed=1`
  - Desktop features frozen
  - 80%+ of daily dashboard users using web chat (by analytics)
- **Demo:** "full workflow: compose, attach file, approve tool, branch session"

### MILESTONE 1.0 (End of EPIC-3)

- **Name:** "Desktop Sunset"
- **Date target:** T+12 months
- **Success metrics:**
  - Desktop downloads stopped
  - Web documentation is canonical
  - Plugin SDK for web replaces pet/haptics/voice/desktop specific plugins
  - No desktop-specific code in active maintenance
- **Demo:** "browser bookmark is the only GUI most users ever see"

---

## Critical Path

```
TASK-101 (shared types)
    ↓
TASK-102 (SSE stream) ←─────────────────────────┐
    ↓                                           │
TASK-103 (chat renderer lift)                   │
    ↓                                           │
TASK-104 (REST endpoints)                       │
    ↓                                           │
TASK-201 (composer+voice lift)                 │
    ↓                                           │
TASK-202 (preview+terminal lift)               │
    ↓                                           │
TASK-203 (desktop freeze)                       │
    ↓                                           │
TASK-302 (git review) ──────────────────────────┘ (reuses SSE infra)
    ↓
TASK-301 (pet, lower priority)
    ↓
TASK-303 (desktop CI sunset)
    ↓
MILESTONE 1.0
```

**Critical path longest: ~38 weeks** (if tasks sequential).  
**Estimated with parallelism: ~28 weeks** (2 engineers full-time).

---

## Parallel Work Opportunities

These tasks can run in parallel with the critical path:

| Task | Dependencies | Can run during |
|------|-------------|-----------------|
| Plugin SDK unification | none | Phase 1-2 |
| Web locale sync | TASK-103 | Phase 1-2 |
| Auth v2 design | none | Phase 1 |
| Auth v2 implementation | design | Phase 2-3 |
| Desktop dep bumps | CI | Phase 2-3 |
| Performance benchmarks | TASK-103 | Phase 1-2 |

---

**See also:** [Implementation Workbook](../Implementation-Workbook/01-Workbook.md) · [Task Manifest](../Task-Manifest/task-manifest.yaml)
