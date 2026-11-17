import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  jsonishLooksTruncated,
  parseGameJsonish,
} from "../sources/engine/packages/server/src/services/game/jsonish.ts";
import { slpGeneratedCreatorPostSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social-generation.schema.ts";
import { z } from "zod";
import { parseRecord } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-public-support.ts";

const read = (path: string) =>
  readFileSync(join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/slp", path), "utf8");

// A retried or rewritten slot keeps its promise or claimed campaign stage.
const plan = read("features/feed/slp-post-plan-service.ts");
assert.match(plan, /\(slotPlan\?\.sourceEventId \? slotPlan : null\) \?\?/u);
assert.match(plan, /entry\.status === "claimed" && entry\.opportunityId === slotPlan\.id/u);
// An arc post in a teaser slot gets no card beat beside the project block.
assert.match(plan, /!\(isTeaser && ctx\.beats\.arc && !nudged\)/u);

// Beat facts never crowd out the Creator's limits and notes: only the newest few stay active.
const beats = read("features/feed/slp-post-beat-service.ts");
assert.match(beats, /const SLURP_ACTIVE_BEAT_FACTS = 3;/u);
assert.match(beats, /moveSlurpContinuityStatus\(db, "fact", fact\.id, "expired", at\)/u);
// The background card read never replaces the player's edited anchors: proved on a real store in
// `slurp2-anchor-edits.regression.ts`. Here: the beat service reads through that one store.
assert.match(beats, /slurpCanonAnchorsFor\(db, accountId, readingText\(context\), at,/u);

// The memory block is identity-protected like the rest of the prompt.
const prompt = read("features/feed/slp-post-prompt.ts");
assert.match(prompt, /protectCreatorGeneratedIdentity\(\s*input\.continuityInstruction\?\.trim\(\) \?\? ""/u);

// Staleness is judged on the content hash at every fingerprint site.
for (const path of [
  "data/feed/reserve/slp-reserve-storage-1.ts",
  "data/feed/reserve/slp-reserve-storage-2.ts",
  "features/feed/reserve/slp-reserve-operation.ts",
]) {
  assert.doesNotMatch(read(path), /slpCreatorReservePolicyFingerprint\(/u, path);
  assert.match(read(path), /slpCreatorReserveFingerprintFor\(/u, path);
}

// A post answer cut off by the token limit goes to the correction turn, which asks for a shorter post; an answer
// that still closes on `}` is kept even when a stray quote fools the scan.
const parsePost = runInNewContext(
  stripTypeScriptTypes(
    prompt
      .slice(prompt.indexOf("const SLURP_POST_CUT_OFF"), prompt.indexOf("/**\n * One post from the model"))
      .replace(/export /gu, ""),
  ) + "\nparseCreatorPost;",
  {
    jsonishLooksTruncated,
    parseGameJsonish,
    slpGeneratedCreatorPostSchema,
    requireModelAnswer: (text: string) => text,
  },
);
for (const suffix of [":]", "}", "2]", "true}", "[sic]"]) {
  assert.throws(() => parsePost(`{"title":"Post","content":"Cut here ${suffix}`), /cut off/u);
}
for (const answer of [
  '{"title":"Post","content":"Complete."}',
  '```json\n{"title":"Post","content":"Complete."}\n```',
  '{"title":"Post","content":"Complete."} More prose.',
  '[{"title":"Post","content":"Complete."}]',
  '{"title":"Post","content":"Complete."} Trailing "quote',
])
  assert.equal(parsePost(answer).content, "Complete.");
assert.throws(() => parsePost('[Post] {"title":"x","content":"The cat sat on the'), /cut off/u);
for (const prefix of ["{draft} ", "{draft ", "[draft] ", '{"draft":true} '])
  for (const root of ["{", "[{"]) {
    assert.throws(() => parsePost(`${prefix}${root}"title":"x","content":"The cat sat on the`), /cut off/u);
    assert.equal(
      parsePost(`${prefix}${root}"title":"x","content":"Complete."}${root === "[{" ? "]" : ""}`).content,
      "Complete.",
    );
  }
assert.throws(() => parsePost('[Post] [{"title":"x","content":"Complete."}'), /cut off/u);
assert.throws(() => parsePost('{"title":"x","content":"The marker [{}] is inside cut-off text'), /cut off/u);
for (const tail of ["", " More prose."])
  assert.equal(parsePost('{"title":"Post","content":"Wearing 6" heels."}' + tail).content, 'Wearing 6" heels.');
assert.match(prompt, /error\.message === SLURP_POST_CUT_OFF[\s\S]*Write a shorter post/u);

// "Resolve" claims the Creator before it reads the desk, so a double tap gets one line and one reply.
const desk = read("features/messages/desk/slp-desk-routes.ts");
const resolve = desk.slice(desk.indexOf('"/slurp/desk/ticket/resolve"'), desk.indexOf('"/slurp/desk/offer/answer"'));
assert.ok(
  resolve.indexOf("resolving.add(") > 0 && resolve.indexOf("resolving.add(") < resolve.indexOf("readSlurpSupportDesk("),
);
assert.match(resolve, /finally \{\s*resolving\.delete\(/u);

// A second resolve while the first runs is told so, and a request_action row that no longer parses still counts as answered.
assert.match(resolve, /already being resolved/u);
const actionSource = read("features/messages/slp-request-action-service.ts");
const loadActions = () =>
  runInNewContext(
    stripTypeScriptTypes(actionSource.replace(/^import[\s\S]*?;\n/gmu, "").replace(/export /gu, "")) +
      "\n({listSlurpThreadRequests, applySlurpRequestAction});",
    {
      slurpContinuityEvents: new Proxy({}, { get: (_, key) => key }),
      eq: (key: string, value: unknown) => (row: Record<string, unknown>) => row[key] === value,
      and:
        (...filters: Array<(row: Record<string, unknown>) => boolean>) =>
        (row: Record<string, unknown>) =>
          filters.every((filter) => filter(row)),
      parseRecord,
      slurpWorldNow: () => new Date(),
    },
  );
const rows = [
  {
    id: "request-1",
    threadId: "thread",
    creatorAccountId: "creator",
    eventType: "request_received",
    payload: "damaged",
    occurredAt: "2026-11-16",
  },
  {
    id: "action",
    threadId: "thread",
    eventType: "request_action",
    payload: "not JSON",
    fingerprint: "request-action:request-1",
  },
];
const db = {
  select: () => ({
    from: () => ({ where: async (filter: (row: Record<string, unknown>) => boolean) => rows.filter(filter) }),
  }),
};
async function proveDamagedAction() {
  const actions = loadActions();
  assert.equal((await actions.listSlurpThreadRequests(db, "thread"))[0].text, "");
  assert.equal(
    await actions.applySlurpRequestAction(db, {
      threadId: "thread",
      creatorAccountId: "creator",
      requestId: "request-1",
      action: "fulfill",
    }),
    "already_answered",
  );
  assert.equal(rows.length, 2);
}
async function proveResolve() {
  let handler: (req: unknown, reply: unknown) => Promise<unknown>;
  let release: () => void = () => undefined;
  let entered: () => void = () => undefined;
  let lines = 0;
  let replies = 0;
  let failRead = false;
  let ticket = { status: "open", topic: "Help" };
  const holding = new Promise<void>((done) => {
    release = done;
  });
  const started = new Promise<void>((done) => {
    entered = done;
  });
  const register = runInNewContext(
    stripTypeScriptTypes(desk.replace(/^import[\s\S]*?;\n/gmu, "").replace(/export /gu, "")) + "\nslpDeskRoutes;",
    {
      z,
      slpExtensionOn: () => true,
      slurpWorldNow: () => new Date(),
      readSlurpSupportDesk: async () => {
        if (failRead) throw new Error("read failed");
        return { ticket };
      },
      updateSlurpSupportDesk: async (
        _db: unknown,
        _id: string,
        update: (desk: unknown) => { ticket: typeof ticket },
      ) => {
        ticket = update({ ticket }).ticket;
      },
      slpDeskAdjust: (value: unknown) => value,
      appendSlurpDeskLine: async () => {
        lines++;
        entered();
        await holding;
        return { id: "line", threadId: "thread" };
      },
      replyToSlurpMessage: async () => {
        replies++;
        return { status: "replied" };
      },
    },
  );
  await register(
    {
      db: {},
      get: () => undefined,
      post: (path: string, fn: typeof handler) => {
        if (path === "/slurp/desk/ticket/resolve") handler = fn;
      },
    },
    {
      messages: {},
      ownsCreator: async () => false,
      requireViewer: async () => ({ id: "viewer" }),
      slurp: { getSettings: async () => ({ supportDesk: {} }) },
    },
  );
  const call = async () => {
    const result = { status: 200, body: null as unknown };
    await handler(
      { body: { personaId: "viewer", creatorAccountId: "creator" } },
      {
        code: (status: number) => {
          result.status = status;
          return {
            send: (body: unknown) => {
              result.body = body;
              return body;
            },
          };
        },
      },
    );
    return result;
  };
  const first = call();
  await started;
  const second = await call();
  assert.equal(second.status, 409);
  assert.equal((second.body as { error: string }).error, "This ticket is already being resolved.");
  release();
  await first;
  assert.equal(lines, 1);
  assert.equal(replies, 1);
  assert.equal(((await call()).body as { error: string }).error, "There is no open ticket.");
  ticket = { status: "open", topic: "Retry" };
  failRead = true;
  await assert.rejects(call(), /read failed/u);
  failRead = false;
  assert.equal((await call()).status, 200);
  assert.equal(lines, 2);
  assert.equal(replies, 2);
}
Promise.all([proveDamagedAction(), proveResolve()])
  .then(() => console.log("slurp2 review fixes regression checks passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

// Storylines off keeps collab and couple partners out of posts and occasions; one person per picture drops the cast.
const generation = read("features/feed/slp-generation-service.ts");
assert.match(generation, /collabs: slpExtensionOn\(settings, "storylines"\) \? settings\.creatorCollabs : null/u);
assert.match(generation, /const pictureIds = settings\.imageOnePerson \? \[\] :/u);
assert.match(generation, /beat: settings\.imageOnePerson && beat \? \{ \.\.\.beat, cast: \[\] \} : beat/u);
assert.match(read("features/feed/slp-post-spice.ts"), /locked && input\.collabs\n/u);
assert.match(read("features/feed/slp-occasion-service.ts"), /ties && id/u);

// Audit fixes: a persona's Stir play needs that persona to undo it; a double tap adds one Life panel condition.
assert.match(
  read("features/assist/slp-stir-service.ts"),
  /if \(!play \|\| \(play\.personaId && play\.personaId !== personaId\)\)/u,
);
const storyState = read("features/storylines/slp-story-state-routes.ts");
assert.match(storyState, /if \(adding\.has\(accountId\)\) return reply\.code\(409\)/u);
assert.match(storyState, /finally \{\n\s*adding\.delete\(accountId\);/u);
const clientRoot = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
// A tab switch does not refetch ads, so it records no impression; fast event toggles build on the pending list.
assert.match(readFileSync(join(clientRoot, "features/ads/slp-ads-hooks.ts"), "utf8"), /refetchOnWindowFocus: false/u);
const eventsPanel = readFileSync(join(clientRoot, "features/world/SlpPlatformEventsPanel.tsx"), "utf8");
assert.match(eventsPanel, /const current = \(\) => pending\.current \?\? events;/u);
assert.doesNotMatch(eventsPanel, /onSave\(events\./u);

// Review: the Stir view offers Undo only to the persona that made the play; one person per picture also drops a stored cast.
assert.match(
  read("features/assist/slp-stir-service.ts"),
  /play\.personaId && play\.personaId !== personaId \? \{ \.\.\.play, undoable: false \}/u,
);
assert.match(
  read("features/media/slp-images-service.ts"),
  /const companionIds = input\.settings\.imageOnePerson \? undefined : input\.companionIds;/u,
);
