/**
 * Task A: adding several Creators at once.
 *
 * Root cause: the bulk route drafted four stage profiles at once on the player's writing
 * connection. Slurp calls its bundled provider directly, so it gets none of the Engine's
 * per-connection pacing or its pause-and-retry on a rate limit that chat, role-play and Noodle get.
 * A connection that allows one request at a time (a free tier, a proxy cap, a phone-local model)
 * refused the burst, and the bulk add failed while every other mode kept working. The reproduction
 * below runs the Engine's own worker pool at the concurrency the route uses against such a
 * connection.
 *
 * Second lead (simulation): with a flaky resolver the Engine's outbound-URL guard failed single
 * Creators with `getaddrinfo EAI_AGAIN` (one `dns.lookup` per call, four in parallel, no retry).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settleAgentJobsWithConcurrencyLimit } from "../sources/engine/packages/server/src/services/agents/agent-concurrency.ts";
import {
  slpCheckProviderHost,
  slpIsRateLimitError,
  slpRetryProviderCall,
  slpSettleAdaptive,
  slpTransientNetworkCode,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/model/slp-provider-retry.ts";
import {
  noodlerConcealedSourceText,
  slpCreatorSourceText,
  slpResolveCardMacros,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/prompting/slp-prompt-safety.ts";
import {
  appearanceEvidenceFromSource,
  parseSlpAppearanceCandidate,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-appearance-profile.ts";

const root = new URL("../packages/slurp2/src/engine/packages/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const routes = read("server/src/slp/features/onboarding/slp-onboarding-routes.ts");
const draft = read("server/src/slp/features/creators/slp-stage-profile-draft-service.ts");
const queue = read("server/src/slp/features/onboarding/slp-first-post-queue-service.ts");
const wizard = read("client/src/slp/features/onboarding/slp-onboarding-wizard-model.ts");
const steps = read("client/src/slp/features/onboarding/SlpOnboardingSteps.tsx");
const supportMigration = read("server/src/slp/data/messages/slp-support-migration.ts");
const appearance = read("server/src/slp/features/media/slp-appearance-service.ts");
const publicImages = read("server/src/slp/features/media/slp-public-images-service.ts");
// de, ko and pl carry no wizard completion copy yet and fall back to English, like these keys' neighbours.
const en = JSON.parse(read("client/src/slp/locales/en.json")) as Record<string, string>;

/** A connection that serves one request at a time and answers a second one with HTTP 429. */
function oneAtATimeConnection() {
  let inFlight = 0;
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async chatComplete(id: string) {
      calls += 1;
      if (inFlight > 0) throw new Error("OpenAI-compatible API error 429: Too many concurrent requests");
      inFlight += 1;
      try {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return `{"displayName":"${id}"}`;
      } finally {
        inFlight -= 1;
      }
    },
  };
}

