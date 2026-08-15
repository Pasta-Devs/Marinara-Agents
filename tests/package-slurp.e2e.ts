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
  await page.getByRole("tab", { name: "Open Slurp" }).click();
  await expect(page.locator('[data-component="NoodleView"]')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const resetUiSettings = await page.request.put("/api/app-settings/ui", {
    data: { value: "" },
  });
  expect(resetUiSettings.ok()).toBeTruthy();
  await prepareFreshClient(page);
});

test.describe("standalone Slurp package", () => {
  test("opens as an enabled pink Creator surface", async ({ page }) => {
    const errors = collectUnexpectedErrors(page);
    const bootstrapResponse = await page.request.get("/api/slurp");
    expect(bootstrapResponse.ok()).toBe(true);
    const bootstrap = (await bootstrapResponse.json()) as {
      settings: { enableNoodler: boolean };
    };
    expect(bootstrap.settings.enableNoodler).toBe(true);

    await page.goto("/");
    await openSlurp(page);

    const slurp = page.locator('[data-component="NoodleView"]');
    await expect
      .poll(() =>
        slurp.evaluate((element) =>
          getComputedStyle(element).getPropertyValue("--noodle-accent").trim(),
        ),
      )
      .toBe("#FF7EC1");
    await expect(
      slurp.locator('img[src$="/slurp-klusek.png"]:visible').first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("creates package-owned profiles and shows their viewer feed", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "The complete standalone Creator flow is covered on desktop.",
    );

    const errors = collectUnexpectedErrors(page);
    const suffix = Date.now();
    const personaName = `Slurp viewer ${suffix}`;
    const personaResponse = await page.request.post(
      "/api/characters/personas",
      {
        data: { name: personaName },
      },
    );
    expect(personaResponse.ok()).toBe(true);
    const persona = (await personaResponse.json()) as { id: string };

    let stageProfileId: string | null = null;
    let postId: string | null = null;
    try {
      const settingsResponse = await page.request.put("/api/slurp/settings", {
        data: { noodlerOnboardingState: "completed" },
      });
      expect(settingsResponse.ok()).toBe(true);

      const bootstrapResponse = await page.request.get("/api/slurp");
      expect(bootstrapResponse.ok()).toBe(true);
      const bootstrap = (await bootstrapResponse.json()) as {
        accounts: Array<{ id: string; entityId: string }>;
      };
      const professorMari = bootstrap.accounts.find(
        (account) => account.entityId === "__professor_mari__",
      );
      expect(professorMari).toBeTruthy();

      const stageProfileResponse = await page.request.post(
        `/api/slurp/accounts/${professorMari!.id}/noodler`,
        {
          data: {
            stageProfile: {
              displayName: `Slurp Professor Mari ${suffix}`,
              handle: `slurp_mari_${suffix}`,
              bio: "Standalone Slurp package browser proof.",
              stagePersonality: "Knowing, playful, and scientifically precise.",
              disclosureMode: "hinted",
            },
          },
        },
      );
      expect(stageProfileResponse.ok()).toBe(true);
      const stageProfile = (await stageProfileResponse.json()) as {
        id: string;
        displayName: string;
      };
      stageProfileId = stageProfile.id;

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
          localStorage.setItem(
            "marinara:slurp:ui",
            JSON.stringify({
              navigation: { mode: "creator", view: "hub" },
              viewerPersonaId: personaId,
            }),
          );
        },
        { personaId: persona.id },
      );

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

      await page.evaluate((personaId) => {
        localStorage.setItem(
          "marinara:slurp:ui",
          JSON.stringify({
            navigation: { mode: "creator", view: "profiles" },
            viewerPersonaId: personaId,
          }),
        );
      }, persona.id);
      await page.reload();
      await openSlurp(page);
      await slurp.getByRole("button", { name: "New profile" }).click();
      await expect(slurp.getByText(personaName, { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      if (postId) {
        await page.request
          .delete(`/api/slurp/noodler/posts/${postId}`, { timeout: 5_000 })
          .catch(() => undefined);
      }
      if (stageProfileId) {
        await page.request
          .delete(`/api/slurp/noodler/accounts/${stageProfileId}`, {
            timeout: 5_000,
          })
          .catch(() => undefined);
      }
      await page.request.delete(`/api/characters/personas/${persona.id}`);
    }
  });
});
