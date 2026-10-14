/**
 * Drama phase 3 (`docs/DRAMA.md`, persona audit): the player's own page as a partner. A couple with
 * the player starts together, the clock never breaks it up, the player is never "the jealous one",
 * a persona's text is never read as a card (no orientation misfit, no card couple on its own), and a
 * couple with the player gets no shared page.
 */
import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import {
  slurpAdvanceCouples,
  slurpCouplePageOpenable,
  slurpSteerCouple,
  slurpSetUpCouple,
  type SlurpCouple,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import { slurpCoupleMisfitOf } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-fit.ts";
import { slurpPlayerCoupleStep } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-player-couple.ts";
import {
  slurpPartnerWord,
  slurpRelationshipLine,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-lines.ts";
import { slurpPartnerNews } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-partner-texts.ts";
import { resolveSlurpMediaOffer } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-media-offer.ts";
import { slurpChatBridgeCoupleLine } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-lines.ts";
import {
  slpDramaPlayerWords,
  slpDramaText,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-words.ts";
import {
  slurpPreviewTieLever,
  slurpUndoTie,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-stir-tie-preview.ts";
import { SLURP_NO_TIES } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import { slurpSetBond } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-bonds.ts";
import {
  SLURP_THREAD_STATE_DEFAULT,
  slurpPartnerThreadFloor,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-state.ts";
import { slurpPartnerCommentBodies } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-world-copy.ts";
import { slurpDmRoleHeader } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-roles.ts";
import { readSlurpDmUs } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-response.ts";
import {
  SlurpPausedError,
  setSlurpPaused,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/model/slp-pause.ts";
import { slpWithProviderRetry } from "../packages/slurp2/src/engine/packages/server/src/slp/base/model/slp-provider-retry.ts";
import { generateSlpImageWithRetry } from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-retry.ts";
import type { SlurpTieCreator } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import {
  SLURP_PARTNER_TEXT_PACE,
  slurpPartnerText,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-partner-texts.ts";
import {
  describeSlurpRapport,
  emptySlurpRapportFacts,
  scoreSlurpRapport,
  SLURP_PARTNER_RAPPORT,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-rapport.ts";

const T0 = Date.parse("2026-10-01T00:00:00.000Z");
const DAY = 86_400_000;
const creator = (id: string, text: string, extra: Partial<SlurpTieCreator> = {}): SlurpTieCreator => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  text,
  tags: ["fitness"],
  automatic: true,
  followers: 1000,
  gender: "female",
  ...extra,
});

async function main() {
  const mia = creator("mia", "Straight fitness coach. Flirty and romantic.");
  const me = creator("me", "Dating Mia. Straight guy who loves the gym.", { automatic: false, gender: null });
  const jake = creator("jake", "Straight gym bro.", { gender: "male" });

  // A persona has no gender: a card's orientation is not a misfit for the player's page.
  assert.equal(slurpCoupleMisfitOf(mia, me), null);
  assert.equal(slurpCoupleMisfitOf(mia, creator("lena", "Straight.", { gender: "female" }))?.misfit, "orientation");
  // A persona's text is not a card: "never dates" on it colors nothing.
  assert.equal(slurpCoupleMisfitOf(mia, { ...me, text: "Never dates anyone." }), null);

  // Set up with the player: together from the start.
  const set = slurpSetUpCouple([], mia, me, { at: new Date(T0), id: "c1" });
  assert.ok(Array.isArray(set));
  const couple = (set as SlurpCouple[])[0]!;
  assert.deepEqual([couple.stage, couple.forced, couple.togetherAt !== null], ["together", undefined, true]);

  // 120 days on the clock, with collabs that would make anyone jealous: never split, never rocky, dates
  // keep coming, and a jealous moment is never the player's.
  let couples: SlurpCouple[] = set as SlurpCouple[];
  let counter = 0;
  for (let step = 0; step < 120 * 4; step += 1) {
    couples = slurpAdvanceCouples(couples, {
      creators: [mia, me, jake],
      at: new Date(T0 + step * 6 * 3_600_000),
      activity: 1,
      storylines: [],
      rivals: new Set(),
      collabbedWith: new Map(
        step % 40 < 8
          ? [
              ["mia", "jake"],
              ["jake", "mia"],
            ]
          : [],
      ),
      newId: () => `n-${++counter}`,
    });
    const ours = couples.find((entry) => entry.id === "c1")!;
    assert.ok(ours.stage === "together", `day ${step / 4}: ${ours.stage}`);
    assert.ok(!ours.moments.some((moment) => moment.fromId === "me"), "the player is never the jealous one");
  }
  const ours = couples.find((entry) => entry.id === "c1")!;
  // Only the last ten moments are kept: the newest date is from the last days, and there are several.
  const dates = ours.moments.filter((moment) => moment.kind === "date");
  assert.ok(dates.length >= 3, `dates keep coming (${dates.length})`);
  assert.ok(T0 + 120 * DAY - Date.parse(dates.at(-1)!.at) < 10 * DAY, "the last date is recent");

  // A persona that names a Creator does not make a couple on its own; the relation is set by the player.
  const alone = slurpAdvanceCouples([], {
    creators: [mia, me],
    at: new Date(T0 + DAY),
    activity: 0,
    storylines: [],
    rivals: new Set(),
    collabbedWith: new Map(),
    newId: () => "x",
  });
  assert.equal(alone.length, 0);

  // No shared page with the player in it; spice partners treat the player's page as the player.
  const service = slurp2Source(
    new URL(
      "../packages/slurp2/src/engine/packages/server/src/slp/features/projects/slp-creator-couples-service.ts",
      import.meta.url,
    ),
  );
  assert.match(service, /account\.kind === "persona" && account\.sourceKind === "persona"\)\) return "notOpen"/u);
  const spice = slurp2Source(
    new URL(
      "../packages/slurp2/src/engine/packages/server/src/slp/data/creators/slp-spice-storage.ts",
      import.meta.url,
    ),
  );
  assert.ok(
    spice.indexOf('account?.kind === "persona"') < spice.indexOf("selectSlurpExplicitLevel(guidance, partnerId)"),
  );

  // She texts like a partner: a few times a day together, less when dating, rarely after a fight, never
  // while something is pending or inside the gap; time-of-day reasons; the same hour decides once.
  {
    const day = (stage: "together" | "dating" | "rocky" | "sparks") => {
      let last: number | null = null;
      let texts = 0;
      for (let slot = 0; slot < 24 * 14; slot += 1) {
        const reason = slurpPartnerText({
          pairKey: "mia|me",
          stage,
          hour: slot % 24,
          hoursSinceLast: last === null ? null : slot - last,
          busy: false,
          slot,
        });
        if (reason) {
          texts += 1;
          last = slot;
        }
      }
      return texts / 14;
    };
    const together = day("together");
    assert.ok(together >= 1.5 && together <= 4.8, `together: ${together.toFixed(1)} texts a day`);
    assert.ok(day("dating") < together && day("rocky") < day("dating"), "less when dating, least after a fight");
    assert.equal(
      slurpPartnerText({ pairKey: "a", stage: "together", hour: 9, hoursSinceLast: 1, busy: false, slot: 1 }),
      null,
    );
    assert.equal(
      slurpPartnerText({ pairKey: "a", stage: "together", hour: 9, hoursSinceLast: null, busy: true, slot: 1 }),
      null,
    );
    const morning = Array.from({ length: 400 }, (_, slot) =>
      slurpPartnerText({ pairKey: "x", stage: "together", hour: 8, hoursSinceLast: null, busy: false, slot }),
    ).filter(Boolean);
    assert.ok(
      morning.length > 0 && morning.every((reason) => /morning|slept|dream|woke/iu.test(reason!)),
      "morning texts are morning texts",
    );
    assert.ok(
      morning.every((reason) => !/\b(she|her|him|his)\b/iu.test(reason!)),
      "no gender assumed",
    );
    assert.equal(SLURP_PARTNER_TEXT_PACE.together.gapHours, 5);
  }

  // A partner starts close: the head start lifts a brand-new thread to "your partner", not a fan tier.
  {
    const fresh = scoreSlurpRapport(emptySlurpRapportFacts());
    const partner = scoreSlurpRapport(emptySlurpRapportFacts(), undefined, { partner: "partner" });
    const crush = scoreSlurpRapport(emptySlurpRapportFacts(), undefined, { partner: "crush" });
    assert.equal(partner.score - fresh.score, SLURP_PARTNER_RAPPORT);
    assert.ok(crush.score > fresh.score && crush.score < partner.score);
    assert.match(describeSlurpRapport(partner, "Me"), /^Your history with Me: your partner \(/u);
    assert.match(describeSlurpRapport(crush, "Me"), /your crush/u);
    const base = slurp2Source(
      new URL(
        "../packages/slurp2/src/engine/packages/server/src/slp/data/messages/slp-messages-storage-base.ts",
        import.meta.url,
      ),
    );
    assert.match(base, /readSlurpPlayerCouple\(db, creatorAccountId, page\.id\)/u);
    const scheduler = slurp2Source(
      new URL(
        "../packages/slurp2/src/engine/packages/server/src/slp/features/world/slp-world-scheduler-service.ts",
        import.meta.url,
      ),
    );
    assert.match(scheduler, /textSlurpPartners\(app\.db\)/u);
  }

  // ── The chat moves the player's couple (0.3.11): a crush, dating, official, a fight, making up ──
  {
    const mira = creator("mira", "Romantic, loves the gym.");
    const you = creator("you", "", { automatic: false, gender: "male" });
    const at = (days: number) => new Date(T0 + days * DAY);
    const crush = slurpSetUpCouple([], mira, you, { at: at(0), id: "c", crush: true });
    assert.ok(Array.isArray(crush));
    let couple = (crush as SlurpCouple[])[0]!;
    assert.equal(couple.stage, "sparks", "a crush from the chat starts as sparks");
    assert.equal(
      slurpPlayerCoupleStep(couple, "closer", { at: at(0.5), creatorId: "mira" }),
      null,
      "one warm evening does not make it dating",
    );
    couple = slurpPlayerCoupleStep(couple, "closer", { at: at(1), creatorId: "mira", detail: "coffee" })!;
    assert.equal(couple.stage, "dating");
    assert.equal(slurpPlayerCoupleStep(couple, "closer", { at: at(2), creatorId: "mira" }), null, "dating needs days");
    couple = slurpPlayerCoupleStep(couple, "closer", { at: at(4), creatorId: "mira" })!;
    assert.equal(couple.stage, "together");
    assert.equal(couple.moments.at(-1)!.kind, "launch", "official means a launch post");
    couple = slurpPlayerCoupleStep(couple, "hurt", { at: at(5), creatorId: "mira", detail: "he forgot" })!;
    assert.equal(couple.stage, "rocky");
    assert.equal(couple.moments.at(-1)!.fromId, "mira", "the fight is hers to post, never the player's");
    assert.equal(slurpPlayerCoupleStep(couple, "closer", { at: at(6), creatorId: "mira" }), null);
    couple = slurpPlayerCoupleStep(couple, "madeUp", { at: at(6), creatorId: "mira" })!;
    assert.equal(couple.stage, "together");

    // A crush nobody acts on fades; the clock never moves it on by itself.
    const [faded] = slurpAdvanceCouples((crush as SlurpCouple[]).slice(), {
      creators: [mira, you],
      at: at(13),
      activity: 1,
      storylines: [],
      rivals: new Set(),
      collabbedWith: new Map(),
      newId: () => "n",
    });
    assert.equal(faded!.stage, "split");
    assert.equal(faded!.ending, "fizzled");

    // Set up by hand with the player: official at once, with a launch.
    const set = slurpSetUpCouple([], mira, you, { at: at(0), id: "s" }) as SlurpCouple[];
    assert.equal(set[0]!.stage, "together");
    assert.equal(set[0]!.moments.at(-1)!.kind, "launch");

    // Her lines: the player is "your boyfriend", never "another Creator on Slurp"; a secret stays private.
    const names = new Map([["you", "Sam"]]);
    const options = { at: at(1), playerIds: new Set(["you"]), words: new Map([["you", slurpPartnerWord("male")]]) };
    const withYou = slurpRelationshipLine(set, "mira", names, { ...options, withId: "you" });
    assert.match(withYou, /Sam is your boyfriend: you two are together, and your fans know\./u);
    assert.doesNotMatch(slurpRelationshipLine(set, "mira", names, options), /another Creator/u);
    const secret = slurpRelationshipLine([{ ...set[0]!, secret: true }], "mira", names, options);
    assert.match(secret, /never name Sam in public/u);
    assert.doesNotMatch(secret, /fans know/u);
    assert.equal(slurpPartnerWord("female"), "girlfriend");
    assert.equal(slurpPartnerWord(null), "partner");
  }

  // ── Her DM header: her partner is neither a fan nor a customer; the answer may carry "us" ──
  {
    const header = slurpDmRoleHeader({
      writer: "creator",
      creator: { name: "Mira", handle: "mira" },
      viewer: { name: "Sam", handle: "sam" },
      viewerPage: {
        name: "Sam",
        handle: "sam_page",
        partner: true,
        partnerWord: "boyfriend",
        concealed: true,
        us: true,
      },
      history: [],
    });
    assert.match(header, /Sam is your boyfriend\. This chat is just the two of you/u);
    assert.doesNotMatch(header, /sam_page/u, "a concealed page is never named");
    assert.doesNotMatch(header, /"collab"/u, "no collab on a concealed page");
    assert.match(header, /add "us" to your JSON/u);
    assert.deepEqual(
      readSlurpDmUs({ step: "madeUp", why: " sorry " }, (value) => value),
      {
        step: "madeUp",
        why: "sorry",
      },
    );
    assert.equal(
      readSlurpDmUs({ step: "marry" }, (value) => value),
      undefined,
    );
  }

  // ── Her texts, her pictures, the chat bridge and the packs know who the player is to her ──
  {
    const mira = creator("mira", "Romantic, loves the gym.");
    const you = creator("you", "", { automatic: false, gender: "female" });
    const [couple] = slurpSetUpCouple([], mira, you, { at: new Date(T0), id: "k" }) as SlurpCouple[];
    const dated: SlurpCouple = {
      ...couple!,
      moments: [
        ...couple!.moments,
        { id: "d1", kind: "date", at: new Date(T0 + DAY).toISOString(), detail: "the night market" },
      ],
    };
    const invite = slurpPartnerNews(dated, new Date(T0 + DAY + 2 * 3_600_000), new Date(T0).toISOString());
    assert.match(
      invite ?? "",
      /date today \(the night market\)/u,
      "a date with the player: she asks them out on the day",
    );
    const recap = slurpPartnerNews(
      dated,
      new Date(T0 + DAY + 20 * 3_600_000),
      new Date(T0 + DAY + 3 * 3_600_000).toISOString(),
    );
    assert.match(recap ?? "", /last night/u, "and texts about it the morning after");
    assert.equal(
      slurpPartnerNews(dated, new Date(T0 + DAY + 20 * 3_600_000), new Date(T0 + DAY + 13 * 3_600_000).toISOString()),
      null,
      "news the two already talked about is not news",
    );
    assert.equal(
      slurpPartnerText({
        pairKey: "p",
        stage: "together",
        hour: 12,
        hoursSinceLast: 0,
        busy: false,
        slot: 1,
        news: "N",
      }),
      "N",
    );
    assert.equal(
      slurpPartnerText({
        pairKey: "p",
        stage: "together",
        hour: 12,
        hoursSinceLast: 0,
        busy: true,
        slot: 1,
        news: "N",
      }),
      null,
    );

    assert.deepEqual(
      resolveSlurpMediaOffer({
        intent: "friendly",
        rapportTier: "stranger",
        subscribed: false,
        configuredPrice: 20,
        spicy: true,
        partner: true,
      }),
      { visibility: "free", price: 0, reason: "relationship_reward" },
      "what she sends her partner is never sold",
    );
    const rocky = scoreSlurpRapport(emptySlurpRapportFacts(), undefined, { partner: "rocky" });
    const close = scoreSlurpRapport(emptySlurpRapportFacts(), undefined, { partner: "partner" });
    assert.ok(rocky.score < close.score && rocky.score > 0, "after a fight still close, less close");
    assert.match(describeSlurpRapport(rocky, "Sam"), /your partner/u);

    const bridge = slurpChatBridgeCoupleLine(
      { ...couple!, togetherAt: "2026-10-01T00:00:00.000Z" },
      { her: "Mira", herGender: "female", you: "Sam", at: new Date(T0) },
    );
    assert.equal(bridge, "Mira is Sam's girlfriend on Slurp: together since 2026-10-01.");
    assert.equal(slurpChatBridgeCoupleLine(null, { her: "Mira", herGender: null, you: "Sam", at: new Date(T0) }), "");

    const words = slpDramaPlayerWords({ gender: "female" });
    assert.equal(
      slpDramaText("does your {you-bf} see these? tell {you-him}", words),
      "does your gf see these? tell her",
    );
    assert.equal(slpDramaText("lucky {you-man}", slpDramaPlayerWords(undefined)), "lucky one");
  }

  // ── Stir 0.3.11: bonds are plays with Undo; Undo of "keep it secret" brings the secret back ──
  {
    const mira = creator("mira", "Romantic.");
    const lena = creator("lena", "Loves the gym.");
    const you = creator("you", "", { automatic: false });
    const at = new Date(T0);
    const world = { creators: [mira, lena, you], avatars: new Map(), ties: SLURP_NO_TIES, couples: [], bonds: [] };
    const preview = slurpPreviewTieLever(world, "set-bond", { aId: "mira", bId: "lena", kind: "friend", level: 3 }, at);
    assert.equal(preview.error, null);
    assert.equal(preview.who.length, 2);
    const bonds = slurpSetBond([], { aId: "mira", bId: "lena", kind: "friend", level: 3 }, { at, id: "b1" });
    assert.ok(Array.isArray(bonds));
    const undone = slurpUndoTie({ ties: SLURP_NO_TIES, couples: [], bonds }, { kind: "removeBond", id: "b1" });
    assert.deepEqual(undone?.bonds, []);

    const [couple] = slurpSetUpCouple([], mira, you, { at, id: "c" }) as SlurpCouple[];
    const secret = { ...couple!, secret: true };
    const back = slurpUndoTie({ ties: SLURP_NO_TIES, couples: [couple!] }, { kind: "restoreCouple", couple: secret });
    assert.equal(back?.couples[0]?.secret, true);
    const open = slurpUndoTie({ ties: SLURP_NO_TIES, couples: [secret] }, { kind: "restoreCouple", couple: couple! });
    assert.equal("secret" in (open?.couples[0] ?? {}), false, "going public again drops the flag");
  }

  // ── Review fixes: a secret couple has no public page, and no "public launch" text ──
  {
    const mira = creator("mira", "Romantic.");
    const you = creator("you", "", { automatic: false });
    const at = new Date(T0);
    const [couple] = slurpSetUpCouple([], mira, you, { at, id: "c" }) as SlurpCouple[];
    assert.equal(slurpCouplePageOpenable({ ...couple!, secret: true }), false);
    const paged = { ...couple!, page: { accountId: "page", openedAt: at.toISOString(), closedAt: null } };
    assert.equal(slurpSteerCouple([paged], "c", "secret", { at, creators: [mira, you] }), "notOpen");
    const news = slurpPartnerNews({ ...couple!, secret: true }, new Date(T0 + 3_600_000), null);
    assert.equal(news, null, "a secret launch is no news to text about");
  }

  // ── Her partner starts close; her public side reaches the chat, her texts and her comments ──
  {
    const fresh = { ...SLURP_THREAD_STATE_DEFAULT, updatedAt: new Date(T0).toISOString() };
    assert.equal(slurpPartnerThreadFloor(fresh, null), fresh, "a fan keeps the fan ladder");
    const together = slurpPartnerThreadFloor(fresh, "partner");
    assert.equal(together.adultLevel, "explicit", "no stranger ladder for her partner");
    assert.equal(together.posture, "playful");
    assert.ok(together.familiarity >= 80 && together.sexualComfort >= 80);
    const hurt = slurpPartnerThreadFloor(fresh, "rocky");
    assert.equal(hurt.adultLevel, "intimate");
    assert.ok(hurt.resentment >= 30, "after a fight some hurt stays");
    const further = { ...fresh, familiarity: 95, adultLevel: "explicit" as const };
    assert.equal(slurpPartnerThreadFloor(further, "crush").familiarity, 95, "floors never lower anything");
    assert.ok(slurpPartnerCommentBodies("Sam").every((body) => body.includes("Sam")));
    const night = new Set<string>();
    for (let slot = 0; slot < 400; slot += 1) {
      const reason = slurpPartnerText({
        pairKey: "p",
        stage: "together",
        hour: 14,
        hoursSinceLast: 99,
        busy: false,
        slot,
        heat: true,
      });
      if (reason) night.add(reason);
    }
    assert.ok(
      [...night].some((reason) => /fans|everyone seeing you/u.test(reason)),
      "her public side comes up in her texts",
    );
    const header = slurpDmRoleHeader({
      writer: "creator",
      creator: { name: "Mira", handle: "mira" },
      viewer: { name: "Sam", handle: "sam" },
      viewerPage: { name: "Sam", handle: "sam_page", partner: true, partnerWord: "boyfriend" },
      history: [],
    });
    assert.match(header, /Your page is public, and Sam sees what you post there/u);
  }

  // ── Pause all: not one model or image call ──
  {
    let calls = 0;
    const provider = slpWithProviderRetry({ chatComplete: async () => ((calls += 1), { content: "hi" }) });
    setSlurpPaused(true);
    await assert.rejects(provider.chatComplete(), SlurpPausedError);
    await assert.rejects(
      generateSlpImageWithRetry(async () => ((calls += 1), "img")),
      SlurpPausedError,
    );
    assert.equal(calls, 0);
    setSlurpPaused(false);
    await provider.chatComplete();
    assert.equal(calls, 1);
  }

  console.log("slurp2 player partner regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
