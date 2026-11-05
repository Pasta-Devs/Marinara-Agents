import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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

async function openForge(page: Page, testInfo: TestInfo, activeRun?: typeof run, hostTheme: "dark" | "light" = "dark") {
  await page.setViewportSize(
    testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript(
    ({ version, hostTheme }) => {
      localStorage.removeItem("marinara-active-chat-id");
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            theme: hostTheme,
            hasCompletedOnboarding: true,
            sidebarOpen: false,
            rightPanelOpen: false,
            appAccentPulseMode: false,
          },
          version: 65,
        }),
      );
    },
    { version: appVersion, hostTheme },
  );
  await page.route("**/api/gacha-forge/state*", (route) =>
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
  // Keep the setup draft in the same isolated fixture as the mocked world state.
  let setupSnapshot: unknown = null;
  await page.route("**/api/gacha-forge/setup/draft", (route) => {
    if (route.request().method() === "POST") {
      setupSnapshot = route.request().postDataJSON().snapshot;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { ok: true, draft: setupSnapshot } });
  });
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

test("Fresh chapter entry types its first line while a saved reading position stays revealed", async ({
  page,
}, testInfo) => {
  const opening = "A new chapter opens, one word at a time. ".repeat(12);
  const resumed = "The reader already reached this second line.";
  await page.route("**/api/gacha-forge/beat", (route) =>
    route.fulfill({
      json: {
        ok: true,
        segments: [
          { speaker: "", text: opening },
          { speaker: "", text: resumed },
          { speaker: "", text: "Later." },
        ],
        cast: [],
        places: [],
      },
    }),
  );
  const forge = await openForge(page, testInfo);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await seedScene(forge);
  await expect.poll(() => forge.locator("[data-text]").textContent()).not.toBe(opening);
  await expect
    .poll(async () => {
      const text = await forge.locator("[data-text]").textContent();
      return !!text && text.length < opening.length;
    })
    .toBe(true);
  await forge.locator("[data-box]").click();
  await expect(forge.locator("[data-text]")).toHaveText(opening);
  await forge.locator("[data-box]").click();
  await forge.locator("[data-box]").click();
  await expect(forge.locator("[data-text]")).toHaveText(resumed);
  // The package's real session position survives opening the same scene again.
  await seedScene(forge);
  await expect(forge.locator("[data-count]")).toHaveText("02 / 03");
  await expect(forge.locator("[data-text]")).toHaveText(resumed);
});

test("Speaker changes open the correct portrait without exposing an earlier character's buffer", async ({
  page,
}, testInfo) => {
  const cast = [
    { name: "Arden", art: "https://forge.test/arden.svg" },
    { name: "Brin", art: "https://forge.test/brin.svg" },
    { name: "Mari", art: "https://forge.test/mari.svg", prota: true },
  ];
  await page.route("https://forge.test/*.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="260"><rect width="180" height="260" fill="${route.request().url().includes("arden") ? "#bf3333" : route.request().url().includes("brin") ? "#338f55" : "#3355bf"}"/></svg>`,
    }),
  );
  const segments = ["Arden", "Brin", "Mari", "Arden"].map((speaker) => ({ speaker, text: `${speaker} speaks.` }));
  await page.route("**/api/gacha-forge/beat", (route) =>
    route.fulfill({ json: { ok: true, cast, segments, places: [] } }),
  );
  const forge = await openForge(page, testInfo);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await seedScene(forge);
  await expect(forge.locator("[data-text]")).toHaveText(segments[0].text);
  await forge.evaluate((node, cast) => {
    const root = node.shadowRoot!;
    const sample = { changes: 0, wrong: [] as string[] };
    (window as any).forgePortraitProof = sample;
    const observer = new MutationObserver(() => {
      const speaker = root.querySelector("[data-who]")?.textContent;
      const current = cast.find((entry) => entry.name === speaker);
      if (!current) return;
      sample.changes += 1;
      for (const image of root.querySelectorAll<HTMLImageElement>('.vn-plate[data-open="true"] [data-img]'))
        if (!image.hidden && image.getAttribute("src") && image.getAttribute("src") !== current.art)
          sample.wrong.push(`${speaker}:${image.getAttribute("src")}`);
    });
    observer.observe(root.querySelector("[data-vn]")!, {
      attributes: true,
      subtree: true,
      attributeFilter: ["src", "data-open", "data-front", "hidden"],
    });
    (window as any).stopForgePortraitProof = () => observer.disconnect();
  }, cast);
  for (const segment of segments.slice(1)) {
    await forge.locator("[data-box]").click();
    await expect(forge.locator("[data-who]")).toHaveText(segment.speaker);
    const url = cast.find((entry) => entry.name === segment.speaker)!.art;
    await expect
      .poll(() =>
        forge
          .locator('.vn-plate[data-open="true"] [data-img]')
          .evaluateAll((images) => images.map((image) => image.getAttribute("src"))),
      )
      .toEqual([url, url]);
    await expect(forge.locator("[data-text]")).toHaveText(segment.text);
  }
  const sample = await page.evaluate(() => {
    (window as any).stopForgePortraitProof();
    return (window as any).forgePortraitProof;
  });
  expect(sample.changes).toBeGreaterThan(0);
  expect(sample.wrong).toEqual([]);
  await testInfo.attach("speaker-portrait-buffers.json", {
    body: JSON.stringify(sample),
    contentType: "application/json",
  });
});

