# Project Baseline — Version 1.0

> **Status:** FROZEN — Planning phases 0–5 accepted.  
> **Created:** 2026-06-28  
> **Approved by:** Project Owner  
> **Mode:** EXECUTION  

---

## 1. What This Baseline Contains

This baseline captures the complete planning output for the Hermes Web-first migration.
All documents listed below are **frozen at Version 1.0** and constitute the architectural
contract for execution. They SHALL NOT be modified except through the Architecture Change
Request process (Section 4).

### 1.1 Planning Documents (Frozen)

| Artifact | Version | Location | Phase |
|----------|---------|----------|-------|
| Current Architecture | 1.0 | `docs/Architecture/01-Current-Architecture.md` | Phase 1 |
| Future Architecture | 1.0 | `docs/Architecture/02-Future-Architecture.md` | Phase 1 |
| Migration Strategy | 1.0 | `docs/Architecture/03-Migration-Strategy.md` | Phase 2 |
| Architecture Decision Records | 1.0 | `docs/Architecture/04-ADRs.md` | Phase 4 |
| Coding Standards | 1.0 | `docs/Development-Playbook/01-Coding-Standards.md` | Phase 3 |
| Architecture Rules | 1.0 | `docs/Development-Playbook/02-Architecture-Rules.md` | Phase 3 |
| Review Checklist | 1.0 | `docs/Development-Playbook/03-Review-Checklist.md` | Phase 3 |
| Definition of Done | 1.0 | `docs/Development-Playbook/04-Definition-of-Done.md` | Phase 3 |
| Testing Strategy | 1.0 | `docs/Development-Playbook/05-Testing-Strategy.md` | Phase 3 |
| Commit Conventions | 1.0 | `docs/Development-Playbook/06-Commit-Conventions.md` | Phase 3 |
| Epics and Milestones | 1.0 | `docs/Project-Backlog/01-Epics-and-Milestones.md` | Phase 3 |
| Implementation Workbook | 1.0 | `docs/Implementation-Workbook/01-Workbook.md` | Phase 3 |
| Implementation Plan | 1.0 | `docs/Implementation-Workbook/02-Implementation-Plan.md` | Phase 5 |
| System Boundaries | 1.0 | `docs/Technical-Specification/01-System-Boundaries.md` | Phase 3 |
| API Mapping | 1.0 | `docs/Technical-Specification/02-API-Mapping.md` | Phase 3 |
| Event Mapping | 1.0 | `docs/Technical-Specification/03-Event-Mapping.md` | Phase 3 |
| Tech-Spec Ownership Matrix | 1.0 | `docs/Technical-Specification/04-Module-Ownership-Matrix.md` | Phase 3 |
| Data Flow Contracts | 1.0 | `docs/Technical-Specification/05-Data-Flow-Contracts.md` | Phase 3 |
| State Charts | 1.0 | `docs/Technical-Specification/06-State-Charts.md` | Phase 3 |
| Module Ownership (canonical) | 1.0 | `docs/Module-Ownership/01-Module-Ownership-Matrix.md` | Phase 3 |

### 1.2 Machine-Readable Manifest

| Artifact | Version | Location |
|----------|---------|----------|
| Task Manifest | 1.0 | `docs/Task-Manifest/task-manifest.yaml` |

---

## 2. Project Mode: EXECUTION

The project has transitioned from **Planning Mode** to **Execution Mode**.

### 2.1 Rules During Execution

1. **Frozen documents remain frozen** — no edits to Planning docs (Architecture/,
   Development-Playbook/, Technical-Specification/, Project-Backlog/01-Epics-and-Milestones.md,
   docs/README.md) except via Architecture Change Request (see 2.2).
2. **Implementation Workbook may be updated** — task entries can have their `status`,
   `verification_results`, `completion_date`, `actual_files`, `changed_decisions` updated
   as tasks are executed.
3. **Task Manifest may be updated** — task `status` fields move from `planned` to
   `in_progress` to `completed`. `started_at` and `completed_at` timestamp fields
   added per task.
4. **Progress Tracking document may be updated** — weekly progress entries appended.
5. **Architecture Change Request required** for any modification to Frozen docs,
   including new task creation that crosses module boundaries, shifting another task's
   priority between P0/P2, or behavioral changes to the agent core.

### 2.2 Architecture Change Request Process

To modify a frozen document during execution:

1. **Open an Architecture Change Request (ACR)**:
   - File an issue titled `ACR: <short description>` with label `architecture-change`
   - Include the specific frozen doc(s) to modify + rationale + impact assessment
2. **Review required from**: Engineering Lead + 1 architect (non-author)
3. **After approval**: Frozen doc is bumped to next minor version (e.g., v1.0 → v1.1),
   change logged in `docs/Progress.md` under "Architecture Changes".
4. **Rejected ACRs** are closed with rationale; implementation continues on baseline.

---

## 3. Mutable Artifacts (Can Be Updated During Execution)

| Artifact | Allowed Updates |
|----------|-----------------|
| `docs/Implementation-Workbook/01-Workbook.md` | Task completion status, decision log completion, file lists, requirement traceability |
| `docs/Task-Manifest/task-manifest.yaml` | Task status, timestamps |
| `docs/Progress.md` (this file, Section 4+) | Weekly progress, milestone completion, sprint log, risk updates |
| `docs/ACR/` (new) | Architecture Change Request documents |

---

## 4. Architecture Changes Log

| Version | Date | ACR | Change | Frozen Docs Affected |
|---------|------|-----|--------|----------------------|
| 1.0 | 2026-06-28 | — | Initial Baseline | N/A |

---

## 5. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Project Owner | — | 2026-06-28 | Accepted per user approval |
| Engineering Lead | — | — | To be signed before Sprint 1 kickoff |
| Product Owner | — | — | To be signed before MILESTONE-0.1 |

---

This baseline is the contract. Implementation may now begin per task instructions.
