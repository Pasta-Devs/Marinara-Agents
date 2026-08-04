import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { shouldRefreshSpatialWorkspace } from "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/spatial-workspace-refresh";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
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
  /queryClient\.invalidateQueries\(\{ queryKey: spatialContextKeys\.sharedWorlds \}\)[\s\S]*?predicate: \(query\)[\s\S]*?cached\?\.sharedWorld\?\.worldId === world\.id/u,
  "Publishing must narrowly invalidate the shared-world list and affected cached linked-chat queries",
);
assert.match(
  hookSource,
  /try \{[\s\S]*?await Promise\.all\([\s\S]*?\} catch \{/u,
  "A failed cache refresh must not turn a successful shared-world publish into a failed mutation",
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
  /role=\{linkedSharedWorld\.missing \|\| linkedSharedWorld\.conflict \? "alert" : "status"\}[\s\S]*?This chat has unpublished shared-world changes\./u,
  "A server-preserved unpublished draft must expose its linked-world conflict as an alert",
);
assert.match(workspaceSource, /Clean linked chats cached in this window will refresh automatically/u);
assert.match(workspaceSource, /Chats with unpublished drafts keep them and show a conflict/u);
assert.match(workspaceSource, /Canonical revision \$\{result\.world\.revision\} saved/u);
assert.match(workspaceSource, /reopen other tabs or windows to load it/u);

console.log(
  "World Maps shared-world refresh regression passed: affected caches refresh, clean editors rehydrate, dirty drafts stay intact, and publish copy states refresh boundaries.",
);
