// ──────────────────────────────────────────────
// Blackjack — model-facing move tool
// ──────────────────────────────────────────────
// NOT registered in the global tool registry. The runner injects this only on
// a bot seat's turn (scoped per active game). The human never uses it — the
// board UI posts moves to the REST endpoint directly. One flat tool covers
// betting and play; `describeForModel` lists which actions are legal right now
// and the bet range. There is no `next_round` tool — pacing between rounds is
// a human/UI-only move.

import type { ToolDefinition } from "../../function-calls/tool-definitions.js";
import type { BlackjackMove } from "./types.js";

export const blackjackActionToolManifest = {
  name: "blackjack_action",
  description:
    "Take your blackjack action. Pick ONE of the legal actions listed in your instructions " +
    '(e.g. "bet: min 10 max 990", "hit", "stand", "double", "split"). For bet, `amount` is the chips you ' +
    "stake on this round; stay inside the stated min/max. `amount` is ignored for every other action.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "The action to take.",
        enum: ["bet", "hit", "stand", "double", "split"],
      },
      amount: {
        type: "number",
        description: "For bet: the chips you stake this round. Ignored otherwise.",
      },
    },
    required: ["action"],
  },
} satisfies ToolDefinition;

/** All blackjack tools. */
export const BLACKJACK_TOOL_MANIFESTS: readonly ToolDefinition[] = [blackjackActionToolManifest];

/** Map a raw `blackjack_action` call onto a typed move. Returns `null` for any other tool name. A garbled
 * action still returns a best-effort move that `applyMove` rejects, so the runner falls back deterministically. */
export function parseBlackjackToolCall(name: string, args: Record<string, unknown>): BlackjackMove | null {
  if (name !== "blackjack_action") return null;
  const action = typeof args.action === "string" ? args.action.trim().toLowerCase() : "";
  const amount = typeof args.amount === "number" && Number.isFinite(args.amount) ? Math.floor(args.amount) : 0;
  switch (action) {
    case "bet":
      return { type: "bet", amount };
    case "hit":
    case "stand":
    case "double":
    case "split":
      return { type: action };
    default:
      return { type: "stand" };
  }
}
