import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  SAUCELING_EVOLVE_AURAS,
  SAUCELING_EVOLVE_EXTRAS,
  SAUCELING_EVOLVE_PATHS,
  type SaucelingEvolution,
  type SaucelingMood,
  type SaucelingSpeciesId,
  type SaucelingStage,
  type SaucelingUserAction,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  LIVE_VARIANTS,
  SHEET_ROWS,
  liveSheet,
  spriteStrip,
  type SaucelingSpriteStrip,
} from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import {
  ANCHORS,
  AURA_MOTION,
  MOUTH_FIXES,
  RAMPS,
  STEP_MS,
  actSteps,
  drawMoveStep,
  loadMoveArt,
  loadMoveBody,
  type MoveAct,
  type MoveArt,
  type MoveBody,
  type MoveScene,
  type MoveStrip,
} from "./move-player.js";

/** Art pixels per side of a frame; sprites draw at whole multiples of it so every art pixel stays square. */
const ART_PIXELS = 52;

/** How long a Feed, Play, Rest or Pet reaction plays; matches the sl-react-* and sl-fx-* keyframes. */
export const REACTION_MS = 1200;

/** The shared effect strip each reaction shows, and the keyframes that place it. Egg care has none: an egg
 *  only wobbles, and a Warm that hatches it plays on the hatchling with no effect. */
const EFFECTS: Partial<Record<SaucelingUserAction, Array<{ sprite: string; motion: string }>>> = {
  feed: [{ sprite: "tomato", motion: "feed" }],
  play: [
    { sprite: "sparkle", motion: "play-a" },
    { sprite: "sparkle", motion: "play-b" },
  ],
  rest: [
    { sprite: "z", motion: "rest-a" },
    { sprite: "z", motion: "rest-b" },
  ],
  pet: [{ sprite: "heart", motion: "pet" }],
};

export type SaucelingSpriteReaction = { action: SaucelingUserAction; at: number };

/** What the sprite does between care taps, set by the stage: a step of its walk, a hop, a nap or a huff. */
export type SaucelingSpritePose = "walk" | "hop" | "nap" | "huff" | null;

/** How far the move canvas reaches past the sprite's cell, in art pixels: wide on the stage, where a move travels and
 *  lights the floor around it, and close for a tile, where it plays on the spot. */
const PADS = {
  stage: { x: 176, top: 80, bottom: 24 },
  spot: { x: 48, top: 56, bottom: 8 },
};

/** A small effect over the head that the stage's director adds: a hummed note, a question, a startled bang, sleep. */
export type SaucelingSpriteCue = { kind: "note" | "question" | "bang" | "nap"; at: number };

const CUES: Record<SaucelingSpriteCue["kind"], Array<{ sprite: string; motion: string }>> = {
  note: [{ sprite: "note", motion: "cue-note" }],
  question: [{ sprite: "question", motion: "cue-question" }],
  bang: [{ sprite: "bang", motion: "cue-bang" }],
  nap: [
    { sprite: "z", motion: "nap-a" },
    { sprite: "z", motion: "nap-b" },
  ],
};

/** Rec. 709 brightness into all three channels, alpha kept. */
const TO_GREY = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";

const rampChannel = (stops: string[], channel: 0 | 1 | 2) =>
  stops.map((hex) => (parseInt(hex.slice(1 + channel * 2, 3 + channel * 2), 16) / 255).toFixed(3)).join(" ");

/** The ramps as SVG filters (`url(#sl-ramp-<path>)` in the styles), mounted once beside the styles. */
export function SaucelingRamps() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        {Object.entries(RAMPS).map(([id, stops]) => (
          <filter key={id} id={`sl-ramp-${id}`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={TO_GREY} />
            <feComponentTransfer>
              <feFuncR type="table" tableValues={rampChannel(stops, 0)} />
              <feFuncG type="table" tableValues={rampChannel(stops, 1)} />
              <feFuncB type="table" tableValues={rampChannel(stops, 2)} />
            </feComponentTransfer>
          </filter>
        ))}
      </defs>
    </svg>
  );
}

