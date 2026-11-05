import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { chromium, webkit } from "@playwright/test";
import { setForgeStoryPortrait } from "../packages/gacha-forge/src/browser-presentation.mjs";

const source = await readFile(new URL("../packages/gacha-forge/src/browser-presentation.mjs", import.meta.url), "utf8");
const bundle = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
const layout = vm.runInNewContext(source.match(/const forgeBrowserLayout = (`[\s\S]*?`);/u)[1]);
const artStyle = bundle.slice(bundle.indexOf("\n.vn-art {\n") + 1, bundle.indexOf("/* THE DOCK NO LONGER MOVES"));
const artwork = (color) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="130"><rect width="100" height="130" fill="${color}"/></svg>`)}`;

for (const browserType of [chromium, webkit]) {
  test(`${browserType.name()}: real story SVG fallbacks hide behind loaded portraits and return only without artwork`, async () => {
    const browser = await browserType.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route("https://portrait.test/**", () => {});
      await page.setContent(
        `<style>${artStyle}\n${layout}</style><div class="vn-plate" data-front="a">${["a", "b"]
          .map(
            (key) =>
              `<div class="vn-art" data-art="${key}"><img data-img hidden><svg class="vn-figure" data-figure viewBox="0 0 100 130"><path d="M50 12a16 16 0 1 0 0 32a16 16 0 1 0 0-32M22 118c0-18 12-30 28-30s28 12 28 30z"/></svg></div>`,
          )
          .join("")}</div>`,
      );
      await page.evaluate((helper) => {
        window.setPortrait = new Function(`return (${helper})`)();
        window.portraitState = () =>
          [...document.querySelectorAll("[data-art]")].map((layer) => {
            const image = layer.querySelector("[data-img]");
            const figure = layer.querySelector("[data-figure]");
            return {
              src: image.getAttribute("src"),
              imageHidden: image.hidden,
              imageDisplay: getComputedStyle(image).display,
              figureHidden: figure.hasAttribute("hidden"),
              figureDisplay: getComputedStyle(figure).display,
            };
          });
      }, setForgeStoryPortrait.toString());
      const mari = artwork("#724b8d");
      await page.evaluate((art) => window.setPortrait(document.querySelector(".vn-plate"), { art }), mari);
      await page.waitForFunction(() =>
        [...document.querySelectorAll("img")].every((image) => image.complete && image.naturalWidth > 0),
      );
      for (const layer of await page.evaluate(() => window.portraitState())) {
        assert.equal(layer.src, mari);
        assert.equal(layer.imageHidden, false);
        assert.notEqual(layer.imageDisplay, "none");
        assert.equal(
          layer.figureHidden,
          true,
          "SVG visibility must use its actual attribute, not an HTML-only property",
        );
        assert.equal(layer.figureDisplay, "none", "No silhouette may be composited over loaded artwork");
      }
      await page.evaluate(() => {
        const image = document.querySelector("img");
        const oldLoad = image.onload;
        const oldError = image.onerror;
        window.setPortrait(document.querySelector(".vn-plate"), { art: "https://portrait.test/next-speaker.svg" });
        oldLoad();
        oldError();
      });
      for (const layer of await page.evaluate(() => window.portraitState())) {
        assert.equal(layer.src, "https://portrait.test/next-speaker.svg");
        assert.equal(layer.imageHidden, true, "An old speaker's completion cannot reveal a pending image");
        assert.equal(layer.imageDisplay, "none", "Author image display rules cannot expose the old bitmap");
        assert.equal(layer.figureDisplay, "none", "An old error cannot reveal the new speaker's placeholder");
      }
      await page.evaluate(() => window.setPortrait(document.querySelector(".vn-plate"), null));
      for (const layer of await page.evaluate(() => window.portraitState())) {
        assert.equal(layer.src, null);
        assert.equal(layer.imageDisplay, "none");
        assert.equal(layer.figureHidden, false);
        assert.notEqual(layer.figureDisplay, "none", "Missing artwork retains the neutral fallback");
      }
      await page.evaluate(() =>
        window.setPortrait(document.querySelector(".vn-plate"), { art: "data:image/png;base64,aW52YWxpZA==" }),
      );
      await page.waitForFunction(() =>
        [...document.querySelectorAll("[data-figure]")].every((figure) => !figure.hasAttribute("hidden")),
      );
      for (const layer of await page.evaluate(() => window.portraitState())) {
        assert.equal(layer.imageDisplay, "none");
        assert.notEqual(layer.figureDisplay, "none", "Failed decoding retains the neutral fallback");
      }
      await page.evaluate((art) => window.setPortrait(document.querySelector(".vn-plate"), { art }), mari);
      await page.waitForFunction(() =>
        [...document.querySelectorAll("img")].every(
          (image) => image.complete && image.naturalWidth > 0 && !image.hidden,
        ),
      );
      assert.ok((await page.evaluate(() => window.portraitState())).every((layer) => layer.figureDisplay === "none"));
    } finally {
      await browser.close();
    }
  });
}
