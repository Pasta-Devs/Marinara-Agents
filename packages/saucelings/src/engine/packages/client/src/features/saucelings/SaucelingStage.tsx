import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type Ref,
} from "react";
import { SAUCELING_EVOLVE_PATHS, type SaucelingPet } from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  petKind,
  sceneAssetPath,
  spriteStateForPet,
} from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import { FIGURE_FRAME, FORM_BASELINE, FORM_FRAME } from "./form-art.js";
import { useSaucelingsTranslation } from "./localization.js";
import { HATCH_MOMENTS, loadMoveArt } from "./move-player.js";
import { PetSprite } from "./PetSprite.js";
import type { SaucelingSpriteReaction } from "./SaucelingSprite.js";
import { FRAME, HOVERERS, shownFace, stageScale, walkWidth } from "./stage-beats.js";
import { stageIsStill, useStageDirector } from "./stage-director.js";

/** How far above the stage's bottom edge the sprite stands, as a share of its height, on the floor band of a
 *  built-in background; a Fluttino hovers a little higher. */
const FLOOR_PERCENT = 8;
const HOVER_ART_PIXELS = 10;
/** Where an egg's base rests in the built-in nest, as shares of the nest picture's width and height. */
const NEST_SPOT = { x: 0.5, y: 0.69 };
/** Every egg is drawn on its frame's baseline: the art pixels under its base, and how tall it is at most. */
const EGG_FOOT = FORM_FRAME - FORM_BASELINE - 1;
const EGG_HEIGHT = 32;
/** How far an egg may be pushed past a side of the stage: its frame is wider than the egg in it. */
const EGG_SIDE = 13;

type Spot = { x: number; y: number };

/** Where a picture shown with object-fit: cover lies on a stage, in screen pixels. */
function coverBox(width: number, height: number, picture: { width: number; height: number }) {
  const fit = Math.max(width / picture.width, height / picture.height);
  return {
    left: (width - picture.width * fit) / 2,
    top: (height - picture.height * fit) / 2,
    width: picture.width * fit,
    height: picture.height * fit,
  };
}
/** A painted caretaker's frame overhangs the stage's right edge by this many art pixels, so the figure stands
 *  centred in the share of the stage the pet leaves them. */
const FIGURE_OVERHANG = 22;

/** The size of an element, kept up to date as it is resized; 0 by 0 until it has been measured. */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const read = () =>
      setSize((now) =>
        now.width === element.clientWidth && now.height === element.clientHeight
          ? now
          : { width: element.clientWidth, height: element.clientHeight },
      );
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/** What the page can ask of the stage: `comeOver` brings the pet to the caretaker before a care plays, and settles
 *  once it is there (see the stage director). */
export interface SaucelingStageHandle {
  comeOver: () => Promise<void>;
}

/**
 * The Nook's centre: a 16:9 stage (the whole card on a large Home widget) with the pet's background behind it and the
 * pet on it. The pet walks, turns, hops, hums and naps by itself (see the stage director) and comes over when the
 * stage is tapped. `backgroundSrc` is the custom background's data URL; null shows the species' built-in one. A
 * `paused` stage (a Home widget on a tab nobody is looking at) holds the pet and the caretaker still. A `caretaker`
 * stands at the right, as an Engine sprite (`src`) or as their painted pixel figure (`figure`, showing frame
 * `frame`, with `blink` shutting its eyes now and then), and the pet keeps to the rest; a new `listenKey` (their
 * newest line) has it listen, and `handle` lets the page call it over before a care. An egg sits in the nest, or
 * where it was put on this background (`pet.eggSpot`); with `onMoveEgg` it can be dragged, moved with the arrow
 * keys, or sent where the stage is tapped, and the new spot is saved.
 */
