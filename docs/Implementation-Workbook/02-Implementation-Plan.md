# Implementation Plan

> **Audience:** Engineering leads, product owners, release management
> **Last updated:** 2026-06-28
> **Status:** planning — pending final approval
> **Goal:** After approval, this becomes the execution blueprint. No architecture-redesign during implementation.

---

## 1. Executive Summary

Transform Hermes from Desktop-first to Web-first architecture:
- **Duration:** 12 months (3 phases)
- **Teams:** 2 frontend (web) + 1 backend + 1 full-stack (shared types/lift)
- **Key Decision:** Progressive hybrid — web-native React chat replaces embedded TUI; desktop deprecated
- **Agent Core:** no behavioral change

---

## 2. Implementation Phases

### Phase 1: Foundation (Weeks 1-12, ending ~2026-09-30)

**Goal:** Scaffolding for web-native chat — shared types, SSE stream, new REST endpoints, renderer alpha.

| Week | Focus | Deliverables | Lead |
|------|-------|--------------|------|
| 1-2 | @hermes/shared type catalog | `apps/shared/src/types/` package; web + desktop import from it | shared |
| 3-4 | Per-session SSE event stream | `GET /api/sessions/{id}/events` route; heartbeat; docs | web_server |
| 5-8 | Web chat renderer alpha | Thread, Message, ToolApproval components lifted; `/chat?webchat=1` | web |
| 9-10 | New REST endpoints | POST messages, interrupt, status, branch, stream alias | web_server |
| 11-12 | Integration + polish | End-to-end web chat demo; feature flag; perf baseline | web + QA |

**Milestone 0.1 exit criteria:**
- [ ] `webchat=1` URL param enables Web-native chat on dashboard
- [ ] Streaming reply visible at ≥ 30fps in browser
- [ ] Tool approval card works in Web
- [ ] Embedded TUI still works (no regression)
- [ ] Desktop unaffected

**Risk:** If assistant-ui lift requires > 8 weeks, defer Composer lift to Phase 2 week 1-2.

---

### Phase 2: Migration (Weeks 13-24, ending ~2026-12-31)

**Goal:** Make web-native chat the default; freeze desktop feature dev; start deprecation clock.

| Week | Focus | Deliverables | Lead |
|------|-------|--------------|------|
| 13-16 | Composer lift | Rich editor, slash popover, voice controls, attachments | web |
| 17-18 | Preview + terminal panels | PreviewPane, TerminalPane, RightRail with tabs | web |
| 19-20 | Web chat default switch | Default chat UI = web-native; embed via URL `?embed=1` | web + ops |
| 21-22 | Desktop freeze | Maintenance mode announcement; README notice; GitHub label | all |
| 23-24 | Polish + analytics | Feature flag cleanup; event tracking; opt-out rate monitoring | web + data |

**Milestone 0.2 exit criteria:**
- [ ] Web chat is default chat surface on dashboard (new & returning users)
- [ ] 80%+ of chat sessions use Web-native renderer (by analytics)
- [ ] Desktop feature-frozen with public announcement
- [ ] Voice conversation round-trip works in browser
- [ ] Embed fallback exists for power users who prefer terminal

**Risk:** If user backlash > 15% (measured via GitHub Issues + survey), extend hybrid period by 4 weeks.

---

### Phase 3: Sunset (Weeks 25-48, ending ~2027-06-30)

**Goal:** Web has full feature parity (or documented deprecation); desktop CI stopped; docs updated.

| Week | Focus | Deliverables | Lead |
|------|-------|--------------|------|
| 25-28 | Pet system (Web) | Canvas 2D renderer, gallery, animation | web |
| 29-34 | Git review panel | Codex-style review UI wired to existing git ops | web |
| 35-36 | Desktop sunset announcement | 6-month user notice; migration guide; FAQ | product |
| 37-40 | Plugin IPA audit | Pet/haptics/voice IPAs deprecated; web SDK canonical | plugins |
| 41-44 | Binary archival | Last-good binaries in release; release notes point to web | CI |
| 45-48 | CI removal | Delete desktop workflow files; docs-only desktop section | CI + ops |

