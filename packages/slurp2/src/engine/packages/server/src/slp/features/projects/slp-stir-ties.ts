/**
 * The tie levers of Stir (W): collabs, rivalries and couples as actions. Each runs the same pure rule
 * its Studio button ran (`slp-creator-ties-routes.ts`); `preview` runs that rule on a copy and writes
 * nothing, so the card can say who, what, the fit note from the cards, or why it cannot happen.
 *
 * Work can be refused in character (a suggested collab waits for the partner's answer unless the
 * player says "make it happen"); love and drama always happen, and the cards colour how (I, W).
 */
import type { DB } from "../../../db/connection.js";
import { newId } from "../../../utils/id-generator.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { mutateSlurpCreatorTies, readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import {
  slurpCollabOpen,
  slurpCoolRivalry,
  slurpPairKey,
  slurpPushCollab,
  slurpRivalryActive,
  slurpStartRivalry,
  type SlurpCollab,
  type SlurpCreatorTies,
  type SlurpRivalry,
  type SlurpTieError,
} from "../../modules/projects/slp-creator-ties.js";
import {
  slurpCoupleActive,
  slurpSetUpCouple,
  slurpSteerCouple,
  type SlurpCouple,
  type SlurpCoupleError,
} from "../../modules/projects/slp-creator-couples.js";
import {
  slurpPreviewTieLever,
  slurpSuggestCollabPlay,
  slurpUndoTie,
  slurpUnblockedBy,
  type SlurpStirTieWorld,
  type SlurpTieLever,
  type SlurpTiePreview,
  type SlurpTieUndo,
} from "../../modules/projects/slp-stir-tie-preview.js";
import { loadSlurpTieCreators } from "./slp-creator-ties-service.js";
import { slurpAddToCouple, type SlurpCoupleJoinError } from "../../modules/projects/slp-couple-group.js";
import { closeSlurpCouplePage, closeSlurpCouplePages, openSlurpCouplePage } from "./slp-creator-couples-service.js";
import type { SlpActionParsed, SlpStirWorld } from "../../../../../shared/src/slp/slp-actions.js";

export { isSlurpTieLever, type SlurpTieUndo } from "../../modules/projects/slp-stir-tie-preview.js";
import {
  slurpEndBond,
  slurpSyncExBonds,
  slurpSetBond,
  type SlurpBond,
  type SlurpBondError,
} from "../../modules/projects/slp-creator-bonds.js";

type Failure = { ok: false; status: 400 | 404 | 409; error: string };
type Done = { ok: true; value: Record<string, unknown>; undo: SlurpTieUndo | null };

/** The world's words for why a tie play cannot happen (the same as the Studio routes). */
const WHY: Record<
  SlurpTieError | SlurpCoupleError | SlurpCoupleJoinError | SlurpBondError | "notFound",
  [400 | 404 | 409, string]
> = {
  unknown: [404, "That bond is gone."],
  couple: [409, "They are a couple right now, not exes."],
  notFound: [404, "That one is gone."],
  notOpen: [409, "That does not fit where they are right now."],
  sameCreator: [400, "Pick two different Creators."],
  same: [400, "Pick two different Creators."],
  noHost: [400, "Pick at least one Creator Slurp posts for."],
  busy: [409, "They are already in the middle of something like that."],
  taken: [409, "One of them is already with someone."],
  notInto: [409, "Neither romance nor dating is something they are looking for."],
  noDating: [409, "One of them does not date, and would not start for this."],
  orientation: [409, "They are not each other's type."],
  romance: [409, "Their romance settings keep these two apart."],
  pageOpen: [409, "Their shared page is already open."],
  polyOff: [409, "Polyamory is off in Settings › Stir."],
  mono: [409, "One of them is monogamous and already with someone."],
  notTogether: [409, "They are not dating yet."],
  full: [409, "There is no room for that: the couple is four people, or they have enough close friends."],
};
const fail = (code: keyof typeof WHY): Failure => ({ ok: false, status: WHY[code][0], error: WHY[code][1] });

type World = SlurpStirTieWorld;

