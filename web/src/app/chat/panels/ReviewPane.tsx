/**
 * GitReviewPane — read-only git code review UI.
 *
 * Combines:
 * - File tree (GET /api/fs/list)
 * - File viewer (GET /api/fs/read-text)
 * - Git activity feed (git-operations.ts → /api/sessions or fallback)
 *
 * MVP scope: read-only. No git write operations (push, commit, branch).
 */

import { HERMES_BASE_PATH } from "@/lib/api";
import { cn } from "@/lib/utils";
import { isoTimeAgo } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import {
  getGitRoot,
  getGitSessions,
  type GitSession,
} from "../lib/git-operations";

// ── Types ────────────────────────────────────────────────────────────────

export interface GitReviewPaneProps {
  sessionId: string;
  cwd?: string | null;
}

interface FsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface ReadTextResponse {
  text: string;
  binary: boolean;
  byteSize: number;
  language: string;
  mimeType: string;
  path: string;
  truncated: boolean;
}

type Tab = "files" | "activity";

// ── Component ────────────────────────────────────────────────────────────

export function GitReviewPane({ cwd }: GitReviewPaneProps) {
  const [tab, setTab] = useState<Tab>("files");

  // ── File tree state ──────────────────────────────────────────────────
  const [files, setFiles] = useState<FsEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Git activity state ───────────────────────────────────────────────
  const [gitRoot, setGitRoot] = useState<string | null>(null);
  const [gitSessions, setGitSessions] = useState<GitSession[]>([]);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);

  // Load file list
  useEffect(() => {
    if (!cwd) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${HERMES_BASE_PATH}/api/fs/list?path=${encodeURIComponent(cwd)}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: { entries?: FsEntry[]; error?: string }) => {
        if (cancelled) return;
        if (body.error) {
          setError(body.error);
          setFiles([]);
        } else {
          setFiles(
            (body.entries ?? []).filter(
              (e) => !e.name.startsWith("."),
            ),
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to list files");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cwd]);

  // Load git root
  useEffect(() => {
    if (!cwd) return;
    getGitRoot(cwd).then((root) => setGitRoot(root)).catch(() => setGitRoot(null));
  }, [cwd]);

  // Load git activity
  const loadGitActivity = useCallback(() => {
    let cancelled = false;
    setGitLoading(true);
    setGitError(null);

    getGitSessions(10)
      .then((activity) => {
        if (cancelled) return;
        setGitSessions(activity.sessions);
        if (activity.repoPath && !gitRoot) {
          setGitRoot(activity.repoPath);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setGitError(err instanceof Error ? err.message : "Failed to load git activity");
      })
      .finally(() => {
        if (!cancelled) setGitLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gitRoot]);

  useEffect(() => {
    if (tab === "activity") {
      const cancel = loadGitActivity();
      return cancel;
    }
  }, [tab, loadGitActivity]);

  // Load file content
  const handleSelectFile = useCallback((filePath: string) => {
    setSelectedPath(filePath);
    setFileContent(null);
    setError(null);

    fetch(
      `${HERMES_BASE_PATH}/api/fs/read-text?path=${encodeURIComponent(filePath)}`,
      { credentials: "include" },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ReadTextResponse>;
      })
      .then((body) => {
        if (body.binary) {
          setFileContent("[binary file]");
        } else {
          setFileContent(body.text);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to read file");
      });
  }, []);

  // ── Render helpers ───────────────────────────────────────────────────

  const renderSourceBadge = (source: string | null) => {
    const s = source ?? "unknown";
    const colorMap: Record<string, string> = {
      gateway: "bg-blue-500/20 text-blue-400",
      cron: "bg-amber-500/20 text-amber-400",
      telegram: "bg-sky-500/20 text-sky-400",
      discord: "bg-indigo-500/20 text-indigo-400",
      slack: "bg-purple-500/20 text-purple-400",
      web: "bg-green-500/20 text-green-400",
    };
    const cls = colorMap[s] ?? "bg-muted text-muted-foreground";
    return (
      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium uppercase", cls)}>
        {s}
      </span>
    );
  };

  // ── JSX ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="flex shrink-0 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("files")}
          className={cn(
            "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider",
            tab === "files"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Files
        </button>
        <button
          type="button"
          onClick={() => setTab("activity")}
          className={cn(
            "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider",
            tab === "activity"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Git Activity
        </button>
      </div>

      {/* ── Files tab ────────────────────────────────────────────────── */}
      {tab === "files" && (
        <div className="flex min-h-0 flex-1">
          {/* File list (left) */}
          <div className="flex w-44 shrink-0 flex-col border-r border-border">
            <div className="shrink-0 border-b border-border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {gitRoot ? gitRoot.split("/").pop() ?? "Repo" : "Files"}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="p-2 text-xs text-muted-foreground">Loading…</div>
              )}
              {!loading && files.length === 0 && (
                <div className="p-2 text-xs text-muted-foreground">
                  {cwd ? "No files" : "No cwd set"}
                </div>
              )}
              {files.map((file) => {
                const selected = file.path === selectedPath;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => handleSelectFile(file.path)}
                    className={cn(
                      "flex w-full items-center gap-1 truncate px-2 py-1 text-left text-xs",
                      "hover:bg-muted/40 focus:bg-muted/40 focus:outline-none",
                      selected
                        ? "bg-primary/20 text-primary"
                        : "text-foreground",
                    )}
                    title={file.name}
                  >
                    {file.isDirectory ? (
                      <span className="text-[10px] text-muted-foreground">▸</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">·</span>
                    )}
                    <span className="truncate">{file.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* File content (right) */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {selectedPath ? selectedPath.split("/").pop() ?? "Content" : "Content"}
            </div>
            <div className="flex-1 overflow-auto">
              {error && (
                <div className="p-2 text-xs text-destructive">{error}</div>
              )}
              {!selectedPath && !error && (
                <div className="p-2 text-xs text-muted-foreground">
                  Select a file to preview.
                </div>
              )}
              {fileContent && (
                <pre className="whitespace-pre-wrap break-words p-2 font-mono text-[11px] leading-relaxed text-foreground">
                  {fileContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Git Activity tab ──────────────────────────────────────────── */}
      {tab === "activity" && (
        <div className="flex-1 overflow-y-auto">
          {/* Git root header */}
          {gitRoot && (
            <div className="border-b border-border px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Repository
              </div>
              <div className="mt-0.5 truncate font-mono text-xs text-foreground">
                {gitRoot}
              </div>
            </div>
          )}

          {/* Loading / error states */}
          {gitLoading && (
            <div className="p-3 text-xs text-muted-foreground">Loading git activity…</div>
          )}
          {gitError && (
            <div className="p-3 text-xs text-destructive">{gitError}</div>
          )}
          {!gitLoading && !gitError && gitSessions.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">
              No recent git activity found.
            </div>
          )}

          {/* Session list */}
          {!gitLoading && gitSessions.length > 0 && (
            <div className="divide-y divide-border">
              {gitSessions.map((session) => (
                <div key={session.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-foreground">
                      {session.title ?? "(untitled)"}
                    </span>
                    {renderSourceBadge(session.source)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{isoTimeAgo(new Date(session.started_at * 1000).toISOString())}</span>
                    <span>·</span>
                    <span>{session.message_count} msgs</span>
                  </div>
                  {session.preview && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {session.preview}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Refresh hint */}
          {!gitLoading && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={loadGitActivity}
                className="text-[10px] text-muted-foreground underline hover:text-foreground"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
