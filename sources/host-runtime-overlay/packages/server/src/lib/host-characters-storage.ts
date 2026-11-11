// The characters storage Calls, Noodle and Slurp build. Package code imports createCharactersStorage from here, never
// from services/storage/characters.storage.js; tests/host-runtime-overlay.regression.mjs holds the packages to that.
// The overlay's services/storage/characters.storage.ts answers every call through api.runtime.resources
// (Pasta-Devs/Marinara-Agents#2242), so this is a plain re-export.

export { createCharactersStorage } from "../services/storage/characters.storage.js";
