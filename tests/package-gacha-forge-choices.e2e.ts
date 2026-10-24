import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const run = {
  runId: "choice-ui-proof",
  name: "Choice proof",
  scenario: "Synthetic choices in a fictional garden.",
  protagonist: { name: "Mari" },
  story: { preforge: "off" },
  progress: {},
};
const smallOptions = [
  {
    id: "option-1",
    text: "Pull your hoodie up.",
    selection: { kind: "action", text: "You pull your hoodie up against the cold." },
    segments: [{ speaker: "Arden", text: "ARDEN_SELECTED_BRANCH" }],
  },
  {
    id: "option-2",
    text: "Apologize to Brin for the delay.",
    selection: { kind: "dialogue", text: "I am sorry I kept you waiting, Brin." },
    segments: [{ speaker: "Brin", text: "BRIN_ALTERNATE_BRANCH" }],
  },
  {
    id: "option-3",
    text: "Inspect the footprints.",
    selection: { kind: "action", text: "You kneel to inspect the footprints." },
    segments: [{ speaker: "", text: "FOOTPRINT_ALTERNATE_BRANCH" }],
  },
  {
    id: "option-4",
    text: "Ask for a moment of peace.",
    selection: { kind: "dialogue", text: "Please, can we have a moment of peace?" },
    segments: [{ speaker: "", text: "PEACE_ALTERNATE_BRANCH" }],
  },
];
const scene = {
  ok: true,
  segments: [
    { speaker: "", text: "Two paths open before you." },
    { speaker: "", text: "COMMON_REJOIN: everyone reaches the fountain." },
    { speaker: "", text: "Only one village can be saved. The next chapter depends on your decision." },
  ],
  choices: [
    { id: "choice-1", kind: "small", at: 0, options: smallOptions },
    {
      id: "choice-2",
      kind: "big",
      at: 2,
      options: [
        {
          id: "option-1",
          text: "Save the northern village.",
          selection: { kind: "action", text: "You choose to save the northern village." },
        },
        {
          id: "option-2",
          text: "Save the southern village.",
          selection: { kind: "action", text: "You choose to save the southern village." },
        },
      ],
    },
  ],
  cast: [],
  places: [],
};

