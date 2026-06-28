/**
 * Local type definitions for the chat module.
 *
 * These types are defined locally instead of importing from @hermes/shared
 * because the Docker build context does not resolve the @hermes/shared
 * TypeScript path alias. The types match the canonical definitions in
 * apps/shared/src/types/.
 */

// ---------------------------------------------------------------------------
// GatewayEvent + GatewayEventName
// ---------------------------------------------------------------------------

export type GatewayEventName =
  | 'message.start'
  | 'message.delta'
  | 'message.complete'
  | 'tool.start'
  | 'tool.progress'
  | 'tool.complete'
  | 'error'
  | 'approval.request'
  | 'approval.respond'
  | 'clarify.request'
  | 'clarify.respond'
  | 'sudo.request'
  | 'sudo.respond'
  | 'secret.request'
  | 'secret.respond'

export interface GatewayEvent {
  type: GatewayEventName
  payload?: unknown
  session_id?: string
}

// ---------------------------------------------------------------------------
// SessionMessage
// ---------------------------------------------------------------------------

export interface SessionMessage {
  codex_reasoning_items?: unknown
  content: unknown
  context?: unknown
  name?: string
  reasoning?: null | string
  reasoning_content?: null | string
  reasoning_details?: unknown
  role: 'assistant' | 'system' | 'tool' | 'user'
  text?: unknown
  timestamp?: number
  tool_call_id?: null | string
  tool_calls?: unknown
  tool_name?: string
}

// ---------------------------------------------------------------------------
// SkillInfo
// ---------------------------------------------------------------------------

export interface SkillInfo {
  category: string
  description: string
  enabled: boolean
  name: string
  slug: string
}

// ---------------------------------------------------------------------------
// ToolsetConfig
// ---------------------------------------------------------------------------

export interface ToolsetConfig {
  name: string
  has_category: boolean
  providers: unknown[]
}

// ---------------------------------------------------------------------------
// SessionInfo (web-specific superset)
// ---------------------------------------------------------------------------

export type { SessionInfo } from '@/lib/api'
