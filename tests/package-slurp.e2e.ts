import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("MARINARA_ENGINE_ROOT is required");
const APP_VERSION = (
  JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")) as {
    version: string;
  }
).version;

function collectUnexpectedErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (/favicon|ResizeObserver/i.test(value)) return;
    errors.push(value);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
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

async function openSlurp(page: Page) {
  const slurp = page.locator('[data-component="NoodleView"]');
  const tab = page.getByRole("tab", { name: "Open Slurp" });
  await expect(tab).toBeVisible();
  await expect
    .poll(
      async () => {
        if (await slurp.isVisible()) return true;
        if ((await tab.getAttribute("aria-selected")) !== "true") {
          await tab.click();
        }
        return false;
      },
      { timeout: 30_000, intervals: [250, 500, 1_000] },
    )
    .toBe(true);
}

async function getSlurpSettings(page: Page) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/slurp/settings");
        return response.ok();
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  return page.request.get("/api/slurp/settings");
}

test.beforeEach(async ({ page }) => {
  const resetUiSettings = await page.request.put("/api/app-settings/ui", {
    data: { value: "" },
  });
  expect(resetUiSettings.ok()).toBeTruthy();
  await prepareFreshClient(page);
});

test.describe("standalone Slurp package", () => {
  test("image context choices persist and creator refresh counts down", async ({ page }, testInfo) => {
    const initialSettings = await (await getSlurpSettings(page)).json();
    let profileId: string | null = null;
    const releases: Array<() => void> = [];
    try {
      expect(
        (
          await page.request.patch("/api/slurp/settings", {
            data: { onboarding: "completed", imageContextMode: "auto" },
          })
        ).ok(),
      ).toBe(true);
      const profileResponse = await page.request.post("/api/slurp/accounts/__professor_mari__/noodler", {
        data: {
          stageProfile: {
            displayName: "Image context fixture",
            handle: `image_fixture_${Date.now()}`,
            bio: "Fixture",
            stagePersonality: "Concise",
            disclosureMode: "open",
          },
        },
      });
      expect(profileResponse.ok()).toBe(true);
      profileId = ((await profileResponse.json()) as { id: string }).id;
      const profiles = (await (await page.request.get("/api/slurp/noodler/accounts")).json()) as Array<
        Record<string, unknown>
      >;
      const profile = profiles.find(({ id }) => id === profileId)!;
      expect(profile).toBeTruthy();
      await page.route("**/api/slurp/noodler/accounts", (route) =>
        route.fulfill({
          json: [0, 1, 2].map((index) => ({
            ...profile,
            id: `progress-${index}`,
            displayName: `Creator ${index + 1}`,
          })),
        }),
      );
      await page.route("**/api/slurp/noodler/auto-post/refresh-targeted", async (route) => {
        const body = route.request().postDataJSON() as { accountIds: string[] };
        expect(body.accountIds).toHaveLength(1);
        await new Promise<void>((resolve) => releases.push(resolve));
        await route.fulfill({ json: { outcomes: [{ accountId: body.accountIds[0], status: "generated" }] } });
      });
      await page.addInitScript(() =>
        localStorage.setItem(
          "marinara:slurp:package-ui",
          JSON.stringify({ navigation: { mode: "creator-settings", section: "images" }, onboardingState: "completed" }),
        ),
      );
      await page.goto("/");
      await openSlurp(page);
      const choice = page.getByRole("combobox", { name: /Image context for reactions/ });
      await expect(choice).toHaveValue("auto");
      for (const mode of ["imagePrompt", "vision", "auto"]) {
        await choice.selectOption(mode);
        await expect
          .poll(
            async () =>
              ((await (await page.request.get("/api/slurp/settings")).json()) as { imageContextMode: string })
                .imageContextMode,
          )
          .toBe(mode);
      }
      await page.screenshot({ path: testInfo.outputPath("slurp-image-context-settings.png") });
      await page.getByRole("button", { name: "Publishing", exact: true }).click();
      await page.getByRole("button", { name: "Refresh Slurp now", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Refresh Slurp now", exact: true });
      await dialog.getByRole("button", { name: "Generate 3", exact: true }).click();
      await expect.poll(() => releases.length).toBe(3);
      await expect(dialog.getByRole("status")).toHaveText("3 remaining");
      releases[0]!();
      await expect(dialog.getByRole("status")).toHaveText("2 remaining");
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
      await page.screenshot({ path: testInfo.outputPath("slurp-remaining-generations.png") });
      releases[1]!();
      await expect(dialog.getByRole("status")).toHaveText("1 remaining");
      releases[2]!();
      await expect(dialog).toBeHidden();
      await expect(page.getByText("3 published.", { exact: true })).toBeVisible();
    } finally {
      releases.forEach((release) => release());
      await page.request.patch("/api/slurp/settings", {
        data: { imageContextMode: initialSettings.imageContextMode, onboarding: initialSettings.onboarding },
      });
      if (profileId) await page.request.delete(`/api/slurp/noodler/accounts/${profileId}`);
    }
  });

  test("opens as an enabled pink Creator surface", async ({ page }) => {
    const errors = collectUnexpectedErrors(page);
    const settingsResponse = await getSlurpSettings(page);
    const settings = (await settingsResponse.json()) as {
      onboarding: string;
    };
    expect(typeof settings.onboarding).toBe("string");

    await page.goto("/");
    await openSlurp(page);

    const slurp = page.locator('[data-component="NoodleView"]');
    await expect
      .poll(() => slurp.evaluate((element) => getComputedStyle(element).getPropertyValue("--noodle-accent").trim()))
      .toBe("#FF7EC1");
    await expect(slurp.locator('img[src$="/slurp-logo.png"]:visible').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("creates package-owned profiles and shows their viewer feed", async ({ page }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "The complete standalone Creator flow is covered on desktop.",
    );

    const errors = collectUnexpectedErrors(page);
    const suffix = Date.now();
    const personaName = `Slurp viewer ${suffix}`;
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: personaName },
    });
    expect(personaResponse.ok()).toBe(true);
    const persona = (await personaResponse.json()) as { id: string };

    let stageProfileId: string | null = null;
    let personaStageProfileId: string | null = null;
    let postId: string | null = null;
    const imageConnectionIds: string[] = [];
    try {
      await getSlurpSettings(page);
      const settingsResponse = await page.request.patch("/api/slurp/settings", {
        data: { onboarding: "completed" },
      });
      expect(settingsResponse.ok()).toBe(true);

      // Professor Mari is a built-in character; the standalone Slurp package
      // resolves a creator source directly by entity id.
      const stageProfileResponse = await page.request.post(`/api/slurp/accounts/__professor_mari__/noodler`, {
        data: {
          stageProfile: {
            displayName: `Slurp Professor Mari ${suffix}`,
            handle: `slurp_mari_${suffix}`,
            bio: "Standalone Slurp package browser proof.",
            stagePersonality: "Knowing, playful, and scientifically precise.",
            disclosureMode: "open",
          },
        },
      });
      expect(stageProfileResponse.ok()).toBe(true);
      const stageProfile = (await stageProfileResponse.json()) as {
        id: string;
        displayName: string;
      };
      stageProfileId = stageProfile.id;

      const personaStageProfileResponse = await page.request.post(`/api/slurp/accounts/${persona.id}/noodler`, {
        data: {
          stageProfile: {
            displayName: personaName,
            handle: `slurp_persona_${suffix}`,
            bio: "Persona-owned Slurp profile proof.",
            stagePersonality: "Direct and self-authored.",
            disclosureMode: "open",
          },
        },
      });
      expect(personaStageProfileResponse.ok()).toBe(true);
      const personaStageProfile = (await personaStageProfileResponse.json()) as { id: string };
      personaStageProfileId = personaStageProfile.id;

      for (const [name, isDefault] of [
        [`Slurp image default ${suffix}`, true],
        [`Slurp image alternate ${suffix}`, false],
      ] as const) {
        const connectionResponse = await page.request.post("/api/connections", {
          data: {
            name,
            provider: "image_generation",
            baseUrl: "https://example.invalid",
            apiKey: "package-browser-test",
            model: "package-browser-image",
            defaultForAgents: isDefault,
          },
        });
        expect(connectionResponse.ok()).toBe(true);
        imageConnectionIds.push(((await connectionResponse.json()) as { id: string }).id);
      }

      const postContent = `Standalone Slurp viewer post ${suffix}`;
      const postResponse = await page.request.post("/api/slurp/noodler/posts", {
        data: {
          targetAccountId: stageProfile.id,
          title: null,
          content: postContent,
          access: "public",
        },
      });
      expect(postResponse.ok()).toBe(true);
      postId = ((await postResponse.json()) as { id: string }).id;

      await page.addInitScript(
        ({ personaId }) => {
          const bootKey = "marinara:slurp:test-bootstrapped";
          if (sessionStorage.getItem(bootKey)) return;
          localStorage.setItem(
            "marinara:slurp:package-ui",
            JSON.stringify({
              navigation: { mode: "creator", view: "hub" },
              viewerPersonaId: personaId,
              // Skip the "So, what is Slurp?" first-run wizard; without a
              // "completed" onboardingState it renders an overlay that
              // intercepts pointer events on the creator hub tabs.
              onboardingState: "completed",
            }),
          );
          sessionStorage.setItem(bootKey, "true");
        },
        { personaId: persona.id },
      );

      const feedProbe = await page.request.get(
        `/api/slurp/noodler/viewer/feed?personaId=${encodeURIComponent(persona.id)}&tab=all&limit=20`,
      );
      expect(feedProbe.ok(), `${feedProbe.status()} ${feedProbe.statusText()} ${await feedProbe.text()}`).toBe(true);
      const feedProbeBody = (await feedProbe.json()) as {
        items: Array<{ creatorAccountId: string; post: { id: string; content: string } }>;
      };
      expect(
        feedProbeBody.items.some((item) => item.post.id === postId && item.post.content === postContent),
        JSON.stringify(feedProbeBody),
      ).toBe(true);
      const shellProbe = await page.request.get(
        `/api/slurp/noodler/viewer?personaId=${encodeURIComponent(persona.id)}`,
      );
      expect(shellProbe.ok()).toBe(true);
      const shellProbeBody = (await shellProbe.json()) as {
        creators: Array<{ profile: { id: string } }>;
      };
      expect(
        shellProbeBody.creators.some((creator) => creator.profile.id === stageProfile.id),
        JSON.stringify(shellProbeBody),
      ).toBe(true);

      await page.goto("/");
      await openSlurp(page);
      const slurp = page.locator('[data-component="NoodleView"]');
      await slurp.getByRole("tab", { name: "All creators" }).click();
      await expect(slurp.getByText(postContent)).toBeVisible();
      await expect(
        slurp.getByRole("button", {
          name: stageProfile.displayName,
          exact: true,
        }),
      ).toBeVisible();

      await page.evaluate(
        ({ personaId }) => {
          localStorage.setItem(
            "marinara:slurp:package-ui",
            JSON.stringify({
              navigation: { mode: "creator-settings", section: "creators" },
              viewerPersonaId: personaId,
              onboardingState: "completed",
            }),
          );
        },
        { personaId: persona.id },
      );
      await page.reload();
      await openSlurp(page);

      const imageConnectionSelect = page.getByLabel(`Image connection for ${stageProfile.displayName}`);
      await expect(imageConnectionSelect).toBeEnabled();
      await imageConnectionSelect.selectOption(imageConnectionIds[1]);
      await expect
        .poll(async () => {
          const response = await page.request.get("/api/slurp/noodler/image-connections");
          if (!response.ok()) return null;
          const mappings = (await response.json()) as { creatorConnectionIds: Record<string, string> };
          return mappings.creatorConnectionIds[stageProfile.id] ?? null;
        })
        .toBe(imageConnectionIds[1]);

      const scheduleButton = page.getByRole("button", { name: `Edit schedule for ${stageProfile.displayName}` });
      await expect(scheduleButton).toBeVisible();
      await scheduleButton.click();
      const scheduleDialog = page.getByRole("dialog", { name: `Schedule for ${stageProfile.displayName}` });
      await expect(scheduleDialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(scheduleDialog).toBeHidden();

      await page.getByRole("button", { name: "Publishing" }).click();
      await page.getByRole("button", { name: "Edit prompt" }).click();
      const promptDialog = page.getByRole("dialog", { name: "Edit generation guidance" });
      const savePrompt = promptDialog.getByRole("button", { name: "Save prompt" });
      await expect(savePrompt).toBeVisible();
      await expect
        .poll(() =>
          savePrompt.evaluate((element) => {
            const style = getComputedStyle(element);
            return style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.color !== "rgba(0, 0, 0, 0)";
          }),
        )
        .toBe(true);
      await expect
        .poll(() =>
          page
            .locator('[data-marinara-capability-scope="slurp"]')
            .evaluate((element) => getComputedStyle(element).getPropertyValue("--noodle-accent").trim().toLowerCase()),
        )
        .toBe("#ff7ec1");
      await page.keyboard.press("Escape");
      await expect(promptDialog).toBeHidden();

      await page.evaluate(
        ({ personaId, accountId }) => {
          localStorage.setItem(
            "marinara:slurp:package-ui",
            JSON.stringify({
              navigation: { mode: "creator", view: "profile", accountId },
              viewerPersonaId: personaId,
              onboardingState: "completed",
            }),
          );
        },
        { personaId: persona.id, accountId: personaStageProfile.id },
      );
      await page.reload();
      await openSlurp(page);
      await page.getByText("Additional controls", { exact: true }).click();
      await expect(page.getByRole("button", { name: /^Automation/u })).toHaveCount(0);
      await page.getByRole("button", { name: "Access", exact: true }).click();
      const accessDialog = page.getByRole("dialog", { name: "Viewer access" });
      await expect(accessDialog).toBeVisible();
      await expect(accessDialog.getByText(personaName, { exact: true })).toHaveCount(0);

      expect(errors).toEqual([]);
    } finally {
      if (postId) {
        await page.request.delete(`/api/slurp/noodler/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
      }
      if (stageProfileId) {
        await page.request
          .delete(`/api/slurp/noodler/accounts/${stageProfileId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
      if (personaStageProfileId) {
        await page.request
          .delete(`/api/slurp/noodler/accounts/${personaStageProfileId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
      const connectionCleanupResults = await Promise.allSettled(
        imageConnectionIds.map((connectionId) =>
          page.request.delete(`/api/connections/${connectionId}`, { timeout: 5_000 }),
        ),
      );
      for (const result of connectionCleanupResults) {
        expect(result.status).toBe("fulfilled");
        if (result.status === "fulfilled") {
          expect(result.value.ok()).toBe(true);
        }
      }
      await page.request.delete(`/api/characters/personas/${persona.id}`, { timeout: 5_000 }).catch(() => undefined);
    }
  });
});
