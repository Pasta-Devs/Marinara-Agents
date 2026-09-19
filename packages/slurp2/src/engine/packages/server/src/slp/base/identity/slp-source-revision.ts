import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SlpCreatorSourceSnapshot } from "../../../../../shared/src/slp/slp-social.types.js";

// Drafts live only for the current Engine session, so an ephemeral signing key is
// preferable to persisting another secret. Restarting invalidates an open draft and
// asks the user to regenerate it; no private source fields ever leave the server.
const sourceRevisionKey = randomBytes(32);

function sourceRevisionPayload(noodlerAccountId: string, snapshot: SlpCreatorSourceSnapshot): string {
  return JSON.stringify([
    noodlerAccountId,
    snapshot.publicDisplayName,
    snapshot.publicHandle,
    snapshot.name,
    snapshot.description,
    snapshot.personality,
    snapshot.scenario,
    snapshot.appearance,
    snapshot.backstory,
  ]);
}

export function createCreatorSourceRevisionToken(noodlerAccountId: string, snapshot: SlpCreatorSourceSnapshot): string {
  return createHmac("sha256", sourceRevisionKey)
    .update(sourceRevisionPayload(noodlerAccountId, snapshot))
    .digest("base64url");
}

export function verifyCreatorSourceRevisionToken(
  token: string,
  noodlerAccountId: string,
  snapshot: SlpCreatorSourceSnapshot,
): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) return false;
  const expected = Buffer.from(createCreatorSourceRevisionToken(noodlerAccountId, snapshot), "utf8");
  const submitted = Buffer.from(token, "utf8");
  return submitted.length === expected.length && timingSafeEqual(submitted, expected);
}