/** The reaction to play and a trigger for it; the reaction clears itself once it has played. */
export function useSpriteReaction() {
  const [reaction, setReaction] = useState<SaucelingSpriteReaction | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const play = useCallback((action: SaucelingUserAction) => {
    window.clearTimeout(timer.current);
    setReaction({ action, at: Date.now() });
    timer.current = window.setTimeout(() => setReaction(null), REACTION_MS);
  }, []);
  return [reaction, play] as const;
}

/** Silhouette size in art pixels by stage, for a found sauceling whose form is not painted yet. */
const SILHOUETTE_SIZE: Record<SaucelingStage, { w: number; h: number }> = {
  egg: { w: 22, h: 30 },
  hatchling: { w: 26, h: 32 },
  juvenile: { w: 32, h: 40 },
  adult: { w: 36, h: 46 },
  elder: { w: 36, h: 46 },
};

/** A strip as a background: a painted form's own picture, or its row of the species sheet. The frame keyframes
 *  move only the x position, so the row stays put. */
function stripStyle(
  src: string | null | undefined,
  strip: SaucelingSpriteStrip | null,
  assetUrl: (path: string) => string,
): CSSProperties | undefined {
  if (src) return { backgroundImage: `url("${src}")` };
  if (!strip) return undefined;
  return {
    backgroundImage: `url("${assetUrl(strip.path)}")`,
    backgroundSize: `300% ${SHEET_ROWS * 100}%`,
    backgroundPositionY: `${(strip.row / (SHEET_ROWS - 1)) * 100}%`,
  };
}

/** A species' living sheet over its strip: the same row in each copy, stepping through the copies. It inherits the
 *  strip's x position, so it plays the strip's frames in step. Null for a species without one. */
function liveStyle(
  species: SaucelingSpeciesId,
  strip: SaucelingSpriteStrip | null,
  assetUrl: (path: string) => string,
): CSSProperties | undefined {
  const live = strip && liveSheet(species);
  if (!live) return undefined;
  const rows = SHEET_ROWS * LIVE_VARIANTS;
  const y = (copy: number) => `${((copy * SHEET_ROWS + strip.row) / (rows - 1)) * 100}%`;
  return {
    backgroundImage: `url("${assetUrl(live.path)}")`,
    backgroundSize: `300% ${rows * 100}%`,
    "--sl-live-y0": y(0),
    "--sl-live-y1": y(LIVE_VARIANTS),
    animationDuration: `${live.ms * LIVE_VARIANTS}ms`,
    animationTimingFunction: `steps(${LIVE_VARIANTS}, end)`,
  } as CSSProperties;
}

/** The canvas a look's moves and evolution moment play on, over the sprite. It draws the sprite itself while an act
 *  plays (the sprite's own frames are hidden then) and keeps drawing the floor marks a move left until they fade. A
 *  `plain` sprite (a special hatchling, with no look) keeps its own colours and only its effects take the look's. */
