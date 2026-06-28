/**
 * git-operations.ts — REST client for read-only git operations.
 *
 * Wraps the Hermes REST endpoints that expose git metadata. All functions
 * are read-only: no push, commit, branch, or rebase. If a git-specific
 * endpoint is missing the caller falls back to session-based heuristics.
 */

import { HERMES_BASE_PATH } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────

export interface GitRootResponse {
  git_root: string | null;
  error?: string;
}

export interface GitSession {
  id: string;
  title: string | null;
  source: string | null;
  started_at: number;
  message_count: number;
  preview: string | null;
}

export interface GitActivity {
  sessions: GitSession[];
  repoPath: string | null;
}

// ── Internal helpers ─────────────────────────────────────────────────────

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${HERMES_BASE_PATH}${path}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Resolve the git root for a given working directory.
 * Returns null if the path is not inside a git repository.
 */
export async function getGitRoot(cwd: string): Promise<string | null> {
  try {
    const body = await getJson<GitRootResponse>(
      `/api/fs/git-root?path=${encodeURIComponent(cwd)}`,
    );
    return body.git_root ?? null;
  } catch {
    // Endpoint may not exist yet — callers should handle null gracefully.
    return null;
  }
}

/**
 * Fetch recent sessions that look like git-related activity.
 *
 * Heuristic: filter sessions whose title or preview mentions common git
 * keywords (commit, push, branch, merge, PR). Falls back to returning
 * the most recent sessions if no git-specific ones are found.
 */
export async function getGitSessions(limit = 10): Promise<GitActivity> {
  // Try the git-specific endpoint first; fall back to /api/sessions.
  let sessions: GitSession[] = [];
  let repoPath: string | null = null;

  try {
    const body = await getJson<{ sessions: GitSession[]; repo_path: string | null }>(
      `/api/ops/git/sessions?limit=${limit}`,
    );
    sessions = body.sessions ?? [];
    repoPath = body.repo_path ?? null;
  } catch {
    // Fallback: pull from /api/sessions and filter by git-like titles.
    try {
      const all = await getJson<{
        sessions: Array<{
          id: string;
          title: string | null;
          source: string | null;
          started_at: number;
          message_count: number;
          preview: string | null;
        }>;
      }>(`/api/sessions?limit=${Math.max(limit * 3, 30)}&order=recent`);

      const gitKeywords = /\b(commit|push|branch|merge|pull|rebase|tag|stash|checkout|amend)\b/i;
      const gitLike = all.sessions.filter(
        (s) =>
          (s.title && gitKeywords.test(s.title)) ||
          (s.preview && gitKeywords.test(s.preview)),
      );
      sessions = (gitLike.length > 0 ? gitLike : all.sessions)
        .slice(0, limit);

      // Try to get repo path from config.
      try {
        const cfg = await getJson<Record<string, unknown>>("/api/config");
        if (typeof cfg?.["auxiliary.git"] === "string") {
          repoPath = cfg["auxiliary.git"] as string;
        } else if (typeof cfg?.["git.repo_path"] === "string") {
          repoPath = cfg["git.repo_path"] as string;
        }
      } catch {
        // Config read failed — repoPath stays null.
      }
    } catch {
      // Both endpoints failed — return empty activity.
      return { sessions: [], repoPath: null };
    }
  }

  return { sessions, repoPath };
}
