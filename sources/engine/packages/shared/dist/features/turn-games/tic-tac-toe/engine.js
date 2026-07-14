// ──────────────────────────────────────────────
// Tic-Tac-Toe — deterministic engine (server-authoritative)
// ──────────────────────────────────────────────
// Pure functions over TicTacToeState. Open information (both players and
// spectators see the full board), no randomness beyond the deterministic
// mark assignment derived from the setup seed. X always moves first.
import { cloneState, nameOfSeat, recordEvent, setLastAction } from "../engine-utils.js";
import { TIC_TAC_TOE_TOOL_MANIFESTS } from "./tools.js";
import { DEFAULT_TIC_TAC_TOE_CONFIG, TIC_TAC_TOE_LINES, TIC_TAC_TOE_LOG_CAP, TIC_TAC_TOE_MAX_PLAYERS, TIC_TAC_TOE_MIN_PLAYERS, ticTacToeConfigSchema, } from "./types.js";
// ── small helpers ───────────────────────────────────────────────────────────
const clone = (cloneState);
const nameOf = nameOfSeat;
const record = (state, event) => recordEvent(state, event, TIC_TAC_TOE_LOG_CAP);
const setLast = setLastAction;
function seatForMark(state, mark) {
    return mark === "X" ? state.xSeatId : state.oSeatId;
}
function markOfSeat(state, seatId) {
    if (seatId === state.xSeatId)
        return "X";
    if (seatId === state.oSeatId)
        return "O";
    return null;
}
/** Whose mark moves next, derived from the count of filled cells (X always goes first). */
function markToMove(state) {
    const filled = state.cells.filter((c) => c !== null).length;
    return filled % 2 === 0 ? "X" : "O";
}
function findWinningLine(cells) {
    for (const line of TIC_TAC_TOE_LINES) {
        const [a, b, c] = line;
        const mark = cells[a];
        if (mark && mark === cells[b] && mark === cells[c])
            return { mark, line: [a, b, c] };
    }
    return null;
}
function enumerateLegalMoves(state, seatId) {
    if (state.status === "finished")
        return [];
    if (seatForMark(state, markToMove(state)) !== seatId)
        return [];
    return state.cells.reduce((acc, cell, idx) => {
        if (cell === null)
            acc.push({ type: "move", cell: idx });
        return acc;
    }, []);
}
// ── prompt builders ─────────────────────────────────────────────────────────
function renderBoard(cells) {
    const cell = (i) => cells[i] ?? String(i);
    return [
        ` ${cell(0)} | ${cell(1)} | ${cell(2)} `,
        "-----------",
        ` ${cell(3)} | ${cell(4)} | ${cell(5)} `,
        "-----------",
        ` ${cell(6)} | ${cell(7)} | ${cell(8)} `,
    ].join("\n");
}
function buildBoardSummary(state, seatId) {
    const yourMark = markOfSeat(state, seatId) ?? "X";
    const oppSeatId = seatId === state.xSeatId ? state.oSeatId : state.xSeatId;
    const oppMark = yourMark === "X" ? "O" : "X";
    const lines = [
        `Tic-Tac-Toe. You are ${nameOf(state, seatId)}, playing ${yourMark}. ` +
            `Your opponent is ${nameOf(state, oppSeatId)} (${oppMark}).`,
        renderBoard(state.cells),
    ];
    if (state.lastMove) {
        lines.push(`Last move: ${nameOf(state, state.lastMove.seatId)} placed ${state.lastMove.mark} on cell ${state.lastMove.cell}.`);
    }
    return lines.join("\n");
}
function buildInstructions(cells) {
    return (`Legal cells: ${cells.join(", ")}\n` +
        `Call tic_tac_toe_move with exactly ONE of these cell numbers — copy it verbatim. ` +
        `Any other cell is illegal and a fallback move will be chosen for you.`);
}
function buildSpectatorSummary(state) {
    const x = nameOf(state, state.xSeatId);
    const o = nameOf(state, state.oSeatId);
    if (state.status === "finished") {
        const lines = [];
        if (state.winnerSeatId) {
            const winner = nameOf(state, state.winnerSeatId);
            const loser = state.winnerSeatId === state.xSeatId ? o : x;
            lines.push(`The tic-tac-toe game just finished — ${winner} beat ${loser} with three in a row.`);
        }
        else {
            lines.push(`The tic-tac-toe game between ${x} (X) and ${o} (O) just ended in a draw.`);
        }
        lines.push(renderBoard(state.cells));
        return lines.join("\n");
    }
    const lines = [`A game of tic-tac-toe is in progress at the table: ${x} (X) vs ${o} (O).`, renderBoard(state.cells)];
    const toMove = seatForMark(state, markToMove(state));
    lines.push(`${nameOf(state, toMove)} is deciding their move.`);
    return lines.join("\n");
}
function buildParticipantSummary(state, seatId) {
    const base = buildSpectatorSummary(state);
    const mark = markOfSeat(state, seatId);
    if (!mark)
        return base;
    const oppSeatId = seatId === state.xSeatId ? state.oSeatId : state.xSeatId;
    const lines = [base, `You are ${nameOf(state, seatId)}, playing ${mark} against ${nameOf(state, oppSeatId)}.`];
    if (state.status !== "finished" && seatForMark(state, markToMove(state)) === seatId) {
        lines.push("It is YOUR move.");
    }
    if (state.lastMove?.seatId === seatId)
        lines.push(`Your last move was cell ${state.lastMove.cell}.`);
    return lines.join("\n");
}
// ── deterministic fallback ──────────────────────────────────────────────────
/** A deterministic, never-embarrassing legal move: win-in-1 > block opponent's win-in-1 >
 * center > corner > edge. Pure in the state. */
