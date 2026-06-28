/**
 * PreviewPane — renders content in multiple modes:
 *   - html  → sandboxed <iframe>
 *   - md    → <pre> with monospace formatting
 *   - csv   → parsed into an HTML <table>
 *   - text  → <pre> with monospace
 *
 * A URL/path input field at the top accepts:
 *   - Local file paths (resolved via /api/fs/read-text)
 *   - Direct URLs (fetched via the browser's fetch — subject to CORS)
 *
 * Content can also be pasted directly for quick previews.
 */

import { HERMES_BASE_PATH } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";

export interface PreviewPaneProps {
  sessionId: string;
}

type PreviewMode = "html" | "md" | "csv" | "text";

interface PreviewState {
  content: string;
  mode: PreviewMode;
  source: string;
}

/** Pick a preview mode from a URL's path + optional MIME hint. */
function modeFromSource(source: string, mime?: string): PreviewMode {
  const lower = source.toLowerCase();
  if (mime?.includes("text/html") || lower.endsWith(".html") || lower.endsWith(".htm")) {
    return "html";
  }
  if (mime?.includes("text/csv") || lower.endsWith(".csv")) {
    return "csv";
  }
  if (
    mime?.includes("text/markdown") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown")
  ) {
    return "md";
  }
  return "text";
}

/** Parse a CSV string into rows of cells (handles simple quoted fields). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function PreviewPane({ sessionId: _sessionId }: PreviewPaneProps) {
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFromUrl = useCallback(async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    try {
      let text: string;
      let mime: string | undefined;

      // Absolute URL (http/https) — try direct fetch with CORS.
      if (/^https?:\/\//i.test(trimmed)) {
        const res = await fetch(trimmed);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
        mime = res.headers.get("content-type") ?? undefined;
      } else {
        // Treat as local path — read via the fs endpoint.
        const res = await fetch(
          `${HERMES_BASE_PATH}/api/fs/read-text?path=${encodeURIComponent(trimmed)}`,
          { credentials: "include" },
        );
        if (!res.ok) {
          // Fall back: treat raw input as content directly
          setPreview({ content: trimmed, mode: "text", source: "(pasted)" });
          setLoading(false);
          return;
        }
        const body = await res.json();
        text = body.text;
        mime = body.mimeType;
      }

      const mode = modeFromSource(trimmed, mime);
      setPreview({ content: text, mode, source: trimmed });
    } catch (err) {
      // Final fallback: show raw input as text
      setPreview({ content: trimmed, mode: "text", source: "(raw)" });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* ── URL / path input ────────────────────────────────────────── */}
      <div className="flex shrink-0 gap-2 border-b border-border p-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void loadFromUrl(input);
          }}
          placeholder="URL, file path, or paste content…"
          className={cn(
            "flex-1 rounded border border-border bg-muted/30 px-2 py-1 text-xs",
            "text-foreground placeholder:text-muted-foreground",
            "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring",
          )}
        />
        <button
          type="button"
          onClick={() => void loadFromUrl(input)}
          disabled={loading}
          className={cn(
            "rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground",
            "hover:bg-primary/80 disabled:opacity-50",
          )}
        >
          {loading ? "…" : "Load"}
        </button>
      </div>

      {/* ── Preview body ──────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {error && (
          <div className="p-3 text-xs text-destructive">{error}</div>
        )}
        {!preview && !error && (
          <div className="p-3 text-xs text-muted-foreground">
            Enter a URL, file path, or paste content and press Load.
          </div>
        )}
        {preview && preview.mode === "html" && (
          <iframe
            srcDoc={preview.content}
            sandbox=""
            title="Preview"
            className="h-full w-full border-0 bg-white"
          />
        )}
        {preview && preview.mode === "md" && (
          <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-foreground">
            {preview.content}
          </pre>
        )}
        {preview && preview.mode === "csv" && (
          <div className="overflow-auto p-2">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {parseCsv(preview.content).map((row, ri) => (
                  <tr key={ri} className={ri === 0 ? "font-semibold" : ""}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="border border-border px-2 py-1 text-foreground"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {preview && preview.mode === "text" && (
          <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-foreground">
            {preview.content}
          </pre>
        )}
      </div>
    </div>
  );
}