function MoveCanvas({
  act,
  player,
  look,
  plain,
  stage,
  facing,
  scale,
}: {
  act: MoveAct | null;
  player: { art: MoveArt; body: MoveBody };
  look: Pick<SaucelingEvolution, "colour" | "extra">;
  plain: boolean;
  stage: Exclude<SaucelingStage, "egg">;
  facing: "left" | "right";
  scale: number;
}) {
  // The act whose marks are still fading once it has ended.
  const [tail, setTail] = useState<MoveAct | null>(null);
  const [lastAct, setLastAct] = useState(act);
  if (act !== lastAct) {
    setLastAct(act);
    setTail(act ? null : lastAct);
  }
  const shown = act ?? tail;
  const spot = shown?.kind === "move" && shown.spot;
  const pad = spot ? PADS.spot : PADS.stage;
  const width = pad.x * 2 + ART_PIXELS;
  const height = pad.top + ART_PIXELS + pad.bottom;
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<MoveScene | null>(null);
  const { colour, extra } = look;
  useLayoutEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !shown) return;
    ctx.imageSmoothingEnabled = false;
    const setup = {
      ctx,
      ...player,
      colour,
      extra,
      stage,
      dir: facing === "right" ? (1 as const) : (-1 as const),
      X: pad.x,
      Y0: pad.top,
      lit: !spot,
      plain,
    };
    if (scene.current?.ctx === ctx) Object.assign(scene.current, setup);
    else scene.current = { ...setup, marks: [], drawn: "" };
    const sc = scene.current;
    let frame = 0;
    let last = "";
    const tick = () => {
      const now = Date.now();
      const g = Math.floor(now / STEP_MS);
      // A finished act holds its last step until the stage or the tile takes it away.
      const k = act ? Math.min(actSteps(act) - 1, Math.max(0, Math.floor((now - act.at) / STEP_MS))) : 0;
      const key = `${k}|${g}`;
      if (key !== last) {
        last = key;
        if (!drawMoveStep(sc, act, k, g) && !act) return setTail(null);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [act, shown, player, colour, extra, stage, facing, pad, spot, plain]);
  if (!shown) return null;
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="sl-move-canvas"
      width={width}
      height={height}
      style={{
        left: `${-pad.x * scale}px`,
        top: `${-pad.top * scale}px`,
        width: `${width * scale}px`,
        height: `${height * scale}px`,
      }}
    />
  );
}

/** A sprite strip (base | squash | stretch, or an egg's base | lean | lean) drawn `scale` screen pixels per
 *  art pixel. It idles by mood and plays a reaction with its effect on top; `still` shows the first frame only.
 *  While it walks it shows its side view (the species' side strip, or `sideSrc` for a form) when there is one.
 *  `customSrc` swaps the strip for a painted form: a strip like the species' when `frames` is 3, or one still
 *  frame (an older form) that idles with a plain bob. `silhouette` draws a dark shape instead, for a found
 *  sauceling whose form is not painted yet; it keeps reactions and poses too. `look` draws an evolution on top of
 *  whichever picture it has: recoloured along its path's ramp, with a breathing glow, its path's aura and its extra
 *  floating over the head. `act` plays one of the look's moves or its evolution moment on a canvas, facing
 *  `facing`, or a special hatching and the moves after it on a sprite with no look, in the act's colour; `flipped` says the form's own art faces left. A species with a living sheet (a burning flame, a bubbling
 *  brew, sparks) draws its strips from that sheet instead, holding the first copy when `still`. */
