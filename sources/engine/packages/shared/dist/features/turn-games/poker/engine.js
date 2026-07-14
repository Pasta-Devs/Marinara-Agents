// ──────────────────────────────────────────────
// Poker (No-Limit Texas Hold'em) — deterministic engine (server-authoritative)
// ──────────────────────────────────────────────
// Pure functions over PokerState. The single source of truth for legality,
// betting-round closure, and win conditions. The LLM only proposes moves
// (validated here) and narrates the engine-confirmed outcome; it never deals
// cards or adjudicates showdowns. All randomness flows through the seeded RNG
// (rng.ts) so every hand's deck — `deterministicShuffle(buildDeck(), seed,
// handNumber)` — is reproducible without ever persisting the deck itself.
//
// ROUND-CLOSURE INVARIANT (read this before touching betting logic):
// `state.actedSeatIds` holds every seat that has acted (check/call/bet/raise/
// fold/all-in) since the last FULL bet/raise this street. It is cleared and
// reseeded with just the aggressor on every FULL bet/raise, but deliberately
// NOT cleared by an incomplete (short all-in) raise. A betting round is
// closed once every seat still in the hand and not all-in is BOTH in this set
// AND has `currentBets[seat] === betToMatch`. This single rule gives the big
// blind its preflop option for free (nobody — not even the BB — starts in the
// set) and is exactly what stops an incomplete raise from reopening full
// raising rights for seats that already acted this cycle (see `handleRaise`).
import { buildDeck, cardCode, cardLabel, cardShort } from "./deck.js";
import { compareHands, evaluateBest, handLabel } from "./hand-eval.js";
import { deterministicShuffle } from "./rng.js";
import { parsePokerToolCall, POKER_TOOL_MANIFESTS } from "./tools.js";
import { clampPokerConfig, DEFAULT_POKER_CONFIG, pokerConfigSchema, POKER_LOG_CAP, POKER_MAX_PLAYERS, POKER_MIN_PLAYERS, } from "./types.js";
// ── small helpers ───────────────────────────────────────────────────────────
function clone(state) {
    return JSON.parse(JSON.stringify(state));
}
function nameOf(state, seatId) {
    return state.seatNames[seatId] ?? seatId;
}
function fail(error, legalMoves = []) {
    return { ok: false, error, legalMoves };
}
/** Append `event` to both the returned move-events list and the capped board log. */
function record(state, events, event) {
    events.push(event);
    state.log.push(event);
    if (state.log.length > POKER_LOG_CAP)
        state.log.splice(0, state.log.length - POKER_LOG_CAP);
}
/** Like `record`, but also queues the event for the dealer to narrate. Used ONLY for the
 * five milestone categories: hand start, street deals, showdown/hand end, blinds up, game over. */
