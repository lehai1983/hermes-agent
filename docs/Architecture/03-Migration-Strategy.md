# Migration Strategy — Desktop → Web-First

> **Audience:** Engineering team, product owners
> **Last updated:** 2026-06-28
> **Status:** planning — pending approval
> **Principle:** minimize agent-core changes, maximize reuse, zero user downtime

---

## 1. Approach

**Chosen: Option C (Progressive Hybrid)**

Three phases, each independently shippable. No big-bang cut-over.

```
Phase 1: Foundation (Months 1-3)
    Hitout desktop parity gaps
    @hermes/shared → canonical types + shared transport
    Web native chat renderer (alpha)
    New REST endpoints for web-native chat

Phase 2: Migration (Months 4-6)
    Web native chat becomes default
    Embedded TUI still available (/embed)
    Desktop feature-frozen (bugfixes only)
    Feature deprecation notices to plugin authors

Phase 3: Sunset (Months 7-12)
    Desktop maintenance mode (break-fix)
    Web gets power-user features: terminal, review, pet
    Desktop sunset announcement
```

---

## 2. Feature Migration Matrix

### 2.1 Desktop → Web (Build)

| Priority | Desktop Feature | Web Plan | Effort |
|----------|----------------|----------|--------|
| P0 | Assistant-UI chat components | Lift from `apps/desktop/src/components/assistant-ui/` | 2 weeks |
| P0 | Composer (rich editor + slash) | Lift + adapt (replace `hermesDesktop.*` calls with REST) | 2 weeks |
| P0 | Right-sidebar preview | Use existing `@assistant-ui/react` preview components | 1 week |
| P0 | Tool approval / clarify flows | Already implemented in assistant-ui components | 1 week |
| P1 | Per-session event stream | New SSE endpoint + WS filter | 2 weeks |
| P1 | Voice conversation (mic→speech) | Web Audio API + existing STT/TTS REST | 2 weeks |
| P1 | Code editor (diff/shiki) | Direct reuse from desktop `components/chat/code-editor.tsx` | 1 week |
| P1 | File tree (DnD) | New React-DnD + REST `/api/fs/*` | 2 weeks |
| P2 | Animated pet | Canvas/SVG new implementation | 1 week |
| P2 | Git review panel | Wire existing `git-review-ops.cjs` logic to REST + React UI | 3 weeks |
| P2 | Native terminal | xterm.js (already in web/) + PTY bridge | 1 week |
| P2 | Code review (Codex-style) | Reuse `git-review-ops.cjs` + tree-data pattern | 3 weeks |
| P3 | Multi-window (session popout) | Browser tabs instead | N/A |

### 2.2 Desktop → Drop

| Feature | Reason | Mitigation |
|---------|--------|------------|
| safeStorage encryption | Browser has no native keychain | Use server-side encryption or accept plaintext at rest |
| powerMonitor (sleep/wake resume) | Not available in browser | Not needed (WS auto-reconnects) |
| globalShortcut | Browser only controls its own tab | Document as limitation |
| autoUpdater | Updates are deployment concern | Web deploys are instant |
| Translucency/mica effects | OS-specific, no web equiv | Drop cosmetic feature |
| multi-window chat | Original design artifact | Use browser tabs |
| WSL clipboard image | WSL-only concern | Not a target |
| Windows env var management | Windows-only concern | Not a target |

---

## 3. API Bridge (Desktop IPC → REST)

Today the desktop routes everything through `hermesDesktop.api({ path, method, body })`. The web will call `fetch()` directly.

### Mapping

```
Desktop Pattern                              Web Equivalent
────────────────                            ──────────────
hermesDesktop.api({ path: '/api/X' })  →    fetch('/api/X')
hermesDesktop.selectPaths(opts)         →    <input type="file" webkitdirectory>
hermesDesktop.readFileDataUrl(path)     →    GET /api/fs/read-data-url?path=
hermesDesktop.readDir(path)            →    GET /api/fs/list?path=
hermesDesktop.gitRoot(path)            →    GET /api/fs/git-root?path=
hermesDesktop.workspace.sanitize(cwd)  →    POST /api/workspace/sanitize
hermesDesktop.petOverlay.open()        →    no-op (web-only: new implementation)
hermesDesktop.notify(payload)          →    Notification API (desktop→web)
```

