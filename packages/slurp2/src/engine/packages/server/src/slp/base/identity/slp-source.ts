import { createHmac, randomBytes } from "node:crypto";
import type {
  SlpCreatorSourceSnapshot,
  SlpCreatorSourceStatus,
  SlpIdentityDisclosure,
} from "../../../../../shared/src/slp/slp-social.types.js";

const HINTED_THEME_TOKENS = [
  "adventurous",
  "artistic",
  "bookish",
  "calm",
  "cheerful",
  "creative",
  "curious",
  "friendly",
  "gentle",
  "inventive",
  "kind",
  "musical",
  "outgoing",
  "playful",
  "reserved",
  "scientific",
  "sporty",
  "technical",
  "thoughtful",
  "witty",
] as const;

// Stored hinted/secret snapshots keep only a digest of each private field. A plain
// hash of a short field (a name, a handle) is guessable, so each stored field carries
// its own random salt and the digest is an HMAC under that salt: a reader of the
// database can no longer confirm a guessed source identity from a precomputed table.
// Comparison reuses the baseline's salt so the same value still digests to the same
// token.
const REVISION_TOKEN = /(?:^| )revision:([A-Za-z0-9_-]{22})\.[A-Za-z0-9_-]{43}$/u;

function sourceDigest(value: string, salt: string): string {
  return `${salt}.${createHmac("sha256", salt).update(value).digest("base64url")}`;
}

function saltFor(baselineField: string | undefined): string {
  return (baselineField ? REVISION_TOKEN.exec(baselineField)?.[1] : undefined) ?? randomBytes(16).toString("base64url");
}

function hintedThemes(value: string): string {
  const words = new Set(value.toLocaleLowerCase().match(/[a-z]+/gu) ?? []);
  return HINTED_THEME_TOKENS.filter((token) => words.has(token)).join(" ");
}

export function minimizeNoodlerSourceSnapshot(
  snapshot: SlpCreatorSourceSnapshot,
  mode: SlpIdentityDisclosure,
  baseline?: SlpCreatorSourceSnapshot | null,
): SlpCreatorSourceSnapshot {
  if (mode === "open") return snapshot;
  return Object.fromEntries(
    (Object.keys(snapshot) as Array<keyof SlpCreatorSourceSnapshot>).map((field) => {
      const value = snapshot[field];
      const themes = mode === "hinted" && field === "personality" ? hintedThemes(value) : "";
      const digest = sourceDigest(value, saltFor(baseline?.[field]));
      return [field, `${themes ? `${themes} ` : ""}revision:${digest}`];
    }),
  ) as SlpCreatorSourceSnapshot;
}

export function isMinimizedNoodlerSourceSnapshot(snapshot: SlpCreatorSourceSnapshot): boolean {
  // Unsalted legacy tokens deliberately fail this test, so storage re-minimizes them.
  return (Object.keys(snapshot) as Array<keyof SlpCreatorSourceSnapshot>).every((field) =>
    REVISION_TOKEN.test(snapshot[field]),
  );
}

export function compareNoodlerSourceSnapshots(
  baseline: SlpCreatorSourceSnapshot,
  current: SlpCreatorSourceSnapshot,
): SlpCreatorSourceStatus {
  const changes = (Object.keys(baseline) as Array<keyof SlpCreatorSourceSnapshot>).flatMap((field) =>
    baseline[field] === current[field] ? [] : [{ field, previous: baseline[field], current: current[field] }],
  );
  return changes.length > 0 ? { state: "changed", changes } : { state: "current" };
}

export function compareMinimizedNoodlerSourceSnapshot(
  baseline: SlpCreatorSourceSnapshot,
  current: SlpCreatorSourceSnapshot,
  mode: SlpIdentityDisclosure,
): SlpCreatorSourceStatus {
  const minimizedCurrent = minimizeNoodlerSourceSnapshot(current, mode, baseline);
  const comparison = compareNoodlerSourceSnapshots(baseline, minimizedCurrent);
  if (mode === "open" || comparison.state !== "changed") return comparison;
  return {
    state: "changed",
    changes: comparison.changes.map((change) => ({
      field: change.field,
      previous: "Stored private revision",
      current: "Current private revision",
    })),
  };
}
