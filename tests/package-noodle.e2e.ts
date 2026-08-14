import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("MARINARA_ENGINE_ROOT is required");
const APP_VERSION = (
  JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")) as {
    version: string;
  }
).version;
const NOODLE_BLUE_RGB = "rgb(126, 167, 255)";
const NOODLER_PINK_RGB = "rgb(255, 126, 193)";
const NOODLE_LIGHT_FOREGROUND =
  "color(srgb 0.360482 0.453112 0.708674 / 0.986)";
const NOODLER_LIGHT_FOREGROUND =
  "color(srgb 0.693974 0.347118 0.548391 / 0.986)";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function collectUnexpectedErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/favicon|ResizeObserver/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

async function prepareFreshClient(page: Page) {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    if (localStorage.getItem("marinara-engine-ui")) return;
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: {
          hasCompletedOnboarding: true,
          rightPanelOpen: false,
          sidebarOpen: false,
        },
        version: 65,
      }),
    );
  }, APP_VERSION);
}

async function openNoodle(page: Page) {
  await page.getByRole("tab", { name: "Open Noodle and NoodleR" }).click();
  await expect(page.locator('[data-component="NoodleView"]')).toBeVisible();
}

async function setStoredTheme(page: Page, theme: "dark" | "light") {
  const updatedAt = Date.now() + 1_000;
  const response = await page.request.get("/api/app-settings/ui");
  if (!response.ok()) throw new Error("Could not read Marinara UI settings");
  const data = (await response.json()) as { value?: string };
  const serverSettings = data.value
    ? (JSON.parse(data.value) as Record<string, unknown>)
    : {};
  const update = await page.request.put("/api/app-settings/ui", {
    data: {
      value: JSON.stringify({
        ...serverSettings,
        theme,
        __updatedAt: updatedAt,
      }),
    },
  });
  if (!update.ok()) throw new Error("Could not update Marinara UI settings");

  await page.evaluate(
    ({ nextTheme, nextUpdatedAt }) => {
      const stored = localStorage.getItem("marinara-engine-ui");
      if (!stored) throw new Error("Marinara UI settings are not initialized");
      const parsed = JSON.parse(stored) as { state?: { theme?: string } };
      parsed.state = { ...parsed.state, theme: nextTheme };
      localStorage.setItem("marinara-engine-ui", JSON.stringify(parsed));
      localStorage.setItem(
        "marinara-engine-ui-updated-at",
        String(nextUpdatedAt),
      );
    },
    { nextTheme: theme, nextUpdatedAt: updatedAt },
  );
}

async function expectSurfaceAccent(
  locator: Locator,
  accent: string,
  foreground: string,
) {
  await expect
    .poll(() =>
      locator.evaluate(
        (element, expected) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--noodle-accent-foreground)";
          element.appendChild(probe);
          const elementStyle = getComputedStyle(element);
          const resolvedForeground = getComputedStyle(probe).color;
          const result = {
            accent: elementStyle.getPropertyValue("--noodle-accent").trim(),
            color: elementStyle.color,
            expected,
            resolvedForeground,
          };
          probe.remove();
          return result;
        },
        { accent, foreground },
      ),
    )
    .toEqual({
      accent,
      color: foreground,
      expected: { accent, foreground },
      resolvedForeground: foreground,
    });
}

test.beforeEach(async ({ page }) => {
  const resetUiSettings = await page.request.put("/api/app-settings/ui", {
    data: { value: "" },
  });
  expect(resetUiSettings.ok()).toBeTruthy();
  await prepareFreshClient(page);
});

