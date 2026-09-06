import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(
  "packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/api.ts",
  "utf8",
);
const vault = await readFile(
  "packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/MemoryVault.tsx",
  "utf8",
);
const sources = await readFile(
  "packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/SourcesWorkspace.tsx",
  "utf8",
);

assert.match(api, /export const ltmScopeTargetsKey = \(chatId: string \| null \| undefined\)/u);
assert.match(vault, /queryKey: ltmScopeTargetsKey\(props\.chatId\)/u);
assert.match(sources, /queryKey: ltmScopeTargetsKey\(props\.chatId\)/u);
assert.match(vault, /staleTime: 30_000/u);
assert.match(sources, /staleTime: 30_000/u);

const previewBlock = sources.slice(sources.indexOf("const preview = useQuery({"), sources.indexOf("const rows ="));
assert.match(previewBlock, /enabled: scopeTargets\.isSuccess && Boolean\(sourceTarget\)/u);
assert.match(previewBlock, /sourceTargetMatchesContext && source !== "lorebooks"/u);
assert.match(previewBlock, /const lorebookPreview = useQuery\(/u);
assert.match(previewBlock, /sourceTargetMatchesContext && source === "lorebooks"/u);
assert.match(previewBlock, /focusedFlatSourceId !== null/u);
assert.match(sources, /const previewData = sourceTargetMatchesContext \? preview\.data : undefined/u);
assert.match(sources, /const lorebookPreviewData = sourceTargetMatchesContext \? lorebookPreview\.data : undefined/u);
assert.match(sources, /const sourceDetailsData = sourceTargetMatchesContext \? sourceDetails\.data : undefined/u);

console.log("Long-Term Memory loading regression passed: shared scope-target cache and resolved-scope previews.");
