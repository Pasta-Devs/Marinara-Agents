// ──────────────────────────────────────────────
// Otome Hearth: Kitty Cards' server side (0.35.0): a game's pay and his memory of it
// ──────────────────────────────────────────────
// The game runs in the client by SH/kitty.ts's rules. Nothing here calls a model or paints an image, and the route
// never starts memory upkeep: as a Claw round's (S/minigames/claw.ts), a game's memory is written by us, and the kit
// records a `chat` source as it stands on the next upkeep.
//
// finishKittyGame is the whole state change of a finished game, applied inside one revision-checked write of
// `${R}:state`, so the pay and the record land together, once:
// - a game id already in `kitty.rounds` is a replay: the same answer, and nothing is paid again (each love interest's
//   newest games are kept, schemas/state.ts keepClawRounds); the same id with another love interest is a 409;
// - the result must be the one its points make, and a cheat must be his own (bible.play.cheat, "steady" without a
//   bible), found out only when it can be (SH/kitty.ts KITTY_CATCHABLE);
// - every game pays 20 Starlight and 30 affection with the partner, and a win 20 Starlight more, within the day's
//   activity caps (S/state/rewards.ts grant). The caps limit rewards, never play.
// ponytail: the server trusts the client's result and points within the daily activity cap, as the Claw trusts its
// catch list; the ceiling is that someone calling the route by hand earns at most that cap, and the upgrade path is a
// start-token document holding the seed, so the server can replay the moves.
//
// kittyMemorySources makes each kept game a `chat` source with `audience: [li]`, titled private as a Claw round is:
// only his own readers and scenes he is in recall it, never the shared overview (plan §1.9, design: Private memory).
import type { ForgeMemorySource } from "@forge-kit/story-memory.mjs";
import type {
  ActivityGrant,
  ClawCheat,
  LiId,
  RunState,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  AFFECTION_EARNINGS,
  STARLIGHT_EARNINGS,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";
import {
  KITTY_CATCHABLE,
  resultOf,
  type KittyFinishInput,
  type KittyFinishResult,
  type KittyRound,
} from "../../../../../client/src/features/otome-forge/shared/kitty.js";
import { OtomeForgeError } from "../http.js";
import { clipText, keepClawRounds } from "../schemas/state.js";
import { grant } from "../state/rewards.js";
import { cheatOf, orderOf } from "./claw.js";

const NAME_MAX = 200;

const badRequest = (message: string) => new OtomeForgeError(400, message, "bad-request");

/** The finish, checked against its own points and his cheat: a 400 for a game these rules could not have ended in. */
export function checkKittyFinish(input: KittyFinishInput, unit: Pick<Unit, "bible">): void {
  if (input.result !== resultOf(input.me, input.partner)) {
    throw badRequest(`A ${input.me} to ${input.partner} game is not a ${input.result}.`);
  }
  if (!input.cheat) return;
  if (input.cheat.kind !== cheatOf(unit)) throw badRequest(`Not how this love interest cheats: ${input.cheat.kind}`);
  if (input.cheat.caught && !KITTY_CATCHABLE.includes(input.cheat.kind)) {
    throw badRequest(`A ${input.cheat.kind} cheat is never caught.`);
  }
}

function grantsOf(round: Pick<KittyRound, "li" | "paid">): ActivityGrant[] {
  const grants: ActivityGrant[] = [];
  if (round.paid.starlight) grants.push({ source: "kitty", starlight: round.paid.starlight });
  if (round.paid.affection) grants.push({ source: "kitty", li: round.li, affection: round.paid.affection });
  return grants;
}

const resultFor = (round: KittyRound, state: RunState, replay: boolean): KittyFinishResult => ({
  grants: grantsOf(round),
  capped: round.capped,
  replay,
  starlight: state.wallet.starlight,
});

/**
 * The state after the game `input` is finished with `unit` (his name and his cheat), and the answer. Throws a 400 for
 * a finish these rules could not have ended in, and a 409 for a game id already used with another love interest.
 * `dayKey` is the request's local day.
 */
export function finishKittyGame(
  state: RunState,
  unit: Pick<Unit, "name" | "bible">,
  input: KittyFinishInput,
  { at, dayKey }: { at: string; dayKey: string },
): { state: RunState; result: KittyFinishResult } {
  const kept = state.kitty.rounds.find((round) => round.id === input.round);
  if (kept) {
    if (kept.li !== input.li) throw new OtomeForgeError(409, "That game was played with someone else.", "conflict");
    return { state, result: resultFor(kept, state, true) };
  }
  checkKittyFinish(input, unit);
  const starlight = STARLIGHT_EARNINGS.kittyGame + (input.result === "win" ? STARLIGHT_EARNINGS.kittyWin : 0);
  const affection = AFFECTION_EARNINGS.kittyGame;
  const paid = grant(state, { source: "kitty", starlight, li: input.li, affection }, dayKey);
  const round: KittyRound = {
    id: input.round,
    li: input.li,
    // By UTF-16 units, as the state's schema counts them: a longer name would drop the game (and its replay guard).
    name: clipText(unit.name, NAME_MAX),
    at,
    first: input.first,
    result: input.result,
    me: input.me,
    partner: input.partner,
    cheat: input.cheat ? { kind: input.cheat.kind, caught: input.cheat.caught } : null,
    paid: { starlight: paid.granted.starlight, affection: paid.granted.affection },
    capped: paid.granted.starlight < starlight || paid.granted.affection < affection,
  };
  const next = { ...paid.state, kitty: { rounds: keepClawRounds([...paid.state.kitty.rounds, round]) } };
  return { state: next, result: resultFor(round, next, false) };
}

// ── His private memory of each game ──

const points = (count: number) => `${count} ${count === 1 ? "point" : "points"}`;

/** How his cheat moment reads in memory, with no pronoun (`P` is the protagonist's name, `L` his). */
const CHEAT_MEMORY: Record<ClawCheat, (P: string, L: string, caught: boolean) => string> = {
  // An offer, as the trade is: she may keep the card where it is, and the game does not record which (Dottore, #2372).
  steady: (P, L) => `${L} offered to let ${P} take back a card and play it again.`,
  nudge: (P, L, caught) =>
    caught
      ? `${L} cheated, swapping the kittens of two cups, and ${P} caught it in time, so the kittens went back.`
      : `${L} cheated, swapping the kittens of two cups, and ${P} never caught it.`,
  freeze: (P, L, caught) =>
    caught
      ? `${L} dozed off for a moment so ${P} could swap two cups' kittens, then woke, noticed and swapped them back.`
      : `${L} dozed off for a moment, leaving ${P} free to swap two cups' kittens unseen.`,
  extra: (P, L, caught) =>
    caught
      ? `${L} looked away so ${P} could sneak an extra card, but turned back first, and ${P} drew nothing.`
      : `${L} looked away so ${P} could sneak an extra card.`,
  calculate: (P, L) => `${L} offered ${P} a trade: one card for another, face down.`,
};

/** What he remembers of a game, in plain words and without pronouns. */
export function kittyMemoryText(round: KittyRound, protagonist: string): string {
  const name = round.name || "they";
  const player = protagonist || "the protagonist";
  const sentences = [
    `${player} and ${name} played Kitty Cards together, ${round.first === "partner" ? name : player} going first.`,
  ];
  if (round.cheat) sentences.push(CHEAT_MEMORY[round.cheat.kind](player, name, round.cheat.caught));
  sentences.push(
    round.result === "win"
      ? `${player} won, ${points(round.me)} to ${round.partner}.`
      : round.result === "lose"
        ? `${name} won, ${points(round.partner)} to ${round.me}.`
        : `It was a draw, ${points(round.me)} each.`,
  );
  return sentences.join(" ");
}

/** Each kept game of a love interest the run still has, as a `chat` source only he recalls. */
export function kittyMemorySources(state: RunState, protagonist: string): ForgeMemorySource[] {
  return state.kitty.rounds
    .filter((round) => state.lis[round.li])
    .map((round) => ({
      id: `kitty:${round.id}`,
      kind: "chat" as const,
      // Private, as a Claw round is titled: a scene with others in it recalls it as theirs alone.
      title: `Kitty Cards with ${round.name || "a love interest"} (private: only ${round.name || "that love interest"} and the protagonist know how it went)`,
      content: kittyMemoryText(round, protagonist),
      order: orderOf(state, round.at),
      audience: [round.li as LiId],
    }));
}
