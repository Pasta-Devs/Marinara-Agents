// The characters storage Calls, Noodle and Slurp build: the bundled Engine copy for characters, with persona reads
// answered by the Engine (lib/host-personas.ts, Pasta-Devs/Marinara-Agents#2230). Package code imports
// createCharactersStorage from here, never from services/storage/characters.storage.js;
// tests/host-runtime-overlay.regression.mjs holds the packages to that.

import { createCharactersStorage as createBundledCharactersStorage } from "../services/storage/characters.storage.js";
import { withHostPersonas } from "./host-personas.js";

export function createCharactersStorage(db: Parameters<typeof createBundledCharactersStorage>[0]) {
  return withHostPersonas(createBundledCharactersStorage(db));
}
