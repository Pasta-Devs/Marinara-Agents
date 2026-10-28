// What other features may read from Discovery. Keeps Creators off the Discovery internals.
export { SLURP_DISCOVERY_TAG_LIMIT } from "./slp-discovery.js";

// Creators renders the discovery profile section inside the stage-profile form.
export { SlurpDiscoveryProfileEditor } from "./SlpDiscoveryProfileEditor.js";
export { isSlurpDiscoveryProfileIncomplete } from "./slp-discovery.js";

// Stir's trend cards list the live trends.
export { useSlurpTrends } from "./slp-trends-hooks.js";
