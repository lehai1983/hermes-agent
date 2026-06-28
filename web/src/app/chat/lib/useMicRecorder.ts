/**
 * useMicRecorder — Web Audio API hook for microphone recording.
 *
 * Wraps navigator.mediaDevices.getUserMedia + MediaRecorder in a React hook
 * so VoiceControls can capture audio and return a Blob for STT.
 *
 * Web replacement for the desktop use-mic-recorder hook (which uses PCM
 * chunks + voice.record RPC). The web path uses MediaRecorder → WAV/webm
 * blob → POST /api/audio/transcribe.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseMicRecorderReturn {
  /** Whether the mic is currently recording. */
  isRecording: boolean
  /** Current RMS level (0-1) for visual feedback. */
  level: number
  /** Last error, if any. */
  error: string | null
  /** Start recording. Resolves when the recorder is live. */
  start: () => Promise<void>
  /** Stop recording and return the audio Blob (or null if empty). */
  stop: () => Promise<Blob | null>
  /** Cancel recording without producing a Blob. */
  cancel: () => void
}

const MIME_PREFERENCE = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/wav',
]

function pickMimeType(): string {
  return MIME_PREFERENCE.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

function describeMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone permission denied. Allow microphone access in your browser settings.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone found. Connect a microphone and try again.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Microphone is in use by another application.'
    case 'OverconstrainedError':
      return 'Microphone constraints are not supported by your device.'
    default:
      return err instanceof Error ? err.message : 'Failed to start microphone recording.'
  }
}

export function useMicRecorder(): UseMicRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const animFrameRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const stopResolveRef = useRef<((blob: Blob | null) => void) | null>(null)

  // Tear down all resources (stream tracks, audio context, animation frame).
  const cleanup = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    setLevel(0)
    setIsRecording(false)
  }, [])

  // Stop everything on unmount.
  useEffect(() => cleanup, [cleanup])

  const start = useCallback(async () => {
    setError(null)

    if (isRecording) return

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not supported in this browser.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch (err) {
      setError(describeMicError(err))
      return
    }

    const mimeType = pickMimeType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop())
      setError(describeMicError(err))
      return
    }

    chunksRef.current = []
    streamRef.current = stream
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const chunks = chunksRef.current
      const type = recorder.mimeType || mimeType || 'audio/webm'
      chunksRef.current = []
      const resolve = stopResolveRef.current
      stopResolveRef.current = null
      cleanup()
      if (!chunks.length) {
        resolve?.(null)
        return
      }
      resolve?.(new Blob(chunks, { type }))
    }

    recorder.onerror = () => {
      const resolve = stopResolveRef.current
      stopResolveRef.current = null
      cleanup()
      setError('Recording failed due to a device error.')
      resolve?.(null)
    }

    // Start a simple RMS meter for visual feedback.
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctor) {
        const ctx = new Ctor()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        const buf = new Uint8Array(analyser.fftSize)
        const tick = () => {
          analyser.getByteTimeDomainData(buf)
          let sum = 0
          for (const v of buf) {
            const c = v - 128
            sum += c * c
          }
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) / 42))
          animFrameRef.current = requestAnimationFrame(tick)
        }
        tick()
      }
    } catch {
      // Meter is cosmetic — ignore failures.
    }

    recorder.start()
    setIsRecording(true)
  }, [isRecording, cleanup])

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise<Blob | null>((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        cleanup()
        resolve(null)
        return
      }
      stopResolveRef.current = resolve
      recorder.stop()
    })
  }, [cleanup])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    const resolve = stopResolveRef.current
    stopResolveRef.current = null
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onerror = null
      recorder.onstop = null
      recorder.stop()
    }
    cleanup()
    resolve?.(null)
  }, [cleanup])

  return { isRecording, level, error, start, stop, cancel }
}
