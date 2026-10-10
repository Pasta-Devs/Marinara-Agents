// Stir's tie levers (W), the pure half: what a collab, rivalry or couple play would do, worked out on a
// snapshot of the world (the preview writes nothing), and the "make it happen" collab rule. No I/O;
// `features/projects/slp-stir-ties.ts` reads the world, runs the plays and undoes them.
import {
  slurpCollabFit,
  slurpCoolRivalry,
  slurpPairKey,
  slurpPushCollab,
  slurpRivalryFits,
  slurpStartRivalry,
  slurpSuggestCollab,
  type SlurpCollab,
  type SlurpCreatorTies,
  type SlurpRivalry,
  type SlurpTieCreator,
  type SlurpTieError,
} from "./slp-creator-ties.js";
import {
  slurpCoupleActive,
  slurpCoupleOther,
  slurpCouplePageOpenable,
  slurpSetUpCouple,
  slurpSteerCouple,
  type SlurpCouple,
  type SlurpCoupleForced,
} from "./slp-creator-couples.js";
import { slurpCoupleMisfitOf } from "./slp-couple-fit.js";
import type { SlpActionParsed } from "../../../../../shared/src/slp/slp-actions.js";
import { slurpAddToCouple, slurpCoupleMembers, slurpNameList } from "./slp-couple-group.js";
import type { SlpActionPreview, SlpStirNote } from "../../../../../shared/src/slp/slp-stir.js";
import { slurpSyncExBonds, slurpEndBond, slurpSetBond, type SlurpBond } from "./slp-creator-bonds.js";

export const SLURP_TIE_LEVERS = [
  "suggest-collab",
  "push-collab",
  "start-rivalry",
  "cool-rivalry",
  "set-up-couple",
  "steer-couple",
  "couple-page",
  "add-to-couple",
  // 0.3.11: bonds are Stir plays too (preview, the ledger, Undo), not a side route.
  "set-bond",
  "end-bond",
] as const;
export type SlurpTieLever = (typeof SLURP_TIE_LEVERS)[number];
export const isSlurpTieLever = (name: string): name is SlurpTieLever =>
  (SLURP_TIE_LEVERS as readonly string[]).includes(name);

/** The world a tie play is worked out on: the Creators as the tie rules see them, and the ties. */
export type SlurpStirTieWorld = {
  /** Settings › Stir: a couple may grow past two (0.3.5). */
  polyamory?: boolean;
  creators: readonly SlurpTieCreator[];
  avatars: ReadonlyMap<string, string | null>;
  ties: SlurpCreatorTies;
  couples: readonly SlurpCouple[];
  bonds?: readonly SlurpBond[];
};

/** A forced couple's card note, in the words the couple lines use (I): taken → complicated, and so on. */
const FORCED_NOTE: Record<SlurpCoupleForced["misfit"], SlpStirNote["kind"]> = {
  taken: "complicated",
  notInto: "reluctant",
  noDating: "awkward",
  orientation: "awkward",
  romance: "awkward",
};

export type SlurpTiePreview = Pick<SlpActionPreview, "who" | "detail" | "when" | "notes" | "error" | "summary"> &
  Partial<Pick<SlpActionPreview, "reversible">>;

const person = (world: SlurpStirTieWorld, id: string) => {
  const creator = world.creators.find((entry) => entry.id === id);
  return creator ? { id, name: creator.name, avatarUrl: world.avatars.get(id) ?? null } : null;
};
const people = (world: SlurpStirTieWorld, ids: string[]) =>
  ids.flatMap((id) => {
    const found = person(world, id);
    return found ? [found] : [];
  });
const nameOf = (world: SlurpStirTieWorld, id: string) => world.creators.find((entry) => entry.id === id)?.name ?? "";

