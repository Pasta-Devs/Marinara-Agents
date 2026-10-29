// Renders the Agent Organizer store images and rewrites the store.json sidecars.
//   node scripts/build-store.mjs
// Sources: store/icons/src/<id>.svg and store/banners/<id>.webp (2400 x 900).
// Output: store/icons/<id>.webp (256 px) and store/banners/<id>-1200.webp. The Engine
// accepts no SVG, so only WebP is published. Chromium is already a dev dependency.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { readCatalogFamily, writeCatalogFamily } from "./catalog-lanes.mjs";
import { STORE_BANNER_WIDTHS, STORE_ICON_SIZE, storeBanner, storeIcon, storeIconSource } from "./catalog-store.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUALITY = 0.85;

const ids = (directory, suffix) =>
  readdir(join(repoRoot, directory)).then((names) =>
    names
      .filter(
        (name) =>
          name.endsWith(suffix) && !STORE_BANNER_WIDTHS.slice(1).some((width) => name.endsWith(`-${width}.webp`)),
      )
      .map((name) => name.slice(0, -suffix.length)),
  );

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("about:blank");

async function render(sourcePath, outputPath, width, height) {
  const source = await readFile(join(repoRoot, sourcePath));
  const type = sourcePath.endsWith(".svg") ? "image/svg+xml" : sourcePath.endsWith(".png") ? "image/png" : "image/webp";
  const dataUrl = await page.evaluate(
    async ({ base64, type, width, height, quality }) => {
      const image = new Image();
      image.src = `data:${type};base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.imageSmoothingQuality = "high";
      // Fit inside the frame so non-square tab icons keep their shape.
      const scale = Math.min(width / image.width, height / image.height);
      const [w, h] = [image.width * scale, image.height * scale];
      context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      return canvas.toDataURL("image/webp", quality);
    },
    { base64: source.toString("base64"), type, width, height, quality: QUALITY },
  );
  await writeFile(join(repoRoot, outputPath), Buffer.from(dataUrl.split(",")[1], "base64"));
}

for (const id of await ids("store/icons/src", ".svg")) {
  await render(storeIconSource(id), storeIcon(id), STORE_ICON_SIZE, STORE_ICON_SIZE);
}
// Apps use their Home tab icon as the store logo, so the store and Home look the same.
for (const dir of await readdir(join(repoRoot, "packages"))) {
  const manifest = await readFile(join(repoRoot, "packages", dir, "manifest.json"), "utf8").then(
    JSON.parse,
    () => null,
  );
  const tabIcon = manifest?.contributions?.homeBrowserTab?.iconPaths?.[0];
  if (tabIcon) await render(join("packages", dir, tabIcon), storeIcon(manifest.id), STORE_ICON_SIZE, STORE_ICON_SIZE);
}
const [, smallWidth] = STORE_BANNER_WIDTHS;
const bannerIds = await ids("store/banners", ".webp");
for (const id of bannerIds) {
  await render(storeBanner(id), storeBanner(id, smallWidth), smallWidth, (smallWidth * 3) / 8);
}
await browser.close();

const { catalog } = await readCatalogFamily(repoRoot);
await writeCatalogFamily(repoRoot, catalog);
console.log(`Store built: ${bannerIds.length} banners.`);
