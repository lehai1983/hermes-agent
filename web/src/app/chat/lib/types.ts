/**
 * Local re-exports from @hermes/shared for the chat module.
 *
 * These types are the canonical shared definitions used across Web and
 * Desktop frontends. Re-exporting here gives the chat module a single
 * import surface and keeps desktop-lifted components working with
 * minimal changes.
 */

export type {
  GatewayEvent,
  GatewayEventName,
  SessionMessage,
  SkillInfo,
  ToolsetConfig,
} from '@hermes/shared'

/**
 * SessionInfo is defined locally in web/src/lib/api.ts (it carries web-specific
 * fields like parent_session_id). Import from there rather than @hermes/shared
 * to keep the web superset shape.
 */
export type { SessionInfo } from '@/lib/api'
