// Registry entry for the poker engine. The codegen scans turn-games/<game>/engine.manifest.ts
// and collects the single exported const into TURN_GAME_ENGINES.
import { pokerEngine } from "./engine.js";

export const pokerGameEngine = pokerEngine;
