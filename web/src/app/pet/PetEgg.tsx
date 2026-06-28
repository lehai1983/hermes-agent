/**
 * PetEgg — egg hatching animation.
 *
 * Renders an animated egg that shakes and cracks as `progress` (0→1) increases.
 * At progress >= 1, the egg "hatches" (fades out).
 */

import { useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PetEggProps {
  /** Hatching progress from 0 (fresh egg) to 1 (fully hatched). */
  progress: number;
  /** Optional className for positioning. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PetEgg({ progress, className = "" }: PetEggProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 128;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2 + 10;

    function render() {
      ctx!.clearRect(0, 0, size, size);

      // Hatched — draw nothing (egg is gone)
      if (progress >= 1) {
        frameRef.current = requestAnimationFrame(render);
        return;
      }

      // Shake intensity increases with progress
      const shake = progress * 6;
      const shakeX = (Math.random() - 0.5) * shake;
      const shakeY = (Math.random() - 0.5) * shake;

      ctx!.save();
      ctx!.translate(cx + shakeX, cy + shakeY);

      // Egg shape (wider at bottom)
      ctx!.fillStyle = "#e9d5ff";
      ctx!.strokeStyle = "#7c3aed";
      ctx!.lineWidth = 2.5;
      ctx!.beginPath();
      ctx!.ellipse(0, 0, 30, 40, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.stroke();

      // Spots
      ctx!.fillStyle = "#c4b5fd";
      ctx!.beginPath();
      ctx!.arc(-10, -8, 5, 0, Math.PI * 2);
      ctx!.arc(12, 5, 4, 0, Math.PI * 2);
      ctx!.arc(-5, 14, 3, 0, Math.PI * 2);
      ctx!.fill();

      // Crack lines (appear as progress increases)
      if (progress > 0.2) {
        ctx!.strokeStyle = "#4c1d95";
        ctx!.lineWidth = 1.5;
        ctx!.lineCap = "round";

        // Main crack
        ctx!.beginPath();
        ctx!.moveTo(-5, -15);
        ctx!.lineTo(2, -5);
        ctx!.lineTo(-3, 5);
        ctx!.lineTo(3, 15);
        ctx!.stroke();

        if (progress > 0.5) {
          // Secondary crack
          ctx!.beginPath();
          ctx!.moveTo(8, -20);
          ctx!.lineTo(12, -10);
          ctx!.lineTo(10, 0);
          ctx!.stroke();
        }

        if (progress > 0.75) {
          // Tertiary crack
          ctx!.beginPath();
          ctx!.moveTo(-15, -5);
          ctx!.lineTo(-10, 5);
          ctx!.lineTo(-14, 15);
          ctx!.stroke();
        }
      }

      ctx!.restore();

      frameRef.current = requestAnimationFrame(render);
    }

    frameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [progress]);

  // Fade out as we approach hatching
  const opacity = progress >= 1 ? 0 : 1 - Math.max(0, progress - 0.8) * 5;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: 128,
        height: 128,
        opacity,
        transition: "opacity 0.3s ease",
      }}
      aria-label={`Egg — hatching ${Math.round(progress * 100)}%`}
      role="img"
    />
  );
}

export default PetEgg;
