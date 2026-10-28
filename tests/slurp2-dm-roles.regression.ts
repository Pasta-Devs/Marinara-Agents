/**
 * 7b-m "message roles": every DM thread kind builds a role header and a transcript in which the model
 * can tell who it is, who it writes to, who wrote first, who said each line, and what was an event.
 * Runs the real builders on fixture threads; a few wiring pins at the end keep both prompts on them.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SLURP_SUPPORT_NAME,
  slurpDmRoleHeader,
  slurpDmTranscript,
  type SlurpDmLine,
  type SlurpDmRoleInput,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-roles.ts";
import { slpSceneThreadMessages } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/onboarding/slp-scene-thread.ts";

const mira = { name: "Mira Vale", handle: "miravale" };
const lena = { name: "Lena Hart", handle: "lenahart" };

let clock = Date.parse("2026-09-27T10:00:00.000Z");
let serial = 0;
function line(role: "viewer" | "creator", content: string, extra: Partial<SlurpDmLine> = {}): SlurpDmLine {
  clock += 60_000;
  serial += 1;
  return {
    id: `m${serial}`,
    role,
    kind: "text",
    content,
    price: 0,
    unlockedAt: null,
    metadata: {},
    createdAt: new Date(clock).toISOString(),
    ...extra,
  };
}

type Built = { header: string; lines: ReturnType<typeof slurpDmTranscript>; json: string };
function build(
  history: SlurpDmLine[],
  role: Partial<SlurpDmRoleInput> = {},
  extra: Parameters<typeof slurpDmTranscript>[1] extends infer T ? Partial<T> : never = {},
): Built {
  const input: SlurpDmRoleInput = { writer: "creator", creator: mira, viewer: lena, ...role };
  const header = slurpDmRoleHeader({ ...input, history });
  const lines = slurpDmTranscript(history, { ...input, ...extra });
  return { header, lines, json: JSON.stringify(lines) };
}

/** No line is ever "the fan", "you" alone, or a bracketed event posing as speech. */
function assertNamed(built: Built, writer: "creator" | "viewer" = "creator") {
  for (const entry of built.lines) {
    assert.ok(entry.from && entry.from !== "you" && entry.from !== "the fan", `named speaker: ${entry.from}`);
    assert.ok(!entry.text?.startsWith("["), `no bracketed event as speech: ${entry.text}`);
  }
  assert.ok(!/\bthe fan\b/u.test(built.header), "header names the person, not 'the fan'");
  assert.match(built.header, writer === "creator" ? /"you \(Mira Vale\)" is you/u : /"you \(Lena Hart\)" is you/u);
}

/** The side never flips: the writer's own lines are "you (Name)", the other side's carry their name. */
function assertSides(history: SlurpDmLine[], built: Built, writer: "creator" | "viewer") {
  history.forEach((message, index) => {
    const from = built.lines[index]!.from;
    if (from === "Slurp" || typeof message.metadata.sceneSpeaker === "string") return;
    const own = message.role === writer;
    const name = message.role === "creator" ? mira.name : lena.name;
    assert.equal(from, own ? `you (${name})` : name, `line ${index} side`);
  });
}

