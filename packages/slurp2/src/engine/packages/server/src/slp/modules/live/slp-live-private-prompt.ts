export function slurpLivePrivatePrompt(input: {
  hostName: string;
  viewerName: string;
  minutes: number;
  level: number;
  spiceLines: readonly string[];
  chat: string;
}): string {
  // TODO(claude): prompt text
  return `${input.hostName} responds to ${input.viewerName} in private at minute ${input.minutes}. ${input.chat}\n${input.spiceLines.join("\n")}\nReturn JSON with a lines array. Each line has at (milliseconds from 0 to 239000), kind (narration, reaction, or crowd), and text.`;
}

export function slurpLivePictureBrief(input: {
  hostName: string;
  trigger: string;
  level: number;
  spiceLines: readonly string[];
}): string {
  // TODO(claude): prompt text
  return `${input.hostName}: ${input.trigger}. ${input.spiceLines.join("\n")}`;
}
