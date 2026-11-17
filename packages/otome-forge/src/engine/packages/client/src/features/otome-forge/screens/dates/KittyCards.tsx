// ──────────────────────────────────────────────
// Otome Hearth: Kitty Cards (0.35.0). Our version of Love and Deep Space's Kitty Cards, played on a date with the love
// interest picked in Dates: kittens into cups, 2 × a card's value in a cup of its own colour, its value in a white one,
// nothing in another colour's, and one cheat moment in his own way. A game makes no model call and paints nothing: the
// rules are SH/kitty.ts (pure, seeded per game), his lines are his own pack's written ahead or the catalog's, and the
// cards are the package's own kittens. With images on, the value-5 cards show the protagonist's and the love
// interests' painted kittens (GET /play's `kittens`, SH/kitty.ts kittenCards); Paint our kittens is the tap that pays
// for them while Ask before painting or prompt review holds them, and Try again repaints a failed one (the Album's
// Repaint, 0.36.0, paints a painted one again). The intro's "How {name} plays" says what his cheat does in this game
// (0.36.0; his bible's style sentence is the Claw Machine's).
// ──────────────────────────────────────────────
// Play: pick a card in her hand, then a cup (the cups it would score in light up), or Draw. His turn plays after a
// short pause. His cheat moment comes before his move (SH/kitty.ts cheatDue) and changes only the game. Every control
// is a button with a visible label, so it all plays by keyboard; reduced motion stops the animations, never the timers.
// His lines: start as the game begins, good when she fills a cup of its own colour (at most every other turn of hers),
// cheat and caught at his moment, win or lose on the end screen; during a rupture one of Home's cold lines, once, and
// nothing else. With voices on they are voiced as the Claw Machine's are, under their own "kitty" ref.
//
// POST /runs/:run/kitty/finish {li, round, first, result, me, partner, cheat} pays the game once: the round id is made
// when the game starts, so Try again after a lost answer sends the same game and is never paid twice.
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  ArrowLeftRight,
  EyeOff,
  Layers,
  Moon,
  Paintbrush,
  RotateCcw,
  Sparkles,
  Star,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { focusLost, useItemActions, type PaintTarget } from "../../hooks/use-items";
import { runPath } from "../../hooks/use-reader";
import { patchRun, runQueryKey } from "../../hooks/use-run";
import { accentOf } from "../../lib/accent";
import { tapLineRef } from "../../lib/audio";
import { KITTY_BREED_KEYS, kittyCardUrl } from "../../lib/kitty-cards";
import { pickLine } from "../../lib/tap-mood";
import { useOtomeProps } from "../../props";
import type { ClawCheat, KittyLines, LinesView, RunLiView, RunView } from "../../shared/api-types";
import type { ClawPlayer, PlayView } from "../../shared/claw";
import { AFFECTION_EARNINGS, STARLIGHT_EARNINGS } from "../../shared/economy";
import type { KittyLineKind } from "../../shared/home";
import {
  KITTEN_CARDS,
  KITTY_CHEAT_SECONDS,
  applyMove,
  cardColour,
  cardValue,
  cheatCaught,
  cheatDue,
  cupPoints,
  deal,
  endCheat,
  isOver,
  kittenCards,
  nudgeSwap,
  partnerMove,
  resultOf,
  score,
  sneakCard,
  swapCups,
  takeBack,
  tradeCards,
  tradeOffer,
  turnSeed,
  type KittenOwner,
  type KittenView,
  type KittyCard,
  type KittyCheat,
  type KittyCupColour,
  type KittyFinishInput,
  type KittyFinishResult,
  type KittyGame,
  type KittyMove,
} from "../../shared/kitty";
import { PALETTE } from "../../theme/tokens";
import { useLineVoice } from "../home/NoteCard";
import { PaintReviewDialog } from "../wish/TenPullGrid";
import { coldPool, finishOnce, newRoundId, newSeed, usable } from "./ClawMachine";
import { playQueryKey, usePlay, type ActivityScreenProps } from "./DatesHub";

/** His turn waits this long, so it can be followed; the last move stays on the table as long before the end screen. */
const PAUSE_MS = 900;
/** How long he looks away (extra) while she may hold Sneak a card; holding it takes KITTY_CHEAT_SECONDS.extra. */
const LOOK_AWAY_MS = 5000;
const BUBBLE_MS = 3400;

// ── Names, lines and copy (literal keys, so the locale validator sees each one) ──

const COLOUR_KEYS: Record<KittyCupColour, string> = {
  rose: "ui.otomeForge.kitty.colourRose",
  sky: "ui.otomeForge.kitty.colourSky",
  lemon: "ui.otomeForge.kitty.colourLemon",
  mint: "ui.otomeForge.kitty.colourMint",
  white: "ui.otomeForge.kitty.colourWhite",
};

// The catalog's lines until his own pack has them (SH/home.ts LINE_COUNTS.kitty): no pronouns, no questions.
const FALLBACK_LINES: Record<"start" | "good" | "win" | "lose", readonly string[]> = {
  start: ["ui.otomeForge.fallback.kittyStart1", "ui.otomeForge.fallback.kittyStart2"],
  good: ["ui.otomeForge.fallback.kittyGood1", "ui.otomeForge.fallback.kittyGood2", "ui.otomeForge.fallback.kittyGood3"],
  win: ["ui.otomeForge.fallback.kittyWin1", "ui.otomeForge.fallback.kittyWin2", "ui.otomeForge.fallback.kittyWin3"],
  lose: ["ui.otomeForge.fallback.kittyLose1", "ui.otomeForge.fallback.kittyLose2", "ui.otomeForge.fallback.kittyLose3"],
};
const FALLBACK_CHEAT_LINES: Record<ClawCheat, readonly string[]> = {
  steady: ["ui.otomeForge.fallback.kittyCheatSteady1", "ui.otomeForge.fallback.kittyCheatSteady2"],
  nudge: ["ui.otomeForge.fallback.kittyCheatNudge1", "ui.otomeForge.fallback.kittyCheatNudge2"],
  extra: ["ui.otomeForge.fallback.kittyCheatExtra1", "ui.otomeForge.fallback.kittyCheatExtra2"],
  freeze: ["ui.otomeForge.fallback.kittyCheatFreeze1", "ui.otomeForge.fallback.kittyCheatFreeze2"],
  calculate: ["ui.otomeForge.fallback.kittyCheatCalculate1", "ui.otomeForge.fallback.kittyCheatCalculate2"],
};
// Only these three are ever caught (SH/kitty.ts KITTY_CATCHABLE).
const FALLBACK_CAUGHT_LINES: Partial<Record<ClawCheat, readonly string[]>> = {
  nudge: ["ui.otomeForge.fallback.kittyCaughtNudge1", "ui.otomeForge.fallback.kittyCaughtNudge2"],
  freeze: ["ui.otomeForge.fallback.kittyCaughtFreeze1", "ui.otomeForge.fallback.kittyCaughtFreeze2"],
  extra: ["ui.otomeForge.fallback.kittyCaughtExtra1", "ui.otomeForge.fallback.kittyCaughtExtra2"],
};

/** His pool for `kind`: his own pack's kitty lines, else the catalog's. */
function kittyPool(
  t: (key: string) => string,
  lines: KittyLines | undefined,
  kind: KittyLineKind,
  cheat: ClawCheat,
): string[] {
  const own = usable(lines?.[kind]);
  if (own.length) return own;
  const keys =
    kind === "cheat"
      ? FALLBACK_CHEAT_LINES[cheat]
      : kind === "caught"
        ? (FALLBACK_CAUGHT_LINES[cheat] ?? [])
        : FALLBACK_LINES[kind];
  return keys.map((key) => t(key));
}