// 1. The player writes to a Creator (the player opened the thread).
{
  const history = [
    line("viewer", "your climbing post was unreal"),
    line("creator", "haha thank you, the wall was brutal"),
    line("viewer", "which gym was that?"),
  ];
  const built = build(history, { openedBy: "viewer" });
  assertNamed(built);
  assertSides(history, built, "creator");
  assert.match(
    built.header,
    /^You are Mira Vale \(@miravale\), a Creator on Slurp\. This is your private chat with Lena Hart \(@lenahart\)\./u,
  );
  assert.match(built.header, /Lena Hart is a fan writing to you\./u);
  assert.match(built.header, /Lena Hart wrote to you first\./u);
  assert.match(built.header, /Your message answers Lena Hart's newest message\./u);
  assert.match(built.header, /In the data, "creator" is you and "fan" is Lena Hart\./u);
  assert.deepEqual(built.lines[0], {
    from: "Lena Hart",
    text: "your climbing post was unreal",
    at: history[0]!.createdAt,
  });
}

// 2. The Creator wrote first (an opener to the player), then the player answered.
{
  const history = [
    line("creator", "hey, haven't seen you around in a while"),
    line("viewer", "busy week! missed this"),
  ];
  const built = build(history, { openedBy: "creator" });
  assertNamed(built);
  assertSides(history, built, "creator");
  assert.match(built.header, /You wrote to Lena Hart first\./u);
  assert.doesNotMatch(built.header, /Lena Hart wrote to you first/u);
  assert.match(built.header, /answers Lena Hart's newest message/u);
}

// 3. A fan writes to the player's own Creator: the model writes the player's Creator page, and the
//    fan's answer (fan-reply) is the same thread seen from the fan's seat. Neither side flips.
{
  const nova = { name: "Nova Rae", handle: "novarae" };
  const pete = { name: "Pixel Pete", handle: "pixelpete" };
  const history = [line("viewer", "love your stuff!!"), line("creator", "aw thank you pete")];
  history[0]!.metadata = {};
  const creatorSide = slurpDmRoleHeader({
    writer: "creator",
    creator: nova,
    viewer: pete,
    openedBy: "viewer",
    history,
  });
  assert.match(creatorSide, /^You are Nova Rae \(@novarae\)/u);
  assert.match(creatorSide, /Pixel Pete is a fan writing to you\./u);
  assert.match(creatorSide, /Pixel Pete wrote to you first\./u);
  assert.match(creatorSide, /The newest line is your own, and Pixel Pete has not answered it/u);
  const fanSide = slurpDmRoleHeader({ writer: "viewer", creator: nova, viewer: pete, openedBy: "viewer", history });
  assert.match(
    fanSide,
    /^You are Pixel Pete \(@pixelpete\), a fan on Slurp\. This is your private chat with Nova Rae \(@novarae\)/u,
  );
  assert.match(fanSide, /You wrote to Nova Rae first\./u);
  assert.match(fanSide, /Your message answers Nova Rae's newest message\./u);
  assert.match(fanSide, /In the data, "fan" is you and "creator" is Nova Rae\./u);
  const fanLines = slurpDmTranscript(history, { writer: "viewer", creator: nova, viewer: pete });
  assert.deepEqual(
    fanLines.map((entry) => entry.from),
    ["you (Pixel Pete)", "Nova Rae"],
  );
  const creatorLines = slurpDmTranscript(history, { writer: "creator", creator: nova, viewer: pete });
  assert.deepEqual(
    creatorLines.map((entry) => entry.from),
    ["Pixel Pete", "you (Nova Rae)"],
  );
}

// 4. Creator to Creator: the one writing runs an open Creator page of their own.
{
  const history = [line("viewer", "collab sometime? our audiences overlap a lot")];
  const built = build(history, { openedBy: "viewer", viewerPage: { name: "Lena Hart", handle: "lenalifts" } });
  assertNamed(built);
  assert.match(built.header, /Lena Hart runs a Creator page on Slurp too \(Lena Hart \(@lenalifts\)\)\./u);
  assert.match(
    built.header,
    /one Creator writing to another: talk to Lena Hart as a fellow Creator, not as a customer/u,
  );
  assert.doesNotMatch(built.header, /is a fan writing to you/u);
}

// 5. The kept sign-up chat (Slurp Support preset): host lines are Slurp Support's, not the fan's.
const signUpAt = new Date("2026-09-27T09:00:00.000Z");
const keptSupport = slpSceneThreadMessages({
  preset: "support",
  hostName: "Slurp Support",
  lines: [
    { speaker: "host", text: "Welcome to Slurp! What should your page be called?" },
    { speaker: "newcomer", text: "Velvet, I think" },
    { speaker: "host", text: "Love it. Anything you never want to show?" },
    { speaker: "newcomer", text: "no face pics, ever" },
  ],
  now: signUpAt,
}).map((message, index) => ({ ...line(message.role, message.content), ...message, id: `kept${index}` }));
{
  const history = [...keptSupport, line("viewer", "hi Velvet! just found your page")];
  const built = build(history, { openedBy: "creator" });
  assertNamed(built);
  assertSides(history, built, "creator");
  assert.equal(built.lines[0]!.from, "Slurp Support (during the sign-up)");
  assert.equal(built.lines[2]!.from, "Slurp Support (during the sign-up)");
  assert.equal(built.lines[1]!.from, "you (Mira Vale)");
  assert.match(built.header, /This chat began as your sign-up on Slurp/u);
  assert.match(
    built.header,
    /were said by Slurp Support, who helped with the sign-up\. Slurp Support is not in this chat any more; every other line on that side is Lena Hart\./u,
  );
  // The sign-up line replaces "who wrote first": the Creator-opened flag is not the Creator writing first.
  assert.doesNotMatch(built.header, /You wrote to Lena Hart first/u);
  assert.match(built.header, /answers Lena Hart's newest message/u);
}
// The Friend preset: the player hosted as themselves, so those lines are simply theirs.
{
  const keptFriend = slpSceneThreadMessages({
    preset: "friend",
    hostName: "",
    lines: [
      { speaker: "host", text: "ok first: what's your name gonna be" },
      { speaker: "newcomer", text: "Velvet" },
    ],
    now: signUpAt,
  }).map((message, index) => ({ ...line(message.role, message.content), ...message, id: `friend${index}` }));
  const built = build(keptFriend, { openedBy: "creator" });
  assert.equal(built.lines[0]!.from, "Lena Hart");
  assert.match(built.header, /This chat began as your sign-up/u);
  assert.doesNotMatch(built.header, /during the sign-up/u);
}

// 6. The player writes as Slurp Support (in-universe staff). The Creator answers Support, never the
//    persona; Support is a faceless team, always "Slurp Support".
{
  const supportLine = (text: string) =>
    line("viewer", text, { metadata: { sceneSpeaker: SLURP_SUPPORT_NAME, supportVoice: true } });

  // In the continuous thread: sign-up, then Support writes again later.
  const history = [...keptSupport, supportLine("Quick check-in from Support: how is your first week going?")];
  const built = build(history, { openedBy: "creator" });
  assertNamed(built);
  assert.equal(built.lines.at(-1)!.from, "Slurp Support (Slurp staff)");
  assert.equal(built.lines.at(-1)!.text, "Quick check-in from Support: how is your first week going?");
  assert.match(built.header, /Slurp Support is Slurp's own staff team\./u);
  assert.match(
    built.header,
    /Slurp Support is not Lena Hart and not a fan, and nothing Slurp Support says is a fact about Lena Hart\./u,
  );
  assert.match(
    built.header,
    /Right now Slurp Support is writing to you, not Lena Hart\. Your message answers Slurp Support: talk to Slurp's staff as Mira Vale would, and do not address Lena Hart\./u,
  );
  assert.doesNotMatch(built.header, /answers Lena Hart's newest message/u);
  // Support is still present, so the sign-up note must not say Support left.
  assert.doesNotMatch(built.header, /Slurp Support is not in this chat any more/u);

  // A fresh Support thread (the server opens it on the Creator side, fee-free): Support wrote first.
  const fresh = [supportLine("Hi Mira, Slurp Support here. We loved your last set.")];
  const freshBuilt = build(fresh, { openedBy: "creator" });
  assert.match(freshBuilt.header, /Slurp Support wrote to you first\./u);
  assert.doesNotMatch(freshBuilt.header, /You wrote to Lena Hart first/u);
  assert.match(freshBuilt.header, /Right now Slurp Support is writing to you/u);

  // Back to the persona: the next turn answers the persona again, and Support stays labelled.
  const back = [...history, line("creator", "honestly great, thank you!"), line("viewer", "hey it's Lena, big fan")];
  const backBuilt = build(back, { openedBy: "creator" });
  assertSides(back, backBuilt, "creator");
  assert.match(backBuilt.header, /Your message answers Lena Hart's newest message\./u);
  assert.doesNotMatch(backBuilt.header, /Right now Slurp Support is writing/u);
  assert.equal(backBuilt.lines.at(-1)!.from, "Lena Hart");
}

// 7. A reply to a broadcast: the Creator's first line went to every subscriber, not to this fan.
{
  const history = [
    line("creator", "new set drops tonight, subscribers first 💜", { kind: "broadcast" }),
    line("viewer", "can't wait!!"),
  ];
  const built = build(history, { openedBy: "creator" });
  assertNamed(built);
  assert.deepEqual(built.lines[0], {
    from: "you (Mira Vale)",
    event: "sent this to all your subscribers at once, not only to Lena Hart",
    text: "new set drops tonight, subscribers first 💜",
    at: history[0]!.createdAt,
  });
  assert.match(built.header, /a message sent to all subscribers/u);
  const fan = slurpDmTranscript(history, { writer: "viewer", creator: mira, viewer: lena });
  assert.equal(fan[0]!.event, "sent this to all Mira Vale's subscribers at once, not only to you");
  assert.equal(fan[0]!.from, "Mira Vale");
}

// 8. A commission, step by step: every step an event, never the fan or the Creator "saying" a notice.
{
  const history = [
    line("viewer", "could you draw my cat as a knight?", { kind: "commission_brief" }),
    line("creator", "Commission quote: 40 coins", { kind: "commission_quote", price: 40 }),
    line("viewer", "Offered 30 coins instead of 40.", { kind: "system" }),
    line("creator", "My price stands at 40 coins.", { kind: "commission_quote", price: 40 }),
    line("viewer", "Accepted the quote and paid 40 coins.", { kind: "system" }),
    line("creator", "here's your knight, Sir Whiskers 🗡️", { kind: "commission_delivery" }),
    line("viewer", "The fan cancelled this commission. The payment was refunded.", { kind: "system" }),
    line("creator", "The Creator declined this commission.", { kind: "system" }),
    line("creator", "This commission could not be delivered.", { kind: "system" }),
  ];
  const built = build(history, { openedBy: "viewer" });
  assertNamed(built);
  const view = built.lines.map(({ from, event, text }) => ({ from, event, text }));
  assert.deepEqual(view, [
    { from: "Lena Hart", event: "asked you for a commission", text: "could you draw my cat as a knight?" },
    { from: "you (Mira Vale)", event: "quoted 40 coins for the commission", text: undefined },
    { from: "Lena Hart", event: "offered 30 coins instead of 40.", text: undefined },
    { from: "you (Mira Vale)", event: "kept the commission price at 40 coins", text: undefined },
    { from: "Lena Hart", event: "accepted the quote and paid 40 coins.", text: undefined },
    {
      from: "you (Mira Vale)",
      event: "delivered the finished commission to Lena Hart",
      text: "here's your knight, Sir Whiskers 🗡️",
    },
    { from: "Slurp", event: "Lena Hart cancelled this commission. The payment was refunded.", text: undefined },
    { from: "Slurp", event: "You declined this commission.", text: undefined },
    { from: "Slurp", event: "This commission could not be delivered.", text: undefined },
  ]);
  // From the fan's seat the same notices name the Creator and "you" the other way round.
  const fan = slurpDmTranscript(history, { writer: "viewer", creator: mira, viewer: lena });
  assert.equal(fan[0]!.from, "you (Lena Hart)");
  assert.equal(fan[0]!.event, "asked Mira Vale for a commission");
  assert.equal(fan[6]!.event, "You cancelled this commission. The payment was refunded.");
  assert.equal(fan[7]!.event, "Mira Vale declined this commission.");
}

// 9. Tips, PPV and shared posts are events with the actor named.
{
  const history = [
    line("viewer", "for the gym post", { kind: "tip", price: 50 }),
    line("creator", "", { kind: "ppv", price: 30, unlockedAt: "2026-09-27T11:00:00.000Z" }),
    line("creator", "Leg day", { kind: "ppv", price: 20 }),
    line("creator", "Sunset set", {
      kind: "post_preview",
      metadata: { title: "Sunset set", access: "locked", postId: "p1" },
    }),
    line("viewer", "Morning run", {
      kind: "post_preview",
      metadata: { title: "Morning run", access: "public", postId: "p2" },
    }),
  ];
  const built = build(history, { openedBy: "viewer" }, { postUnlocked: (postId) => postId === "p1" });
  assertNamed(built);
  const view = built.lines.map(({ from, event, text }) => ({ from, event, text }));
  assert.deepEqual(view, [
    { from: "Lena Hart", event: "tipped you 50 coins", text: "for the gym post" },
    { from: "you (Mira Vale)", event: "sent Lena Hart locked content for 30 coins (unlocked)", text: undefined },
    { from: "you (Mira Vale)", event: "sent Lena Hart locked content for 20 coins (still locked)", text: undefined },
    {
      from: "you (Mira Vale)",
      event: 'shared your post "Sunset set", a locked post Lena Hart already unlocked',
      text: undefined,
    },
    { from: "Lena Hart", event: 'shared your post "Morning run"', text: undefined },
  ]);
  const fan = slurpDmTranscript(history, { writer: "viewer", creator: mira, viewer: lena });
  assert.equal(fan[0]!.event, "tipped Mira Vale 50 coins");
  assert.equal(fan[1]!.event, "sent you locked content for 30 coins (unlocked)");
}

// 10. A paid first message that the Creator has not answered yet.
{
  const history = [line("viewer", "hi! been following since your first post")];
  const built = build(history, { openedBy: "viewer", requestFee: 25, isRequest: true });
  assert.match(built.header, /Lena Hart wrote to you first and paid 25 coins to send that first message\./u);
  assert.match(built.header, /You have not answered Lena Hart yet: this is still a message request\./u);
  // Without a fee the sentence stays plain.
  assert.match(build(history, { openedBy: "viewer" }).header, /Lena Hart wrote to you first\./u);
}

// 11. A follow-up after the Creator's own message must not answer itself.
{
  const history = [line("viewer", "good luck at the shoot!"), line("creator", "thank you!! will tell you how it went")];
  const built = build(history, { openedBy: "viewer" });
  assert.match(
    built.header,
    /The newest line is your own, and Lena Hart has not answered it\. Your message follows up on it; it does not answer yourself\./u,
  );
  assert.equal(
    build([], { openedBy: null }).header.includes(
      "Nothing has been said yet. You write the first message to Lena Hart.",
    ),
    true,
  );
}

// 12. Identity protection reaches every line's words and speaker labels.
{
  const protect = (value: string) => value.replaceAll("Mira", "M.");
  const history = [
    line("viewer", "Mira you are the best"),
    line("viewer", "x", { metadata: { sceneSpeaker: "Mira's helper" } }),
  ];
  const built = build(history, { openedBy: "viewer" }, { protect });
  assert.ok(!built.lines.some((entry) => `${entry.text ?? ""}${entry.from}`.includes("Mira")), "protected");
}

// Wiring: both DM prompts use these builders, and "write as Slurp Support" reaches the store.
{
  const root = join(fileURLToPath(new URL("..", import.meta.url)), "packages/slurp2/src/engine/packages");
  const read = (path: string) => readFileSync(join(root, path), "utf8");
  const dm = read("server/src/slp/features/messages/slp-message-generation-service.ts");
  assert.match(dm, /# This chat\\n\$\{roleHeader\}/u);
  assert.match(dm, /conversation: slurpDmTranscript\(/u);
  assert.match(dm, /openedBy: thread\?\.openedBy/u);
  assert.doesNotMatch(dm, /"the fan"/u, "no line is labelled 'the fan' any more");
  const fanReply = read("server/src/slp/features/messages/slp-fan-reply-service.ts");
  assert.match(fanReply, /writer: "viewer"/u);
  assert.match(fanReply, /conversation: slurpDmTranscript\(history/u);
  const store = read("server/src/slp/data/messages/slp-messages-storage-actions.ts");
  // Support is a faceless team: every live Support line is "Slurp Support".
  assert.match(store, /sceneSpeaker: SLURP_SUPPORT_NAME/u);
  assert.match(store, /supportVoice: true/u);
  assert.match(
    read("server/src/slp/features/messages/slp-message-operation.ts"),
    /if \(stored && trigger\.metadata\?\.supportVoice !== true\) \{\s+await messagesStore\s+\.recordReplyOutcome/u,
    "a reply to Support leaves the fan's mood, memories and relationship alone",
  );
  assert.match(
    read("server/src/slp/features/messages/slp-messages-send-routes.ts"),
    /asSupport: parsed\.data\.asSupport === true/u,
  );
  assert.match(read("client/src/slp/features/messages/SlpMessages.tsx"), /startAsSupport=\{startAsSupport\}/u);
  // 0.3.6: a persona chat can switch to Support; Support's own thread is a console with no way back.
  const header = read("client/src/slp/features/messages/SlpThreadHeader.tsx");
  assert.match(header, /setSupportChoice\(true\)/u);
  assert.match(header, /const canSwitchVoice = Boolean\([^)]*&& !asSupport\);/u);
}

// 7c M-001. Payment markers (the exact strings `reactToSlurpPayment` stores as the payer's text line)
// are events, never the fan's words, from both seats.
{
  const marker = (kind: string, content: string) => line("viewer", content, { metadata: { paymentReaction: kind } });
  const history = [
    line("viewer", "love the new set"),
    marker("unlock", "[unlocked one of your posts for 12 coins]"),
    marker("tip", "[tipped 40 coins on your profile]"),
    marker("ppv", "[unlocked your locked photo for 18 coins]"),
    marker("commission", "[paid 30 coins for a commission]"),
    marker("unlock", "[unlocked one of your posts]"),
  ];
  const built = build(history, { openedBy: "viewer" });
  assertNamed(built);
  assert.ok(!/"\[/u.test(built.json), "no bracketed marker reaches the model");
  assert.deepEqual(
    built.lines.slice(1).map(({ from, event, text }) => ({ from, event, text })),
    [
      { from: "Lena Hart", event: "unlocked one of your posts for 12 coins", text: undefined },
      { from: "Lena Hart", event: "tipped you 40 coins on your profile", text: undefined },
      { from: "Lena Hart", event: "unlocked your locked photo for 18 coins", text: undefined },
      { from: "Lena Hart", event: "paid 30 coins for the commission", text: undefined },
      { from: "Lena Hart", event: "unlocked one of your posts", text: undefined },
    ],
  );
  const fan = slurpDmTranscript(history, { writer: "viewer", creator: mira, viewer: lena });
  assert.deepEqual(
    fan.slice(1, 5).map(({ from, event, text }) => ({ from, event, text })),
    [
      { from: "you (Lena Hart)", event: "unlocked one of Mira Vale's posts for 12 coins", text: undefined },
      { from: "you (Lena Hart)", event: "tipped Mira Vale 40 coins on Mira Vale's profile", text: undefined },
      { from: "you (Lena Hart)", event: "unlocked Mira Vale's locked photo for 18 coins", text: undefined },
      { from: "you (Lena Hart)", event: "paid 30 coins for the commission", text: undefined },
    ],
  );
  // A plain text line that happens to start with a bracket stays speech.
  assert.equal(build([line("viewer", "[waves]")]).lines[0]!.text, "[waves]");
}

console.log("slurp2 dm roles regression passed");
