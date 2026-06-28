/**
 * ToolCallCard — minimal tool execution display for MVP chat thread.
 *
 * Shows tool name, status indicator, and truncated output.
 * Replaces desktop IPC-coupled ToolCard with a pure web component.
 */

export interface ToolCallCardProps {
  name: string
  status: 'running' | 'success' | 'error'
  output?: string
  input?: string
}

const MAX_OUTPUT_LENGTH = 500

export function ToolCallCard({ name, status, output, input }: ToolCallCardProps) {
  const truncatedOutput =
    output && output.length > MAX_OUTPUT_LENGTH
      ? output.slice(0, MAX_OUTPUT_LENGTH) + '…'
      : output

  const statusColor =
    status === 'running'
      ? 'text-yellow-400'
      : status === 'success'
        ? 'text-green-400'
        : 'text-red-400'

  const statusLabel =
    status === 'running' ? '● Running' : status === 'success' ? '✓ Done' : '✗ Error'

  return (
    <div className="my-2 rounded-md border border-gray-700 bg-gray-900 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-gray-200">{name}</span>
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {input && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">
            Input
          </summary>
          <pre className="mt-1 overflow-x-auto text-xs text-gray-400 whitespace-pre-wrap">
            {input}
          </pre>
        </details>
      )}

      {truncatedOutput && (
        <div className="mt-1">
          <div className="text-xs text-gray-500 mb-1">Output</div>
          <pre className="overflow-x-auto text-xs text-gray-300 whitespace-pre-wrap font-mono">
            {truncatedOutput}
          </pre>
        </div>
      )}
    </div>
  )
}
