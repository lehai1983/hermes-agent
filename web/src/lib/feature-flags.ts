/**
 * Feature flags — URL-param-driven toggles for the web frontend.
 *
 * Parsed once from `window.location.search` on first call, then cached.
 * Supported query params:
 *
 *   ?embed=1      — hide sidebar, minimal chrome (sets voice=false, pet=false)
 *   ?debug=1      — show debug panels, verbose logging
 *   ?voice=0      — disable voice controls (default: true)
 *   ?pet=0        — disable pet overlay (default: true)
 *   ?analytics=0  — disable analytics (default: true)
 *
 * Individual flags can be combined: ?embed=1&analytics=0
 */

export type FeatureFlags = {
  /** ?embed=1 — hide sidebar, minimal chrome */
  embed: boolean
  /** ?debug=1 — show debug panels, verbose logging */
  debug: boolean
  /** ?voice=0 — disable voice controls (default: true) */
  voice: boolean
  /** ?pet=0 — disable pet overlay (default: true) */
  pet: boolean
  /** ?analytics=0 — disable analytics (default: true) */
  analytics: boolean
}

const DEFAULT_FLAGS: FeatureFlags = {
  embed: false,
  debug: false,
  voice: true,
  pet: true,
  analytics: true,
}

let cachedFlags: FeatureFlags | null = null

/**
 * Parse a single boolean from a URL search-param value.
 * "1", "true", "yes" (case-insensitive) → true
 * "0", "false", "no" (case-insensitive) → false
 * undefined / null → undefined (use default)
 */
function parseBoolParam(
  value: string | null | undefined,
): boolean | undefined {
  if (value === null || value === undefined) return undefined
  const v = value.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes') return true
  if (v === '0' || v === 'false' || v === 'no') return false
  return undefined
}

/**
 * Read feature flags from URL search params.
 * Safe to call on the server (returns defaults when no window).
 */
function readFlagsFromURL(): Partial<FeatureFlags> {
  if (typeof window === 'undefined' || !window.location?.search) {
    return {}
  }

  const params = new URLSearchParams(window.location.search)
  const partial: Partial<FeatureFlags> = {}

  const embed = parseBoolParam(params.get('embed'))
  if (embed !== undefined) partial.embed = embed

  const debug = parseBoolParam(params.get('debug'))
  if (debug !== undefined) partial.debug = debug

  const voice = parseBoolParam(params.get('voice'))
  if (voice !== undefined) partial.voice = voice

  const pet = parseBoolParam(params.get('pet'))
  if (pet !== undefined) partial.pet = pet

  const analytics = parseBoolParam(params.get('analytics'))
  if (analytics !== undefined) partial.analytics = analytics

  return partial
}

/**
 * Get the current feature flags (parsed once, then cached).
 *
 * Embed mode implicitly disables voice and pet:
 *   ?embed=1 → embed=true, voice=false, pet=false
 */
export function getFeatureFlags(): FeatureFlags {
  if (cachedFlags) return cachedFlags

  const partial = readFlagsFromURL()
  const flags: FeatureFlags = { ...DEFAULT_FLAGS, ...partial }

  // Embed mode: minimal chrome — force voice & pet off
  if (flags.embed) {
    flags.voice = false
    flags.pet = false
  }

  cachedFlags = flags
  return flags
}

/**
 * Check whether a specific feature flag is enabled.
 * Convenience wrapper around `getFeatureFlags()`.
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag]
}

/**
 * Reset the cached flags (useful for testing).
 * @internal
 */
export function __resetFeatureFlagsCache(): void {
  cachedFlags = null
}
