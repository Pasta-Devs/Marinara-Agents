// ──────────────────────────────────────────────
// Poker — model-facing move tool
// ──────────────────────────────────────────────
// NOT registered in the global tool registry. The runner injects this only on
// a bot seat's turn (scoped per active game). The human never uses it — the
// board UI posts moves to the REST endpoint directly. One flat tool covers the
// whole action space; `describeForModel` tells the model exactly which of
// these are legal right now and the min/max for `amount`. There is no
// `next_hand` tool — pacing the session between hands is a human/UI-only move.

import type { ToolDefinition } from "../../function-calls/tool-definitions.js";
import type { PokerMove } from "./types.js";

export const pokerActionToolManifest = {
  name: "poker_action",
  description:
    "Take your poker action. Pick ONE of the legal actions listed in your instructions " +
    '(e.g. "check", "call 40", "bet: min 20 max 980", "raise: min-to 80, max-to 1020", "fold", "all_in"). ' +
    "For bet, `amount` is the chips you put in. For raise, `amount` is the TOTAL you raise the street's bet to " +
    "(not the increment). `amount` is ignored for fold/check/call/all_in. Copy amounts from within the stated " +
    "min/max range — out-of-range amounts are clamped, not rejected, but stay inside the range you were given.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "The action to take.",
        enum: ["fold", "check", "call", "bet", "raise", "all_in"],
      },
      amount: {
        type: "number",
        description:
          "For bet: the chips you put in. For raise: the TOTAL amount you raise the street's bet to. Ignored otherwise.",
      },
    },
    required: ["action"],
  },
} satisfies ToolDefinition;

/** All poker tools. */
export const POKER_TOOL_MANIFESTS: readonly ToolDefinition[] = [pokerActionToolManifest];

/** Map a raw `poker_action` tool call onto a typed move. Returns `null` for any other tool name.
 * An unknown/missing `action` still returns a best-effort move (`applyMove` rejects it and the
 * runner's deterministic fallback kicks in), per the engine contract. */
export function parsePokerToolCall(name: string, args: Record<string, unknown>): PokerMove | null {
  if (name !== "poker_action") return null;
  const action = typeof args.action === "string" ? args.action.trim().toLowerCase() : "";
  const rawAmount = args.amount;
  const amount = typeof rawAmount === "number" && Number.isFinite(rawAmount) ? Math.floor(rawAmount) : 0;

  switch (action) {
    case "fold":
      return { type: "fold" };
    case "check":
      return { type: "check" };
    case "call":
      return { type: "call" };
    case "bet":
      return { type: "bet", amount };
    case "raise":
      return { type: "raise", toAmount: amount };
    case "all_in":
    case "allin":
    case "all-in":
      return { type: "all_in" };
    default:
      // Best-effort fallback for a garbled/missing action — applyMove will reject
      // it (check facing a bet fails) and the runner falls back deterministically.
      return { type: "check" };
  }
}
