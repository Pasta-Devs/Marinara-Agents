import type { SlurpFanType } from "../../../../../shared/src/slp/slp-fan-types.js";

export type SlurpLivePhase = "warmup" | "main" | "finish";
export type SlurpLiveLineKind = "narration" | "crowd" | "reaction";
export type SlurpLiveEventKind = "tip" | "chat";
export type SlurpLiveLine = { at: number; kind: SlurpLiveLineKind; name?: string; text: string };
export type SlurpLiveEvent = { at: number; kind: SlurpLiveEventKind; name: string; amount?: number; text: string };
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
