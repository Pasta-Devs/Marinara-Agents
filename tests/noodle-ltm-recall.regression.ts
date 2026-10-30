import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";

// Noodle can read Long-Term Memory's recall through the published capability (Agents#1842). It is
// off by default, reads only through `long-term-memory:recall`, and a missing, refusing or failing
// recall leaves the refresh working without memories.

const servicesDir = "../packages/noodle/src/engine/packages/server/src/services";
const read = (path: string) => readFileSync(new URL(`${servicesDir}/${path}`, import.meta.url), "utf8");

type Status = "ok" | "missing" | "off" | "error" | null;
type Recall = { lines: string[]; status: Status };
type Calls = Record<string, unknown>[];

// The helper's only host import is the capability registry, which the Engine provides at runtime.
const helperSource = read("noodle/noodle-ltm-recall.ts");
assert.match(helperSource, /from "\.\.\/capability-packages\/capability-service-registry\.service\.js"/);
const helperCode = stripTypeScriptTypes(
  helperSource.replace(/^import .*capability-service-registry.*$/m, "").replace(/^export /gm, ""),
);

function loadHelper(service: unknown, registryThrows = false) {
  const helper = runInNewContext(
    `${helperCode}\n({ recallNoodleMemories, noodleMemoryQueryText, getNoodleMemoryStatus });`,
    {
      getCapabilityService: (key: string) => {
        if (registryThrows) throw new Error("registry unavailable");
        return key === "long-term-memory:recall" ? service : null;
      },
    },
  ) as {
    recallNoodleMemories: (input: Record<string, unknown>) => Promise<Recall>;
    noodleMemoryQueryText: (posts: string[], names: string[]) => string;
    getNoodleMemoryStatus: () => Status;
  };
  // Results are cloned out of the VM so deepEqual compares plain values from this realm.
  return {
    ...helper,
    recallNoodleMemories: async (input: Record<string, unknown>) =>
      JSON.parse(JSON.stringify(await helper.recallNoodleMemories(input))) as Recall,
  };
}
// The registered service is an object with a `recall` method, as `createLtmRecallService` returns it.
const fake = (answer: unknown, calls: Calls) => ({
  version: 1,
  recall: async (input: Record<string, unknown>) => {
    calls.push(JSON.parse(JSON.stringify(input)));
    if (answer instanceof Error) throw answer;
    return answer;
  },
});
const base = { characterIds: ["alice", "bob"], queryText: "Alice posted about the festival" };

