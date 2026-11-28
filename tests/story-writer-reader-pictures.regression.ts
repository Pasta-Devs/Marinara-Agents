// Story Writer's pictures in a real Chromium and WebKit, laid out by the reader's own CSS, page geometry, Markdown and
// caret helpers. Run it with `npx tsx tests/story-writer-reader-pictures.regression.ts`; a browser Playwright has not
// installed (`npx playwright install chromium webkit`) is skipped, as in CI.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { chromium, webkit, type Page } from "@playwright/test";
import { buildSync } from "esbuild";
import {
  blockWidth,
  computeReaderLayout,
  illustrationBox,
  type ReaderLayout,
} from "../packages/story-writer/src/engine/packages/client/src/components/story-writer/reader-layout.ts";
import { markdownToHtml } from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/markdown.ts";
import { READER_STYLES } from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/styles-reader.ts";

const LONG =
  "The rain came down in sheets against the old glass, and Mara counted the seconds between the flashes while the house groaned around her like a ship at anchor.";
const PORTRAIT = { width: 896, height: 1152 };
type ReaderCaret =
  typeof import("../packages/story-writer/src/engine/packages/client/src/components/story-writer/reader-caret.ts");

/** reader-caret.ts as a script for the page, so the test runs the module the reader runs. */
const caretScript = buildSync({
  entryPoints: [
    resolve(
      __dirname,
      "../packages/story-writer/src/engine/packages/client/src/components/story-writer/reader-caret.ts",
    ),
  ],
  bundle: true,
  format: "iife",
  globalName: "readerCaret",
  write: false,
}).outputFiles[0]!.text;

/** A figure as ChapterBlock's pictureFigure makes it, with the reader's whole-pixel box when it has one. */
const figureScript = (anchors: number[], box: { width: number; height: number; float: boolean } | null) => `(() => {
  for (const body of document.querySelectorAll(".sw-body")) {
    const blocks = Array.from(body.children);
    for (const index of ${JSON.stringify(anchors)}) {
      const figure = document.createElement("figure");
      figure.className = "sw-illustration";
      figure.contentEditable = "false";
      ${box ? `figure.dataset.float = "${box.float}"; figure.style.width = "${box.width}px"; figure.style.height = "${box.height}px";` : ""}
      const image = document.createElement("img");
      image.width = ${PORTRAIT.width};
      image.height = ${PORTRAIT.height};
      figure.append(image);
      body.insertBefore(figure, blocks[index]);
    }
  }
})();`;