/** What a tie play would do: the rule runs on the world it is given, and nothing is written. */
export function slurpPreviewTieLever(
  world: SlurpStirTieWorld,
  name: SlurpTieLever,
  input: unknown,
  at: Date,
): SlurpTiePreview {
  const { ties, couples } = world;
  const find = (id: string) => world.creators.find((entry) => entry.id === id);
  const result = (fields: Partial<SlurpTiePreview>): SlurpTiePreview => ({
    who: [],
    detail: {},
    when: "now",
    notes: [],
    error: null,
    summary: "",
    ...fields,
  });
  switch (name) {
    case "suggest-collab": {
      const { aId, bId, happen } = input as SlpActionParsed<"suggest-collab">;
      const a = find(aId);
      const b = find(bId);
      if (!a || !b) return result({ error: "notFound", summary: "One of these Creators does not exist." });
      const next = slurpSuggestCollab(ties, a, b, { at, id: "preview" });
      // The same judgement the answer uses (a suggestion gets no boost): the note is honest.
      const fit = slurpCollabFit(a, b);
      const asked = typeof next === "string" ? null : next.collabs.find((collab) => collab.id === "preview");
      const partner = asked ? nameOf(world, asked.partnerId) : b.name;
      const notes: SlpStirNote[] =
        happen || !asked || asked.status !== "asked" || fit.fits
          ? []
          : [{ kind: fit.decline === "noCollabs" ? "noCollabs" : "mayDecline", name: partner }];
      return result({
        who: people(world, [aId, bId]),
        detail: { idea: fit.idea, happen },
        when: happen || asked?.status === "agreed" ? "now" : "nextLook",
        notes,
        error: typeof next === "string" ? next : null,
        summary: `${a.name} and ${b.name} get a collab suggested (${fit.idea}).${happen ? " They agree now." : ` ${partner} answers in their own way.`}`,
      });
    }
    case "push-collab": {
      const { collabId } = input as SlpActionParsed<"push-collab">;
      const collab = ties.collabs.find((entry) => entry.id === collabId);
      const next = slurpPushCollab(ties, collabId, at);
      return result({
        who: collab ? people(world, [collab.hostId, collab.partnerId]) : [],
        detail: { idea: collab?.idea ?? null },
        error: typeof next === "string" ? next : null,
        summary: collab
          ? `${nameOf(world, collab.hostId)} and ${nameOf(world, collab.partnerId)} agree to the collab now.`
          : "",
      });
    }
    case "start-rivalry": {
      const { fromId, toId, cause } = input as SlpActionParsed<"start-rivalry">;
      const from = find(fromId);
      const to = find(toId);
      if (!from || !to) return result({ error: "notFound", summary: "One of these Creators does not exist." });
      const next = slurpStartRivalry(ties, from, to, { at, id: "preview", cause });
      const started = typeof next === "string" ? null : next.rivalries.find((entry) => entry.id === "preview");
      return result({
        who: people(world, [fromId, toId]),
        detail: { cause: started?.cause ?? cause ?? null },
        when: "nextPost",
        notes: slurpRivalryFits(from, to) ? [] : [{ kind: "notDramatic", name: from.name }],
        error: typeof next === "string" ? next : null,
        summary: `${from.name} starts throwing shade at ${to.name}.`,
      });
    }
    case "cool-rivalry": {
      const { rivalryId } = input as SlpActionParsed<"cool-rivalry">;
      const rivalry = ties.rivalries.find((entry) => entry.id === rivalryId);
      const next = slurpCoolRivalry(ties, rivalryId, at);
      return result({
        who: rivalry ? people(world, [rivalry.fromId, rivalry.toId]) : [],
        when: "nextPost",
        error: typeof next === "string" ? next : null,
        summary: rivalry ? `${nameOf(world, rivalry.fromId)} and ${nameOf(world, rivalry.toId)} calm it down.` : "",
      });
    }
    case "set-up-couple": {
      const { aId, bId } = input as SlpActionParsed<"set-up-couple">;
      const a = find(aId);
      const b = find(bId);
      if (!a || !b) return result({ error: "notFound", summary: "One of these Creators does not exist." });
      const next = slurpSetUpCouple(couples, a, b, { at, id: "preview", polyamory: world.polyamory === true });
      const made = typeof next === "string" ? null : next.find((entry) => entry.id === "preview");
      const misfit = made?.forced ?? (typeof next === "string" ? null : slurpCoupleMisfitOf(a, b));
      return result({
        who: people(world, [aId, bId]),
        detail: { stage: made?.stage ?? null },
        when: "nextPost",
        notes: misfit ? [{ kind: FORCED_NOTE[misfit.misfit], name: nameOf(world, misfit.byId) }] : [],
        error: typeof next === "string" ? next : null,
        summary: `${a.name} and ${b.name} start to ${made?.stage === "together" ? "go public as a couple" : "flirt"}.`,
      });
    }
    case "steer-couple": {
      const { coupleId, steer, aftermath } = input as SlpActionParsed<"steer-couple">;
      const couple = couples.find((entry) => entry.id === coupleId);
      const next = slurpSteerCouple(couples, coupleId, steer, { at, creators: world.creators, aftermath });
      return result({
        who: couple ? people(world, [couple.aId, couple.bId]) : [],
        detail: { steer, ...(steer === "breakUp" && aftermath && aftermath !== "keep" ? { aftermath } : {}) },
        when: "nextPost",
        error: typeof next === "string" ? next : null,
        // A breakup closes an open shared page, and that is not taken back (the run keeps no Undo).
        ...(steer === "breakUp" && couple?.page && !couple.page.closedAt ? { reversible: false } : {}),
        summary: couple ? `${nameOf(world, couple.aId)} and ${nameOf(world, couple.bId)}: ${steer}.` : "",
      });
    }
    case "add-to-couple": {
      const { coupleId, accountId } = input as SlpActionParsed<"add-to-couple">;
      const couple = couples.find((entry) => entry.id === coupleId);
      const joiner = find(accountId);
      const next = joiner
        ? slurpAddToCouple(couples, coupleId, joiner, {
            at,
            polyamory: world.polyamory === true,
            creators: world.creators,
          })
        : "notFound";
      return result({
        who: couple ? people(world, [...slurpCoupleMembers(couple), accountId]) : [],
        detail: {
          joiner: joiner?.name ?? "",
          couple: couple ? slurpNameList(slurpCoupleMembers(couple).map((id) => nameOf(world, id))) : "",
        },
        when: "nextPost",
        error: typeof next === "string" ? next : null,
        summary:
          couple && joiner
            ? `${joiner.name} joins ${slurpNameList(slurpCoupleMembers(couple).map((id) => nameOf(world, id)))}.`
            : "",
      });
    }
    case "set-bond": {
      const { aId, bId, kind, level } = input as SlpActionParsed<"set-bond">;
      const a = find(aId);
      const b = find(bId);
      if (!a || !b) return result({ error: "notFound", summary: "One of these Creators does not exist." });
      const next = slurpSetBond(world.bonds ?? [], { aId, bId, kind, level, couples }, { at, id: "preview" });
      return result({
        who: people(world, [aId, bId]),
        detail: { kind, level: kind === "friend" ? (level ?? 1) : null },
        error: typeof next === "string" ? next : null,
        summary: `${a.name} and ${b.name} become ${kind === "ex" ? "exes" : `${kind}s`}.`,
      });
    }
    case "end-bond": {
      const { bondId } = input as SlpActionParsed<"end-bond">;
      const bond = (world.bonds ?? []).find((entry) => entry.id === bondId);
      const next = slurpEndBond(world.bonds ?? [], bondId, at);
      return result({
        who: bond ? people(world, [bond.aId, bond.bId]) : [],
        detail: { kind: bond?.kind ?? null },
        error: typeof next === "string" ? next : null,
        summary: bond ? `${nameOf(world, bond.aId)} and ${nameOf(world, bond.bId)} are no longer ${bond.kind}s.` : "",
      });
    }
    case "couple-page": {
      const { coupleId, open } = input as SlpActionParsed<"couple-page">;
      const couple = couples.find((entry) => entry.id === coupleId);
      const error = !couple
        ? "notFound"
        : open
          ? slurpCouplePageOpenable(couple)
            ? null
            : "notOpen"
          : couple.page && !couple.page.closedAt
            ? null
            : "notOpen";
      return result({
        who: couple ? people(world, [couple.aId, couple.bId]) : [],
        detail: { open },
        error,
        // Opening can be closed again by Undo; a closed page does not reopen.
        reversible: open,
        summary: couple
          ? `${nameOf(world, couple.aId)} and ${nameOf(world, couple.bId)} ${open ? "open" : "close"} their shared page.`
          : "",
      });
    }
  }
}