function announce(state, events, event) {
    record(state, events, event);
    state.pendingAnnouncements.push(event);
}
function setLast(state, seatId, summary) {
    state.lastAction = { seatId, summary };
}
// ── deck / dealing ──────────────────────────────────────────────────────────
/** This hand's full shuffled deck. Cheap to recompute; deliberately never persisted (see file header). */
function handDeck(state) {
    return deterministicShuffle(buildDeck(), state.seed, state.handNumber);
}
function drawCards(state, n) {
    const deck = handDeck(state);
    const out = deck.slice(state.deckCursor, state.deckCursor + n);
    state.deckCursor += n;
    return out;
}
// ── seat / hand-membership helpers ──────────────────────────────────────────
function isBusted(state, seatId) {
    return state.bustedSeatIds.includes(seatId);
}
function isFolded(state, seatId) {
    return state.foldedSeatIds.includes(seatId);
}
function isAllIn(state, seatId) {
    return state.allInSeatIds.includes(seatId);
}
function stackOf(state, seatId) {
    return state.stacks[seatId] ?? 0;
}
function currentBet(state, seatId) {
    return state.currentBets[seatId] ?? 0;
}
function committed(state, seatId) {
    return state.committedTotal[seatId] ?? 0;
}
/** Seats dealt into the CURRENT hand (not busted before it started). */
function handSeats(state) {
    return state.seatOrder.filter((s) => !isBusted(state, s));
}
/** Seats dealt into this hand who haven't folded (includes all-in seats). */
function contenders(state) {
    return handSeats(state).filter((s) => !isFolded(state, s));
}
/** Contenders who can still voluntarily act (not all-in). */
function activeActors(state) {
    return contenders(state).filter((s) => !isAllIn(state, s));
}
/** Count of active actors OTHER than `seatId` — 0 means nobody left could ever call a bet/raise from them. */
function othersActive(state, seatId) {
    return activeActors(state).filter((s) => s !== seatId).length;
}
/** Next seat after `fromSeatId` in table order, cyclically, skipping busted seats. */
function nextHandSeat(state, fromSeatId) {
    const order = state.seatOrder;
    const n = order.length;
    const startIdx = order.indexOf(fromSeatId);
    for (let step = 1; step <= n; step++) {
        const candidate = order[(startIdx + step) % n];
        if (!isBusted(state, candidate))
            return candidate;
    }
    return fromSeatId; // unreachable while >= 2 seats remain unbusted
}
/** Next seat, strictly after `fromSeatId`, eligible to act right now (not folded/all-in/busted). */
function nextToAct(state, fromSeatId) {
    const order = state.seatOrder;
    const n = order.length;
    const startIdx = order.indexOf(fromSeatId);
    for (let step = 1; step <= n; step++) {
        const candidate = order[(startIdx + step) % n];
        if (isBusted(state, candidate) || isFolded(state, candidate) || isAllIn(state, candidate))
            continue;
        return candidate;
    }
    return null;
}
/** First seat, walking forward from (and including) `fromSeatId`, eligible to act right now. */
function firstEligibleFrom(state, fromSeatId) {
    const order = state.seatOrder;
    const n = order.length;
    const startIdx = order.indexOf(fromSeatId);
    for (let step = 0; step < n; step++) {
        const candidate = order[(startIdx + step) % n];
        if (isBusted(state, candidate) || isFolded(state, candidate) || isAllIn(state, candidate))
            continue;
        return candidate;
    }
    return null;
}
function smallBlindSeatId(state) {
    // Heads-up: the button posts the small blind and acts first preflop.
    return handSeats(state).length === 2 ? state.buttonSeatId : nextHandSeat(state, state.buttonSeatId);
}
function bigBlindSeatId(state) {
    return handSeats(state).length === 2 ? nextHandSeat(state, state.buttonSeatId) : nextHandSeat(state, smallBlindSeatId(state));
}
function potTotal(state) {
    let sum = 0;
    for (const s of state.seatOrder)
        sum += committed(state, s);
    return sum;
}
function orderClosestLeftOfButton(state, seatIds) {
    const order = state.seatOrder;
    const n = order.length;
    const buttonIdx = order.indexOf(state.buttonSeatId);
    return [...seatIds].sort((a, b) => {
        const da = (order.indexOf(a) - buttonIdx + n) % n;
        const db = (order.indexOf(b) - buttonIdx + n) % n;
        return da - db;
    });
}
// ── chip movement ────────────────────────────────────────────────────────────
/** Move up to `n` chips (capped by the seat's stack) from stack into the pot for the current street. */
function commitChips(state, seatId, n) {
    const amt = Math.max(0, Math.min(n, stackOf(state, seatId)));
    state.stacks[seatId] = stackOf(state, seatId) - amt;
    state.currentBets[seatId] = currentBet(state, seatId) + amt;
    state.committedTotal[seatId] = committed(state, seatId) + amt;
    if (state.stacks[seatId] === 0 && !isAllIn(state, seatId))
        state.allInSeatIds.push(seatId);
}
function markActed(state, seatId) {
    if (!state.actedSeatIds.includes(seatId))
        state.actedSeatIds.push(seatId);
}
/** FULL bet/raise: everyone must act again — reset the set to just the aggressor. */
function clearActedExcept(state, seatId) {
    state.actedSeatIds = [seatId];
}
// ── betting-round closure ───────────────────────────────────────────────────
function roundClosed(state) {
    if (contenders(state).length <= 1)
        return true;
    const actors = activeActors(state);
    if (actors.length === 0)
        return true;
    return actors.every((s) => state.actedSeatIds.includes(s) && currentBet(state, s) === state.betToMatch);
}
// ── move handlers (operate on the already-cloned state `state`) ──────────────
function handleFold(state, seatId, events) {
    state.foldedSeatIds.push(seatId);
    markActed(state, seatId);
    record(state, events, { type: "fold", seatId, message: `${nameOf(state, seatId)} folds.` });
    setLast(state, seatId, "folds");
    return closeOrContinue(state, events);
}
function handleCheck(state, seatId, events) {
    if (currentBet(state, seatId) !== state.betToMatch) {
        return fail("You can't check — there's a bet to call.");
    }
    markActed(state, seatId);
    record(state, events, { type: "check", seatId, message: `${nameOf(state, seatId)} checks.` });
    setLast(state, seatId, "checks");
    return closeOrContinue(state, events);
}
function handleCall(state, seatId, events) {
    const toCall = state.betToMatch - currentBet(state, seatId);
    if (toCall <= 0)
        return handleCheck(state, seatId, events); // leniency: nothing to call -> check
    const amt = Math.min(toCall, stackOf(state, seatId));
    commitChips(state, seatId, amt);
    markActed(state, seatId);
    const note = stackOf(state, seatId) === 0 ? " (all in)" : "";
    record(state, events, { type: "call", seatId, message: `${nameOf(state, seatId)} calls ${amt}${note}.` });
    setLast(state, seatId, `calls ${amt}`);
    return closeOrContinue(state, events);
}
function handleBet(state, seatId, rawAmount, events) {
    if (state.betToMatch > 0)
        return handleRaise(state, seatId, rawAmount, events); // leniency: bet w/ a bet outstanding -> raise toAmount=amount
    const stack = stackOf(state, seatId);
    if (stack <= 0)
        return fail("You have no chips left to bet.");
    const min = Math.min(state.blinds.bigBlind, stack);
    const max = stack;
    const requested = Number.isFinite(rawAmount) ? Math.floor(rawAmount) : min;
    const clamped = Math.min(max, Math.max(min, requested));
    commitChips(state, seatId, clamped);
    state.betToMatch = clamped;
    // A short all-in bet below the big blind still opens the street (nothing existed to call
    // before it) but doesn't shrink the increment future raises must meet.
    if (clamped >= state.blinds.bigBlind)
        state.lastRaiseSize = clamped;
    clearActedExcept(state, seatId);
    const note = stackOf(state, seatId) === 0 ? " (all in)" : "";
    record(state, events, { type: "bet", seatId, message: `${nameOf(state, seatId)} bets ${clamped}${note}.` });
    setLast(state, seatId, `bets ${clamped}`);
    return closeOrContinue(state, events);
}
function handleRaise(state, seatId, rawToAmount, events) {
    if (state.betToMatch === 0)
        return handleBet(state, seatId, rawToAmount, events); // leniency: raise w/ nothing outstanding -> bet
    const stack = stackOf(state, seatId);
    if (stack <= 0)
        return fail("You have no chips left to raise.");
    const already = currentBet(state, seatId);
    const cap = already + stack; // max achievable street-total for this seat
    if (cap <= state.betToMatch)
        return handleCall(state, seatId, events); // can't even exceed betToMatch -> call
    if (state.actedSeatIds.includes(seatId)) {
        // Already acted since the last FULL raise: an incomplete raise doesn't reopen full
        // raising rights (see file header). This seat may only call or fold right now — any
        // raise attempt (including one arriving via all_in, whose stack would otherwise exceed
        // betToMatch) is downgraded to a call rather than rejected, consistent with the engine's
        // other leniency mappings (and required so `all_in` — always legal per legalMovesFor
        // whenever stack > 0 — can never be rejected here).
        return handleCall(state, seatId, events);
    }
    if (othersActive(state, seatId) === 0) {
        // Nobody left who could respond to a bigger number — raising further would only ever
        // create an uncalled excess, so treat it as a call instead (deliberate simplification;
        // see the engine's return-value notes).
        return handleCall(state, seatId, events);
    }
    const oldBetToMatch = state.betToMatch;
    const minTo = oldBetToMatch + state.lastRaiseSize;
    const requested = Number.isFinite(rawToAmount) ? Math.floor(rawToAmount) : minTo;
    const clampedTo = Math.min(cap, Math.max(minTo, requested));
    const isFullRaise = clampedTo >= minTo;
    commitChips(state, seatId, clampedTo - already);
    state.betToMatch = clampedTo;
    if (isFullRaise) {
        state.lastRaiseSize = clampedTo - oldBetToMatch;
        clearActedExcept(state, seatId);
    }
    else {
        // Incomplete (short all-in) raise: betToMatch still rises so others must respond, but
        // lastRaiseSize (and everyone else's already-acted status) is left untouched — see file header.
        markActed(state, seatId);
    }
    const note = stackOf(state, seatId) === 0 ? " (all in)" : "";
    record(state, events, { type: "raise", seatId, message: `${nameOf(state, seatId)} raises to ${clampedTo}${note}.` });
    setLast(state, seatId, `raises to ${clampedTo}`);
    return closeOrContinue(state, events);
}
function handleAllIn(state, seatId, events) {
    const stack = stackOf(state, seatId);
    if (stack <= 0)
        return fail("You have no chips left.");
    const total = currentBet(state, seatId) + stack;
    if (state.betToMatch === 0)
        return handleBet(state, seatId, stack, events);
    if (total <= state.betToMatch)
        return handleCall(state, seatId, events);
    return handleRaise(state, seatId, total, events);
}
function closeOrContinue(state, events) {
    if (contenders(state).length <= 1) {
        finishHandByFold(state, events);
        return { ok: true, state, events };
    }
    if (!roundClosed(state)) {
        const from = state.currentSeatId;
        state.currentSeatId = nextToAct(state, from) ?? from;
        return { ok: true, state, events };
    }
    advanceStreetOrShowdown(state, events);
    return { ok: true, state, events };
}
// ── street / hand progression ───────────────────────────────────────────────
function nextStreetOf(street) {
    return street === "preflop" ? "flop" : street === "flop" ? "turn" : "river";
}
/** Deals `street`'s community cards (if any) and resets the street's betting fields.
 * No burn cards — the deck is already a single seeded shuffle, so "burning" would just
 * be discarding a known card for no security purpose; keeping it simple is deliberate. */
