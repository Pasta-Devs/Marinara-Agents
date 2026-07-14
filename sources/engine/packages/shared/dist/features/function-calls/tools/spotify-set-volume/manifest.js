export const spotifySetVolumeToolManifest = {
    name: "spotify_set_volume",
    description: "Set the playback volume on the user's active Spotify device (0-100).",
    parameters: {
        type: "object",
        properties: {
            volume: { type: "number", description: "Volume level (0-100)" },
            reason: {
                type: "string",
                description: "Why the volume is being adjusted (e.g. 'quiet scene', 'intense battle')",
            },
        },
        required: ["volume"],
    },
};
//# sourceMappingURL=manifest.js.map