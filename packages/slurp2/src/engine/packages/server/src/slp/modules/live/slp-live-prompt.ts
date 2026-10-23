export function slurpLiveScriptPrompt(input: { creatorName: string; phase: string; spiceLevel: number; minutes: number }) {
  // TODO(claude): prompt text
  return `Live script for ${input.creatorName}; phase ${input.phase}; spice ${input.spiceLevel}; ${input.minutes} minutes.`;
}

export function slurpLiveFinishPrompt(input: { creatorName: string; phase: string; spiceLevel: number; minutes: number }) {
  // TODO(claude): prompt text
  return `Live finish for ${input.creatorName}; phase ${input.phase}; spice ${input.spiceLevel}; ${input.minutes} minutes.`;
}

export function slurpLiveReplyPrompt(input: { creatorName: string; phase: string; spiceLevel: number; minutes: number; chat: string }) {
  // TODO(claude): prompt text
  return `Live reply for ${input.creatorName}; phase ${input.phase}; spice ${input.spiceLevel}; ${input.minutes} minutes; chat ${input.chat}.`;
}

export function slurpLivePlayerCrowdPrompt(input: { narration: string; fans: Array<{ name: string; voice: string }> }) {
  // TODO(claude): prompt text
  return `Crowd reaction to player narration ${input.narration}; fans ${input.fans.map((fan) => `${fan.name} (${fan.voice})`).join(", ")}.`;
}
