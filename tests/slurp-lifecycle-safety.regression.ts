import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const routes = read("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts");
const publicSupport = read("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-public-support.ts");
const replyOperation = read(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-creator-reply.operation.ts",
);
const imageConnections = read(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-image-connections.ts",
);
const home = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx");
const storage = read("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts");
const settings = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx");
const profileSurface = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpProfileSurface.tsx");
const artwork = read("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-artwork.operation.ts");
const shell = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpShell.tsx");

const updateRoute = routes.slice(
  routes.indexOf('app.put("/noodler/accounts/:id/stage-profile"'),
  routes.indexOf('app.post("/noodler/accounts/:id/source/dismiss"'),
);
assert.ok(
  updateRoute.indexOf("source_revision_conflict") < updateRoute.indexOf("discardNoodlerPreparedPost"),
  "source revision conflicts must be checked before prepared posts are discarded",
);
assert.match(
  updateRoute,
  /preparedPostCount: preparedForCreator\.length/u,
  "disclosure review must report the real prepared-post count",
);
assert.doesNotMatch(
  publicSupport.slice(
    publicSupport.indexOf("for (const account of existingCharacterAccounts)"),
    publicSupport.indexOf("return filterExcludedNoodleAccounts"),
  ),
  /deleteAccountByEntity/u,
  "missing sources must not delete retained Slurp Creator state",
);
assert.match(
  replyOperation,
  /settings\.generationConnectionId[\s\S]*?getWithKey\(settings\.generationConnectionId\)[\s\S]*?getDefaultForAgents/u,
  "Creator replies must use the Slurp connection with Engine default fallback",
);
assert.match(imageConnections, /LEGACY_KEY = "noodle\.noodler-image-connections"/u);
assert.match(imageConnections, /storage\.get\(KEY\)[\s\S]*?storage\.get\(LEGACY_KEY\)/u);
assert.doesNotMatch(home, /canQuieten|makeQuieter|quieterPending/u);
assert.match(home, /const viewingOwnCreator = profile\.sourceAccountId === viewerAccount\?\.entityId/u);
assert.match(home, /const managedCreator = true/u);
assert.match(home, /function DisclosureBadge[\s\S]*?HelpTooltip/u);
assert.match(home, /confirmProviderDisclosure/u);
assert.doesNotMatch(home, /findLastIndex/u, "Slurp hub must support the Engine ES2020 target");
assert.match(home, /function profileAccent\(_profileId: string\): string \{\s*return NOODLE_PINK;/u);
assert.doesNotMatch(home, /#7ED6A5/u, "Creator profiles must not override Slurp with a green accent");
assert.ok(
  home.indexOf("const [draftNoodleAccountId, setDraftNoodleAccountId]") < home.indexOf("useNoodlerEligibleAccounts("),
  "profile source state must be declared before first-render query evaluation",
);
assert.match(
  storage,
  /cleanupRetiredViewer[\s\S]*?noodleAccountSubscriptions[\s\S]*?noodlePostUnlocks[\s\S]*?slurpViewerSettingsKey/u,
);
assert.match(settings, /ui\.slurp\.settings\.creators\.sourceChanged/u);
assert.match(settings, /onRedraftCreator/u);
assert.match(settings, /import \{ Avatar, getNoodleAccentStyle, NOODLE_PINK \} from "\.\/SlurpShell"/u);
assert.match(routes, /app\.post\("\/noodler\/accounts\/:id\/banner"/u);
assert.match(routes, /app\.post\("\/noodler\/accounts\/:id\/artwork\/generate"/u);
assert.match(home, /useUploadNoodlerBanner/u);
assert.match(home, /useGenerateNoodlerArtwork/u);
assert.match(profileSurface, /<Upload size=\{13\}/u);
assert.match(profileSurface, /<Upload size=\{12\}/u);
assert.match(profileSurface, /ui\.slurp\.artwork\.generateBanner/u);
assert.match(profileSurface, /ui\.slurp\.artwork\.generateAvatar/u);
assert.match(profileSurface, /group-hover:opacity-100/u);
assert.match(profileSurface, /<Avatar account=\{account\} size="xl"/u);
assert.match(artwork, /one continuous ultra-wide background scene only/u);
assert.match(artwork, /Do not include a profile picture, avatar, headshot/u);
assert.match(artwork, /width: kind === "banner" \? 1536 : 1024/u);
assert.match(artwork, /height: kind === "banner" \? 512 : 1024/u);
assert.match(settings, /ui\.slurp\.settings\.refresh\.title/u);
assert.match(settings, /title=\{t\("ui\.slurp\.settings\.refresh\.title"\)\}/u);
assert.match(settings, /open=\{refreshModalOpen\}[\s\S]*?panelStyle=\{getNoodleAccentStyle\(NOODLE_PINK/u);
assert.match(
  settings,
  /refreshCreators\.mutate\(\s*\{ accountIds: \[\.\.\.refreshAccountIds\], access: refreshAccess \}/u,
);
assert.doesNotMatch(home, /refreshAllNow/u, "bulk refresh belongs in Creator settings");
assert.match(
  shell,
  /import \{[\s\S]*?useEffect,[\s\S]*?useState,[\s\S]*?\} from "react"/u,
  "hub scroll hooks must import every React hook they call",
);

console.log("Slurp lifecycle safety regressions passed.");
