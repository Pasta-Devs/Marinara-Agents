import type { SlpLiveState } from "../../../../../shared/src/slp/slp-live.js";

/** What the room may tip for, as the writer reads it. */
const MENU_WORDS: Record<string, string> = {
  shoutout: "a shout-out",
  song: "a song request",
  dance: "a dance",
  pose: "a pose",
  outfit: "an outfit change",
  closeUp: "a close-up",
  layer: "taking a layer off",
  flash: "a flash",
  toy: "toy play",
};
const menuWords = (id: string | undefined) => (id ? (MENU_WORDS[id] ?? id) : "");

export type SlpLivePromptInput = {
  /** `world`: the Creator's world line, empty for a modern Creator. */
  host: { name: string; pronouns: string; bio: string; canon: string; world?: string };
  spiceLines: readonly string[];
  state: SlpLiveState;
  /** Milliseconds since the start. */
  at: number;
  minutesLeft: number;
  seconds: number;
  viewer: { name: string; message?: string; joined: boolean } | null;
  /** A private block for the viewer: minutes left, and whether it just began. */
  private?: { minutesLeft: number; started: boolean } | null;
  /** The user plays the host: the model writes only the room and three ideas for the host's next move. */
  hosting?: boolean;
};

/** The cam lines carry the stage, so a show without pictures still shows something and a picture follows them. */
const camRule = (name: string, seconds: number) =>
  `Add 2 or 3 "cam" lines spread over the ${seconds} seconds ({"t":…,"who":"cam","text":"…"}): what the webcam shows at that moment, the way a viewer sees it. Name ${name}, their look, outfit and pose, the spot, and what they are doing. Present tense, one or two sentences, no spoken words.`;

/** The rules when the user hosts: the room is the model's, the host is the user's. */
function hostingSystem(host: SlpLivePromptInput["host"], seconds: number, spiceLines: readonly string[]) {
  return [
    ...(host.world ? [host.world] : []),
    `You write the room of a live cam show on Slurp, a creator platform like OnlyFans with live rooms like Chaturbate. ${host.name} (${host.pronouns}) is the host and is played by the user: never write a line for ${host.name}. Write the next ${seconds} seconds of what the fans in ROOM type in chat, and three ideas for ${host.name}'s next move.`,
    `Chat lines come only from fans in ROOM, by their exact name. Every fan sounds like a different person: some type short, some long, some lowercase or with a typo, emojis only now and then. They react to concrete things: what ${host.name} just did or said, a tip by name, the goal, the order on stage (NOW), each other. They ask ${host.name} for things, tease, flirt and cheer. Never a generic line that could fit any stream, never two lines alike.`,
    `Write 6 to 10 chat lines in order of "t" (seconds from now, 0 to ${seconds}). Money, goals and orders are already counted by the app: never invent a tip, a goal or a number.`,
    `"next" holds 3 short ideas for what ${host.name} could say or do next, first person, in ${host.name}'s voice from the profile, at most 15 words each, each one different: one to talk with a fan by name, one tease, one about the order on stage or the goal.`,
    ...spiceLines,
    `"patch.strip" stays false: ${host.name} decides that. "patch.heat" is 0 to 10 for how much this stretch heats the room. "patch.place" stays null.`,
    camRule(host.name, seconds),
    `Answer with JSON only: {"lines":[{"t":0,"who":"cam","text":"..."},{"t":1,"who":"<fan name>","text":"..."}],"next":["...","...","..."],"patch":{"heat":3,"strip":false,"place":null}}`,
  ].join("\n\n");
}

const clock = (ms: number) =>
  `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1_000)).padStart(2, "0")}`;

/** The room so far as short lines the model can pick up: talk, tips, orders, goals. */
function logLines(state: SlpLiveState, at: number, host: string, count: number) {
  return state.log
    .filter((event) => event.at <= at && event.kind !== "leave")
    .sort((a, b) => a.at - b.at)
    .slice(-count)
    .map((event) => {
      const time = `[${clock(event.at)}]`;
      if (event.kind === "say")
        return `${time} ${host}: ${event.action ? `(${event.action}) ` : ""}${event.text ?? ""}`;
      if (event.kind === "chat" || event.kind === "you") return `${time} ${event.name}: ${event.text ?? ""}`;
      if (event.kind === "cam") return `${time} [cam] ${event.text ?? ""}`;
      if (event.kind === "join") return `${time} ${event.name} joined`;
      if (event.kind === "tip") return `${time} ${event.name} tipped ${event.amount}`;
      if (event.kind === "order") return `${time} ${event.name} tipped ${event.amount} for ${menuWords(event.itemId)}`;
      if (event.kind === "goal") return `${time} GOAL HIT, the room unlocked ${menuWords(event.itemId)}`;
      if (event.kind === "done") return `${time} ${host} finished ${menuWords(event.itemId)}`;
      if (event.kind === "private") return `${time} ${event.name} paid for a private show`;
      return `${time} ${host} took a layer off`;
    });
}

/**
 * One beat of a live show: the next stretch of the Creator's lines and the room's chat, as JSON
 * (LIVE-V3-PLAN.md "Speed 2"). Code owns the facts (money, goals, who is in the room); the model only
 * writes what people say and do about them.
 */