test("Choices preserve an intentional final em dash and controls do not advance in either theme", async ({
  page,
}, testInfo) => {
  const text =
    "The dogs. Who's got the dogs? Belka won't eat if you watch her. You've gotta turn your back, somebody has to turn their—";
  const fullText = text;
  const beat = {
    ...scene,
    segments: [
      { speaker: "", text: "Listen before answering." },
      { speaker: "Lev Ostrog", text: fullText },
    ],
    choices: [
      {
        id: "choice-1",
        kind: "small",
        at: 1,
        options: smallOptions.slice(0, 3).map((option) => ({ ...option, text: option.text.replace(/\.$/u, "") })),
      },
    ],
  };
  await page.route("**/api/gacha-forge/beat", (route) => route.fulfill({ json: beat }));
  let currentTheme = "aurora";
  await page.route("**/api/gacha-forge/run/sources", (route) =>
    route.fulfill({
      json: {
        ok: true,
        run: { ...run, hudStyle: currentTheme, ...route.request().postDataJSON().sources },
      },
    }),
  );
  const forge = await openForge(page, testInfo, undefined, "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  for (const theme of ["aurora", "bloom"]) {
    currentTheme = theme;
    await forge.evaluate((node) => (node as any)._beatLineWrite(0));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await seedScene(forge, false, theme);
    await expect(forge.locator("[data-text]")).toHaveText("Listen before answering.");
    const count = forge.locator("[data-count]");
    const before = await count.textContent();
    const initialText = await forge.locator("[data-text]").textContent();
    await forge.locator(".gf-fs-chapter").click();
    await forge.locator(".gf-fs-chapter").click();
    const mute = forge.locator(".gf-mute-chapter");
    await expect(mute).toBeVisible();
    await mute.click();
    await expect(count).toHaveText(before!);
    await expect(forge.locator("[data-text]")).toHaveText(initialText!);
    await forge.locator("[data-box]").click();
    await expect(forge.locator("[data-forge-choices]")).toHaveCount(0);
    // One more story click reveals the remainder, rather than advancing past the unanswered choice.
    await forge.locator("[data-box]").click();
    await expect(forge.locator("[data-text]")).toHaveText(fullText);
    await expect(forge.locator("[data-forge-choices]")).toBeVisible();
    await expect(forge.locator(".vn-choice-option").first()).toHaveText(smallOptions[0].text);
    const tailVisible = await forge.locator(".vn-dock").evaluate((dock) => {
      dock.scrollTop = dock.scrollHeight;
      const text = dock.querySelector("[data-text]")!.firstChild!;
      const tail = document.createRange();
      tail.setStart(text, Math.max(0, text.textContent!.length - 20));
      tail.setEnd(text, text.textContent!.length);
      const bounds = tail.getBoundingClientRect();
      const viewport = dock.getBoundingClientRect();
      const stage = dock.closest(".gf-stage")!.getBoundingClientRect();
      const finalGlyph = document.createRange();
      finalGlyph.setStart(text, text.textContent!.length - 1);
      finalGlyph.setEnd(text, text.textContent!.length);
      return (
        finalGlyph.toString() === "—" &&
        finalGlyph.getBoundingClientRect().width > 0 &&
        bounds.top >= Math.max(viewport.top, stage.top) - 1 &&
        bounds.bottom <= Math.min(viewport.bottom, stage.bottom) + 1
      );
    });
    expect(tailVisible, "The supplied final em dash remains visible after choices appear").toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`choice-complete-${theme}.png`), animations: "disabled" });
  }
});

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

