/**
 * Analytics — lightweight event tracking for the web chat module.
 *
 * Tracks user interactions (messages sent, tool calls, errors) via
 * navigator.sendBeacon with a fetch fallback. No backend dependency
 * required — silently fails if the endpoint doesn't exist yet.
 */

import { isFeatureEnabled } from '@/lib/feature-flags'

export type AnalyticsEvent = {
  event: string
  timestamp: number
  properties?: Record<string, unknown>
}

/**
 * Core tracking function. Sends event data to /api/analytics.
 * Prefers sendBeacon (survives page unload), falls back to fetch with keepalive.
 * Logs to console in development for debugging.
 *
 * Respects the `analytics` feature flag — when disabled (?analytics=0),
 * events are silently dropped.
 */
export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  // Feature flag check — bail out early if analytics is disabled
  if (!isFeatureEnabled('analytics')) return

  const analyticsEvent: AnalyticsEvent = {
    event,
    timestamp: Date.now(),
    properties,
  }

  if (import.meta.env.DEV) {
    console.debug('[analytics]', analyticsEvent)
  }

  const body = JSON.stringify(analyticsEvent)

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon('/api/analytics', blob)
  } else {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Silent — analytics is best-effort
    })
  }
}

/**
 * Shorthand: track a page view.
 */
export function trackPageView(path: string): void {
  trackEvent('page_view', { path })
}

/**
 * Shorthand: track a message being sent by the user.
 */
export function trackMessageSent(sessionId: string): void {
  trackEvent('message_sent', { session_id: sessionId })
}

/**
 * Shorthand: track a tool being invoked.
 */
export function trackToolCalled(toolName: string, sessionId: string): void {
  trackEvent('tool_called', { tool_name: toolName, session_id: sessionId })
}

/**
 * Shorthand: track an error.
 */
export function trackError(error: string, component?: string): void {
  trackEvent('error', { error, component })
}
