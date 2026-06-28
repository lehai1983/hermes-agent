/**
 * ChatPage — ChatGPT-style web chat surface.
 *
 * Replaces the xterm.js terminal with a native React chat UI:
 *   - Thread (message list + SSE streaming + tool cards)
 *   - Composer (rich editor + voice + file upload)
 *   - WelcomeScreen (onboarding when empty)
 *   - ApprovalOverlay (tool approval prompts)
 *
 * Retained from the previous xterm-based version:
 *   - ChatSidebar (model picker + tool-call list)
 *   - ChatSessionList (session switcher)
 *   - Session resume / reconnect logic
 *   - Profile-scoped sessions
 *   - Mobile panel support
 *
 * The xterm terminal is available as a right-rail panel (TerminalPane)
 * for users who need a full terminal alongside the chat.
 */

import { Button } from "@nous-research/ui/ui/components/button";
import { Typography } from "@nous-research/ui/ui/components/typography/index";
import { cn } from "@/lib/utils";
import { PanelRight, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";

import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatSessionList } from "@/components/ChatSessionList";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { normalizeSessionTitle } from "@/lib/chat-title";
import { PluginSlot } from "@/plugins";
import { useProfileScope } from "@/contexts/useProfileScope";

// Chat UI components
import {
  Thread,
  ThreadErrorBoundary,
  ApprovalOverlay,
} from "@/app/chat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatPage({ isActive = true }: { isActive?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeParam = searchParams.get("resume");

  // Session state
  const [sessionId, setSessionId] = useState<string>(
    () => resumeParam ?? generateSessionId(),
  );
  const [sessionEnded, setSessionEnded] = useState(false);
  const [banner, setBanner] = useState<string | null>(() =>
    typeof window !== "undefined" &&
    !window.__HERMES_SESSION_TOKEN__ &&
    !window.__HERMES_AUTH_REQUIRED__
      ? "Session token unavailable. Open this page through `hermes dashboard`, not directly."
      : null,
  );

  // Reconnect
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);

  // Mobile panel
  const [mobilePanelOpenRaw, setMobilePanelOpenRaw] = useState(false);
  const mobilePanelOpen = isActive && mobilePanelOpenRaw;
  const closeMobilePanel = useCallback(() => setMobilePanelOpenRaw(false), []);

  // Narrow (mobile) detection
  const [narrow, setNarrow] = useState(
    () =>
      typeof window !== "undefined"
        ? window.matchMedia("(max-width: 1023px)").matches
        : false,
  );

  // Page header
  const { setEnd, setTitle } = usePageHeader();
  const [sessionTitleState, setSessionTitleState] = useState<{
    scope: string;
    title: string | null;
  }>({ scope: "", title: null });
  const { t } = useI18n();
  const { profile: scopedProfile } = useProfileScope();

  const channel = useMemo(
    () => `chat-${sessionId.slice(0, 8)}`,
    [sessionId],
  );

  const modelToolsLabel = useMemo(
    () => `${t.app.modelToolsSheetTitle} ${t.app.modelToolsSheetSubtitle}`,
    [t.app.modelToolsSheetSubtitle, t.app.modelToolsSheetTitle],
  );

  const [portalRoot] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.body : null,
  );

  // ---------------------------------------------------------------------------
  // Session resume
  // ---------------------------------------------------------------------------

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const startFreshDashboardChat = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("resume");
    clearReconnectTimer();
    setSearchParams(next, { replace: true });
    setSessionId(generateSessionId());
    setSessionEnded(false);
    setBanner(null);
    setReconnectNonce((n) => n + 1);
  }, [clearReconnectTimer, searchParams, setSearchParams]);

  const reconnect = useCallback(() => {
    clearReconnectTimer();
    setSessionEnded(false);
    setBanner(null);
    setReconnectNonce((n) => n + 1);
  }, [clearReconnectTimer]);

  // Resolve latest session descendant for resume
  useEffect(() => {
    if (!resumeParam) return;
    let cancelled = false;

    setSessionId(resumeParam);

    api
      .getSessionDetail(resumeParam, scopedProfile)
      .then((session) => {
        if (cancelled) return;
        const titleScope = `${resumeParam}\0${scopedProfile}`;
        setSessionTitleState({
          scope: titleScope,
          title: normalizeSessionTitle(session.title),
        });
      })
      .catch(() => {
        // Best-effort
      });

    api
      .getSessionLatestDescendant(resumeParam)
      .then((res) => {
        if (cancelled || !res.session_id || res.session_id === resumeParam) {
          return;
        }
        const next = new URLSearchParams(searchParams);
        next.set("resume", res.session_id);
        setSearchParams(next, { replace: true });
      })
      .catch(() => {
        // Best-effort
      });

    return () => {
      cancelled = true;
    };
  }, [resumeParam, scopedProfile, searchParams, setSearchParams]);

  // ---------------------------------------------------------------------------
  // Page header integration
  // ---------------------------------------------------------------------------

  const titleScope = `${sessionId}\0${reconnectNonce}`;
  const sessionTitle =
    sessionTitleState.scope === titleScope ? sessionTitleState.title : null;

  useEffect(() => {
    if (!isActive) {
      setTitle(null);
      return;
    }
    setTitle(sessionTitle);
    return () => setTitle(null);
  }, [isActive, sessionTitle, setTitle]);

  useEffect(() => {
    if (!isActive) {
      setEnd(null);
      return;
    }
    if (!narrow) {
      setEnd(null);
      return;
    }
    setEnd(
      <Button
        ghost
        onClick={() => setMobilePanelOpenRaw(true)}
        aria-expanded={mobilePanelOpen}
        aria-controls="chat-side-panel"
        className={cn(
          "shrink-0 rounded border border-current/20",
          "px-2 py-1 text-xs font-medium tracking-wide",
          "text-text-secondary hover:text-midground hover:bg-midground/5",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <PanelRight className="h-3 w-3 shrink-0" />
          {modelToolsLabel}
        </span>
      </Button>,
    );
    return () => setEnd(null);
  }, [isActive, narrow, mobilePanelOpen, modelToolsLabel, setEnd]);

  // ---------------------------------------------------------------------------
  // Responsive + mobile panel
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobilePanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobilePanel();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobilePanelOpen, closeMobilePanel]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobilePanelOpenRaw(false);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const mobileModelToolsPortal =
    isActive &&
    narrow &&
    portalRoot &&
    createPortal(
      <>
        {mobilePanelOpen && (
          <Button
            ghost
            aria-label={t.app.closeModelTools}
            onClick={closeMobilePanel}
            className={cn(
              "fixed inset-0 z-[55] p-0 block",
              "bg-black/60 backdrop-blur-sm",
            )}
          />
        )}

        <div
          id="chat-side-panel"
          role="complementary"
          aria-label={modelToolsLabel}
          className={cn(
            "font-mondwest fixed top-0 right-0 z-[60] flex h-dvh max-h-dvh w-64 min-w-0 flex-col antialiased",
            "border-l border-current/20 text-midground",
            "bg-background-base/95 backdrop-blur-sm",
            "transition-transform duration-200 ease-out",
            "[background:var(--component-sidebar-background)]",
            "[clip-path:var(--component-sidebar-clip-path)]",
            "[border-image:var(--component-sidebar-border-image)]",
            mobilePanelOpen
              ? "translate-x-0"
              : "pointer-events-none translate-x-full",
          )}
        >
          <div
            className={cn(
              "flex h-14 shrink-0 items-center justify-between gap-2 border-b border-current/20 px-5",
            )}
          >
            <Typography
              mondwest
              className="text-display font-bold text-[1.125rem] leading-[0.95] tracking-[0.0525rem] text-midground"
              style={{ mixBlendMode: "plus-lighter" }}
            >
              {t.app.modelToolsSheetTitle}
              <br />
              {t.app.modelToolsSheetSubtitle}
            </Typography>

            <Button
              ghost
              size="icon"
              onClick={closeMobilePanel}
              aria-label={t.app.closeModelTools}
              className="text-text-secondary hover:text-midground"
            >
              <X />
            </Button>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
              "border-t border-current/10",
            )}
          >
            <div className="border-b border-current/10 px-1 py-2">
              <ChatSidebar
                channel={channel}
                profile={scopedProfile}
                onDashboardNewSessionRequest={startFreshDashboardChat}
                onSessionTitleChange={(title: string | null) =>
                  setSessionTitleState({ scope: titleScope, title })
                }
              />
            </div>
            <ChatSessionList
              activeSessionId={resumeParam}
              profile={scopedProfile}
              onPicked={closeMobilePanel}
              onNewChat={startFreshDashboardChat}
            />
          </div>
        </div>
      </>,
      portalRoot,
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      <PluginSlot name="chat:top" />
      {mobileModelToolsPortal}

      {banner && (
        <div className="border border-warning/50 bg-warning/10 text-warning px-3 py-2 text-xs tracking-wide">
          {banner}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row lg:gap-3">
        {/* ── Main chat area ── */}
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background-base"
        >
          {sessionEnded ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
              <div className="text-sm tracking-wide text-white/80">
                Session ended.
              </div>
              <Button
                onClick={reconnect}
                prefix={<RotateCcw className="h-4 w-4" />}
                aria-label="Start a new chat session"
              >
                Start new session
              </Button>
            </div>
          ) : (
            <ThreadErrorBoundary>
              <Thread
                sessionId={sessionId}
                sessionKey={undefined}
              />
            </ThreadErrorBoundary>
          )}

          {/* Approval overlay — renders on top of the thread when the agent asks for permission */}
          <ApprovalOverlay sessionId={sessionId} />
        </div>

        {/* ── Sidebar (desktop) ── */}
        {!narrow && (
          <div
            id="chat-side-panel"
            role="complementary"
            aria-label={modelToolsLabel}
            className="flex min-h-0 shrink-0 flex-col gap-3 overflow-hidden lg:h-full lg:w-60"
          >
            <div className="shrink-0">
              <ChatSidebar
                channel={channel}
                profile={scopedProfile}
                onDashboardNewSessionRequest={startFreshDashboardChat}
                onSessionTitleChange={(title: string | null) =>
                  setSessionTitleState({ scope: titleScope, title })
                }
              />
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <ChatSessionList
                activeSessionId={resumeParam}
                profile={scopedProfile}
                onNewChat={startFreshDashboardChat}
              />
            </div>
          </div>
        )}
      </div>
      <PluginSlot name="chat:bottom" />
    </div>
  );
}

declare global {
  interface Window {
    __HERMES_SESSION_TOKEN__?: string;
    __HERMES_AUTH_REQUIRED__?: boolean;
  }
}
