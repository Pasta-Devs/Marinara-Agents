import { slpLiveLog, slpLivePrivateOn, type SlpLiveState } from "./slp-live.js";

/**
 * Books a paid private block (LIVE-V3-PLAN.md "Private show"). The payer's own running block is extended;
 * somebody else's running block or a booked `receipt` books nothing (false). Private coins go to the
 * Creator but not toward the room's goals. Mutates `state`.
 */
export function slpLiveApplyPrivate(
  state: SlpLiveState,
  buy: { by: string; name: string; price: number; minutes: number },
  at: number,
  receipt: string,
): boolean {
  if (state.receipts.includes(receipt)) return false;
  const running = slpLivePrivateOn(state, at) ? state.private! : null;
  if (running && running.by !== buy.by) return false;
  state.receipts = [...state.receipts, receipt].slice(-200);
  state.names[buy.by] = buy.name;
  state.tippers[buy.by] = (state.tippers[buy.by] ?? 0) + buy.price;
  const block = buy.minutes * 60_000;
  if (!running) {
    // The public talk written ahead stops; the next beat is the private one.
    state.log = state.log.filter(
      (event) => !((event.kind === "say" || event.kind === "chat" || event.kind === "cam") && event.at > at),
    );
    state.beatTo = at;
  }
  state.private = running
    ? { ...running, to: running.to + block }
    : { by: buy.by, name: buy.name, from: at, to: at + block };
  slpLiveLog(state, { at, kind: "private", by: buy.by, name: buy.name, amount: buy.price });
  return true;
}