**Milestone 1.0 exit criteria:**
- [ ] Desktop CI removed
- [ ] Web chat performance ≥ desktop chat performance
- [ ] Web has pet, git review, all features with documented drop rationale
- [ ] Documentation: web is canonical, desktop section has sunset notice
- [ ] Plugin SDK for web replaces desktop-specific IPAs

---

## 3. Sprint Plan

Sprint velocity: 1 week per sprint (10 working days each, aligned with Phase weeks).

### Sprint Breakdown

```
Sprint  Phase     Sprint Name                       Tasks
────────────────  ───────────────────────────────   ─────
1-2     Phase 1   Foundation: shared types          TASK-101
3-4     Phase 1   Foundation: SSE endpoint          TASK-102
5-6     Phase 1   Foundation: chat renderer lift    TASK-103 (pt 1: Message thread)
7-8     Phase 1   Foundation: chat renderer lift    TASK-103 (pt 2: Tool approval)
9-10    Phase 1   Foundation: REST endpoints        TASK-104
11-12   Phase 1   Foundation: integration + demo    MILESTONE-0.1
─────   ───────   ───────────────────────────────   ─────
13-14   Phase 2   Migration: composer core           TASK-201 (pt 1)
15-16   Phase 2   Migration: voice + slash           TASK-201 (pt 2)
17-18   Phase 2   Migration: right-sidebar           TASK-202
19-20   Phase 2   Migration: web default switch      ops + web
21-22   Phase 2   Migration: desktop freeze          TASK-203
23-24   Phase 2   Migration: analytics + polish      all
─────   ───────   ───────────────────────────────   ─────
25-26   Phase 3   Sunset: pet design + prototyping   TASK-301 (pt 1)
27-28   Phase 3   Sunset: pet finalization           TASK-301 (pt 2)
29-32   Phase 3   Sunset: git review core            TASK-302 (pt 1-2)
33-34   Phase 3   Sunset: sunset announcement        product
35-36   Phase 3   Sunset: plugin audit               plugins
37-40   Phase 3   Sunset: plugin SDK rewrite         plugins
41-42   Phase 3   Sunset: binaries archive           CI
43-44   Phase 3   Sunset: CI removal                 CI
45-48   Phase 3   Sunset: documentation finalization ops + docs
```

---

## 4. Task Order

### Hard dependency order (must not deviate)

```
TASK-101 (@hermes/shared types)
  ├── TASK-102 (SSE stream)
  ├── TASK-103 (renderer lift) ──parallel with TASK-102─┐
  │     └ TASK-201 (composer lift)                     │
  │          └ TASK-203 (desktop freeze)               │
  │                                                    │
  TASK-102 ──→ TASK-104 (REST endpoints)               │
       └──→ TASK-202 (right-sidebar)  ─────────────────┘
              └ TASK-302 (git review)
                └ TASK-303 (CI removal) ← milestone

TASK-201 ──→ TASK-301 (pet)  (independent path, lower priority)
```

### Parallel work opportunities

```
Track A (web frontend)     Track B (backend/server)      Track C (shared/infra)
─────────────────────      ────────────────────────      ───────────────────────
TASK-101 @shared             TASK-102 SSE stream          TASK-301 pet (async start)
TASK-103 renderer lift       TASK-104 REST endpoints      Plugin SDK audit (early)
TASK-201 composer lift       TASK-302 git review (ops)
TASK-202 right-sidebar
```

---

## 5. Critical Path

Longest sequence (4-5 engineers; 38 weeks wall clock):

```
TASK-101 (2w) → TASK-103 (4w) → TASK-201 (4w) → TASK-203 (1w) → TASK-301 (2w) → ... = 13 weeks
                                        ↓ (parallel on backend)
TASK-102 (2w) → TASK-104 (2w) → TASK-202 (2w) → TASK-302 (4w) → TASK-303 (1w) = 11 weeks

Combined critical path (accounting for integration): ~22 weeks active development
+ 4 weeks buffer + 2 weeks final regression + 6 weeks MS1.0 desktop notice = 34 weeks total
```

