import type { CSSProperties } from "react";
import { ltmOnboardingSpriteUrl, type LtmOnboardingSprite } from "./assets";

// Ongoing work loops; a single gesture plays once and holds its last frame (user, 2026-11-03). The `-small` and
// `-mini` strips move like the strip they shrink.
const LOOPS: Record<string, { seconds: number; rest?: number }> = {
  "activity-log": { seconds: 3.2, rest: 2 },
  "archive-working": { seconds: 0.8 },
  "graph-model": { seconds: 3.2, rest: 2 },
  "headstart-ladder": { seconds: 3.2 },
  "reading-tape": { seconds: 3.2 },
  "vault-browse": { seconds: 3.2 },
  "vault-idle": { seconds: 3.2 },
};
const PLAY_ONCE_SECONDS = 2.4;

// The one place for the motion rules. A sprite with no chosen frame animates; with reduced motion it holds
// its rest frame instead (frame 1 for a loop, the last frame for a play-once strip).
const SPRITE_CSS = `
[data-ltm-sprite-motion] {
  background-position: calc(var(--ltm-sprite-width) * var(--ltm-sprite-rest) * -1) 0;
}
@keyframes ltm-sprite-loop {
  from { background-position: 0 0; }
  to { background-position: calc(var(--ltm-sprite-width) * -4) 0; }
}
@keyframes ltm-sprite-once {
  from { background-position: 0 0; }
  to { background-position: calc(var(--ltm-sprite-width) * -3) 0; }
}
@media (prefers-reduced-motion: no-preference) {
  [data-ltm-sprite-motion="loop"] { animation: ltm-sprite-loop var(--ltm-sprite-seconds) steps(4) infinite; }
  [data-ltm-sprite-motion="once"] { animation: ltm-sprite-once var(--ltm-sprite-seconds) steps(4, jump-none) forwards; }
}
`;

/**
 * One archivist strip (four 128x192 frames side by side, 64x96 for a `-small` strip, 40x40 for the `-mini`
 * chip icon), drawn at 1x so the pixel art stays sharp. Without `frame` the strip plays; a chosen `frame` is a
 * still (the mode picker shows the mode being hovered).
 */
export function SetupSprite({
  sprite,
  frame,
  packageVersion,
}: {
  sprite: LtmOnboardingSprite;
  frame?: 0 | 1 | 2 | 3;
  packageVersion?: string | null;
}) {
  const [width, height] = sprite.endsWith("-small") ? [64, 96] : sprite.endsWith("-mini") ? [40, 40] : [128, 192];
  const loop = LOOPS[sprite.replace(/-(small|mini)$/, "")];
  const motion = frame !== undefined ? null : loop ? "loop" : sprite === "archivist-modes" ? null : "once";
  return (
    <span
      aria-hidden="true"
      data-ltm-setup-sprite={sprite}
      data-ltm-setup-sprite-frame={frame ?? (motion === "once" ? 3 : (loop?.rest ?? 0))}
      data-ltm-sprite-motion={motion ?? undefined}
      className="block shrink-0"
      style={
        {
          width: `${width}px`,
          height: `${height}px`,
          backgroundImage: `url("${ltmOnboardingSpriteUrl(sprite, packageVersion)}")`,
          backgroundSize: `${width * 4}px ${height}px`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          ...(motion
            ? {
                "--ltm-sprite-width": `${width}px`,
                "--ltm-sprite-seconds": `${loop?.seconds ?? PLAY_ONCE_SECONDS}s`,
                "--ltm-sprite-rest": motion === "once" ? 3 : (loop?.rest ?? 0),
              }
            : { backgroundPosition: `${-width * (frame ?? 0)}px 0` }),
        } as CSSProperties
      }
    >
      {motion ? <style>{SPRITE_CSS}</style> : null}
    </span>
  );
}
