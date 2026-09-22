// The splash screen needs the shipped version and its public notes inside the client bundle.
export const SLURP2_VERSION = "0.2.23";

export interface Slurp2ReleaseEntry {
  version: string;
  date: string;
  notes: string[];
}

/** The public release history shown in the Engine splash screen. */
export const SLURP2_RELEASES: Slurp2ReleaseEntry[] = [
  {
    version: "0.2.23",
    date: "2026-09-22",
    notes: [
      "Restore now works after you delete a post: the row waits for you instead of disappearing while the countdown runs.",
      "Share asks which chat to send a post to, with a search and a New chat button, and the chat card says who wrote the post.",
      "Reporting a post offers the reasons a real social network offers, plus Slurp's own three.",
      "Playing a Creator, you can ask a fan to write back, the same way a fan can ask you.",
      "Creators look like themselves in pictures: avatar references and source appearance are used by default. Both remain switches in Backstage → Images.",
    ],
  },
  {
    version: "0.2.22",
    date: "2026-09-22",
    notes: [
      "Everyday Slurp screens now load only the data they use, so opening the Hub does not also load profile sources, model connections, full notifications, or the full inbox.",
      "Shell badges use lightweight notification and message counts, and feed seen, follow, subscription, and unlock actions update the visible surface before background reconciliation.",
    ],
  },
  {
    version: "0.2.20",
    date: "2026-09-22",
    notes: [
      "Creators can keep a wardrobe of complete looks, review AI imports from their character, lorebooks, pasted text, or old wardrobe note, and let automatic posts choose without repeating the same outfit.",
      "Automatic picture posts now connect the caption to a small scene plan while Slurp still enforces identity, clothing, camera reach, company, quality, and public or locked limits.",
      "Random post variation no longer invents loneliness, low spirits, or a bad-money day. Real events and the source character can still make a serious post serious.",
    ],
  },
  {
    version: "0.2.19",
    date: "2026-09-22",
    notes: [
      "A Creator now has her own appearance, wardrobe, and regular places, on her profile. The appearance goes with every picture, so she stops looking like somebody different in each post.",
    ],
  },
  {
    version: "0.2.18",
    date: "2026-09-22",
    notes: [
      "How far a Creator's pictures go is now a setting. Locked posts deliver it, public posts stay one step below, and housekeeping posts stay clean.",
      "Pictures stop coming out muddy and badly lit: the prompt asked the image model for a plain photograph and it was reading that as a bad one.",
      "Creators post fewer arm's-length selfies and far fewer posts with no picture at all.",
    ],
  },
  {
    version: "0.2.17",
    date: "2026-09-22",
    notes: [
      "A post with several pictures now opens with arrows and mini previews, and the feed card shows how many there are.",
      "Prompt Studio: every prompt block can be switched off, and required blocks can be rewritten in your own words.",
    ],
  },
  {
    version: "0.2.16",
    date: "2026-09-21",
    notes: [
      "Restoring a deleted post now brings it back at once, and a Restore near the end of the countdown no longer fails.",
      "Share cards are drawn in the browser, so they carry the creator name, title, and caption again instead of the bare picture.",
      "Opening a post no longer shows its picture twice.",
    ],
  },
  {
    version: "0.2.15",
    date: "2026-09-21",
    notes: [
      "Deleted posts now leave a sparkling restore slot for 60 seconds before permanent cleanup.",
      "Post image prompts now use a typed visual brief and preserve the planned scene through image interpretation.",
    ],
  },
  {
    version: "0.2.8",
    date: "2026-09-21",
    notes: [
      "Feed loading has a softer status animation, older drops show a progress state, and deleted posts leave the timeline with a short gentle exit.",
    ],
  },
  {
    version: "0.2.7",
    date: "2026-09-21",
    notes: [
      "The feed loads its first page first, older posts load on demand, and post edits and deletes update the visible feed without a full reload.",
    ],
  },
  {
    version: "0.2.5",
    date: "2026-09-21",
    notes: [
      "Locked posts no longer tease what the reader already owns, and housekeeping posts stay public. The composer offers only the purposes that fit the post's audience.",
    ],
  },
  {
    version: "0.2.4",
    date: "2026-09-21",
    notes: [
      "Who holds the camera now follows what the post is for: a planned shoot is rarely a selfie, an ordinary day usually is.",
      "Two Creators who shoot the same way no longer have identical effort on the same day.",
      "Conversations start between strangers instead of as friends.",
      "Creators answer a new message within the hour instead of after two, so the inbox no longer needs Reply now.",
    ],
  },
  {
    version: "0.2.3",
    date: "2026-09-21",
    notes: [
      "Every post's menu has Deep details: the plan, the draws, the full prompt, the model's raw answer, the picture brief, and every tag behind that post.",
    ],
  },
  {
    version: "0.2.2",
    date: "2026-09-21",
    notes: [
      "Removed viewer access. Every persona now sees every Creator; the per-Creator hide list is no longer used.",
    ],
  },
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
