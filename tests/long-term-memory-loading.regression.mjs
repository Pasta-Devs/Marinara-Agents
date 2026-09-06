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
assert.match(previewBlock, /sourceContextMatchesProps && sourceTargetResolved && source !== "lorebooks"/u);
assert.match(previewBlock, /const lorebookPreview = useQuery\(/u);
assert.match(previewBlock, /sourceContextMatchesProps && sourceTargetResolved && source === "lorebooks"/u);
const sourceDetailsBlock = sources.slice(
  sources.indexOf("const sourceDetails = useQuery({"),
  sources.indexOf("const previewData ="),
);
assert.match(sourceDetailsBlock, /scopeTargets\.isSuccess/u);
assert.match(sourceDetailsBlock, /sourceContextMatchesProps/u);
assert.match(sourceDetailsBlock, /focusedFlatSourceId !== null/u);
assert.match(sources, /const sourceContextMatchesProps = sourceContextKey === \(props\.chatId \?\? "all"\)/u);
assert.match(sources, /const sourceTargetResolved = Boolean\(sourceTarget && scopeTargets\.isSuccess\)/u);
assert.match(
  sources,
  /const previewData = sourceContextMatchesProps && sourceTargetResolved \? preview\.data : undefined/u,
);
assert.match(
  sources,
  /const lorebookPreviewData = sourceContextMatchesProps && sourceTargetResolved \? lorebookPreview\.data : undefined/u,
);
assert.match(
  sources,
  /const sourceDetailsData = sourceContextMatchesProps && sourceTargetResolved \? sourceDetails\.data : undefined/u,
);
assert.match(sources, /setSourceTargetId\(props\.chatId \? `chat:\$\{props\.chatId\}` : "all"\)/u);
assert.match(sources, /scopeTargetOptions\.find\(\(target\) => target\.id === sourceTargetId\)/u);
assert.match(sources, /setSourceTargetId\(next\)/u);
assert.match(sources, /if \(scopeTargets\.isError\) \{/u);
assert.match(sources, /scopeTargets\.refetch\(\)/u);

console.log("Long-Term Memory loading regression passed: shared scope-target cache and resolved-scope previews.");
