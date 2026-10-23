import { slurpFanTypeWeeklyBudget, type SlurpFanType } from "../../../../../shared/src/slp/slp-fan-types.js";

export type SlurpLivePhase = "warmup" | "main" | "finish";
export type SlurpLiveLineKind = "narration" | "crowd" | "reaction";
export type SlurpLiveEventKind = "tip" | "chat";
export type SlurpLiveLine = { at: number; kind: SlurpLiveLineKind; name?: string; text: string };
export type SlurpLiveEvent = {
  at: number;
  kind: SlurpLiveEventKind;
  name: string;
  amount?: number;
  text: string;
  requestId?: string;
};
export type SlurpLiveShow = {
  id: string;
  hostKind: "creator" | "player";
  hostId: string;
  startedAt: string;
  endsAt: string;
  endedAt: string | null;
  goal: number;
  raised: number;
  goalHitAt: string | null;
  script: SlurpLiveLine[];
  events: SlurpLiveEvent[];
  lastReplyAt: string | null;
  recapPostId: string | null;
};

export const SLURP_LIVE_EVENT_LIMIT = 200;

export function slurpLiveCapEvents(events: readonly SlurpLiveEvent[]): SlurpLiveEvent[] {
  return events.slice(-SLURP_LIVE_EVENT_LIMIT);
}

export function slurpLiveTipRequestSeen(events: readonly SlurpLiveEvent[], requestId: string): boolean {
  return events.some((event) => event.kind === "tip" && event.requestId === requestId);
}

export function slurpLiveClaimTipEvent(
  events: readonly SlurpLiveEvent[],
  raised: number,
  goal: number,
  event: SlurpLiveEvent,
) {
  if (event.requestId && slurpLiveTipRequestSeen(events, event.requestId)) return null;
  const nextRaised = raised + (event.amount ?? 0);
  return {
    events: slurpLiveCapEvents([...events, event]),
    raised: nextRaised,
    hitGoal: raised < goal && nextRaised >= goal,
  };
}

export function slurpLiveReplyClaimAllowed(lastReplyAt: string | null, at: Date): boolean {
  return !lastReplyAt || Date.parse(lastReplyAt) <= at.getTime() - 60_000;
}

export function slurpLiveCrowdClaimAllowed(lastCrowdAt: string | null, at: Date): boolean {
  return !lastCrowdAt || Date.parse(lastCrowdAt) <= at.getTime() - 30_000;
}

export function slurpLivePlayerTipAmount(type: SlurpFanType, memberId: string): number {
  return Math.max(1, Math.round(slurpFanTypeWeeklyBudget(type, memberId) * type.spend.tipChance));
}

export function slurpLiveTipTopper(events: readonly SlurpLiveEvent[]): SlurpLiveEvent | null {
  return events.filter((event) => event.kind === "tip").reduce<SlurpLiveEvent | null>(
    (best, event) => (!best || (event.amount ?? 0) > (best.amount ?? 0) ? event : best),
    null,
  );
}

export function slurpLivePlayerTipDue(input: { fanId: string; showId: string; tipChance: number; seed: number }): boolean {
  if (!(input.tipChance > 0)) return false;
  let hash = 0x811c9dc5;
  for (const char of `${input.showId}:${input.fanId}:${input.seed}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  return ((hash >>> 0) / 0x100000000) < Math.min(1, input.tipChance);
}

export function slurpLiveParseLines(value: unknown): SlurpLiveLine[] {
  let parsed = value;
  if (typeof parsed === "string") {
    const unfenced = parsed.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
    try {
      parsed = JSON.parse(unfenced) as unknown;
    } catch {
      return [];
    }
  }
  const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? (parsed as { lines?: unknown }).lines : null;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((line) => {
    if (!line || typeof line !== "object") return [];
    const item = line as Record<string, unknown>;
    const kind = item.kind;
    if (kind !== "narration" && kind !== "crowd" && kind !== "reaction") return [];
    if (typeof item.text !== "string" || typeof item.at !== "number" || !Number.isFinite(item.at)) return [];
    return [{
      at: Math.max(0, item.at),
      kind,
      ...(typeof item.name === "string" ? { name: item.name } : {}),
      text: item.text.slice(0, 1000),
    }];
  });
}

export function slurpLiveScriptFailed(lines: readonly SlurpLiveLine[]): boolean {
  return lines.length === 0;
}

export function slurpLiveDurationMinutes(seed: number): number {
  const value = Math.abs(Math.trunc(seed)) % 21;
  return 20 + value;
}

export function slurpLivePhase(show: Pick<SlurpLiveShow, "startedAt" | "endsAt" | "goal" | "raised" | "goalHitAt">, now = new Date()): SlurpLivePhase {
  if (show.goalHitAt || show.raised >= show.goal) return "finish";
  const start = Date.parse(show.startedAt);
  const end = Date.parse(show.endsAt);
  return now.getTime() >= start + Math.max(0, end - start) * 0.8 ? "finish" : now.getTime() < start + (end - start) * 0.2 ? "warmup" : "main";
}

export function slurpLiveVisible(show: Pick<SlurpLiveShow, "startedAt" | "script" | "events">, now = new Date()) {
  const at = now.getTime() - Date.parse(show.startedAt);
  return {
    script: show.script.filter((line) => line.at <= at),
    events: show.events.filter((event) => event.at <= at),
  };
}

export function slurpLiveTipSchedule(types: readonly SlurpFanType[], seed: number, durationMinutes: number) {
  const eligible = types.filter((type) => type.enabled && type.spend.tipChance > 0);
  return eligible.map((type, index) => ({
    at: ((Math.abs(seed) + index * 997) % Math.max(1, durationMinutes * 60)) * 1000,
    name: type.name,
    amount: Math.max(1, Math.round(type.spend.weeklyBudget[0] * type.spend.tipChance)),
  }));
}

export function slurpLiveTopTip(events: readonly SlurpLiveEvent[]) {
  return events.filter((event) => event.kind === "tip").sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0] ?? null;
}

export function slurpLiveReplyAllowed(lastReplyAt: string | null, now = new Date()) {
  return !lastReplyAt || now.getTime() - Date.parse(lastReplyAt) >= 60_000;
}

export function slurpLiveShouldStart(input: { active: boolean; slurpTrendScore?: number; random?: number }) {
  if (input.active) return false;
  const score = Math.max(0, input.slurpTrendScore ?? 0);
  const chance = Math.min(0.35, 0.03 + score / 1000);
  return (input.random ?? Math.random()) < chance;
}
