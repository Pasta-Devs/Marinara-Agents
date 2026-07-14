// Registry entry for the rock-paper-scissors engine. The codegen scans turn-games/<game>/engine.manifest.ts
// and collects the single exported const into TURN_GAME_ENGINES.
import { rockPaperScissorsEngine } from "./engine.js";

export const rockPaperScissorsGameEngine = rockPaperScissorsEngine;
