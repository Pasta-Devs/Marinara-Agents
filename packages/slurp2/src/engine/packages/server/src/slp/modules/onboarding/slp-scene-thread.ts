/**
 * The sign-up transcript as the new Creator's first DM thread.
 *
 * The newcomer's lines become the Creator's messages. The host's lines sit on the player's side;
 * when the player did not write them as themselves (Slurp Support, a helping Creator), each one
 * carries `sceneSpeaker` so the thread shows who said it and the DM model reads it as that
 * person, never as the fan. Times are spread back from now, oldest first, the last one at now;
 * trailing host lines are dropped so the chat ends on the Creator's last word.
 *
 * Pure, so the mapping runs in tests.
 */
import type { SlpSceneLine, SlpScenePreset } from "../../../../../shared/src/slp/slp-scene.js";

/** Seconds between two kept lines. */
const SLP_SCENE_THREAD_STEP_SECONDS = 20;

export function slpSceneThreadMessages(input: {
  preset: SlpScenePreset;
  hostName: string;
  lines: readonly SlpSceneLine[];
  now: Date;
}): { role: "viewer" | "creator"; content: string; metadata: Record<string, unknown>; createdAt: string }[] {
  // Support is a faceless team: always "Slurp Support", whatever the sign-up screen called it.
  const speaker =
    input.preset === "friend"
      ? ""
      : input.preset === "support"
        ? "Slurp Support"
        : input.hostName.trim() || "Slurp Support";
  // The kept chat ends on the Creator's last word: a trailing host line would read as a fan
  // message waiting for an answer and start a DM reply nobody asked for.
  let end = input.lines.length;
  while (end > 0 && input.lines[end - 1].speaker === "host") end--;
  const lines = input.lines.slice(0, end);
  // The last line lands at `now`, so the thread's preview and time move to it.
  const start = input.now.getTime() - (lines.length - 1) * SLP_SCENE_THREAD_STEP_SECONDS * 1000;
  return lines.map((line, index) => ({
    role: line.speaker === "newcomer" ? "creator" : "viewer",
    content: line.text,
    metadata: {
      signUpScene: input.preset,
      ...(line.speaker === "host" && speaker ? { sceneSpeaker: speaker } : {}),
    },
    createdAt: new Date(start + index * SLP_SCENE_THREAD_STEP_SECONDS * 1000).toISOString(),
  }));
}