function dealBoardCardsFor(state, street, events) {
    const n = street === "flop" ? 3 : street === "turn" || street === "river" ? 1 : 0;
    if (n > 0)
        state.community.push(...drawCards(state, n));
    state.street = street;
    state.currentBets = {};
    state.betToMatch = 0;
    state.lastRaiseSize = state.blinds.bigBlind;
    state.actedSeatIds = [];
    const label = street.charAt(0).toUpperCase() + street.slice(1);
    announce(state, events, {
        type: "street_dealt",
        message: `${label}: ${state.community.map(cardShort).join(" ")} — pot ${potTotal(state)}.`,
        data: { street, community: state.community.map(cardCode), pot: potTotal(state) },
    });
}
function firstToActPreflop(state) {
    // Heads-up: button/SB acts first preflop. 3+: first seat left of the big blind (UTG).
    return handSeats(state).length === 2 ? state.buttonSeatId : nextHandSeat(state, bigBlindSeatId(state));
}
function firstToActPostflop(state) {
    // Heads-up: the non-button seat (BB) acts first on every street after preflop.
    // 3+: the first seat left of the button. Both are exactly "the next hand-seat after the button".
    return nextHandSeat(state, state.buttonSeatId);
}
/** Entry point into a fresh betting round: hand-ends if the fold-out already happened,
 * fast-forwards to showdown if fewer than two seats could still voluntarily act, otherwise
 * hands the turn to the first eligible actor. Shared by preflop start and every street advance. */
