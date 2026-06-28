/**
 * Diverged type definitions — referenced by clean shared types but have
 * frontend-specific field variations across Web and Desktop.
 *
 * Design decision: use the DESKTOP version as canonical superset; Web consumers
 * ignore extra fields. Web-only consumers add local extensions if needed.
 *
 * @hermes/shared — types/diverged.ts
 */

export interface ModelOptionProvider {
  is_current?: boolean
  models?: string[]
  name: string
  slug: string
  total_models?: number
  warning?: string
  authenticated?: boolean
  auth_type?: string
  key_env?: string
  is_user_defined?: boolean
  pricing?: Record<string, unknown>
  free_tier?: boolean
  unavailable_models?: string[]
  capabilities?: Record<string, unknown>
}

export interface OAuthProvider {
  cli_command: string
  disconnect_command?: null | string
  disconnect_hint?: null | string
  disconnectable?: boolean
  docs_url: string
  flow: 'device_code' | 'external' | 'loopback' | 'pkce'
  id: string
  name: string
  status: {
    error?: string
    expires_at?: null | string
    has_refresh_token?: boolean
    last_refresh?: null | string
    logged_in: boolean
    source?: null | string
    source_label?: null | string
    token_preview?: null | string
  }
}

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

export interface SessionSearchResult {
  lineage_root?: string | null
  model: string | null
  role: string | null
  session_id: string
  session_started: number | null
  snippet: string
  source: string | null
}

export interface ToolProvider {
  name: string
  badge: string
  tag: string
  env_vars: Array<{
    name: string
    description: string
    required?: boolean
    env_name?: string
    default?: string
    sensitive?: boolean
  }>
  post_setup: string | null
  requires_nous_auth: boolean
  is_active: boolean
}
