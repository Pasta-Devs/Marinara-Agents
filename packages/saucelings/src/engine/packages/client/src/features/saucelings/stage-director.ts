import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SaucelingEvolveColour,
  SaucelingEvolveMove,
  SaucelingMood,
  SaucelingSpeciesId,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  HATCH_STEPS,
  MOMENT_STEPS,
  REDUCED_STEPS,
  STEP_MS,
  moveSteps,
  moveTravel,
  moveTurns,
  type MoveAct,
} from "./move-player.js";
import {
  CURIOUS,
  FRAME,
  beatFace,
  centreX,
  clampTarget,
  hurryMs,
  nextBeat,
  walkBounds,
  walkMs,
  type StageActor,
} from "./stage-beats.js";

const between = (low: number, high: number) => low + Math.random() * (high - low);

/** True when the Engine or the visitor asked for stillness: reduced effects, reduced motion, a paused window. */
export function stageIsStill(): boolean {
  if (typeof document === "undefined") return true;
  const root = document.documentElement;
  return (
    root.dataset.marinaraReducedEffects === "true" ||
    root.dataset.marinaraEffectsPaused === "true" ||
    document.hidden ||
    (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

/**
 * Drives the creature around its stage: a chain of timeouts, one beat at a time, never an interval. Eggs and
 * a stage that has not been measured stay put. While `busy` (a care reaction is playing) or `paused` it stops
 * where it is and picks up again afterwards. `measureX` reads where the sprite is right now, so a move can be
 * cut short. `comeOver` brings it to a caretaker standing at the right before a care plays. An evolved sauceling
 * does its signature `move` now and then, and sometimes when tapped while happy.
 */
export function useStageDirector({
  stageArtWidth,
  mood,
  species,
  enabled,
  busy,
  paused = false,
  move = null,
  measureX,
}: {
  stageArtWidth: number;
  mood: SaucelingMood;
  species: SaucelingSpeciesId;
  enabled: boolean;
  busy: boolean;
  paused?: boolean;
  move?: SaucelingEvolveMove | null;
  measureX: () => number | null;
}) {
  const [actor, setActor] = useState<StageActor>(() => ({
    x: centreX(stageArtWidth),
    facing: "right",
    pose: null,
    cue: null,
    moveMs: 0,
    steps: 1,
    face: null,
    act: null,
  }));
  const running = enabled && !busy && !paused && stageArtWidth > 0;
  const live = useRef({ actor, stageArtWidth, mood, species, move, measureX, running });
  live.current = { actor, stageArtWidth, mood, species, move, measureX, running };
  const timers = useRef<number[]>([]);
  // The care waiting for the sprite to come over; whatever stops it there lets the care play where it stands.
  const arriving = useRef<(() => void) | null>(null);

  const patch = useCallback((next: Partial<StageActor>) => setActor((current) => ({ ...current, ...next })), []);
  const after = useCallback((ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  }, []);
  const stop = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
    const settle = arriving.current;
    arriving.current = null;
    settle?.();
  }, []);

  /** Freeze where the sprite is, even halfway through a move. */
  const freeze = useCallback(() => {
    const here = live.current.measureX();
    // A stage hidden to no width cannot place it; it keeps where it was.
    const width = live.current.stageArtWidth;
    setActor((current) => ({
      ...current,
      x: here === null || width <= 0 ? current.x : clampTarget(here, width),
      moveMs: 0,
      steps: 1,
      pose: null,
      cue: null,
      face: null,
      act: null,
    }));
  }, []);

  const beatRef = useRef<() => void>(() => undefined);
  const begin = useCallback(() => after(between(2500, 7000), () => beatRef.current()), [after]);

  const walkTo = useCallback(
    (target: number, done: () => void, hurry = false) => {
      const { actor: now, mood: feel } = live.current;
      const x = clampTarget(target, live.current.stageArtWidth);
      const distance = x - now.x;
      if (Math.abs(distance) < 4) return done();
      const ms = hurry ? hurryMs(distance) : walkMs(distance, feel);
      patch({ x, facing: distance > 0 ? "right" : "left", pose: "walk", moveMs: ms, steps: Math.abs(distance) });
      after(ms + 60, () => {
        patch({ pose: null, moveMs: 0, steps: 1 });
        done();
      });
    },
    [after, patch],
  );

  /** A signature move where the sprite stands. One that turns faces `toward`, or else the open side of the stage; one
   *  that travels ends up along the floor, as far as the stage allows. Now and then it is the bigger encore; a
   *  hatchling's (`hatched`, in its hatch colour) always is. */
  const playMove = useCallback(
    (
      which: SaucelingEvolveMove,
      face: SaucelingMood | null,
      toward: "left" | "right" | null,
      done: () => void,
      hatched?: SaucelingEvolveColour,
    ) => {
      const { actor: now, stageArtWidth: width } = live.current;
      const x = clampTarget(live.current.measureX() ?? now.x, width);
      const encore = hatched !== undefined || Math.random() < 1 / 8;
      const facing = moveTurns(which) ? (toward ?? (x + FRAME / 2 <= width / 2 ? "right" : "left")) : now.facing;
      const dir = facing === "right" ? 1 : -1;
      const travel = Math.abs(clampTarget(x + dir * moveTravel(which, encore, false), width) - x);
      patch({
        x,
        moveMs: 0,
        steps: 1,
        facing,
        face,
        act: {
          kind: "move",
          move: which,
          encore,
          travel,
          spot: false,
          at: Date.now(),
          ...(hatched ? { colour: hatched } : {}),
        },
      });
      after(moveSteps(which, encore) * STEP_MS, () => {
        patch({ act: null, x: x + dir * travel, face: null });
        done();
      });
    },
    [after, patch],
  );

  const beat = useCallback(() => {
    if (stageIsStill()) return begin();
    const { actor: now, mood: feel, species: kind, stageArtWidth: width, move: evolved } = live.current;
    const chosen = nextBeat(feel, kind, new Date().getHours(), Math.random(), Boolean(evolved));
    const face = beatFace(chosen, feel, Math.random());
    const at = Date.now();
    switch (chosen) {
      case "wander": {
        const { min, max } = walkBounds(width);
        return walkTo(between(min, max), begin);
      }
      case "idle":
        patch({ face });
        return after(between(3000, 6000), () => {
          patch({ face: null });
          begin();
        });
      case "look": {
        const back = now.facing;
        patch({
          facing: back === "right" ? "left" : "right",
          cue: CURIOUS.includes(kind) ? { kind: "question", at } : null,
          face,
        });
        return after(1400, () => {
          patch({ facing: back, cue: null, face: null });
          begin();
        });
      }
      case "hop":
        patch({ pose: "hop", face });
        return after(700, () => {
          patch({ pose: null, face: null });
          begin();
        });
      case "hum":
        patch({ cue: { kind: "note", at }, face });
        return after(2200, () => {
          patch({ cue: null, face: null });
          begin();
        });
      case "nap":
        patch({ pose: "nap", cue: { kind: "nap", at }, face });
        return after(between(4000, 6000), () => {
          patch({ pose: null, cue: null, face: null });
          begin();
        });
      case "huff":
        patch({ pose: "huff", face });
        return after(1300, () => {
          patch({ pose: null, face: null });
          begin();
        });
      case "signature":
        return evolved ? playMove(evolved, face, null, begin) : begin();
    }
  }, [after, begin, patch, playMove, walkTo]);
  beatRef.current = beat;

  // Start and stop with the pet: an egg or an unmeasured stage stays where it is.
  useEffect(() => {
    if (!running) return;
    begin();
    return () => {
      stop();
      freeze();
    };
  }, [running, begin, stop, freeze]);

  // The first measure puts the sprite in the middle; a resized stage keeps it on the stage. A stage with no width (not
  // measured yet, or hidden) leaves it where it is.
  const placed = useRef(false);
  useEffect(() => {
    if (stageArtWidth <= 0) return;
    const first = !placed.current;
    if (first) placed.current = true;
    setActor((current) => {
      const x = enabled && !first ? clampTarget(current.x, stageArtWidth) : centreX(stageArtWidth);
      return x === current.x ? current : { ...current, x, moveMs: 0, steps: 1 };
    });
  }, [stageArtWidth, enabled]);

  /** A tap: turn towards it, startle, then come over. `tapX` is in art pixels from the stage's left. A happy evolved
   *  sauceling sometimes shows off its signature move instead. A tap during a move or the evolution moment ends it. */
  const poke = useCallback(
    (tapX: number) => {
      if (!enabled || busy || paused || stageIsStill()) return;
      stop();
      freeze();
      const at = Date.now();
      const here = live.current.measureX() ?? live.current.actor.x;
      const toward = tapX >= here + FRAME / 2 ? "right" : "left";
      const { move: evolved, mood: feel } = live.current;
      if (evolved && feel === "happy" && Math.random() < 0.4) return playMove(evolved, "happy", toward, begin);
      patch({ facing: toward, pose: "hop", cue: { kind: "bang", at } });
      after(700, () => {
        patch({ pose: null, cue: null });
        walkTo(tapX - FRAME / 2, begin);
      });
    },
    [after, begin, busy, enabled, paused, freeze, patch, playMove, stop, walkTo],
  );

  /** A look just chosen: the evolution moment where the sprite stands, then the path's `first` move. With reduced
   *  effects it is a short crossfade and no move. */
  const celebrate = useCallback(
    (first: SaucelingEvolveMove) => {
      stop();
      freeze();
      const reduced = stageIsStill();
      patch({ act: { kind: "moment", reduced, at: Date.now() } });
      const done = () => {
        if (live.current.running) begin();
      };
      after((reduced ? REDUCED_STEPS : MOMENT_STEPS) * STEP_MS, () => {
        patch({ act: null });
        if (reduced) done();
        else playMove(first, "happy", null, done);
      });
    },
    [after, begin, freeze, patch, playMove, stop],
  );

  /** A special species just hatched: its hatching where it stands, then its `moves` in turn, all in `colour`; `done`
   *  once the last has played. The stage holds it busy meanwhile, so nothing else starts. */
  const hatch = useCallback(
    (
      how: Extract<MoveAct, { kind: "hatch" }>["how"],
      colour: SaucelingEvolveColour,
      moves: readonly SaucelingEvolveMove[],
      done: () => void,
    ) => {
      stop();
      freeze();
      patch({ act: { kind: "hatch", how, colour, at: Date.now() } });
      const next = (i: number) =>
        i < moves.length ? playMove(moves[i], "happy", null, () => next(i + 1), colour) : done();
      after(HATCH_STEPS * STEP_MS, () => {
        patch({ act: null });
        next(0);
      });
    },
    [after, freeze, patch, playMove, stop],
  );

  /** A new line from the caretaker: turn to them and walk over when they stand at the right, else stay put; then
   *  hop, happy unless grumpy. A pet already on its way over for a care keeps going. */
  const listen = useCallback(
    (towardRight: boolean) => {
      if (!enabled || busy || paused || arriving.current || stageIsStill()) return;
      stop();
      freeze();
      const hop = () => {
        patch({
          facing: towardRight ? "right" : live.current.actor.facing,
          pose: "hop",
          face: beatFace("hop", live.current.mood, 0),
        });
        after(700, () => {
          patch({ pose: null, face: null });
          begin();
        });
      };
      if (!towardRight) return hop();
      patch({ facing: "right" });
      // A beat to turn before setting off, once the frozen spot has rendered.
      after(300, () => walkTo(walkBounds(live.current.stageArtWidth).max, hop));
    },
    [after, begin, busy, enabled, paused, freeze, patch, stop, walkTo],
  );

  /** A care for the pet, yours or the caretaker's: hurry over to them when they stand at the right and turn to face
   *  them; the promise settles when it is there and the care can play. It settles at once for an egg, a still or
   *  paused stage, a care already playing, or nobody standing there, and early if something stops it on the way. */
  const comeOver = useCallback(
    (towardRight: boolean) =>
      new Promise<void>((resolve) => {
        if (!towardRight || !enabled || busy || paused || stageIsStill() || live.current.stageArtWidth <= 0) {
          return resolve();
        }
        stop();
        freeze();
        arriving.current = resolve;
        // On a busy page the walk's last steps can trail its timer, so the care waits (a little) until it is there.
        let checks = 0;
        const arrive = () => {
          if (live.current.measureX() !== live.current.actor.x && checks++ < 8) return after(50, arrive);
          arriving.current = null;
          resolve();
          begin();
        };
        const turning = live.current.actor.facing !== "right";
        patch({ facing: "right" });
        // A beat to turn before setting off, once the frozen spot has rendered.
        after(turning ? 250 : 60, () => walkTo(walkBounds(live.current.stageArtWidth).max, arrive, true));
      }),
    [after, begin, busy, enabled, paused, freeze, patch, stop, walkTo],
  );

  return { actor, poke, listen, comeOver, celebrate, hatch };
}
