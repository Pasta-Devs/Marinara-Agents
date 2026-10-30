// Otome Forge in the Engine's Home tab: the setup wizard (with stubbed /api/otome-forge routes, connections, personas
// and cards), the 18+ gate when Explicit is picked, forging with Retry and paint consent, the stage at desktop and phone
// sizes, and one visit to the real package server (beside Gacha Forge when MARINARA_PACKAGE_IDS installs it).
// Run: node scripts/run-package-browser-tests.mjs otome-forge tests/package-otome-forge.e2e.ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const GATE_TEXT = "I am 18 or older. Love interests are always adults. This is fiction.";
const PREMISE = "In a city of clockwork canals, an apprentice sees a murder at the masked ball.";

type Json = Record<string, any>;
interface Call {
  method: string;
  path: string;
  query: Record<string, string>;
  body: Json | undefined;
}

/** The M1 routes, answered in memory. One bible fails once, so Retry is exercised. */
function createOtomeStub() {
  const calls: Call[] = [];
  const index: Json = { version: 1, runs: [], activeRun: null, ageGate: null, lastOpenedAt: null };
  let run: Json | null = null;
  let failed = false;
  const now = () => new Date().toISOString();

  // Each poll finishes the running step and starts the next one.
  const advance = () => {
    if (!run) return;
    const steps: Json[] = run.forge.steps;
    const running = steps.find((step) => step.state === "running");
    if (running) {
      if (running.id === "bible:li-b-0002" && !failed) {
        failed = true;
        running.state = "failed";
        running.error = "Model returned prose instead of JSON";
      } else running.state = "done";
    }
    const next = steps.find((step) => step.state === "pending");
    if (next) next.state = "running";
    const textDone = steps.filter((step) => !step.id.startsWith("paint:")).every((step) => step.state === "done");
    run.forge.phase = textDone ? "ready" : "forging";
  };

  const answer = (call: Call): { status: number; json: unknown } => {
    calls.push(call);
    const path = call.path.replace(/^\/api\/otome-forge/u, "");
    if (path === "/index") return { status: 200, json: { index } };
    if (path === "/index/opened") return { status: 200, json: { index: { ...index, lastOpenedAt: now() } } };
    if (path === "/age-gate") {
      index.ageGate = { confirmedAt: now() };
      return { status: 200, json: { ageGate: index.ageGate } };
    }
    if (path === "/premise/suggest") return { status: 200, json: { premise: PREMISE } };
    if (path === "/runs" && call.method === "POST") {
      const setup = call.body!.setup;
      const gated = setup.content.heat !== "sfw" || setup.content.darkness === "dark" || setup.images.rating !== "sfw";
      if (gated && !index.ageGate) return { status: 403, json: { error: "18+ gate", code: "age-gate" } };
      const lis = setup.lis.map((li: Json, i: number) => ({
        id: `li-${"abcde"[i]}-000${i + 1}`,
        name: li.source === "card" ? (li.cardId === "card-ilvar" ? "Ilvar Thorne" : "Dottore") : li.name,
        pronouns: li.pronouns,
        source: li.source,
        accent: "#E7A6B8",
        level: 1,
        stage: 1,
      }));
      const forge = {
        phase: "forging",
        steps: [
          { id: "world-plan", state: "pending" },
          ...lis.map((li: Json) => ({ id: `bible:${li.id}`, state: "pending" })),
          ...lis.map((li: Json) => ({ id: `paint:${li.id}`, state: "waiting-consent" })),
          { id: "paint:player", state: "waiting-consent" },
        ],
      };
      run = {
        runKey: "r-e2e-abc123",
        world: {
          version: 1,
          title: "The Clockwork Masquerade",
          premise: setup.premise,
          language: setup.language,
          createdAt: now(),
          setting: "",
          mystery: { question: "Who killed the duke?" },
          web: [],
          openingSituation: "",
          content: setup.content,
          images: setup.images,
          connections: setup.connections,
          forge,
        },
        player: { personaId: setup.protagonist.personaId, name: "Mira Vale", pronouns: setup.protagonist.pronouns },
        lis,
        forge,
        starlight: 2000,
      };
      index.runs.push({ runKey: run.runKey, title: run.world.title, createdAt: now(), lastPlayedAt: null });
      return { status: 200, json: { run: run.runKey, view: structuredClone(run) } };
    }
    if (run && path === `/runs/${run.runKey}`) {
      advance();
      return { status: 200, json: { view: structuredClone(run) } };
    }
    if (run && path === `/runs/${run.runKey}/activate`) {
      index.activeRun = run.runKey;
      return { status: 200, json: { index } };
    }
    if (run && path === `/runs/${run.runKey}/forge/retry`) {
      run.forge.steps.find((step: Json) => step.id === call.body!.step).state = "pending";
      run.forge.phase = "forging";
      return { status: 200, json: { forge: run.forge } };
    }
    if (run && path === `/runs/${run.runKey}/forge/consent`) {
      for (const id of call.body!.steps) run.forge.steps.find((step: Json) => step.id === id).state = "pending";
      return { status: 200, json: { forge: run.forge } };
    }
    return { status: 404, json: { error: `No stub for ${call.method} ${call.path}`, code: "not-found" } };
  };
  return { calls, index, answer };
}

