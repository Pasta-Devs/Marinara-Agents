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
