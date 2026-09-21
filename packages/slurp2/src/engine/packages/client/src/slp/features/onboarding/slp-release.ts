// The splash screen needs the shipped version and its public notes inside the client bundle.
export const SLURP2_VERSION = "0.2.1";

export interface Slurp2ReleaseEntry {
  version: string;
  date: string;
  notes: string[];
}

/** The public release history shown in the Engine splash screen. */
export const SLURP2_RELEASES: Slurp2ReleaseEntry[] = [
  {
    version: "0.2.1",
    date: "2026-09-21",
    notes: [
      "Posts no longer read private notes from direct messages.",
      "Teasers, callbacks, and ordinary days stay short; only behind-the-scenes posts run long.",
      "Stories can now be thank-yous and requests too, and a callback with nothing to continue becomes an ordinary post.",
      "Prompt Studio shows every block in full and lets you edit it in place, with live text for the preview Creator and the compiled prompt kept current.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-09-21",
    notes: [
      "Creators now plan posts: teasers, photo sets of up to three images, Stories, cropped previews, reused pictures, text on purpose, and quiet slots. Classic mode became a prompt preset.",
      "Shoots keep a set consistent, and a set can open a teaser-and-callback campaign.",
      "Each Creator has a Posting strategy; the composer picks a one-off purpose and delivery.",
      "Fan requests can be answered from the conversation, and the planner keeps promises.",
      "Creators remember what they said and did; fan-private details never leak. Review it in the new Continuity tab or the Backstage queue.",
      "Prompt Studio was redesigned, and Pulse shows background work.",
    ],
  },
  {
    version: "0.1.3",
    date: "2026-09-20",
    notes: [
      "Slurp HTTP routes now use Slurp naming. Existing avatars, banners, ad images, post images and backups keep working.",
    ],
  },
  {
    version: "0.1.2",
    date: "2026-09-19",
    notes: ["Fixed Creator filters, profile expansion, and settings tabs not responding after the 0.1.1 update."],
  },
  {
    version: "0.1.1",
    date: "2026-09-19",
    notes: [
      "Slurp now carries its own vocabulary instead of borrowing names from the Engine.",
      "Cleaned up a leftover wording slip in the setup wizard intro.",
      "Fixed SwarmUI image generation: prompt images and LoRAs are now sent when you do not use a custom workflow.",
      "Nothing else changes. Your creators, posts and settings are untouched.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-19",
    notes: [
      "Completed the backend file split and modularisation.",
      "You should not feel any difference. If you do, tell me in Discord.",
    ],
  },
  {
    version: "0.0.22",
    date: "2026-09-17",
    notes: [
      "Invite Engine characters to the Slurp audience from character groups or per-character controls.",
      "Audience characters are now available as a first expansion step. The current setup is still limited and needs clearer guidance and simpler controls.",
      "Invited characters use their own card voice and tags in comments, audience activity, and messages.",
      "Invited characters can follow, subscribe, spend, hold ties, and appear in fan cards.",
      "Added a New Chat picker for owned Creators and invited characters.",
      "Added prompt-cost limits and deterministic character rotation.",
      "Fixed feed ads, image prompt display, and the configured subscription price.",
      "Added configurable image Stories and platform-style message actions.",
      "Added backend groundwork for the next expansion and bug-fix updates, with clearer service boundaries for safer iteration.",
    ],
  },
];

/** Everything newer than the acknowledged version. */
export function getSlurp2UnseenReleases(seenVersion: string | null): Slurp2ReleaseEntry[] {
  const seenIndex = seenVersion === null ? -1 : SLURP2_RELEASES.findIndex((release) => release.version === seenVersion);
  return seenIndex === -1 ? SLURP2_RELEASES : SLURP2_RELEASES.slice(0, seenIndex);
}
