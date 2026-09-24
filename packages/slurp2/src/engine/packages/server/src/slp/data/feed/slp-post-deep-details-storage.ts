import type { DB } from "../../../db/connection.js";
import { eq } from "../../../db/file-query.js";
import { slpPostDeepDetails } from "../../../db/schema/slurp.js";
import { logger } from "../../../lib/logger.js";
import type { SlpDeepDetailsImageRun, SlpDeepDetailsRecord } from "../../../../../shared/src/slp/slp-deep-details.js";

export async function saveSlurpPostDeepDetails(
  db: DB,
  input: { id: string; creatorAccountId: string; record: SlpDeepDetailsRecord },
): Promise<void> {
  await db.insert(slpPostDeepDetails).values({
    id: input.id,
    creatorAccountId: input.creatorAccountId,
    record: JSON.stringify(input.record),
    createdAt: input.record.generatedAt,
  });
}

export async function getSlurpPostDeepDetails(db: DB, id: string): Promise<SlpDeepDetailsRecord | null> {
  const [row] = await db.select().from(slpPostDeepDetails).where(eq(slpPostDeepDetails.id, id));
  if (!row) return null;
  try {
    return JSON.parse(String(row.record)) as SlpDeepDetailsRecord;
  } catch {
    return null;
  }
}

/** Enough history to compare a redraw with the runs before it without letting the record grow unbounded. */
export const SLP_DEEP_DETAILS_IMAGE_RUN_LIMIT = 5;

export async function appendSlurpPostDeepDetailsImageRun(
  db: DB,
  id: string,
  run: SlpDeepDetailsImageRun,
): Promise<void> {
  const record = await getSlurpPostDeepDetails(db, id);
  if (!record) return;
  const imageRuns = [...(record.imageRuns ?? []), run].slice(-SLP_DEEP_DETAILS_IMAGE_RUN_LIMIT);
  // A preview or a failed run is not the picture that shipped, so it never replaces a prompt that did.
  const providerPrompt =
    run.result.status === "saved" || !record.providerPrompt
      ? (run.finalPrompt ?? record.providerPrompt)
      : record.providerPrompt;
  await db
    .update(slpPostDeepDetails)
    .set({ record: JSON.stringify({ ...record, providerPrompt, imageRuns }) })
    .where(eq(slpPostDeepDetails.id, id));
}

/** The `onImageRun` hook for a post that owns a Deep details record; undefined when it has none. */
export function slurpDeepDetailsImageRunRecorder(
  db: DB,
  deepDetailsId: unknown,
  trigger: SlpDeepDetailsImageRun["trigger"],
) {
  if (typeof deepDetailsId !== "string" || !deepDetailsId) return undefined;
  return {
    trigger,
    record: (run: SlpDeepDetailsImageRun) =>
      appendSlurpPostDeepDetailsImageRun(db, deepDetailsId, run).catch((error: unknown) => {
        logger.warn(error, "[slurp] Could not add the image run to deep details");
      }),
  };
}

export async function deleteSlurpPostDeepDetails(tx: Pick<DB, "delete">, id: string): Promise<void> {
  await tx.delete(slpPostDeepDetails).where(eq(slpPostDeepDetails.id, id));
}
