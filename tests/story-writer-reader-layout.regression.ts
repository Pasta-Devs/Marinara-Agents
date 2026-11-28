import assert from "node:assert/strict";
import test from "node:test";
import {
  blockWidth,
  choosePagesPerSpread,
  computeReaderLayout,
  countPages,
  illustrationBox,
  pageAtTrackX,
  pageOffset,
  spreadOfPage,
  type ReaderLayout,
} from "../packages/story-writer/src/engine/packages/client/src/components/story-writer/reader-layout.ts";

const fixtures = [
  { name: "portrait phone book", theme: "book", width: 390, height: 700, pages: 1 },
  // The reader box of an 844×390 phone on its side, under the 52 px chapter bar.
  { name: "landscape phone book", theme: "book", width: 844, height: 286, pages: 2 },
  { name: "desktop book", theme: "book", width: 1400, height: 820, pages: 2 },
  { name: "portrait tablet book", theme: "book", width: 820, height: 1100, pages: 1 },
  { name: "narrow e-book", theme: "ebook", width: 600, height: 800, pages: 1 },
  { name: "laptop e-book below 1100 px", theme: "ebook", width: 1200, height: 900, pages: 1 },
  { name: "very wide e-book", theme: "ebook", width: 1700, height: 850, pages: 2 },
  { name: "portrait phone e-book", theme: "ebook", width: 390, height: 700, pages: 1 },
] as const;

function assertGrid(layout: ReaderLayout, label: string) {
  const { pagesPerSpread: pps, textWidth: W, textHeight: H, gap: G } = layout;
  for (const [key, value] of Object.entries(layout)) {
    if (typeof value === "number") assert.ok(Number.isInteger(value), `${label}: ${key} is a whole pixel (${value})`);
  }
  assert.ok(W > 0 && H > 0 && G > 0, `${label}: W, H and G are positive`);
  assert.ok(layout.pageWidth > 0 && layout.pageHeight > 0, `${label}: the page has a size`);
  assert.equal(layout.spreadWidth, pps * W + (pps - 1) * G, `${label}: spread width`);
  assert.equal(layout.spreadStride, pps * (W + G), `${label}: spread stride`);
  assert.equal(layout.pageWidth, W + 2 * layout.padX, `${label}: page = text + side margins`);
  assert.equal(
    layout.pageHeight,
    H + layout.padTop + layout.padBottom,
    `${label}: page = text + top and bottom margins`,
  );
  assert.equal(G, 2 * layout.padX + layout.spine, `${label}: the gap is the paper between two text columns`);
  assert.equal(layout.pagesWidth, pps * layout.pageWidth + layout.spine, `${label}: pages area`);
  // The right page's text starts exactly where the second column of the grid starts.
  if (pps === 2) assert.equal(layout.padX + pageOffset(layout, 1), layout.pageWidth + layout.spine + layout.padX);
  for (let page = 0; page < 12; page += 1) {
    assert.equal(pageOffset(layout, page), page * (W + G), `${label}: page ${page} offset`);
    assert.equal(pageAtTrackX(pageOffset(layout, page), W, G), page, `${label}: page ${page} column start`);
    assert.equal(pageAtTrackX(pageOffset(layout, page) + W - 1, W, G), page, `${label}: page ${page} column end`);
    assert.equal(spreadOfPage(page, pps) * layout.spreadStride, pageOffset(layout, page - (page % pps)));
  }
}

test("pages per spread follow the reader's shape and theme", () => {
  for (const fixture of fixtures) {
    const layout = computeReaderLayout(fixture);
    assert.equal(layout.pagesPerSpread, fixture.pages, fixture.name);
    assertGrid(layout, fixture.name);
  }
  assert.equal(choosePagesPerSpread("book", 1000, 1000), 1, "a square area is not landscape enough for two pages");
  assert.equal(choosePagesPerSpread("book", 1050, 1000), 2);
  assert.equal(choosePagesPerSpread("ebook", 1099, 600), 1);
  assert.equal(choosePagesPerSpread("ebook", 1100, 814), 2);
  assert.equal(choosePagesPerSpread("ebook", 1400, 1100), 1, "wide but not wide enough for its height");
});

