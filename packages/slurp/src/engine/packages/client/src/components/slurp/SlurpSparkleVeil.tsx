import { useState, type CSSProperties } from "react";

type SparkleStyle = CSSProperties & Record<`--slurp-spark-${string}`, string>;

type SparkParticle = {
  left: string;
  top: string;
  moveX: string;
  moveY: string;
  moveTime: string;
  twinkleTime: string;
  scale: string;
  delay: string;
};

function buildParticles(count: number): SparkParticle[] {
  return Array.from({ length: count }, () => {
    const moveX = (Math.random() - 0.5) * 28;
    const moveY = (Math.random() - 0.5) * 22;
    return {
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      moveX: `${moveX.toFixed(2)}px`,
      moveY: `${moveY.toFixed(2)}px`,
      moveTime: `${14 + Math.random() * 18}s`,
      twinkleTime: `${0.8 + Math.random() * 1.2}s`,
      scale: `${0.55 + Math.random() * 0.9}`,
      delay: `${Math.random() * -6}s`,
    };
  });
}

export function SlurpSparkleVeil({ className = "" }: { className?: string }) {
  const [particles] = useState(() => buildParticles(56));

  return (
    <>
      <span className={`slurp-sparkle-veil pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
        {particles.map((particle, index) => (
          <span
            key={index}
            className="slurp-sparkle-particle"
            style={
              {
                left: particle.left,
                top: particle.top,
                "--slurp-spark-move-x": particle.moveX,
                "--slurp-spark-move-y": particle.moveY,
                "--slurp-spark-move-time": particle.moveTime,
                "--slurp-spark-twinkle-time": particle.twinkleTime,
                "--slurp-spark-scale": particle.scale,
                animationDelay: particle.delay,
              } as SparkleStyle
            }
          />
        ))}
      </span>
      <style>{`
        @keyframes slurp-sparkle-drift {
          from { transform: translate3d(0, 0, 0) scale(var(--slurp-spark-scale)); }
          to { transform: translate3d(var(--slurp-spark-move-x), var(--slurp-spark-move-y), 0) scale(var(--slurp-spark-scale)); }
        }
        @keyframes slurp-sparkle-twinkle {
          from { opacity: 0.18; }
          to { opacity: 0.92; }
        }
        .slurp-sparkle-veil {
          overflow: hidden;
        }
        .slurp-sparkle-particle {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 999px;
          background: rgb(255 255 255 / 82%);
          box-shadow: 0 0 8px rgb(255 255 255 / 48%);
          animation:
            slurp-sparkle-drift var(--slurp-spark-move-time) linear infinite alternate,
            slurp-sparkle-twinkle var(--slurp-spark-twinkle-time) ease-in-out infinite alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .slurp-sparkle-particle {
            animation: slurp-sparkle-twinkle 2.4s ease-in-out infinite alternate;
          }
        }
      `}</style>
    </>
  );
}
