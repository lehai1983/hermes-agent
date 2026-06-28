/**
 * ErrorBoundary — class-based React error boundary for chat components.
 *
 * Catches render-time errors in Thread and Composer so a crash in one
 * component does not blank the entire page. Provides a themed fallback
 * card with reload and bug-report actions.
 */

import { Component, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<
  { children: ReactNode; label: string },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; label: string }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[${this.props.label}] ErrorBoundary caught:`, error, info)
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-6 bg-gray-950 text-gray-100 min-h-[200px]">
          <div className="w-full max-w-md rounded-lg border border-red-800 bg-gray-900 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-red-400 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={this.handleReload}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                Reload
              </button>
              <a
                href="https://github.com/nousresearch/hermes-agent/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 underline hover:text-gray-200 transition-colors"
              >
                Report Bug
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Specialized wrappers
// ---------------------------------------------------------------------------

export function ThreadErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary label="Thread">
      {children}
    </ErrorBoundary>
  )
}

export function ComposerErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary label="Composer">
      {children}
    </ErrorBoundary>
  )
}
