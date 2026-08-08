import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
  if (!manifest) continue;
  if (!manifest.entrypoints?.agents) continue;
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
    throw new Error(
      `English localization for ${manifest.id} is stale. Run node scripts/sync-package-locales.mjs.`,
    );
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
