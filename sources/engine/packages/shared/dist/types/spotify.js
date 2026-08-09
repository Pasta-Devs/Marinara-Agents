// ──────────────────────────────────────────────
// Spotify source contract
// ──────────────────────────────────────────────
/** Accepted source constraints used by Music DJ. */
const SPOTIFY_SOURCE_TYPES = ["liked", "playlist", "artist", "any"];
/** Maximum recently played Spotify tracks retained to suppress near-term repeats. */
export const SPOTIFY_RECENT_TRACK_HISTORY_LIMIT = 250;
/** Normalize persisted or user-provided values to a supported Spotify source. */
export function normalizeSpotifySourceType(value) {
    return SPOTIFY_SOURCE_TYPES.find((sourceType) => sourceType === value) ?? "liked";
}
//# sourceMappingURL=spotify.js.map