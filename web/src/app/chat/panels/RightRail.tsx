/**
 * RightRail — tab container for the web chat right sidebar.
 *
 * Hosts three panes behind a tab strip:
 *   - Terminal  — xterm.js + /api/pty WebSocket
 *   - Preview   — rendered HTML / Markdown / CSV / plain text
 *   - Review    — read-only file list + diff text
 *
 * Styling follows the dashboard dark theme (dark bg, subtle borders,
 * muted tab buttons). No Electron/Node APIs — purely browser.
 */

import { useState } from "react";

import { cn } from "@/lib/utils";

import { PreviewPane } from "./PreviewPane";
import { GitReviewPane } from "./ReviewPane";
import { TerminalPane } from "./TerminalPane";

export interface RightRailProps {
  sessionId: string;
  cwd?: string | null;
}

type TabId = "terminal" | "preview" | "review";

const TABS: { id: TabId; label: string }[] = [
  { id: "terminal", label: "Terminal" },
  { id: "preview", label: "Preview" },
  { id: "review", label: "Review" },
];

export function RightRail({ sessionId, cwd }: RightRailProps) {
  const [activeTab, setActiveTab] = useState<TabId>("terminal");

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* ── Tab strip ─────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 border-b border-border"
        role="tablist"
        aria-label="Right rail panels"
      >
        {TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`right-rail-panel-${tab.id}`}
              id={`right-rail-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium tracking-wide transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                selected
                  ? "border-b-2 border-primary bg-muted/40 text-foreground"
                  : "text-muted-foreground hover:bg-muted/20 hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Panel body ────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1" role="tabpanel" aria-labelledby={`right-rail-tab-${activeTab}`}>
        {activeTab === "terminal" && (
          <TerminalPane sessionId={sessionId} cwd={cwd} />
        )}
        {activeTab === "preview" && <PreviewPane sessionId={sessionId} />}
        {activeTab === "review" && (
          <GitReviewPane sessionId={sessionId} cwd={cwd} />
        )}
      </div>
    </div>
  );
}
