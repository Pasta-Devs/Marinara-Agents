// ──────────────────────────────────────────────
// Tic-Tac-Toe — model-facing move tool
// ──────────────────────────────────────────────
// NOT registered in the global tool registry. The runner injects this only on
// a bot seat's turn (scoped per active game). The human never uses it — the
// board UI posts moves to the REST endpoint directly.

import type { ToolDefinition } from "../../function-calls/tool-definitions.js";

export const ticTacToeMoveToolManifest = {
  name: "tic_tac_toe_move",
  description:
    "Place your mark on the tic-tac-toe board. Copy EXACTLY one cell index from the legal-move list you were " +
    "given (0-8, row-major: 0,1,2 top row / 3,4,5 middle row / 6,7,8 bottom row). Never invent a cell that is not on the list.",
  parameters: {
    type: "object",
    properties: {
      cell: {
        type: "number",
        description: "The board cell to place your mark on (0-8), copied verbatim from the legal-move list.",
      },
    },
    required: ["cell"],
  },
} satisfies ToolDefinition;

/** All tic-tac-toe tools. */
export const TIC_TAC_TOE_TOOL_MANIFESTS: readonly ToolDefinition[] = [ticTacToeMoveToolManifest];