async function openForge(page: Page, testInfo: TestInfo, activeRun?: typeof run) {
  await page.setViewportSize(
    testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((version) => {
    localStorage.removeItem("marinara-active-chat-id");
    localStorage.setItem("marinara:whats-new:seen-version", version);
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, appAccentPulseMode: false },
        version: 65,
      }),
    );
  }, appVersion);
  await page.route("**/api/gacha-forge/state", (route) =>
    route.fulfill({
      json: activeRun
        ? {
            runs: [activeRun],
            activeRunId: activeRun.runId,
            activeRun,
            guidesSeen: ["welcome", "home", "settings", "continuity"],
          }
        : { runs: [], guidesSeen: ["welcome"] },
    }),
  );
  await page.route("**/api/gacha-forge/continuity", (route) => route.fulfill({ json: { ok: true, chapters: [] } }));
  await page.route("**/api/gacha-forge/preforge", (route) =>
    route.fulfill({ json: { ok: true, preforge: { mode: "off", locked: false, canAuto: false } } }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  if (activeRun) await expect(forge.getByRole("button", { name: "Game settings", exact: true })).toBeVisible();
  else await expect(forge.locator("textarea").first()).toBeVisible();
  return forge;
}

async function seedScene(forge: Locator, replay = false, theme = "") {
  await forge.evaluate(
    (node, fixture) => {
      const game = node as any;
      game._clearBeat();
      game._boot = "ready";
      game._welcomeBegun = true;
      game._guidesSeen = new Set(["welcome", "home", "chapters", "chapter", "beat", "settings", "continuity"]);
      game._run = { ...fixture.run, ...(fixture.theme ? { hudStyle: fixture.theme } : {}) };
      game._bannerReady = true;
      game._artReady = true;
      game._artState = "idle";
      game._artBlocking = false;
      game._hudView = "chapter";
      game._planChapter = 1;
      game._chapterProgress = { normal: 0 };
      game._plan = { title: "Two paths", nodes: [{ index: 1, type: "story", title: "The garden", storyIndex: 0 }] };
      game._activeStoryNode = {
        chapter: 1,
        nodeIndex: 0,
        storyIndex: 0,
        title: "The garden",
        difficulty: "normal",
        replay: fixture.replay,
      };
      game._beatState = "loading";
      game._beatRequested = false;
      game._renderBrowser();
    },
    { run, replay, theme },
  );
  await expect(forge.locator("[data-vn]")).toBeVisible();
}

async function assertChoiceLayout(forge: Locator) {
  // The chapter entrance translates its contents briefly; measure the resting screen.
  await forge.locator(".gf-stage").evaluate(async (stage) => {
    await Promise.all(
      stage
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  const geometry = await forge.locator("[data-forge-choices]").evaluate((panel) => {
    const stage = panel.closest(".gf-stage")!.getBoundingClientRect();
    const bounds = panel.getBoundingClientRect();
    const box = panel.closest(".vn-dock")!.querySelector("[data-box]")!.getBoundingClientRect();
    return {
      left: bounds.left - stage.left,
      right: stage.right - bounds.right,
      top: bounds.top - stage.top,
      aboveDialogue: bounds.bottom <= box.top + 1,
      buttons: Array.from(panel.querySelectorAll("button")).map((button) => ({
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
        fitsText: button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1,
      })),
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeGreaterThanOrEqual(-1);
  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.aboveDialogue).toBe(true);
  for (const button of geometry.buttons) {
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.fitsText).toBe(true);
  }
}

test("Choices pause playback, preserve resume canon and allow only small replay alternatives", async ({
  page,
}, testInfo) => {
  const canon: Record<string, string> = {};
  const requests: Array<Record<string, unknown>> = [];
  let failNext = true;
  await page.route("**/api/gacha-forge/beat", (route) =>
    route.fulfill({ json: { ...scene, choiceCanon: { ...canon } } }),
  );
  await page.route("**/api/gacha-forge/choice", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (failNext) {
      failNext = false;
      await route.fulfill({ json: { ok: false, error: "write-conflict" } });
      return;
    }
    canon[body.choiceId] ??= body.optionId;
    await route.fulfill({
      json: {
        ok: true,
        choiceId: body.choiceId,
        optionId: body.optionId,
        choiceCanon: { ...canon },
        canonical: canon[body.choiceId] === body.optionId,
      },
    });
  });
  const forge = await openForge(page, testInfo);
  await seedScene(forge, false, testInfo.project.name.includes("mobile") ? "aurora" : "bloom");
  const choices = forge.locator("[data-forge-choices]");
  await expect(choices).toHaveAttribute("data-choice-id", "choice-1");
  await expect(choices.getByRole("button")).toHaveCount(4);
  await assertChoiceLayout(forge);
  const fullscreen = forge.locator(".vn-top > .gf-fs-chapter");
  await fullscreen.click();
  await expect(page.locator(".mari-home-browser-chrome")).toBeHidden();
  await expect(choices).toHaveAttribute("data-choice-id", "choice-1");
  await assertChoiceLayout(forge);
  await fullscreen.click();
  await expect(page.locator(".mari-home-browser-chrome")).toBeVisible();
  await expect(forge.locator("[data-skip]")).toBeDisabled();
  await forge.locator("[data-skip]").dispatchEvent("click");
  await expect(choices).toHaveAttribute("data-choice-id", "choice-1");
  await expect(forge.locator("[data-continue]")).toBeHidden();
  await forge.locator("[data-box]").click();
  await expect(choices).toHaveAttribute("data-choice-id", "choice-1");
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`choices-four-${testInfo.project.name}.png`),
  });
  await expect(choices.getByRole("button", { name: smallOptions[1].text, exact: true })).toBeVisible();
  await expect(choices).not.toContainText(smallOptions[1].selection.text);
  const first = forge.locator('[data-forge-choice-option="option-1"]');
  await first.click();
  await expect(forge.locator("[data-forge-choice-error]")).toContainText("could not be saved");
  await expect(first).toBeEnabled();
  await first.focus();
  await page.keyboard.press("Space");
  await expect(forge.locator("[data-text]")).toHaveText(smallOptions[0].selection.text);
  await expect(forge.locator("[data-box]")).toHaveAttribute("data-narration", "");
  await expect(forge.locator("[data-who]")).not.toHaveText("Mari");
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`choices-action-${testInfo.project.name}.png`),
  });
  expect(canon["choice-1"]).toBe("option-1");
  await forge.locator("[data-box]").click();
  await expect(forge.locator("[data-text]")).toHaveText("ARDEN_SELECTED_BRANCH");
  await forge.locator("[data-box]").click();
  await expect(forge.locator("[data-text]")).toContainText("COMMON_REJOIN");

  // A new scene load adopts saved canon instead of asking the first choice again.
  await seedScene(forge);
  await forge.locator("[data-skip]").click();
  await expect(choices).toHaveAttribute("data-choice-id", "choice-2");
  await expect(choices.getByRole("button")).toHaveCount(2);
  await expect(choices).toContainText("cannot be changed");
  await assertChoiceLayout(forge);
  await expect(forge.locator("[data-skip]")).toBeDisabled();
  await forge.locator("[data-skip]").dispatchEvent("click");
  await expect(choices).toHaveAttribute("data-choice-id", "choice-2");
  await expect(forge.locator("[data-continue]")).toBeHidden();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`choices-big-${testInfo.project.name}.png`),
  });
  await forge.locator('[data-forge-choice-option="option-2"]').click();
  await expect(forge.locator("[data-text]")).toHaveText("You choose to save the southern village.");
  await expect(forge.locator("[data-box]")).toHaveAttribute("data-narration", "");
  await expect(forge.locator("[data-continue]")).toBeVisible();
  expect(canon["choice-2"]).toBe("option-2");

  await seedScene(forge, true);
  await expect(choices).toHaveAttribute("data-choice-id", "choice-1");
  await forge.locator('[data-forge-choice-option="option-2"]').click();
  await expect(forge.locator("[data-text]")).toHaveText(smallOptions[1].selection.text);
  await expect(forge.locator("[data-box]")).not.toHaveAttribute("data-narration", "");
  await expect(forge.locator("[data-who]")).toHaveText("Mari");
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`choices-dialogue-${testInfo.project.name}.png`),
  });
  await forge.locator("[data-box]").click();
  await expect(forge.locator("[data-text]")).toHaveText("BRIN_ALTERNATE_BRANCH");
  await forge.locator("[data-skip]").click();
  await expect(choices).toHaveCount(0);
  await expect(forge.locator("[data-forge-choice-canon]")).toContainText("Save the southern village.");
  expect(canon).toEqual({ "choice-1": "option-1", "choice-2": "option-2" });
  expect(requests.at(-1)?.replay).toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`choices-locked-replay-${testInfo.project.name}.png`),
  });
});

