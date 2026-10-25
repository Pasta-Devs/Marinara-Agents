import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

async function openEditors(page: Page, hostTheme: "dark" | "light" = "dark") {
  await page.setViewportSize({ width: 874, height: 402 });
  await page.emulateMedia({ reducedMotion: "reduce" });
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
      let top: number | null = null;
      const viewport = new EventTarget();
      Object.defineProperties(viewport, {
        height: { get: () => top ?? window.innerHeight },
        width: { get: () => window.innerWidth },
        offsetTop: { get: () => 0 },
        pageTop: { get: () => 0 },
        offsetLeft: { get: () => 0 },
        pageLeft: { get: () => 0 },
        scale: { get: () => 1 },
      });
      Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
      (window as any).__forgeKeyboardTop = (value: number | null) => {
        top = value;
        viewport.dispatchEvent(new Event("resize"));
      };
    },
    { version: appVersion, hostTheme },
  );
  const saved = {
    runId: "editor-proof",
    name: "Editor proof",
    scenario: "A synthetic world.",
    hudStyle: "aurora",
    connectionId: "fixture-model",
    hasStandardBanner: true,
    protagonist: { name: "Mari" },
    story: { preforge: "off", choices: true },
    progress: {},
    audio: { tts: false, generate: false, muted: true },
    images: { connectionId: "fixture-image" },
    guidelines: { beat: "Speech uses everyday words.\n".repeat(25), image: "Name what is visible.\n".repeat(25) },
  };
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.route("**/api/connections", (route) =>
    route.fulfill({ json: [{ id: "fixture-model", name: "Fixture", provider: "custom", model: "fixture" }] }),
  );
  await page.route("**/api/gacha-forge/state*", (route) =>
    route.fulfill({
      json: {
        runs: [saved],
        activeRunId: saved.runId,
        activeRun: saved,
        guidesSeen: ["welcome", "home", "settings", "continuity", "beat", "chapter"],
      },
    }),
  );
  await page.route("**/api/gacha-forge/continuity", (route) => route.fulfill({ json: { ok: true, chapters: [] } }));
  await page.route("**/api/gacha-forge/preforge", (route) =>
    route.fulfill({ json: { ok: true, preforge: { mode: "off", locked: false, canAuto: false } } }),
  );
  await page.route("**/api/gacha-forge/run/sources", (route) => {
    Object.assign(saved, route.request().postDataJSON().sources);
    return route.fulfill({ json: { ok: true, run: saved } });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  await expect.poll(() => forge.evaluate((node) => (node as any)._boot)).toBe("ready");
  await forge.evaluate((node) => {
    const game = node as any;
    game._clearBeat();
    game._bannerReady = true;
    game._artReady = true;
    game._planEscaped = true;
    game._hudView = "home";
    game._renderBrowser();
  });
  await forge.locator(".gf-fs-bar").click();
  return { forge, saved };
}

test("Advanced fields and expanded editors keep typing and pointer Close reachable above the keyboard", async ({
  page,
}, testInfo) => {
  const { forge, saved } = await openEditors(page);
  // Controlled Engine viewport geometry is not native phone-keyboard proof.
  for (const [orientation, height] of [
    ["landscape", 150],
    ["landscape", 110],
    ["portrait", 300],
  ] as const) {
    await page.evaluate(() => (window as any).__forgeKeyboardTop(null));
    await page.setViewportSize({ width: 874, height: 402 });
    await forge.evaluate((node) => (node as any)._openSettings("advanced"));
    const keyboard = async () => {
      if (testInfo.project.name === "mobile-webkit") {
        await page.evaluate((height) => (window as any).__forgeKeyboardTop(height), height);
        await page.setViewportSize(
          orientation === "landscape" ? { width: 874, height: 402 } : { width: 390, height: 844 },
        );
      } else await page.setViewportSize({ width: orientation === "landscape" ? 874 : 390, height });
    };
    const ordinary = forge.locator('[data-input="guidelines.beat"]');
    await ordinary.focus();
    await keyboard();
    await expect
      .poll(() =>
        ordinary.evaluate((field) => {
          const box = field.getBoundingClientRect(),
            pane = field.closest(".st-pane")!.getBoundingClientRect();
          return box.top >= pane.top - 1 && box.bottom <= pane.bottom + 1 && box.height >= 44;
        }),
      )
      .toBe(true);
    await ordinary.evaluate((field: HTMLTextAreaElement) =>
      field.setSelectionRange(field.value.length, field.value.length),
    );
    await ordinary.press("x");
    await expect(ordinary).toHaveValue(/x$/u);
    await page.evaluate(() => (window as any).__forgeKeyboardTop(null));
    await page.setViewportSize({ width: 874, height: 402 });
    await ordinary.blur();
    await forge.locator('[data-expand="ob-guidelines-image"]').click();
    await keyboard();
    const expanded = forge.locator(".ob-xta"),
      close = forge.locator(".ob-xclose");
    await expect
      .poll(() =>
        expanded.evaluate((field) => {
          const box = field.getBoundingClientRect(),
            modal = field.closest(".ob-xm")!.getBoundingClientRect();
          return box.top >= modal.top - 1 && box.bottom <= modal.bottom + 1 && box.height >= 44;
        }),
      )
      .toBe(true);
    await expanded.evaluate((field: HTMLTextAreaElement) =>
      field.setSelectionRange(field.value.length, field.value.length),
    );
    await expanded.press("x");
    const draft = await expanded.inputValue();
    const retainedEditor = await expanded.elementHandle();
    await expanded.evaluate((field: HTMLTextAreaElement) => {
      field.setSelectionRange(2, 7, "backward");
      field.scrollTop = 30;
    });
    // A real settings response followed by host-props delivery must not discard an uncommitted popup.
    const latestBeat = await forge.evaluate(async (node) => {
      const game = node as any;
      const beat = game._run.guidelines.beat + "\nA newer directive saved while this editor was open.";
      await game._setSources({ guidelines: { ...game._run.guidelines, beat } });
      game.capabilityProps = { ...game.capabilityProps };
      return beat;
    });
    await expect(expanded).toHaveValue(draft);
    expect(await expanded.evaluate((field, original) => field === original, retainedEditor)).toBe(true);
    expect(
      await expanded.evaluate((field: HTMLTextAreaElement) => ({
        focused:
          field.getRootNode() instanceof ShadowRoot && (field.getRootNode() as ShadowRoot).activeElement === field,
        start: field.selectionStart,
        end: field.selectionEnd,
        direction: field.selectionDirection,
      })),
    ).toEqual({ focused: true, start: 2, end: 7, direction: "backward" });
    await expect
      .poll(() =>
        close.evaluate((button, bottom) => {
          const box = button.getBoundingClientRect(),
            stage = button.closest(".gf-stage")!.getBoundingClientRect();
          return (
            box.height >= 44 &&
            box.width >= 44 &&
            box.top >= stage.top - 1 &&
            box.bottom <= Math.min(stage.bottom, bottom) + 1
          );
        }, height),
      )
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`editor-${orientation}-${height}.png`), caret: "initial" });
    // Keep the keyboard geometry open: Safari restores host chrome as the field blurs before this click.
    await close.click();
    await expect(forge.locator(".ob-xv")).toHaveCount(0);
    await expect.poll(() => saved.guidelines.image).toBe(draft);
    expect(saved.guidelines.beat).toBe(latestBeat);
    await retainedEditor?.dispose();
  }
});

