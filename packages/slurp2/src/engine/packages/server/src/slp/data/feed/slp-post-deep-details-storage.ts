import type { DB } from "../../../db/connection.js";
import { eq } from "../../../db/file-query.js";
import { slpPostDeepDetails } from "../../../db/schema/slurp.js";
import type { SlpDeepDetailsRecord } from "../../../../../shared/src/slp/slp-deep-details.js";

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

export async function setSlurpPostDeepDetailsProviderPrompt(db: DB, id: string, providerPrompt: string): Promise<void> {
  const record = await getSlurpPostDeepDetails(db, id);
  if (!record) return;
  await db
    .update(slpPostDeepDetails)
    .set({ record: JSON.stringify({ ...record, providerPrompt }) })
    .where(eq(slpPostDeepDetails.id, id));
}

export async function deleteSlurpPostDeepDetails(tx: Pick<DB, "delete">, id: string): Promise<void> {
  await tx.delete(slpPostDeepDetails).where(eq(slpPostDeepDetails.id, id));
}
