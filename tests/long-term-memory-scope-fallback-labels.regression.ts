import assert from "node:assert/strict";

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
  scopeTargetLabel("persona", "known-persona", [{ id: "known-persona", label: "Known persona" }], personaFallbacks),
  "Known persona",
  "a real target label takes precedence over every fallback",
);

assert.equal(
  scopeTargetLabel("local_character", "missing-local", [], { local_character: "Local character fallback" }),
  "Local character fallback",
  "local_character respects fallback overrides",
);

process.stdout.write("Long-Term Memory scope fallback regression: localized defaults and per-kind overrides ok\n");
