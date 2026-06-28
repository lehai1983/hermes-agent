# Desktop Deprecation Notice

> **Status:** MAINTENANCE MODE — Since 2026-06-28  
> **Target:** Full Q3 2027 (after v1.0 GA)

## What This Means

The Electron desktop app (`apps/desktop/`) is in **maintenance mode**:

- **No new features** — all new development lands in `web/`
- **Bug fixes only** — critical fixes may still be merged
- **No proactive maintenance** — dependencies not actively updated unless security-critical
- **Installers still available** — existing users can still build from source

## Why

The Web SPA (`web/`) now provides the full chat experience:

| Feature | Desktop (was) | Web (now) |
|---------|--------------|-----------|
| Chat with streaming | ✅ | ✅ TASK-103 |
| Tool approval/clarify | ✅ | ✅ TASK-103 |
| Real-time events | IPC | SSE TASK-102 |
| Voice conversation | ✅ | ✅ TASK-201 |
| Composer (send, attach) | ✅ | ✅ TASK-201 |
| Preview pane | ✅ | ✅ TASK-202 |
| Terminal | ✅ | ✅ TASK-202 |
| Animated pet | ✅ | ✅ TASK-301 |
| Git review (read-only) | ✅ | ✅ TASK-302 |
| Auto-update | ✅ | Inherent (web is always-current) |
| Multi-window | ✅ | Browser tabs |
| safeStorage | ✅ | Not feasible (browser) |
| Haptic feedback | ✅ | Not feasible (cosmetic) |

## For Users

**Recommended:** Use the Web UI at your self-hosted dashboard URL.

If you need desktop-specific features (multi-window, safeStorage, haptics), you can still build from source:

```bash
cd apps/desktop
npm install
npm run build
```

## For Developers

- Do NOT add new `apps/desktop` features
- Do NOT add new `window.hermesDesktop.*` IPC handlers
- Critical bug fixes are OK (ported from `web applicable)
- The `apps/shared/` package is shared — changes there affect both
- Full CI removal scheduled Q3 2027
