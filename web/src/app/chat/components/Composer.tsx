/**
 * Composer — web chat input surface.
 *
 * Web replacement for the desktop composer (apps/desktop/src/app/chat/composer).
 * Replaces all window.hermesDesktop IPC calls with web-native equivalents:
 *   - window.hermesDesktop.api() → fetchJSON() from @/lib/api
 *   - window.hermesDesktop.getPathForFile() → file.name (no path in web)
 *   - triggerHaptic() → removed (cosmetic)
 *
 * Features:
 *   - Contenteditable rich editor with formatting toolbar (B, I, code, link)
 *   - Keyboard shortcuts: Ctrl+B (bold), Ctrl+I (italic), Ctrl+` (inline code)
 *   - Enter to submit (extracts plain innerText), Shift+Enter for newline
 *   - Send button (disabled when empty)
 *   - Drag-and-drop file upload (POST /api/files/upload)
 *   - Attachment preview chips with remove button
 *   - Voice controls toggle (VoiceControls sub-component)
 *   - Submit via POST /api/sessions/{id}/messages
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useGateway } from '../lib/gateway'
import { api, fetchJSON } from '@/lib/api'
import { VoiceControls } from './VoiceControls'
import { ErrorBoundary } from './ErrorBoundary'
import { isFeatureEnabled } from '@/lib/feature-flags'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComposerAttachment {
  /** Unique ID for this attachment. */
  id: string
  /** File name. */
  name: string
  /** MIME type. */
  mimeType: string
  /** Size in bytes. */
  size: number
  /** Server-side reference returned from the upload endpoint. */
  ref?: string
  /** Object URL for preview (images). */
  previewUrl?: string
}

