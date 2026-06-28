/**
 * Pet store — manages mascot visibility, mood, position, scale, and egg state.
 *
 * Uses React useState + useRef (no Zustand dependency needed for MVP).
 * Components subscribe via the usePetStore hook.
 */

import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PetMood = "idle" | "happy" | "thinking" | "sleeping";

export interface PetState {
  petActive: boolean;
  petMood: PetMood;
  petPosition: { x: number; y: number };
  petScale: number;
  petEgg: boolean;
  petEggProgress: number;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: PetState = {
  petActive: true,
  petMood: "idle",
  petPosition: { x: 80, y: 80 },
  petScale: 1,
  petEgg: false,
  petEggProgress: 0,
};

// ---------------------------------------------------------------------------
// Store (simple external store via useSyncExternalStore)
// ---------------------------------------------------------------------------

let state = { ...INITIAL_STATE };
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

function getState() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function partialUpdate(patch: Partial<PetState>) {
  state = { ...state, ...patch };
  emitChange();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePetStore(): PetState;
export function usePetStore<T>(selector: (s: PetState) => T): T;
export function usePetStore<T>(selector?: (s: PetState) => T) {
  const snap = useSyncExternalStore(subscribe, getState);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return selector ? selector(snap) : snap;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function setPetActive(active: boolean) {
  partialUpdate({ petActive: active });
}

export function setPetMood(mood: PetMood) {
  partialUpdate({ petMood: mood });
}

export function setPetPosition(position: { x: number; y: number }) {
  partialUpdate({ petPosition: position });
}

export function setPetScale(scale: number) {
  partialUpdate({ petScale: Math.max(0.5, Math.min(2.0, scale)) });
}

export function setPetEgg(egg: boolean) {
  partialUpdate({ petEgg: egg });
}

export function setPetEggProgress(progress: number) {
  partialUpdate({ petEggProgress: Math.max(0, Math.min(1, progress)) });
}

export function resetPet() {
  state = { ...INITIAL_STATE };
  emitChange();
}

// Convenience action: cycle through moods (useful for testing / demo)
const MOOD_CYCLE: PetMood[] = ["idle", "happy", "thinking", "sleeping"];

export function cyclePetMood() {
  const idx = MOOD_CYCLE.indexOf(state.petMood);
  const next = MOOD_CYCLE[(idx + 1) % MOOD_CYCLE.length];
  partialUpdate({ petMood: next });
}

// ---------------------------------------------------------------------------
// Type guard helper for external consumers
// ---------------------------------------------------------------------------

export function isPetActive(): boolean {
  return state.petActive;
}
