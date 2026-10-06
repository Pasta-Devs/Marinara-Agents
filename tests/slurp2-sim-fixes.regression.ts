/**
 * Task G: fixes from the 7-day text simulation (`SIM-REPORT.md`, findings F1–F14).
 * One block per fix; each reproduces the simulated failure with the real module.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { slurpPickCreatorForSlot } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-posting-interval.ts";
import {
  slurpArtStyle,
  slurpStyledImagePrompt,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";
import {
  parseSlpAppearanceCandidate,
  slpAppearanceFallback,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-appearance-profile.ts";
import { compileSlurpFlavourBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-flavour.ts";
import {
  slurpCouplePageOpenable,
  slurpSetUpCouple,
  type SlurpCouple,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import { slurpCreatorCheckIn } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-world.ts";
import { resolveSlurpStance } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-stance.ts";
import { resolveSlurpMediaOffer } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-media-offer.ts";
import { formatFollowUpContext } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-follow-up.ts";
import {
  SLURP_CAMERA_SOURCES,
  slurpPostCameraSource,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import {
  slpSettleAdaptive,
  slpWithProviderRetry,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/model/slp-provider-retry.ts";
import {
  LEGACY_SLURP_DISCOVERY_TAG_SEED,
  SLURP_DISCOVERY_TAG_SEED,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/discovery/slp-discovery-profile.ts";

const root = new URL("../packages/slurp2/src/engine/packages/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

// --- F1 slot fairness: every Creator holds a slot ahead, so the wait used to clamp to 0 for all of
// them and the id tie-break gave the lowest id every spare slot (Diane 50 of 93 posts in the sim).
{
  const HOUR = 3_600_000;
  const ids = ["-XXAdiane", "-tX3vaelith", "juniper", "kodiak", "marcus", "miku", "raven", "elsie"];
  const start = Date.parse("2026-09-29T00:00:00Z");
  // Each Creator already holds one slot within the next 24 h, like the reserve after day 1.
  const activity = new Map(ids.map((id, index) => [id, start + (index + 1) * 3 * HOUR]));
  const counts = new Map(ids.map((id) => [id, 0]));
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // 16 slots a day for 7 days, each laid down 24 h ahead of the poll that creates it.
  for (let slot = 0; slot < 16 * 7; slot += 1) {
    const at = start + slot * 1.5 * HOUR;
    const picked = slurpPickCreatorForSlot(
      ids.map((id) => ({ id })),
      (candidate) => activity.get(candidate.id)!,
      () => 1,
      at,
      random,
    )!;
    activity.set(picked.id, at + 24 * HOUR);
    counts.set(picked.id, counts.get(picked.id)! + 1);
  }
  const spread = [...counts.values()];
  assert.ok(Math.max(...spread) - Math.min(...spread) <= 1, `slots rotate fairly: ${JSON.stringify([...counts])}`);

  // Pace still matters with future slots: the busier Creator gets the slot over an equal one.
  const at = start;
  const pick = slurpPickCreatorForSlot(
    [
      { id: "a", pace: 1 },
      { id: "b", pace: 2 },
    ],
    () => at + 6 * HOUR,
    (candidate) => candidate.pace,
    at,
  );
  assert.equal(pick?.id, "b", "a busier Creator wins a tie on held future slots");

  // Real ties are not broken by id: both sides win with some random draw.
  const winners = new Set(
    [0, 0.99].map(
      (value) =>
        slurpPickCreatorForSlot(
          [{ id: "a" }, { id: "b" }],
          () => 0,
          () => 1,
          at,
          () => value,
        )?.id,
    ),
  );
  assert.deepEqual([...winners].sort(), ["a", "b"], "never-posted ties go to either Creator");
}

// --- F5 art style kept: an anime, furry or dragon Creator is drawn, not photographed.
{
  const anime =
    "young woman drawn in bright 2000s shoujo anime style, cel-shaded, huge sparkly violet eyes, pastel-pink twin tails";
  const fox = "Juniper Vale is an anthro red fox woman, 26. Digitigrade legs, russet-orange fur, huge fluffy tail.";
  const dragon =
    "Vaelith is an anthro dragon: crimson scales, two swept-back ivory horns, leathery wings, a long tail.";
  const goth =
    "Raven Nyx is a 23-year-old human woman goth e-girl, pale skin, black lipstick, a dragon tattoo on her arm.";
  // The code-built part of a sim prompt, verbatim.
  const brief =
    "posing for the post, relaxed half-smile\nfull body, from front, self-timer photo from a nearby surface at chest height, hands free, fixed slightly wide framing, observational personal photograph, available light and unembellished framing, casual and unedited, taken on the first attempt\nThe only person in the photo.";
  assert.match(slurpArtStyle(anime)?.tag ?? "", /anime illustration/u);
  assert.match(slurpArtStyle(fox)?.tag ?? "", /anthro furry art/u);
  assert.match(slurpArtStyle(dragon)?.tag ?? "", /anthro furry art/u);
  assert.equal(slurpArtStyle(goth), null, "a human with a dragon tattoo is a photo-style Creator");
  assert.equal(slurpArtStyle(`${fox} Photorealistic.`), null, "a card that asks for photo realism keeps it");
  assert.match(slurpArtStyle(fox)?.negative ?? "", /fursuit/u);
  for (const look of [anime, fox, dragon]) {
    const styled = slurpStyledImagePrompt(`${look}\n${brief}`, look);
    assert.ok(styled.startsWith(slurpArtStyle(look)!.tag), `style leads: ${styled.slice(0, 60)}`);
    assert.doesNotMatch(
      styled,
      /\bphoto(?:graph)?s?\b|personal snapshot|available light|self-timer|unedited/iu,
      `no photo words for a drawn Creator: ${styled}`,
    );
    assert.match(styled, /full body, from front/u, "the framing survives");
    assert.match(styled, /The only person in the picture\./u);
    assert.doesNotMatch(styled, /,\s*[,;.]|,\s*$/mu, `no empty list parts left behind: ${styled}`);
  }
  assert.equal(
    slurpArtStyle(anime)?.tag,
    "anime illustration, cel-shaded, 2D",
    "no generic tag beside the specific one",
  );
  assert.equal(slurpStyledImagePrompt(`${goth}\n${brief}`, goth), `${goth}\n${brief}`, "photo Creators unchanged");
  const service = read("server/src/slp/features/media/slp-images-service.ts");
  // 0.3.5: the known character's name leads before the style is applied (finalPromptSubject).
  assert.match(service, /slurpStyledImagePrompt\(finalPromptSubject, styleSource\)/u, "every picture path is styled");
  assert.match(service, /artStyle\?\.negative/u, "the negative prompt keeps photo and fursuit out");
}

// --- F13 discovery tags for non-human and drawn Creators; an untouched install gains them.
{
  const seed = SLURP_DISCOVERY_TAG_SEED.map((entry) => entry.tag);
  for (const tag of ["anime", "anthro", "furry", "scalie", "dragon", "monster"])
    assert.ok(seed.includes(tag), `${tag} is a default Discover tag`);
  assert.equal(LEGACY_SLURP_DISCOVERY_TAG_SEED.length, 22, "the legacy seed is the 0.2.78 list");
  assert.ok(!LEGACY_SLURP_DISCOVERY_TAG_SEED.some((entry) => entry.tag === "furry"));
  // The settings module needs the Engine host; its migration is checked as source.
  assert.match(
    read("server/src/slp/modules/settings/slp-settings.ts"),
    /JSON\.stringify\(rawRecord\.discoveryTags\) === JSON\.stringify\(LEGACY_SLURP_DISCOVERY_TAG_SEED\)\s*\? DEFAULT_SLURP_SETTINGS\.discoveryTags\s*: \(rawRecord\.discoveryTags \?\? DEFAULT_SLURP_SETTINGS\.discoveryTags\)/u,
    "only an untouched tag list gains the new group",
  );
  assert.match(read("client/src/slp/features/discovery/slp-discovery.ts"), /id: "look"/u);
}

// --- F4 appearance: a true card quote is enough, and a failed extraction still leaves a look.
{
  const raven =
    "Raven Nyx is a 23-year-old human woman goth e-girl. Pale skin, black lipstick, a dyed black bob and a silver septum ring. She streams horror games at night.";
  const answer = (appearance: string, evidence: string) => JSON.stringify({ appearance, evidence, confidence: "high" });
  // The sim's rejected pair: the quote is verbatim, but shares no word of four letters with the look.
  const look = "Pale skin, black lipstick, dyed black bob, silver septum ring";
  const parsed = parseSlpAppearanceCandidate(answer(look, "is a 23-year-old human woman goth e-girl"), raven, false);
  assert.equal(parsed?.text, look, "a verbatim quote is accepted");
  assert.equal(parsed?.confidence, "medium", "without a shared word it is not high confidence");
  assert.ok(
    parseSlpAppearanceCandidate(
      answer(look, "Raven Nyx is a 23\u2011year\u2011old human woman goth e\u2011girl."),
      raven,
      false,
    ),
    "a copy with other hyphens and a full stop is still the quote",
  );
  assert.equal(
    parseSlpAppearanceCandidate(answer(look, "has green hair"), raven, false),
    null,
    "an invented quote is not",
  );

  const dragon =
    "Vaelith is a dragon, 34 in human-equivalent years, who lives as an anthro dragon: tall, broad, covered in obsidian-black scales that shade to molten gold on the underbelly, two swept-back ivory horns, leathery wings with a ten-foot span (folded most of the time because doorways), a long thick tail with a spade tip, slit-pupil gold eyes, claws he files blunt for his phone. Lives in a converted mountain observatory. Hoards vintage fountain pens.";
  const fallback = slpAppearanceFallback(dragon) ?? "";
  for (const part of ["scales", "horns", "wings", "tail", "claws"]) assert.match(fallback, new RegExp(part, "u"));
  assert.doesNotMatch(fallback, /fountain pens/u, "the fallback keeps body sentences only");
  assert.equal(slpAppearanceFallback("Loves jazz. Runs a bakery. Hates Mondays."), "Loves jazz. Runs a bakery.");
  assert.equal(slpAppearanceFallback(""), null);

  const service = read("server/src/slp/features/media/slp-appearance-service.ts");
  assert.match(service, /const fallback = slpAppearanceFallback\(sourceText\)/u);
  assert.match(service, /if \(!response\) return fallback!;/u, "a failed call still returns a look");
  assert.match(
    service,
    /return save\(\{ text: fallback, source: "description", confidence: "medium" \}\);/u,
    "an unusable answer is saved once, so the next post does not ask again",
  );

  // F6 the brief keeps the whole anatomy sentence.
  const brief = compileSlurpFlavourBrief(
    {
      accountId: "dragon",
      name: "Vaelith",
      card: { description: dragon },
      anchors: null,
      ownLines: [],
      steering: null,
    } as never,
    { use: "post", sequence: 0 },
  );
  for (const part of ["wings", "tail", "claws", "gold eyes"])
    assert.match(brief.text, new RegExp(part, "u"), `the brief keeps ${part}`);
}

// --- F8 couples on the cards: the player's set-up starts together, and their shared page can open.
{
  const tie = (id: string, name: string, text: string, cardPartners: string[] = []) => ({
    id,
    name,
    text,
    tags: ["furry", "anthro"],
    automatic: true,
    followers: 100,
    gender: id === "kodiak" ? ("male" as const) : ("female" as const),
    cardPartners,
  });
  const juniper = tie("juniper", "Juniper Vale", "An anthro red fox who DJs.", ["Kodiak Frost"]);
  const kodiak = tie("kodiak", "Kodiak Frost", "An anthro grey wolf, two years with Juniper.", ["Juniper Vale"]);
  const at = new Date("2026-09-29T08:00:00Z");
  const couples = slurpSetUpCouple([], juniper, kodiak, { at, id: "c1" }) as SlurpCouple[];
  assert.ok(Array.isArray(couples));
  assert.equal(couples[0]!.stage, "together", "partners on the cards are together, not sparks");
  assert.equal(couples[0]!.togetherAt, at.toISOString());
  assert.ok(slurpCouplePageOpenable(couples[0]!), "their shared page can open (no 409)");
  // Right after sign-up there are no anchors yet: the card's own words count (the 7-day sim's case).
  const wolfText = tie(
    "kodiak",
    "Kodiak Frost",
    "Ice-hockey goalie in Winnipeg. Dating Juniper Vale (the fox) for two years; they film couple content together.",
  );
  const fresh = slurpSetUpCouple([], tie("juniper", "Juniper Vale", "An anthro red fox who DJs."), wolfText, {
    at,
    id: "c3",
  }) as SlurpCouple[];
  assert.equal(fresh[0]!.stage, "together", "a card that says they are dating starts them together");
  const colleague = slurpSetUpCouple(
    [],
    tie("a", "Ada", "Painter."),
    tie("kodiak", "Bo", "Works together with Ada at the studio, her business partner."),
    { at, id: "c4" },
  ) as SlurpCouple[];
  assert.equal(colleague[0]!.stage, "sparks", "working together is not a relationship");
  // Strangers the player sets up still start with sparks.
  const strangers = slurpSetUpCouple([], tie("a", "Ada", "Painter."), tie("kodiak", "Bo", "Baker."), {
    at,
    id: "c2",
  }) as SlurpCouple[];
  assert.equal(strangers[0]!.stage, "sparks");
  assert.ok(!slurpCouplePageOpenable(strangers[0]!));
}

// --- F3 the OnlyFans feel in DMs: Creators write first in quiet chats, and delayed replies may draw.
{
  const base = { stage: "subscriber", hoursQuiet: 26, needsReply: false, pending: false, roll: 0.1, pick: 0.3 };
  assert.ok(slurpCreatorCheckIn(base), "a quiet subscriber chat gets a Creator-first message on a lucky day");
  assert.equal(slurpCreatorCheckIn({ ...base, roll: 0.9 }), null, "not every day");
  assert.equal(slurpCreatorCheckIn({ ...base, needsReply: true }), null, "the fan's answer comes first");
  assert.equal(slurpCreatorCheckIn({ ...base, pending: true }), null, "one planned message at a time");
  assert.equal(slurpCreatorCheckIn({ ...base, hoursQuiet: 3 }), null, "only a quiet chat");
  assert.equal(slurpCreatorCheckIn({ ...base, stage: "stranger" }), null);
  assert.ok(slurpCreatorCheckIn({ ...base, stage: "follower", hoursQuiet: 40, roll: 0.05 }), "followers now and then");
  // About a third of quiet days for a subscriber, over a year of day rolls.
  let days = 0;
  for (let day = 0; day < 365; day += 1)
    if (slurpCreatorCheckIn({ ...base, roll: ((day * 7919) % 365) / 365 })) days += 1;
  assert.ok(days > 100 && days < 150, `about one quiet day in three (${days}/365)`);
  const opener = formatFollowUpContext(
    { id: "f", scheduledAt: "", type: "opener", reason: "Ask what they want to see next.", context: "" },
    undefined,
  );
  assert.doesNotMatch(opener, /promised a/u, "an opener claims no promise");
  assert.match(opener, /writing first/u);
  assert.match(read("server/src/slp/features/world/slp-world-operation.ts"), /planSlurpCreatorCheckIn\(input\)/u);
  const checkIn = read("server/src/slp/features/world/slp-creator-check-in.ts");
  assert.match(checkIn, /slurpCreatorCheckIn\(/u);
  assert.match(checkIn, /type: "opener",/u, "the check-in goes through the follow-up writer");
  assert.match(checkIn, /await input\.isPlayer\(tie\.memberId\)/u, "only the player's personas get one");
  assert.match(
    read("server/src/slp/data/messages/slp-messages-storage-conversation.ts"),
    /inArray\(slurpFollowUps\.type, \["check_in", "opener"\]\)/u,
    "the player writing first cancels a planned opener",
  );
  const operation = read("server/src/slp/features/messages/slp-message-operation.ts");
  const gate = operation.slice(operation.indexOf("reply.image &&"), operation.indexOf("const imageAllowedBySettings"));
  assert.doesNotMatch(gate, /input\.background/u, "a delayed reply to the player may draw a picture or a PPV");

  // The real gate the sim found: pictures only from "warm" on and never priced, so a week of chats
  // had none. Now an acquaintance may get one, as a PPV; a guarded stranger still gets none.
  const stance = (rapportTier: "stranger" | "acquaintance" | "regular") =>
    resolveSlurpStance({
      rapportTier,
      rapportScore: 20,
      moodTone: "neutral",
      audienceArc: null,
      dayVibe: null,
      availability: { online: true, activity: null },
      subscribed: true,
      isRequest: false,
      tone: "warm",
      coolingOff: false,
      strikes: 0,
    } as never);
  assert.equal(stance("acquaintance").canSendImage, true, "an acquaintance may get a DM picture");
  assert.equal(stance("stranger").canSendImage, false, "a guarded stranger does not");
  const offer = (rapportTier: "acquaintance" | "regular" | "whale") =>
    resolveSlurpMediaOffer({ intent: "friendly", rapportTier, subscribed: true, configuredPrice: 30 });
  assert.deepEqual(offer("acquaintance"), { visibility: "locked", price: 30, reason: "creator_choice" }, "sold as PPV");
  assert.equal(offer("regular").price, 0, "a regular still gets it free");
  assert.equal(offer("whale").price, 0);

  // F12 timer shots: no camera takes more than about a quarter of the feed.
  const intents = ["set", "teaser", "callback", "behind_the_scenes", "business", "casual", "appreciation", "casual"];
  const efforts = ["low", "medium", "medium", "high"];
  const counts = new Map<string, number>();
  for (let creator = 0; creator < 8; creator += 1)
    for (let post = 0; post < 300; post += 1) {
      const source = slurpPostCameraSource(`creator-${creator}`, post, {
        companyCanHoldCamera: post % 4 === 0,
        intent: intents[(post * 7 + creator) % intents.length],
        effort: efforts[(post * 3 + creator) % efforts.length],
      });
      counts.set(source, (counts.get(source) ?? 0) + 1);
    }
  for (const source of SLURP_CAMERA_SOURCES)
    assert.ok((counts.get(source) ?? 0) / 2400 <= 0.27, `${source} at most ~25 %: ${JSON.stringify([...counts])}`);
}

// --- G6 a post sent into a chat (by any sender) is a real mini post card.
{
  const card = read("client/src/slp/features/messages/SlpSharedPostCard.tsx");
  const bubble = read("client/src/slp/features/messages/SlpMessageBubble.tsx");
  const postBranch = bubble.slice(
    bubble.indexOf('if (message.kind === "post_preview")'),
    bubble.indexOf('if (message.kind === "broadcast")'),
  );
  assert.match(postBranch, /<SlpSharedPostCard/u, "every post_preview renders the card, whoever sent it");
  assert.doesNotMatch(postBranch, /role === "creator"|role === "viewer"/u, "no sender kind is left out");
  assert.match(
    card,
    /\/api\/slurp2\/noodler\/posts\/\$\{encodeURIComponent\(postId\)\}\/media/u,
    "the picture comes from the post",
  );
  assert.match(
    card,
    /personaId=\$\{encodeURIComponent\(personaId\)\}/u,
    "a reader's picture is access-checked (teaser when locked)",
  );
  assert.match(card, /\{\.\.\.slpImgFade\}/u, "the picture fades in");
  assert.match(card, /<SlpLockedMediaTile/u, "a locked post shows the locked tile");
  assert.match(card, /unlock\.mutateAsync\(\{ personaId, postId \}\)/u, "and unlocks in place");
  assert.match(card, /slpShowPostInPlace\(postId\)[\s\S]*onOpenProfile\(authorId\)/u, "tap opens the post");
  assert.match(
    read("client/src/slp/features/messages/SlpThreadView.tsx"),
    /openProfileRef\.current = model\.onOpenProfile;[\s\S]*?onOpenProfile=\{openProfile\}/u,
  );
  assert.match(read("client/src/slp/features/feed/slp-feed-contract.ts"), /export \{ useUnlockCreatorPost \}/u);
  for (const path of [
    "server/src/slp/features/messages/slp-message-operation.ts",
    "server/src/slp/features/messages/slp-messages-send-routes.ts",
  ]) {
    const source = read(path);
    assert.match(source, /authorAccountId:/u, `${path}: the card knows whose post it is`);
    assert.match(source, /price: slpCreatorUnlockPriceFromMetadata\(/u, `${path}: and what unlocking costs`);
  }
  for (const locale of ["en", "de", "ko", "pl"]) {
    const keys = JSON.parse(read(`client/src/slp/locales/${locale}.json`)) as Record<string, string>;
    assert.ok(keys["ui.slurp.messages.openSharedPost"] && keys["ui.slurp.messages.seeSharedPost"], locale);
  }
}

// --- G7 no cropped mark beside the Creator's avatar on Story tiles (the feed keeps it).
{
  const entry = read("client/src/slp/slp-client-entry.tsx");
  assert.match(entry, /\[data-slp-no-crop-mark\] :has\(> img\.slp-crop\[data-slp-cut\]\)::after \{ content: none; \}/u);
  assert.match(read("client/src/slp/modules/story/SlpStoryTile.tsx"), /data-slp-no-crop-mark=""/u);
  assert.match(entry, /^\s*:has\(> img\.slp-crop\[data-slp-cut\]\)::after \{/mu, "other previews keep the mark");
}

// --- G8 (from A): every Slurp model call waits out 429 / EAI_AGAIN / ENOTFOUND; bulk sign-up adapts.
async function g8() {
  const quick = { delaysMs: [1, 1, 1], sleep: () => Promise.resolve() };
  class Provider {
    #calls = 0;
    readonly label = "real";
    async chatComplete(prompt: string) {
      this.#calls += 1;
      if (this.#calls === 1) throw new Error("OpenAI-compatible API error 429: slow down");
      if (this.#calls === 2) throw Object.assign(new Error("fetch failed"), { cause: { code: "EAI_AGAIN" } });
      return `ok:${prompt}`;
    }
    calls() {
      return this.#calls;
    }
  }
  const real = new Provider();
  const wrapped = slpWithProviderRetry(real, quick);
  assert.equal(await wrapped.chatComplete("hi"), "ok:hi", "a 429 and a DNS hiccup are waited out");
  assert.equal(real.calls(), 3);
  assert.equal(wrapped.label, "real", "other fields still come from the provider");
  // The host hands out providers whose chatComplete is read-only (the 7-day sim lost every post to it).
  const frozen = Object.freeze({ chatComplete: async () => "host" });
  assert.equal(
    await slpWithProviderRetry(frozen, quick).chatComplete(),
    "host",
    "a read-only host provider is wrapped too",
  );
  await assert.rejects(
    slpWithProviderRetry({ chatComplete: async () => Promise.reject(new Error("API error 401: bad key")) }, quick)
      .chatComplete,
    /401/u,
    "other errors are not retried",
  );

  // Every place Slurp builds a provider wraps it (the bulk draft keeps its own wrapper with the same retry).
  const slp = new URL("server/src/slp/", root);
  const files: string[] = [];
  const walk = (dir: URL) => {
    for (const name of readdirSync(dir)) {
      const url = new URL(name, dir);
      if (statSync(url).isDirectory()) walk(new URL(`${name}/`, dir));
      else if (name.endsWith(".ts")) files.push(url.pathname);
    }
  };
  walk(slp);
  let wrappedSites = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!/createLLMProvider\(|withConnectionFallbackProvider\(\{/u.test(text) || file.endsWith("slp-provider-retry.ts"))
      continue;
    const bare = [...text.matchAll(/=\s*(?:withConnectionFallbackProvider\(\{|createLLMProvider\()/gu)].length;
    const manual = /slpRetryProviderCall\(\(\) => fallbackProvider\.chatComplete/u.test(text) ? 1 : 0;
    assert.equal(bare, manual, `${file.split("/slp/")[1]} builds a provider without the retry`);
    assert.ok(/slpWithProviderRetry\(|slpRetryProviderCall\(/u.test(text), `${file.split("/slp/")[1]} retries`);
    wrappedSites += (text.match(/slpWithProviderRetry\(/gu) ?? []).length + manual;
  }
  assert.ok(wrappedSites >= 20, `all Slurp model-call places retry (${wrappedSites})`);

  // Adaptive bulk: two at a time on a fast connection, one at a time after the first refusal.
  const lanes = (limitOneAtATime: boolean) => {
    let inFlight = 0;
    let peak = 0;
    let peakAfterRefusal = 0;
    let refused = false;
    return {
      stats: () => ({ peak, peakAfterRefusal, refused }),
      async call() {
        if (limitOneAtATime && inFlight > 0) {
          refused = true;
          throw new Error("API error 429: Too many concurrent requests");
        }
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        if (refused) peakAfterRefusal = Math.max(peakAfterRefusal, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 3));
        inFlight -= 1;
        return "ok";
      },
    };
  };
  const creators = ["a", "b", "c", "d", "e", "f"];
  const run = (connection: ReturnType<typeof lanes>) =>
    slpSettleAdaptive(creators, (_, slowDown) =>
      slpWithProviderRetry(
        { chatComplete: () => connection.call() },
        {
          delaysMs: [1, 1, 1],
          sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          onRateLimit: slowDown,
        },
      ).chatComplete(),
    );
  const fast = lanes(false);
  assert.ok((await run(fast)).every((entry) => entry.status === "fulfilled"));
  assert.equal(fast.stats().peak, 2, "a fast connection gets two at a time");
  const single = lanes(true);
  assert.ok(
    (await run(single)).every((entry) => entry.status === "fulfilled"),
    "a one-slot connection loses nobody",
  );
  assert.equal(single.stats().refused, true);
  assert.equal(single.stats().peakAfterRefusal, 1, "after the first refusal it goes one at a time");
}
g8().then(
  () => console.log("slurp2-sim-fixes regression passed"),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
