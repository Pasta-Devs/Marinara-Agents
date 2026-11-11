// Characters and personas through api.runtime.resources (Pasta-Devs/Marinara-Agents#2242, capability API 1.819).
//
// This replaces the Engine's characters storage at the same path, so package code and the bundled Engine modules that
// import it (lorebook, macro and marker expansion) all read through the Engine's live storage instead of a bundled
// copy and its table declarations. A copy reads a newer storage format with the old shape and returns blank fields;
// that happened to personas on storage format 11 (Pasta-Devs/Marinara-Engine#9023).
//
// Rows keep the bundled storage's shapes: `data` is the stored JSON string, groups keep `characterIds` as a JSON
// string. The one write is `updateExtensions`: each key replaces the stored value whole, other keys and the card's
// authored fields stay, and the Engine queues it behind its own saves of that card. It needs `character-write`.
// Every other method of the Engine storage refuses by name, so a bundled caller fails loudly instead of with
// "is not a function".

import {
  hostRuntime,
  requireHostMember,
  type HostCharacterGroupRow,
  type HostCharacterPageOptions,
  type HostCharacterRow,
  type HostCharacterSummary,
} from "../../lib/host-runtime.js";

export type CharacterRow = HostCharacterRow;
export type CharacterListPageOptions = HostCharacterPageOptions;

// The Engine storage's other methods. None is called by a package today; each refuses rather than going missing.
const REFUSED = [
  "getByIds",
  "update",
  "listVersions",
  "getVersionById",
  "createVersionSnapshot",
  "create",
  "updateAvatar",
  "restoreVersion",
  "deleteVersion",
  "remove",
  "duplicateCharacter",
  "listPersonasPage",
  "listPersonaVersions",
  "getPersonaVersionById",
  "createPersonaVersionSnapshot",
  "createPersona",
  "setActivePersona",
  "removePersona",
  "duplicatePersona",
  "updatePersona",
  "restorePersonaVersion",
  "deletePersonaVersion",
  "getGroupById",
  "createGroup",
  "updateGroup",
  "removeGroup",
  "listPersonaGroups",
  "getPersonaGroupById",
  "createPersonaGroup",
  "updatePersonaGroup",
  "removePersonaGroup",
] as const;

function resources(feature: string) {
  return requireHostMember(feature, hostRuntime().resources);
}

function member<T>(feature: string, value: T | undefined): T {
  return requireHostMember(feature, value);
}

/** `db` is ignored: the Engine reads its own store. Kept so callers build it the way they built the bundled one. */
export function createCharactersStorage(_db?: unknown) {
  const refused = Object.fromEntries(
    REFUSED.map((key) => [
      key,
      async () => {
        throw new Error(`${key} is not available to packages; characters are read through api.runtime.resources.`);
      },
    ]),
  ) as Record<(typeof REFUSED)[number], () => Promise<never>>;
  return {
    ...refused,

    async getById(id: string): Promise<CharacterRow | null> {
      const host = resources("Reading characters");
      const rows = await member("Reading characters", host.getCharacters?.bind(host))([id]);
      return rows.find((row) => row.id === id) ?? null;
    },

    /** Every character, most recently updated first. */
    async list(): Promise<CharacterRow[]> {
      const host = resources("Reading characters");
      return member("Reading characters", host.getCharacters?.bind(host))();
    },

    async listGroups(): Promise<HostCharacterGroupRow[]> {
      const host = resources("Reading character groups");
      return member("Reading character groups", host.listCharacterGroups?.bind(host))();
    },

    /** The library's search and sort; the Engine clamps `limit` to 1..100. */
    async listPage(options: CharacterListPageOptions) {
      const host = resources("Listing characters");
      return member("Listing characters", host.listCharactersPage?.bind(host))(options);
    },

    async listSummariesByIds(ids: string[]): Promise<HostCharacterSummary[]> {
      const host = resources("Listing characters");
      return member("Listing characters", host.listCharacterSummaries?.bind(host))(ids);
    },

    /** Set top-level keys of `data.extensions`; null clears one. Resolves the updated row, or null for an unknown id. */
    async updateExtensions(id: string, patch: Record<string, unknown>): Promise<CharacterRow | null> {
      const host = resources("Saving to a character");
      return member("Saving to a character", host.updateCharacterExtensions?.bind(host))(id, patch);
    },

    async getPersona(id: string): Promise<any> {
      const records = await resources("Reading personas").listPersonas([id]);
      return records.find((record) => record.id === id)?.data ?? null;
    },

    async listPersonas(): Promise<any[]> {
      return (await resources("Reading personas").listPersonas()).map((record) => record.data);
    },
  };
}
