// ──────────────────────────────────────────────
// Otome Hearth: her friends join the story (#2458, part 1)
// ──────────────────────────────────────────────
// POST /runs/:run/friends writes one friend: someone she has met (a side character who spoke in a scene, S/story/
// side-cast.ts, with the Engine card their name matches or one the player picks), one of the player's cards, or
// someone new from a name and notes. As with a love interest who arrives mid-story (S/story/introduce.ts), the unit is
// written first, then their bible (one structured call, friendBibleMessages), then they join `state.friends` LAST, in
// a revision-checked write that checks again that one may join (SH/friends.ts friendBlock: as many friends as love
// interests, one per story arc). A failed bible leaves the unit without one, out of the friends, and the same friend
// again takes that unit back and pays for no second unit. A friend's unit never has a love interest's `bible`, so
// nothing that means the love interests counts them (S/schemas/state.ts readCastUnits reads `state.lis` alone).
// Their portrait and faces are painted as a love interest's are (setup/forge.ts forgeCast gives them a paint step on
// the next read; art/expressions.ts paints their faces once they speak).
import type { Player, Pronouns, Unit, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import type {
  Beat,
  Chapter,
  ChapterKind,
  LiId,
  RunState,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  defaultFriendState,
  friendAirKey,
  friendBlock,
  friendRankOf,
  type FriendBible,
} from "../../../../../client/src/features/otome-forge/shared/friends.js";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { generateJson, type GenerationDeps } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { newLiId, runDocTarget, sideCastId, stateId, unitId } from "../ids.js";
import { friendBibleMessages, type FriendCard } from "../prompts.js";
import { castOf, readCard } from "../setup/cast.js";
import { normalizeSideCast, type SidePerson } from "../schemas/side-cast.js";
import { normalizeState, readRun } from "../schemas/state.js";
import { FriendBibleSchema, normalizeUnit } from "../schemas/unit.js";
import type { OtomeStore } from "../store.js";
import { listArcs } from "./arc.js";
import { mainChapters } from "./chapters.js";
import { canonicalSegments, readBeat } from "./canon.js";
import { namesClash, namesPerson, readLines, sideScenes } from "./side-cast.js";

/** Who joins: someone she has met (by their side-cast key), one of the player's cards, or someone new. */
export type FriendArrival =
  | { source: "met"; key: string; pronouns: Pronouns; cardId?: string }
  | { source: "card"; cardId: string; pronouns: Pronouns }
  | { source: "new"; name: string; pronouns: Pronouns; notes?: string };

export type FriendDeps = GenerationDeps & {
  runtime: GenerationDeps["runtime"] & Pick<CapabilityRuntimeHost, "resources">;
  store: OtomeStore;
};

const VOICE_GENDER = { man: "male", woman: "female", person: "" } as const;
/** The control characters a name may never carry (the setup route's rule). */
const CONTROL = /[\u0000-\u001f\u007f]/u;
const NOTES_MAX = 500;
/** The newest people she has met that Add a friend offers. */
export const MET_MAX = 40;

const refused = (message: string) => new OtomeForgeError(400, message, "bad-request");
const notNow = (message: string) => new OtomeForgeError(409, message, "conflict");

/** The chapters her friends come into: the story's own (main), and the love interests' route and repair chapters. */
const FRIENDS_IN: ReadonlySet<ChapterKind> = new Set(["main", "route", "repair"]);

/**
 * #2458: her friends as the story prompts see them, for a chapter of `kind`; none for any other kind, unless the
 * chapter is a friend's own story or the story's ending (`theirs`).
 */
export function friendCards(
  run: { friends?: readonly Unit[]; state: Pick<RunState, "friends" | "chapters"> },
  kind: ChapterKind,
  theirs = false,
): FriendCard[] | undefined {
  if (!FRIENDS_IN.has(kind) && !theirs) return undefined;
  const cards = (run.friends ?? []).flatMap((unit) => {
    const friend = run.state.friends[unit.id];
    return friend && unit.friend ? [{ unit, level: friendRankOf(friend.points, run.state.chapters, unit.id) }] : [];
  });
  return cards.length ? cards : undefined;
}

/** The story arc being played: the newest planned, 0 before the first. */
export async function currentArc(store: Pick<OtomeStore, "listRun">, runId: string): Promise<number> {
  return (await listArcs(store, runId)).at(-1)?.number ?? 0;
}

/** The message for a friendBlock reason. */
const blocked = (reason: "full" | "arc" | "ending") =>
  notNow(
    reason === "full"
      ? "This story already has as many friends as love interests."
      : reason === "arc"
        ? "A friend has already joined in this story arc."
        : "The story is ending, so no new friend joins.",
  );

/** The side characters she has met who are not a love interest, a friend or the protagonist, newest first. */
export function metPeople(
  people: Record<string, SidePerson>,
  taken: { player: Pick<Player, "name">; units: ReadonlyArray<Pick<Unit, "name">> },
): SidePerson[] {
  return Object.values(people)
    .filter(
      (person) =>
        !namesPerson(person.name, taken.player.name) &&
        !taken.units.some((unit) => namesPerson(person.name, unit.name)),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MET_MAX);
}

/** Keeps only the love interests the bible may speak of: their stance is keyed by id. */
function withCast(bible: FriendBible, lis: ReadonlyArray<Pick<Unit, "id">>): FriendBible {
  const ids = new Set(lis.map((li) => li.id));
  return { ...bible, onLis: Object.fromEntries(Object.entries(bible.onLis).filter(([id]) => ids.has(id))) };
}

/**
 * Writes one friend and returns who they are (see the header). 400 when the name or card is unusable or the person is
 * a love interest, a friend already or the protagonist; 409 while the story is being forged, or when no friend may
 * join now.
 */
export async function addFriend(
  deps: FriendDeps,
  runId: string,
  arrival: FriendArrival,
  { debugMode, signal }: { debugMode?: boolean; signal?: AbortSignal } = {},
): Promise<{ id: string; name: string }> {
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
  if (run.world.forge.phase !== "ready") throw notNow("The world is still being forged.");
  const arc = await currentArc(deps.store, runId);
  // #2459: once the finale is planned, no friend joins.
  const ending = (await mainChapters(deps.store, runId)).some((chapter) => chapter.ending === "finale");
  const block = ending ? "ending" : friendBlock(run.units.length, Object.values(run.state.friends), arc);
  if (block) throw blocked(block);

  let name = "";
  let cardId: string | undefined;
  let notes = "";
  let met: SidePerson | undefined;
  if (arrival.source === "met") {
    met = (await deps.store.readDoc(sideCastId(runId), normalizeSideCast))?.people[arrival.key];
    if (!met) throw refused("No one by that name has spoken in the story yet.");
    name = met.name;
    cardId = arrival.cardId ?? met.cardId;
  } else if (arrival.source === "card") {
    cardId = arrival.cardId;
  } else {
    name = arrival.name.trim();
    notes = arrival.notes?.trim().slice(0, NOTES_MAX) ?? "";
  }
  if (cardId) {
    const card = await readCard(deps.runtime, cardId);
    if (!card?.name.trim()) throw refused("That card could not be read.");
    if (arrival.source === "card") name = card.name.trim();
  }
  if (!name) throw refused("Say who your friend is.");
  if (CONTROL.test(name) || name.includes("..")) throw refused("That name cannot be used.");
  const taken = [...run.units, ...(run.friends ?? [])];
  if (namesClash(name, run.player.name) || taken.some((unit) => namesClash(name, unit.name))) {
    throw refused(`${name} is already in your story's cast.`);
  }

  // A friend's unit out of the friends for the same person (a bible that failed, or was never saved) is taken back.
  const stored = (await deps.store.listRun("unit", runId)).map((record) => normalizeUnit(record.data));
  const kept = stored.find(
    (unit) =>
      !Object.hasOwn(run.state.lis, unit.id) &&
      !Object.hasOwn(run.state.friends, unit.id) &&
      !unit.bible &&
      unit.name === name &&
      (unit.cardId ?? "") === (cardId ?? ""),
  );
  const id =
    kept?.id ??
    newLiId(
      name,
      stored.map((unit) => unit.id),
    );
  const at = new Date().toISOString();
  const look = met?.look;
  const unit: Unit = {
    ...(kept ?? normalizeUnit({})),
    id,
    kind: "character",
    name,
    pronouns: arrival.pronouns,
    source: cardId ? "card" : "archetype",
    ...(cardId ? { cardId } : {}),
    ...(notes ? { notes } : {}),
    ...(look ? { identityLine: look.identityLine, outfitLine: look.outfitLine } : {}),
    ...(met?.voice && !kept?.voiceGender ? { voiceGender: met.voice } : {}),
    createdAt: kept?.createdAt ?? at,
  };
  const { cardId: _keptCard, notes: _keptNotes, ...base } = unit;
  const written: Unit = { ...base, ...(cardId ? { cardId } : {}), ...(notes ? { notes } : {}) };
  await deps.store.mutateDoc(runDocTarget("unit", unitId(runId, id)), normalizeUnit, () => written);

  if (!written.friend) {
    const [member] = await castOf(deps.runtime, [written]);
    const { value: friend } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `friend/${id}`,
      messages: friendBibleMessages({
        world: run.world as World,
        player: run.player,
        member: member!,
        lis: run.units,
        scenes: met ? await sideScenes(deps, runId, met) : "",
      }),
      schema: FriendBibleSchema,
      normalize: (reply) => withCast(reply, run.units),
      maxTokens: 4000,
      debugMode: !!debugMode,
      lane: "foreground",
      ...(signal ? { signal } : {}),
    });
    await deps.store.updateDoc(runDocTarget("unit", unitId(runId, id)), normalizeUnit, (current) => ({
      ...current,
      friend,
      identityLine: current.identityLine || friend.look.identityLine,
      outfitLine: current.outfitLine || friend.look.outfitLine,
      voiceGender: current.voiceGender || VOICE_GENDER[friend.look.presentation],
    }));
  }
  // Last: they join the friends, if one still may (another tab may have added one meanwhile).
  await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) => {
    if (Object.hasOwn(state.friends, id)) return state;
    const again = friendBlock(Object.keys(state.lis).length, Object.values(state.friends), arc);
    if (again) throw blocked(again);
    return { ...state, friends: { ...state.friends, [id]: defaultFriendState(arc, at) } };
  });
  return { id, name };
}

