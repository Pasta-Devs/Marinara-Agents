// ──────────────────────────────────────────────
// Otome Forge: the Engine's own art (#2147), told apart from Otome's paints by where it is served
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles. Otome's paints and cut-outs are always Global Gallery files
// (/api/global-gallery/…, with a `global-gallery:` ref); the Engine's own art is a card or persona avatar, a card or
// persona gallery file, a sprite, or a background (the player's or a Game Assets one). Otome reads it and never paints,
// cuts or deletes an avatar of it.

const ENGINE_AVATAR = /^\/api\/(?:avatars\/file\/|characters\/(?:personas\/)?[^/?#]+\/gallery\/file\/)/u;
const ENGINE_ART = /^\/api\/(?:sprites\/[^/?#]+\/file\/|backgrounds\/file\/|game-assets\/file\/)/u;

/** A card or persona avatar (or gallery file): shown as the player made it, never cut out. */
export const isEngineAvatar = (url: unknown): url is string => typeof url === "string" && ENGINE_AVATAR.test(url);

/** Any art the Engine owns: an avatar, a sprite or a background. */
export const isEngineArt = (url: unknown): url is string =>
  isEngineAvatar(url) || (typeof url === "string" && ENGINE_ART.test(url));
