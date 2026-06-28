/**
 * TerminalPane — xterm.js-backed terminal connected to /api/pty via WebSocket.
 *
 * Reuses the same connection pattern as ChatPage.tsx but stripped down to
 * essentials (no OpenGL, no clipboard gymnastics, no reconnect loop).
 *
 *   WebSocket URL  : `${proto}//${host}/api/pty?channel=${channel}&token=${token}`
 *   onData         : keystroke → ws.send(data)
 *   ws.onmessage   : PTY output → term.write(...)
 *   onResize       : `\x1b[RESIZE:cols;rows]` escape → ws.send
 *
 * Cleanup on unmount: ws.close(), term.dispose(), fit.dispose().
 */

import "@xterm/xterm/css/xterm.css";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { HERMES_BASE_PATH } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

export interface TerminalPaneProps {
  sessionId: string;
  cwd?: string | null;
}

// Ephemeral channel id — regenerated on each mount so a fresh PTY spawns.
function generateChannelId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `rightrail-${crypto.randomUUID()}`;
  }
  return `rightrail-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

// Match ChatPage's tier width function for consistent font sizing.
function terminalFontSizeForWidth(layoutWidthPx: number): number {
  if (layoutWidthPx < 300) return 7;
  if (layoutWidthPx < 360) return 8;
  if (layoutWidthPx < 420) return 9;
  if (layoutWidthPx < 520) return 10;
  if (layoutWidthPx < 720) return 11;
  if (layoutWidthPx < 1024) return 12;
  return 14;
}

function terminalLineHeightForWidth(layoutWidthPx: number): number {
  return layoutWidthPx < 1024 ? 1.02 : 1.15;
}

export function TerminalPane({ sessionId: _sessionId, cwd }: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const channelRef = useRef<string>(generateChannelId());

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const token = window.__HERMES_SESSION_TOKEN__;
    const gated = !!window.__HERMES_AUTH_REQUIRED__;
    if (!token && !gated) return;

    // ── xterm.js terminal ─────────────────────────────────────────
    const layoutW = host.clientWidth || 360;
    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      fontFamily:
        "'JetBrains Mono', 'Cascadia Mono', 'Fira Code', 'MesloLGS NF', Menlo, Consolas, monospace",
      fontSize: terminalFontSizeForWidth(layoutW),
      lineHeight: terminalLineHeightForWidth(layoutW),
      scrollback: 5000,
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#c9d1d9",
        cursorAccent: "#0d1117",
        selectionBackground: "#264f78",
      },
    });
    termRef.current = term;

    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.open(host);

    // Initial fit after one animation frame for settled layout.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          fit.fit();
        } catch {
          /* ignore */
        }
      });
    });

    // Resize handling
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        /* ignore */
      }
    });
    ro.observe(host);

    let onDataDisposable: { dispose(): void } | null = null;
    let onResizeDisposable: { dispose(): void } | null = null;

    // ── WebSocket connection ──────────────────────────────────────
    let unmounting = false;
    const connect = async () => {
      let authName: string;
      let authValue: string;

      if (gated) {
        // Gated mode: mint a single-use ticket.
        const res = await fetch(`${HERMES_BASE_PATH}/api/auth/ws-ticket`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return;
        const body = await res.json();
        authName = "ticket";
        authValue = body.ticket;
      } else {
        authName = "token";
        authValue = token!;
      }

      if (unmounting) return;

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const params = new URLSearchParams({ [authName]: authValue, channel: channelRef.current });
      if (cwd) params.set("cwd", cwd);
      const url = `${proto}//${window.location.host}${HERMES_BASE_PATH}/api/pty?${params.toString()}`;

      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(`\x1b[RESIZE:${term.cols};${term.rows}]`);
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          term.write(ev.data);
        } else {
          term.write(new Uint8Array(ev.data as ArrayBuffer));
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
      };

      ws.onerror = () => {
        ws.close();
      };

      // Wire terminal events
      onDataDisposable = term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      onResizeDisposable = term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(`\x1b[RESIZE:${cols};${rows}]`);
        }
      });
    };

    void connect();
    term.focus();

    return () => {
      unmounting = true;
      onDataDisposable?.dispose();
      onResizeDisposable?.dispose();
      ro.disconnect();
      wsRef.current?.close();
      wsRef.current = null;
      term.dispose();
      fit.dispose();
    };
  }, [cwd]);

  return (
    <div
      ref={hostRef}
      className={cn(
        "h-full w-full overflow-hidden bg-[#0d1117]",
        "[&_.xterm]:p-1",
      )}
    />
  );
}
