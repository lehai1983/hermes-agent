/**
 * VoiceControls — microphone recording + TTS playback for the web chat.
 *
 * Web replacement for the desktop voice conversation flow:
 *   - Desktop: PCM chunks → voice.record RPC → STT text
 *   - Web:    MediaRecorder → blob → POST /api/audio/transcribe → text
 *
 * TTS: POST /api/audio/speak → audio/wav → AudioContext playback.
 */

import { useCallback, useState } from 'react'
import { useMicRecorder } from '../lib/useMicRecorder'

export interface VoiceControlsProps {
  /** Session ID for scoping transcriptions. */
  sessionId: string
  /** Optional gateway RPC client (unused in web path, kept for prop parity). */
  gateway?: unknown
  /** Called with transcribed text after a successful STT round-trip. */
  onTranscript?: (text: string) => void
}

type BusyState = 'idle' | 'recording' | 'transcribing' | 'speaking'

/**
 * Decode an audio blob and play it via AudioContext.
 * Returns a promise that resolves when playback finishes.
 */
function playAudioBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) {
      reject(new Error('Audio playback not supported in this browser.'))
      return
    }
    const ctx = new AudioCtx()
    blob
      .arrayBuffer()
      .then((buf) => ctx.decodeAudioData(buf))
      .then((audioBuffer) => {
        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(ctx.destination)
        source.onended = () => {
          void ctx.close()
          resolve()
        }
        source.start()
      })
      .catch((err) => {
        void ctx.close()
        reject(err instanceof Error ? err : new Error('Failed to decode audio.'))
      })
  })
}

export function VoiceControls({ sessionId, onTranscript }: VoiceControlsProps) {
  const { isRecording, level, error: micError, start, stop } = useMicRecorder()
  const [busy, setBusy] = useState<BusyState>('idle')
  const [statusText, setStatusText] = useState<string>('')

  const handleToggleRecord = useCallback(async () => {
    if (isRecording) {
      // Stop & transcribe.
      setBusy('transcribing')
      setStatusText('Transcribing…')
      try {
        const blob = await stop()
        if (blob) {
          const form = new FormData()
          form.append('audio', blob, 'recording.webm')
          form.append('session_id', sessionId)
          const res = await fetch('/api/audio/transcribe', {
            method: 'POST',
            body: form,
            credentials: 'include',
          })
          if (!res.ok) {
            throw new Error(`Transcription failed: HTTP ${res.status}`)
          }
          const data = (await res.json()) as { text?: string }
          if (data.text) {
            onTranscript?.(data.text)
            setStatusText('')
          } else {
            setStatusText('No speech detected.')
          }
        }
      } catch (err) {
        setStatusText(err instanceof Error ? err.message : 'Transcription failed.')
      } finally {
        setBusy('idle')
      }
    } else {
      // Start recording.
      setStatusText('')
      await start()
      if (!micError) {
        setBusy('recording')
      }
    }
  }, [isRecording, stop, start, sessionId, onTranscript, micError])

  const handleSpeak = useCallback(
    async (text: string) => {
      if (!text.trim() || busy === 'speaking') return
      setBusy('speaking')
      setStatusText('Speaking…')
      try {
        const res = await fetch('/api/audio/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, session_id: sessionId }),
          credentials: 'include',
        })
        if (!res.ok) throw new Error(`TTS failed: HTTP ${res.status}`)
        const blob = await res.blob()
        await playAudioBlob(blob)
        setStatusText('')
      } catch (err) {
        setStatusText(err instanceof Error ? err.message : 'TTS failed.')
      } finally {
        setBusy('idle')
      }
    },
    [busy, sessionId],
  )

  // Expose speak via a data attribute so parent can call it imperatively.
  void handleSpeak

  const showRecording = isRecording || busy === 'recording'

  return (
    <div className="flex items-center gap-2">
      {/* Microphone toggle button */}
      <button
        type="button"
        onClick={handleToggleRecord}
        disabled={busy === 'transcribing'}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
          showRecording
            ? 'border-red-500 bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={showRecording ? 'Stop recording' : 'Start recording'}
        title={showRecording ? 'Stop recording' : 'Start recording'}
      >
        {/* Microphone icon (simple SVG) */}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
          <path d="M19 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V20H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.08A7 7 0 0 0 19 11z" />
        </svg>
        {/* Recording pulse indicator */}
        {showRecording && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        )}
      </button>

      {/* Recording status text */}
      {showRecording && (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          Recording… {(level * 10).toFixed(0).padStart(2, '0')}
        </span>
      )}
      {busy === 'transcribing' && <span className="text-xs text-gray-400">Transcribing…</span>}
      {busy === 'speaking' && <span className="text-xs text-gray-400">Speaking…</span>}
      {statusText && <span className="text-xs text-gray-500">{statusText}</span>}
      {micError && <span className="text-xs text-red-400">{micError}</span>}
    </div>
  )
}