/**
 * #2458: the friends who spoke in `chapter` as it was read (each scene's lines and its picked branches), by id. `last`
 * is the scene being finished, with its picks as they stand; the scenes before it are read from the store.
 */
export async function friendsHeard(
  deps: { store: OtomeStore },
  runId: string,
  chapter: Pick<Chapter, "key" | "nodes">,
  last: Beat,
): Promise<LiId[]> {
  const run = await readRun(deps.store, runId);
  const friends = run?.friends ?? [];
  if (!friends.length) return [];
  const beats = await Promise.all(
    chapter.nodes.map((_, i) => (i === last.i ? last : readBeat(deps.store, runId, chapter.key, i))),
  );
  // A climax game's lines as played: the answers picked, never the others (canonicalSegments).
  const lines = (beat: Beat) => (beat.confrontation ? (canonicalSegments(beat, "") ?? []) : readLines(beat));
  const speakers = beats.flatMap((beat) =>
    beat ? lines(beat).flatMap((line) => (line.thought ? [] : [line.speaker])) : [],
  );
  // A line that could be two friends' ("Kai" for Kai Moreno and Kai Tan) credits neither.
  const heard = new Set(
    speakers.flatMap((name) => {
      const them = friends.filter((friend) => namesPerson(name, friend.name));
      return them.length === 1 ? [them[0]!.id] : [];
    }),
  );
  return friends.filter((friend) => heard.has(friend.id)).map((friend) => friend.id);
}

/**
 * #2458: a friend's scene to clear the air (`story-friend-air-<id>-<n>`), opened by accepting their invitation while
 * she is upset with them: one node, written as its scene is read, with no plan call (as a love interest's,
 * S/items/character-story.ts clearAirStoryChapter).
 */
export function friendAirChapter(unit: Pick<Unit, "id" | "name">, n: number, at: string): Chapter {
  const { name } = unit;
  return {
    key: friendAirKey(unit.id, n),
    kind: "story",
    lead: "",
    friendStory: { kind: "clear-air", friends: [unit.id] },
    title: `Clearing the Air with ${name}`,
    tags: [],
    summary: "",
    nodes: [
      {
        i: 0,
        kind: "beat",
        guide: `CLEARING THE AIR between ${name} and the protagonist, who told ${name} they were upset with them. They meet somewhere ${name} chooses. What hurt is said plainly, as friends say it, and what ${name} does about it is ${name}'s own; how it lands is up to the protagonist. One complete scene, with its own small turn.`,
        cast: [],
      },
    ],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: at,
    connectionId: "",
  };
}
