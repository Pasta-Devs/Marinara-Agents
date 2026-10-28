import { access, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

// The Agent Organizer's store data (section, tagline, Featured order, icon, banner) is
// published as store.json BESIDE each catalog.json, like notes.json and for the same
// reason: the Engine's catalog entry schema is strict and drops entries carrying keys it
// does not know. store/store.json is the hand-written source; images follow a fixed
// layout under store/ so a file can never be named in one place and missing in another.

export const STORE_SECTIONS = ["apps", "games", "writing", "memory", "trackers", "adventure", "media", "alive"];
export const MAX_STORE_TAGLINE_CHARACTERS = 60;
export const STORE_ICON_SIZE = 256;
export const STORE_BANNER_WIDTHS = [2400, 1200];
export const MAX_STORE_PREVIEWS = 4;

export const storeIconSource = (id) => `store/icons/src/${id}.svg`;
export const storeIcon = (id) => `store/icons/${id}.webp`;
export const storeBanner = (id, width = STORE_BANNER_WIDTHS[0]) =>
  width === STORE_BANNER_WIDTHS[0] ? `store/banners/${id}.webp` : `store/banners/${id}-${width}.webp`;
// Real screenshots, numbered from 1 with no gaps.
export const storePreview = (id, index) => `store/previews/${id}-${index}.webp`;

export async function readStoreSource(repoRoot) {
  const source = JSON.parse(await readFile(join(repoRoot, "store/store.json"), "utf8"));
  for (const [id, entry] of Object.entries(source.packages)) {
    if (!STORE_SECTIONS.includes(entry.section))
      throw new Error(`store/store.json: ${id} has unknown section "${entry.section}"`);
    const tagline = entry.tagline?.trim() ?? "";
    if (!tagline || tagline.length > MAX_STORE_TAGLINE_CHARACTERS)
      throw new Error(`store/store.json: ${id} needs a tagline of 1-${MAX_STORE_TAGLINE_CHARACTERS} characters`);
    if (entry.featured !== undefined && !(Number.isInteger(entry.featured) && entry.featured > 0))
      throw new Error(`store/store.json: ${id} featured must be a positive integer`);
  }
  return source;
}

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

/** Store data for exactly the packages in one lane. Paths are relative to the sidecar's
 * directory, so the Engine resolves them against the store.json URL it fetched and any
 * mirror or branch of this repository serves its own images. */
export async function buildStoreDocument(repoRoot, directory, entries) {
  const source = await readStoreSource(repoRoot);
  const packages = {};
  const link = (path) => relative(join(repoRoot, directory), join(repoRoot, path)).split("\\").join("/");
  for (const entry of [...entries].sort((left, right) => left.manifest.id.localeCompare(right.manifest.id))) {
    const id = entry.manifest.id;
    const record = source.packages[id];
    if (!record)
      throw new Error(`store/store.json has no entry for ${id} — every published package needs a section and tagline`);
    for (const width of STORE_BANNER_WIDTHS)
      if (!(await exists(join(repoRoot, storeBanner(id, width)))))
        throw new Error(`${storeBanner(id, width)} is missing — run node scripts/build-store.mjs`);
    // Apps show the Home tab icon from their own manifest instead.
    const hasIcon = await exists(join(repoRoot, storeIcon(id)));
    if (!hasIcon && record.section !== "apps")
      throw new Error(`${storeIcon(id)} is missing — add ${storeIconSource(id)} and run node scripts/build-store.mjs`);
    const previews = [];
    for (let index = 1; index <= MAX_STORE_PREVIEWS; index += 1) {
      if (!(await exists(join(repoRoot, storePreview(id, index))))) break;
      previews.push(link(storePreview(id, index)));
    }
    packages[id] = {
      section: record.section,
      tagline: record.tagline.trim(),
      ...(record.featured ? { featured: record.featured } : {}),
      ...(hasIcon ? { iconPath: link(storeIcon(id)) } : {}),
      bannerPath: link(storeBanner(id)),
      bannerSmallPath: link(storeBanner(id, STORE_BANNER_WIDTHS[1])),
      ...(previews.length ? { previews } : {}),
    };
  }
  return { schemaVersion: 1, packages };
}