---

## 6. Team Allocation

### Team composition (ideal)

| Role | Count | Focus |
|------|-------|-------|
| Web Frontend Engineer (senior) | 2 | Web chat renderer, composer, pet, review |
| Backend Engineer (senior) | 1 | SSE endpoint, REST additions, tui_gateway |
| Full-stack / Platform | 1 | @hermes/shared, IPC→REST bridge, CI changes |
| QA Engineer | 1 (part-time) | Test plans, playwright E2E, cross-browser |
| Product / UX | 1 (part-time) | Design reviews, user research, analytics |
| Technical Writer | 1 (part-time) | User-facing docs, migration guide |

### Load per phase

| Phase | Frontend | Backend | Full-stack | QA | UX | Writer |
|-------|----------|---------|------------|----|-----|--------|
| 1 | 2 FTE | 1 FTE | 0.5 FTE | 0.5 FTE | 0.25 FTE | 0.25 FTE |
| 2 | 2 FTE | 0.5 FTE | 0.5 FTE | 0.75 FTE | 0.5 FTE | 0.5 FTE |
| 3 | 1 FTE | 0.25 FTE | 0.5 FTE | 0.5 FTE | 0.5 FTE | 0.75 FTE |

---

## 7. Risk Register

| ID | Risk | P | I | Score | Mitigation | Owner |
|----|------|---|---|-------|------------|-------|
| R-01 | Power users reject web chat UX | H | H | C | hybrid transition with embed URL; perf benchmarks | Product |
| R-02 | TypeScript type drift during dual-maintenance | H | H | C | @hermes/shared CI lock; types-release before dev | FE Lead |
| R-03 | assistant-ui lift slower than planned | H | M | H | Fallback: embedded TUI remains default longer | FE Lead |
| R-04 | SSE implementation has cross-browser bugs | M | H | H | Fallback to WS scope filter; graceful degradation | BE Lead |
| R-05 | Desktop-specific plugin IPAs used in prod | M | H | H | Audit + deprecate with 6-month notice; web replacement IPA | Plugin Owner |
| R-06 | Cross-browser rendering regressions | M | M | M | Playwright CI across Chrome/Firefox/Safari | QA |
| R-07 | macOS voice API differences | M | L | L | Feature flag with graceful fallback | FE Lead |
| R-08 | Task-105 (auth v2) pulled into Phase 1 scope | L | M | L | Out-of-scope until MILESTONE-0.2; gated by adoption | Architect |
| R-09 | Pet system scope creep (from P2 to P0) | L | M | L | P2 priority gate; do not scope-increase without approval | Product |
| R-10 | Desktop CI breakage during Phase 2 | L | L | L | Separate workflow file; freeze only; no deletion until Phase 3 | CI |

**Risk score: P×I** where L=1, M=2, H=3 (1-2=Low, 3-4=Medium, 6-9=C=Critical).

**Top 3 critical risks: R-01, R-02, R-03.** Each has named owner + dated mitigation in sprint plan.

---

## 8. Testing Plan

### Phase 1 Testing

| Type | Tool | Coverage Target | Gate |
|------|------|-----------------|------|
| Unit | vitest (TS) | new components: 80% coverage | PR merge |
| Unit | pytest (Python) | SSE handler: 90% coverage | PR merge |
| Integration | pytest + FastAPI test client | All 5 new REST endpoints | PR merge |
| E2E | playwright (chrome-only alpha) | 1 happy-path: send message → reply | MS-0.1 release |
| Smoke | manual (Firefox, Safari) | Basic web chat works | MS-0.1 release |

### Phase 2 Testing

