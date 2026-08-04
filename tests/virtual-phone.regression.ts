// ──────────────────────────────────────────────
// Virtual Phone regression
//
// Covers the package-owned logic that does not need a model connection: the app
// catalog, template routing and slot integrity, prompt scoping rules, and the
// tolerant JSON parsing the page route depends on.
//
//   cd ../Marinara-Engine
//   MARINARA_ENGINE_ROOT="$PWD" pnpm --filter @marinara-engine/server exec tsx \
//     "$PWD/../Marinara-Agents/tests/virtual-phone.regression.ts"
// ──────────────────────────────────────────────
import assert from "node:assert/strict";

async function main() {
const base = new URL(
  "../packages/virtual-phone/src/engine/packages/server/src/services/virtual-phone/",
  import.meta.url,
);

const { PHONE_APPS, defaultInstalledApps, findApp, findAppByUrl, listApps } = await import(
  new URL("apps.ts", base).href
);
const { PHONE_TEMPLATES, extractSlots, fillSlots, findTemplate } = await import(
  new URL("templates.ts", base).href
);
const { buildFullPagePrompt, buildSlotFillPrompt, parseStructuredResponse } = await import(
  new URL("prompt.ts", base).href
);
const { selfCheck } = await import(new URL("server-entry.ts", base).href);

// ── App catalog ───────────────────────────────────────────────────────────
{
  const ids = PHONE_APPS.map((app) => app.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate app ids");
  const domains = PHONE_APPS.map((app) => app.domain);
  assert.equal(new Set(domains).size, domains.length, "duplicate app domains");

  assert.ok(findApp("noodle"), "noodle app missing");
  assert.ok(findApp("noodler"), "noodler app missing");
  assert.equal(findApp("does-not-exist"), null);

  // Noodle ships preinstalled; Noodler must be opted into.
  const preinstalled = defaultInstalledApps();
  assert.ok(preinstalled.includes("noodle"), "noodle should be preinstalled");
  assert.ok(!preinstalled.includes("noodler"), "noodler must not be preinstalled");

  // Noodler is store-visible but never preinstalled; its own page owns the age gate.
  assert.ok(listApps().some((app) => app.id === "noodler" && app.adult), "noodler missing from the catalog");

  // URL ownership, including subdomains and the miss case.
  assert.equal(findAppByUrl("https://noodle.social/@mira_k")?.id, "noodle");
  assert.equal(findAppByUrl("https://www.noodler.social/vexline")?.id, "noodler");
  assert.equal(findAppByUrl("https://example.invalid/")?.id, undefined);
}

// ── Templates ─────────────────────────────────────────────────────────────
{
  // Every declared slot exists in the markup, and vice versa. selfCheck enforces
  // the same contract at install time.
  for (const template of PHONE_TEMPLATES) {
    const markup = extractSlots(template.html).sort();
    assert.deepEqual(markup, [...template.slots].sort(), `${template.id} slot mismatch`);
    for (const slot of template.slots) {
      assert.ok(template.slotDoc.includes(slot), `${template.id} slotDoc does not document "${slot}"`);
    }
  }
  const report = await selfCheck();
  assert.equal(report.ok, true);
  assert.equal(report.templates, PHONE_TEMPLATES.length);

  // Routing: profile paths beat the catch-all feed, and each app keeps its own.
  assert.equal(findTemplate("noodle", "https://noodle.social/")?.id, "noodle/feed");
  assert.equal(findTemplate("noodle", "https://noodle.social/@mira_k")?.id, "noodle/profile");
  assert.equal(findTemplate("noodler", "https://noodler.social/feed")?.id, "noodler/home");
  assert.equal(findTemplate("noodler", "https://noodler.social/vexline")?.id, "noodler/profile");
  assert.equal(findTemplate("notes", "https://notes.phone/"), null, "apps without templates must fall through");

  // Slot filling drops unfilled slots rather than leaking the marker.
  const feed = PHONE_TEMPLATES.find((template) => template.id === "noodle/feed")!;
  const filled = fillSlots(feed.html, { posts: "<article>hi</article>" });
  assert.ok(filled.includes("<article>hi</article>"));
  assert.ok(!filled.includes("SLOT:"), "an unfilled slot marker survived");
}

// ── Prompts ───────────────────────────────────────────────────────────────
{
  const noodle = findApp("noodle")!;
  const noodler = findApp("noodler")!;
  const feed = findTemplate("noodle", "https://noodle.social/")!;
  const noodlerFeed = findTemplate("noodler", "https://noodler.social/feed")!;

  const context = {
    url: "https://noodle.social/",
    characters: ["Mira Kovač"],
    persona: "Alex",
    chatSummary: "The kitchen argument is still going.",
    recentMessages: [{ role: "user", content: "check your phone" }],
    lastAction: "Tapped Noodle",
  };
  const slotPrompt = buildSlotFillPrompt(noodle, feed, context)[0].content;
  // Scene context must reach the model, or posts will not match the story.
  assert.match(slotPrompt, /Mira Kovač/);
  assert.match(slotPrompt, /kitchen argument/);
  assert.match(slotPrompt, /Tapped Noodle/);
  // Scoping rules that keep the simulation in its lane.
  assert.match(slotPrompt, /Never write posts as the user's persona/);
  assert.match(slotPrompt, /Never mention Twitter, X, or any\s+real platform/);
  assert.match(slotPrompt, /390px wide in portrait/);
  assert.match(slotPrompt, /Adult content belongs on Noodler/);

  const noodlerPrompt = buildSlotFillPrompt(noodler, noodlerFeed, {
    url: "https://noodler.social/feed",
  })[0].content;
  assert.match(noodlerPrompt, /Match the content level this chat has already established/);
  assert.match(noodlerPrompt, /Every creator on Noodler is an adult/);
  assert.match(noodlerPrompt, /Never escalate past the story/);

  // Apps without a template still get the phone framing.
  const full = buildFullPagePrompt(findApp("notes")!, { url: "https://notes.phone/" })[0].content;
  assert.match(full, /390px wide in portrait/);
  assert.match(full, /never look like bare unstyled HTML/);
  assert.match(full, /"html"/);
}

// ── Tolerant response parsing ─────────────────────────────────────────────
{
  assert.deepEqual(parseStructuredResponse('{"title":"Noodle"}'), { title: "Noodle" });
  assert.deepEqual(parseStructuredResponse('```json\n{"title":"Noodle"}\n```'), { title: "Noodle" });
  assert.deepEqual(parseStructuredResponse('Sure!\n{"title":"Noodle"}\nHope that helps.'), { title: "Noodle" });
  assert.equal(parseStructuredResponse("no json here"), null);
  assert.equal(parseStructuredResponse(null), null);
}

console.log("ok — virtual-phone catalog, templates, prompts, parsing");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
