/**
 * A Support line that carries a desk step (docs/SUPPORT-DESK.md): an Offer the Creator answers first,
 * or a move that happens with the message (a perk, a warning, a rumour told by Support). Checked
 * before anything is sent, so a step that cannot happen never leaves a line behind.
 */
import { z } from "zod";
import type { DB } from "../../../../db/connection.js";
import { previewSlpAction, runSlpAction } from "../../assist/slp-assist-contract.js";
import { slurpDeskOfferSummary } from "../../../modules/messages/slp-support-desk-talk.js";
import { SLP_DESK_NOW, SLP_DESK_OFFERABLE } from "../../../../../../shared/src/slp/slp-actions.js";
import { slpStirStepSchema } from "../../../../../../shared/src/slp/slp-stir.js";
import { updateSlurpSupportDesk } from "../../../data/creators/slp-support-desk-storage.js";

export const slurpDeskSendSchema = z.object({ mode: z.enum(["offer", "now"]), step: slpStirStepSchema }).strict();
export type SlurpDeskSend = z.infer<typeof slurpDeskSendSchema>;

type Prepared =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      /** Metadata for the Support line. */
      metadata: Record<string, unknown>;
      /** A rumour told by Support is the line itself: the lever writes it, nothing else is sent. */
      rumour: boolean;
      /** Runs a move after the line is stored; answers with an error line or null. */
      run: (() => Promise<{ error: string | null; value: unknown }>) | null;
    };

/** Is this Creator the one the step acts on? A step aimed at someone else never rides this thread. */
function aimsAt(input: Record<string, unknown>, creatorAccountId: string): boolean {
  if (typeof input.accountId === "string") return input.accountId === creatorAccountId;
  if (typeof input.aId === "string") return input.aId === creatorAccountId || input.bId === creatorAccountId;
  return false;
}

export async function prepareSlurpDeskSend(
  db: DB,
  input: { creatorAccountId: string; content: string; desk: SlurpDeskSend },
): Promise<Prepared> {
  const { mode, step } = input.desk;
  const allowed: readonly string[] = mode === "offer" ? SLP_DESK_OFFERABLE : SLP_DESK_NOW;
  if (!allowed.includes(step.action)) return { ok: false, status: 400, error: "Support cannot do that here." };
  const raw: Record<string, unknown> = { ...step.input };
  // The message is the warning or the rumour: its words go into the step.
  if (step.action === "warn-creator" && typeof raw.reason !== "string") raw.reason = input.content.slice(0, 200);
  if (step.action === "plant-rumour") Object.assign(raw, { text: input.content.slice(0, 200), via: "support" });
  if (!aimsAt(raw, input.creatorAccountId))
    return { ok: false, status: 400, error: "That step is for another Creator." };
  const preview = await previewSlpAction(db, step.action, raw);
  if (!preview.ok) return preview;
  if (preview.value.error) return { ok: false, status: 409, error: preview.value.error };
  const parsed = preview.value.input;
  if (mode === "offer")
    return {
      ok: true,
      metadata: {
        deskOffer: {
          action: step.action,
          input: parsed,
          summary: slurpDeskOfferSummary(step.action, parsed),
          status: "pending",
        },
      },
      rumour: false,
      run: null,
    };
  return {
    ok: true,
    metadata: { deskMove: { action: step.action, input: parsed } },
    rumour: step.action === "plant-rumour",
    run: async () => {
      const ran = await runSlpAction(db, step.action, parsed);
      return ran.ok ? { error: null, value: ran.value } : { error: ran.error, value: null };
    },
  };
}

/** Support wrote in the thread: an open ticket now waits on the Creator. */
export async function markSlurpDeskSupportTurn(db: DB, creatorAccountId: string): Promise<void> {
  await updateSlurpSupportDesk(db, creatorAccountId, (desk) =>
    desk.ticket?.status === "open" ? { ...desk, ticket: { ...desk.ticket, status: "waiting" } } : desk,
  );
}
