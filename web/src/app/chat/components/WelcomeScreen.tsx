/**
 * WelcomeScreen — onboarding view shown when the chat thread is empty.
 *
 * Displays the Hermes branding, a tagline, and clickable suggestion chips
 * that pre-fill the composer input so new users know what to try first.
 */

export interface WelcomeScreenProps {
  /** Called when a suggestion chip is clicked — receives the suggestion text. */
  onSuggest: (text: string) => void
}

const SUGGESTIONS = [
  'Help me write a script',
  'Explain this concept',
  'Debug my code',
  'Summarize a document',
  'Plan a new feature',
  'Refactor this function',
]

export function WelcomeScreen({ onSuggest }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      {/* Logo / branding */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-100 sm:text-6xl">
          Hermes
        </h1>
        <p className="mt-2 text-lg text-gray-400">Your AI assistant</p>
      </div>

      {/* Suggestion chips */}
      <div className="flex max-w-2xl flex-wrap items-center justify-center gap-3">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSuggest(suggestion)}
            className="rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-blue-600 hover:bg-blue-600/10 hover:text-blue-400"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <p className="mt-10 text-xs text-gray-600">
        Type a message or click a suggestion to get started
      </p>
    </div>
  )
}