export function SaucelingSprite({
  species,
  stage,
  mood,
  assetUrl,
  alt,
  scale,
  still = false,
  reaction = null,
  pose = null,
  cue = null,
  customSrc = null,
  sideSrc = null,
  frames = 3,
  silhouette = false,
  look = null,
  act = null,
  facing = "right",
  flipped = false,
}: {
  species: SaucelingSpeciesId;
  stage: SaucelingStage;
  mood: SaucelingMood;
  assetUrl: (path: string) => string;
  alt: string;
  scale: 1 | 2 | 3 | 4;
  still?: boolean;
  reaction?: SaucelingSpriteReaction | null;
  pose?: SaucelingSpritePose;
  cue?: SaucelingSpriteCue | null;
  customSrc?: string | null;
  sideSrc?: string | null;
  frames?: 1 | 3;
  silhouette?: boolean;
  look?: Pick<SaucelingEvolution, "colour" | "extra" | "move"> | null;
  act?: MoveAct | null;
  facing?: "left" | "right";
  flipped?: boolean;
}) {
  const anchor = stage === "egg" ? null : ANCHORS[stage];
  const custom = Boolean(customSrc);
  const single = custom && frames === 1;
  const shape = !custom && silhouette;
  const sheet = custom || shape ? null : spriteStrip(species, stage, mood);
  const frontStyle = stripStyle(custom ? customSrc : null, sheet, assetUrl);
  const sideSheet = sheet && spriteStrip(species, stage, "side");
  const sideStyle = stripStyle(custom ? sideSrc : null, sideSheet, assetUrl);
  // A living sheet carries the whole body in every copy, so the strip under it draws nothing.
  const frontLive = stage === "egg" ? undefined : liveStyle(species, sheet, assetUrl);
  const sideLive = stage === "egg" ? undefined : liveStyle(species, sideSheet, assetUrl);
  const liveClass = still ? "sl-live" : "sl-live sl-live--on";
  const frontLayer = frontLive ? <span className={liveClass} style={frontLive} /> : null;
  const sideLayer = sideLive ? <span className={liveClass} style={sideLive} /> : null;
  const frontShown = frontLive ? { ...frontStyle, backgroundImage: "none" } : frontStyle;
  const sideShown = sideLive ? { ...sideStyle, backgroundImage: "none" } : sideStyle;
  // The side view only walks; every other motion plays on the front strip.
  const sideways = Boolean(sideStyle) && pose === "walk" && !reaction && stage !== "egg";
  const motion = reaction
    ? `sl-react-${stage === "egg" ? "egg" : reaction.action}`
    : pose && stage !== "egg"
      ? `sl-pose-${pose}`
      : still
        ? ""
        : single || shape
          ? "sl-idle sl-idle-custom"
          : `sl-idle sl-idle-${stage === "egg" ? "egg" : mood}`;
  // The move canvas draws from the happy front strip and the side strip, mirrored to face right when the form's own
  // art faces left.
  const hatchColour = !look && act && act.kind !== "moment" ? act.colour : undefined;
  const canvasLook = look ?? (hatchColour ? { colour: hatchColour, extra: SAUCELING_EVOLVE_EXTRAS[0] } : null);
  const playable = Boolean(canvasLook) && stage !== "egg" && !shape;
  const frontStrip = playable ? spriteStrip(species, stage, "happy") : null;
  const sideStrip = playable ? spriteStrip(species, stage, "side") : null;
  const bodyKey = !playable
    ? ""
    : JSON.stringify(
        custom
          ? [
              { src: customSrc, row: 0, rows: 1, frames },
              sideSrc ? { src: sideSrc, row: 0, rows: 1, frames } : null,
              flipped,
              null,
            ]
          : [
              { src: assetUrl(frontStrip!.path), row: frontStrip!.row, rows: SHEET_ROWS, frames: 3 },
              sideStrip ? { src: assetUrl(sideStrip.path), row: sideStrip.row, rows: SHEET_ROWS, frames: 3 } : null,
              flipped,
              flipped ? null : (MOUTH_FIXES[`${species}:${stage}`] ?? null),
            ],
      );
  const [player, setPlayer] = useState<{ key: string; art: MoveArt; body: MoveBody } | null>(null);
  const assetRef = useRef(assetUrl);
  useEffect(() => {
    assetRef.current = assetUrl;
  });
  useEffect(() => {
    if (!bodyKey) return;
    let live = true;
    const [front, side, flip, fix] = JSON.parse(bodyKey) as [
      MoveStrip,
      MoveStrip | null,
      boolean,
      [number, number] | null,
    ];
    Promise.all([loadMoveArt(assetRef.current), loadMoveBody(front, side, flip, fix)]).then(
      ([art, body]) => live && setPlayer({ key: bodyKey, art, body }),
      // Without its pictures the canvas never shows, and the sprite plays no moves.
      () => live && setPlayer(null),
    );
    return () => {
      live = false;
    };
  }, [bodyKey]);
  const ready = player && player.key === bodyKey && canvasLook && stage !== "egg" ? player : null;
  // ponytail: effects and anchors are measured on the species sprites, so on a painted form or a silhouette
  // they may sit a few pixels off. Upgrade path: measure the content bounds of a form when it is made and
  // store per-form anchors.
  const size = SILHOUETTE_SIZE[stage];
  const style = {
    width: `${ART_PIXELS * scale}px`,
    height: `${ART_PIXELS * scale}px`,
    "--sl-px": `${scale}px`,
    ...(anchor ? { "--sl-t": anchor.t, "--sl-l": anchor.l, "--sl-r": anchor.r, "--sl-m": anchor.m } : {}),
    ...(shape ? { "--sl-sil-w": size.w, "--sl-sil-h": size.h } : {}),
  } as CSSProperties;
  const framesClass = single
    ? "sl-sprite-frames sl-sprite-frames--single"
    : shape
      ? "sl-sprite-frames sl-sprite-frames--silhouette"
      : "sl-sprite-frames";
  const aura = look ? SAUCELING_EVOLVE_PATHS[look.colour].aura : null;
  // Front and side are two spans and the one not showing is hidden, not swapped, so a turn into a walk never
  // waits for a picture to load. An evolution's breathing glow is a copy of whichever one shows, drawn behind it.
  // A hatchling hides its own frames for the whole hatching, even while its canvas is still loading.
  const onCanvas = act && (ready || hatchColour) ? " sl-sprite--canvas" : "";
  return (
    <span
      className={look ? `sl-sprite sl-evo sl-evo--${look.colour}${onCanvas}` : `sl-sprite${onCanvas}`}
      role="img"
      aria-label={alt}
      style={style}
    >
      {ready && canvasLook && stage !== "egg" ? (
        <MoveCanvas
          act={act}
          player={ready}
          look={canvasLook}
          plain={!look}
          stage={stage}
          facing={facing}
          scale={scale}
        />
      ) : null}
      {look ? (
        <span aria-hidden="true" className="sl-evo-ring">
          <span
            key={reaction?.at}
            className={sideways ? "sl-sprite-frames sl-pose-walk-side" : `${framesClass} ${motion}`}
            style={sideways ? sideShown : frontShown}
          >
            {sideways ? sideLayer : frontLayer}
          </span>
        </span>
      ) : null}
      <span
        key={reaction?.at}
        className={`${framesClass} ${sideways ? "sl-sprite-frames--hidden" : motion}`}
        style={frontShown}
      >
        {frontLayer}
      </span>
      {sideStyle ? (
        <span
          className={`sl-sprite-frames ${sideways ? "sl-pose-walk-side" : "sl-sprite-frames--hidden"}`}
          style={sideShown}
        >
          {sideLayer}
        </span>
      ) : null}
      {reaction && anchor
        ? (EFFECTS[reaction.action] ?? []).map((fx) => (
            <span
              key={`${reaction.at}-${fx.motion}`}
              aria-hidden="true"
              className={`sl-fx sl-fx-${fx.sprite} sl-fx-${fx.motion}`}
              style={{ backgroundImage: `url("${assetUrl(`sprites/fx-${fx.sprite}.webp`)}")` }}
            />
          ))
        : null}
      {cue && anchor && !reaction
        ? CUES[cue.kind].map((fx) => (
            <span
              key={`${cue.at}-${fx.motion}`}
              aria-hidden="true"
              className={`sl-fx sl-fx-${fx.sprite} sl-fx-${fx.motion}`}
              style={{ backgroundImage: `url("${assetUrl(`sprites/fx-${fx.sprite}.webp`)}")` }}
            />
          ))
        : null}
      {look && aura && anchor ? (
        <>
          {["a", "b", "c"].map((which) => (
            <span
              key={which}
              aria-hidden="true"
              className={`sl-evo-aura sl-evo-aura--${AURA_MOTION[aura]} sl-evo-aura-${which}`}
              style={{
                backgroundImage: `url("${assetUrl("sprites/fx-auras.webp")}")`,
                backgroundSize: `300% ${SAUCELING_EVOLVE_AURAS.length * 100}%`,
                backgroundPositionY: `${(SAUCELING_EVOLVE_AURAS.indexOf(aura) / (SAUCELING_EVOLVE_AURAS.length - 1)) * 100}%`,
              }}
            />
          ))}
          <span
            aria-hidden="true"
            className="sl-evo-extra"
            style={{
              backgroundImage: `url("${assetUrl("sprites/fx-extras.webp")}")`,
              backgroundSize: `200% ${SAUCELING_EVOLVE_EXTRAS.length * 100}%`,
              backgroundPositionY: `${(SAUCELING_EVOLVE_EXTRAS.indexOf(look.extra) / (SAUCELING_EVOLVE_EXTRAS.length - 1)) * 100}%`,
            }}
          />
        </>
      ) : null}
    </span>
  );
}