async function stubEngine(page: Page, stub: ReturnType<typeof createOtomeStub>) {
  await page.route("**/api/connections", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: [
            { id: "conn-text", name: "Story fixture", provider: "custom", model: "fixture", isDefault: "true" },
            { id: "conn-image", name: "Image fixture", provider: "image_generation", model: "fixture-image" },
          ],
        })
      : route.continue(),
  );
  await page.route("**/api/characters/personas/list**", (route) =>
    route.fulfill({ json: [{ id: "persona-mira", name: "Mira Vale", avatarPath: null }] }),
  );
  // Two pages, so the picker has to follow hasMore.
  await page.route("**/api/characters/catalog**", (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset") ?? 0);
    return route.fulfill({
      json:
        offset === 0
          ? { items: [{ id: "card-ilvar", name: "Ilvar Thorne", avatarPath: null }], hasMore: true }
          : { items: [{ id: "card-dottore", name: "Dottore", avatarPath: null }], hasMore: false },
    });
  });
  await page.route("**/api/otome-forge/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { status, json } = stub.answer({
      method: request.method(),
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: request.method() === "POST" ? request.postDataJSON() : undefined,
    });
    await route.fulfill({ status, json });
  });
}

async function openOtomeForge(page: Page): Promise<Locator> {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((version) => {
    localStorage.removeItem("otome-forge:setup-draft:v1");
    localStorage.setItem("marinara:whats-new:seen-version", version);
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, appAccentPulseMode: false },
        version: 65,
      }),
    );
  }, appVersion);
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Otome Hearth" }).click();
  const root = page.locator("marinara-capability-otome-forge .of-root");
  await expect(root).toBeVisible({ timeout: 60_000 });
  return root;
}

/** Picks a radio drawn as a pill or card (the input itself is visually hidden). */
const pick = (scope: Locator, label: string | RegExp) =>
  scope.locator("label").filter({ hasText: label }).first().click();