export function SaucelingStage({
  pet,
  reaction,
  assetUrl,
  backgroundSrc,
  paused = false,
  caretaker = null,
  caretakerFlipped = false,
  listenKey = null,
  handle,
  onMoveEgg,
  scaleByWidth = false,
}: {
  pet: SaucelingPet;
  reaction: SaucelingSpriteReaction | null;
  assetUrl: (path: string) => string;
  backgroundSrc: string | null;
  paused?: boolean;
  caretaker?:
    { src: string } | { figure: string; rows: 1 | 2; frames: number; frame: number; blink?: string | null } | null;
  /** The caretaker faces the other way. */
  caretakerFlipped?: boolean;
  listenKey?: string | null;
  handle?: Ref<SaucelingStageHandle>;
  onMoveEgg?: (spot: Spot) => Promise<unknown>;
  /** Size the sprites by the stage's width alone, so a tall, narrow card (the large Home widget) does not draw them
   *  at the scale its height would ask for. */
  scaleByWidth?: boolean;
}) {
  const { t } = useSaucelingsTranslation();
  const [stageRef, { width, height }] = useElementSize<HTMLDivElement>();
  const actorRef = useRef<HTMLDivElement | null>(null);
  const scale = scaleByWidth ? stageScale(width) : stageScale(width, height);
  const stageArtWidth = width / scale;
  const sprite = spriteStateForPet(pet);
  const isEgg = pet.stage === "egg";
  const custom = backgroundSrc !== null;

  // Where the sprite is right now, in art pixels: a move in progress is stepping, so read the screen.
  const measureX = useCallback(() => {
    const stage = stageRef.current;
    const actor = actorRef.current;
    if (!stage || !actor) return null;
    return Math.round((actor.getBoundingClientRect().left - stage.getBoundingClientRect().left) / scale);
  }, [scale, stageRef]);

  // A built-in special or October species that hatches while the stage is open has a hatching of its own, which
  // plays instead of the Warm's reaction; with reduced effects it just hatches.
  const special = pet.design ? undefined : HATCH_MOMENTS[pet.species];
  const [seen, setSeen] = useState({ id: pet.id, isEgg });
  const [hatching, setHatching] = useState(false);
  if (seen.id !== pet.id || seen.isEgg !== isEgg) {
    setSeen({ id: pet.id, isEgg });
    setHatching(seen.id === pet.id && !isEgg && Boolean(special) && !paused && !stageIsStill());
  }
  const shownReaction = hatching ? null : reaction;
  // Its moves' pictures load while it is still an egg, so the hatching starts on time.
  useEffect(() => {
    if (isEgg && special) loadMoveArt(assetUrl).catch(() => undefined);
  }, [isEgg, special, assetUrl]);

  const standing = caretaker !== null;
  const { actor, poke, listen, comeOver, celebrate, hatch } = useStageDirector({
    stageArtWidth: walkWidth(stageArtWidth, standing),
    mood: sprite.mood,
    species: pet.species,
    enabled: !isEgg,
    busy: hatching || reaction !== null,
    paused,
    move: pet.evolution.look?.move ?? null,
    measureX,
  });

  // A look chosen while the stage is open plays the evolution moment; one it opened with does not.
  const colour = pet.evolution.look?.colour ?? null;
  const shownColour = useRef(colour);
  useEffect(() => {
    if (colour === shownColour.current) return;
    shownColour.current = colour;
    if (colour) celebrate(SAUCELING_EVOLVE_PATHS[colour].moves[0]);
  }, [colour, celebrate]);

  // Before the first paint of the hatchling, so it never shows before its hatching.
  useLayoutEffect(() => {
    if (hatching && special) hatch(special.how, special.colour, special.moves, () => setHatching(false));
  }, [hatching, special, hatch]);

  useImperativeHandle(handle, () => ({ comeOver: () => comeOver(standing) }), [comeOver, standing]);

  // The key the stage opened with was already heard.
  const heardKey = useRef(listenKey);
  useEffect(() => {
    if (listenKey === heardKey.current) return;
    heardKey.current = listenKey;
    if (listenKey) listen(standing);
  }, [listenKey, listen, standing]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    poke((event.clientX - stage.getBoundingClientRect().left) / scale);
  };

  // The egg's spot: where it is being moved to, else where it was put on this background, else the nest (a custom
  // background has none, so it sits on the floor like a pet).
  const [picture, setPicture] = useState({ width: 16, height: 9 });
  const [draft, setDraft] = useState<Spot | null>(null);
  const saved = pet.eggSpot?.backgroundId === (custom ? pet.backgroundId : null) ? pet.eggSpot : null;
  const spot = isEgg ? (draft ?? saved ?? (custom ? null : NEST_SPOT)) : null;
  const box = coverBox(width, height, picture);
  const artHeight = height / scale;
  const movable = isEgg && onMoveEgg !== undefined && width > 0;

  // A spot as screen pixels on the stage, and back, kept where the egg can still be seen.
  const spotFromPoint = (px: number, py: number): Spot => {
    const sideMargin = (FRAME / 2 - EGG_SIDE) * scale;
    const x = Math.min(width - sideMargin, Math.max(sideMargin, px));
    const y = Math.min(height, Math.max(EGG_HEIGHT * scale, py));
    return { x: (x - box.left) / box.width, y: (y - box.top) / box.height };
  };
  const pointOf = (at: Spot) => ({ px: box.left + at.x * box.width, py: box.top + at.y * box.height });

  const saveTimer = useRef<number | undefined>(undefined);
  // A move waiting on its timer when the stage goes away (a tab switch) is saved then, not lost.
  const pendingSpot = useRef<Spot | null>(null);
  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      if (pendingSpot.current) void onMoveEgg?.(pendingSpot.current).catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const moveTo = (next: Spot, delayMs: number) => {
    setDraft(next);
    pendingSpot.current = next;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      pendingSpot.current = null;
      // Until it is saved the egg stays where it was put; a failed save puts it back.
      void onMoveEgg?.(next)
        .catch(() => undefined)
        .finally(() => setDraft((now) => (now === next ? null : now)));
    }, delayMs);
  };

  const drag = useRef<{ pointer: number; dx: number; dy: number; to: Spot | null } | null>(null);
  const stagePoint = (event: { clientX: number; clientY: number }) => {
    const rect = stageRef.current?.getBoundingClientRect();
    return rect ? { px: event.clientX - rect.left, py: event.clientY - rect.top } : null;
  };
  const eggHandlers = movable
    ? {
        onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
          const at = stagePoint(event);
          if (!at || !spot || event.button !== 0) return;
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          const base = pointOf(spot);
          drag.current = { pointer: event.pointerId, dx: at.px - base.px, dy: at.py - base.py, to: null };
        },
        onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
          const held = drag.current;
          const at = stagePoint(event);
          if (!held || held.pointer !== event.pointerId || !at) return;
          const next = spotFromPoint(at.px - held.dx, at.py - held.dy);
          const base = pointOf(spot ?? next);
          const now = pointOf(next);
          // A press that barely moves is a tap, not a drag.
          if (!held.to && Math.hypot(now.px - base.px, now.py - base.py) < 4) return;
          held.to = next;
          setDraft(next);
        },
        onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
          const held = drag.current;
          drag.current = null;
          if (held?.to) moveTo(held.to, 0);
          event.stopPropagation();
        },
        onPointerCancel: () => {
          drag.current = null;
          setDraft(null);
        },
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          const step = (event.shiftKey ? 8 : 2) * scale;
          const [dx, dy] =
            event.key === "ArrowLeft"
              ? [-step, 0]
              : event.key === "ArrowRight"
                ? [step, 0]
                : event.key === "ArrowUp"
                  ? [0, -step]
                  : event.key === "ArrowDown"
                    ? [0, step]
                    : [0, 0];
          if ((!dx && !dy) || !spot) return;
          event.preventDefault();
          const base = pointOf(spot);
          moveTo(spotFromPoint(base.px + dx, base.py + dy), 500);
        },
      }
    : {};
  // A tap on the stage away from the egg sends it there; a swipe that scrolls the page never clicks.
  const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
    const at = stagePoint(event);
    if (!movable || !at || actorRef.current?.contains(event.target as Node)) return;
    moveTo(spotFromPoint(at.px, at.py), 0);
  };

  // An egg with a spot stands on it, snapped to whole art pixels; everything else stands on the floor band.
  const eggPoint = spot ? pointOf(spot) : null;
  const actorX = eggPoint
    ? Math.min(stageArtWidth - FRAME + EGG_SIDE, Math.max(-EGG_SIDE, Math.round(eggPoint.px / scale - FRAME / 2)))
    : actor.x;
  const bottom = eggPoint
    ? `${Math.min(artHeight - EGG_HEIGHT - EGG_FOOT, Math.max(-EGG_FOOT, Math.round(artHeight - eggPoint.py / scale - EGG_FOOT))) * scale}px`
    : `${FLOOR_PERCENT}%`;
  const actorStyle = {
    "--sl-px": `${scale}px`,
    "--sl-x": actorX,
    "--sl-move-ms": `${eggPoint ? 0 : actor.moveMs}ms`,
    "--sl-steps": actor.steps,
    bottom,
    width: `${FRAME * scale}px`,
    height: `${FRAME * scale}px`,
  } as CSSProperties;
  // The face follows what it is doing (a care reaction, then the director's beat) and settles back on its rest.
  const face = shownFace(sprite.mood, shownReaction?.action ?? null, actor.face);
  // An invented sauceling keeps its species' walk but not its float: it may have no wings.
  const hover = HOVERERS.includes(pet.species) && !pet.design && !isEgg;

  return (
    <div
      ref={stageRef}
      className="sl-stage"
      data-paused={paused ? "true" : undefined}
      onPointerDown={onPointerDown}
      onClick={onStageClick}
      style={{ "--sl-hover": HOVER_ART_PIXELS, "--sl-px": `${scale}px` } as CSSProperties}
    >
      <img
        className={`sl-stage-bg ${custom ? "" : "sl-stage-bg--pixel"}`}
        src={custom ? backgroundSrc : assetUrl(sceneAssetPath(pet))}
        alt=""
        draggable={false}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) setPicture({ width: naturalWidth, height: naturalHeight });
        }}
      />
      {caretaker && "figure" in caretaker ? (
        // Feet level with the pet's: its frame has empty rows under its baseline, the figure's has none.
        // Breathing shows the figure's squashed row (its picture's lower half) for part of each breath.
        <div
          className="sl-stage-figure"
          aria-hidden="true"
          data-breathes={caretaker.rows === 2 ? "true" : undefined}
          data-flipped={caretakerFlipped ? "true" : undefined}
          style={{
            backgroundImage: `url("${caretaker.figure}")`,
            backgroundSize: `${caretaker.frames * FIGURE_FRAME * scale}px ${caretaker.rows * FIGURE_FRAME * scale}px`,
            backgroundPositionX: `${-caretaker.frame * FIGURE_FRAME * scale}px`,
            width: `${FIGURE_FRAME * scale}px`,
            height: `${FIGURE_FRAME * scale}px`,
            right: `${-FIGURE_OVERHANG * scale}px`,
            bottom: `calc(${FLOOR_PERCENT}% + ${(FORM_FRAME - FORM_BASELINE - 1) * scale}px)`,
          }}
        >
          {caretaker.blink ? (
            <div className="sl-stage-blink" style={{ backgroundImage: `url("${caretaker.blink}")` }} />
          ) : null}
        </div>
      ) : caretaker ? (
        <img
          className="sl-stage-caretaker"
          data-flipped={caretakerFlipped ? "true" : undefined}
          src={caretaker.src}
          alt=""
          draggable={false}
        />
      ) : null}
      <div
        ref={actorRef}
        className="sl-stage-actor"
        // A flipped sauceling walks the other way: its art is mirrored from the way it is going.
        data-facing={pet.flipped === (actor.facing === "left") ? "right" : "left"}
        data-hover={hover ? "true" : undefined}
        data-movable={movable ? "true" : undefined}
        style={actorStyle}
        {...(movable
          ? {
              tabIndex: 0,
              role: "img",
              "aria-label": t("saucelings.egg.moveLabel"),
              title: t("saucelings.egg.moveHint"),
            }
          : {})}
        {...eggHandlers}
      >
        {width > 0 ? (
          <PetSprite
            art={pet}
            species={pet.species}
            stage={sprite.stage}
            mood={face}
            assetUrl={assetUrl}
            alt={isEgg ? t("saucelings.egg.name") : `${pet.name} (${petKind(pet).name})`}
            scale={scale}
            still={paused}
            reaction={shownReaction}
            pose={actor.pose}
            cue={actor.cue}
            act={isEgg ? null : actor.act}
            facing={actor.facing}
            flipped={pet.flipped}
          />
        ) : null}
      </div>
      {isEgg ? null : <span className="sl-sr-only">{t("saucelings.stage.tapHint", { name: pet.name })}</span>}
    </div>
  );
}
