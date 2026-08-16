import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { scopeTargetLabel } from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/display-labels.js";

const localizedDefaults = {
  chat: "Localized chat",
  character: "Localized character",
  group: "Localized branch group",
  persona: "Localized persona",
} as const;
const missingPersona = "Missing persona";
const personaFallbacks = {
  ...localizedDefaults,
  persona: missingPersona,
};

assert.equal(
  scopeTargetLabel("persona", "missing-persona", [], personaFallbacks),
  missingPersona,
  "a missing persona uses the caller override",
);
assert.equal(
  scopeTargetLabel(
    "persona",
    "deleted-persona",
    [{ id: "deleted-persona", label: "deleted-persona" }],
    personaFallbacks,
  ),
  missingPersona,
  "an unresolved ID-shaped persona label uses the caller override",
);

for (const kind of ["chat", "character", "group"] as const) {
  assert.equal(
    scopeTargetLabel(kind, `missing-${kind}`, [], personaFallbacks),
    localizedDefaults[kind],
    `the persona override preserves the localized ${kind} fallback`,
  );
}

assert.equal(
  scopeTargetLabel(
    "persona",
    "known-persona",
    [{ id: "known-persona", label: "Known persona" }],
    personaFallbacks,
  ),
  "Known persona",
  "a real target label takes precedence over every fallback",
);

const memoryVaultSource = readFileSync(
  fileURLToPath(
    new URL(
      "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/MemoryVault.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);

assert.match(
  memoryVaultSource,
  /formatScopeTargetLabel\(kind, id, targets, \{[\s\S]*?chat: localizeUi\([\s\S]*?character: localizeUi\([\s\S]*?group: localizeUi\([\s\S]*?persona: localizeUi\([\s\S]*?\.\.\.fallbackLabels,[\s\S]*?\}\)/u,
  "MemoryVault applies per-call overrides after its localized defaults",
);
assert.match(
  memoryVaultSource,
  /subjectLabel[\s\S]*?scopeTargetLabel\(subject\.ref\.kind, subject\.ref\.id, pickerTargets, \{[\s\S]*?deletedCharacter[\s\S]*?missingPersona/u,
  "subject labels provide deleted-character and missing-persona overrides",
);
assert.match(
  memoryVaultSource,
  /scopeTargetLabel\([\s\S]*?"persona",[\s\S]*?draft\.scope\.personaId,[\s\S]*?pickerTargets,[\s\S]*?missingPersona/u,
  "the persona scope pill provides the missing-persona override",
);

process.stdout.write(
  "Long-Term Memory scope fallback regression: localized defaults and per-kind overrides ok\n",
);