test("Otome Forge: the wizard makes a world, asks the 18+ gate for Explicit, and forges with Retry and consent", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const mobile = testInfo.project.name.includes("mobile");
  const stub = createOtomeStub();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await stubEngine(page, stub);
  const root = await openOtomeForge(page);

  // The stage: 9:16 and centred on desktop, full-bleed on a phone.
  const stage = (await root.locator(".of-stage").boundingBox())!;
  const viewport = page.viewportSize()!;
  // Full-bleed on a phone: the stage spans the viewport but for its 1px edge on each side.
  if (mobile) expect(Math.abs(stage.width - viewport.width)).toBeLessThanOrEqual(2);
  else expect(Math.abs(stage.width / stage.height - 9 / 16)).toBeLessThan(0.01);
  await page.screenshot({ path: testInfo.outputPath("01-picker.png") });

  // 1. Story: Surprise me asks the story connection.
  await root.getByRole("button", { name: "Begin a new story" }).click();
  await expect(root.getByRole("heading", { name: "Where does it begin?" })).toBeVisible();
  await root.getByRole("button", { name: "Surprise me" }).click();
  await expect(root.getByLabel("Premise")).toHaveValue(PREMISE);
  const suggest = stub.calls.find((call) => call.path.endsWith("/premise/suggest"))!;
  expect(suggest.body).toMatchObject({ language: "English", connectionId: "conn-text" });
  await root.getByRole("button", { name: "Next" }).click();

  // 2. You: a persona and pronouns the player chooses.
  await expect(root.getByRole("heading", { name: "Who are you here?" })).toBeFocused();
  await pick(root, "Mira Vale");
  await pick(root.getByRole("group", { name: "Your pronouns" }), "she/her");
  await root.getByRole("button", { name: "Next" }).click();

  // 3. Cast: the card picker pages until hasMore clears; Next needs two LIs with pronouns.
  await expect(root.getByRole("heading", { name: "Who waits for you?" })).toBeVisible();
  await root.getByRole("button", { name: "Ilvar Thorne" }).click();
  await root.getByRole("button", { name: "Dottore" }).click();
  for (const name of ["Ilvar Thorne", "Dottore"]) {
    await pick(root.getByRole("group", { name: `Pronouns for ${name}` }), "he/him");
  }
  await page.screenshot({ path: testInfo.outputPath("02-cast.png") });
  await root.getByRole("button", { name: "Next" }).click();

  // 4. Content: Explicit asks the 18+ gate with the exact text; Not now keeps SFW, I confirm stores it.
  await expect(root.getByRole("heading", { name: "How tender, how dark?" })).toBeVisible();
  await pick(root, "NSFW: Explicit");
  const gate = page.getByRole("dialog", { name: "Before we go further" });
  await expect(gate).toContainText(GATE_TEXT);
  await page.screenshot({ path: testInfo.outputPath("03-age-gate.png") });
  await gate.getByRole("button", { name: "Not now" }).click();
  await expect(gate).toBeHidden();
  await expect(root.getByRole("radio", { name: /NSFW: Explicit/ })).not.toBeChecked();
  expect(stub.index.ageGate).toBeNull();
  await pick(root, "NSFW: Explicit");
  await gate.getByRole("button", { name: "I confirm" }).click();
  await expect(gate).toBeHidden();
  await expect(root.getByRole("radio", { name: /NSFW: Explicit/ })).toBeChecked();
  expect(stub.index.ageGate?.confirmedAt).toEqual(expect.any(String));
  await root.getByRole("button", { name: "Next" }).click();

  // 5. Connections: the Engine default; images optional.
  await expect(root.getByLabel("Story", { exact: true })).toHaveValue("conn-text");
  await root.getByLabel("Image connection").selectOption("conn-image");
  await root.getByRole("button", { name: "Next" }).click();

  // 6. Review shows the paint cost, then the world is made.
  await expect(root.getByText("Paints 3 images")).toBeVisible();
  await root.getByRole("button", { name: "Forge our story" }).click();
  await expect(root.getByRole("heading", { name: "Forging your story" })).toBeVisible();
  const created = stub.calls.find((call) => call.path.endsWith("/runs") && call.method === "POST")!.body!;
  expect(created.setup).toMatchObject({
    premise: PREMISE,
    language: "English",
    protagonist: { personaId: "persona-mira", pronouns: { subject: "she", object: "her", possessive: "her" } },
    lis: [
      { source: "card", cardId: "card-ilvar", pronouns: { subject: "he", object: "him", possessive: "his" } },
      { source: "card", cardId: "card-dottore", pronouns: { subject: "he", object: "him", possessive: "his" } },
    ],
    content: { heat: "explicit", darkness: "angst" },
    images: { connectionId: "conn-image", rating: "sfw" },
    connections: { narration: "conn-text" },
  });
  expect(await page.evaluate(() => localStorage.getItem("otome-forge:setup-draft:v1"))).toBeNull();

  // ForgeProgress: a failed step waits for Retry; looks wait for the paint tap.
  const retry = root.getByRole("button", { name: "Try Dottore’s bible again" });
  await expect(retry).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("04-forge-failed.png") });
  await retry.click();
  await expect(root.getByRole("heading", { name: "Your story is ready" })).toBeVisible({ timeout: 30_000 });
  expect(stub.calls.some((call) => call.path.endsWith("/forge/consent"))).toBe(false);
  await root.getByRole("button", { name: "Paint the cast (3 images)" }).click();
  // click() resolves once the tap is dispatched, not once its request reaches the stub.
  await expect
    .poll(() => stub.calls.find((call) => call.path.endsWith("/forge/consent"))?.body?.steps)
    .toEqual(["paint:li-a-0001", "paint:li-b-0002", "paint:player"]);
  await page.screenshot({ path: testInfo.outputPath("05-ready.png") });
  expect(pageErrors).toEqual([]);
});

test("Otome Forge opens on its real server, beside Gacha Forge when that is installed", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/otome-forge/") && response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });
  const withGachaForge = (process.env.MARINARA_PACKAGE_IDS ?? "").split(",").includes("gacha-forge");
  if (withGachaForge) {
    // Gacha Forge keeps its run index in the unprefixed `index` document, and a first visit alone never writes it:
    // marking a guide seen does. Otome Forge then writes `otome-forge:index` beside it on the real Engine.
    const seeded = await page.request.post("/api/gacha-forge/guide/seen", { data: { id: "welcome" } });
    expect(seeded.ok()).toBe(true);
    expect(await seeded.json()).toMatchObject({ ok: true, guidesSeen: expect.arrayContaining(["welcome"]) });
  }
  const root = await openOtomeForge(page);
  // The picker renders only once GET /index answered; the visit is recorded through POST /index/opened.
  await expect(root.getByRole("button", { name: /Begin a new story|Continue your new story/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("real-server.png") });
  expect(failures).toEqual([]);
});
