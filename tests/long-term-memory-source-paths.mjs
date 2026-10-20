import { fileURLToPath } from "node:url";

// Long-Term Memory source files read by the source-text regressions. Moving a file changes one line here.
const client = "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/";
const server = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/";
const at = (path) => fileURLToPath(new URL(path, import.meta.url));

export const ltmClientRoot = at(client);

export const ltmSourcePaths = {
  activity: at(`${client}settings/ActivityView.tsx`),
  api: at(`${client}api.ts`),
  availabilityTabRail: at(`${client}AvailabilityTabRail.tsx`),
  bulkAvailability: at(`${client}vault/BulkAvailabilityWorkbench.tsx`),
  detail: at(`${client}LongTermMemoryDetail.tsx`),
  interop: at(`${server}sources/interop.ts`),
  lastInjectionSummary: at(`${client}LastInjectionSummary.tsx`),
  locale: at(`${client}locales/en.json`),
  maintenance: at(`${client}settings/MaintenancePanel.tsx`),
  navigation: at(`${client}LongTermMemoryNavigation.tsx`),
  reviewQueue: at(`${client}review/ReviewQueue.tsx`),
  routes: at(`${server}routes/notes.ts`),
  settings: at(`${client}settings/MemorySettings.tsx`),
  sharedControls: at(`${client}shared-controls.tsx`),
  sourceScopeCombobox: at(`${client}SourceScopeCombobox.tsx`),
  sourcesWorkspace: at(`${client}sources/SourcesWorkspace.tsx`),
  targetPicker: at(`${client}vault/TargetPicker.tsx`),
  types: at(`${client}types.ts`),
  vault: at(`${client}vault/MemoryVault.tsx`),
  workspaceLayout: at(`${client}LtmWorkspace.tsx`),
};