export function slpLivePrompt(input: SlpLivePromptInput) {
  const { host, state, at, seconds, viewer } = input;
  const alone = input.private && viewer ? { ...input.private, name: viewer.name } : null;
  const roomNames = state.room.map((id) => state.names[id]).filter(Boolean);
  const regulars = Object.entries(state.tippers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => `${state.names[id] ?? (id.startsWith("persona:") ? viewer?.name : id)} (${amount} so far)`);
  const open = state.queue.filter((order) => order.doneAt === null);
  const goal = state.goals.find((entry) => entry.hitAt === null);
  const layersLeft = state.stripMax - state.strip;

  const system = input.hosting
    ? hostingSystem(host, seconds, input.spiceLines)
    : [
        ...(host.world ? [host.world] : []),
        `You write a live cam show on Slurp, a creator platform like OnlyFans with live rooms like Chaturbate. Write the next ${seconds} seconds: what ${host.name} says and does on camera, and what the fans in the room type in chat.`,
        `${host.name} uses ${host.pronouns}. Write ${host.name} in their own voice from the profile: first person, spoken to the camera, casual, like a real streamer who knows the regulars. One or two short sentences per line. Put what ${host.name} does in "action" (present tense, a few words, no asterisks); keep "text" for the spoken words.`,
        ...(alone
          ? [
              `This stretch is a private show: only ${alone.name} watches, the room waits outside. There is no fan chat: every line is ${host.name}'s.`,
              `Write 4 to 6 lines for ${host.name}, in order of "t" (seconds from now, 0 to ${seconds}). ${host.name} talks to ${alone.name} by name, closer and more personal than in the open room, and goes as far as the spice rules below allow.`,
              ...(alone.started
                ? [`${alone.name} just paid for this private show: the first line thanks them by name and starts it.`]
                : []),
              ...(alone.minutesLeft <= 1
                ? [
                    `The private time is almost up: ${host.name} asks ${alone.name} whether they want to stay longer, or says they'll see them back in the room.`,
                  ]
                : []),
            ]
          : [
              `Chat lines come only from fans in ROOM, by their exact name. Every fan sounds like a different person: some type short, some long, some lowercase or with a typo, emojis only now and then. They react to concrete things: what ${host.name} just did or said, a tip by name, the goal, the order on stage, each other. Never a generic line that could fit any stream, never two lines alike.`,
              `Write 3 to 5 lines for ${host.name} and 6 to 10 chat lines, mixed, in order of "t" (seconds from now, 0 to ${seconds}).`,
              `${host.name} does the order on stage (NOW), thanks tippers by name, and teases the next goal. Money, goals and orders are already counted by the app: never invent a tip, a goal or a number.`,
            ]),
        ...input.spiceLines,
        layersLeft > 0
          ? `"patch.strip" is true only if ${host.name} takes one layer of clothing off in this stretch (${layersLeft} left), and only when the heat or a tip earns it.`
          : `${host.name} has nothing left to take off: "patch.strip" stays false.`,
        `"patch.heat" is 0 to 10 for how much this stretch heats the room. "patch.place" names a new spot only if ${host.name} moves (for example "on the bed"), else null.`,
        camRule(host.name, seconds),
        `Answer with JSON only: {"lines":[{"t":0,"who":"cam","text":"..."},{"t":0,"who":"host","text":"...","action":"..."},{"t":2,"who":"<fan name>","text":"..."}],"patch":{"heat":3,"strip":false,"place":null}}`,
      ].join("\n\n");

  const facts = {
    PROFILE: { name: host.name, bio: host.bio || undefined, card: host.canon || undefined },
    SHOW: {
      time: clock(at),
      minutesLeft: input.minutesLeft,
      place: state.place ?? "their usual streaming spot",
      heat: `${Math.round(state.heat)} of 100`,
      layersOff: state.strip,
      raised: state.raised,
      NOW: open[0] ? `${menuWords(open[0].itemId)} for ${open[0].name || "the room"}` : null,
      NEXT: open[1] ? `${menuWords(open[1].itemId)} for ${open[1].name || "the room"}` : null,
      goal: goal ? `${menuWords(goal.reward)} at ${goal.target} (${state.raised} raised)` : "every goal is hit",
    },
    ROOM: alone
      ? ["(waiting outside: the show is private)"]
      : roomNames.length
        ? roomNames
        : ["(a few quiet lurkers, nobody typing yet)"],
    TOP_TIPPERS: regulars,
    LOG: logLines(state, at, host.name, viewer?.joined ? 40 : 20),
  };
  const ask = input.hosting
    ? viewer?.message
      ? `${host.name} just said or did: "${viewer.message}". The room reacts to it right away: the first chat line has t at most 2.`
      : "Write the next stretch of the room."
    : !viewer
      ? "Write the next stretch."
      : viewer.message
        ? `${viewer.name} (the viewer) just wrote in chat: "${viewer.message}". ${host.name}'s first line (t at most 3) answers ${viewer.name} by name. The room may react to it too: a regular can tease, a big tipper can get jealous.`
        : viewer.joined
          ? `${viewer.name} (the viewer) just opened the stream. ${host.name}'s first line welcomes ${viewer.name} by name, and the first two lines catch them up on what they missed from LOG, in the show's own voice. Then carry on.`
          : "Write the next stretch.";
  const self = viewer && !input.hosting ? ` Never write a line for ${viewer.name}: they type for themselves.` : "";
  const user = `${JSON.stringify(facts, null, 2)}\n\n${ask}${self}`;
  return { system, user };
}
