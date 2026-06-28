/**
 * useApprovalEvents — subscribes to tool approval / clarify / sudo / secret
 * prompt events from the gateway and exposes pending state + respond helpers.
 *
 * Each prompt is a request-id-based interaction: the server sends a *.request
 * event with a request_id, the frontend renders a modal, the user acts,
 * and the frontend calls the matching *.respond method back.
 */

import { useCallback, useEffect, useState } from 'react'
import { useGateway } from './gateway'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ApprovalRequest {
  command: string
  description: string
  allowPermanent: boolean
  request_id: string
}

export interface ClarifyRequest {
  question: string
  choices: string[]
  request_id: string
}

export interface SudoRequest {
  request_id: string
}

export interface SecretRequest {
  prompt: string
  env_var: string
  metadata?: Record<string, unknown>
  request_id: string
}

export interface ApprovalState {
  approval: ApprovalRequest | null
  clarify: ClarifyRequest | null
  sudo: SudoRequest | null
  secret: SecretRequest | null
  respondApproval: (choice: 'once' | 'session' | 'always' | 'deny', all?: boolean) => void
  respondClarify: (answer: string) => void
  respondSudo: (password: string) => void
  respondSecret: (value: string) => void
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

const EMPTY_STATE: Omit<ApprovalState, 'respondApproval' | 'respondClarify' | 'respondSudo' | 'respondSecret'> = {
  approval: null,
  clarify: null,
  sudo: null,
  secret: null,
}

export function useApprovalEvents(sessionId?: string): ApprovalState {
  const { client, request } = useGateway()
  const [state, setState] = useState(EMPTY_STATE)

  useEffect(() => {
    if (!client) return

    const unsubApproval = client.on('approval.request', (ev) => {
      const p = ev.payload as ApprovalRequest
      if (sessionId && ev.session_id !== sessionId) return
      setState((s) => ({ ...s, approval: { ...p, request_id: p.request_id } }))
    })

    const unsubClarify = client.on('clarify.request', (ev) => {
      const p = ev.payload as ClarifyRequest
      if (sessionId && ev.session_id !== sessionId) return
      setState((s) => ({ ...s, clarify: p }))
    })

    const unsubSudo = client.on('sudo.request', (ev) => {
      const p = ev.payload as SudoRequest
      if (sessionId && ev.session_id !== sessionId) return
      setState((s) => ({ ...s, sudo: p }))
    })

    const unsubSecret = client.on('secret.request', (ev) => {
      const p = ev.payload as SecretRequest
      if (sessionId && ev.session_id !== sessionId) return
      setState((s) => ({ ...s, secret: p }))
    })

    return () => {
      unsubApproval()
      unsubClarify()
      unsubSudo()
      unsubSecret()
    }
  }, [client, sessionId])

  const respondApproval = useCallback(
    (choice: 'once' | 'session' | 'always' | 'deny', all = false) => {
      void request('approval.respond', { choice, all })
      setState((s) => ({ ...s, approval: null }))
    },
    [request],
  )

  const respondClarify = useCallback(
    (answer: string) => {
      void request('clarify.respond', { answer })
      setState((s) => ({ ...s, clarify: null }))
    },
    [request],
  )

  const respondSudo = useCallback(
    (password: string) => {
      void request('sudo.respond', { password })
      setState((s) => ({ ...s, sudo: null }))
    },
    [request],
  )

  const respondSecret = useCallback(
    (value: string) => {
      void request('secret.respond', { value })
      setState((s) => ({ ...s, secret: null }))
    },
    [request],
  )

  return {
    ...state,
    respondApproval,
    respondClarify,
    respondSudo,
    respondSecret,
  }
}
