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
  'narration = what she says and does on camera, first person, live-stream style. Her spoken words go in "double quotes", her actions between *asterisks*, for example: *leans into the ring light, lowers her voice* "Okay, who asked for slow? Because I heard slow." ' +
  "reaction = her quick reply to a fan, a tip or a menu buy, same style; crowd = a fan's chat line, plain text.";

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
    /** The second goal (twice the first) and whether the room reached it too. */
    secondGoal?: number;
    secondReached?: boolean;
    room?: SlurpLiveRoom;
  } & LiveSpice,
): string {
  const last = input.totalSegments !== undefined && input.segmentIndex >= input.totalSegments - 1;
  const goal = input.room?.goal;
  const secondGoal = input.room?.secondGoal;
  return [
    `You are ${input.hostName}, live on camera on your fan page. This is minute ${input.minutes} of the show (segment ${input.segmentIndex + 1}${input.totalSegments ? ` of ${input.totalSegments}` : ""}). You are a streamer who knows how to hold a room: you talk to the camera, read names off the chat, laugh at your own jokes, and never let a minute go flat.`,
    spiceBlock(input),
    ...slurpLiveRoomLines(input.room ?? { shown: [], promises: [], refused: [], jokes: [] }, !!input.goalReached),
    input.segmentIndex === 0
      ? "Open the show: say hi to the room by name, tell them what tonight is, tease what is coming, point at the tip menu. Set the scene: where you sit, what you wear, how the light falls."
      : last
        ? "This is the finale: about 90 seconds before the end make a last call for tips, then give the room the biggest payoff it paid for, thank the top tippers by name and say goodbye like you mean it."
        : input.secondReached
          ? "Both tip goals are reached: give the room everything you promised for the rest of the show."
          : input.goalReached
            ? `The tip goal is reached: turn the heat up a step and tease the second goal${input.secondGoal ? ` of ${input.secondGoal} coins` : ""}.`
            : "Keep the room going: build toward the tip goal, react to the chat, nudge the menu.",
    input.segmentIndex > 0
      ? "Go one step further than the last segment, inside the spice level above: a new piece of clothing, a new pose, a new spot in the room, a new game with the chat, a new tone of voice. A beat that already happened is not allowed to happen again."
      : "",
    goal
      ? input.goalReached
        ? `The goal on screen was: "${goal}". It is hit. Do it now, on camera, in full, and make the room feel they earned it.`
        : `The goal on screen is: "${goal}". Keep that promise: tease it, count down to it, and when the goal is hit you do exactly that.`
      : 'No goal is on screen yet. Name one in "goalReward": what you will do when the tip goal is hit, short and specific, something the room wants.',
    secondGoal && input.goalReached ? `The second goal promises: "${secondGoal}". Keep teasing it.` : "",
    input.goalReached && !secondGoal
      ? 'The first goal is hit, so name a bigger reward for the second goal in "goalReward", one step past the first.'
      : "",
    input.queuedMenuLabels.length
      ? `Menu items bought and waiting, do each one on camera in this segment, in order, describing it as you do it: ${input.queuedMenuLabels.join("; ")}.`
      : "",
    input.recentTips.length ? `Recent tips (thank some by name): ${input.recentTips.join(", ")}.` : "",
    input.recentPlayerChatLines.length
      ? `Chat lines to answer (reply to each with a reaction line): ${input.recentPlayerChatLines.join(" | ")}.`
      : "",
    input.fans?.length ? `Fans in the room you can name: ${input.fans.join(", ")}.` : "",
    "Write 14-20 narration lines, one about every 12-15 seconds across the segment, so the camera is never quiet. Each line is a moment: something she says, something she does, something she notices. Mix spoken words and *actions*, and make the details sensory: fabric, light, skin, sound, breath. Add 4-8 short crowd lines in between: fans' reactions, emojis welcome, no stage directions in brackets.",
    LINE_FORMAT,
    'Also add to the JSON, next to "lines": "act" = the title of this segment on stage, 2-6 words (for example "Ring light, slow tease"); "shot" = one sentence of what the camera sees right now, so it can be drawn: outfit, pose, place in the room, light, consistent with what is already on camera; and "goalReward" = what you do when the current goal is hit, short, only if the prompt above asks for one.',
    input.goalReached
      ? ""
      : 'Add "requires":"goal-open" to lines that only make sense before the goal is hit (counting down, begging for the last coins).',
    'Also add to the JSON: "did" = the new things you did or showed on camera this segment, 2-6 words each; "promise" = what you promise the room for the goal, or ""; "joke" = a running joke that started in chat, or "".',
  ]
    .filter(Boolean)
    .join("\n");
}

/** Her quick reply to the player's chat lines between segments. */
export function slurpLiveReplyPrompt(
  input: { creatorName: string; phase: string; spiceLevel: number; minutes: number; chat: string } & Partial<LiveSpice>,
): string {
  return [
    `You are ${input.creatorName}, live on camera, minute ${input.minutes} of your show (${input.phase}).`,
    spiceBlock({ level: input.level ?? input.spiceLevel, spiceLines: input.spiceLines }),
    `From the chat (greet anyone who just joined by name):\n${input.chat}`,
    "Answer them out loud on stream, one or two short lines, by their name, flirty and in the moment. Plain text only.",
  ].join("\n");
}

/** The crowd lane: the next minute of chat, reacting to what just happened on camera. */
export function slurpLiveCrowdPrompt(
  input: {
    hostName: string;
    minutes: number;
    room: string;
    narration: string;
    chat: string;
    fans: readonly string[];
  } & LiveSpice,
): string {
  return [
    `This is the live chat of ${input.hostName}'s cam show on their fan page, minute ${input.minutes}. The room: ${input.room}.`,
    spiceBlock(input),
    `What just happened on camera:\n${input.narration || "(warming up)"}`,
    input.chat ? `Recent chat:\n${input.chat}` : "",
    input.fans.length
      ? `Fans in the room (use some of these names, invent other short handles): ${input.fans.join(", ")}.`
      : "",
    "Write 8-12 chat lines from different viewers reacting to exactly this moment, each in their own voice. Never speak for the host. Short lines, emojis welcome.",
    'Answer with JSON only: {"lines":[{"at":0,"kind":"crowd","name":"<a short fan handle>","text":"<one line>"}]}',
  ]
    .filter(Boolean)
    .join("\n");
}

/** The crowd's reaction while the player hosts their own show. */
export function slurpLivePlayerCrowdPrompt(input: {
  narration: string;
  fans: Array<{ name: string; voice: string }>;
  hostName?: string;
  room?: string;
}): string {
  return [
    ...(input.room ? [`The room: ${input.room}.`] : []),
    `${input.hostName ?? "A creator"} is live on their fan page and just said or did this on camera:\n${input.narration || "(warming up)"}`,
    `Fans in the chat: ${input.fans.map((fan) => `${fan.name} (${fan.voice})`).join(", ") || "a few regulars"}.`,
    "Write the chat's reaction: 6-10 crowd lines from these fans, each in their own voice, hyped and thirsty, reacting to exactly what happened, asking for more and pointing at the tip menu.",
    LINE_FORMAT,
  ].join("\n");
}
