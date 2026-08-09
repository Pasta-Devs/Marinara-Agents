import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const noodleClientRoot = join(repoRoot, "packages/noodle/src/engine/packages/client/src");
const localeRoot = join(noodleClientRoot, "localization/locales");
const locales = ["de", "en", "ko", "pl"];
const exactSharedKeys = new Set([
  "chat.delete.dialog.cancel",
  "editor.avatar.upload",
  "lorebook.editor.batch.delete",
  "navigation.topbar.characters",
  "navigation.topbar.connections",
  "navigation.topbar.noodle",
  "navigation.topbar.personas",
  "navigation.topbar.settings",
  "settings.modes.conversations",
  "settings.notifications.customSound.actions.remove",
  "settings.notifications.customSound.status.custom",
  "settings.sections.imageGeneration.title",
  "settings.sections.notifications.title",
  "ui.characters.charactercliptrimmodal.reset",
  "ui.chat.dependencyworkspaceapprovalcard.notNow",
  "ui.chat.homeprofessormarichat.deleteValue1",
]);
const sharedPrefixes = ["capabilities.actions.", "ui.agents.agenteditor.", "ui.noodle."];

async function readLocale(locale) {
  const parsed = JSON.parse(await readFile(join(localeRoot, `${locale}.json`), "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${locale}.json must contain one flat translation object`);
  }
  return parsed;
}

async function collectSourceFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(path)));
    else if ([".ts", ".tsx"].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const catalogs = new Map();
for (const locale of locales) catalogs.set(locale, await readLocale(locale));
const english = catalogs.get("en");
const englishKeys = Object.keys(english);
if (englishKeys.length < 1_000) throw new Error("Noodle English localization unexpectedly lost package UI coverage");
if (JSON.stringify(englishKeys) !== JSON.stringify([...englishKeys].sort())) {
  throw new Error("Noodle English localization keys must stay sorted");
}

for (const [locale, catalog] of catalogs) {
  const keys = Object.keys(catalog);
  if (JSON.stringify(keys) !== JSON.stringify([...keys].sort())) {
    throw new Error(`Noodle ${locale} localization keys must stay sorted`);
  }
  for (const [key, value] of Object.entries(catalog)) {
    if (!exactSharedKeys.has(key) && !sharedPrefixes.some((prefix) => key.startsWith(prefix))) {
      throw new Error(`Noodle ${locale} localization contains unrelated Engine key ${key}`);
    }
    if (!(key in english)) throw new Error(`Noodle ${locale} localization key ${key} has no English fallback`);
    if (typeof value !== "string" || !value.trim()) throw new Error(`Noodle ${locale} localization key ${key} is empty`);
  }
}

const referencedNoodleKeys = new Set();
for (const file of await collectSourceFiles(noodleClientRoot)) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/["'](ui\.noodle\.[A-Za-z0-9_.-]+)["']/gu)) {
    referencedNoodleKeys.add(match[1]);
  }
}
const missing = [...referencedNoodleKeys]
  .filter((key) => !(key in english) && !(`${key}_one` in english && `${key}_other` in english))
  .sort();
if (missing.length > 0) throw new Error(`Noodle English localization is missing: ${missing.join(", ")}`);

console.log(
  `Package locales valid: Noodle en=${englishKeys.length}, de=${Object.keys(catalogs.get("de")).length}, ko=${Object.keys(catalogs.get("ko")).length}, pl=${Object.keys(catalogs.get("pl")).length}.`,
);