function bookPage(layout: ReaderLayout, fontSize: number, markdown: string, anchors: number[]) {
  const box = illustrationBox(layout, fontSize, PORTRAIT);
  const wide = layout.textWidth * 40;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${READER_STYLES}
body { margin: 0 } marinara-capability-story-writer { display: block }</style></head><body>
<marinara-capability-story-writer><div class="sw-reader" data-theme="${layout.theme}" data-editable="true" style="--sw-font-size:${fontSize}px;--sw-text-w:${layout.textWidth}px;--sw-text-h:${layout.textHeight}px;--sw-gap:${layout.gap}px;width:${wide}px;height:${layout.textHeight + 40}px">
<div class="sw-viewport" style="left:0;top:0;width:${wide}px;height:${layout.textHeight}px;overflow:visible"><div class="sw-track" style="gap:${layout.gap}px">
<div class="sw-block sw-block--chapter" style="width:${blockWidth(30, layout.textWidth, layout.gap)}px"><div class="sw-columns sw-block-inner">
<div class="sw-chapter-head"><div class="sw-chapter-label">CHAPTER 1</div><div class="sw-ornament"><span>❦</span></div></div>
<div class="sw-body" role="textbox" contenteditable="true">${markdownToHtml(markdown)}</div></div></div></div></div></div>
</marinara-capability-story-writer><script>${figureScript(anchors, box)}</script><script>${caretScript}</script></body></html>`;
}

const engines = [chromium, webkit].map((engine) => ({ engine, installed: existsSync(engine.executablePath()) }));

async function withPage(engine: (typeof engines)[number]["engine"], run: (page: Page) => Promise<void>) {
  const browser = await engine.launch();
  try {
    await run(await browser.newPage({ viewport: { width: 1600, height: 900 } }));
  } finally {
    await browser.close();
  }
}

for (const { engine, installed } of engines) {
  const skip = installed ? false : `${engine.name()} is not installed`;

  test(
    `${engine.name()}: a picture beside the text is one box on one page, never split across two`,
    { skip },
    async () => {
      const paragraphs = ["# The Storm"];
      for (let index = 0; index < 26; index += 1)
        paragraphs.push(index % 4 === 3 ? "She waited." : `${LONG} (${index})`);
      // Short reader areas, where a float of 60% of the page is taller than half of it: WebKit split it across pages.
      const cases = [
        { layout: computeReaderLayout({ theme: "book", width: 1200, height: 430 }), fontSize: 18 },
        { layout: computeReaderLayout({ theme: "book", width: 1000, height: 400 }), fontSize: 16 },
        { layout: computeReaderLayout({ theme: "book", width: 844, height: 286 }), fontSize: 13 },
      ];
      await withPage(engine, async (page) => {
        for (const { layout, fontSize } of cases) {
          assert.equal(illustrationBox(layout, fontSize, PORTRAIT).float, true);
          for (let anchor = 1; anchor <= 26; anchor += 1) {
            await page.setContent(bookPage(layout, fontSize, paragraphs.join("\n\n"), [anchor]));
            const problems = await page.evaluate(
              ({ W, H, G }) => {
                const base = document.querySelector(".sw-block-inner")!.getBoundingClientRect();
                const figure = document.querySelector("figure")!;
                const box = figure.getBoundingClientRect();
                const x = box.left - base.left;
                const y = box.top - base.top;
                const pageLeft = Math.floor((x + G / 2) / (W + G)) * (W + G);
                const found: string[] = [];
                if (figure.getClientRects().length !== 1) found.push(`${figure.getClientRects().length} fragments`);
                if (x < pageLeft - 1 || x + box.width > pageLeft + W + 1) found.push(`outside its page at x ${x}`);
                if (y < -1 || y + box.height > H + 1) found.push(`cut by the page at y ${y}..${y + box.height}`);
                return found;
              },
              { W: layout.textWidth, H: layout.textHeight, G: layout.gap },
            );
            assert.deepEqual(
              problems,
              [],
              `${layout.theme} ${layout.textWidth}×${layout.textHeight} at ${fontSize}px, before paragraph ${anchor}`,
            );
          }
        }
      });
    },
  );

  test(
    `${engine.name()}: a click in the margin beside a picture puts the caret in the text beside it`,
    { skip },
    async () => {
      const layout = computeReaderLayout({ theme: "book", width: 1280, height: 760 });
      const markdown = ["# The Storm", ...Array.from({ length: 6 }, (_, index) => `${LONG} (${index})`)].join("\n\n");
      await withPage(engine, async (page) => {
        await page.setContent(bookPage(layout, 18, markdown, [2]));
        // StoryReader's placeCaretAt clamps a margin click to the column's edge, where a picture floats on the right.
        const placed = await page.evaluate((W) => {
          const body = document.querySelector<HTMLElement>(".sw-body")!;
          const column = document.querySelector(".sw-block-inner")!.getBoundingClientRect();
          const picture = document.querySelector("figure")!.getBoundingClientRect();
          const caret = (window as unknown as { readerCaret: ReaderCaret }).readerCaret;
          const range = caret.caretRangeNear(
            body,
            column.left + W - 2,
            picture.top + picture.height / 2,
            column.top,
            column.bottom,
          );
          caret.focusEditableAt(body, range, "start");
          const node = range?.startContainer;
          const element = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
          return element?.closest(".sw-body > *")?.tagName ?? null;
        }, layout.textWidth);
        assert.equal(placed, "P");
        await page.keyboard.type("XYZ");
        const landed = await page.evaluate(() =>
          Array.from(document.querySelector(".sw-body")!.children)
            .filter((child) => child.textContent?.includes("XYZ"))
            .map((child) => child.tagName),
        );
        assert.deepEqual(landed, ["P"], "typed into a paragraph, not the picture or the chapter title");
      });
    },
  );

  test(
    `${engine.name()}: in a wide Document, a chapter holds its picture above the next chapter`,
    { skip },
    async () => {
      const chapter = (number: number) =>
        `<div class="sw-block sw-block--chapter" data-sw-block="c${number}"><div class="sw-block-inner"><div class="sw-chapter-head"><div class="sw-chapter-label">CHAPTER ${number}</div></div><div class="sw-body" contenteditable="true">${markdownToHtml(Array.from({ length: 5 }, (_, index) => `${LONG} (${number}.${index})`).join("\n\n"))}</div></div></div>`;
      await withPage(engine, async (page) => {
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${READER_STYLES}
body { margin: 0 } marinara-capability-story-writer { display: block; height: 100vh }</style></head><body>
<marinara-capability-story-writer><div class="sw-reader sw-document" data-theme="document" style="--sw-font-size:18px"><div class="sw-document-column">${chapter(1)}${chapter(2)}</div></div>
</marinara-capability-story-writer><script>${figureScript([4], null)}</script></body></html>`);
        const boxes = await page.evaluate(() => {
          const picture = document.querySelector('[data-sw-block="c1"] figure')!.getBoundingClientRect();
          const column = document.querySelector(".sw-document-column")!.getBoundingClientRect();
          const next = document.querySelector('[data-sw-block="c2"]')!.getBoundingClientRect();
          return { beside: picture.left >= column.right - 1, pictureBottom: picture.bottom, nextTop: next.top };
        });
        assert.equal(boxes.beside, true, "the picture sits beside the column");
        assert.ok(
          boxes.pictureBottom <= boxes.nextTop,
          `picture ends at ${boxes.pictureBottom}, chapter 2 starts at ${boxes.nextTop}`,
        );
      });
    },
  );
}
