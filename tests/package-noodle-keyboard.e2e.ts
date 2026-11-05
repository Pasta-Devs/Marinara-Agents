import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
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
      visible:
        box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) >= parseFloat(style.lineHeight) &&
        lineTop >= top &&
        lineBottom <= bottom &&
        (hit === element || element.contains(hit)),
      lineTop: Math.round(lineTop),
      lineBottom: Math.round(lineBottom),
      viewportTop: top,
      viewportBottom: bottom,
    };
  });
}

async function openSettings(page: Page, mobile: boolean) {
  const noodle = page.locator('[data-component="NoodleView"]');
  if (mobile) {
    await noodle
      .locator('[data-component="NoodleView.MobileBottomNav"]')
      .getByRole("button", { name: "Open Noodle account menu" })
      .click();
    await page
      .getByRole("dialog", { name: "Noodle account menu" })
      .getByRole("button", { name: "Settings", exact: true })
      .click();
  } else {
    await noodle.getByRole("button", { name: "Settings", exact: true }).click();
  }
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
      const mobile = testInfo.project.name.includes("mobile");
      await page.setViewportSize(mobile ? { width: 844, height: 390 } : { width: 1440, height: 900 });
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
                  achievementsEnabled: false,
                },
                version: 65,
              }),
            );
            localStorage.setItem("marinara:noodle:ui", JSON.stringify({ noodleSelectedPersonaId: personaId }));
          },
          { appVersion, theme, personaId: persona.id },
        );
        const bootstrap = await page.request.get("/api/noodle");
        expect(bootstrap.ok(), await bootstrap.text()).toBe(true);
        const postResponse = await page.request.post("/api/noodle/posts", {
          data: { authorKind: "character", authorEntityId: "__professor_mari__", content: "Keyboard reply fixture." },
        });
        expect(postResponse.ok(), await postResponse.text()).toBe(true);
        postId = ((await postResponse.json()) as { id: string }).id;
        await page.goto("/");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        // A prebuilt local Engine may report a newer frontend build; dismiss its ordinary startup notice.
        const noticeClose = page.getByRole("button", { name: "Close toast", exact: true }).first();
        try {
          await noticeClose.waitFor({ state: "visible", timeout: 1_500 });
          await noticeClose.click();
        } catch (error) {
          if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
        }
        await page.getByRole("tab", { name: "Open Noodle" }).click();
        const noodle = page.locator('[data-component="NoodleView"]');
        await expect(noodle).toBeVisible();
        const welcome = page.getByRole("dialog", { name: "Welcome to Noodle" });
        if (await welcome.isVisible()) await welcome.getByRole("button", { name: "Start reading" }).click();
        const nav = noodle.locator('[data-component="NoodleView.MobileBottomNav"]');
        if (mobile) await expect(nav).toBeVisible();
        else await expect(nav).toBeHidden();

        let field: Locator;
        if (editor === "prompt") {
          field = await openSettings(page, mobile);
        } else if (editor === "comment") {
          const post = noodle.locator(`[data-noodle-post-id="${postId}"]`).first();
          await post.getByTitle("Reply").first().click();
          field = post.locator('[data-component="NoodleView.ReplyComposer"] textarea');
        } else {
          field = noodle.getByPlaceholder("What's simmering?").first();
        }
        await expect(field).toBeVisible();
        await field.fill("Keyboard text");
        await field.focus();
        await field.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 0));
        await expect(field).toBeFocused();
        // Start in settled landscape, as rotating itself resets the Engine's keyboard-height baseline.
        if (mobile) {
          await expect(nav).toBeVisible();
          await setKeyboardViewport(page, 390);
          await field.focus();
          await field.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 0));
          await setKeyboardViewport(page, 140, 110);
          await expect(page.locator("html")).toHaveAttribute("data-mari-software-keyboard-open", "");
        }
        await page.screenshot({
          path: testInfo.outputPath(`noodle-${theme}-${editor}-landscape-keyboard.png`),
        });
        await expect.poll(() => firstLineGeometry(field)).toMatchObject({ focused: true, visible: true });
        await expect(nav).toBeHidden();
        await expect(noodle.locator('[data-component="NoodleView.MobileHeader"]')).toBeHidden();
        await field.pressSequentially("Typed ");
        await expect(field).toHaveValue("Typed Keyboard text");
        await expect.poll(() => firstLineGeometry(field)).toMatchObject({ focused: true, visible: true });
        const geometryPath = testInfo.outputPath(`noodle-${theme}-${editor}-geometry.json`);
        writeFileSync(geometryPath, JSON.stringify(await firstLineGeometry(field), null, 2));
        await testInfo.attach("readable-first-line", { path: geometryPath, contentType: "application/json" });
        await page.screenshot({ path: testInfo.outputPath(`noodle-${theme}-${editor}-typed.png`) });
        if (editor === "prompt" && theme === "dark" && testInfo.project.name === "mobile-webkit") {
          const longText = Array.from({ length: 20 }, (_, index) => `Line ${index + 1}: long prompt editing.`).join(
            "\n",
          );
          await field.fill(longText);
          await field.focus();
          await field.evaluate((element: HTMLTextAreaElement) =>
            element.setSelectionRange(element.value.length, element.value.length),
          );
          await field.pressSequentially(" END-CURSOR");
          await expect(field).toHaveValue(`${longText} END-CURSOR`);
          const endGeometry = () =>
            field.evaluate((element: HTMLTextAreaElement) => {
              const box = element.getBoundingClientRect();
              const visual = window.visualViewport!;
              return {
                fullEditingBoxVisible: box.top >= visual.offsetTop && box.bottom <= visual.offsetTop + visual.height,
                caretAtEnd:
                  element.selectionStart === element.value.length && element.selectionEnd === element.value.length,
                scrolled: element.scrollTop > 0,
                bottomGap: element.scrollHeight - element.scrollTop - element.clientHeight,
                box: { top: box.top, bottom: box.bottom, height: box.height },
                visual: { top: visual.offsetTop, height: visual.height },
              };
            });
          await expect
            .poll(endGeometry)
            .toMatchObject({ fullEditingBoxVisible: true, caretAtEnd: true, scrolled: true });
          expect((await endGeometry()).bottomGap).toBeLessThanOrEqual(1);
          const endPath = testInfo.outputPath("long-prompt-end-caret.json");
          writeFileSync(endPath, JSON.stringify(await endGeometry(), null, 2));
          await testInfo.attach("long-prompt-native-scroll", { path: endPath, contentType: "application/json" });
          await page.screenshot({ path: testInfo.outputPath("long-prompt-end-caret.png") });
        }
        if (editor === "prompt") {
          await page
            .locator('[data-component="ExpandedTextarea"]')
            .getByRole("button", { name: "Cancel" })
            .first()
            .click();
        } else {
          await field.blur();
        }
        if (mobile) {
          await setKeyboardViewport(page, 390);
          await expect(nav).toBeVisible();
          await expect(nav.locator(":scope > div")).toHaveCSS("height", "56px");
          await page.setViewportSize({ width: 390, height: 844 });
          await setKeyboardViewport(page, 844);
          await expect(nav).toBeVisible();
          if (editor !== "prompt") {
            const restoredHeader = noodle.locator('[data-component="NoodleView.MobileHeader"]');
            await expect(restoredHeader).toBeVisible();
            expect(
              await restoredHeader.evaluate(
                (header) =>
                  parseFloat(getComputedStyle(header).height) /
                  parseFloat(getComputedStyle(document.documentElement).fontSize),
              ),
            ).toBeCloseTo(3.5, 2);
          }
        }
      } finally {
        if (postId) await page.request.delete(`/api/noodle/posts/${postId}`).catch(() => undefined);
        await page.request.delete(`/api/characters/personas/${persona.id}`).catch(() => undefined);
      }
    });
  }
}
