// ── Beholder capability client: prelude ──────────────────────────────────────
// Namespace, one-time stylesheet injection, and the state fetch.
//
// The renderer modules that follow (garment data, colors, state, paperdoll) are
// ported verbatim from the Beholder extension so the doll drawn here is the doll
// the extension draws — same markup, same classes, same stylesheet. Only this
// file, the dock, and the custom element are new: they replace the extension's
// host shim with the capability contract.
//
// BH_STYLE_CSS and BH_FA_CSS are emitted ahead of this file by
// scripts/build-beholder-package.mjs from src/*.css.

const BH = {
  PANEL_ID: "beholder_panel",
};

/** Escape a value for interpolation into panel markup. */
BH.escapeHtml = function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
};

/**
 * Resolve an interface string for the host's locale.
 *
 * The host tells a capability which locale it is rendering in but not what the
 * words are, so the package carries its own catalogs (src/locales/*.json, emitted
 * as BH_LOCALES by the builder) and falls back through region → language → en.
 */
BH.localize = function localize(props, key, fallback) {
  const requested = String(props?.localization?.locale || "en")
    .trim()
    .replaceAll("_", "-")
    .toLowerCase();
  const candidates = [requested, requested.split("-")[0], "en"];
  for (const candidate of candidates) {
    const value = BH_LOCALES[candidate]?.[key];
    if (typeof value === "string" && value) return value;
  }
  return fallback;
};

/** Inject the panel stylesheet once per document, including detached tabs. */
BH.ensureStyles = function ensureStyles(targetDocument = document) {
  if (targetDocument.getElementById("bh-capability-styles")) return;
  const style = targetDocument.createElement("style");
  style.id = "bh-capability-styles";
  style.textContent = `${BH_FA_CSS}\n${BH_STYLE_CSS}\n${BH_HOST_CSS}`;
  targetDocument.head.appendChild(style);
};

/**
 * Read the tracked physical state for a chat.
 *
 * The agent writes it server-side after each extraction; this is a plain read of
 * the route the Beholder agent package's server half already exposes. A failure
 * here is not fatal — the dock renders its empty state and the next turn retries.
 */
BH.fetchState = async function fetchState(chatId) {
  const res = await fetch(`/api/agents/beholder-state/${encodeURIComponent(chatId)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`beholder-state ${res.status}`);
  const body = await res.json();
  const characters = Array.isArray(body?.state?.characters) ? body.state.characters : [];
  // The renderer keys state by character name — the shape the extension panel uses.
  // Null-prototype: the keys are character names straight out of the chat, and a
  // character called __proto__ must land as an entry, not as the map's prototype.
  const byName = Object.create(null);
  for (const character of characters) {
    if (!character || typeof character.name !== "string") continue;
    byName[character.name] = {
      ...(character.species ? { species: character.species } : {}),
      body: character.body && typeof character.body === "object" ? character.body : {},
    };
  }
  return byName;
};

/** Report an unrecoverable wiring failure through the host's runtime-error contract. */
BH.fail = function fail(element, error) {
  const message = error && error.message ? error.message : "Beholder interface stopped";
  element.capabilityRuntimeError = message;
  element.dispatchEvent(new CustomEvent("marinara-capability-runtime-error", { detail: { message }, bubbles: true }));
  console.error("[beholder] capability client stopped", error);
};
