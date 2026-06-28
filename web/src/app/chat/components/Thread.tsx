/**
 * Thread — core web chat surface.
 *
 * Lifted and adapted from desktop Thread.tsx for the web frontend.
 * Replaces all window.hermesDesktop IPC calls with web-native equivalents:
 *   - window.hermesDesktop.api() → fetch() via gateway REST
 *   - window.hermesDesktop.writeFile → not needed (user-initiated download)
 *   - Haptic feedback → removed (cosmetic, mobile-only)
 *
 * MVP Phase 1 scope:
 *   - Message list with delta → complete flow
 *   - Tool call cards
 *   - Error display with retry/clear
 *   - Simple greeting banner (no skin engine)
 *   - Composer input for new messages
 *
 * Props: { sessionId, sessionKey?, cwd? }
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useGateway } from '../lib/gateway'
import { useEventStream } from '../lib/sse'
import type { GatewayEvent, SessionMessage } from '@/app/chat'
import { api } from '@/lib/api'
import { MessageItem } from './MessageItem'
import { ToolCallCard } from './ToolCallCard'
import { ErrorBoundary } from './ErrorBoundary'
import { VoiceControls } from './VoiceControls'
import { trackMessageSent, trackToolCalled, trackError } from '../lib/analytics'
import { isFeatureEnabled } from '@/lib/feature-flags'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThreadProps {
  /** Session to display / interact with. */
  sessionId: string
  /** Optional encryption key (for future E2E support). */
  sessionKey?: string
  /** Optional working directory hint for new prompts. */
  cwd?: string | null
  /** Optional override for the gateway RPC client (dependency injection). */
  gateway?: ReturnType<typeof useGateway>
}

/** Internal representation of a chat message in the thread. */
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
  tool_name?: string
  tool_call_id?: string
  timestamp?: number
}

/** Internal tool-execution tracking record. */
interface ToolRecord {
  id: string
  name: string
  status: 'running' | 'success' | 'error'
  input?: string
  output?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ThreadInner({ sessionId, sessionKey: _sessionKey, cwd, gateway: injectedGateway }: ThreadProps) {
  // Gateway — injected or default hook
  const defaultGateway = useGateway()
  const gateway = injectedGateway ?? defaultGateway

  // Event stream — subscribe to real-time events for this session
  const { events, status: streamStatus, error: streamError } = useEventStream(sessionId, {
    autoConnect: true,
  })

  // Local state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [tools, setTools] = useState<Record<string, ToolRecord>>({})
  const [error, setError] = useState<string | null>(null)
  const [greeting, setGreeting] = useState<string>('Chat')
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)

  // Refs for stable identity
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const toolsRef = useRef(tools)
  toolsRef.current = tools

  // ---------------------------------------------------------------------------
  // Load historical messages on session mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    setMessages([])
    setTools({})
    setError(null)

    if (!sessionId) return

