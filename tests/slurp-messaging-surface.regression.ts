import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, "packages/slurp/src/engine/packages", path), "utf8");

const messages = read("client/src/components/slurp/SlurpMessages.tsx");
const settings = read("client/src/components/slurp/SlurpSettings.tsx");
const home = read("client/src/components/slurp/SlurpHome.tsx");
const hooks = read("client/src/hooks/use-slurp.ts");
const messageRoutes = read("server/src/routes/slurp-messages.routes.ts");
const slurpRoutes = read("server/src/routes/slurp.routes.ts");
const messageStorage = read("server/src/services/storage/slurp-messages.storage.ts");

// The creator-side messaging tools and the commission flow shipped as endpoints and hooks with no
// UI behind them. Every one of those hooks must be reachable from the Messages tab.
for (const hook of [
  "useSendSlurpCreatorPpv",
  "useBroadcastSlurpMessage",
  "useCreateSlurpCommission",
  "useQuoteSlurpCommission",
  "useAcceptSlurpCommission",
  "useDeliverSlurpCommission",
]) {
  assert.match(messages, new RegExp(hook, "u"), `Messages must use ${hook}`);
}

// A commission is only renderable if the thread carries it, which the thread reads did not do.
assert.match(messageStorage, /async listCommissionsForThread\(/u);
assert.match(messageRoutes, /commissions: await messages\.listCommissionsForThread\(thread\.id\)/u);
assert.match(messageRoutes, /commissions: thread \? await messages\.listCommissionsForThread\(thread\.id\) : \[\]/u);
assert.match(hooks, /commissions: SlurpCommission\[\]/u);

// The ledger union had not caught up with the direct-message economy, so a PPV, commission, or
// request-fee line was typed as impossible while the server was already writing them.
for (const kind of ["messageRequest", "ppv", "commission"]) {
  assert.match(hooks, new RegExp(`\\| "${kind}"`, "u"), `the wallet ledger union must include ${kind}`);
}

// The wallet listed subscriptions by raw creator id, which named nothing to the player.
assert.match(home, /creatorNameById/u, "the wallet must resolve creator ids to display names");
assert.doesNotMatch(
  home,
  /<span className="min-w-0 truncate text-xs font-semibold">\{creatorId\}<\/span>/u,
  "the wallet must not render a bare creator id",
);

// Ambient profiles had no surface at all: the roster, the toggle, and the reroll are reachable.
assert.match(slurpRoutes, /app\.get\("\/ambient-profiles"/u);
assert.match(slurpRoutes, /app\.post\("\/ambient-profiles\/reroll"/u);
assert.match(slurpRoutes, /app\.post\("\/accounts\/:id\/post-draft"/u);
assert.match(settings, /AmbientProfilesPanel/u);
assert.match(settings, /useRerollAmbientProfiles/u);
assert.match(settings, /allowRandomUsers/u, "the ambient panel must expose the participation setting");

// The restored draft service imported a symbol its neighbour never re-exported, so it could not
// bundle. Nothing caught that while no route referenced it.
const draftService = read("server/src/services/slurp/slurp-invited-post-draft.service.ts");
assert.match(draftService, /import \{ noodlerSourceText \} from "\.\/slurp-prompt-safety\.js"/u);

console.log("slurp messaging surface regression passed");
