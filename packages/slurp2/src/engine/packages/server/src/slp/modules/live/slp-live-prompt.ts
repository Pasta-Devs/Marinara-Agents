/**
 * The live room's prompts. Her heat comes from `spiceLines` (`slurpSpiceBriefLines` with `use: "dm"`:
 * her level, turn-ons and hard-nos in plain words), so a live show never goes past what she does in
 * her DMs. `level` is the spice step (0 clean, 1 flirty, 2 suggestive, 3 explicit).
 */
import { slurpLiveRoomLines, type SlurpLiveRoom } from "./slp-live-room.js";

type LiveSpice = { level: number; spiceLines?: readonly string[] };

const LEVEL_DIRECTION = [
  "Keep it clean: chatty, warm, playful. No undressing.",
  "Flirt and tease: outfits, poses, winks, innuendo. Clothes stay on.",
  "Get steamy: lingerie, slow reveals, topless when the room pays for it. Describe skin and body.",
  "Go all the way when the room earns it: nude, toys, touching herself, a real climax at the finale. Graphic is fine.",
];

const spiceBlock = (input: LiveSpice) =>
  [LEVEL_DIRECTION[Math.max(0, Math.min(3, Math.floor(input.level)))], ...(input.spiceLines ?? [])].join("\n");

const LINE_FORMAT =
  'Answer with JSON only: {"lines":[{"at":<ms from the segment start, 0-239000, rising>,"kind":"narration"|"reaction"|"crowd","name":<crowd lines only: a short fan handle>,"text":<one line>}]}. ' +
  "narration = what she says or does on camera, first person, live-stream chat style; reaction = her quick reply to a fan, a tip or a menu buy; crowd = a fan's chat line.";

/** One 4-minute segment of her show while somebody watches. */
export function slurpLiveSegmentPrompt(
  input: {
    hostName: string;
    segmentIndex: number;
    minutes: number;
    queuedMenuLabels: string[];
    recentPlayerChatLines: string[];
    recentTips: string[];
    fans?: readonly string[];
    totalSegments?: number;
    goalReached?: boolean;
    room?: SlurpLiveRoom;
  } & LiveSpice,
): string {
  const last = input.totalSegments !== undefined && input.segmentIndex >= input.totalSegments - 1;
  return [
    `You are ${input.hostName}, live on camera on your fan page. This is minute ${input.minutes} of the show (segment ${input.segmentIndex + 1}${input.totalSegments ? ` of ${input.totalSegments}` : ""}).`,
    spiceBlock(input),
    ...slurpLiveRoomLines(input.room ?? { shown: [], promises: [], refused: [], jokes: [] }, !!input.goalReached),
    input.segmentIndex === 0
      ? "Open the show: say hi to the room, tease what is coming, point at the tip menu."
      : last
        ? "This is the finale: give the room the big payoff it paid for, then thank the top tippers and say goodbye."
        : input.goalReached
          ? "The tip goal is reached: turn the heat up a step for the rest of the show."
          : "Keep the room going: build toward the tip goal, react to the chat, nudge the menu.",
    input.queuedMenuLabels.length
      ? `Menu items bought and waiting, do each one on camera in this segment, in order, describing it as you do it: ${input.queuedMenuLabels.join("; ")}.`
      : "",
    input.recentTips.length ? `Recent tips (thank some by name): ${input.recentTips.join(", ")}.` : "",
    input.recentPlayerChatLines.length
      ? `Chat lines to answer (reply to each with a reaction line): ${input.recentPlayerChatLines.join(" | ")}.`
      : "",
    input.fans?.length ? `Fans in the room you can name: ${input.fans.join(", ")}.` : "",
    "Write 8-14 lines spread over the segment: mostly narration and reactions, 2-4 crowd lines. Short lines, emojis welcome, no stage directions in brackets.",
    LINE_FORMAT,
    input.goalReached
      ? ""
      : 'Add "requires":"goal-open" to lines that only make sense before the goal is hit (counting down, begging for the last coins).',
    'Also add to the JSON: "did": the new things she did or showed on camera this segment, 2-6 words each; "promise": what she promises the room for the goal, or ""; "joke": a running joke that started in chat, or "".',
  ]
    .filter(Boolean)
    .join("\n");
}

/** "What you missed": a newcomer's catch-up on the show so far. */
export function slurpLiveMissedPrompt(input: {
  elapsedMinutes: number;
  raised: number;
  goal: number;
  servedMenuLabels: string[];
  topTipper: string | null;
  hostName?: string;
}): string {
  return [
    `A fan just joined ${input.hostName ?? "her"} live show, ${input.elapsedMinutes} minutes in. Tell them what they missed, like a friend in the chat would.`,
    `Facts: ${input.raised} of ${input.goal} coins raised${input.topTipper ? `, top tipper ${input.topTipper}` : ""}${input.servedMenuLabels.length ? `, menu items done: ${input.servedMenuLabels.join("; ")}` : ", no menu items yet"}.`,
    "Use only these facts. Answer with a JSON array of 2-3 short strings, casual, emojis welcome.",
  ].join("\n");
}

/** Her quick reply to the player's chat lines between segments. */
export function slurpLiveReplyPrompt(
  input: { creatorName: string; phase: string; spiceLevel: number; minutes: number; chat: string } & Partial<LiveSpice>,
): string {
  return [
    `You are ${input.creatorName}, live on camera, minute ${input.minutes} of your show (${input.phase}).`,
    spiceBlock({ level: input.level ?? input.spiceLevel, spiceLines: input.spiceLines }),
    `A fan wrote in the chat:\n${input.chat}`,
    "Answer them out loud on stream, one or two short lines, by their name, flirty and in the moment. Plain text only.",
  ].join("\n");
}

/** The crowd's reaction while the player hosts their own show. */
export function slurpLivePlayerCrowdPrompt(input: {
  narration: string;
  fans: Array<{ name: string; voice: string }>;
  hostName?: string;
}): string {
  return [
    `${input.hostName ?? "A creator"} is live on their fan page and just said or did this on camera:\n${input.narration || "(warming up)"}`,
    `Fans in the chat: ${input.fans.map((fan) => `${fan.name} (${fan.voice})`).join(", ") || "a few regulars"}.`,
    "Write the chat's reaction: 6-10 crowd lines from these fans, each in their own voice, hyped and thirsty, reacting to exactly what happened, asking for more and pointing at the tip menu.",
    LINE_FORMAT,
  ].join("\n");
}
