/**
 * What Slurp tells Long-Term Memory about its Creators: one record at a time, as it happens, through the
 * in-process `long-term-memory:intake` service. A record is `{ recordId, characterIds, text }`: a fact the
 * player wrote or promoted, a couple or bond between two Creators, or how a storyline ended.
 *
 * Sending is behind `shareWithMemory` (off by default); taking a record back never is. Every send runs after the Slurp write has committed and is never
 * awaited by the caller; a missing service, a refusal or any failure is a debug line, never a failed action.
 * Nothing from fans or DM threads is sent, nor plans, promises, boundaries or business facts.
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { getCapabilityService } from "../../../services/capability-packages/capability-service-registry.service.js";
import type { SlurpContinuityFact } from "../../../../../shared/src/slp/slp-continuity.js";
import type { SlurpTiesDocument } from "../projects/slp-creator-ties-storage.js";
import type { SlurpBond } from "../../modules/projects/slp-creator-bonds.js";
import type { SlurpCouple } from "../../modules/projects/slp-creator-couples.js";

const SERVICE = "long-term-memory:intake";
const TIMEOUT_MS = 5_000;

export type SlurpMemoryRecord = { recordId: string; characterIds: string[]; text: string };

type LtmIntake = {
  submit?: (input: Record<string, unknown>) => Promise<unknown>;
  retract?: (input: Record<string, unknown>) => Promise<unknown>;
};

async function call(action: "submit" | "retract", input: Record<string, unknown>) {
  try {
    const service = getCapabilityService<LtmIntake>(SERVICE);
    await service?.[action]?.({ caller: "slurp2", ...input, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    logger.debug(error, "[slurp] Long-Term Memory did not take a Creator record; the Slurp change is unaffected");
  }
}

/** One at a time, in the order issued: a retract right after an edit must not reach memory first. */
let tail: Promise<unknown> = Promise.resolve();
const inOrder = <T>(job: () => Promise<T>): Promise<T> => {
  const next = tail.then(job, job);
  tail = next.catch(() => undefined);
  return next;
};

export const sendSlurpRecord = (record: SlurpMemoryRecord) => call("submit", record);
export const retractSlurpRecord = (recordId: string) => call("retract", { recordId });

/** Slurp's "Tell Long-Term Memory about your Creators" switch. A failed read counts as off. */
export async function slurpMemorySharingOn(db: DB): Promise<boolean> {
  try {
    // Loaded on use: the storage layer imports the writers that call this module.
    const { createSlurpStorage } = await import("../slp-storage.js");
    return (await createSlurpStorage(db).getSettings()).shareWithMemory === true;
  } catch {
    return false;
  }
}

const SHAREABLE_TYPES = new Set(["interest", "relationship", "preference", "circumstance"]);
const SHAREABLE_AUDIENCES = new Set(["creator_private", "creator_public", "cross_platform"]);
const SHAREABLE_REALITIES = new Set(["canon", "slurp", "campaign"]);
const SHAREABLE_STATUSES = new Set(["confirmed", "active"]);

/**
 * A Creator-wide fact the player decided is true: an interest, relationship, preference or circumstance in
 * Slurp's own reality, not tied to a thread, never expiring. Persona-sourced Creators have no character to
 * attach it to, so they send nothing.
 */
export function slurpFactRecord(fact: SlurpContinuityFact): SlurpMemoryRecord | null {
  if (
    fact.sourceKind !== "character" ||
    !SHAREABLE_TYPES.has(fact.factType) ||
    !SHAREABLE_AUDIENCES.has(fact.audienceScope) ||
    !SHAREABLE_REALITIES.has(fact.realityScope) ||
    !SHAREABLE_STATUSES.has(fact.status) ||
    fact.expiresAt ||
    fact.threadId
  )
    return null;
  const subject = fact.subject.trim();
  return {
    recordId: `fact:${fact.id}`,
    characterIds: [fact.sourceEntityId],
    text: subject ? `${subject}: ${fact.text}` : fact.text,
  };
}

/**
 * A fact was written, edited or promoted: send it again when it qualifies and the switch is on, else take it back.
 * Taking back never waits for the switch: turning it off sends nothing new but must not strand an earlier record.
 */
export const shareSlurpFact = (db: DB, fact: SlurpContinuityFact) =>
  inOrder(async () => {
    const record = slurpFactRecord(fact);
    if (record && (await slurpMemorySharingOn(db))) await sendSlurpRecord(record);
    else if (!record) await retractSlurpRecord(`fact:${fact.id}`);
  });

export const retractSlurpFact = (_db: DB, factId: string) => inOrder(() => retractSlurpRecord(`fact:${factId}`));

type Account = { displayName: string; sourceKind?: string | null; sourceEntityId?: string | null };

