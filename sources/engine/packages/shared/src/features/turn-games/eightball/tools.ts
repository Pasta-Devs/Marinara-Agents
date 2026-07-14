// ──────────────────────────────────────────────
// 8-Ball Pool — model-facing move tool
// ──────────────────────────────────────────────
// NOT registered in the global tool registry. The runner injects this only on
// a bot seat's turn (scoped per active game). The human never uses it — the
// v2 board UI aims/shoots directly (`aimed`/`place` moves), since an LLM can't
// aim a cursor. One flat tool covers the whole bot action space (break /
// in-rack shot / safety are all a `kind: "menu"` move with a shotId copied
// from the candidate menu `describeForModel` provides — the engine converts
// the pick into an aim + power with skill/style jitter and runs the same
// physics simulation a human's aim would); there is no separate `next_rack`
// tool — pacing between racks is a human/UI-only move (mirrors poker's
// `next_hand`).

import type { ToolDefinition } from "../../function-calls/tool-definitions.js";
import type { EightBallMove, ShotStyle } from "./types.js";

export const eightBallActionToolManifest = {
  name: "eightball_action",
  description:
    "Take your 8-ball shot. Copy `shotId` EXACTLY from the shot menu you were given " +
    '(e.g. "pot-3-NE", "bank-5-SW", "safety-12", or "break" during the break). ' +
    'Optionally set `style` to "controlled" (safer, tighter position) or "aggressive" ' +
    '(riskier, better position, higher scratch odds) — defaults to "controlled". ' +
    'Use action "break" only on the opening shot of a rack; use "shoot" for every other shot. ' +
    "The odds shown in the menu are ESTIMATES, not a guaranteed outcome — your aim is executed " +
    "with skill-based accuracy and the physics decides what actually happens.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "The kind of action — \"break\" only opens a rack, \"shoot\" covers every other move.",
        enum: ["break", "shoot"],
      },
      shotId: {
        type: "string",
        description: 'The id of the shot to take, copied verbatim from your shot menu (e.g. "pot-3-NE").',
      },
      style: {
        type: "string",
        description: 'Shot style: "controlled" (default) or "aggressive".',
        enum: ["controlled", "aggressive"],
      },
    },
    required: ["action"],
  },
} satisfies ToolDefinition;

/** All 8-ball tools. */
export const EIGHTBALL_TOOL_MANIFESTS: readonly ToolDefinition[] = [eightBallActionToolManifest];

/** Map a raw `eightball_action` tool call onto a typed move. Returns `null` for any other
 * tool name. An unknown/garbled call still returns a best-effort move that `applyMove`
 * will reject, per the engine contract — the runner's deterministic fallback kicks in. */
export function parseEightBallToolCall(name: string, args: Record<string, unknown>): EightBallMove | null {
  if (name !== "eightball_action") return null;
  const action = typeof args.action === "string" ? args.action.trim().toLowerCase() : "";
  const rawShotId = typeof args.shotId === "string" ? args.shotId.trim() : "";
  const rawStyle = typeof args.style === "string" ? args.style.trim().toLowerCase() : "";
  const style: ShotStyle = rawStyle === "aggressive" ? "aggressive" : "controlled";

  if (action === "break") return { kind: "menu", shotId: "break", style };
  if (action === "shoot") {
    // Leniency: "shoot" with no shotId is how a model naturally calls the sole
    // break candidate when it forgets to say action="break" — default to it.
    // If the game isn't actually in the break phase, applyMove rejects "break"
    // and returns the real legal set, and the fallback picks deterministically.
    return { kind: "menu", shotId: rawShotId || "break", style };
  }
  // Unknown/missing action: still a well-shaped move so applyMove can reject it cleanly.
  return { kind: "menu", shotId: rawShotId, style };
}