    // Fetch historical messages via REST (web equivalent of desktop IPC)
    api.getSessionMessages(sessionId)
      .then((raw) => {
        if (cancelled) return
        const res = raw as unknown as { messages: SessionMessage[] }
        const history: ChatMessage[] = res.messages.map((msg: SessionMessage, idx: number) => ({
          id: `${sessionId}-hist-${idx}`,
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? ''),
          tool_calls: msg.tool_calls as ChatMessage['tool_calls'],
          tool_name: msg.tool_name,
          tool_call_id: msg.tool_call_id ?? undefined,
          timestamp: msg.timestamp,
        }))
        setMessages(history)
      })
      .catch((err) => {
        if (!cancelled) console.error('[Thread] failed to load messages:', err)
      })

    // Gateway RPC fallback — try session.info for greeting
    gateway.request<{ name?: string; greeting?: string }>('session.info', { session_id: sessionId })
      .then((result) => {
        if (cancelled) return
        if (result.ok) {
          setGreeting(result.value.greeting ?? result.value.name ?? 'Chat')
        }
      })
      .catch(() => {
        // Non-fatal — greeting stays as default
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, gateway])

  // ---------------------------------------------------------------------------
  // Process real-time events
  // ---------------------------------------------------------------------------
  useEffect(() => {
    for (const ev of events) {
      switch (ev.type) {
        case 'message.start':
          handleMessageStart(ev)
          break
        case 'message.delta':
          handleMessageDelta(ev)
          break
        case 'message.complete':
          handleMessageComplete(ev)
          break
        case 'tool.start':
          handleToolStart(ev)
          break
        case 'tool.progress':
          handleToolProgress(ev)
          break
        case 'tool.complete':
          handleToolComplete(ev)
          break
        case 'error':
          handleError(ev)
          break
        default:
          break
      }
    }
  }, [events])

  // --- Event handlers ---

  const handleMessageStart = useCallback((ev: GatewayEvent) => {
    const payload = ev.payload as { message_id?: string; role?: string } | undefined
    if (!payload?.message_id) return

    const newMsg: ChatMessage = {
      id: payload.message_id,
      role: (payload.role as ChatMessage['role']) ?? 'assistant',
      content: '',
    }
    setMessages((prev) => [...prev, newMsg])
  }, [])

  const handleMessageDelta = useCallback((ev: GatewayEvent) => {
    const payload = ev.payload as { message_id?: string; text?: string; content?: string } | undefined
    if (!payload?.message_id) return

    const delta = payload.text ?? payload.content ?? ''
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === payload.message_id)
      if (idx === -1) {
        // Message.start may have been missed — create entry
        return [...prev, { id: payload.message_id!, role: 'assistant', content: delta }]
      }
      const updated = [...prev]
      updated[idx] = { ...updated[idx], content: updated[idx].content + delta }
      return updated
    })
  }, [])

  const handleMessageComplete = useCallback((ev: GatewayEvent) => {
    const payload = ev.payload as { message_id?: string; tool_calls?: ChatMessage['tool_calls'] } | undefined
    if (!payload?.message_id) return

    // If the message references tool_calls, attach them
    if (payload.tool_calls && payload.tool_calls.length > 0) {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.message_id ? { ...m, tool_calls: payload.tool_calls } : m)),
      )
    }
  }, [])

  const handleToolStart = useCallback((ev: GatewayEvent) => {
    const payload = ev.payload as { tool_id?: string; name?: string; input?: string } | undefined
    const toolId = payload?.tool_id
    if (!toolId) return

    trackToolCalled(payload?.name ?? 'unknown', sessionId)

    setTools((prev) => ({
      ...prev,
      [toolId]: {
        id: toolId,
        name: payload?.name ?? 'unknown',
        status: 'running',
        input: payload?.input,
      },
    }))
  }, [sessionId])

  const handleToolProgress = useCallback((ev: GatewayEvent) => {
    const payload = ev.payload as { tool_id?: string; output?: string } | undefined
    if (!payload?.tool_id) return

    setTools((prev) => {
      const existing = prev[payload.tool_id!]
      if (!existing) return prev
      return {
        ...prev,
        [payload.tool_id!]: {
          ...existing,
          output: (existing.output ?? '') + (payload.output ?? ''),
        },
      }
    })
  }, [])

  const handleToolComplete = useCallback((ev: GatewayEvent) => {
    const payload = ev.payload as { tool_id?: string; name?: string; output?: string; error?: string; success?: boolean } | undefined
    if (!payload?.tool_id) return

    setTools((prev) => {
      const existing = prev[payload.tool_id!]
      if (!existing) return prev
      return {
        ...prev,
        [payload.tool_id!]: {
          ...existing,
          name: payload.name ?? existing.name,
          status: payload.error || payload.success === false ? 'error' : 'success',
          output: payload.output ?? existing.output,
        },
      }
    })
  }, [])

  const handleError = useCallback((ev: GatewayEvent) => {
    const payload = ev.payload as { message?: string; error?: string } | undefined
    const errMsg = payload?.message ?? payload?.error ?? 'Unknown error'
    trackError(errMsg, 'Thread')
    setError(errMsg)
  }, [])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || isSubmitting) return

      setIsSubmitting(true)
      setError(null)

      // Add user message immediately to the local list
      const userMsgId = `user-${Date.now()}`
      const userMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: text,
      }
      setMessages((prev) => [...prev, userMsg])
      setInputValue('')

      // Submit via gateway RPC (web replacement for IPC prompt.submit)
      const result = await gateway.request<{ message_id?: string; ok?: boolean }>('prompt.submit', {
        session_id: sessionId,
        text,
        cwd: cwd ?? undefined,
      })

      if (result.ok) {
        trackMessageSent(sessionId)
      } else {
        setError(`Failed to send message: ${result.error}`)
      }

      setIsSubmitting(false)
    },
    [sessionId, cwd, gateway, isSubmitting],
  )

  const handleRetry = useCallback(() => {
    setError(null)
    // Reconnect the event stream
    gateway.connect().catch(console.error)
  }, [gateway])

  const handleClearError = useCallback(() => {
    setError(null)
  }, [])

  // ---------------------------------------------------------------------------
  // Inline message editing
  // ---------------------------------------------------------------------------

  /** Start editing a user message. */
  const editMessage = useCallback((messageId: string) => {
    setEditingMessageId(messageId)
  }, [])

  /** Cancel editing — restore read-only view. */
  const cancelEdit = useCallback(() => {
    setEditingMessageId(null)
  }, [])

  /** Commit an edit — update local content, resend, and clear editing state. */
  const commitEdit = useCallback(
    async (messageId: string, newText: string) => {
      if (!newText.trim()) return

      // Update the local message content
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: newText } : m)),
      )
      setEditingMessageId(null)
      setIsSubmitting(true)
      setError(null)

      // Remove any assistant messages that came after the edited user message
      // (they are now stale — the new prompt will generate fresh responses)
      setMessages((prev) => {
        const editIdx = prev.findIndex((m) => m.id === messageId)
        if (editIdx === -1) return prev
        return prev.slice(0, editIdx + 1)
      })

      // Resend the edited text as a new prompt
      const result = await gateway.request<{ message_id?: string; ok?: boolean }>('prompt.submit', {
        session_id: sessionId,
        text: newText,
        cwd: cwd ?? undefined,
      })

      if (!result.ok) {
        setError(`Failed to send message: ${result.error}`)
      }

      setIsSubmitting(false)
    },
    [sessionId, cwd, gateway],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100" data-testid="thread">
      {/* Banner / Greeting */}
      <header className="shrink-0 border-b border-gray-800 px-3 py-2 sm:px-6 sm:py-3">
        <h1 className="text-lg font-semibold text-gray-100">{greeting}</h1>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Session: {sessionId}</span>
          {streamStatus !== 'open' && (
            <span className="text-yellow-500">({streamStatus})</span>
          )}
        </div>
      </header>

      {/* Error display */}
      {(error || streamError) && (
        <div className="shrink-0 border-b border-red-900 bg-red-950/50 px-6 py-2 flex items-center justify-between">
          <span className="text-sm text-red-300">{error ?? streamError?.message}</span>
          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              className="rounded px-2 py-1 text-xs bg-red-800 text-white hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleClearError}
              className="rounded px-2 py-1 text-xs bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Message list — or welcome screen when empty */}
      <main className="flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-4 space-y-2">
        {messages.length === 0 ? (
          <WelcomeScreen onSuggest={(text) => setInputValue(text)} />
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === 'user' ? 'group' : undefined}>
                <MessageItem
                  message={msg}
                  isEditing={msg.role === 'user' && editingMessageId === msg.id}
                  onEdit={msg.role === 'user' ? (id: string) => editMessage(id) : undefined}
                  onCancel={msg.role === 'user' && editingMessageId === msg.id ? cancelEdit : undefined}
                  onCommit={
                    msg.role === 'user' && editingMessageId === msg.id
                      ? (newText: string) => commitEdit(msg.id, newText)
                      : undefined
                  }
                />
                {/* Render associated tool calls if any */}
                {msg.tool_calls?.map((tc) => {
                  const tool = tools[tc.id]
                  if (!tool) return null
                  return (
                    <ToolCallCard
                      key={tc.id}
                      name={tool.name}
                      status={tool.status}
                      input={tool.input}
                      output={tool.output}
                    />
                  )
                })}
              </div>
            ))}

            {/* Inline tool cards not attached to messages */}
            {Object.values(tools)
              .filter((t) => !messages.some((m) => m.tool_calls?.some((tc) => tc.id === t.id)))
              .map((tool) => (
                <ToolCallCard
                  key={tool.id}
                  name={tool.name}
                  status={tool.status}
                  input={tool.input}
                  output={tool.output}
                />
              ))}
          </>
        )}
      </main>

      {/* Composer input */}
      <footer className="shrink-0 border-t border-gray-800 px-3 py-2 sm:px-6 sm:py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit(inputValue)
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            disabled={isSubmitting}
          />
          {isFeatureEnabled('voice') && (
            <VoiceControls
              sessionId={sessionId}
              onTranscript={(text) => setInputValue((prev) => (prev ? prev + ' ' + text : text))}
            />
          )}
          <button
            type="submit"
            disabled={isSubmitting || !inputValue.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Sending…' : 'Send'}
          </button>
        </form>
        {cwd && (
          <div className="mt-1 text-xs text-gray-600">
            cwd: {cwd}
          </div>
        )}
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error boundary wrapper
// ---------------------------------------------------------------------------

export function ThreadErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary label="Thread">
      {children}
    </ErrorBoundary>
  )
}
