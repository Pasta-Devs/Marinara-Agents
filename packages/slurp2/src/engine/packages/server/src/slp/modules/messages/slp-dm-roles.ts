/**
 * Who is who in a direct-message thread, said once and plainly.
 *
 * The DM prompts used to label every line "you" or "the fan" and render events as bracketed
 * speech, so a model could not tell a Creator writing to another Creator from a fan, read Slurp
 * Support's sign-up lines or a commission notice as the fan talking, and lost track of who had
 * written first. This builds the one role header and the speaker-named transcript both sides of a
 * thread use: the Creator's reply (`slp-message-generation-service.ts`) and the fan's answer
 * (`slp-fan-reply-service.ts`).
 *
 * Pure, so every thread kind is built and read in tests.
 */
import { slpSceneInviteInstruction } from "./slp-roleplay-scene-rules.js";

/** A name as it appears in the chat. */
export type SlurpDmParty = {
  name: string;
  handle: string;
  /** A Creator page writing to its partner or ex (7b-couples): who they are to each other, one sentence. */
  relationship?: string;
  /** The two are a couple now: the chat is as private and as spicy as both their levels allow. */
  partner?: boolean;
  /** What the Creator calls them: "boyfriend", "girlfriend" or "partner" (from the page's gender). */
  partnerWord?: string;
  /**
   * The page is the player's own and concealed: she knows who she is with, but the header never
   * names the page, and there is no collab to agree on in this chat.
   */
  concealed?: boolean;
  /** The one writing is the player: the answer may say what the talk did to the two of them ("us"). */
  us?: boolean;
};