test.describe("package-owned Noodle interface", () => {
  test("Noodle interface icons consistently use Noodle blue", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "The full Noodle settings surface is covered on desktop.",
    );

    const errors = collectUnexpectedErrors(page);
    await page.goto("/");
    await openNoodle(page);

    const noodle = page.locator('[data-component="NoodleView"]');
    await expect(noodle).toBeVisible();

    const expectBlueIcons = async (selector: string) => {
      const iconColors = await page
        .locator(selector)
        .locator("svg:visible")
        .evaluateAll((icons) =>
          Array.from(
            new Set(icons.map((icon) => getComputedStyle(icon).color)),
          ),
        );
      expect(iconColors.length).toBeGreaterThan(0);
      expect(iconColors).toEqual(["rgb(126, 167, 255)"]);
    };

    await expectBlueIcons('[data-component="NoodleView"]');
    await noodle.getByRole("button", { name: "Settings", exact: true }).click();
    const scheduleCard = noodle.locator(
      '[data-component="NoodleView.RefreshSchedule"]',
    );
    await expect(scheduleCard).toBeVisible();
    await expect(scheduleCard.getByText("Automatic schedule")).toBeVisible();
    await expectBlueIcons('[data-component="NoodleView.RefreshSchedule"]');

    const firstBootstrapResponse = await page.request.get("/api/noodle");
    expect(firstBootstrapResponse.ok()).toBe(true);
    const firstBootstrap = (await firstBootstrapResponse.json()) as {
      settings: { refreshesPerDay: number };
      scheduler: { scheduledTimes: string[]; completedTimes: string[] };
    };
    expect(firstBootstrap.scheduler.scheduledTimes).toHaveLength(
      firstBootstrap.settings.refreshesPerDay,
    );
    const secondBootstrap = (await (
      await page.request.get("/api/noodle")
    ).json()) as {
      scheduler: { scheduledTimes: string[] };
    };
    expect(secondBootstrap.scheduler.scheduledTimes).toEqual(
      firstBootstrap.scheduler.scheduledTimes,
    );

    await expect(
      scheduleCard.locator("[data-noodle-schedule-slot]"),
    ).toHaveCount(firstBootstrap.scheduler.scheduledTimes.length);
    const pendingRefreshCount = firstBootstrap.scheduler.scheduledTimes.filter(
      (scheduledTime) =>
        !firstBootstrap.scheduler.completedTimes.includes(scheduledTime),
    ).length;
    const rescheduleButtons = scheduleCard.getByRole("button", {
      name: /^Reschedule refresh /,
    });
    await expect(rescheduleButtons).toHaveCount(pendingRefreshCount);
    if (pendingRefreshCount > 0) {
      await rescheduleButtons.first().click();
      await expect(
        scheduleCard.getByLabel(/^New time for refresh /),
      ).toBeVisible();
      await expect(
        scheduleCard.getByRole("button", { name: "Save", exact: true }),
      ).toBeDisabled();
      await scheduleCard
        .getByRole("button", { name: "Cancel reschedule" })
        .click();
      await expect(
        scheduleCard.getByLabel(/^New time for refresh /),
      ).toHaveCount(0);
    }

    await noodle
      .getByRole("button", { name: "Participants", exact: true })
      .click();
    await expect(
      noodle.getByRole("button", { name: "Uninvite everybody" }),
    ).toHaveCSS("color", "rgb(126, 167, 255)");
    await noodle.getByRole("button", { name: "Advanced", exact: true }).click();
    await expect(
      noodle.getByRole("button", { name: "Reset Noodle Timeline" }),
    ).toBeVisible();
    await noodle.getByRole("button", { name: "Reset Noodle Timeline" }).click();
    const resetDialog = page.getByRole("dialog", {
      name: "Reset Noodle Timeline",
    });
    await expect(resetDialog).toBeVisible();
    await expect(resetDialog.locator(".mari-modal-panel")).toHaveCSS(
      "--noodle-accent",
      "#7EA7FF",
    );
    await resetDialog.getByRole("button", { name: "Cancel" }).click();

    expect(errors).toEqual([]);
  });

  test("Noodle and NoodleR fallbacks, profiles, and comments keep their surface accents", async ({
    page,
  }, testInfo) => {
    const initialResponse = await page.request.get("/api/noodle");
    expect(initialResponse.ok()).toBe(true);
    const initial = (await initialResponse.json()) as {
      settings: {
        enableNoodler: boolean;
        noodlerOnboardingState: "incomplete" | "zero" | "completed";
      };
    };
    const personaResponse = await page.request.post(
      "/api/characters/personas",
      {
        data: { name: `NoodleR color viewer ${Date.now()}` },
      },
    );
    expect(personaResponse.ok()).toBe(true);
    const persona = (await personaResponse.json()) as { id: string };
    let stageProfileId: string | null = null;
    let postId: string | null = null;

    try {
      const enableResponse = await page.request.put("/api/noodle/settings", {
        data: { enableNoodler: true, noodlerOnboardingState: "completed" },
      });
      expect(enableResponse.ok()).toBe(true);

      const bootstrapResponse = await page.request.get("/api/noodle");
      expect(bootstrapResponse.ok()).toBe(true);
      const bootstrap = (await bootstrapResponse.json()) as {
        accounts: Array<{ id: string; entityId: string }>;
      };
      const professorMari = bootstrap.accounts.find(
        (account) => account.entityId === "__professor_mari__",
      );
      expect(professorMari).toBeTruthy();

      const stageProfileResponse = await page.request.post(
        `/api/noodle/accounts/${professorMari!.id}/noodler`,
        {
          data: {
            stageProfile: {
              displayName: `NoodleR Accent Stage ${Date.now()}`,
              handle: `accent_stage_${Date.now()}`,
              bio: "Temporary package color regression profile.",
              stagePersonality: "A profile used to verify package colors.",
              disclosureMode: "secret",
            },
          },
        },
      );
      expect(stageProfileResponse.ok()).toBe(true);
      const stageProfile = (await stageProfileResponse.json()) as {
        id: string;
        displayName: string;
        handle: string;
      };
      stageProfileId = stageProfile.id;

      const postResponse = await page.request.post(
        "/api/noodle/noodler/posts",
        {
          data: {
            targetAccountId: stageProfile.id,
            title: null,
            content: `NoodleR accent regression post ${Date.now()}`,
            access: "public",
          },
        },
      );
      expect(postResponse.ok()).toBe(true);
      const post = (await postResponse.json()) as { id: string };
      postId = post.id;

      const commentResponse = await page.request.post(
        `/api/noodle/noodler/posts/${post.id}/interactions`,
        {
          data: {
            personaId: persona.id,
            type: "reply",
            content: "NoodleR pink comment controls.",
          },
        },
      );
      expect(commentResponse.ok()).toBe(true);
      const comment = (await commentResponse.json()) as { id: string };

      await page.addInitScript((personaId) => {
        localStorage.setItem(
          "marinara:noodle:ui",
          JSON.stringify({
            noodleSelectedPersonaId: personaId,
            noodleNavigation: { mode: "noodler", view: "hub" },
          }),
        );
      }, persona.id);
      await page.goto("/");
      await openNoodle(page);

      const noodle = page.locator('[data-component="NoodleView"]');
      await noodle.getByRole("tab", { name: "All creators" }).click();
      await expect
        .poll(() =>
          noodle.evaluate((element) =>
            getComputedStyle(element)
              .getPropertyValue("--noodle-accent")
              .trim(),
          ),
        )
        .toBe("#FF7EC1");
      const fallback = noodle
        .locator("[data-noodle-avatar-fallback]:visible")
        .first();
      await expect(fallback).toHaveCSS("color", NOODLER_PINK_RGB);

      const activePost = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
      const activeComment = activePost.locator(
        `[data-noodle-interaction-id="${comment.id}"]`,
      );
      await expect(activeComment).toBeVisible();
      await expect(
        activeComment.locator("[data-noodle-comment-metadata]"),
      ).toHaveCSS("color", NOODLER_PINK_RGB);
      await expect(
        activeComment.getByRole("button", { name: "Like comment" }),
      ).toHaveCSS("color", NOODLER_PINK_RGB);

      await setStoredTheme(page, "light");
      await page.reload();
      await openNoodle(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      const lightNoodle = page.locator('[data-component="NoodleView"]');
      await lightNoodle.getByRole("tab", { name: "All creators" }).click();
      const lightComment = lightNoodle.locator(
        `[data-noodle-interaction-id="${comment.id}"]`,
      );
      await expect(lightComment).toBeVisible();
      await expectSurfaceAccent(
        lightComment.locator("[data-noodle-comment-metadata]"),
        "#FF7EC1",
        NOODLER_LIGHT_FOREGROUND,
      );
      await expectSurfaceAccent(
        lightComment.getByRole("button", { name: "Like comment" }),
        "#FF7EC1",
        NOODLER_LIGHT_FOREGROUND,
      );

      const bottomNav = lightNoodle.locator(
        '[data-component="NoodleView.MobileBottomNav"]',
      );
      if (testInfo.project.name.includes("mobile")) {
        await expect(bottomNav).toBeVisible();
        const colors = await bottomNav
          .locator("svg:visible")
          .evaluateAll((icons) =>
            Array.from(
              new Set(icons.map((icon) => getComputedStyle(icon).color)),
            ),
          );
        expect(colors.length).toBeGreaterThan(0);
        expect(colors).toEqual([NOODLER_PINK_RGB]);
      } else {
        await expect(bottomNav).toBeHidden();
        const search = lightNoodle
          .getByPlaceholder("Search posts or @creators")
          .locator("..")
          .locator("svg")
          .first();
        await expect(search).toHaveCSS("color", NOODLER_PINK_RGB);
        const refresh = lightNoodle.getByRole("button", {
          name: "Refresh timeline",
          exact: true,
        });
        await expect(refresh.locator("svg")).toHaveCSS(
          "color",
          NOODLER_PINK_RGB,
        );
      }

      await lightNoodle
        .locator(`[data-noodle-post-id="${post.id}"]`)
        .getByRole("button", { name: stageProfile.displayName, exact: true })
        .click();
      await expectSurfaceAccent(
        lightNoodle.locator("[data-noodle-profile-handle]"),
        "#FF7EC1",
        NOODLER_LIGHT_FOREGROUND,
      );
      await expectSurfaceAccent(
        lightNoodle.locator("[data-noodle-avatar-fallback]:visible").last(),
        "#FF7EC1",
        NOODLER_LIGHT_FOREGROUND,
      );
    } finally {
      if (postId) {
        await page.request
          .delete(`/api/noodle/noodler/posts/${postId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (stageProfileId) {
        await page.request
          .delete(`/api/noodle/noodler/accounts/${stageProfileId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
      await page.request.put("/api/noodle/settings", {
        data: {
          enableNoodler: initial.settings.enableNoodler,
          noodlerOnboardingState: initial.settings.noodlerOnboardingState,
        },
      });
      await page.request.delete(`/api/characters/personas/${persona.id}`);
    }
  });

  test("Noodle settings edit and restore the timeline base prompt", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "The complete prompt editing flow is covered on desktop.",
    );

    const promptKey = "noodle.timelineBase";
    const initialDetailResponse = await page.request.get(
      `/api/prompt-overrides/${promptKey}`,
    );
    expect(initialDetailResponse.ok()).toBe(true);
    const initialDetail = (await initialDetailResponse.json()) as {
      override: { template: string; enabled: boolean } | null;
    };
    const customPrompt = `Custom Noodle timeline base prompt ${Date.now()}.`;

    try {
      await page.goto("/");
      await openNoodle(page);
      const noodle = page.locator('[data-component="NoodleView"]');
      await noodle
        .getByRole("button", { name: "Settings", exact: true })
        .click();
      await noodle
        .getByRole("button", { name: "Advanced", exact: true })
        .click();

      const promptSetting = noodle.locator(
        '[data-component="NoodleView.PromptSetting"]',
      );
      await expect(promptSetting).toBeVisible();

      const editPromptButton = promptSetting.getByRole("button", {
        name: "Edit prompt",
      });
      await expect(editPromptButton).toHaveCSS("align-items", "center");
      await expect(editPromptButton).toHaveCSS("justify-content", "center");
      await expect(editPromptButton.locator("svg")).toBeVisible();
      await expect(editPromptButton.locator("svg")).toHaveCSS(
        "color",
        "rgb(126, 167, 255)",
      );
      await editPromptButton.click();
      const editor = page.locator('[data-component="ExpandedTextarea"]');
      await expect(
        editor.getByRole("heading", { name: "Edit Noodle Prompt" }),
      ).toBeVisible();
      const promptTextarea = editor.locator("textarea");
      await expect(promptTextarea).toHaveValue(
        /You write a fake social media timeline for Marinara Engine's in-app parody site called Noodle\./,
      );
      await promptTextarea.fill(customPrompt);
      const saveResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "PUT" &&
          new URL(response.url()).pathname ===
            `/api/prompt-overrides/${promptKey}`,
      );
      await editor.getByRole("button", { name: "Save prompt" }).click();
      expect((await saveResponse).ok()).toBe(true);
      await expect(promptSetting).toContainText(customPrompt);
      await expect(promptSetting).toContainText("Custom");

      const restoreResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "DELETE" &&
          new URL(response.url()).pathname ===
            `/api/prompt-overrides/${promptKey}`,
      );
      await promptSetting
        .getByRole("button", { name: "Restore default" })
        .click();
      expect((await restoreResponse).ok()).toBe(true);
      await expect(promptSetting).toContainText("Default");

      await promptSetting.getByRole("button", { name: "Edit prompt" }).click();
      await expect(
        page.locator('[data-component="ExpandedTextarea"] textarea'),
      ).toHaveValue(
        /You write a fake social media timeline for Marinara Engine's in-app parody site called Noodle\./,
      );
    } finally {
      if (initialDetail.override) {
        await page.request.put(`/api/prompt-overrides/${promptKey}`, {
          data: initialDetail.override,
        });
      } else {
        await page.request.delete(`/api/prompt-overrides/${promptKey}`);
      }
    }
  });

  test("Noodle carryover mode labels fit inside their controls", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "The compact three-column settings row is desktop-only.",
    );

    await page.setViewportSize({ width: 1024, height: 700 });
    await page.goto("/");
    await openNoodle(page);
    const noodle = page.locator('[data-component="NoodleView"]');
    await noodle.getByRole("button", { name: "Settings", exact: true }).click();
    await noodle.getByRole("button", { name: "Advanced", exact: true }).click();
    const carryoverSection = noodle
      .getByRole("heading", { name: "Carryover" })
      .locator("..");

    for (const name of ["Conversations", "Roleplays", "Games"]) {
      const checkbox = carryoverSection.getByRole("checkbox", {
        name,
        exact: true,
      });
      const control = checkbox.locator("..");
      const text = control.getByText(name, { exact: true });
      await expect(control).toBeVisible();
      const [controlRect, textRect, checkboxRect] = await Promise.all([
        control.boundingBox(),
        text.boundingBox(),
        checkbox.boundingBox(),
      ]);
      expect(controlRect).not.toBeNull();
      expect(textRect).not.toBeNull();
      expect(checkboxRect).not.toBeNull();
      expect(textRect!.x).toBeGreaterThanOrEqual(controlRect!.x);
      expect(
        checkboxRect!.x - (textRect!.x + textRect!.width),
      ).toBeGreaterThanOrEqual(6);
      expect(checkboxRect!.x + checkboxRect!.width).toBeLessThanOrEqual(
        controlRect!.x + controlRect!.width,
      );
      expect(
        await text.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
    }
  });

  test("Noodle settings persist through refetch and reload", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "Noodle settings persistence is covered on desktop.",
    );

    const initialResponse = await page.request.get("/api/noodle");
    expect(initialResponse.ok()).toBe(true);
    const initial = (await initialResponse.json()) as {
      settings: {
        enableImagePrompts: boolean;
        maxImagesPerRefresh: number;
        allowRandomUsers: boolean;
        carryoverMaxItems: number;
        refreshesPerDay: number;
      };
    };
    const nextImageLimit = initial.settings.maxImagesPerRefresh === 9 ? 8 : 9;
    const nextRandomUsers = !initial.settings.allowRandomUsers;
    const nextCarryItems = initial.settings.carryoverMaxItems === 10 ? 9 : 10;
    const nextRefreshesPerDay = initial.settings.refreshesPerDay === 3 ? 4 : 3;

    const enableImagesResponse = await page.request.put(
      "/api/noodle/settings",
      {
        data: { enableImagePrompts: true },
      },
    );
    expect(enableImagesResponse.ok()).toBe(true);
    const enabledSettings =
      (await enableImagesResponse.json()) as typeof initial.settings;
    expect(enabledSettings.enableImagePrompts).toBe(true);

    try {
      await page.goto("/");
      await openNoodle(page);
      const noodle = page.locator('[data-component="NoodleView"]');
      await noodle
        .getByRole("button", { name: "Settings", exact: true })
        .click();
      await noodle
        .getByRole("button", { name: "Timeline", exact: true })
        .click();

      const imageLimitInput = noodle
        .locator("label")
        .filter({ hasText: "Images/refresh" })
        .locator('input[type="number"]');
      await expect(imageLimitInput).toBeVisible();
      const imageSaveResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "PUT" &&
          new URL(response.url()).pathname === "/api/noodle/settings",
      );
      await imageLimitInput.fill(String(nextImageLimit));
      await imageLimitInput.blur();
      expect((await imageSaveResponse).ok()).toBe(true);
      await expect(imageLimitInput).toHaveValue(String(nextImageLimit));

      await noodle
        .getByRole("button", { name: "Participants", exact: true })
        .click();
      const randomUsersButton = noodle.getByRole("button", {
        name: /Random users/,
      });
      const randomUsersSaveResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "PUT" &&
          new URL(response.url()).pathname === "/api/noodle/settings",
      );
      await randomUsersButton.click();
      expect((await randomUsersSaveResponse).ok()).toBe(true);

      await expect
        .poll(async () => {
          const response = await page.request.get("/api/noodle");
          const bootstrap = (await response.json()) as typeof initial;
          return {
            maxImagesPerRefresh: bootstrap.settings.maxImagesPerRefresh,
            allowRandomUsers: bootstrap.settings.allowRandomUsers,
          };
        })
        .toEqual({
          maxImagesPerRefresh: nextImageLimit,
          allowRandomUsers: nextRandomUsers,
        });

      await page.reload();
      await openNoodle(page);
      const reloadedNoodle = page.locator('[data-component="NoodleView"]');
      await reloadedNoodle
        .getByRole("button", { name: "Settings", exact: true })
        .click();
      await reloadedNoodle
        .getByRole("button", { name: "Timeline", exact: true })
        .click();
      await expect(
        reloadedNoodle
          .locator("label")
          .filter({ hasText: "Images/refresh" })
          .locator('input[type="number"]'),
      ).toHaveValue(String(nextImageLimit));
      await reloadedNoodle
        .getByRole("button", { name: "Participants", exact: true })
        .click();
      await expect(
        reloadedNoodle.getByRole("button", { name: /Random users/ }),
      ).toContainText(nextRandomUsers ? "Enabled" : "Ambient fake profiles");

      await reloadedNoodle
        .getByRole("button", { name: "Advanced", exact: true })
        .click();
      const carryItemsInput = reloadedNoodle
        .locator("label")
        .filter({ hasText: "Carry items" })
        .locator('input[type="number"]');
      await carryItemsInput.fill(String(nextCarryItems));
      await reloadedNoodle
        .getByRole("button", { name: "Home", exact: true })
        .click();
      await reloadedNoodle
        .getByRole("button", { name: "Settings", exact: true })
        .click();
      await reloadedNoodle
        .getByRole("button", { name: "Advanced", exact: true })
        .click();
      await expect(
        reloadedNoodle
          .locator("label")
          .filter({ hasText: "Carry items" })
          .locator('input[type="number"]'),
      ).toHaveValue(String(nextCarryItems));
      await expect
        .poll(async () => {
          const response = await page.request.get("/api/noodle");
          const bootstrap = (await response.json()) as typeof initial;
          return bootstrap.settings.carryoverMaxItems;
        })
        .toBe(nextCarryItems);

      await reloadedNoodle
        .getByRole("button", { name: "General", exact: true })
        .click();
      const refreshesPerDayInput = reloadedNoodle
        .locator("label")
        .filter({ hasText: "Refreshes/day" })
        .locator('input[type="number"]');
      await refreshesPerDayInput.fill(String(nextRefreshesPerDay));
      await reloadedNoodle
        .getByRole("button", { name: /Notifications/ })
        .click();
      await reloadedNoodle
        .getByRole("button", { name: "Settings", exact: true })
        .click();
      await reloadedNoodle
        .getByRole("button", { name: "General", exact: true })
        .click();
      await expect(
        reloadedNoodle
          .locator("label")
          .filter({ hasText: "Refreshes/day" })
          .locator('input[type="number"]'),
      ).toHaveValue(String(nextRefreshesPerDay));
      await expect
        .poll(async () => {
          const response = await page.request.get("/api/noodle");
          const bootstrap = (await response.json()) as typeof initial;
          return bootstrap.settings.refreshesPerDay;
        })
        .toBe(nextRefreshesPerDay);
    } finally {
      await page.request.put("/api/noodle/settings", {
        data: {
          enableImagePrompts: initial.settings.enableImagePrompts,
          maxImagesPerRefresh: initial.settings.maxImagesPerRefresh,
          allowRandomUsers: initial.settings.allowRandomUsers,
          carryoverMaxItems: initial.settings.carryoverMaxItems,
          refreshesPerDay: initial.settings.refreshesPerDay,
        },
      });
    }
  });

  test("Noodle restores the selected persona and preserves per-persona post authorship", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "Noodle persona persistence is covered on desktop.",
    );

    const createdPersonaIds: string[] = [];
    const createdPostIds: string[] = [];
    try {
      for (const name of ["Noodle Persona One", "Noodle Persona Two"]) {
        const response = await page.request.post("/api/characters/personas", {
          data: {
            name,
            description:
              "Temporary Noodle account persistence regression persona.",
          },
        });
        expect(response.ok()).toBe(true);
        createdPersonaIds.push(((await response.json()) as { id: string }).id);
      }
      const selectedPersonaId = createdPersonaIds[1]!;
      expect((await page.request.get("/api/noodle")).ok()).toBe(true);
      const authoredPosts = [];
      for (const [index, personaId] of createdPersonaIds.entries()) {
        const response = await page.request.post("/api/noodle/posts", {
          data: {
            authorKind: "persona",
            authorEntityId: personaId,
            content: `Authorship regression post ${index + 1}`,
          },
        });
        expect(response.ok()).toBe(true);
        const post = (await response.json()) as {
          id: string;
          authorAccountId: string;
          authorSnapshot: {
            kind: string;
            entityId: string;
            displayName: string;
            handle: string;
          } | null;
        };
        createdPostIds.push(post.id);
        authoredPosts.push(post);
        expect(post.authorSnapshot).toMatchObject({
          kind: "persona",
          entityId: personaId,
          displayName: `Noodle Persona ${index === 0 ? "One" : "Two"}`,
        });
      }
      expect(authoredPosts[0]?.authorAccountId).not.toBe(
        authoredPosts[1]?.authorAccountId,
      );

      await page.goto("/");
      await openNoodle(page);
      const noodle = page.locator('[data-component="NoodleView"]');
      const accountSwitcher = noodle.locator(
        '[data-component="NoodleView.AccountSwitcher"]',
      );
      await accountSwitcher.click();
      await noodle
        .locator(`[data-noodle-persona-id="${selectedPersonaId}"]`)
        .click();

      await expect
        .poll(() =>
          page.evaluate(() => {
            const raw = localStorage.getItem("marinara:noodle:ui");
            if (!raw) return null;
            return (
              (JSON.parse(raw) as { noodleSelectedPersonaId?: string | null })
                .noodleSelectedPersonaId ?? null
            );
          }),
        )
        .toBe(selectedPersonaId);

      await page.reload();
      await openNoodle(page);
      await expect(noodle).toBeVisible();
      await expect(accountSwitcher).toContainText("Noodle Persona Two");
      for (const [index, post] of authoredPosts.entries()) {
        const article = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
        await expect(article).toContainText(
          `Noodle Persona ${index === 0 ? "One" : "Two"}`,
        );
        await expect(article).toContainText(`@${post.authorSnapshot?.handle}`);
      }
    } finally {
      for (const postId of createdPostIds) {
        await page.request
          .delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      for (const personaId of createdPersonaIds) {
        await page.request
          .delete(`/api/characters/personas/${personaId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
    }
  });

  test("Noodle posts tag invited characters with @handle mentions", async ({
    page,
  }) => {
    const errors = collectUnexpectedErrors(page);
    const activePersonaResponse = await page.request.get(
      "/api/characters/personas/active",
    );
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    let personaId = activePersona?.id ?? null;
    let createdPersonaId: string | null = null;
    let createdPostId: string | null = null;
    if (!personaId) {
      const personaResponse = await page.request.post(
        "/api/characters/personas",
        {
          data: {
            name: "Noodle Mention Regression",
            description: "Temporary browser regression persona.",
          },
        },
      );
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      personaId = createdPersona.id;
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(
        `/api/characters/personas/${createdPersona.id}/activate`,
      );
      expect(activateResponse.ok()).toBe(true);
    }

    const initialBootstrapResponse = await page.request.get("/api/noodle");
    expect(initialBootstrapResponse.ok()).toBe(true);
    const initialBootstrap = (await initialBootstrapResponse.json()) as {
      accounts: Array<{ id: string; entityId: string; handle: string }>;
    };
    const professorMariAccount = initialBootstrap.accounts.find(
      (account) => account.entityId === "__professor_mari__",
    );
    expect(professorMariAccount).toBeTruthy();

    try {
      await page.goto("/");
      await openNoodle(page);

      const noodle = page.locator('[data-component="NoodleView"]');
      const composer = noodle.locator(
        '[data-component="NoodleView.InlineComposer"]',
      );
      const textarea = composer.getByPlaceholder("What's simmering?");
      await textarea.fill("Dinner with @prof");

      const mentionList = composer.getByRole("listbox", {
        name: "Tag a character",
      });
      await expect(mentionList).toBeVisible();
      await mentionList
        .getByRole("option", { name: /Professor Mari.*@professor_mari/i })
        .click();
      await expect(textarea).toHaveValue("Dinner with @professor_mari ");
      await textarea.pressSequentially("tonight.");

      const postResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/noodle/posts",
      );
      await composer.getByRole("button", { name: "Post", exact: true }).click();
      const postResponse = await postResponsePromise;
      expect(postResponse.ok()).toBe(true);
      const post = (await postResponse.json()) as {
        id: string;
        metadata: { mentionedAccountIds?: string[] };
      };
      createdPostId = post.id;
      await expect(textarea).toHaveValue("");
      expect(post.metadata.mentionedAccountIds).toContain(
        professorMariAccount!.id,
      );

      const postArticle = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
      await expect(postArticle).toBeVisible();
      const mention = postArticle.getByRole("button", {
        name: "View @professor_mari profile",
      });
      await expect(mention).toBeVisible();

      const updatedBootstrap = (await (
        await page.request.get("/api/noodle")
      ).json()) as {
        digests: Array<{ sourcePostId: string | null; accountIds: string[] }>;
      };
      const postDigest = updatedBootstrap.digests.find(
        (digest) => digest.sourcePostId === post.id,
      );
      expect(postDigest?.accountIds).toContain(professorMariAccount!.id);

      await mention.click();
      await expect(
        noodle.getByRole("heading", { name: "Professor Mari", exact: true }),
      ).toBeVisible();

      const replyResponse = await page.request.post(
        `/api/noodle/posts/${post.id}/interactions`,
        {
          data: {
            actorKind: "persona",
            actorEntityId: personaId,
            type: "reply",
            content: "Reply mention for @professor_mari.",
          },
        },
      );
      expect(replyResponse.ok()).toBe(true);
      const reply = (await replyResponse.json()) as { id: string };

      await page.reload();
      await openNoodle(page);
      const desktopHome = noodle.getByRole("button", {
        name: "Home",
        exact: true,
      });
      const mobileHome = noodle.getByRole("button", { name: "Noodle home" });
      await expect
        .poll(
          async () =>
            (await desktopHome.isVisible()) || (await mobileHome.isVisible()),
        )
        .toBe(true);
      if (await desktopHome.isVisible()) {
        await desktopHome.click();
      } else {
        await mobileHome.click();
      }
      const replyMention = page
        .locator(`[data-noodle-interaction-id="${reply.id}"]`)
        .getByRole("button", { name: "View @professor_mari profile" });
      await expect(replyMention).toBeVisible();
      await replyMention.click();
      await expect(
        noodle.getByRole("heading", { name: "Professor Mari", exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      if (createdPostId) {
        await page.request
          .delete(`/api/noodle/posts/${createdPostId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (createdPersonaId) {
        await page.request
          .delete(`/api/characters/personas/${createdPersonaId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
    }
  });

  test("Noodle renders safe non-link Markdown and keeps known mentions interactive", async ({
    page,
  }) => {
    const errors = collectUnexpectedErrors(page);
    const activePersonaResponse = await page.request.get(
      "/api/characters/personas/active",
    );
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    let personaId = activePersona?.id ?? null;
    let createdPersonaId: string | null = null;
    let createdPostId: string | null = null;

    if (!personaId) {
      const personaResponse = await page.request.post(
        "/api/characters/personas",
        {
          data: {
            name: "Noodle Markdown Regression",
            description: "Temporary browser regression persona.",
          },
        },
      );
      expect(personaResponse.ok()).toBe(true);
      const persona = (await personaResponse.json()) as { id: string };
      personaId = persona.id;
      createdPersonaId = persona.id;
      const activateResponse = await page.request.put(
        `/api/characters/personas/${persona.id}/activate`,
      );
      expect(activateResponse.ok()).toBe(true);
    }

    const bootstrapResponse = await page.request.get("/api/noodle");
    expect(bootstrapResponse.ok()).toBe(true);
    const bootstrap = (await bootstrapResponse.json()) as {
      accounts: Array<{ entityId: string; handle: string }>;
    };
    const professorMariAccount = bootstrap.accounts.find(
      (account) => account.entityId === "__professor_mari__",
    );
    expect(professorMariAccount?.handle).toBe("professor_mari");

    const markdown = [
      "# Markdown heading",
      "",
      "A paragraph with **bold**, *italic*, ~~removed~~, `inline code`, [link label](https://example.invalid/link), ![image alt](https://example.invalid/image.png), and @professor_mari.",
      "",
      "- Unordered one",
      "- Unordered two",
      "",
      "3. Ordered three",
      "4. Ordered four",
      "",
      "> Quoted **text**",
      "",
      "```html",
      "<script>window.__noodleMarkdownExecuted = true</script>",
      "```",
      "",
      '<img src="https://example.invalid/raw.png" onerror="window.__noodleMarkdownExecuted = true">',
    ].join("\n");

    try {
      const postResponse = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "persona",
          authorEntityId: personaId,
          content: markdown,
        },
      });
      expect(postResponse.ok()).toBe(true);
      const post = (await postResponse.json()) as { id: string };
      createdPostId = post.id;

      await page.goto("/");
      await openNoodle(page);
      const noodle = page.locator('[data-component="NoodleView"]');
      const article = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
      await expect(article).toBeVisible();
      await expect(
        article.getByRole("heading", { name: "Markdown heading" }),
      ).toBeVisible();
      await expect(article.locator("strong")).toContainText(["bold", "text"]);
      await expect(article.locator("em")).toHaveText("italic");
      await expect(article.locator("del")).toHaveText("removed");
      await expect(article.locator("p code")).toHaveText("inline code");
      await expect(article.locator("ul > li")).toHaveCount(2);
      await expect(article.locator("ol")).toHaveAttribute("start", "3");
      await expect(article.locator("ol > li")).toHaveCount(2);
      await expect(article.locator("blockquote")).toContainText("Quoted text");
      await expect(article.locator("pre code")).toContainText(
        "<script>window.__noodleMarkdownExecuted = true</script>",
      );
      await expect(article).toContainText("link label");
      await expect(article).toContainText("image alt");
      await expect(article).toContainText(
        '<img src="https://example.invalid/raw.png" onerror="window.__noodleMarkdownExecuted = true">',
      );
      await expect(article.locator("a")).toHaveCount(0);
      await expect(
        article.locator('img[src^="https://example.invalid"]'),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            (window as typeof window & { __noodleMarkdownExecuted?: boolean })
              .__noodleMarkdownExecuted,
        ),
      ).toBeUndefined();

      const mention = article.getByRole("button", {
        name: "View @professor_mari profile",
      });
      await expect(mention).toBeVisible();
      await mention.click();
      await expect(
        noodle.getByRole("heading", { name: "Professor Mari", exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      if (createdPostId) {
        await page.request
          .delete(`/api/noodle/posts/${createdPostId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (createdPersonaId) {
        await page.request
          .delete(`/api/characters/personas/${createdPersonaId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
    }
  });

  test("Noodle polls support character creation and voting on both sides", async ({
    page,
  }) => {
    const errors = collectUnexpectedErrors(page);
    const activePersonaResponse = await page.request.get(
      "/api/characters/personas/active",
    );
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    let personaId = activePersona?.id ?? null;
    let createdPersonaId: string | null = null;
    const createdPostIds: string[] = [];
    if (!personaId) {
      const personaResponse = await page.request.post(
        "/api/characters/personas",
        {
          data: {
            name: "Noodle Poll Regression",
            description: "Temporary browser regression persona.",
          },
        },
      );
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      personaId = createdPersona.id;
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(
        `/api/characters/personas/${createdPersona.id}/activate`,
      );
      expect(activateResponse.ok()).toBe(true);
    }

    const initialBootstrapResponse = await page.request.get("/api/noodle");
    expect(initialBootstrapResponse.ok()).toBe(true);
    const initialBootstrap = (await initialBootstrapResponse.json()) as {
      accounts: Array<{ id: string; kind: string; entityId: string }>;
    };
    const professorMariAccount = initialBootstrap.accounts.find(
      (account) => account.entityId === "__professor_mari__",
    );
    const personaAccount = initialBootstrap.accounts.find(
      (account) => account.kind === "persona" && account.entityId === personaId,
    );
    expect(professorMariAccount).toBeTruthy();
    expect(personaAccount).toBeTruthy();

    try {
      const characterPollResponse = await page.request.post(
        "/api/noodle/posts",
        {
          data: {
            authorKind: "character",
            authorEntityId: "__professor_mari__",
            content: "Help me choose the laboratory tea.",
            poll: {
              question: "Which tea should I brew?",
              options: ["Jasmine", "Earl Grey"],
            },
          },
        },
      );
      expect(characterPollResponse.ok()).toBe(true);
      const characterPollPost = (await characterPollResponse.json()) as {
        id: string;
        metadata: { poll?: { options: Array<{ id: string; label: string }> } };
      };
      createdPostIds.push(characterPollPost.id);
      expect(characterPollPost.metadata.poll?.options).toHaveLength(2);

      await page.goto("/");
      await openNoodle(page);

      const noodle = page.locator('[data-component="NoodleView"]');
      const characterPollArticle = noodle.locator(
        `[data-noodle-post-id="${characterPollPost.id}"]`,
      );
      await expect(
        characterPollArticle.getByRole("region", {
          name: "Poll: Which tea should I brew?",
        }),
      ).toBeVisible();
      const jasmineOption = characterPollArticle.locator(
        '[data-noodle-poll-option="option-1"]',
      );
      const earlGreyOption = characterPollArticle.locator(
        '[data-noodle-poll-option="option-2"]',
      );

      await jasmineOption.click();
      await expect(jasmineOption).toHaveAttribute("aria-pressed", "true");
      await expect(
        characterPollArticle.getByText("1 vote · You voted"),
      ).toBeVisible();
      await earlGreyOption.click();
      await expect(earlGreyOption).toHaveAttribute("aria-pressed", "true");
      await expect(jasmineOption).toHaveAttribute("aria-pressed", "false");
      await expect(
        characterPollArticle.getByText("1 vote · You voted"),
      ).toBeVisible();

      const voteBootstrap = (await (
        await page.request.get("/api/noodle")
      ).json()) as {
        interactions: Array<{
          postId: string;
          actorAccountId: string;
          type: string;
          content: string | null;
        }>;
      };
      const personaVotes = voteBootstrap.interactions.filter(
        (interaction) =>
          interaction.postId === characterPollPost.id &&
          interaction.actorAccountId === personaAccount!.id &&
          interaction.type === "vote",
      );
      expect(personaVotes).toHaveLength(1);
      expect(personaVotes[0]?.content).toBe("option-2");

      const composer = noodle.locator(
        '[data-component="NoodleView.InlineComposer"]',
      );
      await composer.getByTitle("Create poll").click();
      await page
        .getByPlaceholder("What question do you want to ask?")
        .fill("Which experiment comes next?");
      await page.getByPlaceholder("Option 1").fill("Robotics");
      await page.getByPlaceholder("Option 2").fill("Alchemy");
      await page.getByRole("button", { name: "Add poll", exact: true }).click();
      await expect(
        composer.locator('[data-component="NoodleView.DraftPoll"]'),
      ).toBeVisible();

      const personaPollResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/noodle/posts",
      );
      await composer.getByRole("button", { name: "Post", exact: true }).click();
      const personaPollResponse = await personaPollResponsePromise;
      expect(personaPollResponse.ok()).toBe(true);
      const personaPollPost = (await personaPollResponse.json()) as {
        id: string;
        metadata: {
          poll?: { question: string; options: Array<{ id: string }> };
        };
      };
      createdPostIds.push(personaPollPost.id);
      expect(personaPollPost.metadata.poll?.question).toBe(
        "Which experiment comes next?",
      );

      const characterVoteResponse = await page.request.post(
        `/api/noodle/posts/${personaPollPost.id}/interactions`,
        {
          data: {
            actorKind: "character",
            actorEntityId: "__professor_mari__",
            type: "vote",
            content: personaPollPost.metadata.poll?.options[0]?.id,
          },
        },
      );
      expect(characterVoteResponse.ok()).toBe(true);
      const characterVote = (await characterVoteResponse.json()) as {
        actorAccountId: string;
        type: string;
        content: string | null;
      };
      expect(characterVote.actorAccountId).toBe(professorMariAccount!.id);
      expect(characterVote.type).toBe("vote");
      expect(characterVote.content).toBe("option-1");
      expect(errors).toEqual([]);
    } finally {
      for (const postId of createdPostIds) {
        await page.request
          .delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (createdPersonaId) {
        await page.request
          .delete(`/api/characters/personas/${createdPersonaId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
    }
  });

  test("liking one Noodle post leaves unrelated reaction controls visually stable", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "Reaction stability is covered on desktop.",
    );

    const errors = collectUnexpectedErrors(page);
    const activePersonaResponse = await page.request.get(
      "/api/characters/personas/active",
    );
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    let personaId = activePersona?.id ?? null;
    let createdPersonaId: string | null = null;
    const createdPostIds: string[] = [];
    if (!personaId) {
      const personaResponse = await page.request.post(
        "/api/characters/personas",
        {
          data: {
            name: "Noodle Reaction Regression",
            description: "Temporary browser regression persona.",
          },
        },
      );
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      personaId = createdPersona.id;
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(
        `/api/characters/personas/${createdPersona.id}/activate`,
      );
      expect(activateResponse.ok()).toBe(true);
    }

    await page.request.get("/api/noodle");
    for (const label of ["First", "Second"]) {
      const response = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "persona",
          authorEntityId: personaId,
          content: `${label} reaction stability post ${Date.now()}`,
        },
      });
      expect(response.ok()).toBe(true);
      createdPostIds.push(((await response.json()) as { id: string }).id);
    }

    const reactionRequestStarted = createDeferred();
    const releaseReaction = createDeferred();

    try {
      await page.goto("/");
      await openNoodle(page);

      const noodle = page.locator('[data-component="NoodleView"]');
      const targetPost = noodle.locator(
        `[data-noodle-post-id="${createdPostIds[0]}"]`,
      );
      const unrelatedPost = noodle.locator(
        `[data-noodle-post-id="${createdPostIds[1]}"]`,
      );
      await expect(targetPost).toBeVisible();
      await expect(unrelatedPost).toBeVisible();

      const targetLike = targetPost.getByRole("button", { name: "Like post" });
      const unrelatedLike = unrelatedPost.getByRole("button", {
        name: "Like post",
      });
      await expect(targetLike.locator("svg")).toHaveAttribute("fill", "none");
      const unrelatedClass = await unrelatedLike.getAttribute("class");
      const unrelatedText = await unrelatedLike.textContent();
      await page.route("**/api/noodle/posts/*/interactions", async (route) => {
        if (route.request().method() === "POST") {
          reactionRequestStarted.resolve();
          await releaseReaction.promise;
        }
        await route.continue();
      });

      let bootstrapRequestsAfterLike = 0;
      let countBootstrapRequests = false;
      page.on("request", (request) => {
        if (
          countBootstrapRequests &&
          request.method() === "GET" &&
          new URL(request.url()).pathname === "/api/noodle"
        ) {
          bootstrapRequestsAfterLike += 1;
        }
      });

      countBootstrapRequests = true;
      await targetLike.click();
      await reactionRequestStarted.promise;
      await expect(targetLike).toBeDisabled();
      await expect(targetLike).toHaveAttribute("aria-busy", "true");
      await expect(unrelatedLike).toBeEnabled();
      await expect(unrelatedLike).toHaveAttribute(
        "class",
        unrelatedClass ?? "",
      );
      await expect(unrelatedLike).toHaveText(unrelatedText ?? "");

      releaseReaction.resolve();
      const targetUnlike = targetPost.getByRole("button", {
        name: "Unlike post",
      });
      await expect(targetUnlike).toBeEnabled();
      await expect(targetUnlike.locator("svg")).toHaveAttribute(
        "fill",
        "currentColor",
      );
      await expect(
        targetPost.locator('[data-noodle-reaction="like"]'),
      ).toContainText("1");
      await expect(unrelatedLike).toBeEnabled();
      await page.waitForTimeout(150);
      expect(bootstrapRequestsAfterLike).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      releaseReaction.resolve();
      for (const postId of createdPostIds) {
        await page.request
          .delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (createdPersonaId) {
        await page.request
          .delete(`/api/characters/personas/${createdPersonaId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
    }
  });

  test("Noodle persona and character comments can be edited and deleted", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "Comment ownership controls are covered on desktop.",
    );

    const errors = collectUnexpectedErrors(page);
    let personaId: string | null = null;
    let createdPersonaId: string | null = null;
    let postId: string | null = null;
    let controlPostId: string | null = null;

    try {
      const activePersonaResponse = await page.request.get(
        "/api/characters/personas/active",
      );
      const activePersona = activePersonaResponse.ok()
        ? ((await activePersonaResponse.json()) as { id?: string } | null)
        : null;
      personaId = activePersona?.id ?? null;
      if (!personaId) {
        const personaResponse = await page.request.post(
          "/api/characters/personas",
          {
            data: {
              name: "Noodle Comment Owner",
              description: "Temporary browser regression persona.",
            },
          },
        );
        expect(personaResponse.ok()).toBe(true);
        const createdPersona = (await personaResponse.json()) as { id: string };
        personaId = createdPersona.id;
        createdPersonaId = createdPersona.id;
        const activateResponse = await page.request.put(
          `/api/characters/personas/${createdPersona.id}/activate`,
        );
        expect(activateResponse.ok()).toBe(true);
      }

      await page.request.get("/api/noodle");
      const postResponse = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "character",
          authorEntityId: "__professor_mari__",
          content: `Comment ownership regression ${Date.now()}`,
        },
      });
      expect(postResponse.ok()).toBe(true);
      const post = (await postResponse.json()) as { id: string };
      postId = post.id;
      const controlPostResponse = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "character",
          authorEntityId: "__professor_mari__",
          content: `Newer control post ${Date.now()}`,
        },
      });
      expect(controlPostResponse.ok()).toBe(true);
      const controlPost = (await controlPostResponse.json()) as { id: string };
      controlPostId = controlPost.id;

      const ownReplyResponse = await page.request.post(
        `/api/noodle/posts/${postId}/interactions`,
        {
          data: {
            actorKind: "persona",
            actorEntityId: personaId,
            type: "reply",
            content: "Original persona comment.",
          },
        },
      );
      expect(ownReplyResponse.ok()).toBe(true);
      const ownReply = (await ownReplyResponse.json()) as { id: string };

      const childReplyResponse = await page.request.post(
        `/api/noodle/posts/${postId}/interactions`,
        {
          data: {
            actorKind: "character",
            actorEntityId: "__professor_mari__",
            type: "reply",
            content: "Character-owned child reply.",
            parentInteractionId: ownReply.id,
          },
        },
      );
      expect(childReplyResponse.ok()).toBe(true);
      const childReply = (await childReplyResponse.json()) as { id: string };

      await page.goto("/");
      await openNoodle(page);

      const noodle = page.locator('[data-component="NoodleView"]');
      const activePost = noodle.locator(`[data-noodle-post-id="${postId}"]`);
      const newerControlPost = noodle.locator(
        `[data-noodle-post-id="${controlPostId}"]`,
      );
      const ownComment = noodle.locator(
        `[data-noodle-interaction-id="${ownReply.id}"]`,
      );
      const characterComment = noodle.locator(
        `[data-noodle-interaction-id="${childReply.id}"]`,
      );
      await expect(newerControlPost).toBeVisible();
      await expect(ownComment).toBeVisible();
      await expect(characterComment).toBeVisible();
      expect(
        await activePost.evaluate((element, controlPostId) => {
          const control = document.querySelector(
            `[data-noodle-post-id="${controlPostId}"]`,
          );
          return Boolean(
            control &&
              element.compareDocumentPosition(control) &
                Node.DOCUMENT_POSITION_FOLLOWING,
          );
        }, controlPostId),
      ).toBe(true);
      await expect(
        ownComment.getByRole("button", { name: "Edit comment" }),
      ).toBeVisible();
      await expect(
        ownComment.getByRole("button", { name: "Delete comment" }),
      ).toBeVisible();
      await expect(
        characterComment.getByRole("button", { name: "Edit comment" }),
      ).toBeVisible();
      await expect(
        characterComment.getByRole("button", { name: "Delete comment" }),
      ).toBeVisible();
      await expect(
        ownComment.locator("[data-noodle-avatar-fallback]"),
      ).toHaveCSS("color", NOODLE_BLUE_RGB);
      await expect(
        ownComment.locator("[data-noodle-comment-metadata]"),
      ).toHaveCSS("color", NOODLE_BLUE_RGB);
      for (const name of ["Like comment", "Edit comment", "Delete comment"]) {
        await expect(ownComment.getByRole("button", { name })).toHaveCSS(
          "color",
          NOODLE_BLUE_RGB,
        );
      }

      await setStoredTheme(page, "light");
      await page.reload();
      await openNoodle(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await expect(ownComment).toBeVisible();
      await expectSurfaceAccent(
        ownComment.locator("[data-noodle-avatar-fallback]"),
        "#7EA7FF",
        NOODLE_LIGHT_FOREGROUND,
      );
      await expectSurfaceAccent(
        ownComment.locator("[data-noodle-comment-metadata]"),
        "#7EA7FF",
        NOODLE_LIGHT_FOREGROUND,
      );
      for (const name of ["Like comment", "Edit comment", "Delete comment"]) {
        await expectSurfaceAccent(
          ownComment.getByRole("button", { name }),
          "#7EA7FF",
          NOODLE_LIGHT_FOREGROUND,
        );
      }

      await characterComment
        .getByRole("button", { name: "Edit comment" })
        .click();
      const characterEditor = characterComment.locator(
        '[data-component="NoodleView.CommentEditor"]',
      );
      await characterEditor
        .getByRole("textbox", { name: "Edit comment" })
        .fill("Edited character reply.");
      await characterEditor.getByRole("button", { name: "Save" }).click();
      await expect(characterComment).toContainText("Edited character reply.");

      await characterComment
        .getByRole("button", { name: "Delete comment" })
        .click();
      const characterDeleteDialog = page.getByRole("dialog", {
        name: "Delete Noodle Comment",
      });
      await expect(characterDeleteDialog).toBeVisible();
      await characterDeleteDialog
        .getByRole("button", { name: "Delete comment" })
        .click();
      await expect(characterComment).toHaveCount(0);
      await expect(ownComment).toBeVisible();

      await ownComment.getByRole("button", { name: "Edit comment" }).click();
      const editor = ownComment.locator(
        '[data-component="NoodleView.CommentEditor"]',
      );
      await editor
        .getByRole("textbox", { name: "Edit comment" })
        .fill("Edited persona comment.");
      await editor.getByRole("button", { name: "Save" }).click();
      await expect(ownComment).toContainText("Edited persona comment.");

      await ownComment.getByRole("button", { name: "Delete comment" }).click();
      const deleteDialog = page.getByRole("dialog", {
        name: "Delete Noodle Comment",
      });
      await expect(deleteDialog).toBeVisible();
      await deleteDialog
        .getByRole("button", { name: "Delete comment" })
        .click();
      await expect(ownComment).toHaveCount(0);
      await expect(characterComment).toHaveCount(0);

      expect(errors).toEqual([]);
    } finally {
      if (postId) {
        await page.request
          .delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (controlPostId) {
        await page.request
          .delete(`/api/noodle/posts/${controlPostId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (createdPersonaId) {
        await page.request
          .delete(`/api/characters/personas/${createdPersonaId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
    }
  });

  test("Noodle post and reply composers autocomplete character handles", async ({
    page,
  }) => {
    const errors = collectUnexpectedErrors(page);
    let personaId: string | null = null;
    let createdPersonaId: string | null = null;
    let postId: string | null = null;

    try {
      const activePersonaResponse = await page.request.get(
        "/api/characters/personas/active",
      );
      const activePersona = activePersonaResponse.ok()
        ? ((await activePersonaResponse.json()) as { id?: string } | null)
        : null;
      personaId = activePersona?.id ?? null;
      if (!personaId) {
        const personaResponse = await page.request.post(
          "/api/characters/personas",
          {
            data: {
              name: "Noodle Mention Tester",
              description: "Temporary browser regression persona.",
            },
          },
        );
        expect(personaResponse.ok()).toBe(true);
        const createdPersona = (await personaResponse.json()) as { id: string };
        createdPersonaId = createdPersona.id;
        const activateResponse = await page.request.put(
          `/api/characters/personas/${createdPersona.id}/activate`,
        );
        expect(activateResponse.ok()).toBe(true);
      }

      const bootstrapResponse = await page.request.get("/api/noodle");
      expect(bootstrapResponse.ok()).toBe(true);
      const bootstrap = (await bootstrapResponse.json()) as {
        accounts: Array<{
          entityId: string;
          handle: string;
          kind: string;
          invited: boolean;
        }>;
      };
      const mentionAccount = bootstrap.accounts.find(
        (account) =>
          account.kind === "character" &&
          account.invited &&
          account.handle.length > 0,
      );
      expect(mentionAccount).toBeDefined();

      const postResponse = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "character",
          authorEntityId: mentionAccount!.entityId,
          content: `Mention autocomplete regression ${Date.now()}`,
        },
      });
      expect(postResponse.ok()).toBe(true);
      const post = (await postResponse.json()) as { id: string };
      postId = post.id;
      const commentResponse = await page.request.post(
        `/api/noodle/posts/${post.id}/interactions`,
        {
          data: {
            actorKind: "character",
            actorEntityId: mentionAccount!.entityId,
            type: "reply",
            content: "A comment waiting for a tagged response.",
          },
        },
      );
      expect(commentResponse.ok()).toBe(true);
      const comment = (await commentResponse.json()) as { id: string };

      await page.goto("/");
      await openNoodle(page);

      const noodle = page.locator('[data-component="NoodleView"]');
      const mentionPrefix = mentionAccount!.handle.slice(
        0,
        Math.min(2, mentionAccount!.handle.length),
      );
      const inlineComposer = noodle.locator(
        '[data-component="NoodleView.InlineComposer"]',
      );
      const postTextarea = inlineComposer.getByPlaceholder("What's simmering?");
      await postTextarea.fill(`Hello @${mentionPrefix}`);

      const postMentionList = page.locator("#noodle-inline-mention-list");
      await expect(postMentionList).toBeVisible();
      const postMentionOption = postMentionList
        .getByRole("option")
        .filter({ hasText: `@${mentionAccount!.handle}` });
      await expect(postMentionOption).toBeVisible();
      await postMentionOption.click();
      await expect(postTextarea).toHaveValue(
        `Hello @${mentionAccount!.handle} `,
      );

      const activePost = noodle.locator(`[data-noodle-post-id="${postId}"]`);
      const targetComment = activePost.locator(
        `[data-noodle-interaction-id="${comment.id}"]`,
      );
      await targetComment.getByTitle("Reply").click();
      const replyComposer = activePost.locator(
        `[data-component="NoodleView.ReplyComposer"][data-noodle-reply-parent-id="${comment.id}"]`,
      );
      const replyTextarea = replyComposer.getByPlaceholder("Leave a comment…");
      await replyTextarea.fill(`Replying @${mentionAccount!.handle}`);

      const replyMentionList = page.locator("#noodle-reply-mention-list");
      await expect(replyMentionList).toBeVisible();
      const replyMentionOption = replyMentionList
        .getByRole("option")
        .filter({ hasText: `@${mentionAccount!.handle}` });
      await expect(replyMentionOption).toBeVisible();
      await replyTextarea.press("Tab");
      await expect(replyTextarea).toHaveValue(
        `Replying @${mentionAccount!.handle} `,
      );

      expect(errors).toEqual([]);
    } finally {
      if (postId) {
        await page.request
          .delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (createdPersonaId) {
        await page.request
          .delete(`/api/characters/personas/${createdPersonaId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
    }
  });

  test("Noodle desktop composers insert emojis at the active cursor", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("mobile"),
      "Desktop cursor placement is covered in the desktop shell.",
    );

    const errors = collectUnexpectedErrors(page);
    let createdPersonaId: string | null = null;
    let postId: string | null = null;

    try {
      const activePersonaResponse = await page.request.get(
        "/api/characters/personas/active",
      );
      const activePersona = activePersonaResponse.ok()
        ? ((await activePersonaResponse.json()) as { id?: string } | null)
        : null;
      if (!activePersona?.id) {
        const personaResponse = await page.request.post(
          "/api/characters/personas",
          {
            data: {
              name: "Noodle Cursor Tester",
              description: "Temporary browser regression persona.",
            },
          },
        );
        expect(personaResponse.ok()).toBe(true);
        const createdPersona = (await personaResponse.json()) as { id: string };
        createdPersonaId = createdPersona.id;
        const activateResponse = await page.request.put(
          `/api/characters/personas/${createdPersona.id}/activate`,
        );
        expect(activateResponse.ok()).toBe(true);
      }

      const bootstrapResponse = await page.request.get("/api/noodle");
      expect(bootstrapResponse.ok()).toBe(true);
      const bootstrap = (await bootstrapResponse.json()) as {
        accounts: Array<{ entityId: string; kind: string; invited: boolean }>;
      };
      const characterAccount = bootstrap.accounts.find(
        (account) => account.kind === "character" && account.invited,
      );
      expect(characterAccount).toBeDefined();

      const postResponse = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "character",
          authorEntityId: characterAccount!.entityId,
          content: `Emoji cursor regression ${Date.now()}`,
        },
      });
      expect(postResponse.ok()).toBe(true);
      const post = (await postResponse.json()) as { id: string };
      postId = post.id;

      await page.goto("/");
      await openNoodle(page);

      const noodle = page.locator('[data-component="NoodleView"]');
      const inlineComposer = noodle.locator(
        '[data-component="NoodleView.InlineComposer"]',
      );
      const postTextarea = inlineComposer.getByPlaceholder("What's simmering?");
      await postTextarea.fill("Alpha Omega");
      await postTextarea.evaluate((element: HTMLTextAreaElement) => {
        element.focus();
        element.setSelectionRange(6, 6);
      });
      await inlineComposer.getByTitle("Emoji, GIFs and stickers").click();
      await page
        .getByRole("textbox", { name: "Search emojis" })
        .fill("test tube");
      await page.getByRole("button", { name: /test tube/i }).click();
      await expect(postTextarea).toHaveValue("Alpha 🧪Omega");
      await expect
        .poll(() =>
          postTextarea.evaluate(
            (element: HTMLTextAreaElement) => element.selectionStart,
          ),
        )
        .toBe(8);
      await expect
        .poll(() =>
          postTextarea.evaluate(
            (element: HTMLTextAreaElement) => element.selectionEnd,
          ),
        )
        .toBe(8);
      await inlineComposer.getByTitle("Emoji, GIFs and stickers").click();

      const activePost = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
      await activePost.getByTitle("Reply").first().click();
      const replyComposer = activePost.locator(
        '[data-component="NoodleView.ReplyComposer"]',
      );
      const replyTextarea = replyComposer.getByPlaceholder("Leave a comment…");
      await replyTextarea.fill("Reply here");
      await replyTextarea.evaluate((element: HTMLTextAreaElement) => {
        element.focus();
        element.setSelectionRange(6, 10);
      });
      await replyComposer.getByTitle("Emoji, GIFs and stickers").click();
      await page
        .getByRole("textbox", { name: "Search emojis" })
        .fill("test tube");
      await page.getByRole("button", { name: /test tube/i }).click();
      await expect(replyTextarea).toHaveValue("Reply 🧪");
      await expect
        .poll(() =>
          replyTextarea.evaluate(
            (element: HTMLTextAreaElement) => element.selectionStart,
          ),
        )
        .toBe(8);
      await expect
        .poll(() =>
          replyTextarea.evaluate(
            (element: HTMLTextAreaElement) => element.selectionEnd,
          ),
        )
        .toBe(8);

      expect(errors).toEqual([]);
    } finally {
      if (postId) {
        await page.request
          .delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (createdPersonaId) {
        await page.request
          .delete(`/api/characters/personas/${createdPersonaId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
    }
  });

  test("Noodle reply notifications focus the actionable timeline reply", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("mobile"),
      "Reply notification focus is covered on mobile.",
    );

    const errors = collectUnexpectedErrors(page);
    const activePersonaResponse = await page.request.get(
      "/api/characters/personas/active",
    );
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    let personaId = activePersona?.id ?? null;
    let createdPersonaId: string | null = null;
    if (!personaId) {
      const personaResponse = await page.request.post(
        "/api/characters/personas",
        {
          data: {
            name: "Noodle Notification Regression",
            description: "Temporary browser regression persona.",
          },
        },
      );
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      personaId = createdPersona.id;
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(
        `/api/characters/personas/${createdPersona.id}/activate`,
      );
      expect(activateResponse.ok()).toBe(true);
    }

    const createdPostIds: string[] = [];
    try {
      await page.request.get("/api/noodle");
      const postResponse = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "persona",
          authorEntityId: personaId,
          content: `Notification focus regression ${Date.now()}`,
        },
      });
      expect(postResponse.ok()).toBe(true);
      const post = (await postResponse.json()) as { id: string };
      createdPostIds.push(post.id);

      const replyResponse = await page.request.post(
        `/api/noodle/posts/${post.id}/interactions`,
        {
          data: {
            actorKind: "character",
            actorEntityId: "__professor_mari__",
            type: "reply",
            content: "A focused reply regression check.",
          },
        },
      );
      expect(replyResponse.ok()).toBe(true);
      const reply = (await replyResponse.json()) as { id: string };

      await page.goto("/");
      await openNoodle(page);

      const noodle = page.locator('[data-component="NoodleView"]');
      const notificationsButton = noodle.getByRole("button", {
        name: "Noodle notifications",
      });
      await expect(
        notificationsButton.locator(
          '[data-component="NoodleView.NotificationBadge"]',
        ),
      ).toBeVisible();
      await notificationsButton.click();
      await expect(
        noodle.locator('[data-component="NoodleView.NotificationBadge"]'),
      ).toHaveCount(0);
      await noodle
        .getByRole("button", { name: "Replies", exact: true })
        .click();

      const notification = noodle.locator(
        `[data-noodle-notification-target="${reply.id}"]`,
      );
      await expect(notification).toBeVisible();
      await notification.click();

      const focusedReply = noodle.locator(
        `[data-noodle-interaction-id="${reply.id}"]`,
      );
      await expect(focusedReply).toBeVisible();
      await expect(focusedReply).toBeFocused();
      await expect(
        focusedReply.getByTitle(/Like comment|Unlike comment/),
      ).toBeVisible();
      await expect(focusedReply.getByTitle("Reply")).toBeVisible();

      await focusedReply.getByTitle("Reply").click();
      const nestedComposer = noodle.locator(
        `[data-component="NoodleView.ReplyComposer"][data-noodle-reply-parent-id="${reply.id}"]`,
      );
      await expect(nestedComposer).toBeVisible();
      await expect(nestedComposer).toContainText("Replying to");
      const [replyRect, composerRect] = await Promise.all([
        focusedReply.boundingBox(),
        nestedComposer.boundingBox(),
      ]);
      expect(replyRect).not.toBeNull();
      expect(composerRect).not.toBeNull();
      expect(composerRect!.y).toBeGreaterThanOrEqual(
        replyRect!.y + replyRect!.height - 1,
      );
      expect(
        await nestedComposer.evaluate((composer, interactionId) => {
          const target = document.querySelector(
            `[data-noodle-interaction-id="${interactionId}"]`,
          );
          return Boolean(
            target &&
              target.compareDocumentPosition(composer) &
                Node.DOCUMENT_POSITION_FOLLOWING,
          );
        }, reply.id),
      ).toBe(true);

      await nestedComposer.getByTitle("Attach image").click();
      await expect(
        page.getByRole("heading", { name: "Add an image", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Image URL", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Upload from device/i }),
      ).toHaveCSS("background-color", "rgb(126, 167, 255)");

      expect(errors).toEqual([]);
    } finally {
      for (const postId of createdPostIds) {
        await page.request
          .delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (createdPersonaId) {
        await page.request
          .delete(`/api/characters/personas/${createdPersonaId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
    }
  });

  test("Noodle only bumps posts when another account replies to the persona's comment", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "Timeline bump ordering is covered on desktop.",
    );

    const errors = collectUnexpectedErrors(page);
    const activePersonaResponse = await page.request.get(
      "/api/characters/personas/active",
    );
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    let personaId = activePersona?.id ?? null;
    let createdPersonaId: string | null = null;
    if (!personaId) {
      const personaResponse = await page.request.post(
        "/api/characters/personas",
        {
          data: {
            name: "Noodle Bump Regression",
            description: "Temporary browser regression persona.",
          },
        },
      );
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      personaId = createdPersona.id;
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(
        `/api/characters/personas/${createdPersona.id}/activate`,
      );
      expect(activateResponse.ok()).toBe(true);
    }

    const createdPostIds: string[] = [];
    try {
      await page.request.get("/api/noodle");
      const olderPostResponse = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "character",
          authorEntityId: "__professor_mari__",
          content: `Older timeline bump regression ${Date.now()}`,
        },
      });
      expect(olderPostResponse.ok()).toBe(true);
      const olderPost = (await olderPostResponse.json()) as {
        id: string;
        createdAt: string;
      };
      createdPostIds.push(olderPost.id);
      await expect
        .poll(() => Date.now())
        .toBeGreaterThan(Date.parse(olderPost.createdAt));

      const newerPostResponse = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "character",
          authorEntityId: "__professor_mari__",
          content: `Newer timeline bump regression ${Date.now()}`,
        },
      });
      expect(newerPostResponse.ok()).toBe(true);
      const newerPost = (await newerPostResponse.json()) as {
        id: string;
        createdAt: string;
      };
      createdPostIds.push(newerPost.id);
      expect(Date.parse(newerPost.createdAt)).toBeGreaterThan(
        Date.parse(olderPost.createdAt),
      );

      const personaReplyResponse = await page.request.post(
        `/api/noodle/posts/${olderPost.id}/interactions`,
        {
          data: {
            actorKind: "persona",
            actorEntityId: personaId,
            type: "reply",
            content: "My comment should not bump this post.",
          },
        },
      );
      expect(personaReplyResponse.ok()).toBe(true);
      const personaReply = (await personaReplyResponse.json()) as {
        id: string;
      };

      const readRegressionOrder = async () =>
        page
          .locator("[data-noodle-post-id]")
          .evaluateAll(
            (elements, postIds) =>
              elements
                .map((element) => element.getAttribute("data-noodle-post-id"))
                .filter(
                  (postId): postId is string =>
                    postId !== null && postIds.includes(postId),
                ),
            [olderPost.id, newerPost.id],
          );

      await page.goto("/");
      await openNoodle(page);
      await expect(
        page.locator(`[data-noodle-post-id="${olderPost.id}"]`),
      ).toBeVisible();
      await expect
        .poll(readRegressionOrder)
        .toEqual([newerPost.id, olderPost.id]);

      const characterReplyResponse = await page.request.post(
        `/api/noodle/posts/${olderPost.id}/interactions`,
        {
          data: {
            actorKind: "character",
            actorEntityId: "__professor_mari__",
            type: "reply",
            content: "Professor Mari directly replied to the persona comment.",
            parentInteractionId: personaReply.id,
          },
        },
      );
      expect(characterReplyResponse.ok()).toBe(true);

      await page.reload();
      await openNoodle(page);
      await expect(
        page.locator(`[data-noodle-post-id="${olderPost.id}"]`),
      ).toBeVisible();
      await expect
        .poll(readRegressionOrder)
        .toEqual([olderPost.id, newerPost.id]);
      expect(errors).toEqual([]);
    } finally {
      for (const postId of createdPostIds) {
        await page.request
          .delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (createdPersonaId) {
        await page.request
          .delete(`/api/characters/personas/${createdPersonaId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
    }
  });

  test("Noodle uses its mobile shell when the desktop center pane is narrow", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("mobile"),
      "Desktop center-pane responsiveness is covered here.",
    );

    const errors = collectUnexpectedErrors(page);
    await page.goto("/");
    await openNoodle(page);

    const center = page.locator('[data-component="CenterContent"]');
    const noodle = page.locator('[data-component="NoodleView"]');
    const desktopAccountSwitcher = noodle.locator(
      '[data-component="NoodleView.AccountSwitcher"]',
    );
    const mobileBottomNav = noodle.locator(
      '[data-component="NoodleView.MobileBottomNav"]',
    );

    await expect(desktopAccountSwitcher).toBeVisible();
    await expect(mobileBottomNav).toBeHidden();

    await page.locator('[data-tour="sidebar-toggle"]').click();
    await page.locator('[data-tour="panel-settings"]').click();
    await expect
      .poll(() =>
        center.evaluate((element) => element.getBoundingClientRect().width),
      )
      .toBeLessThan(1024);
    await expect(mobileBottomNav).toBeVisible();
    await expect(desktopAccountSwitcher).toBeHidden();

    await page.locator('[data-tour="panel-settings"]').click();
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await expect(desktopAccountSwitcher).toBeVisible();
    await expect(mobileBottomNav).toBeHidden();

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(mobileBottomNav).toBeVisible();
    await expect(desktopAccountSwitcher).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("Noodle mobile shell keeps navigation usable across every view", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("mobile"),
      "The responsive Noodle shell is covered on mobile.",
    );

    const errors = collectUnexpectedErrors(page);
    await page.goto("/");
    await openNoodle(page);

    const noodle = page.locator('[data-component="NoodleView"]');
    const bottomNav = noodle.locator(
      '[data-component="NoodleView.MobileBottomNav"]',
    );
    await expect(bottomNav).toBeVisible();
    // The wordmark is the bottom bar's middle button now; there is no top header.
    const headerLogo = bottomNav.locator('img[src$="/noodle-klusek.png"]');
    // The home timeline's own sticky bar stands in for the old header when a step
    // needs to prove the reader landed back on the timeline.
    const homeHeader = noodle.locator(
      '[data-component="NoodleView.StickyHeader"]',
    );
    await expect(headerLogo).toBeVisible();
    const bottomNavIconColors = await bottomNav
      .locator("svg:visible")
      .evaluateAll((icons) =>
        Array.from(new Set(icons.map((icon) => getComputedStyle(icon).color))),
      );
    expect(bottomNavIconColors.length).toBeGreaterThan(0);
    expect(bottomNavIconColors).toEqual(["rgb(126, 167, 255)"]);

    const [noodleRect, logoRect, bottomNavRect, bottomNavRowRect] =
      await Promise.all([
        noodle.boundingBox(),
        headerLogo.boundingBox(),
        bottomNav.boundingBox(),
        bottomNav.locator(":scope > div").boundingBox(),
      ]);
    expect(noodleRect).not.toBeNull();
    expect(logoRect).not.toBeNull();
    expect(bottomNavRect).not.toBeNull();
    expect(bottomNavRowRect).not.toBeNull();
    expect(
      Math.abs(
        logoRect!.x +
          logoRect!.width / 2 -
          (noodleRect!.x + noodleRect!.width / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        bottomNavRect!.y +
          bottomNavRect!.height -
          (noodleRect!.y + noodleRect!.height),
      ),
    ).toBeLessThanOrEqual(1);
    expect(bottomNavRowRect!.height).toBe(56);
    expect(bottomNavRect!.height).toBeLessThanOrEqual(62);

    const sawDrawerSlide = await page.evaluate(async () => {
      const trigger = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Open Noodle account menu"]',
      );
      if (!trigger) return false;
      trigger.click();
      const positions: number[] = [];
      for (let frame = 0; frame < 10; frame += 1) {
        await new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => resolve()),
        );
        const drawer = document.querySelector<HTMLElement>(
          '[data-component="NoodleView.MobileDrawer"]',
        );
        if (drawer) positions.push(drawer.getBoundingClientRect().x);
      }
      const first = positions[0];
      const last = positions.at(-1);
      return (
        first !== undefined &&
        last !== undefined &&
        first < -1 &&
        last > first + 10
      );
    });
    expect(sawDrawerSlide).toBe(true);

    const drawer = page.locator('[data-component="NoodleView.MobileDrawer"]');
    const accountMenu = page.getByRole("dialog", {
      name: "Noodle account menu",
    });
    await expect(accountMenu).toBeVisible();
    await expect
      .poll(async () => {
        const [drawerX, noodleX] = await Promise.all([
          drawer.evaluate((element) =>
            Math.round(element.getBoundingClientRect().x),
          ),
          noodle.evaluate((element) =>
            Math.round(element.getBoundingClientRect().x),
          ),
        ]);
        return drawerX - noodleX;
      })
      .toBe(0);
    const [drawerRect, topBarRect] = await Promise.all([
      drawer.boundingBox(),
      page.locator('[data-component="TopBar"]').boundingBox(),
    ]);
    expect(drawerRect).not.toBeNull();
    expect(topBarRect).not.toBeNull();
    expect(Math.abs(drawerRect!.x - noodleRect!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(drawerRect!.y - noodleRect!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(drawerRect!.width - noodleRect!.width)).toBeLessThanOrEqual(
      1,
    );
    expect(
      Math.abs(drawerRect!.height - noodleRect!.height),
    ).toBeLessThanOrEqual(1);
    expect(drawerRect!.y).toBeGreaterThanOrEqual(
      topBarRect!.y + topBarRect!.height - 1,
    );
    for (const item of ["Home", "Profile", "Settings", "Post"]) {
      await expect(
        accountMenu.getByRole("button", { name: item, exact: true }),
      ).toBeVisible();
    }
    await expect(
      accountMenu.getByRole("button", { name: "Switch account" }),
    ).toBeVisible();

    const retainedDuringCollapse = await page.evaluate(async () => {
      const close = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Close Noodle account menu"]',
      );
      close?.click();
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
      return Boolean(
        document.querySelector('[data-component="NoodleView.MobileDrawer"]'),
      );
    });
    expect(retainedDuringCollapse).toBe(true);
    await expect(drawer).toHaveCount(0);

    await bottomNav
      .getByRole("button", { name: "Open Noodle account menu" })
      .click();
    await expect(accountMenu).toBeVisible();
    await accountMenu
      .getByRole("button", { name: "Post", exact: true })
      .click();
    await expect(drawer).toHaveCount(0);
    const composer = page.getByRole("heading", { name: "New post" });
    await expect(composer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(composer).toBeHidden();

    await bottomNav
      .getByRole("button", { name: "Open Noodle account menu" })
      .click();
    await accountMenu
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await expect(drawer).toHaveCount(0);
    await expect(
      noodle.getByRole("heading", { name: "Noodle settings" }),
    ).toBeVisible();
    await noodle.getByRole("button", { name: "Advanced", exact: true }).click();
    const promptSetting = noodle.locator(
      '[data-component="NoodleView.PromptSetting"]',
    );
    await expect(promptSetting).toBeVisible();
    const editPromptButton = promptSetting.getByRole("button", {
      name: "Edit prompt",
    });
    await expect(editPromptButton).toHaveCSS("justify-content", "center");
    await expect(editPromptButton.locator("svg")).toBeVisible();
    await expect(editPromptButton.locator("svg")).toHaveCSS(
      "color",
      "rgb(126, 167, 255)",
    );
    await editPromptButton.click();
    const promptEditor = page.locator('[data-component="ExpandedTextarea"]');
    await expect(
      promptEditor.getByRole("heading", { name: "Edit Noodle Prompt" }),
    ).toBeVisible();
    await promptEditor.getByRole("button", { name: "Cancel" }).first().click();
    await expect(promptEditor).toBeHidden();
    await expect(bottomNav).toBeVisible();
    await noodle
      .getByRole("button", { name: "Back to where you were", exact: true })
      .click();
    await expect(homeHeader).toBeVisible();

    const timelineScroller = noodle.locator(
      '[data-component="NoodleView.TimelineScroller"]',
    );
    await timelineScroller.evaluate((element) => {
      const content = element.firstElementChild as HTMLElement | null;
      if (content) content.style.minHeight = `${element.clientHeight + 100}px`;
      element.scrollTo({ top: element.scrollHeight });
    });
    expect(
      await timelineScroller.evaluate((element) => element.scrollTop),
    ).toBeGreaterThan(0);
    await bottomNav.getByRole("button", { name: "Noodle home" }).click();
    await expect(homeHeader).toBeVisible();
    await expect
      .poll(() => timelineScroller.evaluate((element) => element.scrollTop))
      .toBe(0);

    await bottomNav
      .getByRole("button", { name: "Open Noodle account menu" })
      .click();
    await accountMenu
      .getByRole("button", { name: "Profile", exact: true })
      .click();
    await expect(drawer).toHaveCount(0);
    await expect(
      noodle.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();
    await expect(bottomNav).toBeVisible();
    await noodle
      .getByRole("button", { name: "Back to Noodle timeline" })
      .click();
    await expect(homeHeader).toBeVisible();

    await bottomNav
      .getByRole("button", { name: "Search", exact: true })
      .click();
    const searchInput = noodle.getByRole("searchbox", {
      name: "Search",
      exact: true,
    });
    await expect(searchInput).toBeVisible();
    await expect(
      noodle.getByRole("heading", { name: "Who to follow" }),
    ).toBeVisible();
    await expect(bottomNav).toBeVisible();
    await noodle
      .getByRole("button", { name: "Back to Noodle timeline" })
      .click();
    await expect(homeHeader).toBeVisible();

    await bottomNav
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await searchInput.fill("Professor");
    await expect(
      noodle.getByRole("heading", { name: "Search results" }),
    ).toBeVisible();
    await bottomNav.getByRole("button", { name: "Noodle home" }).click();
    await expect(homeHeader).toBeVisible();
    await bottomNav
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await expect(searchInput).toHaveValue("");

    await bottomNav
      .getByRole("button", { name: "Noodle notifications" })
      .click();
    await expect(
      noodle.getByRole("heading", { name: "Notifications" }),
    ).toBeVisible();
    await expect(bottomNav).toBeVisible();
    await noodle
      .getByRole("button", { name: "Back to Noodle timeline" })
      .click();
    await expect(homeHeader).toBeVisible();

    expect(errors).toEqual([]);
  });
});