async function readWorld(db: DB): Promise<World> {
  const [creators, accounts, document, settings] = await Promise.all([
    loadSlurpTieCreators(db),
    createSlurpStorage(db).listNoodlerAccounts(),
    readSlurpCreatorTiesDocument(db),
    createSlurpStorage(db).getSettings(),
  ]);
  return {
    polyamory: settings.polyamory === true,
    creators,
    avatars: new Map(
      accounts.map((account: { id: string; avatarUrl?: string | null }) => [account.id, account.avatarUrl ?? null]),
    ),
    ties: document.ties,
    couples: document.couples,
    bonds: document.bonds,
  };
}

/** What a tie play would do, on the world as it is now. Reads only. */
export async function previewSlurpTieLever(
  db: DB,
  name: SlurpTieLever,
  input: unknown,
  at = new Date(),
): Promise<SlurpTiePreview> {
  return slurpPreviewTieLever(await readWorld(db), name, input, at);
}

/** One tie play, for real. Answers what the Undo needs to take it back. */
export async function runSlurpTieLever(
  db: DB,
  name: SlurpTieLever,
  input: unknown,
  at = new Date(),
): Promise<Done | Failure> {
  const creators = await loadSlurpTieCreators(db, at);
  const find = (id: string) => creators.find((entry) => entry.id === id);
  const onTies = async (
    change: (ties: SlurpCreatorTies) => SlurpCreatorTies | SlurpTieError,
  ): Promise<SlurpCreatorTies | SlurpTieError | null> =>
    mutateSlurpCreatorTies<SlurpCreatorTies | SlurpTieError>(db, (document) => {
      const next = change(document.ties);
      return typeof next === "string"
        ? { document, result: next }
        : { document: { ...document, ties: next }, result: next };
    });
  const onCouples = async (
    change: (couples: SlurpCouple[]) => SlurpCouple[] | SlurpCoupleError | SlurpCoupleJoinError,
  ): Promise<SlurpCouple[] | SlurpCoupleError | SlurpCoupleJoinError | null> =>
    mutateSlurpCreatorTies<SlurpCouple[] | SlurpCoupleError | SlurpCoupleJoinError>(db, (document) => {
      const next = change(document.couples);
      return typeof next === "string"
        ? { document, result: next }
        : { document: { ...document, couples: next }, result: next };
    });

  const onBonds = (change: (bonds: SlurpBond[], couples: SlurpCouple[]) => SlurpBond[] | SlurpBondError) =>
    mutateSlurpCreatorTies<SlurpBond[] | SlurpBondError>(db, (document) => {
      const next = change(document.bonds, document.couples);
      return typeof next === "string"
        ? { document, result: next }
        : { document: { ...document, bonds: next }, result: next };
    });

  switch (name) {
    case "set-bond": {
      const { aId, bId, kind, level } = input as SlpActionParsed<"set-bond">;
      if (!find(aId) || !find(bId)) return fail("notFound");
      const id = newId();
      let previous: SlurpBond | undefined;
      const next = await onBonds((bonds, couples) => {
        previous = bonds.find(
          (bond) =>
            bond.endedAt === null && bond.kind === kind && slurpPairKey(bond.aId, bond.bId) === slurpPairKey(aId, bId),
        );
        return slurpSetBond(bonds, { aId, bId, kind, level, couples }, { at, id });
      });
      if (!next || typeof next === "string") return fail(next ?? "notFound");
      return {
        ok: true,
        value: { bondId: previous?.id ?? id },
        undo: previous ? { kind: "restoreBond", bond: previous } : { kind: "removeBond", id },
      };
    }
    case "end-bond": {
      const { bondId } = input as SlpActionParsed<"end-bond">;
      let previous: SlurpBond | undefined;
      const next = await onBonds((bonds) => {
        previous = bonds.find((bond) => bond.id === bondId);
        return slurpEndBond(bonds, bondId, at);
      });
      if (!next || typeof next === "string") return fail(next ?? "notFound");
      return { ok: true, value: { bondId }, undo: previous ? { kind: "restoreBond", bond: previous } : null };
    }
    case "suggest-collab": {
      const { aId, bId, happen } = input as SlpActionParsed<"suggest-collab">;
      const a = find(aId);
      const b = find(bId);
      if (!a || !b) return fail("notFound");
      const id = newId();
      let blocked: string | null = null;
      const next = await onTies((ties) => {
        blocked = slurpUnblockedBy(ties, aId, bId);
        return slurpSuggestCollabPlay(ties, a, b, { at, id, happen });
      });
      if (!next || typeof next === "string") return fail(next ?? "notFound");
      return {
        ok: true,
        value: { collabId: id },
        undo: { kind: "removeCollab", id, ...(blocked ? { blocked } : {}) },
      };
    }
    case "push-collab": {
      const { collabId } = input as SlpActionParsed<"push-collab">;
      let previous: SlurpCollab | undefined;
      const next = await onTies((ties) => {
        previous = ties.collabs.find((entry) => entry.id === collabId);
        return slurpPushCollab(ties, collabId, at);
      });
      if (!next || typeof next === "string") return fail(next ?? "notFound");
      return { ok: true, value: { collabId }, undo: previous ? { kind: "restoreCollab", collab: previous } : null };
    }
    case "start-rivalry": {
      const { fromId, toId, cause } = input as SlpActionParsed<"start-rivalry">;
      const from = find(fromId);
      const to = find(toId);
      if (!from || !to) return fail("notFound");
      const id = newId();
      const next = await onTies((ties) => slurpStartRivalry(ties, from, to, { at, id, cause }));
      if (!next || typeof next === "string") return fail(next ?? "notFound");
      return { ok: true, value: { rivalryId: id }, undo: { kind: "removeRivalry", id } };
    }
    case "cool-rivalry": {
      const { rivalryId } = input as SlpActionParsed<"cool-rivalry">;
      let previous: SlurpRivalry | undefined;
      const next = await onTies((ties) => {
        previous = ties.rivalries.find((entry) => entry.id === rivalryId);
        return slurpCoolRivalry(ties, rivalryId, at);
      });
      if (!next || typeof next === "string") return fail(next ?? "notFound");
      return {
        ok: true,
        value: { rivalryId },
        undo: previous ? { kind: "restoreRivalry", rivalry: previous } : null,
      };
    }
    case "set-up-couple": {
      const { aId, bId } = input as SlpActionParsed<"set-up-couple">;
      const a = find(aId);
      const b = find(bId);
      if (!a || !b) return fail("notFound");
      const id = newId();
      const polyamory = (await createSlurpStorage(db).getSettings()).polyamory === true;
      const next = await onCouples((couples) => slurpSetUpCouple(couples, a, b, { at, id, polyamory }));
      if (!next || typeof next === "string") return fail(next ?? "notFound");
      return { ok: true, value: { coupleId: id }, undo: { kind: "removeCouple", id } };
    }
    case "steer-couple": {
      const { coupleId, steer, aftermath } = input as SlpActionParsed<"steer-couple">;
      const before = (await readSlurpCreatorTiesDocument(db)).couples;
      const previous = before.find((entry) => entry.id === coupleId);
      const next = await mutateSlurpCreatorTies<SlurpCouple[] | SlurpCoupleError>(db, (document) => {
        const result = slurpSteerCouple(document.couples, coupleId, steer, { at, creators, aftermath });
        return typeof result === "string"
          ? { document, result }
          : { document: { ...document, couples: result, bonds: slurpSyncExBonds(document.bonds, result, at) }, result };
      });
      if (!next || typeof next === "string") return fail(next ?? "notFound");
      // A breakup closes their shared page too (the Studio route did the same); that is not undone.
      if (steer === "breakUp") await closeSlurpCouplePages(db, before, next);
      const pageWasOpen = Boolean(previous?.page && !previous.page.closedAt);
      return {
        ok: true,
        value: { coupleId },
        undo: previous && !(steer === "breakUp" && pageWasOpen) ? { kind: "restoreCouple", couple: previous } : null,
      };
    }
    case "add-to-couple": {
      const { coupleId, accountId } = input as SlpActionParsed<"add-to-couple">;
      const joiner = find(accountId);
      if (!joiner) return fail("notFound");
      const polyamory = (await createSlurpStorage(db).getSettings()).polyamory === true;
      let previous: SlurpCouple | undefined;
      const next = await onCouples((couples) => {
        previous = couples.find((entry) => entry.id === coupleId);
        return slurpAddToCouple(couples, coupleId, joiner, { at, polyamory, creators });
      });
      if (!next || typeof next === "string") return fail(next ?? "notFound");
      return { ok: true, value: { coupleId }, undo: previous ? { kind: "restoreCouple", couple: previous } : null };
    }
    case "couple-page": {
      const { coupleId, open } = input as SlpActionParsed<"couple-page">;
      const outcome = open ? await openSlurpCouplePage(db, coupleId) : await closeSlurpCouplePage(db, coupleId);
      if (typeof outcome === "string") return fail(outcome);
      // Opening is taken back by closing it again; a closed page does not reopen by Undo.
      return {
        ok: true,
        value: { coupleId, accountId: outcome.page?.accountId ?? null },
        undo: open ? { kind: "closeCouplePage", coupleId } : null,
      };
    }
  }
}

