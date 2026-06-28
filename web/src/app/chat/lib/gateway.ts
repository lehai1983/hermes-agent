/**
 * Gateway RPC wrapper for the chat module.
 *
 * Wraps the browser GatewayClient (WebSocket JSON-RPC) in a React hook so
 * desktop-lifted components can call into the gateway without touching
 * window.hermesDesktop or Electron APIs.
 *
 * Usage:
 *   const { client, subscribe, request } = useGateway()
 *   await subscribe('session-123', (ev) => setMessages(...))
 *   const { ok, value } = await request('prompt.submit', { session_id, text })
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GatewayClient, type GatewayEvent, type GatewayEventName } from '@/lib/gatewayClient'

/**
 * Result type for RPC calls — success carries the value, error carries a
 * human-readable message. Lets callers avoid try/catch for expected
 * failure modes (e.g. "session not found").
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

function toResult<T>(promise: Promise<T>): Promise<Result<T>> {
  return promise.then(
    (value) => ({ ok: true, value }) as Result<T>,
    (err) => ({ ok: false, error: err instanceof Error ? err.message : String(err) }) as Result<T>,
  )
}

export interface UseGatewayOptions {
  /** Auto-connect on mount. Default: true. */
  autoConnect?: boolean
  /**
   * Explicit auth token override (test-only). When omitted the client uses
   * the page-injected session token or gated-mode ticket flow.
   */
  token?: string
}

export interface UseGatewayReturn {
  /** The underlying GatewayClient instance (for advanced use). */
  client: GatewayClient
  /** Current WebSocket connection state. */
  state: 'idle' | 'connecting' | 'open' | 'closed' | 'error'
  /**
   * Subscribe to gateway events for a session. Opens the WebSocket if not
   * already connected. Returns an unsubscribe function.
   */
  subscribe: (
    sessionId: string,
    handler: (event: GatewayEvent) => void,
    eventTypes?: GatewayEventName[],
  ) => () => void
  /** Send a JSON-RPC request. Returns a Result (never throws). */
  request: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<Result<T>>
  /** Manually connect (no-op if already open/connecting). */
  connect: () => Promise<void>
  /** Close the WebSocket. */
  disconnect: () => void
}

const DEFAULT_EVENTS: GatewayEventName[] = [
  'message.delta',
  'message.complete',
  'message.start',
  'tool.start',
  'tool.progress',
  'tool.complete',
  'session.info',
  'status.update',
  'error',
]

export function useGateway(options: UseGatewayOptions = {}): UseGatewayReturn {
  const { autoConnect = true, token } = options

  // GatewayClient is a long-lived socket — keep it in a ref, not state.
  const clientRef = useRef<GatewayClient | null>(null)
  if (clientRef.current === null) {
    clientRef.current = new GatewayClient()
  }
  const client = clientRef.current

  const [state, setState] = useState<'idle' | 'connecting' | 'open' | 'closed' | 'error'>(client.state)

  // Track per-session unsubscribe fns so we can clean up on unmount.
  const unsubsRef = useRef<Set<() => void>>(new Set())

  useEffect(() => {
    const unsub = client.onState(setState)
    if (autoConnect) {
      client.connect(token).catch((err) => {
        // Surface connection errors via state; callers read `state`.
        console.error('[chat/gateway] connect failed:', err)
      })
    }
    return () => {
      unsub()
      // Unsubscribe all session listeners on unmount.
      for (const fn of unsubsRef.current) fn()
      unsubsRef.current.clear()
      client.close()
    }
  }, [client, autoConnect, token])

  const subscribe = useCallback(
    (
      sessionId: string,
      handler: (event: GatewayEvent) => void,
      eventTypes: GatewayEventName[] = DEFAULT_EVENTS,
    ): (() => void) => {
      const unsubs: Array<() => void> = []

      // Subscribe to each event type, filtering by session_id.
      for (const type of eventTypes) {
        const unsub = client.on(type, (ev) => {
          // Only dispatch events for the requested session (or broadcast
          // events with no session_id, e.g. gateway.ready).
          if (ev.session_id === undefined || ev.session_id === sessionId) {
            handler(ev)
          }
        })
        unsubs.push(unsub)
      }

      const combinedUnsub = () => {
        for (const fn of unsubs) fn()
        unsubsRef.current.delete(combinedUnsub)
      }
      unsubsRef.current.add(combinedUnsub)
      return combinedUnsub
    },
    [client],
  )

  const request = useCallback(
    <T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<Result<T>> => {
      return toResult(client.request<T>(method, params))
    },
    [client],
  )

  const connect = useCallback(async () => {
    await client.connect(token)
  }, [client, token])

  const disconnect = useCallback(() => {
    client.close()
  }, [client])

  return useMemo(
    () => ({ client, state, subscribe, request, connect, disconnect }),
    [client, state, subscribe, request, connect, disconnect],
  )
}
