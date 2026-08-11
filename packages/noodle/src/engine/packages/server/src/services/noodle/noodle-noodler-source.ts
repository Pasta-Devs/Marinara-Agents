import { createHash } from "node:crypto";
import type {
  NoodleAccount,
  NoodleIdentityDisclosure,
  NoodlerSourceSnapshot,
  NoodlerSourceStatus,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { parseRecord } from "./noodle-public-support.js";

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

function sourceDigest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function hintedThemes(value: string): string {
  const words = new Set(value.toLocaleLowerCase().match(/[a-z]+/gu) ?? []);
  return HINTED_THEME_TOKENS.filter((token) => words.has(token)).join(" ");
}

export function minimizeNoodlerSourceSnapshot(
  snapshot: NoodlerSourceSnapshot,
  mode: NoodleIdentityDisclosure,
): NoodlerSourceSnapshot {
  if (mode === "open") return snapshot;
  return Object.fromEntries(
    (Object.keys(snapshot) as Array<keyof NoodlerSourceSnapshot>).map((field) => {
      const value = snapshot[field];
      const themes = mode === "hinted" && field === "personality"
        ? hintedThemes(value)
        : "";
      return [field, `${themes ? `${themes} ` : ""}revision:${sourceDigest(value)}`];
    }),
  ) as NoodlerSourceSnapshot;
}

export function isMinimizedNoodlerSourceSnapshot(
  snapshot: NoodlerSourceSnapshot,
): boolean {
  return (Object.keys(snapshot) as Array<keyof NoodlerSourceSnapshot>).every(
    (field) => /(?:^| )revision:[A-Za-z0-9_-]{43}$/u.test(snapshot[field]),
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function resolveNoodlerSourceSnapshot(
  db: DB,
  publicAccount: Pick<
    NoodleAccount,
    "kind" | "entityId" | "displayName" | "handle"
  >,
): Promise<NoodlerSourceSnapshot | null> {
  const characters = createCharactersStorage(db);
  if (publicAccount.kind === "character") {
    const source = await characters.getById(publicAccount.entityId);
    if (!source) return null;
    const data = parseRecord(source.data);
    const extensions = parseRecord(data.extensions);
    return {
      publicDisplayName: publicAccount.displayName,
      publicHandle: publicAccount.handle,
      name: text(data.name),
      description: text(data.description),
      personality: text(data.personality),
      scenario: text(data.scenario),
      appearance: text(data.appearance) || text(extensions.appearance),
      backstory: text(data.backstory) || text(extensions.backstory),
    };
  }
  if (publicAccount.kind === "persona") {
    const source = await characters.getPersona(publicAccount.entityId);
    if (!source) return null;
    return {
      publicDisplayName: publicAccount.displayName,
      publicHandle: publicAccount.handle,
      name: text(source.name),
      description: text(source.description),
      personality: text(source.personality),
      scenario: text(source.scenario),
      appearance: text(source.appearance),
      backstory: text(source.backstory),
    };
  }
  return null;
}

export function compareNoodlerSourceSnapshots(
  baseline: NoodlerSourceSnapshot,
  current: NoodlerSourceSnapshot,
): NoodlerSourceStatus {
  const changes = (
    Object.keys(baseline) as Array<keyof NoodlerSourceSnapshot>
  ).flatMap((field) =>
    baseline[field] === current[field]
      ? []
      : [{ field, previous: baseline[field], current: current[field] }],
  );
  return changes.length > 0
    ? { state: "changed", changes }
    : { state: "current" };
}

export function compareMinimizedNoodlerSourceSnapshot(
  baseline: NoodlerSourceSnapshot,
  current: NoodlerSourceSnapshot,
  mode: NoodleIdentityDisclosure,
): NoodlerSourceStatus {
  const minimizedCurrent = minimizeNoodlerSourceSnapshot(current, mode);
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
