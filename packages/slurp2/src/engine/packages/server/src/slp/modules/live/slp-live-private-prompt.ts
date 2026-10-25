/**
 * The private show and the live pictures. Heat as in the public room: `spiceLines` are her DM spice
 * lines (level, turn-ons, hard-nos), `level` the spice step (0 clean ... 3 explicit). A private show is
 * the same room one step closer: only this fan, all of her attention.
 */
const PRIVATE_DIRECTION = [
  "Keep it sweet and personal: talk, laugh, flirt a little. No undressing.",
  "Flirt hard and tease: pose for them, show the outfit up close, tell them what you would do. Clothes stay on.",
  "Make it steamy: strip slowly for them, lingerie, topless, describe your body and how they make you feel.",
  "Give them the full private show: nude, touching yourself, toys if you like them, say what you are doing as you do it, and finish together when they push you there.",
];

/** Her lines in a private block: answer everything the fan wrote, nothing for the public room. */
export function slurpLivePrivatePrompt(input: {
  hostName: string;
  viewerName: string;
  minutes: number;
  level: number;
  spiceLines: readonly string[];
  chat: string;
}): string {
  return [
    `You are ${input.hostName}, in a paid private show with ${input.viewerName} on your fan page, minute ${input.minutes}. The public room is waiting outside; it is just the two of you now.`,
    PRIVATE_DIRECTION[Math.max(0, Math.min(3, Math.floor(input.level)))],
    ...input.spiceLines,
    input.chat
      ? `What ${input.viewerName} wrote (answer every line, by name, and do what they ask if it fits you):\n${input.chat}`
      : `${input.viewerName} is watching quietly: lead, ask what they want, and give them something to tip for.`,
    'Write 4-8 short lines, first person, live and in the moment, emojis welcome. Answer with JSON only: {"lines":[{"at":<ms from now, 0-239000, rising>,"kind":"narration"|"reaction","text":<one line>}]}.',
  ].join("\n");
}

const PICTURE_MOMENT: Record<string, string> = {
  goal: "the moment the tip goal is hit: excited, celebrating the room, the outfit a little more undone than at the start",
  finale: "the finale of her show: the peak of the show, the most she shows tonight",
  shot: "what her camera shows right now",
  menu: "her doing the menu item a fan just bought",
  private: "a private-show moment just for one fan: closer to the camera, intimate",
};

/** What the live picture shows. `trigger` is `goal`, `finale`, `menu:<id>` or `private:<block>`. */
export function slurpLivePictureBrief(input: {
  hostName: string;
  trigger: string;
  level: number;
  spiceLines: readonly string[];
  menuLabel?: string;
  shot?: string;
}): string {
  const kind = input.trigger.split(":")[0];
  const moment =
    (kind === "shot" && input.shot ? `what her camera shows right now: ${input.shot}` : PICTURE_MOMENT[kind]) ??
    "a moment from her live show";
  return [
    `${input.hostName} live on webcam in her room, a screenshot of her stream: ${moment}${kind === "menu" && input.menuLabel ? ` (${input.menuLabel})` : ""}.`,
    // How much she shows is the picture level the caller passes to the image pipeline, not these words.
    "Webcam angle, ring light, her bedroom behind her, a live-stream feel.",
  ].join(" ");
}