export interface ComposerProps {
  /** Session to send messages to. */
  sessionId: string
  /** Optional gateway RPC client (dependency injection). */
  gateway?: ReturnType<typeof useGateway>
  /** Called after a message is successfully sent. */
  onSend?: (text: string, attachments: ComposerAttachment[]) => void
  /** External text to inject into the editor (e.g. from suggestion chips). */
  initialText?: string
  /** Callback after initialText has been injected into the editor. */
  onTextInjected?: () => void
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function execCmd(command: string, value?: string) {
  document.execCommand(command, false, value)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Composer({ sessionId, gateway: injectedGateway, onSend, initialText, onTextInjected }: ComposerProps) {
  const defaultGateway = useGateway()
  const gateway = injectedGateway ?? defaultGateway

  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showVoice, setShowVoice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editorText, setEditorText] = useState('')

  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // ---------------------------------------------------------------------------
  // Initial text injection (e.g. from WelcomeScreen suggestion chips)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (initialText && editorRef.current) {
      editorRef.current.innerText = initialText
      setEditorText(initialText)
      editorRef.current.focus()
      // Move caret to end
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(editorRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
      onTextInjected?.()
    }
  }, [initialText, onTextInjected])

  // ---------------------------------------------------------------------------
  // Attachment helpers
  // ---------------------------------------------------------------------------

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return

    // Optimistically add placeholder chips.
    const placeholders: ComposerAttachment[] = arr.map((f) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      mimeType: f.type || 'application/octet-stream',
      size: f.size,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }))
    setAttachments((prev) => [...prev, ...placeholders])

    // Upload each file.
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i]
      const placeholder = placeholders[i]
      try {
        const form = new FormData()
        form.append('file', file, file.name)
        const res = await api.uploadFile(`sessions/${sessionId}/${file.name}`, file)
        // Update the placeholder with the server ref.
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === placeholder.id
              ? { ...a, ref: res.path ?? placeholder.id }
              : a,
          ),
        )
      } catch (err) {
        setError(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}`)
        // Remove the failed placeholder.
        setAttachments((prev) => prev.filter((a) => a.id !== placeholder.id))
      }
    }
  }, [sessionId])

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id)
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl)
      return prev.filter((a) => a.id !== id)
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Drag-and-drop
  // ---------------------------------------------------------------------------

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        void addFiles(e.dataTransfer.files)
      }
    },
    [addFiles],
  )

  // ---------------------------------------------------------------------------
  // Editor helpers
  // ---------------------------------------------------------------------------

  const getEditorText = useCallback((): string => {
    return editorText
  }, [editorText])

  const clearEditor = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = ''
    }
    setEditorText('')
  }, [])

  // ---------------------------------------------------------------------------
  // Formatting toolbar actions
  // ---------------------------------------------------------------------------

  const handleBold = useCallback(() => {
    execCmd('bold')
    editorRef.current?.focus()
  }, [])

  const handleItalic = useCallback(() => {
    execCmd('italic')
    editorRef.current?.focus()
  }, [])

  const handleCode = useCallback(() => {
    execCmd('formatBlock', 'pre')
    // If formatBlock didn't wrap it, fall back to inline code
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      const parent = range.commonAncestorContainer.parentElement
      if (parent && parent.tagName !== 'PRE') {
        execCmd('formatBlock', 'p')
        execCmd('insertHTML', '<code>')
      }
    }
    editorRef.current?.focus()
  }, [])

  const handleLink = useCallback(() => {
    const url = window.prompt('Enter URL:')
    if (url) {
      execCmd('createLink', url)
    }
    editorRef.current?.focus()
  }, [])

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    const trimmed = getEditorText().trim()
    if (!trimmed && attachments.length === 0) return
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    const payload = {
      text: trimmed,
      attachments: attachments.map((a) => ({
        name: a.name,
        mime_type: a.mimeType,
        size: a.size,
        ref: a.ref,
      })),
    }

    try {
      // Primary path: REST endpoint.
      await fetchJSON(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      // Side-effect: gateway RPC for real-time notification.
      await gateway.request('prompt.submit', {
        session_id: sessionId,
        text: trimmed,
      })
      clearEditor()
      setAttachments([])
      onSend?.(trimmed, attachments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.')
    } finally {
      setIsSubmitting(false)
    }
  }, [getEditorText, attachments, isSubmitting, sessionId, gateway, onSend, clearEditor])

  // ---------------------------------------------------------------------------
  // Editor event handlers
  // ---------------------------------------------------------------------------

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') {
          e.preventDefault()
          execCmd('bold')
          return
        }
        if (e.key === 'i') {
          e.preventDefault()
          execCmd('italic')
          return
        }
        if (e.key === '`') {
          e.preventDefault()
          execCmd('formatBlock', 'pre')
          return
        }
      }

      // Enter to submit, Shift+Enter for newline
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleEditorInput = useCallback(() => {
    setEditorText(editorRef.current?.innerText ?? '')
  }, [])

  // Paste: strip HTML, insert as plain text
  const handleEditorPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const plainText = e.clipboardData.getData('text/plain')
    if (plainText) {
      execCmd('insertText', plainText)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Voice transcript handler
  // ---------------------------------------------------------------------------

  const handleTranscript = useCallback((transcriptText: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    if (editor.innerText.trim().length > 0) {
      execCmd('insertText', ` ${transcriptText}`)
    } else {
      execCmd('insertText', transcriptText)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // File picker trigger
  // ---------------------------------------------------------------------------

  const handlePickFiles = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        void addFiles(e.target.files)
        e.target.value = '' // Reset so the same file can be re-selected.
      }
    },
    [addFiles],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const canSubmit = !isSubmitting && (getEditorText().trim().length > 0 || attachments.length > 0)

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border ${
        isDragging ? 'border-blue-500 bg-blue-500/5' : 'border-border bg-background-base'
      } p-3 transition-colors relative`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay hint */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/10">
          <span className="text-sm font-medium text-blue-300">Drop files to attach</span>
        </div>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              {att.previewUrl && (
                <img
                  src={att.previewUrl}
                  alt={att.name}
                  className="h-6 w-6 rounded object-cover"
                />
              )}
              <span className="max-w-[120px] truncate" title={att.name}>
                {att.name}
              </span>
              <span className="text-muted-foreground">({(att.size / 1024).toFixed(1)} KB)</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="ml-1 text-muted-foreground hover:text-red-400 transition-colors"
                aria-label={`Remove ${att.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formatting toolbar */}
      <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleBold}
          disabled={isSubmitting}
          className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-muted-foreground hover:bg-background/80 hover:text-foreground transition-colors disabled:opacity-50"
          title="Bold (Ctrl+B)"
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleItalic}
          disabled={isSubmitting}
          className="flex h-7 w-7 items-center justify-center rounded text-sm italic text-muted-foreground hover:bg-background/80 hover:text-foreground transition-colors disabled:opacity-50"
          title="Italic (Ctrl+I)"
          aria-label="Italic"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCode}
          disabled={isSubmitting}
          className="flex h-7 w-7 items-center justify-center rounded text-xs font-mono text-muted-foreground hover:bg-background/80 hover:text-foreground transition-colors disabled:opacity-50"
          title="Code (Ctrl+`)"
          aria-label="Code"
        >
          {'</>'}
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleLink}
          disabled={isSubmitting}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-background/80 hover:text-foreground transition-colors disabled:opacity-50"
          title="Insert link"
          aria-label="Insert link"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
      </div>

      {/* Contenteditable editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-testid="composer-input"
        role="textbox"
        aria-multiline="true"
        onKeyDown={handleEditorKeyDown}
        onInput={handleEditorInput}
        onPaste={handleEditorPaste}
        className="min-h-[60px] max-h-[200px] overflow-y-auto rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
        style={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
        }}
      />

      {/* Controls row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
          {/* Attach files button */}
          <button
            type="button"
            onClick={handlePickFiles}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-background/80 hover:text-foreground transition-colors disabled:opacity-50"
            title="Attach files"
            aria-label="Attach files"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Voice controls toggle — hidden when voice feature is disabled */}
          {isFeatureEnabled('voice') && (
            <>
              <button
                type="button"
                onClick={() => setShowVoice((v) => !v)}
                className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                  showVoice
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                    : 'border-border bg-background text-muted-foreground hover:bg-background/80 hover:text-foreground'
                }`}
                title={showVoice ? 'Hide voice controls' : 'Show voice controls'}
                aria-label="Toggle voice controls"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
                  <path d="M19 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V20H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.08A7 7 0 0 0 19 11z" />
                </svg>
              </button>

              {/* Voice controls panel */}
              {showVoice && (
                <VoiceControls sessionId={sessionId} onTranscript={handleTranscript} />
              )}
            </>
          )}
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Sending…' : 'Send'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error boundary wrapper
// ---------------------------------------------------------------------------

export function ComposerErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary label="Composer">
      {children}
    </ErrorBoundary>
  )
}
