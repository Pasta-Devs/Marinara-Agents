// A model that refuses image input refuses it every time, so the first rejection is
// worth remembering: the next refresh starts text-only instead of paying for another
// 400 and printing its stack trace in the terminal.
// ponytail: in-memory, so the error still shows once per server start. Persist it if
// that single line is still too loud.
const modelsRejectingVision = new Set<string>();

export function noodleVisionModelKey(provider: string, model: string): string {
  return JSON.stringify([provider, model]);
}

export function noodleModelRejectsVisionInput(provider: string, model: string): boolean {
  return modelsRejectingVision.has(noodleVisionModelKey(provider, model));
}

export function rememberNoodleVisionRejection(provider: string, model: string): void {
  modelsRejectingVision.add(noodleVisionModelKey(provider, model));
}