function settleActionOrFastForward(state, events, intendedFirstActor) {
    if (contenders(state).length <= 1) {
        finishHandByFold(state, events);
        return;
    }
    if (activeActors(state).length < 2) {
        fastForwardToShowdown(state, events);
        return;
    }
    state.currentSeatId = firstEligibleFrom(state, intendedFirstActor);
    state.status = "active";
}
function fastForwardToShowdown(state, events) {
    while (state.street !== "river")
        dealBoardCardsFor(state, nextStreetOf(state.street), events);
    state.currentSeatId = null;
    resolveShowdown(state, events);
}
function advanceStreetOrShowdown(state, events) {
    if (state.street === "river") {
        resolveShowdown(state, events);
        return;
    }
    dealBoardCardsFor(state, nextStreetOf(state.street), events);
    settleActionOrFastForward(state, events, firstToActPostflop(state));
}
function startPreflop(state, events) {
    const sbSeatId = smallBlindSeatId(state);
    const bbSeatId = bigBlindSeatId(state);
    const sbAmt = Math.min(state.blinds.smallBlind, stackOf(state, sbSeatId));
    const bbAmt = Math.min(state.blinds.bigBlind, stackOf(state, bbSeatId));
    commitChips(state, sbSeatId, sbAmt);
    commitChips(state, bbSeatId, bbAmt);
    state.betToMatch = bbAmt;
    state.lastRaiseSize = state.blinds.bigBlind;
    state.actedSeatIds = [];
    announce(state, events, {
        type: "hand_start",
        message: `Hand #${state.handNumber} — blinds ${state.blinds.smallBlind}/${state.blinds.bigBlind}. ` +
            `${nameOf(state, sbSeatId)} posts small blind${sbAmt < state.blinds.smallBlind ? ` (${sbAmt}, all in)` : ""}, ` +
            `${nameOf(state, bbSeatId)} posts big blind${bbAmt < state.blinds.bigBlind ? ` (${bbAmt}, all in)` : ""}.`,
        data: { handNumber: state.handNumber, sbSeatId, bbSeatId, smallBlind: state.blinds.smallBlind, bigBlind: state.blinds.bigBlind },
    });
    settleActionOrFastForward(state, events, firstToActPreflop(state));
}
/** Deal order starts left of the button (small blind position) and wraps through dealt-in seats. */
function dealOrder(state, seats) {
    const n = state.seatOrder.length;
    const startIdx = state.seatOrder.indexOf(nextHandSeat(state, state.buttonSeatId));
    const rotated = [];
    for (let i = 0; i < n; i++) {
        const seatId = state.seatOrder[(startIdx + i) % n];
        if (seats.includes(seatId))
            rotated.push(seatId);
    }
    return rotated;
}
function dealHoleCards(state) {
    const seats = handSeats(state);
    const order = dealOrder(state, seats);
    for (const s of seats)
        state.holeCards[s] = [];
    for (let round = 0; round < 2; round++) {
        for (const seatId of order) {
            const [card] = drawCards(state, 1);
            if (card)
                state.holeCards[seatId].push(card);
        }
    }
}
function dealNewHand(state, events) {
    if (state.config.blindIncreaseEveryHands > 0 &&
        state.handsCompleted > 0 &&
        state.handsCompleted % state.config.blindIncreaseEveryHands === 0) {
        state.blinds = { smallBlind: state.blinds.smallBlind * 2, bigBlind: state.blinds.bigBlind * 2 };
        announce(state, events, {
            type: "blinds_up",
            message: `Blinds up — now ${state.blinds.smallBlind}/${state.blinds.bigBlind}!`,
            data: { smallBlind: state.blinds.smallBlind, bigBlind: state.blinds.bigBlind },
        });
    }
    state.handNumber += 1;
    state.buttonSeatId = nextHandSeat(state, state.buttonSeatId);
    state.holeCards = {};
    state.community = [];
    state.street = "preflop";
    state.deckCursor = 0;
    state.currentBets = {};
    state.committedTotal = {};
    state.foldedSeatIds = [];
    state.allInSeatIds = [];
    state.actedSeatIds = [];
    state.betToMatch = 0;
    state.lastRaiseSize = state.blinds.bigBlind;
    state.winnerSeatId = null;
    // handResults is intentionally left as the PREVIOUS hand's outcome (for the recap) until
    // this new hand concludes and overwrites it via resolveShowdown / finishHandByFold.
    dealHoleCards(state);
    startPreflop(state, events);
}
// ── showdown / hand end ─────────────────────────────────────────────────────
/**
 * Layer `committedTotal` into main + side pots. Folded seats' chips count toward pot
 * amounts (dead money) but folded seats are never eligible to win. Layers whose
 * ELIGIBLE set is identical are coalesced into one pot: a folder's dead money sitting
 * below the callers' totals must not manufacture a "side pot" — real side pots exist
 * only where an all-in actually splits who can win what. Pure — exported for direct
 * unit testing against hand-crafted commitment maps.
 */
