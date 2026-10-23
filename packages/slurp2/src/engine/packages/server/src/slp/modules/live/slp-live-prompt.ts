export function slurpLiveSegmentPrompt(input: {
  hostName: string;
  segmentIndex: number;
  minutes: number;
  level: number;
  queuedMenuLabels: string[];
  recentPlayerChatLines: string[];
  recentTips: string[];
}) {
  // TODO(claude): prompt text
  return `Live segment ${input.segmentIndex} for ${input.hostName}; ${input.minutes} minutes; level ${input.level}; menu ${input.queuedMenuLabels.join(", ")}; chat ${input.recentPlayerChatLines.join(", ")}; tips ${input.recentTips.join(", ")}.`;
}

export function slurpLiveMissedPrompt(input: {
  elapsedMinutes: number;
  raised: number;
  goal: number;
  servedMenuLabels: string[];
  topTipper: string | null;
}) {
  // TODO(claude): prompt text
  return `Live so far: ${input.elapsedMinutes} minutes; ${input.raised}/${input.goal}; served ${input.servedMenuLabels.join(", ")}; top tipper ${input.topTipper ?? "none"}. Return 2-3 lines.`;
}

export function slurpLiveReplyPrompt(input: {
  creatorName: string;
  phase: string;
  spiceLevel: number;
  minutes: number;
  chat: string;
}) {
  // TODO(claude): prompt text
  return `Live reply for ${input.creatorName}; phase ${input.phase}; spice ${input.spiceLevel}; ${input.minutes} minutes; chat ${input.chat}.`;
}

export function slurpLivePlayerCrowdPrompt(input: { narration: string; fans: Array<{ name: string; voice: string }> }) {
  // TODO(claude): prompt text
  return `Crowd reaction to player narration ${input.narration}; fans ${input.fans.map((fan) => `${fan.name} (${fan.voice})`).join(", ")}.`;
}
