import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sourceRoot = new URL(
  "../packages/memory-nag/src/engine/packages/client/src/features/memory-nag/",
  import.meta.url,
);
const settings = readFileSync(new URL("MemoryNagSettings.tsx", sourceRoot), "utf8");
const styles = readFileSync(new URL("styles.ts", sourceRoot), "utf8");

assert.match(settings, /id="mn-memory-nag-vault-prompt"[\s\S]*rows=\{3\}/u);
assert.equal(
  (settings.match(/className="mn-prompt-tool"/gu) ?? []).length,
  3,
  "Vault memory prompt must use the standard expand, macros, and reset affordances",
);
assert.doesNotMatch(
  settings,
  /mari-agent-settings-action mari-agent-settings-action--icon mn-prompt-tool/u,
  "prompt affordances must not inherit the large agent action-button chrome",
);
assert.match(
  settings,
  /disabled=\{saving \|\| scanning \|\| settings\.vaultPrompt === MEMORY_NAG_DEFAULT_VAULT_PROMPT\}/u,
  "Vault prompt reset must stay disabled while saving, scanning, or already at the default",
);
assert.match(
  settings,
  /onClick=\{\(\) => updateSettings\(\{ vaultPrompt: MEMORY_NAG_DEFAULT_VAULT_PROMPT \}\)\}/u,
  "Vault prompt reset must restore the built-in default",
);
assert.match(styles, /\.mn-prompt-textarea \{[\s\S]*min-height: 3\.25rem;[\s\S]*border-radius: 0\.375rem;/u);
assert.match(styles, /\.mn-prompt-tool:not\(:disabled\):hover \{[\s\S]*background: var\(--accent\);/u);

process.stdout.write("Memory Nag settings UI contract passed\n");