### Strategy: progressive enhancement

Web has direct access to:
- File System Access API (Chrome-only today)
- Navigator.clipboard (text)
- navigator.share (mobile)
- Notification API (with permission)
- Speech Synthesis / Recognition

**Don't proxy through Node.** Web should call `fetch()` to the same REST endpoints desktop uses internally. This is the critical architectural change.

---

## 4. Risk Mitigation

| Risk | Phase | Mitigation |
|------|-------|------------|
| Power users reject new chat UI | 2 | A/B test; embed→native transition toggle; perf benchmarks |
| Type drift during dual-maintenance | 1 | `@hermes/shared` types locked before phase 2; CI check |
| Lost desktop-native features | 2-3 | Priority matrix above; all P3 features documented before drop |
| Plugin IPA breakage | 1 | Deprecation notice; web plugin SDK documented; 6-month notice |
| Desktop binary not building | 2-3 | Fork maintenance to critical only; last-good release archived |
| Auth downgrade when dropping desktop | 1 | JWT-based auth introduced before any desktop feature removal |

---

## 5. Getting to Web Parity

### 5.1 Desktop-complete (current)

```
✅ Chat: assistant-ui + rich composer + streaming markdown
✅ Tool approval: full flow with tool cards
✅ Slash commands: 20+ built-in + extension model
✅ Voice: push-to-talk, TTS playback
✅ Pet: animated sprite, egg, gallery
✅ Terminal: native PTY + persistence
✅ Preview: HTML/MD/CSV/G-code
✅ Review: Codex-style code review, git worktree
✅ Multi-window: separate OS window per session
✅ Keybinds: 40+ hotkeys, rebindable
✅ Themes: 50+ marketplace themes + custom
✅ Notifications: native OS notifications
✅ Auto-update: silent, in-app
```

### 5.2 Web parity target (Phase 3)

```
✅ Chat: lifted React components + new Web chat
✅ Tool approval: direct reuse
✅ Slash commands: same registry, new React UI
✅ Voice: Web Audio API + REST
✅ Pet: reimplemented in Canvas
✅ Terminal: xterm.js + PTY (already in web/)
✅ Preview: existing xterm.js renderer
✅ Review: new REST adapters + reuse tree-data
✅ Multi-window: browser tabs (degrade gracefully)
✅ Keybinds: in-app keybind map (no OS global)
✅ Themes: same presets + dark mode
✅ Notifications: Web Push API
✅ Auto-update: inherent in web deployment
```

---

## 6. Non-Goals

These things stay in desktop/chromium-only contexts (no web equivalent needed):

1. **P2P messaging gateway** — desktop has no special requirement here; any platform adapter works
2. **IRC/Matrix bridging** — gateway feature, not desktop-specific
3. **System tray icon** — browser has no equivalent; skip
4. **Native file watchers for external edits** — polling alternative acceptable
5. **ConPTY on Windows** — browser has wasmPTY (xterm.js add-on) as fallback

---

## 7. Implementation Start

**Week 1 tasks:**

1. Create `@hermes/shared` types package (mirror `apps/desktop/src/types/hermes.ts`)
2. Add SESSION_EVENT_STREAM endpoint to `web_server.py` (SSE)
3. Wire up first web-native chat component (lift `assistant-ui/thread.tsx`)
4. Write integration test: web chat sends prompt → AIAgent → message.delta over SSE

**Milestone 0 (end of week 4):** web-native chat prototype in dev mode, embedded TUI still default

---

**See also:** [Future Architecture](Future-Architecture.md) · [Project Milestones](../Project-Backlog/01-Milestones.md)
