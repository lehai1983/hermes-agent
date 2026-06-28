/**
 * SecretPrompt — masked input for API keys / credentials the agent needs.
 */

import { KeyRound } from 'lucide-react'
import type { SecretRequest } from '../lib/useApprovalEvents'

export function SecretPrompt({
  request,
  onRespond,
}: {
  request: SecretRequest
  onRespond: (value: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-2xl">
        <div className="flex items-center gap-2 text-amber-500 mb-3">
          <KeyRound className="h-5 w-5" />
          <h3 className="text-sm font-semibold text-foreground">Secret Required</h3>
        </div>

        <p className="text-sm text-foreground mb-1">{request.prompt}</p>
        <p className="text-xs text-muted-foreground mb-3">
          Environment variable: <code className="bg-muted/30 px-1.5 py-0.5 rounded text-xs">{request.env_var}</code>
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = e.target as HTMLFormElement
            const input = form.elements.namedItem('secret') as HTMLInputElement
            if (input.value) onRespond(input.value)
          }}
          className="flex flex-col gap-3"
        >
          <input
            name="secret"
            type="password"
            placeholder="Enter secret value..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onRespond('')}
              className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