for (const autoplay of [true, false]) {
  test(
    autoplay
      ? "Autoplay resumes the selected branch after a choice and waits at the final big choice"
      : "Turning autoplay off keeps the selected branch in manual playback",
    async ({ page }, testInfo) => {
      const canon: Record<string, string> = {};
      let failNext = true;
      let completeRequests = 0;
      await page.route("**/api/gacha-forge/beat", (route) =>
        route.fulfill({
          json: {
            ...scene,
            segments: [{ speaker: "", text: "AUTOPLAY_OPENING" }, ...scene.segments],
            choices: scene.choices.map((choice) => ({ ...choice, at: choice.at + 1 })),
            choiceCanon: { ...canon },
          },
        }),
      );
      await page.route("**/api/gacha-forge/choice", async (route) => {
        const body = route.request().postDataJSON();
        if (failNext) {
          failNext = false;
          await route.fulfill({ json: { ok: false, error: "write-conflict" } });
          return;
        }
        canon[body.choiceId] ??= body.optionId;
        await route.fulfill({
          json: { ok: true, optionId: body.optionId, choiceCanon: { ...canon }, canonical: true },
        });
      });
      await page.route("**/api/gacha-forge/complete", (route) => {
        completeRequests += 1;
        return route.fulfill({ json: { ok: true } });
      });
      const forge = await openForge(page, testInfo);
      const now = new Date("2026-10-24T12:00:00Z");
      await page.clock.install({ time: now });
      await page.clock.pauseAt(new Date(now.getTime() + 60_000));
      await seedScene(forge);
      const text = forge.locator("[data-text]");
      const auto = forge.locator("[data-auto]");
      const choices = forge.locator("[data-forge-choices]");
      await expect(text).toHaveText("AUTOPLAY_OPENING");
      await auto.click();
      if (!autoplay) await auto.click();
      await page.clock.runFor(3100);
      if (!autoplay) {
        await expect(text).toHaveText("AUTOPLAY_OPENING");
        await expect(auto).not.toHaveAttribute("data-on");
        await forge.locator("[data-box]").click();
      }
      await expect(choices).toHaveAttribute("data-choice-id", "choice-1");
      await expect(auto).toBeDisabled();
      await page.clock.runFor(10_000);
      await expect(text).toHaveText(scene.segments[0].text);
      const first = forge.locator('[data-forge-choice-option="option-1"]');
      await first.click();
      await expect(forge.locator("[data-forge-choice-error]")).toContainText("could not be saved");
      await page.clock.runFor(10_000);
      await expect(choices).toHaveAttribute("data-choice-id", "choice-1");
      await expect(forge.locator("[data-continue]")).toBeHidden();
      await first.click();
      await expect(text).toHaveText(smallOptions[0].selection.text);
      expect(canon["choice-1"]).toBe("option-1");
      if (!autoplay) {
        await page.clock.runFor(10_000);
        await expect(text).toHaveText(smallOptions[0].selection.text);
        await expect(auto).not.toHaveAttribute("data-on");
        return;
      }
      await expect(auto).toHaveAttribute("data-on", "");
      for (const next of ["ARDEN_SELECTED_BRANCH", scene.segments[1].text, scene.segments[2].text]) {
        await page.clock.runFor(3100);
        await expect(text).toHaveText(next);
      }
      await expect(choices).toHaveAttribute("data-choice-id", "choice-2");
      await expect(auto).toBeDisabled();
      await page.clock.runFor(10_000);
      await expect(text).toHaveText(scene.segments[2].text);
      await expect(forge.locator("[data-continue]")).toBeHidden();
      await forge.locator('[data-forge-choice-option="option-2"]').click();
      await expect(text).toHaveText("You choose to save the southern village.");
      await expect(forge.locator("[data-continue]")).toBeVisible();
      await page.clock.runFor(10_000);
      await expect(text).toHaveText("You choose to save the southern village.");
      expect(canon).toEqual({ "choice-1": "option-1", "choice-2": "option-2" });
      expect(completeRequests).toBe(0);
    },
  );
}

