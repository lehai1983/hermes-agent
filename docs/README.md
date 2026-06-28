# Hermes Web Migration — Engineering Documentation

> **Last updated:** 2026-06-28  
> **Status:** BASELINE v1.0 — APPROVED FOR EXECUTION  
> **Mode:** Execution  
> **Start here:** this file

---

## ⚠️ BASELINE FREEZE

**All planning documents in this directory are frozen at Version 1.0.**
They may only be modified through the Architecture Change Request (ACR) process.

See [`BASELINE.md`](BASELINE.md) for the full freeze contract and change process.
See [`Progress.md`](Progress.md) for the mutable execution tracking document.

---

## Overview

This `docs/` directory contains the complete engineering blueprint for migrating
Hermes Agent from a **Desktop-first** architecture to a **Web-first** architecture.

The migration has 3 phases:

| Phase | What | Timeline |
|-------|------|----------|
| Foundation | Shared types, SSE event stream, web-native chat renderer (alpha) | Months 1-3 |
| Migration | Composer lift, voice, right-sidebar, desktop freeze | Months 4-6 |
| Sunset | Pet, git review, desktop CI deprecation | Months 7-12 |

---

## Directory Structure

```
docs/
├── Architecture/                    # High-level system design
│   ├── 01-Current-Architecture.md   # as-is: frontend inventory, state map, transport
│   ├── 02-Future-Architecture.md    # to-be: web-first, new components, API extensions
│   ├── 03-Migration-Strategy.md     # progressive hybrid, feature matrix, risks
│   └── 04-ADRs.md                   # architecture decision records (ADRs)
│
├── Technical-Specification/         # Detailed module specs
│   ├── 01-System-Boundaries.md      # boundary map, allowed/forbidden crossings
│   ├── 02-API-Mapping.md            # REST + WS + RPC + IPC cross-reference
│   ├── 03-Event-Mapping.md          # event types, producers, consumers
│   ├── 04-Module-Ownership-Matrix.md # per-module ownership contract
│   ├── 05-Data-Flow-Contracts.md    # Zod-style shape contracts
│   └── 06-State-Charts.md           # session/tool/attachment lifecycles
│
├── Project-Backlog/                 # What to build, milestones, priorities
│   └── 01-Epics-and-Milestones.md   # 3 epics, 8+ milestones, critical path
│
├── Development-Playbook/            # How to build
│   ├── 01-Coding-Standards.md       # TS/React style, naming, Tailwind 4
│   ├── 02-Architecture-Rules.md     # 11 rules that prevent regressions
│   ├── 03-Review-Checklist.md       # PR review gates
│   ├── 04-Definition-of-Done.md     # what "done" means
│   ├── 05-Testing-Strategy.md       # test pyramid, perf tests, browser matrix
│   └── 06-Commit-Conventions.md     # conventional commits
│
├── Implementation-Workbook/         # Per-task workbooks + execution plan
│   ├── 01-Workbook.md               # task templates + filled entries
│   └── 02-Implementation-Plan.md    # phases, sprints, critical path, release plan
│
├── Task-Manifest/                   # Machine-readable task list
│   └── task-manifest.yaml           # YAML manifest (CI, dashboards)
│
└── Module-Ownership/                # Per-module contract
    └── 01-Module-Ownership-Matrix.md # tools, web, shared, gateway, agent, desktop
```

---

## Reading Paths

### I am an engineering lead planning the work

1. [Migration Strategy](Architecture/03-Migration-Strategy.md) — overall plan
2. [Implementation Plan](Implementation-Workbook/02-Implementation-Plan.md) — phases, sprints, critical path, release plan
3. [Task Manifest](Task-Manifest/task-manifest.yaml) — machine-readable task list
4. [Task Order](Implementation-Workbook/02-Implementation-Plan.md#4-task-order) — dependency graph
5. [Risk Register](Implementation-Workbook/02-Implementation-Plan.md#7-risk-register) — top 10 risks + owners

### I am a frontend engineer new to the project
1. [Current Architecture](Architecture/01-Current-Architecture.md) — understand what Hermes is
2. [Coding Standards](Development-Playbook/01-Coding-Standards.md) — how we write TS
3. [Architecture Rules](Development-Playbook/02-Architecture-Rules.md) — rules we live by
4. [Epics](Project-Backlog/01-Epics-and-Milestones.md) — what we're building + when
5. [Workbook](Implementation-Workbook/01-Workbook.md) — my task + DoD

### I am migrating a desktop feature to web
1. [Migration Strategy](Architecture/03-Migration-Strategy.md) — overall plan
2. [ADRs](Architecture/04-ADRs.md) — why decisions were made
3. [Feature Matrix](Architecture/03-Migration-Strategy.md#2-feature-migration-matrix) — my feature
4. [Workbook entry](Implementation-Workbook/01-Workbook.md) — my task details
5. [Review Checklist](Development-Playbook/03-Review-Checklist.md) — PR gates

### I am reviewing a web migration PR
1. [Review Checklist](Development-Playbook/03-Review-Checklist.md)
2. [Definition of Done](Development-Playbook/04-Definition-of-Done.md)
3. [Coding Standards](Development-Playbook/01-Coding-Standards.md)
4. [Architecture Rules](Development-Playbook/02-Architecture-Rules.md)

---

## Key Concepts

| Term | Meaning |
|------|---------|
| @hermes/shared | canonical TS type catalog + JsonRpcGatewayClient |
| GatewayClient | browser WS client for JSON-RPC (web/src/lib/gatewayClient.ts) |
| HermesDesktop | Electron IPC proxy (desktop: apps/desktop/electron/preload.cjs) |
| PTY bridge | POSIX pseudo-terminal for embedded TUI chat (hermes_cli/pty_bridge.py) |
| SSE | Server-Sent Events (new endpoint for per-session stream) |
| Stream delta | incremental LLM output: `message.delta` event |
| Tool call card | UI showing tool execution (in-flight → result) |

---

## Existing Preserved Docs

The following pre-existing documents are preserved in this directory:
- [session-lifecycle.md](session-lifecycle.md) — Gateway session lifecycle (631 lines)
- [design/profile-builder.md](design/profile-builder.md) — Profile builder design proposal
- [kanban/](kanban/) — Kanban-specific docs
- [middleware/README.md](middleware/README.md) — Middleware docs
- [observability/README.md](observability/README.md) — Observability docs
- [security/](security/) — Security docs
- [relay-connector-contract.md](relay-connector-contract.md) — Relay connector spec
- [chronos-managed-cron-contract.md](chronos-managed-cron-contract.md) — Cron contract
- [plans/2026-06-09-003-fix-telegram-stream-overflow-continuations-plan.md](plans/2026-06-09-003-fix-telegram-stream-overflow-continuations-plan.md)

---

## Feedback

Found a gap? Open an issue tagged `docs` or email the maintainers.
Contributions welcome — see [Review Checklist](Development-Playbook/03-Review-Checklist.md).

---

**See also:** [Implementation Workbook](../Implementation-Workbook) · [Task Manifest](../Task-Manifest/task-manifest.yaml)
