// Registry entry for the UNO engine. The codegen scans turn-games/<game>/engine.manifest.ts
// and collects the single exported const into TURN_GAME_ENGINES.
import { unoEngine } from "./engine.js";

export const unoGameEngine = unoEngine;