for (const autoplay of [false, true]) {
  test(`Normal-motion dialogue keeps terminal punctuation before choices (${autoplay ? "autoplay" : "manual"})`, async ({
    page,
  }, testInfo) => {
    const question = "Will you keep an old man company for an hour?";
    const overridePath = process.env.GACHA_FORGE_PUNCTUATION_CLIENT;
    const clientBytes = overridePath ? readFileSync(overridePath) : null;
    let overrides = 0;
    if (clientBytes)
      await page.route(/\/api\/capability-packages\/gacha-forge\/client(?:\?.*)?$/u, (route) => {
        overrides += 1;
        return route.fulfill({ body: clientBytes, contentType: "text/javascript; charset=utf-8" });
      });
    await page.route("**/api/gacha-forge/beat", (route) =>
      route.fulfill({
        json: {
          ...scene,
          segments: Array.from({ length: 60 }, (_, index) => ({
            speaker: index === 52 ? "Pulcinella" : "",
            text: index === 52 ? question : index === 51 ? "The garden falls quiet." : `Earlier beat ${index + 1}.`,
          })),
          resumeAt: 51,
          choices: [
            {
              id: "punctuation-choice",
              kind: "small",
              at: 52,
              options: [
                { ...smallOptions[0], text: "Tease him about the hour" },
                { ...smallOptions[1], text: "Ask whether he slept" },
                { ...smallOptions[2], text: "Try the boots on" },
              ],
            },
          ],
        },
      }),
    );
    const forge = await openForge(page, testInfo);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const now = new Date("2026-10-24T12:00:00Z");
    await page.clock.install({ time: now });
    await page.clock.pauseAt(new Date(now.getTime() + 60_000));
    await seedScene(forge, false, "aurora");
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", "aurora");
    await forge.locator("[data-vn-resume]").click();
    await page.clock.runFor(1000);
    const text = forge.locator("[data-text]");
    const choices = forge.locator("[data-forge-choices]");
    await expect(text).toHaveText("The garden falls quiet.");
    await expect(forge.locator("[data-count]")).toHaveText("52 / 60");
    if (autoplay) {
      await forge.locator("[data-auto]").click();
      await page.clock.runFor(3000);
    } else await forge.locator("[data-box]").click();
    await page.clock.runFor(18 * (question.length - 1));
    await expect(text).toHaveText(question.slice(0, -1));
    await expect(choices).toHaveCount(0);
    // Backlog reads the canonical line even while the visible line is animating.
    await forge.locator("[data-log]").click();
    await expect(forge.locator(".vn-log-line").last()).toHaveText(question);
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: viewport.width - 10, height: viewport.height });
    await forge.evaluate((node) => (node as any)._renderBrowser());
    await page.clock.runFor(18);
    await forge.locator("[data-log-close]").click();
    await page.setViewportSize(viewport);
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", "aurora");
    await expect(choices).toHaveAttribute("data-choice-id", "punctuation-choice");
    const geometry = await text.evaluate((element) => {
      const node = element.firstChild!;
      const range = document.createRange();
      range.setStart(node, node.textContent!.length - 1);
      range.setEnd(node, node.textContent!.length);
      const end = range.getBoundingClientRect();
      const box = element.closest("[data-box]")!.getBoundingClientRect();
      const stage = element.closest(".gf-stage")!.getBoundingClientRect();
      return {
        text: element.textContent,
        terminal: range.toString(),
        glyph: { x: end.x, y: end.y, width: end.width, height: end.height },
        fitsBox: end.left >= box.left && end.right <= box.right && end.top >= box.top && end.bottom <= box.bottom,
        fitsStage:
          end.left >= stage.left && end.right <= stage.right && end.top >= stage.top && end.bottom <= stage.bottom,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
    });
    await testInfo.attach("terminal-punctuation-geometry", {
      body: JSON.stringify(geometry, null, 2),
      contentType: "application/json",
    });
    await testInfo.attach("archived-client-scope", {
      body: JSON.stringify({
        overridePath: overridePath ?? null,
        overrides,
        sha256: clientBytes ? createHash("sha256").update(clientBytes).digest("hex") : null,
      }),
      contentType: "application/json",
    });
    if (clientBytes) expect(overrides).toBe(1);
    await expect(forge.locator("[data-count]")).toHaveText("53 / 60");
    await expect(text).toHaveText(question);
    expect(geometry.terminal).toBe("?");
    expect(geometry.reducedMotion).toBe(false);
    expect(geometry.glyph.width).toBeGreaterThan(0);
    expect(geometry.fitsBox).toBe(true);
    expect(geometry.fitsStage).toBe(true);
    await forge.locator("[data-log]").click();
    await expect(forge.locator(".vn-log-line").last()).toHaveText(question);
    await forge.locator("[data-log-close]").click();
    await expect(text).toHaveText(question);
    await page.clock.runFor(10_000);
    await expect(text).toHaveText(question);
    await expect(choices).toHaveAttribute("data-choice-id", "punctuation-choice");
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath(
        `normal-motion-punctuation-${autoplay ? "auto" : "manual"}-${testInfo.project.name}.png`,
      ),
    });
  });
}

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
