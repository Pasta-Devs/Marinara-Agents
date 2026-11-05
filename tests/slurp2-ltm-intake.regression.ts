// "Tell Long-Term Memory about your Creators" (Pasta-Devs/Marinara-Agents#2010).
// Runs the intake sender against a fake `long-term-memory:intake` service registered through the host overlay,
// with the storage layer stubbed, then pins the places that call it.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { registerHooks } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { slurp2Source } from "./slurp2-source.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const overlay = join(repo, "sources/host-runtime-overlay/packages/server/src");
const root = join(repo, "packages/slurp2/src/engine/packages");
const server = (path: string) => slurp2Source(`${root}/server/src/slp/${path}`);

// The sender loads the storage layer on use; the test serves a stand-in whose settings and accounts it controls.
const state: { sharing: boolean; accounts: Record<string, unknown> } = { sharing: true, accounts: {} };
(globalThis as Record<string, unknown>).__slurpIntakeTest = state;
const storeDir = mkdtempSync(join(tmpdir(), "slurp-ltm-intake-"));
writeFileSync(
  join(storeDir, "storage.mjs"),
  `const state = globalThis.__slurpIntakeTest;
export const createSlurpStorage = () => ({
  getSettings: async () => ({ shareWithMemory: state.sharing }),
  getNoodlerAccountById: async (id) => state.accounts[id] ?? null,
});`,
);
const storage = pathToFileURL(join(storeDir, "storage.mjs")).href;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith("/slp-storage.js") && context.parentURL?.endsWith("/data/creators/slp-ltm-intake.ts"))
      return { url: storage, shortCircuit: true };
    if (context.parentURL?.endsWith("/data/creators/slp-ltm-intake.ts")) {
      const target = specifier.endsWith("/lib/logger.js")
        ? "lib/logger.ts"
        : specifier.endsWith("/capability-service-registry.service.js")
          ? "services/capability-packages/capability-service-registry.service.ts"
          : null;
      if (target) return { url: pathToFileURL(join(overlay, target)).href, shortCircuit: true };
    }
    if (specifier.startsWith(".") && context.parentURL) {
      const path = fileURLToPath(new URL(specifier, context.parentURL));
      if (path.endsWith(".js") && !existsSync(path) && existsSync(path.replace(/\.js$/u, ".ts")))
        return { url: pathToFileURL(path.replace(/\.js$/u, ".ts")).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

async function main() {
  const host = await import(pathToFileURL(join(overlay, "lib/host-runtime.ts")).href);
  const intake = await import(pathToFileURL(join(root, "server/src/slp/data/creators/slp-ltm-intake.ts")).href);

  type Call = { action: string; input: Record<string, unknown> };
  let service: unknown = null;
  const calls: Call[] = [];
  host.bindHostRuntime({
    logger: { debug() {}, info() {}, warn() {}, error() {}, debugOverride() {} },
    persistence: {},
    services: { get: (key: string) => (key === "long-term-memory:intake" ? service : null) },
  });
  const fake = (failWith?: Error) => {
    calls.length = 0;
    const act = (action: string) => async (input: Record<string, unknown>) => {
      calls.push({ action, input });
      if (failWith) throw failWith;
      return { version: 1, status: "applied" };
    };
    service = { version: 1, submit: act("submit"), retract: act("retract") };
  };
  const db = {} as never;
  const fact = (over: Record<string, unknown> = {}) =>
    ({
      id: "f1",
      sourceKind: "character",
      sourceEntityId: "char-kai",
      factType: "interest",
      subject: "Hobbies",
      text: "Kai restores old synthesizers.",
      audienceScope: "creator_public",
      realityScope: "slurp",
      threadId: null,
      status: "confirmed",
      expiresAt: null,
      ...over,
    }) as never;

  // --- 1. Off by default: nothing leaves Slurp -------------------------------------------------------------------
  fake();
  state.sharing = false;
  await intake.shareSlurpFact(db, fact());
  await intake.retractSlurpFact(db, "f1");
  assert.deepEqual(
    calls.map((call) => [call.action, call.input.recordId]),
    [["retract", "fact:f1"]],
    "with the switch off, a fact that qualifies is not sent, and a retraction still goes out",
  );
  fake();
  await intake.shareSlurpFact(db, fact({ audienceScope: "fan_private" }));
  assert.deepEqual(
    calls.map((call) => [call.action, call.input.recordId]),
    [["retract", "fact:f1"]],
    "with the switch off, an edit that stops qualifying takes the earlier record back",
  );

  // --- 2. A qualifying fact is sent once; one that is private to a thread or fan is not ---------------------------
  state.sharing = true;
  fake();
  await intake.shareSlurpFact(db, fact());
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.action, "submit");
  assert.deepEqual(
    { ...calls[0]?.input, signal: undefined },
    {
      caller: "slurp2",
      recordId: "fact:f1",
      characterIds: ["char-kai"],
      text: "Hobbies: Kai restores old synthesizers.",
      signal: undefined,
    },
  );
  assert.ok(calls[0]?.input.signal instanceof AbortSignal, "a slow Long-Term Memory cannot stall Slurp");

  for (const over of [
    { audienceScope: "thread_private", threadId: "t1" },
    { audienceScope: "fan_private" },
    { sourceKind: "persona" },
    { factType: "boundary" },
    { status: "retired" },
    { expiresAt: "2027-01-01T00:00:00.000Z" },
  ]) {
    fake();
    await intake.shareSlurpFact(db, fact(over));
    assert.deepEqual(
      calls.map((call) => [call.action, call.input.recordId]),
      [["retract", "fact:f1"]],
      `${JSON.stringify(over)} sends nothing and takes any earlier record back`,
    );
  }

  // --- 3. An edit sends the new text; the retract route takes the record back ------------------------------------
  fake();
  await intake.shareSlurpFact(db, fact({ text: "Kai now builds modular synthesizers." }));
  assert.equal(calls[0]?.input.text, "Hobbies: Kai now builds modular synthesizers.");
  assert.equal(calls[0]?.input.recordId, "fact:f1", "the same record id replaces the old line");
  fake();
  await intake.retractSlurpFact(db, "f1");
  assert.deepEqual(
    calls.map((call) => [call.action, call.input.caller, call.input.recordId]),
    [["retract", "slurp2", "fact:f1"]],
  );

  // --- 4. A couple moving to together sends one record with both characters --------------------------------------
  state.accounts = {
    a1: { displayName: "Kai", sourceKind: "character", sourceEntityId: "char-kai" },
    a2: { displayName: "Mira", sourceKind: "character", sourceEntityId: "char-mira" },
    a3: { displayName: "You", sourceKind: "persona", sourceEntityId: "persona-1" },
  };
  const couple = (over: Record<string, unknown> = {}) =>
    ({
      id: "c1",
      aId: "a1",
      bId: "a2",
      stage: "dating",
      ending: null,
      stageAt: "2026-09-12T00:00:00.000Z",
      togetherAt: null,
      ...over,
    }) as never;
  const doc = (couples: unknown[] = [], bonds: unknown[] = []) => ({ ties: {}, deals: [], couples, bonds }) as never;
  fake();
  await intake.shareSlurpTieChanges(db, doc([couple()]), doc([couple({ stage: "together", togetherAt: "x" })]));
  assert.equal(calls.length, 1);
  assert.deepEqual(
    { ...calls[0]?.input, signal: undefined },
    {
      caller: "slurp2",
      recordId: "couple:a1:a2",
      characterIds: ["char-kai", "char-mira"],
      text: "Kai and Mira are together.",
      signal: undefined,
    },
  );
  fake();
  await intake.shareSlurpTieChanges(db, doc([couple({ stage: "together" })]), doc([couple({ stage: "together" })]));
  assert.equal(calls.length, 0, "an unchanged couple is not sent again");
  fake();
  await intake.shareSlurpTieChanges(
    db,
    doc([couple({ stage: "together", togetherAt: "x" })]),
    doc([couple({ stage: "split", ending: "breakup", togetherAt: "x" })]),
  );
  assert.equal(calls[0]?.input.text, "Kai and Mira were together until September 2026.");
  fake();
  await intake.shareSlurpTieChanges(
    db,
    doc([couple({ stage: "together" })]),
    doc([couple({ stage: "split", ending: "fizzled" })]),
  );
  assert.deepEqual(
    calls.map((call) => [call.action, call.input.recordId]),
    [["retract", "couple:a1:a2"]],
    "a couple that stops qualifying is taken back",
  );
  fake();
  await intake.shareSlurpTieChanges(db, doc([couple()]), doc([couple({ aId: "a1", bId: "a3", stage: "together" })]));
  assert.equal(calls.length, 0, "a couple with a persona-sourced Creator has no character to attach to");
  const bond = (over: Record<string, unknown> = {}) =>
    ({ id: "b1", kind: "friend", aId: "a1", bId: "a2", level: 2, endedAt: null, ending: null, ...over }) as never;
  fake();
  await intake.shareSlurpTieChanges(db, doc([], [bond({ level: 0 })]), doc([], [bond()]));
  assert.equal(calls[0]?.input.text, "Kai and Mira are friends.");
  assert.equal(calls[0]?.input.recordId, "bond:friend:a1:a2");
  fake();
  await intake.shareSlurpTieChanges(db, doc([], [bond()]), doc([], [bond({ endedAt: "x", ending: "drifted" })]));
  assert.equal(calls[0]?.input.text, "Kai and Mira used to be friends. They drifted apart.");
  fake();
  state.sharing = false;
  await intake.shareSlurpTieChanges(db, doc(), doc([couple({ stage: "together" })]));
  assert.equal(calls.length, 0, "ties send nothing while the switch is off");
  fake();
  await intake.shareSlurpTieChanges(
    db,
    doc([couple({ stage: "together" })]),
    doc([couple({ stage: "split", ending: "fizzled" })]),
  );
  assert.deepEqual(
    calls.map((call) => [call.action, call.input.recordId]),
    [["retract", "couple:a1:a2"]],
    "a tie that stops qualifying is taken back even while the switch is off",
  );
  state.sharing = true;

  // --- 5. A storyline ending names its Creators and the ending --------------------------------------------------
  fake();
  await intake.sendSlurpStoryEnding(db, {
    id: "s1",
    title: "Last Train",
    creatorIds: ["a1", "a2"],
    ending: "Together",
  });
  assert.deepEqual(
    { ...calls[0]?.input, signal: undefined },
    {
      caller: "slurp2",
      recordId: "storyline:s1",
      characterIds: ["char-kai", "char-mira"],
      text: 'Kai and Mira: the storyline "Last Train" ended: Together.',
      signal: undefined,
    },
  );

  // --- 5b. Two pages for one character count once; sends and retracts keep the order they were issued ---------------
  state.accounts.a4 = { displayName: "Kai (alt)", sourceKind: "character", sourceEntityId: "char-kai" };
  fake();
  await intake.shareSlurpTieChanges(db, doc(), doc([couple({ bId: "a4", stage: "together" })]));
  assert.deepEqual(calls[0]?.input.characterIds, ["char-kai"]);
  fake();
  const order: string[] = [];
  service = {
    version: 1,
    submit: async () => {
      await new Promise((done) => setTimeout(done, 40));
      order.push("submit");
    },
    retract: async () => void order.push("retract"),
  };
  const edited = intake.shareSlurpFact(db, fact());
  const retracted = intake.retractSlurpFact(db, "f1");
  await Promise.all([edited, retracted]);
  assert.deepEqual(order, ["submit", "retract"], "a quick retract cannot overtake the send before it");

  // --- 6. A missing, refusing or failing service never fails the Slurp action ------------------------------------
  service = null;
  await intake.shareSlurpFact(db, fact());
  await intake.shareSlurpTieChanges(db, doc(), doc([couple({ stage: "together" })]));
  fake(new Error("Long-Term Memory is down"));
  await intake.shareSlurpFact(db, fact());
  await intake.retractSlurpFact(db, "f1");
  await intake.sendSlurpStoryEnding(db, { id: "s1", title: "T", creatorIds: ["a1"], ending: "End" });
  service = { version: 1, submit: async () => null, retract: async () => null };
  await intake.shareSlurpFact(db, fact());

  // --- 7. The call sites: after the write, never awaited, behind the switch ---------------------------------------
  const routes = server("features/creators/slp-continuity-routes.ts");
  assert.equal(
    (routes.match(/void shareSlurpFact\(app\.db, (fact|result)\)/gu) ?? []).length,
    3,
    "writing, editing and promoting a fact each send it",
  );
  assert.match(routes, /if \(target === "facts"\) void retractSlurpFact\(app\.db, id\)/u);
  assert.match(
    server("data/projects/slp-creator-ties-storage.ts"),
    /void shareSlurpTieChanges\(db, current, next\.document\)/u,
  );
  const projects = server("data/projects/slp-projects-storage-1.ts");
  assert.match(projects, /settings\?\.shareWithMemory\)\s*void sendSlurpStoryEnding\(/u);
  assert.match(server("modules/settings/slp-settings.ts"), /shareWithMemory: z\.boolean\(\)/u);
  assert.match(server("modules/settings/slp-settings.ts"), /shareWithMemory: false/u, "off by default");
  assert.match(server("data/creators/slp-ltm-recall.ts"), /excludeFrom: \["slurp2"\]/u);

  rmSync(storeDir, { recursive: true, force: true });
  console.log("slurp2 ltm intake regression OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