test("Continuity choices default on and persist alongside pre-forging", async ({ page }, testInfo) => {
  let saved: { story: { preforge: string; choices: boolean } } = { story: { ...run.story, choices: true } };
  await page.route("**/api/gacha-forge/run/sources", async (route) => {
    const sources = route.request().postDataJSON().sources;
    saved = { story: { ...saved.story, ...(sources.story || {}) } };
    await route.fulfill({ json: { ok: true, run: { ...run, ...sources, ...saved } } });
  });
  const forge = await openForge(page, testInfo);
  await forge.evaluate((node, run) => {
    const game = node as any;
    game._boot = "ready";
    game._welcomeBegun = true;
    game._guidesSeen = new Set(["welcome", "home", "settings", "continuity"]);
    game._run = run;
    game._bannerReady = true;
    game._artReady = true;
    game._hudView = "settings";
    game._settingsCategory = "continuity";
    game._continuity = [];
    game._continuityState = "ready";
    game._renderBrowser();
  }, run);
  const toggle = forge.locator("[data-forge-allow-choices]");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  const touch = await toggle.boundingBox();
  expect(touch!.width).toBeGreaterThanOrEqual(44);
  expect(touch!.height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => saved?.story?.choices).toBe(false);
  expect(saved.story.preforge).toBe("off");
  const preforge = forge.locator('[data-input="story.preforge"]');
  await preforge.selectOption("art");
  await expect.poll(() => saved.story.preforge).toBe("art");
  expect(saved.story.choices).toBe(false);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => saved.story.choices).toBe(true);
  expect(saved.story.preforge).toBe("art");
  await preforge.selectOption("off");
  await expect.poll(() => saved.story.preforge).toBe("off");
  expect(saved.story.choices).toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`choices-settings-${testInfo.project.name}.png`),
  });
});

