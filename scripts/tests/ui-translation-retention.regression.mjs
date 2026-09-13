import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateShippedUiTranslations } from "../package-locales.mjs";

const root = await mkdtemp(join(tmpdir(), "marinara-ui-translations-"));
const localePath = "packages/memory-nag/de.json";
const writeCatalog = (catalog) => writeFile(join(root, localePath), JSON.stringify(catalog));
try {
  await mkdir(join(root, "scripts"));
  await mkdir(join(root, "packages/memory-nag"), { recursive: true });
  await writeFile(
    join(root, "scripts/package-ui-translation-baseline.json"),
    JSON.stringify({ [localePath]: ["memoryNag.error.interface", "memoryNag.settings.title"] }),
  );
  const translated = { "memoryNag.error.interface": "Fehler", "memoryNag.settings.title": "Einstellungen" };
  await writeCatalog(translated);
  await validateShippedUiTranslations(root);

  // Partial catalogs may add translations without requiring full English parity.
  await writeCatalog({ ...translated, "memoryNag.settings.new": "Neu" });
  await validateShippedUiTranslations(root);
  for (const catalog of [
    { "memoryNag.settings.title": "Einstellungen" },
    { _meta: { locale: "de" } },
    { "memoryNag.settings.title": "Einstellungen", "memoryNag.settings.new": "Neu" },
  ]) {
    await writeCatalog(catalog);
    await assert.rejects(
      validateShippedUiTranslations(root),
      /memory-nag\/de\.json lost shipped translation keys: memoryNag\.error\.interface/u,
    );
  }
  await rm(join(root, localePath));
  await assert.rejects(validateShippedUiTranslations(root), /ENOENT/u);
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log(
  "UI translation retention: additions allowed; deleted keys, equal-count replacements, and deleted catalogs rejected.",
);
