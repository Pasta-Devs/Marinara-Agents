export function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
}
export function nameOfSeat(state, seatId) {
    return state.seatNames[seatId] ?? seatId;
}
export function recordEvent(state, event, cap) {
    state.log.push(event);
    if (state.log.length > cap)
        state.log.splice(0, state.log.length - cap);
}
export function setLastAction(state, seatId, summary) {
    state.lastAction = { seatId, summary };
}
//# sourceMappingURL=engine-utils.js.map