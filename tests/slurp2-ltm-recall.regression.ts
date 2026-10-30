// Creators' posts and DM replies use what Long-Term Memory remembers about them (Pasta-Devs/Marinara-Agents#1841).
// Runs the recall helper against a fake `long-term-memory:recall` service registered through the host overlay,
// then pins the call sites that feed it.
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
const client = (path: string) => slurp2Source(`${root}/client/src/slp/${path}`);

const storeDir = mkdtempSync(join(tmpdir(), "slurp-ltm-recall-"));
writeFileSync(
  join(storeDir, "store.mjs"),
  "export const listSlurpContinuityFor = async () => { throw new Error('db'); };",
);
const failingStore = pathToFileURL(join(storeDir, "store.mjs")).href;

// The helper imports the Engine's logger and service registry; the package build stacks the host overlay there.
registerHooks({
  resolve(specifier, context, next) {
    // The ledger store reaches the Engine's database; the reply helper is tested against a store that fails.
    if (specifier.endsWith("/slp-continuity-storage.js") && context.parentURL?.endsWith("/slp-reply-continuity.ts"))
      return {
        url: failingStore,
        shortCircuit: true,
      };
    if (context.parentURL?.endsWith("/data/creators/slp-ltm-recall.ts")) {
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
  const recall = await import(pathToFileURL(join(root, "server/src/slp/data/creators/slp-ltm-recall.ts")).href);

  type Call = Record<string, unknown>;
  let service: unknown = null;
  host.bindHostRuntime({
    logger: { debug() {}, info() {}, warn() {}, error() {}, debugOverride() {} },
    persistence: {},
    services: { get: (key: string) => (key === "long-term-memory:recall" ? service : null) },
  });
  const fake = (answer: () => unknown) => {
    const calls: Call[] = [];
    service = {
      version: 1,
      recall: async (input: Call) => {
        calls.push(input);
        return answer();
      },
    };
    return calls;
  };
  const sections = [
    { noteId: "n1", type: "character", title: "Kai", text: "Kai tattoos  strangers\nat night." },
    { noteId: "n2", type: "world", text: "The shop is above a laundromat." },
  ];
  const ask = (over: Record<string, unknown> = {}) =>
    recall.recallSlurpMemories({
      settings: { flavourFromAgents: true, memoryRecall: "whole" },
      source: { kind: "character", entityId: "c1" },
      disclosureMode: "open",
      queryText: "  a night\nshift  ",
      ...over,
    });

  // --- The call ----------------------------------------------------------------------------------------------
  let calls = fake(() => ({ version: 1, sections }));
  const answer = await ask();
  assert.equal(calls.length, 1, "one call per prompt");
  assert.deepEqual(
    { ...calls[0], signal: undefined },
    {
      caller: "slurp2",
      queryText: "a night shift",
      characterIds: ["c1"],
      personaId: undefined,
      mode: "roleplay",
      maxTokens: 4_000,
      whole: true,
      signal: undefined,
    },
  );
  assert.ok(calls[0]?.signal instanceof AbortSignal, "a slow Long-Term Memory cannot stall a post");
  assert.deepEqual(answer, {
    status: "ok",
    lines: ["Kai: Kai tattoos strangers at night.", "The shop is above a laundromat."],
  });
  assert.equal(recall.lastSlurpMemoryStatus(), "ok");

  calls = fake(() => ({ version: 1, sections }));
  await ask({ settings: { flavourFromAgents: true, memoryRecall: "relevant" } });
  assert.deepEqual(
    [calls[0]?.whole, calls[0]?.maxTokens],
    [false, 800],
    "the relevant-parts choice reaches Long-Term Memory with its small budget",
  );

  // Long-Term Memory skips a whole memory that does not fit the budget, so whole mode asks for the ceiling.
  service = {
    version: 1,
    recall: async (input: Call) => {
      const budget = input.maxTokens as number;
      return {
        version: 1,
        sections: [{ noteId: "long", type: "character", text: "Kai ".repeat(1_000) }].filter(
          (section) => Math.ceil(section.text.length / 4) <= budget,
        ),
      };
    },
  };
  assert.equal((await ask()).lines.length, 1, "a long character note still reaches a whole-memory prompt");
  assert.equal(
    (await ask({ settings: { flavourFromAgents: true, memoryRecall: "relevant" } })).lines.length,
    0,
    "the ranked branch keeps its small budget",
  );

  calls = fake(() => ({ version: 1, sections }));
  await ask({ source: { kind: "persona", entityId: "p1" }, personaId: "p9" });
  assert.deepEqual([calls[0]?.characterIds, calls[0]?.personaId], [[], "p1"], "a persona Creator asks as itself");
  await ask({ personaId: "p9" });
  assert.deepEqual([calls[1]?.characterIds, calls[1]?.personaId], [["c1"], "p9"], "a DM adds the player's persona");

  calls = fake(() => ({
    version: 1,
    sections: Array.from({ length: 12 }, (_, i) => ({ noteId: `${i}`, type: "world", text: `Line ${i}.` })),
  }));
  assert.equal((await ask()).lines.length, 6, "a prompt carries six memories at most");

  calls = fake(() => ({
    version: 1,
    sections: [
      { noteId: "a", type: "world", text: "{{user}} owes the shop money." },
      { noteId: "b", type: "world", text: `Long ${"x".repeat(400)}` },
    ],
  }));
  const capped = (await ask()).lines;
  assert.equal(capped.length, 1, "a line about the player is never public");
  assert.ok(capped[0].length <= 300 && capped[0].endsWith("…"), "a line is capped");

  // --- Gates: no call at all ---------------------------------------------------------------------------------
  calls = fake(() => ({ version: 1, sections }));
  for (const [name, over] of Object.entries({
    hinted: { disclosureMode: "hinted" },
    concealed: { disclosureMode: "concealed" },
    "switch off": { settings: { flavourFromAgents: false, memoryRecall: "whole" } },
    "no source": { source: null },
    "empty query": { queryText: " \n " },
  })) {
    assert.deepEqual(await ask(over), { status: null, lines: [] }, name);
  }
  assert.equal(calls.length, 0, "a closed gate never reaches Long-Term Memory");

  // --- Status: why no memories arrive ------------------------------------------------------------------------
  service = null;
  assert.deepEqual(await ask(), { status: "missing", lines: [] });
  assert.equal(recall.lastSlurpMemoryStatus(), "missing");
  fake(() => null);
  assert.deepEqual(await ask(), { status: "off", lines: [] });
  assert.equal(recall.lastSlurpMemoryStatus(), "off");
  assert.deepEqual(
    await ask({ signal: AbortSignal.abort() }),
    { status: "error", lines: [] },
    "a call that timed out is not reported as sharing switched off",
  );
  service = {
    recall: async () => {
      throw new Error("boom");
    },
  };
  assert.deepEqual(await ask(), { status: "error", lines: [] }, "a failure never fails the post");
  assert.equal(recall.lastSlurpMemoryStatus(), "error");
  fake(() => ({ version: 1, sections }));
  await ask();
  assert.equal(recall.lastSlurpMemoryStatus(), "ok", "the status recovers");

  // --- Whose memories a DM may add ---------------------------------------------------------------------------
  const page = (identityDisclosure?: "open" | "hinted" | "concealed") =>
    ({
      settings: { privacy: { identityDisclosure } },
    }) as never;
  const viewer = { kind: "persona", entityId: "p1" } as never;
  assert.equal(recall.slurpRecallPersonaId(viewer, page("open"), undefined), "p1");
  assert.equal(recall.slurpRecallPersonaId(viewer, page(undefined), undefined), "p1", "open is the default");
  assert.equal(
    recall.slurpRecallPersonaId(viewer, page("hinted"), undefined),
    undefined,
    "a hinted page is not tied to its owner",
  );
  assert.equal(recall.slurpRecallPersonaId(viewer, page("concealed"), undefined), undefined);
  assert.equal(recall.slurpRecallPersonaId(viewer, page("open"), "chatty"), undefined, "a fan voice is not the player");
  assert.equal(recall.slurpRecallPersonaId(viewer, null, undefined), undefined, "no page of their own");
  assert.equal(
    recall.slurpRecallPersonaId({ kind: "random_user", entityId: "x" } as never, page("open"), undefined),
    undefined,
  );

  // --- A DM reply: whose memories, which question -----------------------------------------------------------
  const reply = await import(
    pathToFileURL(join(root, "server/src/slp/features/messages/slp-reply-continuity.ts")).href
  );
  const dmInput = (history: { role: string; content: string }[]) =>
    ({
      db: null,
      creator: { id: "c1", displayName: "Kai" },
      threadId: "t1",
      history,
      viewer,
    }) as never;
  const base = {
    settings: { flavourFromAgents: true, memoryRecall: "whole" },
    source: { kind: "character", entityId: "c1" },
  };
  const dmCalls = fake(() => ({ version: 1, sections }));
  const fanSays = [{ role: "viewer", content: "how was the night shift" }];
  const text = await reply.slurpReplyContinuity(dmInput(fanSays), {
    ...base,
    disclosureMode: "open",
    viewerPage: page("open"),
    fanVoice: undefined,
  });
  assert.match(
    text,
    /From your memory:\n- Kai: Kai tattoos strangers at night\./u,
    "a failed ledger read keeps the memories",
  );
  assert.deepEqual([dmCalls[0]?.queryText, dmCalls[0]?.personaId], ["how was the night shift", "p1"]);
  for (const [name, over] of Object.entries({
    "hinted page": { viewerPage: page("hinted") },
    "fan voice": { fanVoice: "chatty" },
    "no page": { viewerPage: null },
  })) {
    await reply.slurpReplyContinuity(dmInput(fanSays), {
      ...base,
      disclosureMode: "open",
      viewerPage: page("open"),
      fanVoice: undefined,
      ...over,
    });
    assert.equal(dmCalls.at(-1)?.personaId, undefined, `${name}: the player's persona is not added`);
  }
  await reply.slurpReplyContinuity(dmInput([]), {
    ...base,
    disclosureMode: "open",
    viewerPage: page("open"),
    fanVoice: undefined,
  });
  assert.equal(dmCalls.at(-1)?.queryText, "Kai", "a Creator-started DM asks about the Creator");
  const dmWith = (history: { role: string; content: string }[]) =>
    reply.slurpReplyContinuity(dmInput(history), {
      ...base,
      disclosureMode: "open",
      viewerPage: page("open"),
      fanVoice: undefined,
    });
  await dmWith([...fanSays, { role: "viewer", content: "" }]);
  assert.equal(dmCalls.at(-1)?.queryText, "how was the night shift", "a tip or picture does not blank the question");
  await dmWith([{ role: "viewer", content: "  \n " }]);
  assert.equal(dmCalls.at(-1)?.queryText, "Kai", "no words from the fan asks about the Creator");
  const before = dmCalls.length;
  await reply.slurpReplyContinuity(dmInput(fanSays), {
    ...base,
    disclosureMode: "hinted",
    viewerPage: page("open"),
    fanVoice: undefined,
  });
  assert.equal(dmCalls.length, before, "a hinted Creator reads no memories in a DM");

  // --- Settings ----------------------------------------------------------------------------------------------
  // slp-settings.ts imports the host, so its schema is pinned by source: a missing key falls back to the default.
  const settings = server("modules/settings/slp-settings.ts");
  assert.match(settings, /memoryRecall: z\.enum\(\["whole", "relevant"\]\)/u);
  assert.match(settings, /memoryRecall: "relevant"/u, "an older settings file reads as relevant memories");
  assert.match(client("features/settings/SlpEngineLinkPanel.tsx"), /update\("memoryRecall", value\)/u);
  assert.match(
    client("features/settings/SlpEngineLinkPanel.tsx"),
    /settings\.flavourFromAgents && \(/u,
    "only while the switch is on",
  );
  assert.match(client("features/settings/slp-settings-defaults.ts"), /"flavourFromAgents",\s*"memoryRecall"/u);
  assert.match(server("features/settings/slp-settings-routes.ts"), /app\.get\("\/settings\/memory-status"/u);

  // --- Call sites --------------------------------------------------------------------------------------------
  const plan = server("features/feed/slp-post-plan-service.ts");
  assert.match(
    plan,
    /try \{\s*const noodle = createSlurpStorage\(db\);\s*return \(\s*await recallSlurpMemories\(\{\s*settings: await noodle\.getSettings\(\),\s*source: await noodle\.resolveAccountSource\(account as SlurpAccount\),\s*disclosureMode: account\.settings\.privacy\.identityDisclosure \?\? "open",\s*queryText: \[beat\?\.line, beat\?\.place, beat\?\.anchor\]/u,
    "a post asks about its beat, for the Creator's own source and disclosure",
  );
  assert.match(plan, /Could not read memories for a post; it is written without them/u, "no lookup fails the post");
  assert.match(plan, /slurpContinuityInstruction\(\{ \.\.\.ledger, memories \}\)/u);
  assert.match(
    plan,
    /slurpContinuityInstruction\(\{ facts: \[\], memories \}\)/u,
    "a failed ledger read keeps the memories",
  );
  const dm = server("features/messages/slp-reply-continuity.ts");
  assert.match(
    dm,
    /message\.role === "viewer" && message\.content\.trim\(\)\)\?\.content/u,
    "a reply asks about the fan's last message",
  );
  assert.match(dm, /personaId: slurpRecallPersonaId\(input\.viewer, recall\.viewerPage, recall\.fanVoice\)/u);
  assert.match(dm, /slurpContinuityInstruction\(\{ \.\.\.ledger, threadId: input\.threadId, memories \}\)/u);
  assert.match(
    server("features/messages/slp-message-generation-service.ts"),
    /slurpReplyContinuity\(input, \{\s*settings,\s*source,\s*disclosureMode,\s*viewerPage: viewerPageAccount,\s*fanVoice,/u,
  );
  assert.match(server("features/feed/slp-prompt-preview-service.ts"), /recallSlurpMemories\(\{\s*settings,/u);
  assert.doesNotMatch(
    server("data/creators/slp-agent-memory-source.ts"),
    /long-term-memory|getCapabilityService/u,
    "the brief's tracker lines no longer read Long-Term Memory's storage",
  );

  // Turning on "What your other Agents know" offers to turn on Long-Term Memory's sharing (#1853).
  const { offerLtmSharing } = await import(
    pathToFileURL(join(root, "client/src/slp/features/settings/slp-ltm-sharing-offer.ts")).href
  );
  const offer = (read: () => Promise<unknown>, answer: boolean) => {
    const log = { confirm: 0, save: 0 };
    const result = offerLtmSharing({
      read,
      confirm: async () => (log.confirm++, answer),
      save: async () => void log.save++,
    });
    return result.then((outcome: string) => ({ outcome, ...log }));
  };
  assert.deepEqual(await offer(async () => ({ longTermMemoryShareWithPackages: false }), true), {
    outcome: "enabled",
    confirm: 1,
    save: 1,
  });
  assert.deepEqual(await offer(async () => ({ longTermMemoryShareWithPackages: false }), false), {
    outcome: "declined",
    confirm: 1,
    save: 0,
  });
  assert.deepEqual(await offer(async () => ({ longTermMemoryShareWithPackages: true }), true), {
    outcome: "skipped",
    confirm: 0,
    save: 0,
  });
  assert.deepEqual(
    await offer(async () => {
      throw new Error("Long-Term Memory is not installed");
    }, true),
    { outcome: "skipped", confirm: 0, save: 0 },
    "a missing Long-Term Memory asks nothing",
  );
  await assert.rejects(
    offerLtmSharing({
      read: async () => ({ longTermMemoryShareWithPackages: false }),
      confirm: async () => true,
      save: async () => {
        throw new Error("save failed");
      },
    }),
    /save failed/u,
    "a failed save reaches the panel",
  );
  // The recorded "off" is checked against Long-Term Memory's current switch (#1856).
  const { currentMemoryStatus } = await import(
    pathToFileURL(join(root, "client/src/slp/features/settings/slp-ltm-sharing-offer.ts")).href
  );
  const status = async (recorded: string | null, ltm: () => Promise<unknown>) => {
    let reads = 0;
    const result = await currentMemoryStatus({
      read: async () => ({ status: recorded }),
      readLtm: () => (reads++, ltm()),
    });
    return { ...result, reads };
  };
  assert.deepEqual(await status("off", async () => ({ longTermMemoryShareWithPackages: true })), {
    status: null,
    reads: 1,
  });
  assert.deepEqual(await status("off", async () => ({})), { status: null, reads: 1 }, "an unset switch counts as on");
  assert.deepEqual(await status("off", async () => ({ longTermMemoryShareWithPackages: false })), {
    status: "off",
    reads: 1,
  });
  assert.deepEqual(
    await status("off", async () => {
      throw new Error("Long-Term Memory is not installed");
    }),
    { status: "off", reads: 1 },
    "an unreadable switch keeps the recorded off",
  );
  for (const recorded of ["ok", "missing", "error", null]) {
    assert.deepEqual(await status(recorded, async () => ({ longTermMemoryShareWithPackages: false })), {
      status: recorded,
      reads: 0,
    });
  }
  assert.match(
    client("features/settings/slp-settings-hooks.ts"),
    /"memory-status"\] as const,[\s\S]*?refetchOnMount: "always"/u,
    "reopening the panel re-asks Long-Term Memory, so a switch turned on in its own settings clears the off line",
  );
  const panel = client("features/settings/SlpEngineLinkPanel.tsx");
  assert.match(
    panel,
    /update\("flavourFromAgents", value\);\s*if \(value\) void offerSharing\(\);/u,
    "the offer runs only when the switch goes on",
  );
  assert.match(
    panel,
    /invalidateQueries\(\{ queryKey: \[\.\.\.slpKeys\.settings\(\), "memory-status"\] \}\)/u,
    "the status is read again once sharing is on",
  );
  assert.match(panel, /cancelLabel: t\("ui\.slurp\.settings\.prompts\.ltmSharingOfferCancel"\)/u);
  assert.match(panel, /api\.put\("\/long-term-memory\/settings", \{ longTermMemoryShareWithPackages: true \}\)/u);

  rmSync(storeDir, { recursive: true, force: true });
  console.log("slurp2 ltm recall regression OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
