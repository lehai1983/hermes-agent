/**
 * PetCanvas — Canvas 2D animated mascot character.
 *
 * Draws a simple creature (circle body, oval eyes, arc mouth) and animates
 * it based on the current mood:
 *   - idle: gentle breathing / bobbing
 *   - happy: bouncing with squish
 *   - thinking: tilt + animated dots
 *   - sleeping: closed eyes + floating Zzz
 */

import { useRef, useEffect } from "react";
import type { PetMood } from "./PetStore";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_SIZE = 128;
const CENTER = CANVAS_SIZE / 2;
const BODY_RADIUS = 36;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PetCanvasProps {
  mood: PetMood;
  /** Animation speed multiplier (1 = normal). */
  speed?: number;
  /** Optional className for the <canvas> element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function drawBody(
  ctx: CanvasRenderingContext2D,
  squash: number,
  offsetY: number,
) {
  const rx = BODY_RADIUS * squash;
  const ry = BODY_RADIUS / squash;

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(CENTER, CENTER + BODY_RADIUS + 4, rx * 0.8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Body
  ctx.save();
  ctx.fillStyle = "#a78bfa";
  ctx.beginPath();
  ctx.ellipse(CENTER, CENTER + offsetY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(CENTER - 10, CENTER + offsetY - 14, 10, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  mood: PetMood,
  offsetY: number,
  blinkProgress: number,
) {
  const eyeY = CENTER + offsetY - 8;
  const leftX = CENTER - 12;
  const rightX = CENTER + 12;

  if (mood === "sleeping") {
    // Closed eyes — horizontal lines
    ctx.strokeStyle = "#4c1d95";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    [leftX, rightX].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x - 6, eyeY);
      ctx.lineTo(x + 6, eyeY);
      ctx.stroke();
    });
    return;
  }

  // Blink: when blinkProgress > 0.9, eyes are nearly shut
  const eyeHeight = blinkProgress > 0.9 ? 1 : 7;

  // Eye whites
  ctx.fillStyle = "#fff";
  [leftX, rightX].forEach((x) => {
    ctx.beginPath();
    ctx.ellipse(x, eyeY, 7, eyeHeight, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Pupils (shrink when blinking)
  const pupilScale = blinkProgress > 0.9 ? 0.2 : 1;
  ctx.fillStyle = "#1e1b4b";
  [leftX, rightX].forEach((x) => {
    ctx.beginPath();
    ctx.ellipse(x, eyeY + 1, 3.5 * pupilScale, 3.5 * pupilScale, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  mood: PetMood,
  offsetY: number,
) {
  const mouthY = CENTER + offsetY + 10;
  ctx.strokeStyle = "#4c1d95";
  ctx.fillStyle = "#4c1d95";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  switch (mood) {
    case "happy": {
      // Wide smile
      ctx.beginPath();
      ctx.arc(CENTER, mouthY - 2, 10, 0.1, Math.PI - 0.1);
      ctx.stroke();
      break;
    }
    case "thinking": {
      // Small "o" mouth
      ctx.beginPath();
      ctx.arc(CENTER + 4, mouthY, 4, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "sleeping": {
      // Small horizontal line
      ctx.beginPath();
      ctx.moveTo(CENTER - 5, mouthY);
      ctx.lineTo(CENTER + 5, mouthY);
      ctx.stroke();
      break;
    }
    case "idle":
    default: {
      // Gentle smile
      ctx.beginPath();
      ctx.arc(CENTER, mouthY, 7, 0.2, Math.PI - 0.2);
      ctx.stroke();
      break;
    }
  }
}

function drawThinkingDots(
  ctx: CanvasRenderingContext2D,
  time: number,
  offsetY: number,
) {
  const dotX = CENTER + 28;
  const dotBaseY = CENTER + offsetY - 20;
  const phases = [0, 0.33, 0.66];

  phases.forEach((phase, i) => {
    const alpha = Math.max(0, Math.sin((time + phase * Math.PI * 2)));
    const y = dotBaseY + i * 8;
    ctx.fillStyle = `rgba(76, 29, 149, ${alpha})`;
    ctx.beginPath();
    ctx.arc(dotX, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawZzz(
  ctx: CanvasRenderingContext2D,
  time: number,
  offsetY: number,
) {
  const x = CENTER + 24;
  const baseY = CENTER + offsetY - 24;

  const letters = ["z", "z", "Z"];
  letters.forEach((ch, i) => {
    const alpha = Math.max(0, Math.sin((time * 0.8 + i * 0.5)));
    const y = baseY - i * 10;
    const size = 10 + i * 3;
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillStyle = `rgba(76, 29, 149, ${alpha * 0.8})`;
    ctx.fillText(ch, x + i * 4, y);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PetCanvas({ mood, speed = 1, className }: PetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const blinkTimerRef = useRef(0);
  const blinkStateRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    ctx.scale(dpr, dpr);

    let startTime = performance.now();

    function render(now: number) {
      const elapsed = (now - startTime) / 1000 * speed;
      ctx!.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Blink logic: every ~3s, quick blink over ~150ms
      blinkTimerRef.current += 1 / 60;
      if (blinkTimerRef.current > 3) {
        blinkStateRef.current = Math.min(1, blinkStateRef.current + 0.15);
        if (blinkStateRef.current >= 1) {
          blinkStateRef.current = 0;
          blinkTimerRef.current = 0;
        }
      }

      let offsetY = 0;
      let squash = 1;

      switch (mood) {
        case "idle": {
          // Gentle breathing: sin wave
          offsetY = Math.sin(elapsed * 2) * 3;
          squash = 1 + Math.sin(elapsed * 2) * 0.03;
          break;
        }
        case "happy": {
          // Bounce: abs(sin) for periodic up-down, squish on "landing"
          const bounce = Math.abs(Math.sin(elapsed * 4));
          offsetY = -bounce * 12;
          squash = 1 + (bounce > 0.95 ? 0.15 : -bounce * 0.08);
          break;
        }
        case "thinking": {
          // Slight tilt via horizontal offset
          offsetY = Math.sin(elapsed * 1.5) * 1;
          squash = 1 + Math.sin(elapsed * 0.8) * 0.02;
          break;
        }
        case "sleeping": {
          // Very still, slight rise/fall
          offsetY = Math.sin(elapsed * 0.8) * 2;
          squash = 1 + Math.sin(elapsed * 0.8) * 0.02;
          break;
        }
      }

      drawBody(ctx!, squash, offsetY);
      drawEyes(ctx!, mood, offsetY, blinkStateRef.current);
      drawMouth(ctx!, mood, offsetY);

      if (mood === "thinking") {
        drawThinkingDots(ctx!, elapsed, offsetY);
      }
      if (mood === "sleeping") {
        drawZzz(ctx!, elapsed, offsetY);
      }

      frameRef.current = requestAnimationFrame(render);
    }

    frameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [mood, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        imageRendering: "auto",
      }}
      aria-label={`Pet mascot — ${mood}`}
      role="img"
    />
  );
}

export default PetCanvas;
