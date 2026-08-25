import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sourceRoot = new URL(
  "../packages/memory-nag/src/engine/packages/client/src/features/memory-nag/",
  import.meta.url,
);
const settings = readFileSync(new URL("MemoryNagSettings.tsx", sourceRoot), "utf8");
const vault = readFileSync(new URL("MemoryNagVault.tsx", sourceRoot), "utf8");
const styles = readFileSync(new URL("styles.ts", sourceRoot), "utf8");

assert.doesNotMatch(
  settings,
  /memoryNag\.settings\.save/u,
  "Memory Nag settings must not require a manual save action",
);
assert.match(
  settings,
  /window\.setTimeout\(\(\) => \{[\s\S]*void saveSettings\(\)[\s\S]*\}, 500\);/u,
  "Memory Nag settings must autosave after a short quiet period",
);
assert.match(
  settings,
  /settingsVersionRef\.current === version/u,
  "an older autosave response must not overwrite newer field edits",
);
assert.match(
  settings,
  /const onDirtyChangeRef = useRef\(onDirtyChange\);[\s\S]*onDirtyChangeRef\.current = onDirtyChange;[\s\S]*scanController\.current\?\.abort\(\);[\s\S]*onDirtyChangeRef\.current\?\.\(false\);[\s\S]*\}, \[\]\);/u,
  "settings cleanup must only abort scans when the component unmounts",
);
assert.match(
  settings,
  /const saved = await memoryNagRequest<[\s\S]*attemptedVersionRef\.current = Math\.max\(attemptedVersionRef\.current, version\);/u,
  "an autosave version must count as attempted only after persistence succeeds",
);
assert.match(
  settings,
  /retryCountRef\.current \+= 1;[\s\S]*retryCountRef\.current >= 2[\s\S]*failedVersionRef\.current >= version/u,
  "failed autosaves must retry once without entering an unbounded retry loop",
);
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
  /disabled=\{scanning \|\| settings\.vaultPrompt === MEMORY_NAG_DEFAULT_VAULT_PROMPT\}/u,
  "Vault prompt reset must stay disabled while scanning or already at the default",
);
assert.match(
  settings,
  /onClick=\{\(\) => updateSettings\(\{ vaultPrompt: MEMORY_NAG_DEFAULT_VAULT_PROMPT \}\)\}/u,
  "Vault prompt reset must restore the built-in default",
);
assert.match(styles, /\.mn-prompt-textarea \{[\s\S]*min-height: 3\.25rem;[\s\S]*border-radius: 0\.375rem;/u);
assert.match(styles, /\.mn-prompt-tool:not\(:disabled\):hover \{[\s\S]*background: var\(--accent\);/u);
assert.match(
  styles,
  /\.mn-shell \{[\s\S]*--background: var\(--marinara-chat-chrome-panel-bg\);[\s\S]*--border: var\(--marinara-chat-chrome-panel-border\);/u,
  "Memory Nag windows must reuse the neutral chat-panel token mapping",
);
assert.match(
  styles,
  /\.mn-modal \{[\s\S]*width: min\(48rem, 100%\);[\s\S]*background: var\(--marinara-chat-chrome-panel-bg\);[\s\S]*box-shadow: 0 25px 50px -12px/u,
  "Memory Nag Vault must match the standard Assembled Prompt window width and surface",
);
assert.match(
  vault,
  /<MessageSquareQuote className="mn-icon"[\s\S]*className="mari-chrome-control mari-chrome-control--small mn-modal-close"/u,
  "Memory Nag Vault header must use its dialogue icon and retain the standard close control",
);
assert.match(vault, /className="mn-overlay mari-modal" role="presentation"/u);
assert.match(vault, /mari-modal-panel marinara-chat-popover/u);
assert.match(vault, /marinara-chat-popover__header/u);
assert.match(vault, /marinara-chat-popover__scroll/u);
assert.doesNotMatch(
  vault,
  /className="mn-overlay mari-modal" role="presentation" onClick=\{onClose\}/u,
  "Memory Nag Vault must close only from an explicit close action",
);
assert.match(
  vault,
  /className="mn-overlay mari-modal" role="presentation" data-chat-floating-panel/u,
  "Vault interactions must be exempt from Chat Settings outside-click dismissal",
);
assert.equal(
  (vault.match(/data-chat-floating-panel/gu) ?? []).length,
  2,
  "the Vault and its expanded editor must both stay inside Chat Settings' floating-panel boundary",
);
assert.doesNotMatch(
  vault,
  /className="mn-overlay mari-modal" role="presentation" data-chat-floating-panel onClick=\{onClose\}/u,
  "the Vault backdrop must not replace its explicit close control",
);

process.stdout.write("Memory Nag settings UI contract passed\n");