test("Continuity restores saved choices off after reload and enables them with one click", async ({
  page,
}, testInfo) => {
  const saved = {
    ...run,
    hasStandardBanner: true,
    artPending: 0,
    storyUnwritten: true,
    storyDeferred: true,
    story: { preforge: "art", choices: false },
  };
  const writes: unknown[] = [];
  await page.route("**/api/gacha-forge/run/sources", async (route) => {
    const sources = route.request().postDataJSON().sources;
    writes.push(sources);
    saved.story = { ...saved.story, ...(sources.story || {}) };
    await route.fulfill({ json: { ok: true, run: saved } });
  });
  const forge = await openForge(page, testInfo, saved);
  const openContinuity = async () => {
    await forge.getByRole("button", { name: "Game settings", exact: true }).click();
    await forge.locator('[role="tab"][data-view="continuity"]').click();
  };
  await openContinuity();
  const toggle = forge.locator("[data-forge-allow-choices]");
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await page.reload();
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  await openContinuity();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(writes).toEqual([]);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => saved.story.choices).toBe(true);
  expect(writes).toEqual([{ story: { choices: true } }]);
  expect(saved.story.preforge).toBe("art");

  await page.reload();
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  await openContinuity();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(writes).toHaveLength(1);
});

test("Long choices remain reachable in every Forge theme and render labels as text", async ({ page }, testInfo) => {
  const longText =
    "I will stay here, listen to both sides, and decide how to help once everyone has had a chance to speak. ";
  const options = smallOptions.map((option, index) => ({
    ...option,
    text: `${index === 3 ? '<img src=x onerror="window.choiceInjected=true"> ' : ""}${longText.repeat(3)}`.slice(
      0,
      280,
    ),
  }));
  await page.route("**/api/gacha-forge/beat", (route) =>
    route.fulfill({ json: { ...scene, choices: [{ ...scene.choices[0], options }], choiceCanon: {} } }),
  );
  const forge = await openForge(page, testInfo);
  for (const theme of ["aurora", "bloom", "signal", "ember", "vanguard"]) {
    await seedScene(forge, false, theme);
    const panel = forge.locator("[data-forge-choices]");
    await expect(panel.getByRole("button")).toHaveCount(4);
    await assertChoiceLayout(forge);
    await expect(panel.locator("img")).toHaveCount(0);
    for (const option of await panel.getByRole("button").all()) {
      await option.scrollIntoViewIfNeeded();
      await expect(option).toBeInViewport();
    }
    if (["aurora", "bloom"].includes(theme)) {
      await panel.evaluate((panel) => {
        panel.scrollTop = 0;
      });
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath(`choices-${theme}-${testInfo.project.name}.png`),
      });
    }
  }
  expect(await page.evaluate(() => (window as any).choiceInjected)).toBeUndefined();
});