/** His cheat moment, said for the player (not his line). */
const MOMENT_COPY: Record<ClawCheat, { title: string; hint: string; Icon: LucideIcon }> = {
  nudge: { title: "ui.otomeForge.kitty.nudgeTitle", hint: "ui.otomeForge.kitty.nudgeHint", Icon: ArrowLeftRight },
  freeze: { title: "ui.otomeForge.kitty.freezeTitle", hint: "ui.otomeForge.kitty.freezeHint", Icon: Moon },
  extra: { title: "ui.otomeForge.kitty.extraTitle", hint: "ui.otomeForge.kitty.extraHint", Icon: EyeOff },
  calculate: { title: "ui.otomeForge.kitty.tradeTitle", hint: "ui.otomeForge.kitty.tradeHint", Icon: Layers },
  steady: { title: "ui.otomeForge.kitty.steadyTitle", hint: "ui.otomeForge.kitty.steadyHint", Icon: Undo2 },
};

/**
 * "How {name} plays" on the intro: his cheat in this game (his bible's `play.style` is a Claw Machine sentence, which
 * the Claw shows).
 */
const STYLE_KEYS: Record<ClawCheat, string> = {
  nudge: "ui.otomeForge.kitty.style.nudge",
  freeze: "ui.otomeForge.kitty.style.freeze",
  extra: "ui.otomeForge.kitty.style.extra",
  calculate: "ui.otomeForge.kitty.style.calculate",
  steady: "ui.otomeForge.kitty.style.steady",
};

/** The end screen's line about his moment: [not found out, found out]. */
const CHEAT_NOTES: Record<ClawCheat, readonly [string, string]> = {
  nudge: ["ui.otomeForge.kitty.noteNudge", "ui.otomeForge.kitty.noteNudgeCaught"],
  freeze: ["ui.otomeForge.kitty.noteFreeze", "ui.otomeForge.kitty.noteFreezeCaught"],
  extra: ["ui.otomeForge.kitty.noteExtra", "ui.otomeForge.kitty.noteExtraCaught"],
  calculate: ["ui.otomeForge.kitty.noteCalculate", "ui.otomeForge.kitty.noteCalculate"],
  steady: ["ui.otomeForge.kitty.noteSteady", "ui.otomeForge.kitty.noteSteady"],
};

// ── The cards ──

interface Face {
  url: string;
  /** The breed, or "{name} as a kitten" on a card a painted kitten takes. */
  name: string;
  painted: boolean;
}
type Faces = (card: KittyCard) => Face;

/** How each card looks in a game with `li`: a painted kitten on a value-5 card when there is one, else its breed. */
function useFaces(play: PlayView | undefined, li: RunLiView, view: RunView): Faces {
  const { t } = useTranslation();
  const { packageVersion } = useOtomeProps();
  const kittens = play?.kittens;
  return useMemo(() => {
    const painted = kittenCards(kittens ?? [], li.id);
    const nameOf = (owner: KittenOwner) =>
      owner === "player" ? view.player.name : (view.lis.find((entry) => entry.id === owner)?.name ?? "");
    return (card) => {
      const kitten = painted[card];
      return kitten
        ? { url: kitten.url, name: t("ui.otomeForge.kitty.asKitten", { name: nameOf(kitten.owner) }), painted: true }
        : { url: kittyCardUrl(card, packageVersion), name: t(KITTY_BREED_KEYS[card]), painted: false };
    };
  }, [kittens, li.id, packageVersion, t, view.lis, view.player.name]);
}

/**
 * The intro's row: the four value-5 cards as a game with `li` deals them (the painted kittens on the ones they take,
 * else their breeds), then every other painted kitten, so all of hers and the cast's show. An extra kitten wears the
 * next value-5 colour in turn; it is named only as itself, since it plays on no card in this game.
 */
function heroCards(
  kittens: readonly KittenView[],
  li: RunLiView["id"],
  faces: Faces,
  nameOf: (owner: KittenOwner) => string,
) {
  const inGame = new Set(Object.values(kittenCards(kittens, li)).map((kitten) => kitten!.owner));
  const extra = kittens.filter((kitten) => kitten.url && !inGame.has(kitten.owner));
  return [
    ...KITTEN_CARDS.map((card) => ({ key: card, card, face: faces(card), inGame: true })),
    ...extra.map((kitten, index) => ({
      key: `kitten:${kitten.owner}`,
      card: KITTEN_CARDS[index % KITTEN_CARDS.length]!,
      face: { url: kitten.url!, name: nameOf(kitten.owner), painted: true },
      inGame: false,
    })),
  ];
}

/** A card's accessible name: its kitten, then its colour and value ("Siamese, sky 2"). */
function cardLabel(t: (key: string, options?: Record<string, unknown>) => string, card: KittyCard, face: Face) {
  return t("ui.otomeForge.kitty.cardLabel", {
    name: face.name,
    colour: t(COLOUR_KEYS[cardColour(card)]),
    value: cardValue(card),
  });
}

/** A card face: its kitten inside a frame in its colour, its value in a corner. Named by what holds it. */
function CardArt({ card, face }: { card: KittyCard; face: Face }) {
  return (
    <span className="of-kitty-card" data-colour={cardColour(card)} data-painted={face.painted || undefined}>
      <img className="of-kitty-art" src={face.url} alt="" draggable={false} />
      <span className="of-kitty-value" aria-hidden="true">
        {cardValue(card)}
      </span>
    </span>
  );
}

/** A face-down card (his hand, the pile, a trade). */
const CardBack = () => <span className="of-kitty-back" aria-hidden="true" />;

// ── The game ──

type Moment =
  | { kind: "nudge"; cups: [number, number]; until: number }
  | { kind: "freeze"; first: number | null; swapped: [number, number] | null; until: number }
  | { kind: "extra"; holding: boolean; until: number }
  | { kind: "calculate"; offer: { his: KittyCard; hers: KittyCard } }
  | { kind: "steady" };

interface Table {
  game: KittyGame;
  selected: KittyCard | null;
  moment: Moment | null;
  /** His moment once it is over, as the finish sends it. */
  cheat: KittyCheat | null;
  /** The cup filled last, which lands with a little bounce. */
  fresh: number | null;
  /** Her turns so far, and the one her last good line came on (one every other turn at most). */
  herTurns: number;
  goodAt: number;
}

interface TableProps {
  li: RunLiView;
  accent: string;
  seed: number;
  first: ClawPlayer;
  cheat: ClawCheat;
  lines: (Pick<LinesView, "cold"> & { kitty?: KittyLines }) | null;
  rupture: boolean;
  faces: Faces;
  onDone: (game: KittyGame, cheat: KittyCheat | null) => void;
}

