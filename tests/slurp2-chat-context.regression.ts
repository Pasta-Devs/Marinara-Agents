/**
 * Slurp activity in ordinary Engine chats. It is opt-in per chat and per chat mode, it only speaks
 * about the characters in the chat, and what a fan pays for never travels into it. Standing facts
 * (story, love life, rapport, ledger) say where things stand, and survive a tight cap by rank.
 */
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { slurp2Source } from "./slurp2-source";
import { slurpArcLifeLine } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-progress.ts";
import {
  slurpChatBridgeCoupleLine,
  slurpChatBridgeLoveLines,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-lines.ts";
import { slurpCoupleOf } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import { slurpChatBridgeRapportLine } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-rapport.ts";
import { SLURP_CONTINUITY_FACT_LABELS } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/continuity/slp-continuity-prompt.ts";

const source = slurp2Source(
  new URL("../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-chat-context.ts", import.meta.url),
);

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const recent = hoursAgo(1);
const older = hoursAgo(2);
const stale = hoursAgo(48);

let carryoverModes = ["conversation"];
let carryoverMaxItems = 20;
const settings = { profile: { gender: "female" } };
const creators = [
  { id: "mari", displayName: "Mari Vale", sourceKind: "character", sourceEntityId: "char-mari", settings },
  { id: "other", displayName: "Someone Else", sourceKind: "character", sourceEntityId: "char-other", settings },
  { id: "self", displayName: "Player Creator", sourceKind: "persona", sourceEntityId: "char-mari", settings },
  { id: "kai", displayName: "Kai Rowe", sourceKind: "character", sourceEntityId: "char-kai", settings },
  // Another persona's page: the player runs it, so its couples are not gossip for this chat.
  { id: "alt", displayName: "Alt Page", kind: "persona", sourceKind: "persona", sourceEntityId: "p-alt", settings },
];
const couple = (id: string, aId: string, bId: string, stage: string) => ({
  id,
  aId,
  bId,
  origin: "world",
  stage,
  ending: null,
  startedAt: older,
  stageAt: older,
  togetherAt: stage === "together" ? older : null,
  troubles: 0,
  reunions: 0,
  moments: [],
  told: [],
  postIds: [],
  page: null,
});
const couples = [
  couple("c1", "mari", "kai", "together"),
  couple("c2", "other", "kai", "dating"),
  couple("c3", "mari", "alt", "dating"),
  { ...couple("c4", "mari", "other", "sparks"), secret: true },
];
const arc = {
  title: "Moving to Lisbon",
  status: "active",
  intensity: "focus",
  chapters: ["Packing the flat"],
  chapter: 0,
  choices: [],
  history: [],
  tone: "",
};
const ledgerReads: Array<{ creator: string; threadId: string | null }> = [];

const { buildSlurpChatContext, slurpCarryoverReach } = runInNewContext(
  `${stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, "").replace(/^\s*export /gm, ""))}
  ({ buildSlurpChatContext, slurpCarryoverReach });`,
  {
    wrapContent: (content: string, section: string, format: string) =>
      `<${section} format="${format}">\n${content}\n</${section}>`,
    sinceHoursIso: (hours: number) => hoursAgo(hours),
    slurpArcLifeLine,
    slurpChatBridgeCoupleLine,
    slurpChatBridgeLoveLines,
    slurpCoupleOf,
    slurpRunsItself: (account: { kind?: string; sourceKind?: string }) =>
      !(account.kind === "persona" && account.sourceKind === "persona"),
    slurpChatBridgeRapportLine,
    SLURP_CONTINUITY_FACT_LABELS,
    readSlurpCreatorTiesDocument: async () => ({ couples }),
    listSlurpContinuityFor: async (
      _db: unknown,
      creator: string,
      surface: string,
      context: { threadId: string | null },
    ) => {
      assert.equal(surface, "fan_thread", "the ledger is read through its privacy rules for one fan");
      ledgerReads.push({ creator, threadId: context.threadId });
      return {
        facts:
          creator === "mari"
            ? [
                { factType: "plan", text: "Wants  to open a café", threadId: null },
                ...(context.threadId
                  ? [{ factType: "relationship", text: "A scene with this fan: dinner", threadId: context.threadId }]
                  : []),
              ]
            : [],
        events: [],
      };
    },
    createSlurpStorage: () => ({
      getSettings: async () => ({ carryoverModes, carryoverHours: 24, carryoverMaxItems }),
      listNoodlerAccounts: async () => creators,
      listNoodlerPostsByAccounts: async (ids: string[]) =>
        new Map(
          ids.map((id) => [
            id,
            id === "mari"
              ? [
                  { access: "public", title: null, content: "Beach day photos", createdAt: recent },
                  { access: "locked", title: "Private set", content: "PAID POST BODY", createdAt: older },
                  { access: "public", title: null, content: "STALE POST", createdAt: stale },
                ]
              : [{ access: "public", title: null, content: `POST BY ${id}`, createdAt: recent }],
          ]),
        ),
      getViewer: async (id: string) => ({ id, displayName: "Alex" }),
      getSlurpAccountForEntity: async () => null,
      listProjects: async (id: string) => (id === "mari" ? [arc] : []),
      listSubscriptionsForViewer: async () => [{ creatorAccountId: "mari" }],
    }),
    createSlurpMessagesStorage: () => ({
      getThread: async (viewer: string, creator: string) =>
        creator === "mari"
          ? { id: `${viewer}:${creator}`, rapport: { score: 40, tier: "regular", contributions: [] } }
          : null,
      listMessages: async () => [
        {
          role: "viewer",
          kind: "text",
          content: "Loved the beach set",
          price: 0,
          unlockedAt: null,
          imageUrl: null,
          createdAt: older,
        },
        {
          role: "creator",
          kind: "ppv",
          content: "LOCKED MESSAGE BODY",
          price: 40,
          unlockedAt: null,
          imageUrl: "/x",
          createdAt: recent,
        },
        { role: "viewer", kind: "tip", content: "", price: 15, unlockedAt: null, imageUrl: null, createdAt: recent },
        {
          role: "viewer",
          kind: "text",
          content: "STALE MESSAGE",
          price: 0,
          unlockedAt: null,
          imageUrl: null,
          createdAt: stale,
        },
      ],
      listCommissionsForThread: async () => [
        { state: "cancellation_pending", price: 120, brief: "A sunset portrait", updatedAt: recent },
      ],
    }),
  },
);

const request = {
  chatMeta: { slurp2ActivityContextEnabled: true },
  mode: "conversation",
  targetCharacterIds: ["char-mari"],
  personaId: "persona-alex",
};

async function main() {
  assert.equal(await buildSlurpChatContext({}, { ...request, chatMeta: {} }), null, "chats are opted out by default");
  assert.equal(
    await buildSlurpChatContext({}, { ...request, chatMeta: { slurp2ActivityContextEnabled: false } }),
    null,
  );
  assert.equal(
    await buildSlurpChatContext({}, { ...request, mode: "roleplay" }),
    null,
    "the chat mode must be enabled",
  );

  const block: string = await buildSlurpChatContext({}, request);
  assert.match(block, /^<Recent Slurp Activity format="xml">/u, "older Engines send no wrap format; default to xml");
  assert.match(block, /Mari Vale posted on Slurp: Beach day photos/u);
  assert.match(block, /Mari Vale posted a paid post on Slurp: "Private set"\./u);
  assert.match(block, /Alex messaged Mari Vale on Slurp: Loved the beach set/u);
  assert.match(block, /Mari Vale sent Alex locked content for 40 coins on Slurp \(still locked\)/u);
  assert.match(block, /Alex tipped Mari Vale 15 coins on Slurp\./u);
  assert.match(
    block,
    /Alex commissioned Mari Vale on Slurp for 120 coins \(cancellation pending\): A sunset portrait/u,
  );
  assert.match(block, /Alex subscribes to Mari Vale on Slurp\./u);
  assert.doesNotMatch(block, /PAID POST BODY|LOCKED MESSAGE BODY/u, "paid content must never reach a chat");
  assert.doesNotMatch(block, /STALE/u, "activity older than the look-back window stays out");
  assert.doesNotMatch(block, /Someone Else|Player Creator|POST BY/u, "only the chat's character Creators count");
  assert.ok(block.indexOf("Loved the beach set") < block.indexOf("tipped"), "entries render oldest first");
  assert.match(block, /Mari Vale's ongoing story on Slurp: Moving to Lisbon \(Packing the flat\)\./u);
  assert.match(block, /Mari Vale is together with Kai Rowe on Slurp\./u, "her love life with other Creators");
  assert.doesNotMatch(block, /Someone Else is dating/u, "couples without the chat's character stay out");
  assert.match(block, /Alex is one of Mari Vale's regulars on Slurp\./u);
  assert.doesNotMatch(block, /40\/100|\b40\b(?! coins)/u, "the rapport score is never shown");
  assert.match(block, /Mari Vale remembers from Slurp — Plan: Wants to open a café/u);
  assert.match(block, /Mari Vale remembers from Slurp — Relationship \(with Alex\): A scene with this fan: dinner/u);
  assert.deepEqual(ledgerReads.at(-1), { creator: "mari", threadId: "persona-alex:mari" });

  const noPersona: string = await buildSlurpChatContext({}, { ...request, personaId: null });
  assert.match(noPersona, /Plan: Wants to open a café/u, "without a persona the character's own facts remain");
  assert.doesNotMatch(noPersona, /with Alex|scene with this fan/u, "no thread, no fan-private facts");
  for (const text of [block, noPersona]) {
    assert.doesNotMatch(text, /Alt Page/u, "couples with any page the player runs stay out");
    assert.doesNotMatch(text, /flirting with Someone Else/u, "secret couples stay secret");
  }

  carryoverMaxItems = 2;
  const capped: string = await buildSlurpChatContext({}, { ...request, wrapFormat: "markdown" });
  assert.match(capped, /format="markdown"/u);
  assert.equal(capped.split("\n").filter((line) => line.startsWith("- ")).length, 2);
  assert.match(capped, /subscribes to/u, "a standing subscription is not cut before events");
  assert.match(capped, /regulars/u, "rapport outranks story and ledger lines under a tight cap");

  carryoverModes = [];
  assert.equal(await buildSlurpChatContext({}, request), null);

  // Settings counts the second switch: chats in a carryover mode with a Creator's character.
  const reach = slurpCarryoverReach(
    [
      { mode: "conversation", characterIds: '["char-mari"]', metadata: '{"slurp2ActivityContextEnabled":true}' },
      { mode: "conversation", characterIds: '["char-mari","char-x"]', metadata: "{}" },
      { mode: "roleplay", characterIds: '["char-mari"]', metadata: '{"slurp2ActivityContextEnabled":true}' },
      { mode: "conversation", characterIds: '["char-x"]', metadata: '{"slurp2ActivityContextEnabled":true}' },
      { mode: "conversation", characterIds: "not json", metadata: null },
    ],
    new Set(["char-mari"]),
    ["conversation"],
  );
  assert.equal(`${reach.on}/${reach.off}`, "1/1", "only chats in a chosen mode with a Creator count");
  console.log("slurp2 chat context regression passed");
}

void main();