/** Display names and character ids for both accounts, or null when either is not a character-sourced Creator. */
async function charactersOf(db: DB, accountIds: string[]) {
  const { createSlurpStorage } = await import("../slp-storage.js");
  const storage = createSlurpStorage(db);
  const accounts: (Account | null)[] = await Promise.all(
    accountIds.map((id) => storage.getNoodlerAccountById(id, { includeHidden: true })),
  );
  if (!accounts.every((account) => account?.sourceKind === "character" && account.sourceEntityId)) return null;
  return {
    names: accounts.map((account) => account!.displayName),
    // Two Creator pages for one character count once; Long-Term Memory takes distinct ids.
    characterIds: [...new Set(accounts.map((account) => account!.sourceEntityId!))],
  };
}

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const fill = (template: string, a: string, b: string) =>
  template.replace(/\{([ab])\}/gu, (_, key: string) => (key === "a" ? a : b));

type Tie = { recordId: string; ids: [string, string]; template: string | null };

const coupleTie = (couple: SlurpCouple): Tie => ({
  recordId: `couple:${[couple.aId, couple.bId].sort().join(":")}`,
  ids: [couple.aId, couple.bId],
  // Groups of three or four, a sparks or dating stage and a fizzled end are not a couple to remember.
  template: couple.moreIds?.length
    ? null
    : couple.stage === "together" || couple.stage === "rocky"
      ? "{a} and {b} are together."
      : couple.stage === "split" && couple.ending === "breakup" && couple.togetherAt
        ? `{a} and {b} were together until ${monthYear(couple.stageAt)}.`
        : null,
});

const BOND_NOUNS = { friend: "friends", roommate: "roommates", coworker: "coworkers", ex: "exes", family: "family" };
const BOND_ENDINGS = { drifted: " They drifted apart.", together: " They became a couple." } as const;

const bondTie = (bond: SlurpBond): Tie => ({
  recordId: `bond:${bond.kind}:${[bond.aId, bond.bId].sort().join(":")}`,
  ids: [bond.aId, bond.bId],
  // An acquaintance is not yet a friend.
  template:
    bond.kind === "friend" && bond.level < 1
      ? null
      : bond.endedAt
        ? `{a} and {b} used to be ${BOND_NOUNS[bond.kind]}.${(bond.ending && BOND_ENDINGS[bond.ending as keyof typeof BOND_ENDINGS]) || ""}`
        : `{a} and {b} are ${BOND_NOUNS[bond.kind]}.`,
});

const tiesOf = (document: Pick<SlurpTiesDocument, "couples" | "bonds">) => [
  ...document.couples.map(coupleTie),
  ...document.bonds.map(bondTie),
];

/** After a ties write: send the couples and bonds whose line changed, retract the ones that stopped qualifying. */
export const shareSlurpTieChanges = (db: DB, before: SlurpTiesDocument, after: SlurpTiesDocument) =>
  inOrder(() => shareTieChanges(db, before, after));

async function shareTieChanges(db: DB, before: SlurpTiesDocument, after: SlurpTiesDocument) {
  try {
    const was = new Map(tiesOf(before).map((tie) => [tie.recordId, tie.template]));
    const changed = tiesOf(after).filter((tie) => (was.get(tie.recordId) ?? null) !== tie.template);
    // Retractions go out whatever the switch says; only sends wait for it.
    for (const tie of changed) if (!tie.template) await retractSlurpRecord(tie.recordId);
    const sends = changed.filter((tie) => tie.template);
    if (sends.length === 0 || !(await slurpMemorySharingOn(db))) return;
    for (const tie of sends) {
      const who = await charactersOf(db, tie.ids);
      if (who) {
        await sendSlurpRecord({
          recordId: tie.recordId,
          characterIds: who.characterIds,
          text: fill(tie.template!, who.names[0]!, who.names[1]!),
        });
      }
    }
  } catch (error) {
    logger.debug(error, "[slurp] Could not tell Long-Term Memory about a couple or bond");
  }
}

/** A storyline just reached an ending: tell Long-Term Memory how it ended. The caller has checked the switch. */
export const sendSlurpStoryEnding = (
  db: DB,
  story: { id: string; title: string; creatorIds: string[]; ending: string },
) => inOrder(() => sendStoryEnding(db, story));

async function sendStoryEnding(db: DB, story: { id: string; title: string; creatorIds: string[]; ending: string }) {
  try {
    const who = await charactersOf(db, story.creatorIds.slice(0, 2));
    if (!who) return;
    await sendSlurpRecord({
      recordId: `storyline:${story.id}`,
      characterIds: who.characterIds,
      text: `${who.names.join(" and ")}: the storyline "${story.title}" ended: ${story.ending}.`,
    });
  } catch (error) {
    logger.debug(error, "[slurp] Could not tell Long-Term Memory how a storyline ended");
  }
}
