// Registry entry for the 8-ball engine. The codegen scans turn-games/<game>/engine.manifest.ts
// and collects the single exported const into TURN_GAME_ENGINES.
import { eightBallEngine } from "./engine.js";

export const eightballGameEngine = eightBallEngine;