function KittyTable({ li, accent, seed, first, cheat, lines, rupture, faces, onDone }: TableProps) {
  const { t } = useTranslation();
  const momentId = useId();
  const hintId = useId();
  const [table, setTable] = useState<Table>(() => ({
    game: deal(seed, first),
    selected: null,
    moment: null,
    cheat: null,
    fresh: null,
    herTurns: 0,
    goodAt: -2,
  }));
  // The timers' copy of the table: they read it when they fire, never a render's stale one.
  const tableRef = useRef(table);
  const commit = useCallback((next: Table) => {
    tableRef.current = next;
    setTable(next);
  }, []);
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(null);
  const [announce, setAnnounce] = useState("");
  const [now, setNow] = useState(() => performance.now());
  const lineId = useRef(0);
  const lastLine = useRef<string | null>(null);
  const handRef = useRef<HTMLUListElement>(null);
  const cupsRef = useRef<HTMLOListElement>(null);
  const momentRef = useRef<HTMLElement>(null);
  const holdCancel = useRef<(() => void) | null>(null);
  const lookedBack = useRef(false);

  // Every timer of the game, cleared when it leaves the page.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = useCallback((ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      run();
    }, ms);
    timers.current.add(timer);
    return () => {
      clearTimeout(timer);
      timers.current.delete(timer);
    };
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  // His lines in his voice while Settings → Audio voices him; the next line cuts one short.
  const voice = useLineVoice();
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const show = useCallback(
    (line: string, ref: string): string => {
      lastLine.current = line;
      lineId.current += 1;
      setBubble({ id: lineId.current, text: line });
      const spoken = { speaker: li.name, text: line };
      if (voiceRef.current.can(spoken)) voiceRef.current.play(ref, spoken);
      return t("ui.otomeForge.claw.said", { name: li.name, line });
    },
    [li.name, t],
  );
  /** His line of `kind` in his bubble, returned as the live region says it; none during a rupture. */
  const say = useCallback(
    (kind: KittyLineKind): string => {
      if (rupture) return "";
      const line = pickLine(kittyPool(t, lines?.kitty, kind, cheat), lastLine.current);
      return line ? show(line, tapLineRef(li.id, line, "kitty")) : "";
    },
    [cheat, li.id, lines, rupture, show, t],
  );

  const label = (card: KittyCard) => cardLabel(t, card, faces(card));
  const cupName = (cup: number) => t(COLOUR_KEYS[tableRef.current.game.cups[cup]?.colour ?? "white"]);
  const turnNote = (game: KittyGame) =>
    isOver(game)
      ? t("ui.otomeForge.kitty.announceOver")
      : game.turn === "me"
        ? t("ui.otomeForge.kitty.announceYourTurn")
        : t("ui.otomeForge.kitty.announceTheirTurn", { name: li.name });
  /** What a move did, for the live region. */
  const describe = (who: ClawPlayer, before: KittyGame, move: KittyMove, after: KittyGame): string => {
    if (move.kind === "play") {
      const options = {
        name: li.name,
        card: label(move.card),
        cup: t(COLOUR_KEYS[before.cups[move.cup]!.colour]),
        count: cupPoints(move.card, before.cups[move.cup]!.colour),
      };
      return t(
        who === "me" ? "ui.otomeForge.kitty.announceYouPlayed" : "ui.otomeForge.kitty.announceTheyPlayed",
        options,
      );
    }
    const burned = after.burned.length > before.burned.length;
    if (who === "partner") {
      return t(burned ? "ui.otomeForge.kitty.announceTheyBurned" : "ui.otomeForge.kitty.announceTheyDrew", {
        name: li.name,
      });
    }
    return burned
      ? t("ui.otomeForge.kitty.announceYouBurned", { card: label(after.burned.at(-1)!) })
      : t("ui.otomeForge.kitty.announceYouDrew", { card: label(after.hands.me.at(-1)!) });
  };
  const tell = (parts: string[]) => setAnnounce(parts.filter(Boolean).join(" "));

  // ── Moves ──

  const pickCard = (card: KittyCard) => {
    const current = tableRef.current;
    if (current.moment || current.game.turn !== "me" || isOver(current.game)) return;
    commit({ ...current, selected: current.selected === card ? null : card });
  };

  const playCup = (cup: number) => {
    const current = tableRef.current;
    const { game, selected } = current;
    if (current.moment || game.turn !== "me" || isOver(game) || game.cups[cup]?.played) return;
    if (!selected) return tell([t("ui.otomeForge.kitty.pickFirst")]);
    const move: KittyMove = { kind: "play", card: selected, cup };
    const next = applyMove(game, move);
    const herTurns = current.herTurns + 1;
    const good = game.cups[cup]!.colour === cardColour(selected) && herTurns - current.goodAt >= 2;
    commit({ ...current, game: next, selected: null, fresh: cup, herTurns, goodAt: good ? herTurns : current.goodAt });
    tell([describe("me", game, move, next), good ? say("good") : "", turnNote(next)]);
  };

  const draw = () => {
    const current = tableRef.current;
    const { game } = current;
    if (current.moment || game.turn !== "me" || isOver(game) || !game.pile.length) return;
    const move: KittyMove = { kind: "draw" };
    const next = applyMove(game, move);
    commit({ ...current, game: next, selected: null, herTurns: current.herTurns + 1 });
    tell([describe("me", game, move, next), turnNote(next)]);
  };

  const partnerTurn = () => {
    const current = tableRef.current;
    const { game } = current;
    if (current.moment || game.turn !== "partner" || isOver(game)) return;
    const move = partnerMove(game, turnSeed(game));
    const next = applyMove(game, move);
    commit({ ...current, game: next, fresh: move.kind === "play" ? move.cup : current.fresh });
    tell([describe("partner", game, move, next), turnNote(next)]);
  };

  // ── His cheat moment ──

  const beginMoment = () => {
    const current = tableRef.current;
    let game = endCheat(current.game);
    const at = performance.now();
    let moment: Moment;
    if (cheat === "nudge") {
      const cups = nudgeSwap(game)!;
      game = swapCups(game, cups[0], cups[1]);
      moment = { kind: "nudge", cups, until: at + KITTY_CHEAT_SECONDS.nudge * 1000 };
    } else if (cheat === "freeze") {
      moment = { kind: "freeze", first: null, swapped: null, until: at + KITTY_CHEAT_SECONDS.freeze * 1000 };
    } else if (cheat === "extra") {
      lookedBack.current = false;
      moment = { kind: "extra", holding: false, until: at + LOOK_AWAY_MS };
    } else if (cheat === "calculate") {
      moment = { kind: "calculate", offer: tradeOffer(game) };
    } else {
      moment = { kind: "steady" };
    }
    commit({ ...current, game, moment, selected: null });
    const copy = MOMENT_COPY[cheat];
    tell([say("cheat"), t(copy.title, { name: li.name }), t(copy.hint, { name: li.name })]);
  };

  /** The moment is over: `record` is what the finish sends, `game` the table after it. */
  const settle = (record: KittyCheat, game: KittyGame, parts: string[]) => {
    const current = tableRef.current;
    commit({ ...current, game, moment: null, cheat: record });
    tell([...parts, turnNote(game)]);
  };

  const gotcha = () => {
    const current = tableRef.current;
    const moment = current.moment;
    if (moment?.kind !== "nudge") return;
    settle({ kind: "nudge", caught: true }, swapCups(current.game, ...moment.cups), [
      t("ui.otomeForge.kitty.gotchaDone", { name: li.name }),
      say("caught"),
    ]);
  };

  const pickSwap = (cup: number) => {
    const current = tableRef.current;
    const moment = current.moment;
    if (moment?.kind !== "freeze" || moment.swapped || !current.game.cups[cup]?.played) return;
    if (moment.first === null || moment.first === cup) {
      const first = moment.first === cup ? null : cup;
      commit({ ...current, moment: { ...moment, first } });
      if (first !== null) tell([t("ui.otomeForge.kitty.freezePicked", { cup: cupName(cup) })]);
      return;
    }
    const swapped: [number, number] = [moment.first, cup];
    commit({ ...current, game: swapCups(current.game, ...swapped), moment: { ...moment, first: null, swapped } });
    tell([t("ui.otomeForge.kitty.freezeSwapped", { a: cupName(swapped[0]), b: cupName(swapped[1]) })]);
  };

  const startHold = () => {
    const current = tableRef.current;
    const moment = current.moment;
    if (moment?.kind !== "extra" || moment.holding) return;
    commit({ ...current, moment: { ...moment, holding: true } });
    // Found out, he turns back halfway through her hold, and nothing is drawn.
    const caught = cheatCaught(current.game);
    holdCancel.current = later(KITTY_CHEAT_SECONDS.extra * (caught ? 500 : 1000), () => {
      holdCancel.current = null;
      const held = tableRef.current;
      if (held.moment?.kind !== "extra") return;
      if (caught) {
        settle({ kind: "extra", caught: true }, held.game, [
          t("ui.otomeForge.kitty.extraCaught", { name: li.name }),
          say("caught"),
        ]);
        return;
      }
      const game = sneakCard(held.game);
      settle({ kind: "extra", caught: false }, game, [
        game.burned.length > held.game.burned.length
          ? t("ui.otomeForge.kitty.sneakBurned")
          : t("ui.otomeForge.kitty.sneaked", { card: label(game.hands.me.at(-1)!) }),
      ]);
    });
  };
  const endHold = () => {
    const current = tableRef.current;
    const moment = current.moment;
    if (moment?.kind !== "extra" || !moment.holding) return;
    holdCancel.current?.();
    holdCancel.current = null;
    if (lookedBack.current) {
      settle({ kind: "extra", caught: false }, current.game, [t("ui.otomeForge.kitty.extraOver", { name: li.name })]);
    } else {
      commit({ ...current, moment: { ...moment, holding: false } });
    }
  };

  const trade = (accept: boolean) => {
    const current = tableRef.current;
    const moment = current.moment;
    if (moment?.kind !== "calculate") return;
    settle({ kind: "calculate", caught: false }, accept ? tradeCards(current.game, moment.offer) : current.game, [
      accept
        ? t("ui.otomeForge.kitty.traded", { card: label(moment.offer.his) })
        : t("ui.otomeForge.kitty.tradeRefused", { name: li.name }),
    ]);
  };

  const steady = (back: boolean) => {
    const current = tableRef.current;
    if (current.moment?.kind !== "steady") return;
    settle({ kind: "steady", caught: false }, back ? takeBack(current.game) : current.game, [
      back ? t("ui.otomeForge.kitty.tookBack") : "",
    ]);
  };

  /** A timed moment runs out. */
  const expire = () => {
    const current = tableRef.current;
    const moment = current.moment;
    if (moment?.kind === "nudge") {
      settle({ kind: "nudge", caught: false }, current.game, [t("ui.otomeForge.kitty.nudgeStands", { name: li.name })]);
    } else if (moment?.kind === "freeze") {
      if (moment.swapped && cheatCaught(current.game)) {
        settle({ kind: "freeze", caught: true }, swapCups(current.game, ...moment.swapped), [
          t("ui.otomeForge.kitty.freezeCaught", { name: li.name }),
          say("caught"),
        ]);
      } else {
        settle({ kind: "freeze", caught: false }, current.game, [
          t(moment.swapped ? "ui.otomeForge.kitty.freezeUnseen" : "ui.otomeForge.kitty.freezeWoke", { name: li.name }),
        ]);
      }
    } else if (moment?.kind === "extra") {
      // A hold under way finishes first; letting go after he looks back ends it.
      if (moment.holding) lookedBack.current = true;
      else
        settle({ kind: "extra", caught: false }, current.game, [t("ui.otomeForge.kitty.extraOver", { name: li.name })]);
    }
  };

  // The timers below call the newest of these, never a stale render's.
  const act = useRef({ beginMoment, partnerTurn, expire, say, show });
  act.current = { beginMoment, partnerTurn, expire, say, show };

  // ── Its rhythm ──

  // The opening: his start line (during a rupture, one cold line and nothing else), and whose turn it is.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const cold = rupture ? pickLine(coldPool(t, lines), null) : null;
    const opening = rupture
      ? cold
        ? act.current.show(cold, tapLineRef(li.id, cold, "tap"))
        : ""
      : act.current.say("start");
    tell([t("ui.otomeForge.kitty.announceStart"), opening, turnNote(tableRef.current.game)]);
    handRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    // Once, as the game begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // His turn, after a pause: his cheat moment when it is due, else his move.
  useEffect(() => {
    const { game, moment } = table;
    if (moment || isOver(game) || game.turn !== "partner") return;
    return later(PAUSE_MS, () => {
      const current = tableRef.current;
      if (current.moment || current.game !== game) return;
      if (cheatDue(game, cheat)) act.current.beginMoment();
      else act.current.partnerTurn();
    });
  }, [cheat, later, table]);

  // The end: the last move stays in view a moment, then the end screen.
  const done = useRef(false);
  useEffect(() => {
    if (done.current || table.moment || !isOver(table.game)) return;
    done.current = true;
    later(PAUSE_MS, () => onDone(tableRef.current.game, tableRef.current.cheat));
  }, [later, onDone, table]);

  // A timed moment's clock: its seconds left, and its end.
  const until = table.moment && "until" in table.moment ? table.moment.until : null;
  useEffect(() => {
    if (until === null) return;
    setNow(performance.now());
    const tick = setInterval(() => setNow(performance.now()), 200);
    const stop = later(Math.max(0, until - performance.now()), () => act.current.expire());
    return () => {
      clearInterval(tick);
      stop();
    };
  }, [later, until]);

  // A moment takes focus as it opens (it has seconds to act in) and gives it back to her hand as it closes.
  const momentKind = table.moment?.kind ?? null;
  useEffect(() => {
    if (momentKind === "freeze")
      cupsRef.current?.querySelector<HTMLElement>("[data-filled] button")?.focus({ preventScroll: true });
    else if (momentKind) momentRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    else if (focusLost()) handRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, [momentKind]);

  // His line fades on its own.
  useEffect(() => {
    if (!bubble) return;
    const id = bubble.id;
    const timer = setTimeout(() => setBubble((shown) => (shown?.id === id ? null : shown)), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [bubble]);

  // ── The table ──

  const { game, selected, moment } = table;
  const points = score(game);
  const over = isOver(game);
  const herTurn = game.turn === "me" && !moment && !over;
  const canDraw = herTurn && game.pile.length > 0;
  const seconds = until !== null ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
  const moved = moment?.kind === "nudge" ? moment.cups : moment?.kind === "freeze" ? moment.swapped : null;
  const status = over
    ? t("ui.otomeForge.kitty.over")
    : moment
      ? t(MOMENT_COPY[cheat].title, { name: li.name })
      : herTurn
        ? t("ui.otomeForge.kitty.yourTurn")
        : t("ui.otomeForge.kitty.theirTurn", { name: li.name });
  const mid = (game.hands.me.length - 1) / 2;
  // Her fan turns each card 5° from the middle, and its outer cards 8° at most. A card turns about a point below it,
  // so an outer card's top corner swings out about 15px at 8°: inside the page's 16px gutter and the hand's 4px
  // padding on a phone. At 5° a card, a hand of 6 or more went past the page's edge.
  const fan = Math.min(5, 8 / Math.max(mid, 1));

  const holdKeys = {
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (!event.repeat) startHold();
    },
    onKeyUp: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      endHold();
    },
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      startHold();
    },
    onPointerUp: endHold,
    onPointerCancel: endHold,
    onLostPointerCapture: endHold,
    // A long press on a phone would otherwise open its menu.
    onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => event.preventDefault(),
    // A screen reader clicks without a pointer or a key: the hold then runs its whole length by itself.
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) startHold();
    },
  };

  let momentPanel: ReactNode = null;
  if (moment) {
    const copy = MOMENT_COPY[cheat];
    momentPanel = (
      <section
        ref={momentRef}
        className="of-kitty-moment of-glass"
        data-kind={moment.kind}
        aria-labelledby={momentId}
        style={{ "--of-li-accent": accent } as CSSProperties}
      >
        <div className="of-kitty-moment-head">
          <copy.Icon size={18} strokeWidth={2} aria-hidden="true" />
          <h2 id={momentId}>{t(copy.title, { name: li.name })}</h2>
          {seconds !== null ? (
            <span className="of-badge of-badge--soft of-kitty-seconds">
              {t("ui.otomeForge.kitty.seconds", { count: seconds })}
            </span>
          ) : null}
        </div>
        <p className="of-hint">
          {moment.kind === "freeze" && moment.swapped
            ? t("ui.otomeForge.kitty.freezeDone", { name: li.name })
            : t(copy.hint, { name: li.name })}
        </p>
        {moment.kind === "nudge" ? (
          <div className="of-actions">
            <button type="button" className="of-button of-button--primary" onClick={gotcha}>
              {t("ui.otomeForge.kitty.gotcha")}
            </button>
          </div>
        ) : moment.kind === "extra" ? (
          <div className="of-actions">
            <button
              type="button"
              className="of-button of-button--primary of-kitty-sneak"
              data-holding={moment.holding || undefined}
              {...holdKeys}
            >
              {moment.holding ? t("ui.otomeForge.kitty.sneaking") : t("ui.otomeForge.kitty.sneak")}
            </button>
          </div>
        ) : moment.kind === "calculate" ? (
          <>
            <div className="of-kitty-trade" aria-hidden="true">
              <span className="of-kitty-trade-card">
                <CardBack />
                <small>{t("ui.otomeForge.kitty.tradeHis", { name: li.name })}</small>
              </span>
              <ArrowLeftRight size={18} strokeWidth={2} />
              <span className="of-kitty-trade-card">
                <CardBack />
                <small>{t("ui.otomeForge.kitty.tradeHers")}</small>
              </span>
            </div>
            <div className="of-actions">
              <button type="button" className="of-button of-button--primary" onClick={() => trade(true)}>
                {t("ui.otomeForge.kitty.tradeAccept")}
              </button>
              <button type="button" className="of-button of-button--quiet of-glass" onClick={() => trade(false)}>
                {t("ui.otomeForge.kitty.tradeRefuse")}
              </button>
            </div>
          </>
        ) : moment.kind === "steady" ? (
          <div className="of-actions">
            <button type="button" className="of-button of-button--primary" onClick={() => steady(true)}>
              {t("ui.otomeForge.kitty.takeBack")}
            </button>
            <button type="button" className="of-button of-button--quiet of-glass" onClick={() => steady(false)}>
              {t("ui.otomeForge.kitty.keepIt")}
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div
      className="of-kitty-game"
      data-turn={over ? "over" : game.turn}
      data-moves={game.moves}
      data-moment={moment?.kind}
    >
      <div className="of-claw-partner of-kitty-partner" style={{ "--of-li-accent": accent } as CSSProperties}>
        <Avatar name={li.name} url={li.portrait} accent={accent} size={40} />
        <AnimatePresence mode="wait" initial={false}>
          {bubble ? (
            <motion.p
              key={`line-${bubble.id}`}
              className="of-claw-bubble of-glass of-glass--strong"
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              aria-hidden="true"
            >
              {bubble.text}
            </motion.p>
          ) : (
            <motion.p
              key="status"
              className="of-claw-status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-hidden="true"
            >
              {status}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="of-kitty-row">
        <p className="of-kitty-his-hand" style={{ "--of-li-accent": accent } as CSSProperties}>
          <span className="of-kitty-backs" aria-hidden="true">
            {game.hands.partner.map((_, index) => (
              <CardBack key={index} />
            ))}
          </span>
          <span>{t("ui.otomeForge.kitty.hisHand", { name: li.name, count: game.hands.partner.length })}</span>
        </p>
        <p className="of-kitty-scores">
          <span data-who="me">
            {t("ui.otomeForge.kitty.you")} <strong>{points.me}</strong>
          </span>
          <span data-who="partner" style={{ "--of-li-accent": accent } as CSSProperties}>
            {li.name} <strong>{points.partner}</strong>
          </span>
        </p>
      </div>

      <ol ref={cupsRef} className="of-kitty-cups" aria-label={t("ui.otomeForge.kitty.cupsLabel")}>
        {game.cups.map((cup, index) => {
          const colour = t(COLOUR_KEYS[cup.colour]);
          const gain = selected && !cup.played ? cupPoints(selected, cup.colour) : 0;
          const playable = herTurn && !cup.played;
          const swappable = moment?.kind === "freeze" && !moment.swapped && !!cup.played;
          const played = cup.played;
          const name = played
            ? t("ui.otomeForge.kitty.cupFilled", {
                colour,
                card: label(played.card),
                by: played.by === "me" ? t("ui.otomeForge.kitty.byYou") : li.name,
                count: cupPoints(played.card, cup.colour),
              })
            : selected && playable
              ? t("ui.otomeForge.kitty.cupEmptyFor", { colour, count: gain })
              : t("ui.otomeForge.kitty.cupEmpty", { colour });
          return (
            <li key={index} data-filled={played ? "" : undefined}>
              <button
                type="button"
                className="of-kitty-cup"
                data-colour={cup.colour}
                data-cup={index}
                data-scores={(playable && gain > 0) || undefined}
                data-moved={(moved && moved.includes(index)) || undefined}
                data-picked={(moment?.kind === "freeze" && moment.first === index) || undefined}
                data-fresh={table.fresh === index || undefined}
                aria-disabled={!(playable && selected) && !swappable}
                aria-pressed={moment?.kind === "freeze" && swappable ? moment.first === index : undefined}
                aria-label={name}
                aria-describedby={hintId}
                onClick={() => (swappable ? pickSwap(index) : playCup(index))}
              >
                {played ? (
                  <>
                    <CardArt card={played.card} face={faces(played.card)} />
                    <span
                      className="of-kitty-by"
                      data-who={played.by}
                      style={{ "--of-li-accent": accent } as CSSProperties}
                      aria-hidden="true"
                    >
                      {played.by === "me"
                        ? t("ui.otomeForge.kitty.byYouShort")
                        : (Array.from(li.name)[0] ?? "").toLocaleUpperCase()}
                    </span>
                  </>
                ) : gain > 0 && playable ? (
                  <span className="of-kitty-gain" aria-hidden="true">
                    +{gain}
                  </span>
                ) : null}
                <span className="of-kitty-cup-name" aria-hidden="true">
                  {colour}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {momentPanel}

      <div className="of-kitty-row">
        <p className="of-kitty-pile">
          <CardBack />
          <span>{t("ui.otomeForge.kitty.pile", { count: game.pile.length })}</span>
        </p>
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-kitty-draw"
          aria-disabled={!canDraw}
          aria-label={t("ui.otomeForge.kitty.drawLabel", { count: game.pile.length })}
          onClick={draw}
        >
          <Layers size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.kitty.draw")}
        </button>
      </div>

      <ul
        ref={handRef}
        className="of-kitty-hand"
        aria-label={t("ui.otomeForge.kitty.handLabel", { count: game.hands.me.length })}
        style={{ "--n": game.hands.me.length } as CSSProperties}
      >
        {game.hands.me.map((card, index) => (
          <li key={card}>
            <button
              type="button"
              className="of-kitty-hand-card"
              data-card={card}
              aria-pressed={selected === card}
              aria-disabled={!herTurn}
              aria-label={label(card)}
              aria-describedby={hintId}
              style={
                {
                  "--rot": `${((index - mid) * fan).toFixed(1)}deg`,
                  "--lift": `${(Math.abs(index - mid) * 3).toFixed(1)}px`,
                } as CSSProperties
              }
              onClick={() => pickCard(card)}
            >
              <CardArt card={card} face={faces(card)} />
            </button>
          </li>
        ))}
      </ul>
      <p id={hintId} className="of-hint of-claw-keys">
        {t("ui.otomeForge.kitty.keys")}
      </p>
      <p className="of-visually-hidden" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

// ── The screen ──

type Phase =
  | { kind: "intro" }
  | { kind: "play"; seed: number; round: string; first: ClawPlayer }
  | { kind: "result"; game: KittyGame; cheat: KittyCheat | null; round: string; first: ClawPlayer };

export function KittyCards({ runKey, view, li, onExit }: ActivityScreenProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { reviewImagePromptsBeforeSend } = useOtomeProps();
  const actions = useItemActions(runKey);
  const play = usePlay(runKey, { kittens: true });
  // A kitten's tap has answered (painted, failed, or its prompt fetched for review): the play view says what it left.
  const painting = [...actions.busy].some((id) => id.startsWith("kitten:"));
  const wasPainting = useRef(false);
  useEffect(() => {
    if (wasPainting.current && !painting) void queryClient.invalidateQueries({ queryKey: playQueryKey(runKey) });
    wasPainting.current = painting;
  }, [painting, queryClient, runKey]);
  const faces = useFaces(play.data, li, view);
  const accent = accentOf(li);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [finish, setFinish] = useState<{ id: string; result?: KittyFinishResult; error?: unknown } | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const focusResult = useRef(false);

  const info = play.data?.lis[li.id] ?? null;
  const cheat: ClawCheat = info?.cheat ?? "steady";
  const rupture = !!info?.rupture;

  const send = useCallback(
    (game: KittyGame, cheatMoment: KittyCheat | null, id: string, first: ClawPlayer) => {
      const { me, partner } = score(game);
      const body: KittyFinishInput = {
        li: li.id,
        round: id,
        first,
        result: resultOf(me, partner),
        me,
        partner,
        cheat: cheatMoment,
      };
      setFinish({ id });
      finishOnce(id, () => otome.post<KittyFinishResult>(`${runPath(runKey)}/kitty/finish`, { ...body })).then(
        (result) => {
          setFinish((current) => (current?.id === id ? { id, result } : current));
          patchRun(queryClient, runKey, (current) => ({ ...current, starlight: result.starlight }));
          void queryClient.invalidateQueries({ queryKey: playQueryKey(runKey) });
          void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
        },
        (error: unknown) => setFinish((current) => (current?.id === id ? { id, error } : current)),
      );
    },
    [li.id, otome, queryClient, runKey],
  );

  const start = (first: ClawPlayer) => {
    setFinish(null);
    setPhase({ kind: "play", seed: newSeed(), round: newRoundId("k"), first });
  };

  const onDone = useCallback(
    (game: KittyGame, cheatMoment: KittyCheat | null) => {
      const current = phaseRef.current;
      if (current.kind !== "play") return;
      send(game, cheatMoment, current.round, current.first);
      focusResult.current = true;
      setPhase({ kind: "result", game, cheat: cheatMoment, round: current.round, first: current.first });
    },
    [send],
  );

  // His win or lose line on the end screen (none for a draw, or during a rupture), voiced once as it shows.
  const resultRound = phase.kind === "result" ? phase.round : null;
  const endLine = useMemo(() => {
    if (phase.kind !== "result" || rupture) return null;
    const { me, partner } = score(phase.game);
    const result = resultOf(me, partner);
    return result === "draw"
      ? null
      : pickLine(kittyPool(t, info?.lines.kitty, result === "win" ? "win" : "lose", cheat), null);
    // Once per game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultRound]);
  const voice = useLineVoice();
  useEffect(() => {
    const spoken = endLine ? { speaker: li.name, text: endLine } : null;
    if (spoken && voice.can(spoken)) voice.play(tapLineRef(li.id, spoken.text, "kitty"), spoken);
    // Once per line, as it shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endLine]);

  useEffect(() => {
    if (phase.kind !== "result" || !focusResult.current) return;
    focusResult.current = false;
    resultHeading.current?.focus({ preventScroll: true });
  }, [phase]);

  const head = (
    <div className="of-page-head of-claw-title">
      <h1 className="of-title of-title--page" tabIndex={-1}>
        {t("ui.otomeForge.kitty.title")}
      </h1>
      <p className="of-subtitle">{t("ui.otomeForge.claw.with", { name: li.name })}</p>
    </div>
  );
  const page = (children: ReactNode) => (
    <MotionConfig reducedMotion="user">
      <div className="of-page of-claw of-kitty" style={{ "--of-li-accent": accent } as CSSProperties}>
        {head}
        {children}
      </div>
      <PaintReviewDialog actions={actions} />
    </MotionConfig>
  );

  if (phase.kind === "play") {
    return page(
      <KittyTable
        key={phase.round}
        li={li}
        accent={accent}
        seed={phase.seed}
        first={phase.first}
        cheat={cheat}
        lines={info?.lines ?? null}
        rupture={rupture}
        faces={faces}
        onDone={onDone}
      />,
    );
  }

  if (phase.kind === "result") {
    const { me, partner } = score(phase.game);
    const result = resultOf(me, partner);
    const mine = finish?.id === phase.round ? finish : null;
    const paid = mine?.result;
    const failed = mine?.error;
    const starlight = paid?.grants.reduce((sum, grant) => sum + (grant.starlight ?? 0), 0) ?? 0;
    const affection = paid?.grants.reduce((sum, grant) => sum + (grant.affection ?? 0), 0) ?? 0;
    const settled = !!paid || failed !== undefined;
    return page(
      <section className="of-section of-glass of-claw-result" aria-labelledby="of-kitty-result-title">
        <h2 id="of-kitty-result-title" ref={resultHeading} className="of-section-title" tabIndex={-1}>
          {result === "win"
            ? t("ui.otomeForge.kitty.resultWin")
            : result === "lose"
              ? t("ui.otomeForge.kitty.resultLose", { name: li.name })
              : t("ui.otomeForge.kitty.resultDraw")}
        </h2>
        <p className="of-kitty-final">{t("ui.otomeForge.kitty.finalScore", { me, partner, name: li.name })}</p>
        {phase.cheat ? (
          <p className="of-hint">{t(CHEAT_NOTES[phase.cheat.kind][phase.cheat.caught ? 1 : 0], { name: li.name })}</p>
        ) : null}
        {endLine ? (
          <blockquote className="of-claw-quote" style={{ "--of-li-accent": accent } as CSSProperties}>
            <Avatar name={li.name} url={li.portrait} accent={accent} size={34} />
            <p>
              <span className="of-visually-hidden">{t("ui.otomeForge.claw.saidPrefix", { name: li.name })}</span>
              {endLine}
            </p>
          </blockquote>
        ) : null}
        <div className="of-claw-pay" role="status">
          {paid ? (
            <>
              {starlight || affection ? (
                <p className="of-claw-pay-line">
                  <Star size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                  {[
                    starlight ? t("ui.otomeForge.claw.paidStarlight", { starlight }) : "",
                    affection ? t("ui.otomeForge.claw.paidAffection", { affection, name: li.name }) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              {paid.capped ? <p className="of-hint">{t("ui.otomeForge.kitty.capped")}</p> : null}
            </>
          ) : failed === undefined ? (
            <p className="of-hint">{t("ui.otomeForge.kitty.saving")}</p>
          ) : null}
        </div>
        {failed !== undefined ? (
          <div className="of-notice of-notice--error" role="alert">
            <span>{otome.errorMessage(failed, "ui.otomeForge.kitty.saveFailed")}</span>
            <button
              type="button"
              className="of-button of-button--quiet of-glass of-button--small"
              onClick={() => send(phase.game, phase.cheat, phase.round, phase.first)}
            >
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : null}
        <div className="of-actions">
          <button
            type="button"
            className="of-button of-button--primary"
            aria-disabled={!settled}
            onClick={() => {
              if (settled) start(phase.first);
            }}
          >
            <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.claw.again")}
          </button>
          <button type="button" className="of-button of-button--quiet of-glass" onClick={onExit}>
            {t("ui.otomeForge.claw.backToDates")}
          </button>
        </div>
      </section>,
    );
  }

  // The intro: the value-5 cards (their painted kittens with images on), who goes first, how it plays and what it pays.
  const ready = !!play.data;
  const kittens = play.data?.kittens ?? [];
  const ownerName = (owner: KittenOwner) =>
    owner === "player" ? view.player.name : (view.lis.find((entry) => entry.id === owner)?.name ?? "");
  const hero = heroCards(kittens, li.id, faces, (owner) =>
    t("ui.otomeForge.kitty.asKitten", { name: ownerName(owner) }),
  );
  const target = (owner: KittenOwner): PaintTarget => ({
    id: `kitten:${owner}`,
    subject: t("ui.otomeForge.kitty.asKitten", { name: ownerName(owner) }),
    paintPath: `${runPath(runKey)}/art/kitten`,
    promptPath: `${runPath(runKey)}/art/kitten/prompt`,
    body: { owner },
  });
  const waiting = kittens.filter((kitten) => kitten.art?.state === "waiting-consent");
  const retry = kittens.filter((kitten) => kitten.art?.state === "failed" || kitten.art?.state === "stopped");
  const paintAll = (list: typeof kittens) => {
    // With prompt review, one review at a time: the button stays for the rest.
    const targets = list.map((kitten) => target(kitten.owner)).filter((each) => !actions.busy.has(each.id));
    for (const each of reviewImagePromptsBeforeSend ? targets.slice(0, 1) : targets) void actions.paint(each);
  };
  // A failure every kitten shares (no connection, say) shows once.
  const errors = [...new Set(kittens.flatMap((kitten) => actions.errors[`kitten:${kitten.owner}`] ?? []))];
  const inProgress = painting || !!play.data?.kittensPending;
  return page(
    <>
      <ul
        className="of-kitty-hero"
        aria-label={t("ui.otomeForge.kitty.heroLabel")}
        data-many={hero.length > KITTEN_CARDS.length || undefined}
        style={{ "--of-hero-count": hero.length } as CSSProperties}
      >
        {hero.map(({ key, card, face, inGame }, index) => {
          // The fan spreads over at most 28 degrees, and its middle cards sit a little higher.
          const middle = (hero.length - 1) / 2;
          const step = hero.length > 1 ? Math.min(7, 28 / (hero.length - 1)) : 0;
          const lift = middle > 0 ? Math.min(1, 1.5 * (1 - Math.abs(index - middle) / middle)) : 0;
          return (
            <li key={key} style={{ "--rot": `${(index - middle) * step}deg`, "--lift": lift } as CSSProperties}>
              <span
                role="img"
                aria-label={inGame ? cardLabel(t, card, face) : face.name}
                className="of-kitty-hero-card"
              >
                <CardArt card={card} face={face} />
              </span>
            </li>
          );
        })}
      </ul>
      {waiting.length || retry.length || inProgress || errors.length ? (
        <div className="of-kitty-paint" role="group" aria-label={t("ui.otomeForge.kitty.paintLabel")}>
          {waiting.length ? (
            <button
              type="button"
              className="of-button of-button--quiet of-glass of-button--small"
              aria-disabled={waiting.every((kitten) => actions.busy.has(`kitten:${kitten.owner}`))}
              onClick={() => paintAll(waiting)}
            >
              <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.kitty.paintKittens", { count: waiting.length })}
            </button>
          ) : null}
          {retry.length ? (
            <button
              type="button"
              className="of-button of-button--quiet of-glass of-button--small"
              aria-disabled={retry.every((kitten) => actions.busy.has(`kitten:${kitten.owner}`))}
              onClick={() => paintAll(retry)}
            >
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.kitty.paintRetry", { count: retry.length })}
            </button>
          ) : null}
          {inProgress ? (
            <p className="of-hint" role="status">
              {t("ui.otomeForge.kitty.painting")}
            </p>
          ) : null}
          {errors.map((error) => (
            <p key={error} className="of-notice of-notice--error" role="alert">
              {error}
            </p>
          ))}
        </div>
      ) : null}
      <section className="of-section of-glass of-claw-intro" aria-labelledby="of-kitty-first">
        {info ? (
          <p className="of-claw-style">
            <span className="of-eyebrow">{t("ui.otomeForge.claw.styleTitle", { name: li.name })}</span>
            <span className="of-claw-style-text">{t(STYLE_KEYS[cheat], { name: li.name })}</span>
          </p>
        ) : null}
        <h2 id="of-kitty-first" className="of-section-title">
          {t("ui.otomeForge.kitty.firstTitle")}
        </h2>
        {play.isError && !play.data ? (
          <div className="of-inline-actions" role="alert">
            <p className="of-hint">{otome.errorMessage(play.error, "ui.otomeForge.dates.loadFailed")}</p>
            <button
              type="button"
              className="of-button of-button--quiet of-glass of-button--small"
              onClick={() => void play.refetch()}
            >
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : (
          <div className="of-claw-first">
            <button
              type="button"
              className="of-button of-button--primary"
              aria-disabled={!ready}
              onClick={() => {
                if (ready) start("me");
              }}
            >
              {t("ui.otomeForge.kitty.meFirst")}
            </button>
            <button
              type="button"
              className="of-button of-button--quiet of-glass"
              aria-disabled={!ready}
              onClick={() => {
                if (ready) start("partner");
              }}
            >
              {t("ui.otomeForge.kitty.themFirst", { name: li.name })}
            </button>
          </div>
        )}
        <ul className="of-claw-rules">
          <li>{t("ui.otomeForge.kitty.ruleCups")}</li>
          <li>{t("ui.otomeForge.kitty.ruleTurns", { name: li.name })}</li>
          <li>{t("ui.otomeForge.kitty.ruleCheat", { name: li.name })}</li>
        </ul>
        <p className="of-activity-reward">
          <Star size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />
          <span>
            {t("ui.otomeForge.kitty.payRule", {
              starlight: STARLIGHT_EARNINGS.kittyGame,
              win: STARLIGHT_EARNINGS.kittyWin,
              affection: AFFECTION_EARNINGS.kittyGame,
            })}
          </span>
        </p>
        <p className="of-cost">
          <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
          <span>{t("ui.otomeForge.kitty.cost")}</span>
        </p>
      </section>
    </>,
  );
}

// ── Styles: theme/styles.ts otomeForgeStyles() adds KITTY_RULES after CLAW_RULES, whose classes this reuses (the
// partner's bubble, the intro and the end screen). The page is also `.of-claw`, so it is play under the Engine's
// ambient setting as the Claw is; under the system's reduced motion nothing animates (MOTION_RULES). ──

const R = ".of-root";

export const KITTY_RULES = `
${R} .of-kitty {
  --of-kitty-rose: #f29bb8; --of-kitty-sky: #8fc1f0; --of-kitty-lemon: #f0cd57; --of-kitty-mint: #8ed7b3;
  --of-kitty-white: #ffffff;
}
${R} .of-kitty-game { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
${R} :is(.of-kitty-row, .of-kitty-cups, .of-kitty-moment, .of-kitty-hand) { width: min(100%, 440px); }
${R} .of-kitty-game .of-claw-partner { width: min(100%, 440px); }
${R} .of-kitty-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
${R} :is(.of-kitty-his-hand, .of-kitty-pile) {
  display: inline-flex; align-items: center; gap: 8px; min-width: 0; font-size: 0.82rem; font-weight: 700;
  color: var(--of-text-soft);
}
${R} .of-kitty-backs { display: inline-flex; min-height: 26px; }
${R} .of-kitty-backs > .of-kitty-back + .of-kitty-back { margin-inline-start: -11px; }
${R} .of-kitty-back {
  display: inline-block; flex: none; width: 19px; aspect-ratio: 5 / 7; border-radius: 4px;
  border: 1.5px solid rgb(255 255 255 / 0.9); box-shadow: 0 1px 3px rgb(43 34 54 / 0.3);
  background: radial-gradient(circle, rgb(255 255 255 / 0.75) 0 1.4px, transparent 1.8px) 0 0 / 6px 6px,
    linear-gradient(150deg, color-mix(in srgb, var(--of-li-accent, ${PALETTE.rose}) 70%, #fff), var(--of-li-accent, ${PALETTE.rose}));
}
${R} .of-kitty-pile .of-kitty-back { width: 30px; }
${R} .of-kitty-scores { display: flex; gap: 12px; font-size: 0.82rem; font-weight: 700; color: var(--of-text-soft); white-space: nowrap; }
/* Numbers in the body face: the display face's old-style figures read a 1 as an I and a 10 as IO. */
${R} .of-kitty-scores strong { font-size: 1.2rem; font-weight: 800; font-variant-numeric: lining-nums tabular-nums; color: var(--of-champagne-text); }
${R} .of-kitty-scores [data-who="partner"] strong { color: color-mix(in srgb, var(--of-li-accent) 75%, var(--of-text)); }
/* A card: its kitten in a frame of its colour, its value in a corner. Everything inside sizes from the card. */
${R} .of-kitty-card {
  --kc: var(--of-kitty-rose);
  position: relative; display: block; width: 100%; aspect-ratio: 5 / 7; container-type: inline-size; overflow: clip;
  border-radius: 14% / 10%; border: 2.5px solid var(--kc);
  background: radial-gradient(90% 60% at 50% 35%, #fff 0%, color-mix(in srgb, var(--kc) 30%, #fff) 70%),
    color-mix(in srgb, var(--kc) 40%, #fff);
  box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.75), 0 3px 8px rgb(43 34 54 / 0.28);
}
${R} .of-kitty-card[data-colour="sky"] { --kc: var(--of-kitty-sky); }
${R} .of-kitty-card[data-colour="lemon"] { --kc: var(--of-kitty-lemon); }
${R} .of-kitty-card[data-colour="mint"] { --kc: var(--of-kitty-mint); }
${R} .of-kitty-art { position: absolute; inset: 14% 4% 4%; width: 92%; height: 82%; object-fit: contain; pointer-events: none; }
${R} .of-kitty-value {
  position: absolute; top: 4%; inset-inline-start: 6%; display: grid; place-items: center; width: 30cqi; height: 30cqi;
  border-radius: 50%; font-weight: 800; font-size: 19cqi; font-variant-numeric: lining-nums; line-height: 1;
  color: ${PALETTE.ink}; background: #fff; border: 2px solid var(--kc);
}
${R} .of-kitty-card[data-painted] { box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.75), 0 0 0 2px ${PALETTE.champagne}, 0 3px 10px rgb(43 34 54 / 0.3); }
/* The cups: two rows of four, each in its colour; those the picked card would score in light up. */
${R} .of-kitty-cups { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-kitty-cup {
  --kc: var(--of-kitty-rose);
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px;
  width: 100%; aspect-ratio: 4 / 5; padding: 6px 5px 5px; border-radius: 14px 14px 24px 24px; cursor: pointer;
  border: 2px solid color-mix(in srgb, var(--kc) 80%, #2b2236); color: var(--of-text);
  background: linear-gradient(180deg, color-mix(in srgb, var(--kc) 18%, var(--of-surface)), color-mix(in srgb, var(--kc) 42%, var(--of-surface)));
  box-shadow: inset 0 -5px 10px rgb(43 34 54 / 0.12);
  transition: transform 160ms var(--of-ease), box-shadow 200ms var(--of-ease);
}
${R} .of-kitty-cup[data-colour="sky"] { --kc: var(--of-kitty-sky); }
${R} .of-kitty-cup[data-colour="lemon"] { --kc: var(--of-kitty-lemon); }
${R} .of-kitty-cup[data-colour="mint"] { --kc: var(--of-kitty-mint); }
${R} .of-kitty-cup[data-colour="white"] { --kc: var(--of-kitty-white); border-color: var(--of-border-strong); }
${R} .of-kitty-cup[aria-disabled="true"] { cursor: default; }
${R} .of-kitty-cup[data-scores] {
  box-shadow: 0 0 0 3px ${PALETTE.champagne}, 0 0 16px var(--of-glow-soft); transform: translateY(-2px);
}
${R} .of-kitty-cup[data-picked] { outline: 3px dashed ${PALETTE.champagne}; outline-offset: 2px; }
${R} .of-kitty-cup[data-moved] { animation: of-kitty-wiggle 620ms ease-in-out; }
${R} .of-kitty-cup[data-fresh] .of-kitty-card { animation: of-kitty-land 420ms var(--of-ease); }
${R} .of-kitty-cup .of-kitty-card { width: 74%; }
${R} .of-kitty-cup-name { font-size: 0.6rem; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; line-height: 1; }
${R} .of-kitty-by {
  position: absolute; top: 3px; inset-inline-end: 3px; display: grid; place-items: center; min-width: 18px; height: 18px;
  padding: 0 4px; border-radius: 999px; font-size: 0.6rem; font-weight: 800; color: ${PALETTE.ink};
  background: ${PALETTE.champagne}; box-shadow: 0 1px 3px rgb(43 34 54 / 0.3);
}
${R} .of-kitty-by[data-who="partner"] { background: var(--of-li-accent); }
${R} .of-kitty-gain { margin: auto; font-weight: 800; font-size: 1.15rem; color: var(--of-champagne-text); }
/* His cheat moment. */
${R} .of-kitty-moment {
  display: flex; flex-direction: column; gap: 6px; padding: 10px 13px; border-radius: 18px;
  border-color: color-mix(in srgb, var(--of-li-accent) 60%, transparent);
}
${R} .of-kitty-moment-head { display: flex; align-items: center; gap: 8px; }
${R} .of-kitty-moment-head svg { flex: none; color: color-mix(in srgb, var(--of-li-accent) 70%, var(--of-text)); }
${R} .of-kitty-moment h2 { flex: 1; min-width: 0; font-family: var(--of-font-display); font-size: 1.12rem; line-height: 1.15; }
${R} .of-kitty-seconds { font-variant-numeric: tabular-nums; }
${R} .of-kitty-moment .of-actions { justify-content: flex-start; }
${R} .of-kitty-sneak { position: relative; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; }
${R} .of-kitty-sneak[data-holding]::after {
  content: ""; position: absolute; inset: auto 0 0 0; height: 4px; background: ${PALETTE.ink}; opacity: 0.5;
  transform-origin: left; animation: of-kitty-hold ${KITTY_CHEAT_SECONDS.extra}s linear forwards;
}
${R} .of-kitty-trade { display: flex; align-items: center; gap: 12px; }
${R} .of-kitty-trade-card { display: inline-flex; flex-direction: column; align-items: center; gap: 3px; font-size: 0.72rem; color: var(--of-text-soft); }
${R} .of-kitty-trade-card .of-kitty-back { width: 40px; }
/* Her hand, fanned: the cards overlap as it grows, and the picked one rises. */
${R} .of-kitty-hand {
  --w: 62px; display: flex; justify-content: center; align-items: flex-end; min-height: 108px; margin: 0;
  padding: 16px 4px 4px; list-style: none;
}
${R} .of-kitty-hand > li { flex: none; width: var(--w); }
${R} .of-kitty-hand > li + li {
  margin-inline-start: clamp(-36px, calc((100% - var(--n) * var(--w)) / max(var(--n) - 1, 1)), 4px);
}
${R} .of-kitty-hand-card {
  display: block; width: 100%; padding: 0; border: 0; border-radius: 9px; background: none; cursor: pointer;
  transform-origin: 50% 130%; transform: translateY(var(--lift)) rotate(var(--rot));
  transition: transform 200ms var(--of-ease);
}
${R} .of-kitty-hand-card[aria-pressed="true"] { position: relative; z-index: 2; transform: translateY(-16px) rotate(0deg); }
${R} .of-kitty-hand-card[aria-pressed="true"] .of-kitty-card { box-shadow: 0 0 0 3px ${PALETTE.champagne}, 0 8px 18px rgb(43 34 54 / 0.35); }
${R} .of-kitty-hand-card:hover:not([aria-disabled="true"]) { position: relative; z-index: 1; }
${R} .of-kitty-hand-card[aria-disabled="true"] { cursor: default; }
${R} .of-kitty-final { font-weight: 800; font-size: 1.15rem; font-variant-numeric: lining-nums; }
/* The intro's value-5 cards and every painted kitten (with images on), and the paint controls. More than four cards
   overlap like a fanned hand so the row always fits its column. */
${R} .of-kitty-hero { display: flex; justify-content: center; gap: 2px; margin: 4px 0 0; padding: 0; list-style: none; }
${R} .of-kitty-hero > li { width: min(22%, 92px); rotate: var(--rot); translate: 0 calc(var(--lift, 0) * -6px); }
${R} .of-kitty-hero[data-many] { gap: 0; }
${R} .of-kitty-hero[data-many] > li { width: min(calc(140% / var(--of-hero-count)), 92px); }
${R} .of-kitty-hero[data-many] > li + li { margin-inline-start: calc(-50% / var(--of-hero-count)); }
${R} .of-kitty-hero-card { display: block; }
${R} .of-kitty-paint { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; }
@keyframes of-kitty-wiggle { 25% { transform: rotate(-4deg); } 50% { transform: rotate(3deg); } 75% { transform: rotate(-2deg); } }
@keyframes of-kitty-land { from { transform: translateY(-18px) scale(0.85); opacity: 0.4; } to { transform: none; opacity: 1; } }
@keyframes of-kitty-hold { from { transform: scaleX(0); } to { transform: scaleX(1); } }`;
