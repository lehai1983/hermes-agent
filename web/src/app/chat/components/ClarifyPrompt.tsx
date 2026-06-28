/**
 * ClarifyPrompt — free-text question with optional predefined choices.
 */

import { HelpCircle } from 'lucide-react'
import type { ClarifyRequest } from '../lib/useApprovalEvents'

export function ClarifyPrompt({
  request,
  onRespond,
}: {
  request: ClarifyRequest
  onRespond: (answer: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-2xl">
        <div className="flex items-center gap-2 text-primary mb-3">
          <HelpCircle className="h-5 w-5" />
          <h3 className="text-sm font-semibold text-foreground">Clarification Needed</h3>
        </div>

        <p className="text-sm text-foreground mb-3">{request.question}</p>

        {request.choices.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {request.choices.map((choice) => (
              <button
                key={choice}
                onClick={() => onRespond(choice)}
                className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground hover:bg-muted hover:border-primary/50 transition-colors text-left"
              >
                {choice}
              </button>
            ))}
          </div>
        )}

        {/* Free-text fallback — allows user to type any answer */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = e.target as HTMLFormElement
            const input = form.elements.namedItem('answer') as HTMLInputElement
            if (input.value.trim()) onRespond(input.value.trim())
          }}
          className="flex gap-2"
        >
          <input
            name="answer"
            placeholder="Or type your answer..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  )
}