/**
 * Take one tie play back. Answers false when the world has moved on and this part stays as it is
 * (`slurpUndoTie` says when).
 */
export async function undoSlurpTieLever(db: DB, undo: SlurpTieUndo): Promise<boolean> {
  if (undo.kind === "closeCouplePage") {
    const couple = (await readSlurpCreatorTiesDocument(db)).couples.find((entry) => entry.id === undo.coupleId);
    if (!couple?.page || couple.page.closedAt || !slurpCoupleActive(couple)) return false;
    return typeof (await closeSlurpCouplePage(db, undo.coupleId)) !== "string";
  }
  const applied = await mutateSlurpCreatorTies(db, (document) => {
    const next = slurpUndoTie(document, undo);
    return next ? { document: { ...document, ...next }, result: true } : null;
  });
  return applied === true;
}

/** The ids and names the world levers take (`list-world`, the Stir tab). */
export async function readSlurpStirTies(
  db: DB,
): Promise<Pick<SlpStirWorld, "couples" | "collabs" | "rivalries" | "bonds">> {
  const { ties, couples, bonds } = await readSlurpCreatorTiesDocument(db);
  return {
    couples: couples
      .filter(slurpCoupleActive)
      .map((couple) => ({
        id: couple.id,
        aId: couple.aId,
        bId: couple.bId,
        ...(couple.moreIds?.length ? { moreIds: couple.moreIds } : {}),
        stage: couple.stage,
        page: couple.page ? (couple.page.closedAt ? ("closed" as const) : ("open" as const)) : null,
        ...(couple.secret ? { secret: true } : {}),
      }))
      .concat(
        couples
          .filter((couple) => !slurpCoupleActive(couple))
          .slice(-6)
          .map((couple) => ({
            id: couple.id,
            aId: couple.aId,
            bId: couple.bId,
            ...(couple.moreIds?.length ? { moreIds: couple.moreIds } : {}),
            stage: couple.stage,
            page: null,
            // #1293: the Stir "Nudge a couple" sheet needs this to offer only the unused choice.
            ...(couple.aftermath ? { aftermath: couple.aftermath } : {}),
          })),
      ),
    collabs: ties.collabs
      .filter(slurpCollabOpen)
      .map((collab) => ({ id: collab.id, hostId: collab.hostId, partnerId: collab.partnerId, status: collab.status })),
    rivalries: ties.rivalries
      .filter(slurpRivalryActive)
      .map((rivalry) => ({ id: rivalry.id, fromId: rivalry.fromId, toId: rivalry.toId, stage: rivalry.stage })),
    bonds: bonds
      .filter((bond) => bond.endedAt === null)
      .map((bond) => ({ id: bond.id, aId: bond.aId, bId: bond.bId, kind: bond.kind, level: bond.level })),
  };
}