test("Story images start below the header while retaining crossfade layers and the dialogue scrim", async ({
  page,
}) => {
  const { forge } = await openEditors(page);
  await forge.evaluate((node) => {
    const game = node as any;
    game._clearBeat();
    game._hudView = "chapter";
    game._beatState = "ready";
    game._beat = [{ speaker: "", text: "Scene framing." }];
    game._plan = { title: "Scene", nodes: [] };
    game._planChapter = 1;
    game._activeStoryNode = { chapter: 1, nodeIndex: 0, title: "Scene", difficulty: "normal" };
    game._beatRequested = true;
    game._beatAt = 0;
    game._renderBrowser();
  });
  await expect(forge.locator("[data-vn]")).toBeVisible();
  await expect
    .poll(() =>
      forge.evaluate((node) => {
        const root = node.shadowRoot!,
          scene = root.querySelector(".gf-stage > .gf-view .vn-scene")!;
        const header = root.querySelector(".gf-stage > .gf-view .vn-top")!,
          image = scene.querySelector(".vn-bg")!;
        return {
          belowHeader: Math.abs(image.getBoundingClientRect().top - header.getBoundingClientRect().bottom) <= 1,
          layers: scene.querySelectorAll(".vn-bg").length,
          position: getComputedStyle(image).backgroundPosition,
          top: getComputedStyle(scene, "::before").display,
          bottom: getComputedStyle(scene, "::after").display,
        };
      }),
    )
    .toEqual({ belowHeader: true, layers: 2, position: "50% 0%", top: "none", bottom: "block" });
});

test("Writing Advanced field help opens with a tap and stays readable in the mobile panel", async ({
  page,
}, testInfo) => {
  const { forge } = await openEditors(page, "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".mari-home-browser-chrome")).toBeHidden();
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--mari-safe-area-inset-left", "63px");
    document.documentElement.style.setProperty("--mari-safe-area-inset-right", "0px");
  });
  await forge.evaluate((node) => (node as any)._openSettings("advanced"));
  const help = forge.locator(".ob-help").first();
  if (testInfo.project.name.includes("mobile")) await help.tap();
  else await help.click();
  await expect(help).toHaveAttribute("aria-expanded", "true");
  const tipId = await help.getAttribute("aria-controls");
  const tip = forge.locator(`[id="${tipId}"]`);
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("The game follows these as orders, not suggestions.");
  // A viewport/host callback rebinds these controls without the user dismissing the disclosure.
  await forge.evaluate((node) => (node as any)._wireFullscreen());
  // A sticky emulated hover must not impersonate the click disclosure's visible text.
  await page.mouse.move(0, 0);
  await expect(tip).toBeVisible();
  await expect(tip).toHaveCSS("opacity", "1");
  await expect(help).toHaveAttribute("aria-expanded", "true");
  await forge.evaluate((node) => {
    const game = node as any;
    game._settingsRev += 1;
    game._renderBrowser();
  });
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("The game follows these as orders, not suggestions.");
  expect(
    await tip.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const stage = element.closest(".gf-stage")!.getBoundingClientRect();
      return bounds.left >= stage.left - 1 && bounds.right <= stage.right + 1 && bounds.height > 0;
    }),
  ).toBe(true);
  const buttonSize = await help.boundingBox();
  expect(buttonSize!.width).toBeLessThanOrEqual(24);
  expect(buttonSize!.height).toBeLessThanOrEqual(24);
  await expect
    .poll(() =>
      forge.evaluate((node) => {
        for (let element: Element | null = node; element; element = element.parentElement)
          if (Number(getComputedStyle(element).opacity) < 0.999) return false;
        return true;
      }),
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath("writing-help-open.png"), animations: "disabled" });
  if (testInfo.project.name.includes("mobile")) await help.tap();
  else await help.click();
  await expect(help).toHaveAttribute("aria-expanded", "false");
  if (testInfo.project.name.includes("mobile")) await expect(tip).toBeHidden();
});