/**
 * A suggested collab, as a play: the partner answers in their own way at the next look (work can be
 * refused, W), unless the player said "make it happen", then the two agree now. A page the player
 * runs has agreed by suggesting it.
 */
export function slurpSuggestCollabPlay(
  ties: SlurpCreatorTies,
  a: SlurpTieCreator,
  b: SlurpTieCreator,
  input: { at: Date; id: string; happen: boolean },
): SlurpCreatorTies | SlurpTieError {
  const asked = slurpSuggestCollab(ties, a, b, input);
  if (typeof asked === "string" || !input.happen) return asked;
  const collab = asked.collabs.find((entry) => entry.id === input.id);
  return collab?.status === "asked" ? slurpPushCollab(asked, input.id, input.at) : asked;
}

/**
 * What one Undo does for a tie play: remove what it added, or put one entry back as it was. Kept in
 * the plays ledger; entries written before a field existed simply lack it.
 */
export type SlurpTieUndo =
  /** `blocked`: the pair key the play unblocked, blocked again on Undo. */
  | { kind: "removeCollab"; id: string; blocked?: string }
  | { kind: "restoreCollab"; collab: SlurpCollab }
  | { kind: "removeRivalry"; id: string }
  | { kind: "restoreRivalry"; rivalry: SlurpRivalry }
  | { kind: "removeCouple"; id: string }
  | { kind: "restoreCouple"; couple: SlurpCouple }
  /** Opening a shared page; the service closes it (a goodbye post and stopped renewals). */
  | { kind: "closeCouplePage"; coupleId: string }
  | { kind: "removeBond"; id: string }
  | { kind: "restoreBond"; bond: SlurpBond };

