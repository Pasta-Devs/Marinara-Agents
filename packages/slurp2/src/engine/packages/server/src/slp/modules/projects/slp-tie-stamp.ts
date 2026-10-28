/**
 * What a post made for a collab, a brand deal, a rivalry or a couple carries in its metadata (`slurpTie`).
 * A leaf on purpose: the beat parser and the money paths read it without pulling in the tie rules.
 */
import { clampText } from "./slp-project.js";

export const SLURP_COLLAB_DEFAULT_SHARE = 50;

export const slurpClampShare = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(90, Math.max(10, Math.round(value)))
    : SLURP_COLLAB_DEFAULT_SHARE;

/** What a post stamped by a tie carries in its metadata (`slurpTie`). */
export type SlurpTieStamp = {
  kind: "collab" | "sponsor" | "rival" | "couple";
  id: string;
  partnerId?: string;
  hostShare?: number;
  brand?: string;
  /** A post about a deal they turned down: no label, no fee. */
  declined?: boolean;
  /** A couple post: the moment it tells (`slp-creator-couples.ts`). */
  moment?: string;
  momentId?: string;
  /** A couple post made together: it shows on both pages and splits like a collab. */
  joint?: boolean;
  /** A post on the couple's shared page: that page is its author; `hostId` wrote it. */
  pageId?: string;
  hostId?: string;
  /** The collab partner's own post about it: their post alone, no split, not the joint post. */
  echo?: boolean;
  /** A collab's announcement ("collab with @kai drops Friday"): the host's post alone, no split. */
  announce?: boolean;
  /** A collab the two planned as a spicy shoot together in their DMs (U). */
  shoot?: boolean;
  /** A couple post about a secret relationship with the player: the fans do not know who it is. */
  secret?: boolean;
};

export function readSlurpTieStamp(metadata: Record<string, unknown> | null | undefined): SlurpTieStamp | null {
  const raw = metadata?.slurpTie;
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const kind = (["collab", "sponsor", "rival", "couple"] as const).find((entry) => entry === value?.kind);
  const id = clampText(value?.id, 64);
  if (!value || !kind || !id) return null;
  return {
    kind,
    id,
    ...(typeof value.partnerId === "string" ? { partnerId: value.partnerId } : {}),
    ...(typeof value.hostShare === "number" ? { hostShare: slurpClampShare(value.hostShare) } : {}),
    ...(typeof value.brand === "string" ? { brand: clampText(value.brand, 80) } : {}),
    ...(value.declined === true ? { declined: true } : {}),
    ...(typeof value.moment === "string" ? { moment: clampText(value.moment, 24) } : {}),
    ...(typeof value.momentId === "string" ? { momentId: clampText(value.momentId, 64) } : {}),
    ...(value.joint === true ? { joint: true } : {}),
    ...(typeof value.pageId === "string" ? { pageId: value.pageId } : {}),
    ...(typeof value.hostId === "string" ? { hostId: value.hostId } : {}),
    ...(value.echo === true ? { echo: true } : {}),
    ...(value.announce === true ? { announce: true } : {}),
    ...(value.shoot === true ? { shoot: true } : {}),
    ...(value.secret === true ? { secret: true } : {}),
  };
}
