/**
 * MessageItem — single-message renderer for chat thread.
 *
 * Supports inline editing for user messages: when isEditing is true,
 * renders a textarea pre-filled with the message content and Save/Cancel
 * buttons. When not editing, shows a pencil icon on user messages to
 * initiate editing.
 */

import { useState } from 'react'
import type { SessionMessage } from '@/app/chat'
import { Markdown } from '@/components/Markdown'

export interface MessageItemProps {
  message: SessionMessage
  streaming?: boolean
  /** Whether this message is currently in edit mode. */
  isEditing?: boolean
  /** Called when the user clicks the edit (pencil) icon. */
  onEdit?: (messageId: string) => void
  /** Called when the user cancels editing. */
  onCancel?: () => void
  /** Called with the new text when the user commits the edit. */
  onCommit?: (newText: string) => void
}

/** Pencil (edit) icon — 16×16 SVG. */
function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block"
    >
      <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
    </svg>
  )
}

export function MessageItem({
  message,
  streaming,
  isEditing,
  onEdit,
  onCancel,
  onCommit,
}: MessageItemProps) {
  const isUser = message.role === 'user'
  const name = isUser ? 'You' : message.role === 'assistant' ? 'Assistant' : message.role

  // Local state for the edit textarea value
  const [editValue, setEditValue] = useState<string>(
    typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? ''),
  )

  // Update editValue when message content changes (e.g. after commit)
  const currentContent =
    typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? '')
  if (!isEditing && editValue !== currentContent) {
    setEditValue(currentContent)
  }

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
      data-testid={`message-${message.role}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
            : message.role === 'system'
              ? 'bg-gray-700 text-gray-200 italic'
              : 'bg-gray-800 text-gray-100'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold opacity-70 mb-1">{name}</div>
          {/* Edit button — only for user messages, not currently editing */}
          {isUser && !isEditing && onEdit && (
            <button
              onClick={() => onEdit(message.id)}
              className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity text-white/60 hover:text-white p-0.5"
              aria-label="Edit message"
              data-testid="edit-message-btn"
            >
              <PencilIcon />
            </button>
          )}
        </div>

        {isUser && isEditing ? (
          /* ── Edit mode: textarea + Save / Cancel ── */
          <div className="mt-1" data-testid="edit-message-form">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full rounded border border-blue-400/50 bg-blue-700/40 px-2 py-1 text-sm text-white placeholder-blue-300/60 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
              rows={Math.max(2, editValue.split('\n').length)}
              autoFocus
              data-testid="edit-message-textarea"
            />
            <div className="flex gap-2 mt-1.5 justify-end">
              <button
                onClick={onCancel}
                className="rounded px-2.5 py-1 text-xs bg-blue-800/60 text-blue-100 hover:bg-blue-800 transition-colors"
                data-testid="edit-cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editValue.trim() && onCommit) {
                    onCommit(editValue)
                  }
                }}
                disabled={!editValue.trim()}
                className="rounded px-2.5 py-1 text-xs bg-white text-blue-700 font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                data-testid="edit-save-btn"
              >
                Save &amp; Resend
              </button>
            </div>
          </div>
        ) : message.role === 'assistant' ? (
          /* ── Assistant: markdown renderer ── */
          <div data-testid="markdown-content">
            <Markdown content={message.content ?? ''} streaming={streaming === true} />
          </div>
        ) : (
          /* ── Default: plain text ── */
          <div className="whitespace-pre-wrap break-words text-sm">
            {typeof message.content === 'string'
              ? message.content
              : JSON.stringify(message.content)}
          </div>
        )}
      </div>
    </div>
  )
}
