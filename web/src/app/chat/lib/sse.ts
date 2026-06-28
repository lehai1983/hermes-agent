/**
 * SSE event-stream wrapper for the chat module.
 *
 * Connects to GET /api/sessions/{id}/events via EventSource and accumulates
 * GatewayEvent objects. Used as a fallback / alternative to the WebSocket
 * gateway when the server supports SSE streaming (e.g. read-only session
 * replay, or environments where WS upgrades are blocked).
 *
 * Usage:
 *   const { events, status, error } = useEventStream('session-123')
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { HERMES_BASE_PATH } from '@/lib/api'
import type { GatewayEvent, GatewayEventName } from './types'

export type StreamStatus = 'connecting' | 'open' | 'closed'

export interface UseEventStreamOptions {
  /**
   * Auth token override. When omitted, the page-injected session token is
   * used (?token=). In gated mode a single-use ticket is fetched via
   * /api/auth/ws-ticket and passed as ?ticket=.
   */
  token?: string
  /** Use ticket-based auth (gated mode). Default: auto-detect from window.__HERMES_AUTH_REQUIRED__. */
  useTicket?: boolean
  /** Event types to subscribe to (sent as a query param if the server supports filtering). */
  eventTypes?: GatewayEventName[]
  /** Auto-connect on mount. Default: true. */
  autoConnect?: boolean
  /**
   * Reconnect on server-close. The server may close the stream after
   * sending message.complete; setting to false treats that as terminal.
   * Default: false.
   */
  reconnect?: boolean
}

export interface UseEventStreamReturn {
  /** Accumulated events, in arrival order. */
  events: GatewayEvent[]
  /** Current stream status. */
  status: StreamStatus
  /** Last error, if any. */
  error: Error | null
  /** Manually start the stream. */
  open: () => void
  /** Manually close the stream. */
  close: () => void
  /** Clear accumulated events without closing the stream. */
  clear: () => void
}

const DEFAULT_EVENT_TYPES: GatewayEventName[] = [
  'message.delta',
  'tool.start',
  'tool.progress',
  'tool.complete',
  'message.complete',
]

function buildStreamUrl(
  sessionId: string,
  options: UseEventStreamOptions,
): string {
  const params = new URLSearchParams()

  // Auth: ticket (gated) or token (loopback).
  if (options.token) {
    const paramName = options.useTicket ? 'ticket' : 'token'
    params.set(paramName, options.token)
  } else if (options.useTicket || (typeof window !== 'undefined' && window.__HERMES_AUTH_REQUIRED__)) {
    // Ticket must be fetched async — handled in the open() path. Here we
    // just signal that the hook should fetch one before connecting.
    params.set('__needs_ticket__', '1')
  } else {
    const token = typeof window !== 'undefined' ? window.__HERMES_SESSION_TOKEN__ : undefined
    if (token) params.set('token', token)
  }

  // Event-type filter (server-side support is optional — ignored if absent).
  const types = options.eventTypes ?? DEFAULT_EVENT_TYPES
  if (types.length > 0) {
    params.set('events', types.join(','))
  }

  const qs = params.toString()
  return `${HERMES_BASE_PATH}/api/sessions/${encodeURIComponent(sessionId)}/events${qs ? `?${qs}` : ''}`
}

async function fetchTicket(): Promise<string> {
  const res = await fetch(`${HERMES_BASE_PATH}/api/auth/ws-ticket`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`/api/auth/ws-ticket: HTTP ${res.status}`)
  const data = (await res.json()) as { ticket: string; ttl_seconds: number }
  return data.ticket
}

export function useEventStream(
  sessionId: string | undefined,
  options: UseEventStreamOptions = {},
): UseEventStreamReturn {
  const {
    token,
    useTicket,
    eventTypes,
    autoConnect = true,
    reconnect = false,
  } = options

  const [events, setEvents] = useState<GatewayEvent[]>([])
  const [status, setStatus] = useState<StreamStatus>('closed')
  const [error, setError] = useState<Error | null>(null)

  const esRef = useRef<EventSource | null>(null)
  const reconnectRef = useRef(reconnect)
  reconnectRef.current = reconnect

  const close = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    setStatus('closed')
  }, [])

  const clear = useCallback(() => {
    setEvents([])
  }, [])

  const open = useCallback(async () => {
    if (!sessionId) return
    // Close any existing stream first.
    esRef.current?.close()

    let url = buildStreamUrl(sessionId, { token, useTicket, eventTypes })

    // If we need a ticket, fetch it and rebuild the URL.
    if (url.includes('__needs_ticket__=1')) {
      try {
        const ticket = await fetchTicket()
        url = buildStreamUrl(sessionId, { token: ticket, useTicket: true, eventTypes })
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        setStatus('closed')
        return
      }
    }

    setError(null)
    setStatus('connecting')

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      setStatus('open')
    }

    es.onerror = () => {
      // EventSource auto-reconnects by default; if it gives up it lands here.
      if (es.readyState === EventSource.CLOSED) {
        setStatus('closed')
        if (!reconnectRef.current) {
          setError(new Error('SSE connection closed by server'))
        }
      } else {
        setError(new Error('SSE connection error'))
      }
    }

    // Default handler for unnamed "message" frames.
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as GatewayEvent
        setEvents((prev) => [...prev, parsed])
      } catch {
        // Malformed frame — skip.
      }
    }

    // Named-event handlers for the types we care about. EventSource dispatches
    // on("event.name") for `event: event.name` frames.
    const types = eventTypes ?? DEFAULT_EVENT_TYPES
    for (const type of types) {
      es.addEventListener(type, (ev) => {
        try {
          const parsed = JSON.parse((ev as MessageEvent).data) as GatewayEvent
          setEvents((prev) => [...prev, parsed])
        } catch {
          // skip
        }
      })
    }
  }, [sessionId, token, useTicket, eventTypes])

  useEffect(() => {
    if (autoConnect && sessionId) {
      open()
    }
    return () => {
      esRef.current?.close()
      esRef.current = null
    }
  }, [sessionId, autoConnect, open])

  return { events, status, error, open, close, clear }
}

declare global {
  interface Window {
    __HERMES_SESSION_TOKEN__?: string
    __HERMES_AUTH_REQUIRED__?: boolean
  }
}
