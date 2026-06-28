/**
 * SudoPrompt — password input for elevated tool execution.
 */

import { ShieldAlert } from 'lucide-react'
import type { SudoRequest } from '../lib/useApprovalEvents'

export function SudoPrompt({
  request: _request,
  onRespond,
}: {
  request: SudoRequest
  onRespond: (password: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-2xl">
        <div className="flex items-center gap-2 text-destructive mb-3">
          <ShieldAlert className="h-5 w-5" />
          <h3 className="text-sm font-semibold text-foreground">Sudo Required</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          This tool requires elevated privileges. Enter your sudo password to proceed.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = e.target as HTMLFormElement
            const input = form.elements.namedItem('password') as HTMLInputElement
            if (input.value) onRespond(input.value)
          }}
          className="flex flex-col gap-3"
        >
          <input
            name="password"
            type="password"
            placeholder="Sudo password..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40"
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
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Run as Sudo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
