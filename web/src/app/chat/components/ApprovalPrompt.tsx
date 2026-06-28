/**
 * ApprovalPrompt — tool execution approval overlay.
 *
 * Allows the user to allow a command once, for the session, always, or deny.
 * Mirrors the TUI's ApprovalPrompt keyboard UI in a modal form.
 */

import { AlertTriangle } from 'lucide-react'
import type { ApprovalRequest } from '../lib/useApprovalEvents'

export function ApprovalPrompt({
  request,
  onRespond,
}: {
  request: ApprovalRequest
  onRespond: (choice: 'once' | 'session' | 'always' | 'deny') => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 text-warning mb-3">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-sm font-semibold text-foreground">Tool Approval Required</h3>
        </div>

        {/* Command (redacted by backend) */}
        <div className="rounded-md bg-muted/30 px-3 py-2.5 font-mono text-xs text-muted-foreground break-all">
          <span className="text-muted-foreground/60">$ </span>
          {request.command}
        </div>

        {request.description && (
          <p className="mt-2 text-sm text-muted-foreground">{request.description}</p>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onRespond('once')}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Allow once
          </button>
          <button
            onClick={() => onRespond('session')}
            className="flex-1 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Allow session
          </button>
          {request.allowPermanent && (
            <button
              onClick={() => onRespond('always')}
              className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Always
            </button>
          )}
          <button
            onClick={() => onRespond('deny')}
            className="flex-1 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  )
}
