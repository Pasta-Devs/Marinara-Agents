import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("MARINARA_ENGINE_ROOT is required");
const appVersion = (JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")) as { version: string })
  .version;

async function setKeyboardViewport(page: Page, height: number, offsetTop = 0) {
  await page.evaluate(
    ({ height, offsetTop }) => {
      const viewport = window.visualViewport!;
      for (const [property, value] of Object.entries({ height, offsetTop, pageTop: offsetTop })) {
        Object.defineProperty(viewport, property, { configurable: true, get: () => value });
      }
      viewport.dispatchEvent(new Event("resize"));
    },
    { height, offsetTop },
  );
}

async function firstLineGeometry(field: Locator) {
  return field.evaluate((element: HTMLTextAreaElement) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const top = window.visualViewport!.offsetTop;
    const bottom = top + window.visualViewport!.height;
    const lineTop = box.top + parseFloat(style.paddingTop);
    const lineBottom = lineTop + parseFloat(style.lineHeight);
    const hit = document.elementFromPoint(box.left + 12, (lineTop + lineBottom) / 2);
    return {
      focused: document.activeElement === element,
      visible: lineTop >= top && lineBottom <= bottom && (hit === element || element.contains(hit)),
      lineTop: Math.round(lineTop),
      lineBottom: Math.round(lineBottom),
      viewportTop: top,
      viewportBottom: bottom,
    };
  });
}

async function openSettings(page: Page) {
  const noodle = page.locator('[data-component="NoodleView"]');
  await noodle
    .locator('[data-component="NoodleView.MobileBottomNav"]')
    .getByRole("button", { name: "Open Noodle account menu" })
    .click();
  await page
    .getByRole("dialog", { name: "Noodle account menu" })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await noodle.getByRole("button", { name: "Advanced", exact: true }).click();
  await noodle
    .locator('[data-component="NoodleView.PromptSetting"]')
    .getByRole("button", { name: "Edit prompt" })
    .click();
  return page.locator('[data-component="ExpandedTextarea"] textarea');
}

for (const theme of ["dark", "light"] as const) {
  for (const editor of ["post", "comment", "prompt"] as const) {
    test(`${theme}: Noodle ${editor} typing stays visible in landscape above a panned keyboard`, async ({
      page,
    }, testInfo) => {
      test.skip(!testInfo.project.name.includes("mobile"), "Software-keyboard geometry is a mobile concern.");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      const personaResponse = await page.request.post("/api/characters/personas", {
        data: { name: `Noodle keyboard ${theme} ${editor}`, description: "Temporary keyboard fixture." },
      });
      expect(personaResponse.ok()).toBe(true);
      const persona = (await personaResponse.json()) as { id: string };
      let postId = "";
      try {
        await page.addInitScript(
          ({ appVersion, theme, personaId }) => {
            localStorage.setItem("marinara:whats-new:seen-version", appVersion);
            localStorage.setItem(
              "marinara-engine-ui",
              JSON.stringify({
                state: {
                  theme,
                  hasCompletedOnboarding: true,
                  sidebarOpen: false,
                  rightPanelOpen: false,
                  chibiProfessorMariEnabled: false,
                  seasonalThemesDisabled: true,
                  appAccentPulseMode: false,
                },
                version: 65,
              }),
            );
            localStorage.setItem("marinara:noodle:ui", JSON.stringify({ noodleSelectedPersonaId: personaId }));
          },
          { appVersion, theme, personaId: persona.id },
        );
        const postResponse = await page.request.post("/api/noodle/posts", {
          data: { authorKind: "character", authorEntityId: "__professor_mari__", content: "Keyboard reply fixture." },
        });
        expect(postResponse.ok()).toBe(true);
        postId = ((await postResponse.json()) as { id: string }).id;
        await page.goto("/");
        await page.getByRole("tab", { name: "Open Noodle" }).click();
        const noodle = page.locator('[data-component="NoodleView"]');
        await expect(noodle).toBeVisible();
        const welcome = page.getByRole("dialog", { name: "Welcome to Noodle" });
        if (await welcome.isVisible()) await welcome.getByRole("button", { name: "Start reading" }).click();
        const nav = noodle.locator('[data-component="NoodleView.MobileBottomNav"]');
        await expect(nav).toBeVisible();

        let field: Locator;
        if (editor === "prompt") {
          field = await openSettings(page);
        } else if (editor === "comment") {
          const post = noodle.locator(`[data-noodle-post-id="${postId}"]`).first();
          await post.getByTitle("Reply").first().click();
          field = post.locator('[data-component="NoodleView.ReplyComposer"] textarea');
        } else {
          field = noodle.getByPlaceholder("What's simmering?").first();
        }
        await expect(field).toBeVisible();
        await field.fill("Keyboard text");
        await field.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 0));
        await expect(field).toBeFocused();
        // Portrait is a control: the ordinary package navigation remains available.
        await expect(nav).toBeVisible();
        await page.setViewportSize({ width: 844, height: 390 });
        await setKeyboardViewport(page, 390);
        await field.focus();
        await field.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 0));
        await setKeyboardViewport(page, 140, 110);
        await expect(page.locator("html")).toHaveAttribute("data-mari-software-keyboard-open", "");
        await page.screenshot({
          path: testInfo.outputPath(`noodle-${theme}-${editor}-landscape-keyboard.png`),
        });
        await expect.poll(() => firstLineGeometry(field)).toMatchObject({ focused: true, visible: true });
        await expect(nav).toBeHidden();
        await expect(noodle.locator('[data-component="NoodleView.MobileHeader"]')).toBeHidden();
        await field.pressSequentially("Typed ");
        await expect(field).toHaveValue("Typed Keyboard text");
        await expect.poll(() => firstLineGeometry(field)).toMatchObject({ focused: true, visible: true });
        if (editor === "prompt") {
          await page
            .locator('[data-component="ExpandedTextarea"]')
            .getByRole("button", { name: "Cancel" })
            .first()
            .click();
        } else {
          await field.blur();
        }
        await setKeyboardViewport(page, 390);
        await expect(nav).toBeVisible();
        await expect(nav.locator(":scope > div")).toHaveCSS("height", "56px");
        await page.setViewportSize({ width: 390, height: 844 });
        await setKeyboardViewport(page, 844);
        await expect(nav).toBeVisible();
      } finally {
        if (postId) await page.request.delete(`/api/noodle/posts/${postId}`).catch(() => undefined);
        await page.request.delete(`/api/characters/personas/${persona.id}`).catch(() => undefined);
      }
    });
  }
}
