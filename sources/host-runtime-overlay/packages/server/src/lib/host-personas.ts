// Persona reads through api.runtime.resources (Pasta-Devs/Marinara-Agents#2230).
//
// Engine storage format 11 (Pasta-Devs/Marinara-Engine#9023) keeps a persona's authored fields in one `data`
// column. A bundled copy of the Engine's characters storage still declares the old flat `personas` table, so it
// would read every persona as blank. The Engine's live storage decodes either format into the same flat row, and
// `api.runtime.resources.listPersonas` hands that row over, so persona reads go there instead.
//
// Every other persona method of the bundled storage refuses: its reads see the same blank rows, and its writes
// would store a flat row the Engine no longer reads. No package calls them today.
//
// ponytail: only personas move. Characters still read through the bundled storage, because the host has no full
// character read or write API yet. That move is tracked in Pasta-Devs/Marinara-Engine#6385.

import { hostRuntime, requireHostMember } from "./host-runtime.js";

type PersonaReadStorage = {
  getPersona(id: string): Promise<unknown>;
  listPersonas(): Promise<unknown[]>;
};

type PersonaRow<T extends PersonaReadStorage> = NonNullable<Awaited<ReturnType<T["getPersona"]>>>;

function hostResources() {
  return requireHostMember("Reading personas", hostRuntime().resources);
}

/** The same storage, with persona reads answered by the Engine and every other persona method refused. */
export function withHostPersonas<T extends PersonaReadStorage>(storage: T): T {
  // Matched by name on purpose: a persona method the bundled copy gains later is refused too, instead of quietly
  // reading or writing the stale flat table.
  const refused = Object.fromEntries(
    Object.keys(storage)
      .filter((key) => key.includes("Persona") && key !== "getPersona" && key !== "listPersonas")
      .map((key) => [
        key,
        async () => {
          throw new Error(`${key} is not available to packages; personas are read through api.runtime.resources.`);
        },
      ]),
  );
  return {
    ...storage,
    ...refused,
    async getPersona(id: string) {
      const [record] = await hostResources().listPersonas([id]);
      return (record?.data as PersonaRow<T> | undefined) ?? null;
    },
    async listPersonas() {
      return (await hostResources().listPersonas()).map((record) => record.data as PersonaRow<T>);
    },
  };
}