async function main() {
  // Off (the default): no call, no memories, and no status to report.
  {
    const calls: Calls = [];
    const helper = loadHelper(fake({ sections: [{ text: "x" }] }, calls));
    for (const settings of [{}, { useLtmMemories: false }]) {
      const result = await helper.recallNoodleMemories({ ...base, settings });
      assert.deepEqual(result, { lines: [], status: null });
    }
    assert.equal(calls.length, 0, "the setting off never calls Long-Term Memory");
    assert.equal(helper.getNoodleMemoryStatus(), null);
  }

  // On: one call with the selected characters; the persona only when it was passed.
  {
    const calls: Calls = [];
    const helper = loadHelper(
      fake({ version: 1, sections: [{ title: "Festival", text: "Alice hosts it." }, { text: "Bob is shy." }] }, calls),
    );
    const result = await helper.recallNoodleMemories({
      ...base,
      settings: { useLtmMemories: true },
      personaId: "persona-1",
    });
    assert.deepEqual(result, { lines: ["Festival: Alice hosts it.", "Bob is shy."], status: "ok" });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      caller: "noodle",
      queryText: base.queryText,
      characterIds: ["alice", "bob"],
      personaId: "persona-1",
      mode: "roleplay",
      maxTokens: 1200,
      whole: true,
    });
    await helper.recallNoodleMemories({ ...base, settings: { useLtmMemories: true, ltmMemoryRecall: "relevant" } });
    assert.equal("personaId" in calls[1], false, "no persona account, no personaId");
    assert.equal(calls[1].whole, false, "only the relevant parts when chosen");
    assert.equal(helper.getNoodleMemoryStatus(), "ok");
  }

  // Missing, refusing and failing recall: no memories, a status, and no throw.
  for (const [service, status] of [
    [null, "missing"],
    [{ version: 1 }, "missing"],
    [fake(null, []), "off"],
    [fake(new Error("boom"), []), "error"],
  ] as const) {
    const helper = loadHelper(service);
    const result = await helper.recallNoodleMemories({ ...base, settings: { useLtmMemories: true } });
    assert.deepEqual(result, { lines: [], status });
    assert.equal(helper.getNoodleMemoryStatus(), status);
  }

  // A registry that throws is an error status, not an unhandled rejection in the refresh.
  {
    const helper = loadHelper(null, true);
    const result = await helper.recallNoodleMemories({ ...base, settings: { useLtmMemories: true } });
    assert.deepEqual(result, { lines: [], status: "error" });
  }

  // A stale status never outlives the setting: turning it off clears what the last read said.
  {
    const helper = loadHelper(fake(new Error("boom"), []));
    await helper.recallNoodleMemories({ ...base, settings: { useLtmMemories: true } });
    assert.equal(helper.getNoodleMemoryStatus(), "error");
    await helper.recallNoodleMemories({ ...base, settings: { useLtmMemories: false } });
    assert.equal(helper.getNoodleMemoryStatus(), null);
  }

  // Limits of the recall contract: 20 characters, 8,000 characters of query text, nothing to ask about.
  {
    const calls: Calls = [];
    const helper = loadHelper(fake({ sections: [] }, calls));
    const ids = Array.from({ length: 25 }, (_, index) => `c${index}`);
    await helper.recallNoodleMemories({
      characterIds: ids,
      queryText: "x".repeat(9000),
      settings: { useLtmMemories: true },
    });
    assert.equal((calls[0].characterIds as string[]).length, 20);
    assert.equal((calls[0].queryText as string).length, 8000);
    await helper.recallNoodleMemories({ characterIds: [], queryText: "x", settings: { useLtmMemories: true } });
    assert.equal(calls.length, 1, "no character and no persona leaves nothing to recall");
    assert.equal(helper.noodleMemoryQueryText(["a", " ", "b"], ["Alice"]), "a\nb");
    assert.equal(helper.noodleMemoryQueryText([], ["Alice", "Bob"]), "Alice, Bob");
  }

  // The prompt: the call site passes the selected characters and the persona only when its account
  // takes part, and the block sits between the chat context and the timeline, only with memories.
  const promptService = read("noodle/noodle-public-prompt.service.ts");
  assert.match(promptService, /characterIds: selectedCharacterIds,\s+personaId: input\.personaAccount\?\.entityId,/);
  const startMarker = "const timelineFeatureInstructions = noodleTimelineFeatureInstructions(input.settings);";
  const tailSource = promptService.slice(promptService.indexOf(startMarker) + startMarker.length);
  assert.ok(promptService.includes(startMarker), "buildRefreshPrompt moved; update this regression");
  const tail = stripTypeScriptTypes(`async function buildRefreshPromptTail() {${tailSource}`);
  const buildContext = (memoryLines: string[]) => {
    const context = {
      input: {
        settings: {},
        personaAccount: null,
        timeZone: "UTC",
        debugMode: false,
        imageCaptioning: { enabled: false },
      },
      memoryLines,
      recentPosts: [],
      recentInteractions: [],
      recalledPosts: [],
      recalledInteractions: [],
      activeAccountList: "",
      personaContext: "",
      characterContext: "",
      characterScheduleContext: "",
      loreContext: "",
      randomUserContext: "",
      chatContext: "CHATS",
      enhancedTimelineWriting: false,
      timelineFeatureInstructions: [],
      activeCharacters: [],
      activeRandomUsers: [],
      system: "",
      lorebookResult: null,
      AbortSignal,
      NOODLE_JSON_OUTPUT_HEADING: "",
      NOODLE_PERSONA_IDENTITY_INSTRUCTION: "",
      NOODLE_UNIQUE_CONTENT_INSTRUCTION: "",
      NOODLE_RECALLED_MEMORY_INSTRUCTION: "",
      NOODLE_LEGACY_RECALLED_MEMORY_INSTRUCTION: "",
      noodleTimelinePostTargetInstruction: () => "",
      formatNoodleCurrentTime: () => "Sunday",
      formatNoodleTimelineForPrompt: () => "TIMELINE",
      formatNoodleVisionManifest: () => "",
      prepareNoodleVisionAttachments: async () => [],
      generateImageCaptionsForDataUrls: async () => [],
      collectNoodlePromptImageCandidates: () => [],
    };
    return runInNewContext(`${tail}\nbuildRefreshPromptTail();`, context) as Promise<{ promptForLog: string }>;
  };
  {
    const on = (await buildContext(["Festival: Alice hosts it."])).promptForLog;
    const chats = on.indexOf("CHATS");
    const block = on.indexOf("# What Long-Term Memory remembers");
    const timeline = on.indexOf("# Recent Noodle Timeline");
    assert.ok(chats >= 0 && chats < block && block < timeline, "memories sit between chats and the timeline");
    assert.ok(on.indexOf("Festival: Alice hosts it.", block) < timeline);
    const off = (await buildContext([])).promptForLog;
    assert.doesNotMatch(off, /Long-Term Memory/, "no memories, no block");
  }

  // Settings: three new keys, off and "whole" by default; the booleans are coerced and a third
  // recall value never replaces a valid one.
  const storage = read("storage/noodle.storage.ts");
  assert.match(storage, /useLtmMemories: false,\s+ltmMemoriesConfirmed: false,\s+ltmMemoryRecall: "whole",/);
  assert.match(storage, /patch\.useLtmMemories = bool\(patch\.useLtmMemories\)/);
  assert.match(storage, /patch\.ltmMemoriesConfirmed = bool\(patch\.ltmMemoriesConfirmed\)/);
  assert.match(
    storage,
    /patch\.ltmMemoryRecall !== "whole" && patch\.ltmMemoryRecall !== "relevant"\) \{\s+delete patch\.ltmMemoryRecall;/,
  );
  assert.match(
    readFileSync(
      new URL("../packages/noodle/src/engine/packages/server/src/routes/noodle.routes.ts", import.meta.url),
      "utf8",
    ),
    /app\.get\("\/memory-status"/,
  );

  // The recorded "off" outlives the switch that caused it, so the status the screen shows is checked
  // against Long-Term Memory's current setting. Only "off" costs that read; a read that fails keeps "off".
  const clientDir = "../packages/noodle/src/engine/packages/client/src";
  const readClient = (path: string) => readFileSync(new URL(`${clientDir}/${path}`, import.meta.url), "utf8");
  const sharing = runInNewContext(
    `${stripTypeScriptTypes(readClient("components/noodle/noodle-ltm-sharing.ts").replace(/^export /gm, ""))}\n({ currentMemoryStatus, offerLtmSharing });`,
  ) as {
    currentMemoryStatus: (deps: {
      read: () => Promise<{ status: Status }>;
      readLtm: () => Promise<{ longTermMemoryShareWithPackages?: boolean }>;
    }) => Promise<{ status: Status }>;
    offerLtmSharing: (deps: {
      read: () => Promise<{ longTermMemoryShareWithPackages?: boolean }>;
      confirm: () => Promise<boolean>;
      save: () => Promise<unknown>;
    }) => Promise<"skipped" | "declined" | "enabled">;
  };
  const statusFor = async (status: Status, ltm: { longTermMemoryShareWithPackages?: boolean } | Error) => {
    let ltmReads = 0;
    const result = await sharing.currentMemoryStatus({
      read: async () => ({ status }),
      readLtm: async () => {
        ltmReads += 1;
        if (ltm instanceof Error) throw ltm;
        return ltm;
      },
    });
    return { status: result.status, ltmReads };
  };
  assert.deepEqual(await statusFor("off", { longTermMemoryShareWithPackages: true }), { status: null, ltmReads: 1 });
  assert.deepEqual(await statusFor("off", {}), { status: null, ltmReads: 1 }, "an unset switch is on");
  assert.deepEqual(await statusFor("off", { longTermMemoryShareWithPackages: false }), { status: "off", ltmReads: 1 });
  assert.deepEqual(await statusFor("off", new Error("unreadable")), { status: "off", ltmReads: 1 });
  for (const status of ["ok", "missing", "error", null] as const) {
    assert.deepEqual(await statusFor(status, { longTermMemoryShareWithPackages: false }), { status, ltmReads: 0 });
  }
  const hookSource = readClient("hooks/use-noodle.ts");
  assert.match(hookSource, /queryFn: \(\) =>\s+currentMemoryStatus\(\{[\s\S]*?"\/noodle\/memory-status"/);
  assert.match(hookSource, /"\/long-term-memory\/settings"/);
  assert.match(hookSource, /refetchOnMount: "always"/);

  // Turning the switch on while Long-Term Memory sharing is off asks once, and only a yes writes that
  // one setting. A read that fails, or sharing already on, never asks.
  const offerFor = async (ltm: { longTermMemoryShareWithPackages?: boolean } | Error, answer: boolean) => {
    const calls = { confirm: 0, save: 0 };
    const result = await sharing.offerLtmSharing({
      read: async () => {
        if (ltm instanceof Error) throw ltm;
        return ltm;
      },
      confirm: async () => {
        calls.confirm += 1;
        return answer;
      },
      save: async () => {
        calls.save += 1;
      },
    });
    return { result, ...calls };
  };
  assert.deepEqual(await offerFor({ longTermMemoryShareWithPackages: false }, true), {
    result: "enabled",
    confirm: 1,
    save: 1,
  });
  assert.deepEqual(await offerFor({ longTermMemoryShareWithPackages: false }, false), {
    result: "declined",
    confirm: 1,
    save: 0,
  });
  for (const on of [{ longTermMemoryShareWithPackages: true }, {}]) {
    assert.deepEqual(await offerFor(on, true), { result: "skipped", confirm: 0, save: 0 });
  }
  assert.deepEqual(await offerFor(new Error("unreadable"), true), { result: "skipped", confirm: 0, save: 0 });
  // The save writes only the sharing switch, and a failed save reaches the caller for the toast.
  const homeSource = readClient("components/noodle/NoodleHome.tsx");
  assert.match(
    homeSource,
    /save: \(\) => api\.put\("\/long-term-memory\/settings", \{ longTermMemoryShareWithPackages: true \}\)/,
  );
  assert.match(
    homeSource,
    /\.catch\(\(\) => toast\.error\(localizeUi\("ui\.noodle\.noodlehome\.ltmSharingOfferFailed"\)\)\)/,
  );
  // The offer follows Noodle's own save, after the first-time confirmation is accepted, and never runs
  // when the switch is turned off.
  const toggle = homeSource.slice(homeSource.indexOf("const toggleLtmMemories"));
  const toggleBody = toggle.slice(0, toggle.indexOf("\n  };"));
  assert.match(
    toggleBody,
    /if \(!confirmed\) return;\s+saveSettings\(\{ useLtmMemories: true, ltmMemoriesConfirmed: true \}, offerSharing\);/,
  );
  assert.match(toggleBody, /saveSettings\(\{ useLtmMemories: checked \}, checked \? offerSharing : undefined\);/);
  assert.equal(
    toggleBody.match(/offerSharing/g)?.length,
    2,
    "the offer is only reachable from the two switch-on saves",
  );
  assert.match(homeSource, /onSuccess: onSaved,/);
  assert.match(homeSource, /if \(result === "enabled"\) void memoryStatusQuery\.refetch\(\);/);
  // The five strings exist in every locale.
  for (const locale of ["en", "de", "ko", "pl"]) {
    const strings = JSON.parse(readClient(`localization/locales/${locale}.json`)) as Record<string, string>;
    for (const key of ["Title", "Message", "Confirm", "Cancel", "Failed"]) {
      assert.ok(
        strings[`ui.noodle.noodlehome.ltmSharingOffer${key}`]?.trim(),
        `${locale} is missing ltmSharingOffer${key}`,
      );
    }
  }

  console.log("noodle-ltm-recall regression: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
