import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEnglishPackageLocale,
  PACKAGE_LOCALE_SCHEMA_REFERENCE,
  readPackageAgentDefinitions,
  readPackageManifest,
  serializePackageLocale,
} from "./package-locales.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesRoot = join(repoRoot, "packages");
const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const topLevelKeys = new Set(["$schema", "_meta", "package", "agents"]);
const metadataKeys = new Set(["locale", "direction"]);
const localizedTextKeys = new Set(["name", "description"]);
const localizedAgentKeys = new Set(["name", "description", "promptTemplates"]);

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported key ${key}`);
  }
}

function assertLocalizedText(value, label) {
  assertRecord(value, label);
  assertOnlyKeys(value, localizedTextKeys, label);
  for (const [key, text] of Object.entries(value)) {
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error(`${label}.${key} must be a non-empty string`);
    }
  }
}

function validateLocaleCatalog(catalog, { id, locale, agentDefinitions }) {
  const label = `${id} ${locale} localization`;
  assertRecord(catalog, label);
  assertOnlyKeys(catalog, topLevelKeys, label);
  if (catalog.$schema !== PACKAGE_LOCALE_SCHEMA_REFERENCE) {
    throw new Error(`${label} must reference ${PACKAGE_LOCALE_SCHEMA_REFERENCE}`);
  }
  assertRecord(catalog._meta, `${label} metadata`);
  assertOnlyKeys(catalog._meta, metadataKeys, `${label} metadata`);
  if (catalog._meta.locale !== locale) {
    throw new Error(`${label} metadata locale must match its filename`);
  }
  if (!localePattern.test(locale)) throw new Error(`${label} uses an invalid locale tag`);
  if (!new Set(["ltr", "rtl"]).has(catalog._meta.direction)) {
    throw new Error(`${label} direction must be ltr or rtl`);
  }
  if (catalog.package !== undefined) assertLocalizedText(catalog.package, `${label} package`);
  if (catalog.agents === undefined) return;

  assertRecord(catalog.agents, `${label} agents`);
  const definitionsById = new Map(agentDefinitions.map((definition) => [definition.id, definition]));
  for (const [agentId, localizedAgent] of Object.entries(catalog.agents)) {
    const definition = definitionsById.get(agentId);
    if (!definition) throw new Error(`${label} references unknown Agent ${agentId}`);
    assertRecord(localizedAgent, `${label} Agent ${agentId}`);
    assertOnlyKeys(localizedAgent, localizedAgentKeys, `${label} Agent ${agentId}`);
    for (const key of ["name", "description"]) {
      if (localizedAgent[key] !== undefined) {
        assertLocalizedText({ [key]: localizedAgent[key] }, `${label} Agent ${agentId}`);
      }
    }
    if (localizedAgent.promptTemplates === undefined) continue;
    assertRecord(localizedAgent.promptTemplates, `${label} Agent ${agentId} prompt templates`);
    const templateIds = new Set((definition.promptTemplates ?? []).map((template) => template.id));
    for (const [templateId, localizedTemplate] of Object.entries(localizedAgent.promptTemplates)) {
      if (!templateIds.has(templateId)) {
        throw new Error(`${label} Agent ${agentId} references unknown prompt template ${templateId}`);
      }
      assertLocalizedText(localizedTemplate, `${label} Agent ${agentId} prompt template ${templateId}`);
    }
  }
}

let packageCount = 0;
let translationCount = 0;
for (const entry of (await readdir(packagesRoot, { withFileTypes: true })).sort((left, right) =>
  left.name.localeCompare(right.name),
)) {
  if (!entry.isDirectory()) continue;
  const packageRoot = join(packagesRoot, entry.name);
  const manifest = await readPackageManifest(packageRoot);
  if (!manifest?.entrypoints?.agents) continue;
  const agentDefinitions = await readPackageAgentDefinitions(packageRoot, manifest);
  const localesRoot = join(packageRoot, "locales");
  const localeFiles = (await readdir(localesRoot, { withFileTypes: true }).catch(() => []))
    .filter((localeEntry) => localeEntry.isFile() && localeEntry.name.endsWith(".json"))
    .map((localeEntry) => localeEntry.name)
    .sort();
  if (!localeFiles.includes("en.json")) {
    throw new Error(`Missing canonical English localization for ${manifest.id}`);
  }

  const expectedEnglish = serializePackageLocale(buildEnglishPackageLocale(manifest, agentDefinitions));
  const actualEnglish = await readFile(join(localesRoot, "en.json"), "utf8");
  if (actualEnglish !== expectedEnglish) {
    throw new Error(`English localization for ${manifest.id} is stale. Run node scripts/sync-package-locales.mjs.`);
  }

  for (const localeFile of localeFiles) {
    const locale = localeFile.slice(0, -".json".length);
    const catalog = JSON.parse(await readFile(join(localesRoot, localeFile), "utf8"));
    validateLocaleCatalog(catalog, { id: manifest.id, locale, agentDefinitions });
    if (locale !== "en") translationCount += 1;
  }
  packageCount += 1;
}

console.log(
  `Package localization catalogs valid: ${packageCount} canonical English catalogs, ${translationCount} translations.`,
);

const noodleClientRoot = join(repoRoot, "packages/noodle/src/engine/packages/client/src");
const noodleLocaleRoot = join(noodleClientRoot, "localization/locales");
const noodleLocales = ["de", "en", "ko", "pl"];
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

async function readNoodleUiLocale(locale) {
  const parsed = JSON.parse(await readFile(join(noodleLocaleRoot, `${locale}.json`), "utf8"));
  assertRecord(parsed, `Noodle ${locale} UI localization`);
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

const noodleCatalogs = new Map();
for (const locale of noodleLocales) noodleCatalogs.set(locale, await readNoodleUiLocale(locale));
const noodleEnglish = noodleCatalogs.get("en");
const noodleEnglishKeys = Object.keys(noodleEnglish);
if (noodleEnglishKeys.length < 1_000) {
  throw new Error("Noodle English localization unexpectedly lost package UI coverage");
}
if (JSON.stringify(noodleEnglishKeys) !== JSON.stringify([...noodleEnglishKeys].sort())) {
  throw new Error("Noodle English localization keys must stay sorted");
}

for (const [locale, catalog] of noodleCatalogs) {
  const keys = Object.keys(catalog);
  if (JSON.stringify(keys) !== JSON.stringify([...keys].sort())) {
    throw new Error(`Noodle ${locale} localization keys must stay sorted`);
  }
  for (const [key, value] of Object.entries(catalog)) {
    if (!exactSharedKeys.has(key) && !sharedPrefixes.some((prefix) => key.startsWith(prefix))) {
      throw new Error(`Noodle ${locale} localization contains unrelated Engine key ${key}`);
    }
    if (!(key in noodleEnglish)) {
      throw new Error(`Noodle ${locale} localization key ${key} has no English fallback`);
    }
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`Noodle ${locale} localization key ${key} is empty`);
    }
  }
}

const referencedNoodleKeys = new Set();
for (const file of await collectSourceFiles(noodleClientRoot)) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/["'](ui\.noodle\.[A-Za-z0-9_.-]+)["']/gu)) {
    referencedNoodleKeys.add(match[1]);
  }
}
const missingNoodleKeys = [...referencedNoodleKeys]
  .filter((key) => !(key in noodleEnglish) && !(`${key}_one` in noodleEnglish && `${key}_other` in noodleEnglish))
  .sort();
if (missingNoodleKeys.length > 0) {
  throw new Error(`Noodle English localization is missing: ${missingNoodleKeys.join(", ")}`);
}

console.log(
  `Noodle UI locales valid: en=${noodleEnglishKeys.length}, de=${Object.keys(noodleCatalogs.get("de")).length}, ko=${Object.keys(noodleCatalogs.get("ko")).length}, pl=${Object.keys(noodleCatalogs.get("pl")).length}.`,
);