test("the book and the device fit the reader and keep a page shape", () => {
  for (const fixture of fixtures) {
    const layout = computeReaderLayout(fixture);
    assert.ok(layout.frameLeft >= 0 && layout.frameTop >= 0, `${fixture.name}: frame starts inside the reader`);
    assert.ok(layout.frameLeft + layout.frameWidth <= fixture.width, `${fixture.name}: frame fits horizontally`);
    // The chapter bar sits outside the reader now: the frame takes the whole height, centred.
    assert.ok(layout.frameTop + layout.frameHeight <= fixture.height, `${fixture.name}: frame fits vertically`);
    assert.ok(Math.abs(2 * layout.frameTop + layout.frameHeight - fixture.height) <= 1, `${fixture.name}: centred`);
    if (layout.arrowsOutside) assert.ok(layout.frameLeft >= 52, `${fixture.name}: room for the arrows`);
    if (fixture.theme === "book") {
      const aspect = layout.pageWidth / layout.pageHeight;
      assert.ok(aspect >= 0.49 && aspect <= 1.21, `${fixture.name}: page aspect ${aspect.toFixed(2)}`);
      if (fixture.height >= 600) assert.ok(aspect <= 0.75, `${fixture.name}: a desktop page stays book-shaped`);
      if (layout.pagesPerSpread === 2) assert.ok(layout.spine > 0, `${fixture.name}: a spread has a spine`);
    } else {
      assert.equal(layout.spine, 0, `${fixture.name}: an e-reader screen has no spine`);
    }
  }
});

test("the room the chapter bar used to take under the book goes to the pages", () => {
  const page = (width: number, height: number) => computeReaderLayout({ theme: "book", width, height }).pageHeight;
  assert.ok(page(1400, 820) >= 770, `desktop page height ${page(1400, 820)}`);
  // A sideways phone gives the bar's room back at the top: the page keeps its height.
  assert.equal(page(844, 286), 259);
});

test("degenerate sizes still produce a usable, positive grid", () => {
  for (const [width, height] of [
    [0, 0],
    [120, 90],
    [-5, 400],
    [5000, 120],
  ]) {
    for (const theme of ["book", "ebook"] as const)
      assertGrid(computeReaderLayout({ theme, width, height }), `${theme} ${width}x${height}`);
  }
});

test("page counting inverts the column grid", () => {
  const W = 412;
  const G = 98;
  assert.equal(countPages(0, W, G), 1, "an empty block still takes one page");
  assert.equal(countPages(Number.NaN, W, G), 1);
  for (let pages = 1; pages <= 40; pages += 1) {
    const scrollWidth = pages * W + (pages - 1) * G;
    assert.equal(countPages(scrollWidth, W, G), pages);
    // Browsers round scrollWidth; a pixel either way must not change the count.
    assert.equal(countPages(scrollWidth - 1, W, G), pages);
    assert.equal(countPages(scrollWidth + 1, W, G), pages);
    assert.equal(blockWidth(pages, W, G), scrollWidth, "the block wrapper is exactly as wide as its columns");
    // The next block starts on the next page of the grid.
    assert.equal(blockWidth(pages, W, G) + G, pages * (W + G));
  }
  assert.equal(spreadOfPage(-3, 2), 0);
  assert.equal(spreadOfPage(5, 2), 2);
  assert.equal(spreadOfPage(5, 1), 5);
  assert.equal(pageAtTrackX(-10, W, G), 0);
  assert.equal(pageAtTrackX(W + G / 2 - 1, W, G), 0, "the left half of a gap belongs to the page before it");
  assert.equal(pageAtTrackX(W + G / 2, W, G), 1);
});

test("a picture is measured in whole pixels that always fit a page: beside the text on a wide page, full width on a phone", () => {
  const portrait = { width: 896, height: 1152 };
  for (const fixture of fixtures) {
    const layout = computeReaderLayout(fixture);
    for (const picture of [portrait, { width: 1536, height: 640 }, { width: 400, height: 3000 }]) {
      const box = illustrationBox(layout, 18, picture);
      const label = `${fixture.name} ${picture.width}×${picture.height}`;
      assert.ok(Number.isInteger(box.width) && Number.isInteger(box.height), `${label}: whole pixels`);
      assert.ok(box.width >= 1 && box.width <= layout.textWidth, `${label}: no wider than the text`);
      // Never more than 60% of a page, so it fits under a chapter heading and is never cut by a page edge.
      assert.ok(box.height <= Math.floor(layout.textHeight * 0.6), `${label}: no taller than 60% of the page`);
      assert.ok(
        Math.abs(box.width / box.height - picture.width / picture.height) <
          0.1 * (picture.width / picture.height) + 1 / box.height,
        `${label}: keeps its shape`,
      );
    }
  }
  const desktop = computeReaderLayout({ theme: "book", width: 1400, height: 820 });
  const beside = illustrationBox(desktop, 18, portrait);
  assert.equal(beside.float, true);
  assert.equal(beside.width, Math.floor(desktop.textWidth * 0.42));
  const phone = computeReaderLayout({ theme: "ebook", width: 390, height: 700 });
  const between = illustrationBox(phone, 18, { width: 1536, height: 640 });
  assert.equal(between.float, false);
  assert.equal(between.width, phone.textWidth);
  // A laptop's book page still has room beside it; a bigger font makes the same page a phone's.
  assert.equal(
    illustrationBox(computeReaderLayout({ theme: "book", width: 1080, height: 640 }), 18, portrait).float,
    true,
  );
  assert.equal(illustrationBox(desktop, 36, portrait).float, false);
});
