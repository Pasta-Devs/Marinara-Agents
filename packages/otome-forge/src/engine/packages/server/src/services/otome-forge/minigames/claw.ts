// ──────────────────────────────────────────────
// Otome Forge: the Claw Machine's server side (plan M5 "Claw Machine"): the round's pay, the shelf, and his memory
// ──────────────────────────────────────────────
// The game itself runs in the client (C/lib/claw-physics.ts). Nothing here calls a model or paints an image, and the
// route never starts memory upkeep (which may summarize other canon): a round's memory is written by us, not a model,
// and the kit records a `chat` source as it stands on the next upkeep.
//
// finishClawRound is the whole state change of a finished round, applied inside one revision-checked write of
// `${R}:state`, so the pay, the shelf, the first-plushie timeline entry and the round record land together, once:
// - a round id already in `claw.rounds` is a replay: the same answer, and nothing is paid again (each love interest's
//   newest rounds are kept, schemas/state.ts keepClawRounds, so playing with one never evicts another's);
// - only the six series plushes and the partner's own (`li:<li>`) are prizes, each at most once, at most seven;
// - every round pays, even one that caught nothing: 20 Starlight plus 30 per plush, and 30 affection with the partner,
//   within the day's activity caps (S/state/rewards.ts grant). The caps limit rewards, never play.
// ponytail: the server trusts the client's catch list within the daily activity cap; the ceiling is that someone
// calling the route by hand earns at most that cap, and the upgrade path is a start-token document holding the seed.
//
// clawMemorySources makes each kept round a `chat` source with `audience: [li]`, titled private as a phone session is:
// only his own readers and scenes he is in recall it, never the shared overview (plan §1.9, design: Private memory).
// His plush wears his worn look, cut out of its background once Home has made the cut-out (M3, S/art/cutout.ts); the
// Claw Machine never asks for one, since a cut-out is an Engine call. His lines come with the play view, read from the
// packs he has (S/home/lines.ts linesView): the machine never asks GET /lis/:li/lines, which queues a missing pack's
// write (a model call).
import type { ForgeMemorySource } from "@forge-kit/story-memory.mjs";
import type {
  ActivityGrant,
  ClawCheat,
  LiId,
  RunState,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  clawPrizeIds,
  isPlushSeries,
  liPlushId,
  plushLi,
  type ClawFinishInput,
  type ClawFinishResult,
  type ClawRound,
  type PlayView,
  type PlushSeries,
} from "../../../../../client/src/features/otome-forge/shared/claw.js";
import {
  ACTIVITY_STARLIGHT_DAILY_CAP,
  AFFECTION_EARNINGS,
  OUTSIDE_AFFECTION_DAILY_CAP,
  STARLIGHT_EARNINGS,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { plushSvgUrl } from "../art/plush-svg.js";
import { linesView } from "../home/lines.js";
import { OtomeForgeError } from "../http.js";
import { wornLookUrl } from "../schemas/common.js";
import { STATE_LIMITS, clipText, keepClawRounds, keepTimeline } from "../schemas/state.js";
import { grant } from "../state/rewards.js";

/** The Love Timeline's kind (and `firsts` key) for his own plush joining the shelf. */
export const FIRST_PLUSH = "first-plush";
const NAME_MAX = 200;

const badRequest = (message: string) => new OtomeForgeError(400, message, "bad-request");

/** A stable pick from `lines` for this round (the same line on a replay). */
function lineFor(lines: readonly string[] | undefined, round: string): string | undefined {
  const usable = (lines ?? []).filter((line) => line.trim());
  if (!usable.length) return undefined;
  let hash = 0;
  for (const char of round) hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) >>> 0;
  return usable[hash % usable.length];
}

/** How he cheats: his bible's, else the steady hand the play view shows for a love interest with no bible yet. */
const cheatOf = (unit: Pick<Unit, "bible"> | undefined): ClawCheat => unit?.bible?.play.cheat ?? "steady";

/** The catch list, checked: known prizes of this machine only, each at most once (the length is the body's check). */
export function checkCatches(input: Pick<ClawFinishInput, "li" | "caught">): void {
  const allowed = new Set(clawPrizeIds(input.li));
  const seen = new Set<string>();
  for (const { prize } of input.caught) {
    if (!allowed.has(prize)) throw badRequest(`Not a prize of this claw machine: ${prize.slice(0, 60)}`);
    if (seen.has(prize)) throw badRequest(`A prize is caught at most once a round: ${prize.slice(0, 60)}`);
    seen.add(prize);
  }
}

function grantsOf(round: Pick<ClawRound, "li" | "paid">): ActivityGrant[] {
  const grants: ActivityGrant[] = [];
  if (round.paid.starlight) grants.push({ source: "claw", starlight: round.paid.starlight });
  if (round.paid.affection) grants.push({ source: "claw", li: round.li, affection: round.paid.affection });
  return grants;
}

