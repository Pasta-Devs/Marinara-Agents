import type { GameEvent } from "./engine.types.js";

export function cloneState<T>(state: T): T {
  return JSON.parse(JSON.stringify(state)) as T;
}

export function nameOfSeat(state: { seatNames: Record<string, string> }, seatId: string): string {
  return state.seatNames[seatId] ?? seatId;
}

export function recordEvent(state: { log: GameEvent[] }, event: GameEvent, cap: number): void {
  state.log.push(event);
  if (state.log.length > cap) state.log.splice(0, state.log.length - cap);
}

export function setLastAction(
  state: { lastAction: { seatId: string; summary: string } | null },
  seatId: string,
  summary: string,
): void {
  state.lastAction = { seatId, summary };
}
