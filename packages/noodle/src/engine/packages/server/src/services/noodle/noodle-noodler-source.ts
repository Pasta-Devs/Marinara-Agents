import type {
  NoodleAccount,
  NoodlerSourceSnapshot,
  NoodlerSourceStatus,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { parseRecord } from "./noodle-public-support.js";

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