function resultOf(round: ClawRound, state: RunState, replay: boolean): ClawFinishResult {
  return {
    grants: grantsOf(round),
    newPlush: round.newPlush,
    firstPlush: round.firstPlush,
    ...(round.line ? { line: round.line } : {}),
    capped: round.capped,
    replay,
    plush: { ...state.owned.plush },
    starlight: state.wallet.starlight,
  };
}

/**
 * The state after the round `input` is finished with `unit` (his name, his cheat, his plush line), and the answer.
 * Throws a 400 for a catch list that is not this machine's, and a 409 for a round id already used with another love
 * interest. `dayKey` is the request's local day.
 */
export function finishClawRound(
  state: RunState,
  unit: Pick<Unit, "id" | "name" | "bible" | "lines">,
  input: ClawFinishInput,
  { at, dayKey }: { at: string; dayKey: string },
): { state: RunState; result: ClawFinishResult } {
  const kept = state.claw.rounds.find((round) => round.id === input.round);
  if (kept) {
    if (kept.li !== input.li)
      throw new OtomeForgeError(409, "That claw round was played with someone else.", "conflict");
    return { state, result: resultOf(kept, state, true) };
  }
  checkCatches(input);
  const li = input.li;
  const starlight = STARLIGHT_EARNINGS.clawRound + STARLIGHT_EARNINGS.clawPlush * input.caught.length;
  const affection = AFFECTION_EARNINGS.clawRound;
  const paid = grant(state, { source: "claw", starlight, li, affection }, dayKey);
  let next = paid.state;

  const plush = { ...next.owned.plush };
  const newPlush: string[] = [];
  for (const { prize } of input.caught) {
    if (!plush[prize]) newPlush.push(prize);
    plush[prize] = (plush[prize] ?? 0) + 1;
  }
  next = { ...next, owned: { ...next.owned, plush } };

  const firstPlush = newPlush.includes(liPlushId(li));
  const liState = next.lis[li];
  if (firstPlush && liState && !liState.firsts[FIRST_PLUSH]) {
    next = {
      ...next,
      lis: { ...next.lis, [li]: { ...liState, firsts: { ...liState.firsts, [FIRST_PLUSH]: at } } },
      timeline: keepTimeline([
        ...next.timeline,
        {
          at,
          li,
          kind: FIRST_PLUSH,
          text: clipText(`${unit.name}'s plush joined the shelf.`, STATE_LIMITS.text),
          ref: `claw/${input.round}`,
        },
      ]),
    };
  }

  // During a rupture only his cold lines are his to say (S/home/lines.ts linesView), so the plush comes with none.
  const line = firstPlush && !liState?.rupture ? lineFor(unit.lines?.fixed?.claw.plush, input.round) : undefined;
  const round: ClawRound = {
    id: input.round,
    li,
    // By UTF-16 units, as the state's schema counts them: a longer name would drop the round (and its replay guard).
    name: clipText(unit.name, NAME_MAX),
    at,
    first: input.first,
    caught: input.caught.map(({ prize, by }) => ({ prize, by })),
    cheat: input.cheered ? cheatOf(unit) : null,
    paid: { starlight: paid.granted.starlight, affection: paid.granted.affection },
    capped: paid.granted.starlight < starlight || paid.granted.affection < affection,
    newPlush,
    firstPlush,
    ...(line ? { line } : {}),
  };
  next = { ...next, claw: { rounds: keepClawRounds([...next.claw.rounds, round]) } };
  return { state: next, result: resultOf(round, next, false) };
}

/**
 * The picture his plush wears: the cut-out of his worn look (M4's Wear at home, else his portrait, as Home's is:
 * S/routes/home.ts lookOf) once it is ready, else the look itself; none without one.
 */
export function plushArtOf(unit: Pick<Unit, "portrait" | "cutouts" | "outfits" | "wornOutfit">): string | undefined {
  const look = wornLookUrl(unit);
  if (!look) return undefined;
  const cut = unit.cutouts[look];
  return cut?.state === "ready" && cut.url ? cut.url : look;
}

/**
 * GET /runs/:run/play: today's capped earnings (zero on a new local day), the shelf, and how each LI plays (the
 * picture their plush wears, and their claw and cold lines). `dates` is whether Date Night with each love interest is
 * Make it right (S/minigames/date-night.ts makeItRightView); a rupture stands for it where it says nothing.
 */
