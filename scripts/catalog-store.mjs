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
  // The Engine drops all kits past 20, and any kit with more than 20 packages.
  const kitIds = new Set();
  if ((source.kits ?? []).length > 20) throw new Error("store/store.json: at most 20 kits");
  for (const kit of source.kits ?? []) {
    if (kitIds.has(kit.id)) throw new Error(`store/store.json: kit ${kit.id} is listed twice`);
    kitIds.add(kit.id);
    if ((kit.packages ?? []).length > 20) throw new Error(`store/store.json: kit ${kit.id} has more than 20 packages`);
    const name = kit.name?.trim() ?? "";
    if (!kit.id || !name || name.length > MAX_STORE_TAGLINE_CHARACTERS) {
      throw new Error(
        `store/store.json: kit ${kit.id} needs an id and a name of 1-${MAX_STORE_TAGLINE_CHARACTERS} characters`,
      );
    }
    if ((kit.tagline?.length ?? 0) > MAX_STORE_TAGLINE_CHARACTERS) {
      throw new Error(
        `store/store.json: kit ${kit.id} tagline is longer than ${MAX_STORE_TAGLINE_CHARACTERS} characters`,
      );
    }
    const unknown = (kit.packages ?? []).filter((id) => !Object.hasOwn(source.packages, id));
    if (!kit.packages?.length || unknown.length) {
      throw new Error(`store/store.json: kit ${kit.id} needs packages from the store (unknown: ${unknown.join(", ")})`);
    }
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
export async function buildStoreDocument(repoRoot, directory, entries, { lenient = false } = {}) {
  // Dev builds that include held-back packages skip a package with no store data yet.
  const missing = (message) => {
    if (!lenient) throw new Error(message);
  };
  const source = await readStoreSource(repoRoot);
  const packages = {};
  const link = (path) => relative(join(repoRoot, directory), join(repoRoot, path)).split("\\").join("/");
  packageLoop: for (const entry of [...entries].sort((left, right) =>
    left.manifest.id.localeCompare(right.manifest.id),
  )) {
    const id = entry.manifest.id;
    const record = source.packages[id];
    if (!record) {
      missing(`store/store.json has no entry for ${id} — every published package needs a section and tagline`);
      continue;
    }
    for (const width of STORE_BANNER_WIDTHS)
      if (!(await exists(join(repoRoot, storeBanner(id, width))))) {
        missing(`${storeBanner(id, width)} is missing — run node scripts/build-store.mjs`);
        continue packageLoop;
      }
    const hasIcon = await exists(join(repoRoot, storeIcon(id)));
    if (!hasIcon) {
      missing(`${storeIcon(id)} is missing — add ${storeIconSource(id)} and run node scripts/build-store.mjs`);
      continue;
    }
    const previews = [];
    for (let index = 1; index <= MAX_STORE_PREVIEWS; index += 1) {
      if (!(await exists(join(repoRoot, storePreview(id, index))))) break;
      previews.push(link(storePreview(id, index)));
    }
    packages[id] = {
      section: record.section,
      tagline: record.tagline.trim(),
      ...(record.featured ? { featured: record.featured } : {}),
      iconPath: link(storeIcon(id)),
      bannerPath: link(storeBanner(id)),
      bannerSmallPath: link(storeBanner(id, STORE_BANNER_WIDTHS[1])),
      ...(previews.length ? { previews } : {}),
    };
  }
  const preview = directory.split(/[\\/]/).includes("preview");
  // A lane lists a kit only with the packages it publishes.
  const kits = (source.kits ?? [])
    .map((kit) => ({ ...kit, packages: kit.packages.filter((id) => packages[id]) }))
    .filter((kit) => kit.packages.length > 0);
  return {
    schemaVersion: 1,
    packages,
    // The Engine reads kits from the published lane only.
    ...(kits.length && !preview ? { kits } : {}),
  };
}