/** The message fields the transcript reads. A subset of `SlurpMessage`. */
export type SlurpDmLine = {
  id: string;
  role: "viewer" | "creator";
  kind: string;
  content: string;
  price: number;
  unlockedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SlurpDmTranscriptLine = {
  /** Who said or did it. The writer's own lines read "you (Name)". */
  from: string;
  /** Something that happened in the chat, never words anyone typed. */
  event?: string;
  /** Their words, when there are any. */
  text?: string;
  image?: string;
  at: string;
};

export type SlurpDmRoleInput = {
  /** Which side the model writes: the Creator ("creator") or the person writing to them ("viewer"). */
  writer: "creator" | "viewer";
  creator: SlurpDmParty;
  viewer: SlurpDmParty;
  /** The viewer's own Creator page, when they run an open one: this is then Creator to Creator. */
  viewerPage?: SlurpDmParty | null;
  openedBy?: "viewer" | "creator" | null;
  /** Coins the viewer paid to send the first message. */
  requestFee?: number;
  /** The Creator has not answered this message request yet. */
  isRequest?: boolean;
  /** Slurp Support's own thread (`slp-support.ts`): the viewer is Slurp's staff, not a fan. */
  support?: boolean;
  /** The Creator may pitch a roleplay scene in this reply (docs/SCENES.md). */
  sceneInvite?: boolean;
};

const at = (party: SlurpDmParty) => (party.handle ? `${party.name} (@${party.handle})` : party.name);

/**
 * The Creator page the one writing runs, for the role header: never the page being written to or a
 * page that is the writer itself, and only an open one, so a concealed page is never linked to its owner.
 */
export function slurpDmViewerPage(
  page: {
    id: string;
    invited?: boolean;
    displayName: string;
    handle: string;
    settings: { privacy: { identityDisclosure?: string } };
  } | null,
  creatorId: string,
  viewerId: string,
): SlurpDmParty | null {
  return page &&
    !page.invited &&
    page.id !== creatorId &&
    page.id !== viewerId &&
    (page.settings.privacy.identityDisclosure ?? "open") === "open"
    ? { name: page.displayName, handle: page.handle }
    : null;
}

/** The writer's own label on a line. */
export function slurpDmSelfLabel(name: string): string {
  return `you (${name})`;
}

/** Slurp's own staff: a faceless team, always this name (docs/SUPPORT-DESK.md). Old kept lines keep theirs. */
export const SLURP_SUPPORT_NAME = "Slurp Support";

/**
 * Someone other than the viewer speaking on the viewer's side: a sign-up host (Slurp Support, a
 * helping Creator) in a kept sign-up chat, or the player writing as Slurp Support (`supportVoice`).
 */
function sideSpeaker(line: SlurpDmLine): { name: string; live: boolean } | null {
  const speaker = line.metadata?.sceneSpeaker;
  if (line.role !== "viewer" || typeof speaker !== "string" || !speaker.trim()) return null;
  return { name: speaker.trim(), live: line.metadata?.supportVoice === true };
}

/** How a side speaker is labelled on their lines. */
function sideLabel(speaker: { name: string; live: boolean }): string {
  return speaker.live ? `${speaker.name} (Slurp staff)` : `${speaker.name} (during the sign-up)`;
}

/** The name a fan with no name on their account goes by in a DM prompt. */
export const SLURP_DM_UNNAMED_FAN = "this fan";

/**
 * The role header: who you are, who you are writing to, who they are to you, who wrote first,
 * and whose turn this is. Plain in-world sentences, no labels, like the flavour brief.
 */
export function slurpDmRoleHeader(input: SlurpDmRoleInput & { history: readonly SlurpDmLine[] }): string {
  const creator = input.creator.name;
  const viewer = input.viewer.name;
  // A fan with no name: "this fan" inside a sentence, "This fan" at its start (7c M-010).
  const unnamed = viewer === SLURP_DM_UNNAMED_FAN;
  const Viewer = unnamed ? "This fan" : viewer;
  const me = input.writer === "creator" ? creator : viewer;
  const them = input.writer === "creator" ? viewer : creator;
  const lines: string[] = [];
  if (input.support) {
    lines.push(
      `You are ${at(input.creator)}, a Creator on Slurp. This is your private chat with ${viewer}, Slurp's own staff team: the people who run the platform you post on. ${viewer} is not a fan and not a customer; talk to them the way ${creator} talks to the platform's staff. Every line on their side is marked "${viewer} (Slurp staff)" or "${viewer} (during the sign-up)".`,
      `What ${viewer} tells you can change things for you: your mood, what you are into, what you plan to post, what you bring up more or leave alone. It never changes how you feel about any fan. When this talk really changes something and you go along with it, add "staff" to your JSON: {"mood": "bright"|"cozy"|"restless"|"low"|"flirty"|"stressed"|null, "focus": what you are into or working on now, or null, "idea": one post you now plan, or null, "more": a topic you will bring up more, or null, "less": a topic you will leave alone for now, or null, "takeaway": one sentence you will remember, starting "${viewer} told me", or null, "stir": when ${viewer} asks for something beyond you (a collab, being set up with someone, a rivalry, an event), that wish in plain words, or null}. Otherwise "staff" is null. You can also say no to them. Nothing changes until ${viewer} confirms it, so answer the way you really feel about it.`,
      // The Support desk (docs/SUPPORT-DESK.md). "slurpStanding" in the data says where you stand with Slurp.
      `Also add "desk" to your JSON every time: {"trust": "up" if this talk made you think better of Slurp, "down" if worse, else "same", "offer": when slurpStanding.pendingOffer is set, your answer to that offer: "accept", "counter" (you want something different) or "decline"; otherwise null, "counter": what you would take instead, in plain words, or null, "intel": rarely, and only when you trust Slurp, one thing you let slip about another Creator on Slurp, or null, "rating": when slurpStanding.ticketResolved is set, 1 to 5 for how Slurp handled your ticket; otherwise null}. When slurpStanding.youGoAlong is set you accept the offer, however you feel about it. Your "content" says your answer in your own words; decide the way you really would, from slurpStanding.standing.`,
    );
  } else if (input.writer === "creator") {
    const page = input.viewerPage;
    lines.push(
      `You are ${at(input.creator)}, a Creator on Slurp. This is your private chat with ${at(input.viewer)}.`,
      // Her partner is neither a fan nor a customer: nothing here is for sale to them (Drama, "your relationship").
      page?.partner
        ? `${viewer} is your ${page.partnerWord ?? "partner"}${page.concealed ? "" : ` and runs a Creator page on Slurp too (${at(page)})`}. This chat is just the two of you: talk to ${viewer} the way you talk to the person you are with, never as a fan or a customer. Nothing you send ${viewer} is for sale; what you share here is yours to give.`
        : page && !page.concealed
          ? `${viewer} runs a Creator page on Slurp too (${at(page)}). This is one Creator writing to another: talk to ${viewer} as a fellow Creator, not as a customer, though they can still subscribe or buy like anyone.`
          : unnamed
            ? "The person writing to you is a fan."
            : `${viewer} is a fan writing to you.`,
    );
    if (page?.relationship) lines.push(page.relationship);
    // Her public side: she is a Creator, and the one she is with sees her page like everyone else.
    if (page?.partner)
      lines.push(
        `Your page is public, and ${viewer} sees what you post there like everyone else does. That is part of you two: you can tell ${viewer} what you posted and who is looking, tease them with what your fans get, or ask how it makes them feel.`,
      );
    if (page?.us)
      lines.push(
        `Also add "us" to your JSON: {"step": "closer" when this talk really brought you two closer (a confession, asking ${viewer} out or saying yes, agreeing to be a couple), "hurt" when you two really fought or ${viewer} hurt you, "madeUp" when you made up after a fight; "why": a few words about it}. Most messages change nothing between you: then "us" is null.`,
      );
    if (input.sceneInvite) lines.push(slpSceneInviteInstruction(viewer));
    // Two pages can plan a joint post here; the split is theirs to agree (7b-c).
    if (page && !page.concealed)
      lines.push(
        `If you two really agree in this chat to make a post together, add "collab" to your JSON: {"idea": what you make together, "yourShare": the percent of what it earns that is yours, 50 unless you two agreed otherwise, "shoot": true if it is a spicy shoot together you two negotiated here (what you do, your limits, the split), else false}. Otherwise "collab" is null. A collab is work: you announce it, tag each other and split what it earns. Only agree if it fits you; you can say no.`,
      );
  } else {
    lines.push(
      `You are ${at(input.viewer)}, a fan on Slurp. This is your private chat with ${at(input.creator)}, a Creator on Slurp.`,
    );
  }

  const speakers = input.history.map(sideSpeaker);
  const liveSupport = [...new Set(speakers.filter((speaker) => speaker?.live).map((speaker) => speaker!.name))];
  const signUpHelpers = [
    ...new Set(speakers.filter((speaker) => speaker && !speaker.live).map((speaker) => speaker!.name)),
  ];
  for (const support of input.support ? [] : liveSupport)
    lines.push(
      `${support} is Slurp's own staff team. ${support} writes in this chat too, on ${viewer}'s side, and every such line is marked "${support} (Slurp staff)". ${support} is not ${viewer} and not a fan, and nothing ${support} says is a fact about ${viewer}.`,
    );

  if (input.history.some((line) => line.metadata?.signUpScene)) {
    lines.push(
      input.writer === "creator"
        ? `This chat began as your sign-up on Slurp, the moment your page was made.`
        : `This chat began as ${creator}'s sign-up on Slurp, the moment their page was made.`,
    );
    for (const helper of signUpHelpers)
      lines.push(
        input.support || liveSupport.includes(helper)
          ? `Lines marked "${helper} (during the sign-up)" are ${helper} signing you up.`
          : `Lines marked "${helper} (during the sign-up)" were said by ${helper}, who helped with the sign-up. ${helper} is not in this chat any more; every other line on that side is ${viewer}.`,
      );
  } else if (speakers[0]?.live) {
    lines.push(`${speakers[0].name} wrote to ${input.writer === "creator" ? "you" : creator} first.`);
  } else if (input.openedBy === "creator") {
    lines.push(input.writer === "creator" ? `You wrote to ${viewer} first.` : `${creator} wrote to you first.`);
  } else if (input.openedBy === "viewer") {
    const fee = Math.max(0, Math.round(input.requestFee ?? 0));
    lines.push(
      input.writer === "creator"
        ? `${Viewer} wrote to you first${fee > 0 ? ` and paid ${fee} coins to send that first message` : ""}.`
        : `You wrote to ${creator} first${fee > 0 ? ` and paid ${fee} coins to send that first message` : ""}.`,
    );
  }
  if (input.isRequest && input.writer === "creator")
    lines.push(`You have not answered ${viewer} yet: this is still a message request.`);

  // Whose turn it is, and to whom. A follow-up after your own message must not read as answering
  // yourself, and a Support line must be answered as Support, never as the fan.
  const last = input.history.at(-1);
  const lastSpeaker = last ? sideSpeaker(last) : null;
  if (!last) lines.push(`Nothing has been said yet. You write the first message to ${them}.`);
  else if (lastSpeaker?.live && input.writer === "creator" && !input.support)
    lines.push(
      `Right now ${lastSpeaker.name} is writing to you, not ${viewer}. Your message answers ${lastSpeaker.name}: talk to Slurp's staff as ${me} would, and do not address ${viewer}. Where these instructions speak of a fan, they mean ${viewer}, not ${lastSpeaker.name}.`,
    );
  else if (last.role === input.writer && !lastSpeaker)
    lines.push(
      `The newest line is your own, and ${them} has not answered it. Your message follows up on it; it does not answer yourself.`,
    );
  else lines.push(`Your message answers ${lastSpeaker ? "the newest line" : `${them}'s newest message`}.`);

  lines.push(
    `Every line in "conversation" names who said it; "${slurpDmSelfLabel(me)}" is you. A line with "event" is something that happened in the chat (a tip, an unlock, a shared post, a commission step, a message sent to all subscribers), not words anyone typed.`,
    input.support
      ? `In the data, "creator" is you and "slurpStaff" is ${viewer}, Slurp's staff. Write only ${me}'s next message. Never write anyone else's words, and never write as Slurp.`
      : input.writer === "creator"
        ? `In the data, "creator" is you and "fan" is ${viewer}. Write only ${me}'s next message. Never write anyone else's words, and never write as Slurp.`
        : `In the data, "fan" is you and "creator" is ${creator}. Write only ${me}'s next message. Never write ${them}'s words, and never write as Slurp or anyone else.`,
  );
  return lines.join("\n");
}

const coins = (amount: number) => (amount > 0 ? ` for ${amount} coins` : "");
const PAYMENT_EVENT = {
  tip: (to: string, whose: string, amount: number) =>
    amount > 0 ? `tipped ${to} ${amount} coins on ${whose} profile` : `tipped ${to} on ${whose} profile`,
  unlock: (_to: string, whose: string, amount: number) => `unlocked one of ${whose} posts${coins(amount)}`,
  ppv: (_to: string, whose: string, amount: number) => `unlocked ${whose} locked photo${coins(amount)}`,
  commission: (_to: string, _whose: string, amount: number) =>
    amount > 0 ? `paid ${amount} coins for the commission` : "paid for the commission",
};

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

/**
 * The conversation with a speaker name on every line and events as events.
 *
 * `protect` redacts a concealed Creator's identity; `image` describes a message's picture;
 * `postUnlocked` says whether the viewer already owns a shared locked post.
 */
export function slurpDmTranscript(
  history: readonly SlurpDmLine[],
  input: Pick<SlurpDmRoleInput, "writer" | "creator" | "viewer"> & {
    protect?: (value: string) => string;
    image?: (line: SlurpDmLine) => string | undefined;
    postUnlocked?: (postId: unknown) => boolean;
  },
): SlurpDmTranscriptLine[] {
  const protect = input.protect ?? ((value: string) => value);
  const creatorSide = input.writer === "creator";
  const creatorLabel = creatorSide ? slurpDmSelfLabel(input.creator.name) : input.creator.name;
  const viewerLabel = creatorSide ? input.viewer.name : slurpDmSelfLabel(input.viewer.name);
  // How the other side is named inside an event sentence.
  const creatorObject = creatorSide ? "you" : input.creator.name;
  const viewerObject = creatorSide ? input.viewer.name : "you";
  // A desk note is the player's own (docs/SUPPORT-DESK.md): no model ever reads it.
  return (
    history
      // A scene that ended without a recap left only a note for the player (docs/SCENES.md), and a
      // recap set to "Keep out" promises she will not remember it.
      .filter((line) => {
        const scene = line.metadata?.scene as { kind?: unknown; reach?: unknown } | undefined;
        return (
          line.metadata?.deskNote !== true &&
          scene?.kind !== "ended" &&
          !(scene?.kind === "recap" && scene.reach === "none")
        );
      })
      .map((line) => {
        const speaker = sideSpeaker(line);
        const from = speaker ? protect(sideLabel(speaker)) : line.role === "creator" ? creatorLabel : viewerLabel;
        const toObject = line.role === "creator" ? viewerObject : creatorObject;
        const words = line.content?.trim() ? protect(line.content.trim()) : undefined;
        const image = input.image?.(line);
        const out = (event: string | undefined, text: string | undefined): SlurpDmTranscriptLine => ({
          from,
          ...(event ? { event } : {}),
          ...(text ? { text } : {}),
          ...(image ? { image } : {}),
          at: line.createdAt,
        });
        // A payment marker ("[unlocked one of your posts for 12 coins]") is stored as a text line from
        // the payer; it is an event, never the fan's words.
        const payment = line.metadata?.paymentReaction;
        if (typeof payment === "string" && payment in PAYMENT_EVENT) {
          const amount = Number(/(\d+)\s*coins/iu.exec(line.content)?.[1] ?? line.price) || 0;
          const whose = creatorSide ? "your" : `${input.creator.name}'s`;
          return out(PAYMENT_EVENT[payment as keyof typeof PAYMENT_EVENT](toObject, whose, amount), undefined);
        }
        // A roleplay scene (docs/SCENES.md): her invite is hers; the recap is what the two of them did.
        const scene = line.metadata?.scene as { kind?: unknown; pitch?: unknown; summary?: unknown } | undefined;
        if (scene?.kind === "invite" && typeof scene.pitch === "string")
          return out(`invited ${toObject} into a scene together`, protect(scene.pitch));
        if (scene?.kind === "recap" && typeof scene.summary === "string")
          return {
            from: "Slurp",
            event: `${creatorSide ? `You and ${input.viewer.name}` : `You and ${input.creator.name}`} spent time together in person. What happened: ${protect(scene.summary)}`,
            at: line.createdAt,
          };
        // An Offer from Slurp Support: what it offers, and the answer once there is one.
        const offer = line.metadata?.deskOffer as { summary?: unknown; status?: unknown } | undefined;
        if (offer && typeof offer.summary === "string") {
          const answered = typeof offer.status === "string" && offer.status !== "pending" ? ` (${offer.status})` : "";
          return out(`made an offer: ${protect(offer.summary)}${answered}`, words);
        }
        switch (line.kind) {
          case "tip":
            return out(`tipped ${toObject} ${line.price} coins`, words);
          case "ppv":
            return out(
              `sent ${toObject} locked content for ${line.price} coins (${line.unlockedAt ? "unlocked" : "still locked"})`,
              undefined,
            );
          case "broadcast":
            return out(
              `sent this to all ${creatorSide ? "your" : `${input.creator.name}'s`} subscribers at once, not only to ${viewerObject}`,
              words,
            );
          case "post_preview": {
            const title = protect(String(line.metadata?.title ?? line.content));
            const locked = line.metadata?.access === "locked";
            const owned = locked && input.postUnlocked?.(line.metadata?.postId);
            const whose = creatorSide ? "your" : `${input.creator.name}'s`;
            return out(
              `shared ${whose} post "${title}"${locked ? (owned ? `, a locked post ${viewerObject} already unlocked` : ", a locked post") : ""}`,
              undefined,
            );
          }
          case "commission_brief":
            return out(`asked ${toObject} for a commission`, words);
          case "commission_quote":
            return out(
              /stands/iu.test(line.content)
                ? `kept the commission price at ${line.price} coins`
                : `quoted ${line.price} coins for the commission`,
              undefined,
            );
          case "commission_delivery":
            return out(`delivered the finished commission to ${toObject}`, words);
          case "system": {
            const notice = protect(line.content.trim());
            // "Accepted the quote…", "Offered 30 coins…": the sender did it.
            if (/^(accepted|offered)\b/iu.test(notice)) return out(lowerFirst(notice), undefined);
            // Everything else is Slurp's own notice about the thread, named in the chat's own terms.
            return {
              from: "Slurp",
              event: notice
                .replace(/\bThe fan\b/gu, creatorSide ? input.viewer.name : "You")
                .replace(/\bThe Creator\b/gu, creatorSide ? "You" : input.creator.name),
              ...(image ? { image } : {}),
              at: line.createdAt,
            };
          }
          default:
            return out(undefined, words ?? "");
        }
      })
  );
}
