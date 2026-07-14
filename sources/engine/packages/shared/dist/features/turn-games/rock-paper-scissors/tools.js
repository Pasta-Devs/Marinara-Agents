// ──────────────────────────────────────────────
// Rock-Paper-Scissors — model-facing move tool
// ──────────────────────────────────────────────
// NOT registered in the global tool registry. The runner injects this only on
// a bot seat's turn (scoped per active game). The human never uses it — the
// board UI posts moves to the REST endpoint directly.
export const rockPaperScissorsThrowToolManifest = {
    name: "rock_paper_scissors_throw",
    description: "Make your throw for this round of rock-paper-scissors. Choose exactly one of rock, paper, or scissors. " +
        "Your opponent cannot see this choice until both players have thrown.",
    parameters: {
        type: "object",
        properties: {
            choice: {
                type: "string",
                enum: ["rock", "paper", "scissors"],
                description: "Your throw for this round.",
            },
        },
        required: ["choice"],
    },
};
/** All rock-paper-scissors tools. */
export const ROCK_PAPER_SCISSORS_TOOL_MANIFESTS = [rockPaperScissorsThrowToolManifest];
//# sourceMappingURL=tools.js.map