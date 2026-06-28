/**
 * Pet module — web mascot system (TASK-301 MVP).
 *
 * Exposes the animated pet overlay, its store, and sub-components.
 * Consumers import from `@/app/pet`.
 */

export { PetOverlay } from "./PetOverlay";
export type { PetOverlayProps } from "./PetOverlay";

export { PetCanvas } from "./PetCanvas";
export type { PetCanvasProps } from "./PetCanvas";

export { PetBubble } from "./PetBubble";
export type { PetBubbleProps } from "./PetBubble";

export { PetEgg } from "./PetEgg";
export type { PetEggProps } from "./PetEgg";

export {
  usePetStore,
  setPetActive,
  setPetMood,
  setPetPosition,
  setPetScale,
  setPetEgg,
  setPetEggProgress,
  resetPet,
  cyclePetMood,
  isPetActive,
} from "./PetStore";
export type { PetMood, PetState } from "./PetStore";