| Type | Tool | Coverage Target | Gate |
|------|------|-----------------|------|
| Unit | vitest | composer + voice hooks: 80% | PR merge |
| Integration | pytest | SSE + REST new endpoints under concurrent load | PR merge |
| E2E | playwright (all 3 browsers) | Send message, approval, branch, voice | MS-0.2 release |
| Performance | playwright bench | Render 50 messages in < 100ms | MS-0.2 release |
| A/B | analytics | embed vs web-native completion rate | 4-week monitoring |
| Regression | hermes CI + web CI | Desktop build + web build green | Per PR |

### Phase 3 Testing

| Type | Tool | Coverage Target | Gate |
|------|------|-----------------|------|
| Unit | vitest | pet canvas + review components: 80% | PR merge |
| E2E | playwright | Pet flow, git review stage→commit→push | MS-1.0 release |
| User Acceptance | recruited users | 10 desktop users migrate to web | MS-1.0 release |
| Stress | playwright bench | 100 simultaneous web chat sessions | Pre-release |
| Security | OWASP ZAP | No critical vulns on dashboard routes | Pre-release |

---

## 9. Release Plan

### Release Channels

| Channel | Target | Cadence | Audience |
|---------|--------|---------|----------|
| dev | nightly | latest main | internal |
| beta | biweekly | milestone pre-release | external testers |
| stable | quarterly | GA | all users |

### Release Sequence

| Release | Version | Date | Channel | Key Change |
|---------|---------|------|---------|------------|
| Foundation Alpha | v0.18.0-alpha | 2026-09-30 | beta | `webchat=1` param, SSE endpoint, shared types |
| Migration Preview | v0.19.0-alpha | 2026-11-15 | beta | Web chat default, composer lift |
| Migration GA | v0.20.0 | 2027-01-31 | stable | Web chat GA; dashboard announcement |
| Pet + Review | v0.21.0 | 2027-04-30 | stable | Parity features; sunset announcement |
| Sunset GA | v1.0.0 | 2027-07-31 | stable | Desktop deprecated; web sole GUI |

### Rollback Strategy

| Trigger | Action |
|---------|--------|
| > 15% user backlash via embed URL hits | Revert to embed-by-default; keep webchat=1 |
| SSE endpoint perf regression | Fallback to WS scope filter; SSE off |
| Web chat renderer runtime errors | Error-boundary auto-reverts to embed for that user |
| Data loss event | FULL rollback to last stable; stop migration |

### Feature Flags

| Flag | Default Phase 1 | Default Phase 2 | Default Phase 3 |
|------|-----------------|-----------------|-----------------|
| webchat URL param | opt-in | default-on | only option |
| embed URL param | fallback | opt-in | deprecated chat |
| pet system | off | opt-in | on |
| globalShortcut deprecation | n/a | warning log | removed |

---

## 10. Success Metrics

| Metric | Phase 1 Target | Phase 2 Target | Phase 3 Target |
|--------|----------------|----------------|----------------|
| Web chat sessions (% of total) | 5% | 80% | 99% |
| Desktop session share | 95% | 20% | <1% |
| User-reported issues (monthly) | < 20 | < 30 | < 15 |
| Render p95 latency | < 50ms | < 30ms | < 20ms |
| SSE event delivery p99 | < 200ms | < 100ms | < 50ms |
| Plugin IPA coverage | n/a | audit done | 100% web IPA |
| Desktop CI cost | $0 savings | $0 savings | $200/mo saved |

---

## 11. Approval Required Before Execution

| Role | Sign-off |
|------|----------|
| Engineering Lead | Technical feasibility |
| Product Owner | Scope, timeline, UX commitment |
| Security | Auth v2 deferred; no security regression |
| QA Lead | Test plan resourced |
| Marketing | Sunset announcement timing |
| Legal | Plugin deprecation legal review |

---

**See also:** [Task Manifest](../Task-Manifest/task-manifest.yaml) · [Architecture](../Architecture/01-Current-Architecture.md) · [Future Architecture](../Architecture/02-Future-Architecture.md)
