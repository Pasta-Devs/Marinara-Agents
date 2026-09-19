/**
 * Slurp activity in ordinary Engine chats. It is opt-in per chat and per chat mode, it only speaks
 * about the characters in the chat, and what a fan pays for never travels into it.
 */
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { slurp2Source } from "./slurp2-source";

const source = slurp2Source(
  new URL("../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-chat-context.ts", import.meta.url),
);

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const recent = hoursAgo(1);
const older = hoursAgo(2);
const stale = hoursAgo(48);

let carryoverModes = ["conversation"];
let carryoverMaxItems = 20;
const creators = [
  { id: "mari", displayName: "Mari Vale", sourceKind: "character", sourceEntityId: "char-mari" },
  { id: "other", displayName: "Someone Else", sourceKind: "character", sourceEntityId: "char-other" },
  { id: "self", displayName: "Player Creator", sourceKind: "persona", sourceEntityId: "char-mari" },
];

const { buildSlurpChatContext } = runInNewContext(
  `${stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, "").replace(/^\s*export /gm, ""))}
  ({ buildSlurpChatContext });`,
  {
    wrapContent: (content: string, section: string, format: string) =>
      `<${section} format="${format}">\n${content}\n</${section}>`,
    sinceHoursIso: (hours: number) => hoursAgo(hours),
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
      listSubscriptionsForViewer: async () => [{ creatorAccountId: "mari" }],
    }),
    createSlurpMessagesStorage: () => ({
      getThread: async (viewer: string, creator: string) =>
        creator === "mari" ? { id: `${viewer}:${creator}` } : null,
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

  carryoverMaxItems = 2;
  const capped: string = await buildSlurpChatContext({}, { ...request, wrapFormat: "markdown" });
  assert.match(capped, /format="markdown"/u);
  assert.equal(capped.split("\n").filter((line) => line.startsWith("- ")).length, 2);
  assert.match(capped, /subscribes to/u, "a standing subscription is not cut before events");

  carryoverModes = [];
  assert.equal(await buildSlurpChatContext({}, request), null);
  console.log("slurp2 chat context regression passed");
}

void main();
