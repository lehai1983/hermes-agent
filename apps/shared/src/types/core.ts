/**
 * Canonical type definitions shared between Web and Desktop frontends.
 *
 * AUTO-GENERATED from Phase 1 Discovery. Do not edit directly.
 * 24 types with identical field sets across both codebases.
 *
 * @hermes/shared — types/core.ts
 */

import type {
  ModelOptionProvider,
  OAuthProvider,
  SessionMessage,
  SessionSearchResult,
  ToolProvider,
} from './diverged'

// ──────────────────────────────────────────────────────────
// 24 clean shared types
// ──────────────────────────────────────────────────────────

export interface ActionStatusResponse {
  exit_code: number | null
  lines: string[]
  name: string
  pid: number | null
  running: boolean
}

export interface AnalyticsDailyEntry {
  actual_cost: number
  api_calls: number
  cache_read_tokens: number
  day: string
  estimated_cost: number
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  sessions: number
}

export interface AnalyticsModelEntry {
  api_calls: number
  estimated_cost: number
  input_tokens: number
  model: string
  output_tokens: number
  sessions: number
}

export interface AnalyticsSkillEntry {
  last_used_at: null | number
  manage_count: number
  percentage: number
  skill: string
  total_count: number
  view_count: number
}

export interface AnalyticsSkillsSummary {
  distinct_skills_used: number
  total_skill_actions: number
  total_skill_edits: number
  total_skill_loads: number
}

export interface AuxiliaryModelsResponse {
  main: { model: string; provider: string }
  tasks: AuxiliaryTaskAssignment[]
}

export interface AuxiliaryTaskAssignment {
  base_url: string
  model: string
  provider: string
  task: string
}

export interface LogsResponse {
  file: string
  lines: string[]
}

export interface MessagingPlatformUpdate {
  clear_env?: string[]
  enabled?: boolean
  env?: Record<string, string>
}

export interface MoaConfigResponse {
  default_preset: string
  active_preset: string
  presets: Record<
    string,
    {
      aggregator: MoaModelSlot
      aggregator_temperature: number
      enabled: boolean
      max_tokens: number
      reference_models: MoaModelSlot[]
      reference_temperature: number
    }
  >
  aggregator: MoaModelSlot
  aggregator_temperature: number
  enabled: boolean
  max_tokens: number
  reference_models: MoaModelSlot[]
  reference_temperature: number
}

export interface MoaModelSlot {
  provider: string
  model: string
}

export interface ModelOptionsResponse {
  model?: string
  provider?: string
  providers?: ModelOptionProvider[]
}

export interface OAuthPollResponse {
  error_message?: null | string
  expires_at?: null | number
  session_id: string
  status: 'approved' | 'denied' | 'error' | 'expired' | 'pending'
}

export interface OAuthProviderStatus {
  error?: string
  expires_at?: null | string
  has_refresh_token?: boolean
  last_refresh?: null | string
  logged_in: boolean
  source?: null | string
  source_label?: null | string
  token_preview?: null | string
}

export interface OAuthProvidersResponse {
  providers: OAuthProvider[]
}

export type OAuthStartResponse =
  | {
      auth_url: string
      expires_in: number
      flow: 'pkce'
      session_id: string
    }
  | {
      expires_in: number
      flow: 'device_code'
      poll_interval: number
      session_id: string
      user_code: string
      verification_url: string
    }
  | {
      auth_url: string
      expires_in: number
      flow: 'loopback'
      session_id: string
    }

export interface OAuthSubmitResponse {
  message?: string
  ok: boolean
  status: 'approved' | 'error'
}

export interface PlatformStatus {
  error_code?: string
  error_message?: string
  state: string
  updated_at: string
}

export interface SessionMessagesResponse {
  messages: SessionMessage[]
  session_id: string
}

export interface SessionSearchResponse {
  results: SessionSearchResult[]
}

export interface SkillInfo {
  category: string
  description: string
  enabled: boolean
  name: string
}

export interface StaleAuxAssignment {
  task: string
  provider: string
  model: string
}

export interface ToolsetConfig {
  name: string
  has_category: boolean
  providers: ToolProvider[]
  /** Name of the currently active provider, or null if none is configured. */
  active_provider: string | null
}

/** Shape of `GET /api/tools/computer-use/status`.
 *
 *  cua-driver runs on macOS, Windows, and Linux. `ready` is the single OS-aware
 *  readiness signal: on macOS both TCC grants (Accessibility + Screen
 *  Recording, which attach to cua-driver's own `com.trycua.driver` identity,
 *  not Hermes); elsewhere, driver health from `cua-driver doctor`. `null`
 *  means unknown (binary missing / probe failed). */

export interface ToolsetInfo {
  configured: boolean
  description: string
  enabled: boolean
  label: string
  name: string
  tools: string[]
}