function pickFallback(state) {
    const mark = markToMove(state);
    const oppMark = mark === "X" ? "O" : "X";
    const empties = state.cells.reduce((acc, c, i) => {
        if (c === null)
            acc.push(i);
        return acc;
    }, []);
    if (empties.length === 0)
        return { type: "move", cell: -1 };
    const wins = (m) => empties.find((i) => {
        const trial = [...state.cells];
        trial[i] = m;
        return findWinningLine(trial)?.mark === m;
    });
    const winning = wins(mark);
    if (winning !== undefined)
        return { type: "move", cell: winning };
    const blocking = wins(oppMark);
    if (blocking !== undefined)
        return { type: "move", cell: blocking };
    if (empties.includes(4))
        return { type: "move", cell: 4 };
    const corner = [0, 2, 6, 8].find((i) => empties.includes(i));
    if (corner !== undefined)
        return { type: "move", cell: corner };
    return { type: "move", cell: empties[0] };
}
// ── the engine object ───────────────────────────────────────────────────────
export const ticTacToeEngine = {
    gameType: "tic-tac-toe",
    schemaVersion: 1,
    label: "Tic-Tac-Toe",
    minPlayers: TIC_TAC_TOE_MIN_PLAYERS,
    maxPlayers: TIC_TAC_TOE_MAX_PLAYERS,
    hiddenInformation: false,
    defaultConfig() {
        return { ...DEFAULT_TIC_TAC_TOE_CONFIG };
    },
    normalizeConfig(config) {
        const direct = ticTacToeConfigSchema.safeParse(config);
        if (direct.success)
            return direct.data;
        const merged = {
            ...DEFAULT_TIC_TAC_TOE_CONFIG,
            ...(config && typeof config === "object" ? config : {}),
        };
        const reparsed = ticTacToeConfigSchema.safeParse(merged);
        return reparsed.success ? reparsed.data : { ...DEFAULT_TIC_TAC_TOE_CONFIG };
    },
    setup(config, seats, seed) {
        const humanSeat = seats.find((s) => s.kind === "human") ?? seats[0];
        const otherSeat = seats.find((s) => s.seatId !== humanSeat.seatId) ?? seats[seats.length - 1];
        const humanIsX = config.humanMark === "X" ? true : config.humanMark === "O" ? false : Math.abs(seed) % 2 === 0;
        const xSeat = humanIsX ? humanSeat : otherSeat;
        const oSeat = humanIsX ? otherSeat : humanSeat;
        const seatNames = {};
        for (const s of seats)
            seatNames[s.seatId] = s.displayName;
        const state = {
            config,
            cells: Array(9).fill(null),
            xSeatId: xSeat.seatId,
            oSeatId: oSeat.seatId,
            seatNames,
            seats: seats.map((s) => ({ seatId: s.seatId, displayName: s.displayName, kind: s.kind })),
            status: "active",
            winnerSeatId: null,
            winningLine: null,
            drawReason: null,
            seed,
            lastMove: null,
            lastAction: null,
            log: [],
        };
        record(state, {
            type: "game_started",
            message: `${xSeat.displayName} plays X, ${oSeat.displayName} plays O. ${xSeat.displayName} moves first.`,
        });
        return state;
    },
    currentSeat(state) {
        return state.status === "finished" ? null : seatForMark(state, markToMove(state));
    },
    interruptibleSeats() {
        return [];
    },
    legalMoves(state, seatId) {
        return enumerateLegalMoves(state, seatId);
    },
    applyMove(state, seatId, move) {
        if (state.status === "finished") {
            return { ok: false, error: "The game is already over.", legalMoves: [] };
        }
        const mark = markToMove(state);
        if (seatForMark(state, mark) !== seatId) {
            return { ok: false, error: "It's not your turn.", legalMoves: [] };
        }
        const legal = enumerateLegalMoves(state, seatId);
        if (!move || move.type !== "move" || !legal.some((m) => m.cell === move.cell)) {
            return {
                ok: false,
                error: `Illegal move "${move?.cell ?? "(none)"}". Choose an empty cell.`,
                legalMoves: legal,
            };
        }
        const s = clone(state);
        const events = [];
        s.cells[move.cell] = mark;
        s.lastMove = { cell: move.cell, mark, seatId };
        setLast(s, seatId, `places ${mark} on cell ${move.cell}`);
        events.push({
            type: "move_played",
            seatId,
            message: `${nameOf(s, seatId)} places ${mark} on cell ${move.cell}.`,
            data: { cell: move.cell, mark },
        });
        const win = findWinningLine(s.cells);
        if (win) {
            s.status = "finished";
            s.winnerSeatId = seatId;
            s.winningLine = win.line;
            const opponentSeatId = seatId === s.xSeatId ? s.oSeatId : s.xSeatId;
            events.push({
                type: "game_won",
                seatId,
                message: `${nameOf(s, seatId)} gets three in a row and wins!`,
            });
            events.push({ type: "game_over", seatId, message: `${nameOf(s, seatId)} defeats ${nameOf(s, opponentSeatId)}.` });
        }
        else if (s.cells.every((c) => c !== null)) {
            s.status = "finished";
            s.drawReason = "board_full";
            events.push({ type: "draw", message: "The board is full — it's a draw." });
            events.push({ type: "game_over", message: "The tic-tac-toe game ends in a draw." });
        }
        for (const e of events)
            record(s, e);
        return { ok: true, state: s, events };
    },
    isTerminal(state) {
        return state.status === "finished"
            ? { done: true, ...(state.winnerSeatId ? { winnerSeatId: state.winnerSeatId } : {}) }
            : { done: false };
    },
    describeForModel(state, seatId) {
        const legal = enumerateLegalMoves(state, seatId);
        return {
            boardSummary: buildBoardSummary(state, seatId),
            legalMoves: legal,
            instructions: buildInstructions(legal.map((m) => m.cell)),
        };
    },
    spectatorSummary(state) {
        return buildSpectatorSummary(state);
    },
    participantSummary(state, seatId) {
        return buildParticipantSummary(state, seatId);
    },
    publicView(state, viewerSeatId) {
        const currentSeatId = state.status === "finished" ? null : seatForMark(state, markToMove(state));
        const seats = state.seats.map((s) => ({
            seatId: s.seatId,
            displayName: s.displayName,
            mark: markOfSeat(state, s.seatId) ?? "X",
            kind: s.kind,
            isCurrent: currentSeatId === s.seatId,
        }));
        const legalMovesForYou = viewerSeatId && viewerSeatId === currentSeatId
            ? enumerateLegalMoves(state, viewerSeatId).map((m) => m.cell)
            : [];
        return {
            gameType: "tic-tac-toe",
            status: state.status,
            cells: [...state.cells],
            seats,
            currentSeatId,
            winnerSeatId: state.winnerSeatId,
            winningLine: state.winningLine,
            drawReason: state.drawReason,
            yourSeatId: viewerSeatId,
            yourMark: viewerSeatId ? markOfSeat(state, viewerSeatId) : null,
            lastMove: state.lastMove,
            legalMovesForYou,
            lastAction: state.lastAction,
            config: state.config,
            recentLog: state.log.slice(-8),
        };
    },
    pickFallbackMove(state) {
        return pickFallback(state);
    },
    toolManifests() {
        return [...TIC_TAC_TOE_TOOL_MANIFESTS];
    },
    parseToolCall(name, args) {
        if (name !== "tic_tac_toe_move")
            return null;
        const raw = args.cell;
        const cell = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
        // Best-effort: an invalid call still returns a move that applyMove will
        // reject, so the runner's deterministic fallback kicks in (per the contract).
        return { type: "move", cell: Number.isFinite(cell) ? cell : -1 };
    },
};
//# sourceMappingURL=engine.js.map