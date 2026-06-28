/**
 * PetBubble — speech bubble overlay for the pet mascot.
 *
 * Renders a rounded tooltip-style bubble positioned above the pet.
 * Auto-fades after `duration` ms (default 3s) unless `visible` is false.
 */

import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PetBubbleProps {
  /** Text to display in the bubble. */
  text: string;
  /** Whether the bubble is currently visible. */
  visible?: boolean;
  /** Time in ms before the bubble auto-hides (0 = never auto-hide). */
  duration?: number;
  /** Optional className for positioning overrides. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PetBubble({
  text,
  visible = true,
  duration = 3000,
  className = "",
}: PetBubbleProps) {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    setShow(visible);
  }, [visible, text]);

  useEffect(() => {
    if (!show || duration <= 0) return;

    const timer = setTimeout(() => setShow(false), duration);
    return () => clearTimeout(timer);
  }, [show, duration]);

  if (!show) return null;

  return (
    <div
      className={`pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 ${className}`}
      role="tooltip"
    >
      <div className="relative whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-violet-900 shadow-lg ring-1 ring-violet-200">
        {text}
        {/* Speech bubble tail */}
        <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white ring-1 ring-violet-200" />
      </div>
    </div>
  );
}

export default PetBubble;