export function buildPots(committedTotal, contenders) {
    const seatIds = Object.keys(committedTotal).filter((id) => (committedTotal[id] ?? 0) > 0);
    if (seatIds.length === 0)
        return [];
    const levels = [...new Set(seatIds.map((id) => committedTotal[id]))].sort((a, b) => a - b);
    const pots = [];
    let floor = 0;
    for (const level of levels) {
        const layerHeight = level - floor;
        floor = level;
        if (layerHeight <= 0)
            continue;
        const contributors = seatIds.filter((id) => (committedTotal[id] ?? 0) >= level);
        const amount = layerHeight * contributors.length;
        if (amount <= 0)
            continue;
        const eligibleSeatIds = contributors.filter((id) => contenders.includes(id));
        // Eligible sets shrink (weakly) monotonically as the level rises, so layers with
        // an identical eligible set are always adjacent — merging here is exhaustive.
        const prev = pots[pots.length - 1];
        if (prev && prev.eligibleSeatIds.length === eligibleSeatIds.length && prev.eligibleSeatIds.every((id, i) => id === eligibleSeatIds[i])) {
            prev.amount += amount;
        }
        else {
            pots.push({ amount, eligibleSeatIds });
        }
    }
    return pots;
}
function resolveShowdown(state, events) {
    const eligible = contenders(state);
    const pots = buildPots(state.committedTotal, eligible);
    const ranked = eligible.map((seatId) => {
        const hole = state.holeCards[seatId] ?? [];
        const { rank, bestFive } = evaluateBest([...hole, ...state.community]);
        return { seatId, hole, rank, bestFive };
    });
    const rankBySeat = new Map(ranked.map((r) => [r.seatId, r.rank]));
    const potAwards = [];
    pots.forEach((pot, i) => {
        const label = i === 0 ? "main pot" : `side pot ${i}`;
        // Defensive fallback: a real hand can never produce an empty-eligible layer (any live
        // contender's final commitment is always >= any folded seat's, since folding only ever
        // happens below the eventual live betToMatch) — see buildPots's doc. Falling back to
        // every contender keeps chip conservation intact even if that proof is ever wrong.
        const eligibleSeatIds = pot.eligibleSeatIds.length ? pot.eligibleSeatIds : eligible;
        let bestRank = null;
        for (const seatId of eligibleSeatIds) {
            const r = rankBySeat.get(seatId);
            if (r && (!bestRank || compareHands(r, bestRank) > 0))
                bestRank = r;
        }
        const winners = eligibleSeatIds.filter((seatId) => {
            const r = rankBySeat.get(seatId);
            return !!r && !!bestRank && compareHands(r, bestRank) === 0;
        });
        const ordered = orderClosestLeftOfButton(state, winners);
        const share = Math.floor(pot.amount / ordered.length);
        let remainder = pot.amount - share * ordered.length;
        for (const seatId of ordered) {
            const amount = share + (remainder > 0 ? 1 : 0);
            if (remainder > 0)
                remainder -= 1;
            if (amount <= 0)
                continue;
            potAwards.push({ seatId, amount, label });
            state.stacks[seatId] = stackOf(state, seatId) + amount;
        }
    });
    const reveals = ranked.map((r) => ({
        seatId: r.seatId,
        holeCards: r.hole,
        label: handLabel(r.rank),
        bestFiveCodes: r.bestFive.map(cardCode),
    }));
    state.handResults = { potAwards, reveals };
    announce(state, events, {
        type: "showdown",
        message: `Showdown — ${reveals.map((r) => `${nameOf(state, r.seatId)}: ${r.label}`).join(", ")}. ` +
            `${potAwards.map((a) => `${nameOf(state, a.seatId)} wins ${a.amount} (${a.label})`).join("; ")}.`,
        data: { potAwards, reveals },
    });
    finishHandCommon(state, events);
}
function finishHandByFold(state, events) {
    const winnerSeatId = contenders(state)[0] ?? null;
    if (winnerSeatId) {
        const amount = potTotal(state);
        state.stacks[winnerSeatId] = stackOf(state, winnerSeatId) + amount;
        const potAwards = amount > 0 ? [{ seatId: winnerSeatId, amount, label: "main pot" }] : [];
        state.handResults = { potAwards, reveals: [] };
        announce(state, events, {
            type: "showdown",
            message: `${nameOf(state, winnerSeatId)} wins the pot (${amount}) — everyone else folded.`,
            data: { potAwards, reveals: [] },
        });
    }
    else {
        state.handResults = { potAwards: [], reveals: [] };
    }
    finishHandCommon(state, events);
}
function finishHandCommon(state, events) {
    state.currentSeatId = null;
    state.handsCompleted += 1;
    // The pot has been fully paid out into stacks (buildPots/finishHandByFold already
    // consumed the ledger) — clear it so no view can double-count chips during
    // hand_over/finished: potTotal() must read 0 once the hand is settled.
    state.currentBets = {};
    state.committedTotal = {};
    state.betToMatch = 0;
    for (const seatId of handSeats(state)) {
        if (stackOf(state, seatId) <= 0 && !isBusted(state, seatId))
            state.bustedSeatIds.push(seatId);
    }
    const remainingSeats = state.seatOrder.filter((s) => !isBusted(state, s));
    const humanSeat = state.seats.find((s) => s.kind === "human")?.seatId ?? state.seatOrder[0];
    const chipLeader = () => {
        let best = state.seatOrder[0];
        for (const s of state.seatOrder)
            if (stackOf(state, s) > stackOf(state, best))
                best = s;
        return best;
    };
    let winnerSeatId = null;
    let sessionOver = false;
    if (remainingSeats.length <= 1) {
        sessionOver = true;
        winnerSeatId = remainingSeats[0] ?? chipLeader();
    }
    else if (isBusted(state, humanSeat)) {
        // The human busting ends the session — bots don't keep playing on alone.
        sessionOver = true;
        winnerSeatId = chipLeader();
    }
    else if (state.config.handLimit > 0 && state.handsCompleted >= state.config.handLimit) {
        sessionOver = true;
        winnerSeatId = chipLeader();
    }
    if (sessionOver) {
        state.status = "finished";
        state.winnerSeatId = winnerSeatId;
        announce(state, events, {
            type: "game_over",
            ...(winnerSeatId ? { seatId: winnerSeatId } : {}),
            message: winnerSeatId ? `${nameOf(state, winnerSeatId)} wins the session!` : "The session has ended.",
        });
        return;
    }
    state.status = "hand_over";
    // The human paces the session between hands — their only legal move is next_hand.
    state.currentSeatId = humanSeat;
}
// ── legal-move enumeration ────────────────────────────────────────────────────
function legalMovesFor(state, seatId) {
    if (state.status === "hand_over") {
        return state.currentSeatId === seatId ? [{ type: "next_hand" }] : [];
    }
    if (state.status !== "active" || state.currentSeatId !== seatId)
        return [];
    if (isFolded(state, seatId) || isAllIn(state, seatId) || isBusted(state, seatId))
        return [];
    const moves = [{ type: "fold" }];
    const toCall = state.betToMatch - currentBet(state, seatId);
    moves.push(toCall <= 0 ? { type: "check" } : { type: "call" });
    const stack = stackOf(state, seatId);
    const already = currentBet(state, seatId);
    const cap = already + stack;
    const responders = othersActive(state, seatId);
    if (stack > 0 && responders > 0) {
        if (state.betToMatch === 0) {
            moves.push({ type: "bet", amount: Math.min(state.blinds.bigBlind, stack) });
        }
        else if (cap > state.betToMatch && !state.actedSeatIds.includes(seatId)) {
            moves.push({ type: "raise", toAmount: Math.min(cap, state.betToMatch + state.lastRaiseSize) });
        }
    }
    if (stack > 0)
        moves.push({ type: "all_in" });
    return moves;
}
// ── prompt + view builders ────────────────────────────────────────────────────
function communitySummary(state) {
    return state.community.length ? state.community.map(cardShort).join(" ") : "(no community cards yet)";
}
function yourBestLabel(state, seatId) {
    if (state.community.length < 3)
        return null;
    const hole = state.holeCards[seatId];
    if (!hole || hole.length < 2)
        return null;
    return handLabel(evaluateBest([...hole, ...state.community]).rank);
}
function recentActionLines(state, max) {
    return state.log
        .filter((e) => typeof e.message === "string" && e.message.trim().length > 0)
        .slice(-max)
        .map((e) => `  • ${e.message}`);
}
function buildBoardSummary(state, seatId) {
    const lines = [];
    lines.push(`Texas Hold'em — Hand #${state.handNumber}, ${state.street}. Community: ${communitySummary(state)}. ` +
        `Pot: ${potTotal(state)}. Blinds ${state.blinds.smallBlind}/${state.blinds.bigBlind}.`);
    lines.push(`Your stack: ${stackOf(state, seatId)}.`);
    const hole = state.holeCards[seatId] ?? [];
    if (hole.length)
        lines.push(`Your hole cards: ${hole.map(cardShort).join(" ")} (${hole.map(cardLabel).join(", ")}).`);
    const best = yourBestLabel(state, seatId);
    if (best)
        lines.push(`Your best right now: ${best}.`);
    const toCall = state.betToMatch - currentBet(state, seatId);
    lines.push(toCall > 0
        ? `${toCall} to call (you've put in ${currentBet(state, seatId)} this street, ${state.betToMatch} to match).`
        : `Nothing to call — you may check.`);
    lines.push("Table:");
    for (const s of state.seatOrder) {
        if (s === seatId || isBusted(state, s))
            continue;
        const flags = [];
        if (isFolded(state, s))
            flags.push("folded");
        if (isAllIn(state, s))
            flags.push("all in");
        if (s === state.buttonSeatId)
            flags.push("button");
        lines.push(`  • ${nameOf(state, s)}: stack ${stackOf(state, s)}, street bet ${currentBet(state, s)}${flags.length ? ` (${flags.join(", ")})` : ""}`);
    }
    const recent = recentActionLines(state, 5);
    if (recent.length)
        lines.push("What just happened:", ...recent);
    return lines.join("\n");
}
function buildInstructions(state, seatId) {
    const actions = ["fold"];
    const toCall = state.betToMatch - currentBet(state, seatId);
    const stack = stackOf(state, seatId);
    const cap = currentBet(state, seatId) + stack;
    actions.push(toCall <= 0 ? "check" : `call ${Math.min(toCall, stack)}`);
    if (stack > 0 && othersActive(state, seatId) > 0) {
        if (state.betToMatch === 0) {
            actions.push(`bet: min ${Math.min(state.blinds.bigBlind, stack)} max ${stack} — amount = chips you put in`);
        }
        else if (cap > state.betToMatch && !state.actedSeatIds.includes(seatId)) {
            const minTo = Math.min(cap, state.betToMatch + state.lastRaiseSize);
            actions.push(`raise: min-to ${minTo}, max-to ${cap} (all-in) — toAmount = TOTAL you raise to`);
        }
    }
    if (stack > 0)
        actions.push("all_in");
    return (`Legal actions: ${actions.join(" | ")}. ` +
        "Choose like YOUR character, not like a solver: a bold or reckless character bluffs, pressures, and " +
        "over-bets; a cautious one folds marginal hands and only commits with strength; a cunning one slow-plays " +
        "monsters and springs traps; a proud one refuses to be pushed off a pot; grudges are real — re-raising " +
        "whoever just bullied you is excellent poker. Bluffing is allowed and encouraged when it fits your " +
        "personality. Pot odds matter, but personality decides. " +
        "Never invent cards. Call the tool with exactly one action.");
}
function buildSpectatorSummary(state) {
    if (state.status === "finished") {
        const standings = [...state.seatOrder]
            .sort((a, b) => stackOf(state, b) - stackOf(state, a))
            .map((s) => `${nameOf(state, s)} (${stackOf(state, s)} chips)`)
            .join(", ");
        const winner = state.winnerSeatId ? nameOf(state, state.winnerSeatId) : null;
        return [
            `The poker session just finished${winner ? ` — ${winner} came out on top` : ""}.`,
            `Final chip counts: ${standings}.`,
        ].join("\n");
    }
    const lines = [
        `A game of No-Limit Hold'em is in progress at the table — hand #${state.handNumber}, ${state.street}.`,
        `Community: ${communitySummary(state)}. Pot: ${potTotal(state)}. Blinds ${state.blinds.smallBlind}/${state.blinds.bigBlind}.`,
    ];
    const seatLines = state.seatOrder
        .filter((s) => !isBusted(state, s))
        .map((s) => {
        const flags = [];
        if (isFolded(state, s))
            flags.push("folded");
        if (isAllIn(state, s))
            flags.push("all in");
        return `${nameOf(state, s)}: ${stackOf(state, s)} chips${flags.length ? ` (${flags.join(", ")})` : ""}`;
    });
    lines.push(`Players: ${seatLines.join(", ")}.`);
    if (state.status === "hand_over")
        lines.push("The hand just ended — waiting for the next hand to start.");
    else if (state.currentSeatId)
        lines.push(`It's currently ${nameOf(state, state.currentSeatId)}'s turn to act.`);
    const recent = recentActionLines(state, 6);
    if (recent.length)
        lines.push("Recent action:", ...recent);
    return lines.join("\n");
}
function buildParticipantSummary(state, seatId) {
    const base = buildSpectatorSummary(state);
    if (!state.seatOrder.includes(seatId))
        return base;
    const lines = [base, `You are ${nameOf(state, seatId)} in this game.`];
    if (state.status !== "finished" && !isBusted(state, seatId)) {
        const hole = state.holeCards[seatId];
        if (hole?.length)
            lines.push(`Your hole cards (only you can see them): ${hole.map(cardShort).join(" ")}.`);
        const best = yourBestLabel(state, seatId);
        if (best)
            lines.push(`Your best hand right now: ${best}.`);
        if (state.currentSeatId === seatId) {
            if (state.status === "hand_over")
                lines.push("It's your turn to start the next hand.");
            else {
                const toCall = state.betToMatch - currentBet(state, seatId);
                lines.push(toCall > 0 ? `It's YOUR turn — ${toCall} to call.` : "It's YOUR turn — you may check.");
            }
        }
    }
    return lines.join("\n");
}
// ── the engine object ──────────────────────────────────────────────────────────
export const pokerEngine = {
    gameType: "poker",
    schemaVersion: 1,
    label: "Poker",
    minPlayers: POKER_MIN_PLAYERS,
    maxPlayers: POKER_MAX_PLAYERS,
    hiddenInformation: true,
    defaultConfig() {
        return { ...DEFAULT_POKER_CONFIG };
    },
    normalizeConfig(config) {
        const direct = pokerConfigSchema.safeParse(config);
        const merged = direct.success
            ? direct.data
            : { ...DEFAULT_POKER_CONFIG, ...(config && typeof config === "object" ? config : {}) };
        return clampPokerConfig(merged);
    },
    setup(config, seatsIn, seed) {
        const seatOrder = seatsIn.map((s) => s.seatId);
        const seatNames = {};
        const stacks = {};
        for (const s of seatsIn) {
            seatNames[s.seatId] = s.displayName;
            stacks[s.seatId] = config.startingStack;
        }
        const state = {
            config,
            seed,
            seats: seatsIn.map((s) => ({ seatId: s.seatId, displayName: s.displayName, kind: s.kind })),
            seatOrder,
            seatNames,
            stacks,
            status: "active",
            handNumber: 1,
            buttonSeatId: seatOrder[0],
            blinds: { smallBlind: config.smallBlind, bigBlind: config.smallBlind * 2 },
            holeCards: {},
            community: [],
            street: "preflop",
            deckCursor: 0,
            currentBets: {},
            committedTotal: {},
            betToMatch: 0,
            lastRaiseSize: config.smallBlind * 2,
            currentSeatId: null,
            actedSeatIds: [],
            foldedSeatIds: [],
            allInSeatIds: [],
            bustedSeatIds: [],
            handsCompleted: 0,
            winnerSeatId: null,
            handResults: null,
            pendingAnnouncements: [],
            lastAction: null,
            log: [],
        };
        const events = [];
        dealHoleCards(state);
        startPreflop(state, events);
        return state;
    },
    currentSeat(state) {
        return state.status === "finished" ? null : state.currentSeatId;
    },
    interruptibleSeats() {
        return [];
    },
    legalMoves(state, seatId) {
        return legalMovesFor(state, seatId);
    },
    applyMove(state, seatId, move) {
        if (state.status === "finished")
            return fail("The game is already over.");
        if (move?.type === "next_hand") {
            if (state.status !== "hand_over" || state.currentSeatId !== seatId) {
                return { ok: false, error: "It's not time for the next hand yet.", legalMoves: legalMovesFor(state, seatId) };
            }
            const s = clone(state);
            const events = [];
            dealNewHand(s, events);
            return { ok: true, state: s, events };
        }
        if (state.status !== "active" || state.currentSeatId !== seatId) {
            return { ok: false, error: "It's not your turn.", legalMoves: legalMovesFor(state, seatId) };
        }
        if (isFolded(state, seatId) || isAllIn(state, seatId) || isBusted(state, seatId)) {
            return { ok: false, error: "You can't act right now.", legalMoves: [] };
        }
        const s = clone(state);
        const events = [];
        let result;
        switch (move?.type) {
            case "fold":
                result = handleFold(s, seatId, events);
                break;
            case "check":
                result = handleCheck(s, seatId, events);
                break;
            case "call":
                result = handleCall(s, seatId, events);
                break;
            case "bet":
                result = handleBet(s, seatId, move.amount, events);
                break;
            case "raise":
                result = handleRaise(s, seatId, move.toAmount, events);
                break;
            case "all_in":
                result = handleAllIn(s, seatId, events);
                break;
            default:
                result = fail("Unknown move.");
        }
        if (!result.ok) {
            return { ok: false, error: result.error, legalMoves: legalMovesFor(state, seatId) };
        }
        return result;
    },
    isTerminal(state) {
        return state.status === "finished"
            ? { done: true, ...(state.winnerSeatId ? { winnerSeatId: state.winnerSeatId } : {}) }
            : { done: false };
    },
    describeForModel(state, seatId) {
        return {
            boardSummary: buildBoardSummary(state, seatId),
            legalMoves: legalMovesFor(state, seatId),
            instructions: buildInstructions(state, seatId),
        };
    },
    spectatorSummary(state) {
        return buildSpectatorSummary(state);
    },
    participantSummary(state, seatId) {
        return buildParticipantSummary(state, seatId);
    },
    publicView(state, viewerSeatId) {
        const seats = state.seatOrder.map((s) => {
            const seat = state.seats.find((x) => x.seatId === s);
            return {
                seatId: s,
                displayName: nameOf(state, s),
                kind: seat.kind,
                stack: stackOf(state, s),
                streetBet: currentBet(state, s),
                committed: committed(state, s),
                folded: isFolded(state, s),
                allIn: isAllIn(state, s),
                busted: isBusted(state, s),
                isButton: s === state.buttonSeatId,
                isSmallBlind: s === smallBlindSeatId(state),
                isBigBlind: s === bigBlindSeatId(state),
                isCurrent: state.currentSeatId === s,
            };
        });
        let yourHoleCards = [];
        let yourHandLabel = null;
        const yourActions = {
            canFold: false,
            canCheck: false,
            canCall: false,
            callAmount: 0,
            canBet: false,
            minBet: 0,
            canRaise: false,
            minRaiseTo: 0,
            maxTo: 0,
            canAllIn: false,
            canNextHand: false,
        };
        if (viewerSeatId) {
            const hole = state.holeCards[viewerSeatId];
            if (hole) {
                yourHoleCards = hole.map((c) => ({ code: cardCode(c), short: cardShort(c), label: cardLabel(c) }));
                yourHandLabel = yourBestLabel(state, viewerSeatId);
            }
            if (state.status === "hand_over" && state.currentSeatId === viewerSeatId) {
                yourActions.canNextHand = true;
            }
            else {
                for (const m of legalMovesFor(state, viewerSeatId)) {
                    if (m.type === "fold")
                        yourActions.canFold = true;
                    else if (m.type === "check")
                        yourActions.canCheck = true;
                    else if (m.type === "call") {
                        yourActions.canCall = true;
                        yourActions.callAmount = Math.min(state.betToMatch - currentBet(state, viewerSeatId), stackOf(state, viewerSeatId));
                    }
                    else if (m.type === "bet") {
                        yourActions.canBet = true;
                        yourActions.minBet = m.amount;
                    }
                    else if (m.type === "raise") {
                        yourActions.canRaise = true;
                        yourActions.minRaiseTo = m.toAmount;
                    }
                    else if (m.type === "all_in") {
                        yourActions.canAllIn = true;
                    }
                }
                yourActions.maxTo = currentBet(state, viewerSeatId) + stackOf(state, viewerSeatId);
            }
        }
        return {
            gameType: "poker",
            status: state.status,
            handNumber: state.handNumber,
            street: state.street,
            communityCodes: state.community.map(cardCode),
            communityShort: state.community.map(cardShort),
            potTotal: potTotal(state),
            blinds: { ...state.blinds },
            seats,
            currentSeatId: state.currentSeatId,
            yourSeatId: viewerSeatId,
            yourHoleCards,
            yourHandLabel,
            yourActions,
            handResults: state.handResults,
            winnerSeatId: state.winnerSeatId,
            lastAction: state.lastAction,
            recentLog: state.log.slice(-8),
            config: state.config,
            dealerCharacterId: state.config.dealerCharacterId,
            hasPendingAnnouncements: state.pendingAnnouncements.length > 0,
        };
    },
    pickFallbackMove(state, seatId) {
        if (state.status === "hand_over")
            return { type: "next_hand" };
        const toCall = state.betToMatch - currentBet(state, seatId);
        return toCall <= 0 ? { type: "check" } : { type: "fold" };
    },
    toolManifests() {
        return [...POKER_TOOL_MANIFESTS];
    },
    parseToolCall(name, args) {
        return parsePokerToolCall(name, args);
    },
    announcerCharacterId(state) {
        return state.config.dealerCharacterId;
    },
    drainAnnouncements(state) {
        if (state.pendingAnnouncements.length === 0)
            return null;
        const s = clone(state);
        const announcements = s.pendingAnnouncements;
        s.pendingAnnouncements = [];
        return { state: s, announcements };
    },
};
//# sourceMappingURL=engine.js.map