import type { SlpMessageDeepDetailsRecord } from "../../../../../shared/src/slp/slp-deep-details.js";

/** The fan seat reads a locked post's body as the Creator saw it only if the fan unlocked it; else it is masked. */
export function slpDeepDetailsSeatView(
  record: SlpMessageDeepDetailsRecord,
  seat: "viewer" | "creator",
): SlpMessageDeepDetailsRecord {
  const { paidBodies: all = [], ...rest } = record;
  // ponytail: a body under 8 characters would chew up the prompt text around it; exact-text match only, a reworded quote is not caught.
  const paidBodies = all.filter((body) => body.length >= 8);
  if (seat === "creator" || paidBodies.length === 0) return rest;
  const mask = (text: string) =>
    paidBodies.reduce(
      (out, body) => out.split(body).join("[paid post]").split(JSON.stringify(body).slice(1, -1)).join("[paid post]"),
      text,
    );
  return {
    ...rest,
    messages: rest.messages.map((message) => ({ ...message, content: mask(message.content) })),
    rawResponse: mask(rest.rawResponse),
  };
}
