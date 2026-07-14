// Registry entry for the tic-tac-toe engine. The codegen scans turn-games/<game>/engine.manifest.ts
// and collects the single exported const into TURN_GAME_ENGINES.
import { ticTacToeEngine } from "./engine.js";

export const ticTacToeGameEngine = ticTacToeEngine;