type TieDocument = { ties: SlurpCreatorTies; couples: SlurpCouple[]; bonds?: SlurpBond[] };

/**
 * Take one tie play back on the ties as they are now, or null when the world has moved on and the
 * Undo would break it: a collab already planned or posted, a rivalry or collab that changed again,
 * a couple that opened a page since, or a partner who is with someone else now.
 */
export function slurpUndoTie(document: TieDocument, undo: SlurpTieUndo, at = new Date()): TieDocument | null {
  const { ties, couples } = document;
  switch (undo.kind) {
    case "removeCollab": {
      const collab = ties.collabs.find((entry) => entry.id === undo.id);
      if (!collab || collab.status === "planned" || collab.status === "posted") return null;
      return {
        couples,
        ties: {
          ...ties,
          collabs: ties.collabs.filter((entry) => entry.id !== undo.id),
          blocked: undo.blocked ? [...new Set([...ties.blocked, undo.blocked])] : ties.blocked,
        },
      };
    }
    case "restoreCollab": {
      const collab = ties.collabs.find((entry) => entry.id === undo.collab.id);
      if (!collab || collab.status !== "agreed") return null;
      return {
        couples,
        ties: { ...ties, collabs: ties.collabs.map((entry) => (entry.id === undo.collab.id ? undo.collab : entry)) },
      };
    }
    case "removeRivalry":
      if (!ties.rivalries.some((entry) => entry.id === undo.id)) return null;
      return { couples, ties: { ...ties, rivalries: ties.rivalries.filter((entry) => entry.id !== undo.id) } };
    case "restoreRivalry": {
      const rivalry = ties.rivalries.find((entry) => entry.id === undo.rivalry.id);
      if (!rivalry || rivalry.stage !== "cooling") return null;
      return {
        couples,
        ties: {
          ...ties,
          rivalries: ties.rivalries.map((entry) => (entry.id === undo.rivalry.id ? undo.rivalry : entry)),
        },
      };
    }
    case "removeCouple": {
      const couple = couples.find((entry) => entry.id === undo.id);
      if (!couple || couple.page) return null;
      return { ties, couples: couples.filter((entry) => entry.id !== undo.id) };
    }
    case "restoreCouple": {
      const previous = undo.couple;
      const current = couples.find((entry) => entry.id === previous.id);
      if (!current) return null;
      const taken = (id: string) =>
        couples.some((entry) => entry.id !== previous.id && slurpCoupleActive(entry) && slurpCoupleOther(entry, id));
      if (slurpCoupleActive(previous) && !slurpCoupleActive(current) && (taken(previous.aId) || taken(previous.bId)))
        return null;
      // Only the story of the two goes back; the page, joint posts and what was told stay as they are now.
      const restored: SlurpCouple = {
        ...current,
        stage: previous.stage,
        ending: previous.ending,
        stageAt: previous.stageAt,
        togetherAt: previous.togetherAt,
        troubles: previous.troubles,
        reunions: previous.reunions,
        // Polyamory: someone who joined by this play leaves again.
        moreIds: previous.moreIds,
        moments: previous.moments,
        secret: previous.secret,
        // #1293: the breakup's aftermath goes back too, whichever way the play changed it.
        aftermath: previous.aftermath,
      };
      if (!previous.secret) delete restored.secret;
      if (!previous.aftermath) delete restored.aftermath;
      const restoredCouples = couples.map((entry) => (entry.id === previous.id ? restored : entry));
      return {
        ties,
        couples: restoredCouples,
        ...(document.bonds ? { bonds: slurpSyncExBonds(document.bonds, restoredCouples, at) } : {}),
      };
    }
    case "closeCouplePage":
      return null;
    case "removeBond": {
      const bonds = document.bonds ?? [];
      if (!bonds.some((entry) => entry.id === undo.id)) return null;
      return { ties, couples, bonds: bonds.filter((entry) => entry.id !== undo.id) };
    }
    case "restoreBond": {
      const bonds = document.bonds ?? [];
      return {
        ties,
        couples,
        bonds: bonds.some((entry) => entry.id === undo.bond.id)
          ? bonds.map((entry) => (entry.id === undo.bond.id ? undo.bond : entry))
          : [...bonds, undo.bond],
      };
    }
  }
}

/** The pair key a suggested collab would unblock, or null when the pair was not blocked. */
export const slurpUnblockedBy = (ties: SlurpCreatorTies, aId: string, bId: string): string | null => {
  const key = slurpPairKey(aId, bId);
  return ties.blocked.includes(key) ? key : null;
};