async function main() {
  // --- Reproduction: the pool the route really uses, on a one-at-a-time connection. ---
  // G8 (orchestrator decision on A): two at a time, one at a time after the first "too many
  // requests". The one refusal is waited out by the retry every Slurp provider carries now.
  const concurrencyMatch = /slpSettleAdaptive\(\s*noodleAccountIds,[\s\S]*?\n\s*([A-Z_]+|\d+),\n\s*\);/u.exec(routes);
  assert.ok(concurrencyMatch, "The bulk route drafts its Creators through the adaptive pool");
  const concurrencyToken = concurrencyMatch[1]!;
  const concurrency = /^\d+$/u.test(concurrencyToken)
    ? Number(concurrencyToken)
    : Number(new RegExp(`const ${concurrencyToken} = (\\d+);`, "u").exec(routes)?.[1]);
  assert.equal(concurrency, 2, "A bulk add starts two at a time");
  assert.match(routes, /onRateLimit: slowDown/u, "the draft tells the pool about a rate limit");
  const connection = oneAtATimeConnection();
  const creators = ["a", "b", "c", "d", "e"];
  const settled = await slpSettleAdaptive(
    creators,
    (id, slowDown) =>
      slpRetryProviderCall(() => connection.chatComplete(id), {
        delaysMs: [1, 1, 1],
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        onRateLimit: slowDown,
      }),
    concurrency,
  );
  assert.deepEqual(
    settled.map((entry) => entry.status),
    creators.map(() => "fulfilled"),
    "Every Creator of a bulk add gets its stage profile on a connection that takes one request at a time",
  );
  assert.ok(connection.calls <= creators.length + 1, `At most the first burst is refused once (${connection.calls})`);
  // Without the adaptive pool, the old four-wide burst loses Creators on the same connection.
  const burst = oneAtATimeConnection();
  const old = await settleAgentJobsWithConcurrencyLimit(creators, 4, (id) => burst.chatComplete(id));
  assert.ok(
    old.some((entry) => entry.status === "rejected"),
    "the old burst is refused",
  );
  // Both running items refused at the same moment: each used to wait for the other to stop.
  let bothRefused = 0;
  const together = await Promise.race([
    slpSettleAdaptive(
      ["x", "y", "z"],
      async (id, slowDown) => {
        if (bothRefused < 2) {
          bothRefused += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          await slowDown();
        }
        return id;
      },
      2,
    ),
    new Promise<"hung">((resolve) => setTimeout(() => resolve("hung"), 2_000)),
  ]);
  assert.notEqual(together, "hung", "two items refused together do not wait for each other forever");

  // --- A refused request is paused and sent again, as the Engine does for chat. ---
  assert.equal(slpIsRateLimitError(new Error("OpenAI-compatible API error 429: slow down")), true);
  assert.equal(slpIsRateLimitError(new Error("Anthropic API error 529: overloaded")), true);
  assert.equal(slpIsRateLimitError(new Error("Google error: RESOURCE_EXHAUSTED quota")), true);
  assert.equal(slpIsRateLimitError(new Error("Rate limit reached for requests")), true);
  assert.equal(slpIsRateLimitError(new Error("OpenAI-compatible API error 401: bad key")), false);
  assert.equal(slpIsRateLimitError(new Error("max_tokens must be at most 4290")), false);
  assert.equal(slpIsRateLimitError("429"), false, "Only a thrown Error is classified");

  {
    const waits: number[] = [];
    let attempts = 0;
    const value = await slpRetryProviderCall(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("OpenAI-compatible API error 429: Too many requests");
        return "ok";
      },
      { delaysMs: [10, 20, 30], sleep: async (ms) => void waits.push(ms) },
    );
    assert.equal(value, "ok");
    assert.equal(attempts, 3);
    assert.deepEqual(waits, [10, 20], "Each retry waits its own step of the backoff");
  }
  {
    let attempts = 0;
    await assert.rejects(
      slpRetryProviderCall(
        async () => {
          attempts += 1;
          throw new Error("OpenAI-compatible API error 401: bad key");
        },
        { delaysMs: [1], sleep: async () => undefined },
      ),
      /401/u,
    );
    assert.equal(attempts, 1, "Anything but a rate limit fails at once");
  }
  {
    let attempts = 0;
    await assert.rejects(
      slpRetryProviderCall(
        async () => {
          attempts += 1;
          throw new Error("OpenAI-compatible API error 429: still busy");
        },
        { delaysMs: [1, 1], sleep: async () => undefined },
      ),
      /429: still busy/u,
    );
    assert.equal(attempts, 3, "The retry budget is bounded");
  }

  // --- DNS hiccups (EAI_AGAIN / ENOTFOUND) are waited out too, and checked once per batch. ---
  const dnsError = Object.assign(new Error("getaddrinfo EAI_AGAIN api.example.com"), { code: "EAI_AGAIN" });
  assert.equal(slpTransientNetworkCode(dnsError), "EAI_AGAIN", "The URL guard's own dns.lookup error");
  assert.equal(
    slpTransientNetworkCode(new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } })),
    "ENOTFOUND",
    "A failed connect carries the code on its cause",
  );
  assert.equal(slpTransientNetworkCode(new Error("x getaddrinfo EAI_AGAIN host")), "EAI_AGAIN");
  assert.equal(slpTransientNetworkCode(new Error("OpenAI-compatible API error 401: bad key")), null);
  assert.equal(slpTransientNetworkCode(Object.assign(new Error("refused"), { code: "ECONNREFUSED" })), null);
  {
    let attempts = 0;
    const value = await slpRetryProviderCall(
      async () => {
        attempts += 1;
        if (attempts < 3) throw dnsError;
        return "ok";
      },
      { delaysMs: [1, 1, 1], sleep: async () => undefined },
    );
    assert.equal(value, "ok");
    assert.equal(attempts, 3, "A draft call that hits EAI_AGAIN is sent again");
  }
  {
    const looked: string[] = [];
    let fails = 2;
    const flaky = async (host: string) => {
      looked.push(host);
      if (fails-- > 0) throw dnsError;
      return [{ address: "203.0.113.5", family: 4 }];
    };
    const quick = { delaysMs: [1, 1, 1], sleep: async () => undefined };
    assert.equal(await slpCheckProviderHost("https://api.example.com/v1", { ...quick, lookup: flaky }), null);
    assert.deepEqual(looked, ["api.example.com", "api.example.com", "api.example.com"], "Retried, then resolved");
    const down = async () => {
      throw dnsError;
    };
    assert.deepEqual(await slpCheckProviderHost("https://api.example.com/v1", { ...quick, lookup: down }), {
      host: "api.example.com",
      code: "EAI_AGAIN",
    });
    const never = async () => {
      throw new Error("must not look up");
    };
    for (const url of [
      "http://127.0.0.1:5001/v1",
      "http://[::1]:8080",
      "http://localhost:11434",
      "claude-agent-sdk://local",
      "not a url",
    ]) {
      assert.equal(await slpCheckProviderHost(url, { ...quick, lookup: never }), null, `${url} is not looked up`);
    }
  }
  {
    const checkAt = routes.indexOf("await slpCheckProviderHost(resolveBaseUrl(connection))");
    const poolAt = routes.indexOf("slpSettleAdaptive(");
    assert.ok(checkAt > 0 && checkAt < poolAt, "The route checks the host once, before the Creators run");
    assert.match(routes, /slpTransientNetworkCode\(error\)/u, "A Creator lost to DNS gets its own reason");
  }

  // --- Wiring: the draft retries both of its calls; the route tells the player what happened. ---
  assert.match(
    draft,
    /const provider = \{\s*chatComplete: [^}]*slpRetryProviderCall\(\(\) => fallbackProvider\.chatComplete\(/u,
    "Every call of the draft (the first and its correction turn) waits out a rate limit",
  );
  assert.match(routes, /slpIsRateLimitError\(error\)/u, "A refused bulk draft gets its own reason");
  assert.match(routes, /retryable: string\[\]|retryable\.push\(noodleAccountId\)/u);

  // --- First posts: a Creator busy with its artwork or reserve waits instead of failing. ---
  assert.match(queue, /FIRST_POST_BUSY_WAIT_MS/u);
  assert.doesNotMatch(
    queue,
    /RETRYABLE_STATUSES\.has\(result\.status\) && attempt < MAX_ATTEMPTS/u,
    "A busy Creator no longer burns one of three attempts; it never reached the model",
  );

  // --- Slurp Support migration: the factory it used throws without core storage, so it failed at every start. ---
  assert.match(supportMigration, /import \{ createSlurpMessagesStorage \} from "\.\.\/slp-storage\.js";/u);
  assert.doesNotMatch(
    supportMigration,
    /import \{[^}]*createSlurpMessagesStorage[^}]*\} from "\.\/slp-messages-storage\.js"/u,
    "The storage-less messages factory must not be the one the migration calls",
  );

  // --- Card macros: the stage-profile and appearance prompts see the person, not `{{char}}`. ---
  const card = {
    name: "Ember",
    description: "{{char}} is a red dragon with gold horns. {{ Char }} teases {{user}} a lot.",
    personality: "Proud.",
    extensions: { appearance: "{{char}} has amber eyes." },
  };
  const open = slpCreatorSourceText(card);
  assert.doesNotMatch(open, /\{\{/u, "The open stage-profile card text resolves every macro");
  assert.match(open, /Ember is a red dragon with gold horns\. Ember teases the player a lot\./u);
  assert.match(open, /Appearance: Ember has amber eyes\./u);
  const concealed = noodlerConcealedSourceText(card);
  assert.doesNotMatch(concealed, /\{\{/u, "The hinted brief resolves every macro");
  assert.doesNotMatch(concealed, /Ember/u, "The hinted brief never puts the source name in the prompt");
  assert.match(concealed, /the Creator is a red dragon/u);
  // The appearance answer quotes the card with the name in place; checked against raw card text that
  // quote was "not in the card", no appearance was saved, and posts went out without a picture.
  const answer = JSON.stringify({
    appearance: "Red dragon, gold horns",
    evidence: "Ember is a red dragon with gold horns",
    confidence: "high",
  });
  assert.equal(
    parseSlpAppearanceCandidate(answer, card.description, false),
    null,
    "Control: the raw card rejects the quote",
  );
  assert.ok(
    parseSlpAppearanceCandidate(answer, slpResolveCardMacros(card.description, card.name), false),
    "The resolved card accepts the model's quote",
  );
  assert.match(
    appearance,
    /const sourceText = slpResolveCardMacros\(/u,
    "The appearance call and its evidence check use resolved text",
  );

  // The card's own appearance goes straight into picture prompts on both paths.
  const evidence = appearanceEvidenceFromSource(
    {
      publicDisplayName: "Ember",
      publicHandle: "ember",
      name: "Ember",
      description: "",
      personality: "",
      scenario: "",
      appearance: "{{char}} has amber eyes and gold horns.",
      backstory: "",
    },
    "c-ember",
  );
  assert.equal(evidence.sourceAppearance, "Ember has amber eyes and gold horns.");
  assert.match(
    publicImages,
    /export function characterAppearanceFromRow[\s\S]{0,300}slpResolveCardMacros\(readIllustratorAppearance\(data\)/u,
    "The row appearance used for pictures resolves macros",
  );

  // --- Wizard: writing is not shown as a failure, and failed Creators can be retried alone. ---
  assert.match(wizard, /setCompletion\(settingsSaved \? "writing" : "settingsFailed"\)/u);
  assert.doesNotMatch(wizard, /setCompletion\(settingsSaved \? "partial" : "settingsFailed"\)/u);
  assert.match(wizard, /retryFailedCreations/u);
  assert.match(steps, /retryFailedCreations/u);
  for (const key of [
    "ui.noodle.noodlerwizard.completion.writing.title",
    "ui.noodle.noodlerwizard.completion.writing.detail",
    "ui.noodle.noodlerwizard.retryFailedCreations",
  ]) {
    assert.ok(en[key]?.trim(), `en has ${key}`);
  }
}

main().then(
  () => console.log("slurp2-bulk-add regression passed"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
