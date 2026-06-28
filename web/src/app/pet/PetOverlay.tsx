/**
 * PetOverlay — floating container that positions the pet on screen.
 *
 * Combines PetCanvas (or PetEgg during hatching), PetBubble, and mood-based
 * CSS scaling. Draggable within viewport bounds.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { PetCanvas } from "./PetCanvas";
import { PetBubble } from "./PetBubble";
import { PetEgg } from "./PetEgg";
import {
  usePetStore,
  setPetPosition,
  setPetMood,
  setPetEgg,
  setPetEggProgress,
  cyclePetMood,
} from "./PetStore";
import { isFeatureEnabled } from "@/lib/feature-flags";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PetOverlayProps {
  /** Optional speech bubble text. */
  bubbleText?: string;
  /** Whether to show the speech bubble. */
  showBubble?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PetOverlay({ bubbleText, showBubble = false }: PetOverlayProps) {
  const { petActive, petMood, petPosition, petScale, petEgg, petEggProgress } =
    usePetStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // Clamp position within viewport
  const clampPosition = useCallback(
    (x: number, y: number) => {
      const margin = 64;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        x: Math.max(margin, Math.min(vw - margin, x)),
        y: Math.max(margin, Math.min(vh - margin, y)),
      };
    },
    [],
  );

  // Mouse/touch drag handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-pet-nodrag]")) return;
      setDragging(true);
      dragOffset.current = {
        x: e.clientX - petPosition.x,
        y: e.clientY - petPosition.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [petPosition],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const newPos = clampPosition(
        e.clientX - dragOffset.current.x,
        e.clientY - dragOffset.current.y,
      );
      setPetPosition(newPos);
    },
    [dragging, clampPosition],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Double-click to cycle moods (demo interaction)
  const handleDoubleClick = useCallback(() => {
    cyclePetMood();
  }, []);

  // Demo: hatch egg on click if in egg state
  const handleClick = useCallback(() => {
    if (petEgg && petEggProgress < 1) {
      setPetEggProgress(Math.min(1, petEggProgress + 0.25));
      if (petEggProgress >= 0.75) {
        setTimeout(() => {
          setPetEgg(false);
          setPetEggProgress(0);
          setPetMood("happy");
        }, 500);
      }
    }
  }, [petEgg, petEggProgress]);

  // Update position if window resizes
  useEffect(() => {
    const onResize = () => {
      const clamped = clampPosition(petPosition.x, petPosition.y);
      if (clamped.x !== petPosition.x || clamped.y !== petPosition.y) {
        setPetPosition(clamped);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [petPosition, clampPosition]);

  // Respect the pet feature flag — bail out early if disabled
  if (!isFeatureEnabled('pet')) return null;
  if (!petActive) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 select-none"
      style={{
        left: petPosition.x,
        top: petPosition.y,
        transform: `translate(-50%, -50%) scale(${petScale})`,
        transition: dragging ? "none" : "transform 0.2s ease",
        cursor: dragging ? "grabbing" : "grab",
        filter: "drop-shadow(0 4px 12px rgba(124, 58, 237, 0.25))",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Pet mascot"
      data-pet-overlay
    >
      <div className="relative">
        {/* Speech bubble */}
        {showBubble && bubbleText && (
          <PetBubble text={bubbleText} visible={showBubble} />
        )}

        {/* Pet or Egg */}
        {petEgg ? (
          <PetEgg progress={petEggProgress} />
        ) : (
          <PetCanvas mood={petMood} />
        )}

        {/* Mood indicator (small dot, nodrag zone) */}
        <div
          data-pet-nodrag
          className="absolute -bottom-2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
          style={{
            backgroundColor:
              petMood === "happy"
                ? "#22c55e"
                : petMood === "thinking"
                  ? "#f59e0b"
                  : petMood === "sleeping"
                    ? "#6366f1"
                    : "#a78bfa",
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default PetOverlay;
