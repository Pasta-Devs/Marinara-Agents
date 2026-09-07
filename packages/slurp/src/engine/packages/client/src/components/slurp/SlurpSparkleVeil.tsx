import type { CSSProperties } from "react";

type SparkleStyle = CSSProperties & Record<`--slurp-spark-${string}`, string>;

type SparkleMote = {
  left: string;
  top: string;
  size: string;
  moveX: string;
  moveY: string;
  duration: string;
  delay: string;
  opacity: string;
};

function seededValue(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildStaticSparkleField(): string {
  const dots = Array.from({ length: 1100 }, (_, index) => {
    const seed = index * 4;
    const x = Math.round(seededValue(seed + 1) * 640);
    const y = Math.round(seededValue(seed + 2) * 400);
    const radius = (0.25 + seededValue(seed + 3) * 0.65).toFixed(2);
    const opacity = (0.1 + seededValue(seed + 4) * 0.3).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="white" fill-opacity="${opacity}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" preserveAspectRatio="none">${dots}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function buildMotes(count: number): SparkleMote[] {
  return Array.from({ length: count }, (_, index) => {
    const seed = index * 7 + 101;
    const duration = 5.5 + seededValue(seed + 5) * 6;
    return {
      left: `${3 + seededValue(seed + 1) * 94}%`,
      top: `${3 + seededValue(seed + 2) * 94}%`,
      size: `${1.3 + seededValue(seed + 3) * 2.1}px`,
      moveX: `${((seededValue(seed + 4) - 0.5) * 16).toFixed(2)}px`,
      moveY: `${((seededValue(seed + 5) - 0.5) * 14).toFixed(2)}px`,
      duration: `${duration.toFixed(2)}s`,
      delay: `${(-seededValue(seed + 6) * duration).toFixed(2)}s`,
      opacity: `${(0.28 + seededValue(seed + 7) * 0.42).toFixed(2)}`,
    };
  });
}

const STATIC_SPARKLE_FIELD = buildStaticSparkleField();
const SPARKLE_MOTES = buildMotes(36);

export function SlurpSparkleVeil({ className = "" }: { className?: string }) {
  return (
    <span className={`slurp-sparkle-veil pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      <span className="slurp-sparkle-field" style={{ backgroundImage: STATIC_SPARKLE_FIELD }} />
      {SPARKLE_MOTES.map((mote, index) => (
        <span
          key={index}
          className="slurp-sparkle-mote"
          style={
            {
              left: mote.left,
              top: mote.top,
              "--slurp-spark-size": mote.size,
              "--slurp-spark-move-x": mote.moveX,
              "--slurp-spark-move-y": mote.moveY,
              "--slurp-spark-duration": mote.duration,
              "--slurp-spark-delay": mote.delay,
              "--slurp-spark-opacity": mote.opacity,
            } as SparkleStyle
          }
        />
      ))}
      <style>{`
        .slurp-sparkle-veil {
          contain: paint;
          isolation: isolate;
          overflow: hidden;
        }
        .slurp-sparkle-field {
          position: absolute;
          inset: 0;
          background-position: center;
          background-size: 100% 100%;
          opacity: 0.64;
        }
        .slurp-sparkle-mote {
          position: absolute;
          width: var(--slurp-spark-size);
          height: var(--slurp-spark-size);
          border-radius: 50%;
          background: rgb(255 255 255 / 82%);
          box-shadow: 0 0 5px rgb(255 255 255 / 48%);
          opacity: 0.32;
        }
        @media (prefers-reduced-motion: no-preference) {
          .slurp-sparkle-field {
            animation: slurp-sparkle-breathe 8s ease-in-out infinite alternate;
          }
          .slurp-sparkle-mote {
            animation: slurp-sparkle-mote-twinkle var(--slurp-spark-duration) ease-in-out var(--slurp-spark-delay) infinite;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .slurp-sparkle-mote {
            opacity: var(--slurp-spark-opacity);
          }
        }
        @keyframes slurp-sparkle-breathe {
          from { opacity: 0.5; }
          to { opacity: 0.78; }
        }
        @keyframes slurp-sparkle-mote-twinkle {
          0%, 100% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.45);
          }
          18% {
            opacity: calc(var(--slurp-spark-opacity) * 0.42);
          }
          32% {
            opacity: var(--slurp-spark-opacity);
            transform: translate3d(var(--slurp-spark-move-x), var(--slurp-spark-move-y), 0) scale(1);
          }
          48% {
            opacity: calc(var(--slurp-spark-opacity) * 0.2);
            transform: translate3d(var(--slurp-spark-move-x), var(--slurp-spark-move-y), 0) scale(0.72);
          }
          62% {
            opacity: 0;
            transform: translate3d(var(--slurp-spark-move-x), var(--slurp-spark-move-y), 0) scale(0.5);
          }
        }
      `}</style>
    </span>
  );
}
