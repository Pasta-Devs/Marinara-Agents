import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { shouldRefreshSpatialWorkspace } from "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/spatial-workspace-refresh";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const baseDefinition = { revision: 1, locations: [] } as never;
const baseHierarchyProfile = { name: "Base hierarchy", types: [] } as never;

const common = {
  initialized: true,
  templateMode: false,
  dirty: false,
  baseDefinition,
  serverDefinition: baseDefinition,
  baseHierarchyProfile,
  serverHierarchyProfile: baseHierarchyProfile,
};

assert.equal(
  shouldRefreshSpatialWorkspace(common),
  false,
  "An unchanged clean workspace must not be rehydrated",
);
assert.equal(
  shouldRefreshSpatialWorkspace({
    ...common,
    serverDefinition: { ...baseDefinition, revision: 2 },
  }),
  true,
  "A clean linked chat must accept a newer canonical definition after its query refetches",
);
assert.equal(
  shouldRefreshSpatialWorkspace({
    ...common,
    dirty: true,
    serverDefinition: { ...baseDefinition, revision: 2 },
  }),
  false,
  "Unsaved editor changes must never be overwritten by a background refresh",
);
assert.equal(
  shouldRefreshSpatialWorkspace({
    ...common,
    templateMode: true,
    serverDefinition: { ...baseDefinition, revision: 2 },
  }),
  false,
  "Shared-world query refreshes must not replace a template/library editor",
);
assert.equal(
  shouldRefreshSpatialWorkspace({
    ...common,
    serverHierarchyProfile: {
      ...baseHierarchyProfile,
      name: "Updated canonical hierarchy",
    },
  }),
  true,
  "A clean workspace must also accept canonical hierarchy-profile changes",
);
const hookSource = readFileSync(
  resolve(
    repoRoot,
    "packages/hierarchical-maps/src/engine/packages/client/src/hooks/use-spatial-context.ts",
  ),
  "utf8",
);
assert.match(
  hookSource,
  /await queryClient\.invalidateQueries\(\{\s*queryKey: spatialContextKeys\.all,\s*refetchType: "all",/u,
  "Publishing must await refetches for inactive as well as active cached linked-chat queries",
);

const workspaceSource = readFileSync(
  resolve(
    repoRoot,
    "packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/SpatialMapWorkspace.tsx",
  ),
  "utf8",
);
assert.match(workspaceSource, /shouldRefreshSpatialWorkspace\(\{/u);
assert.match(
  workspaceSource,
  /const serverHierarchyProfile = normalizeHierarchyProfile\(spatial\.data\.hierarchyProfile, nextDraft\);[\s\S]*?serverHierarchyProfile,[\s\S]*?setBaseHierarchyProfile\(serverHierarchyProfile\);[\s\S]*?setDraftHierarchyProfile\(serverHierarchyProfile\);/u,
  "The workspace must compare and store the same normalized server hierarchy profile",
);
assert.match(
  workspaceSource,
  /role=\{linkedSharedWorld\.missing \|\| linkedSharedWorld\.conflict \? "alert" : "status"\}[\s\S]*?This chat has unpublished shared-world changes\./u,
  "A server-preserved unpublished draft must expose its linked-world conflict as an alert",
);
assert.match(workspaceSource, /Clean linked chats cached in this window will refresh automatically/u);
assert.match(workspaceSource, /Chats with unpublished drafts keep them and show a conflict/u);
assert.match(workspaceSource, /Canonical revision \$\{result\.world\.revision\} saved/u);
assert.match(workspaceSource, /reopen other tabs or windows to load it/u);

console.log(
  "World Maps shared-world refresh regression passed: all cached queries refetch, clean editors rehydrate, dirty drafts stay intact, and publish copy states refresh boundaries.",
);
