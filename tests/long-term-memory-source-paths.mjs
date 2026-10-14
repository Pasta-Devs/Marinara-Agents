import { fileURLToPath } from "node:url";

// Long-Term Memory source files read by the source-text regressions. Moving a file changes one line here.
const client = "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/";
const server = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/";
const at = (path) => fileURLToPath(new URL(path, import.meta.url));

export const ltmClientRoot = at(client);

export const ltmSourcePaths = {
  activity: at(`${client}ActivityView.tsx`),
  api: at(`${client}api.ts`),
  detail: at(`${client}LongTermMemoryDetail.tsx`),
  interop: at(`${server}interop.ts`),
  lastInjectionSummary: at(`${client}LastInjectionSummary.tsx`),
  locale: at(`${client}locales/en.json`),
  navigation: at(`${client}LongTermMemoryNavigation.tsx`),
  reviewQueue: at(`${client}ReviewQueue.tsx`),
  routes: at(`${server}routes.ts`),
  settings: at(`${client}MemorySettings.tsx`),
  sharedControls: at(`${client}shared-controls.tsx`),
  sourcesWorkspace: at(`${client}SourcesWorkspace.tsx`),
  targetPicker: at(`${client}TargetPicker.tsx`),
  types: at(`${client}types.ts`),
  vault: at(`${client}MemoryVault.tsx`),
  workspaceLayout: at(`${client}LtmWorkspace.tsx`),
};