export function playView(
  state: RunState,
  units: ReadonlyArray<
    Pick<Unit, "id" | "bible" | "portrait" | "cutouts" | "outfits" | "wornOutfit" | "lines" | "plushArt">
  >,
  dayKey: string,
  dates: Record<LiId, boolean> = {},
): PlayView {
  const today = state.daily.dayKey === dayKey;
  const lis: PlayView["lis"] = {};
  for (const id of Object.keys(state.lis)) {
    const unit = units.find((entry) => entry.id === id);
    const play = unit?.bible?.play;
    const rupture = state.lis[id]!.rupture !== null;
    const plush = unit ? plushArtOf(unit) : undefined;
    const animal = plushSvgUrl(unit?.plushArt?.svg);
    const { claw, cold } = unit ? linesView(unit, state.lis[id]!) : { claw: null, cold: [] };
    lis[id] = {
      cheat: cheatOf(unit),
      style: play?.style ?? "",
      rupture,
      makeItRight: dates[id] ?? rupture,
      ...(plush ? { plush } : {}),
      ...(animal ? { animal } : {}),
      lines: { claw, cold },
    };
  }
  return {
    dayKey,
    starlight: { earned: today ? state.daily.starlight : 0, cap: ACTIVITY_STARLIGHT_DAILY_CAP },
    affection: { earned: today ? { ...state.daily.affection } : {}, cap: OUTSIDE_AFFECTION_DAILY_CAP },
    plush: { ...state.owned.plush },
    lis,
  };
}

// ── His private memory of each round ──

const SERIES_NAMES: Record<PlushSeries, string> = {
  chick: "a chick plush",
  bunny: "a bunny plush",
  kitty: "a kitty plush",
  star: "a star plush",
  bear: "a bear plush",
  whale: "a whale plush",
};

/** How his cheat reads in memory, with no pronoun (`P` is the protagonist's name). */
const CHEAT_MEMORY: Record<ClawCheat, (protagonist: string) => string> = {
  steady: () => "steadying the claw by hand",
  nudge: () => "bumping the machine until a prize tumbled down the chute",
  extra: (protagonist) => `slipping ${protagonist} an extra try`,
  freeze: (protagonist) => `slowing the claw's swing for ${protagonist}`,
  calculate: (protagonist) => `working out the angle and showing ${protagonist} exactly where to drop`,
};

function prizeName(prize: string, name: string): string {
  if (isPlushSeries(prize)) return SERIES_NAMES[prize];
  return plushLi(prize) ? `a plush of ${name}` : "a plush";
}

function list(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** What he remembers of a round, in plain words and without pronouns. */
export function clawMemoryText(round: ClawRound, protagonist: string): string {
  const name = round.name || "they";
  const player = protagonist || "the protagonist";
  const sentences = [
    `${player} and ${name} played a claw machine together${round.first === "partner" ? `, ${name} going first` : ""}.`,
  ];
  if (round.cheat)
    sentences.push(`${player} cheered ${name} on until ${name} cheated, ${CHEAT_MEMORY[round.cheat](player)}.`);
  const mine = round.caught.filter((entry) => entry.by === "me").map((entry) => prizeName(entry.prize, name));
  const theirs = round.caught.filter((entry) => entry.by === "partner").map((entry) => prizeName(entry.prize, name));
  if (mine.length) sentences.push(`${player} won ${list(mine)}.`);
  if (theirs.length) sentences.push(`${name} won ${list(theirs)} and put it on ${player}'s shelf.`);
  if (!mine.length && !theirs.length) sentences.push("Neither of them won a plush.");
  if (round.firstPlush) sentences.push(`It was the first plush of ${name} on the shelf.`);
  return sentences.join(" ");
}

/**
 * Where a round sits in story order: after the main chapters completed before it, among the side stories by time
 * (the order S/phone/memory.ts gives phone sessions).
 */
function orderOf(state: RunState, at: string): number {
  const mainDone = Object.entries(state.chapters).filter(
    ([key, progress]) => key.startsWith("main-") && progress.completed && progress.completed < at,
  ).length;
  return mainDone * 10000 + 5000 + (Date.parse(at) || 0) / 1e13;
}

/** Each kept round of a love interest the run still has, as a `chat` source only he recalls. */
export function clawMemorySources(state: RunState, protagonist: string): ForgeMemorySource[] {
  return state.claw.rounds
    .filter((round) => state.lis[round.li])
    .map((round) => ({
      id: `claw:${round.id}`,
      kind: "chat" as const,
      // Private, as S/phone/memory.ts titles a phone session: a scene with others in it recalls it as theirs alone.
      title: `The claw machine with ${round.name || "a love interest"} (private: only ${round.name || "that love interest"} and the protagonist know how it went)`,
      content: clawMemoryText(round, protagonist),
      order: orderOf(state, round.at),
      audience: [round.li as LiId],
    }));
}
