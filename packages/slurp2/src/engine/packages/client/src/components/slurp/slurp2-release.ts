// The splash screen needs the shipped version and its notes inside the client bundle, and the
// client has no route that serves CHANGELOG.md. So the notes are mirrored here, and
// `tests/slurp2-release-notes.regression.ts` fails the build if this file drifts from
// `packages/slurp2/CHANGELOG.md` or from the version in `manifest.json`.
export const SLURP2_VERSION = "0.0.30";

export interface Slurp2ReleaseEntry {
  version: string;
  date: string;
  notes: string[];
}

/** Newest first, same order as CHANGELOG.md. */
export const SLURP2_RELEASES: Slurp2ReleaseEntry[] = [
  {
    version: "0.0.30",
    date: "2026-09-19",
    notes: ["No visible changes. Split the client state and hooks into feature modules."],
  },
  {
    version: "0.0.29",
    date: "2026-09-18",
    notes: ["No visible changes. Added the cross-feature event modifier seam."],
  },
  {
    version: "0.0.28",
    date: "2026-09-18",
    notes: ["No visible changes. Moved the server services into pure rules, data, and feature modules."],
  },
  {
    version: "0.0.27",
    date: "2026-09-18",
    notes: ["No visible changes. Split server storage into feature-owned modules."],
  },
  {
    version: "0.0.26",
    date: "2026-09-18",
    notes: ["No visible changes. Split the server routes into feature modules."],
  },
  {
    version: "0.0.25",
    date: "2026-09-18",
    notes: [
      "No visible changes. Moved the package entry points, shared date helper, and translations into the new source layout.",
    ],
  },
  {
    version: "0.0.24",
    date: "2026-09-18",
    notes: [
      "No visible changes. Internal groundwork for a cleaner source layout, with stricter build checks.",
      "Removed unused custom-emoji code.",
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
  {
    version: "0.0.21",
    date: "2026-09-17",
    notes: [
      "Messages: the composer is shorter on one-line messages and still grows for longer text.",
      "Messages: away replies use a centered Creator status block with a quiet Get reply now action.",
      "Messages: sent messages now show separate delivered and seen receipts.",
      "Messages: mobile headers keep the Creator name visible and move the relationship label into an icon and meter.",
      "Messages: fixed the transparent mobile header menu with an opaque surface.",
      "Messages: desktop uses the compact connection switcher.",
      "Messages: every sent message shows one check when delivered and two when seen.",
      "Messages: away Creators show a status card with a sleeping animation, not typing dots.",
      "Creators stay online 5 minutes after replying and 10 after delivering a commission.",
      "Messages: tier icons are back in the desktop header; tap one to see the full tier scale.",
      "Messages: Back returns to the profile or activity a chat was opened from.",
      "Fixed see-through menus and pickers.",
    ],
  },
  {
    version: "0.0.20",
    date: "2026-09-17",
    notes: [
      'Fixed Restart Setup stuck on "How will people recognize them?".',
      'Fixed "Needs attention" on Creators with a Conversation Schedule. Older schedules now repeat weekly, like in Engine chats.',
      "Ads: new Ad image connection setting.",
      "Stories: wider viewer, backdrop, show whole image, likes, unlock price.",
      "Messages: cleaner message bar that grows with your text.",
      "Messages: sending scrolls to your message; a button jumps to the latest.",
      "Messages: header buttons fold into one menu on phones.",
      'Messages: a "New messages" line marks where you stopped.',
      "Creators keep a separate draft for each fan thread.",
      "Side menu: Creator card shows the full banner and a clean name.",
      "Create posts now: no Stories, waits for busy Creators, names any that did not post.",
    ],
  },
  {
    version: "0.0.19",
    date: "2026-09-17",
    notes: ["Fixed Force reply now doing nothing when the hourly model budget was used up."],
  },
  {
    version: "0.0.18",
    date: "2026-09-16",
    notes: [
      "Messages: Force reply now answers a queued reply at once.",
      "Fixed Creators sometimes never answering a message.",
      "Posts are no longer cut off. New settings: Longest post, Show more after 300 characters.",
      "New Backstage section Prompts, with a prompt block builder.",
      "New image prompt style: Danbooru tags (experimental).",
      "Image prompts put style tags first, then the Creator's appearance.",
      "Edit the image prompt when you regenerate an image or retry a failed one.",
      "Automation -> Manual actions: run posts, audience activity and schedules yourself.",
      "Like, comment, vote and subscribe without a Creator profile.",
      "Mobile Backstage: no section tabs, full-width search.",
      "Fixed Prompts reset, turned-off prompt blocks, and Slurp loading after an Engine restart.",
      "Creators no longer mention the time or weekday in every post.",
    ],
  },
  {
    version: "0.0.17",
    date: "2026-09-16",
    notes: [
      "Settings is now Backstage: Overview, Creators, Features, Automation, and Maintenance, with setting search and live previews.",
      "Creators shows metrics and totals for every Creator. Click one to open its settings, content menu, message prices, and collab partners.",
      "Features -> Events and holidays: yearly events that Creators mention in posts, replies, and messages.",
      "Free teaser posts: some automatic posts go out free to win subscribers.",
      "Featured, buried, and viral weeks change post reach, and viral posts bring a rush of followers.",
      "Fans who spend a lot and show up constantly can become Too attached.",
      "Crossovers prefer collab partners, and commissions get a quote by default.",
      "Feed posts have Edit, Delete, and Show image context in the post menu again.",
    ],
  },
  {
    version: "0.0.16",
    date: "2026-09-15",
    notes: [
      "Settings -> Audience is simpler: one Activity choice (Off, Quiet, Realistic, Lively, Generous), crowd size and tone up front, and fan types, AI writing and advanced numbers in folded sections. Off also stops commissions, DMs and the activity pulse.",
      "A fan type's tone override now changes how those fans write their comments.",
      "Settings -> Tags is rebuilt: tags show as chips in their groups, with usage counts and a filter. Click a tag to rename it, merge it into another tag, move it to another group, or delete it.",
      "Settings -> Creators: select many Creators and change gender, add or remove tags, or turn auto-post and images on or off in one step. The selected Creator also has a quick gender and tag editor.",
      "Fix: toggles in Settings no longer black out the screen in Firefox.",
    ],
  },
  {
    version: "0.0.15",
    date: "2026-09-15",
    notes: [
      "Fixed a wide post or story pushing the left and right sidebars off the screen.",
      "The follow button on a Creator profile now shows whether you follow that Creator.",
    ],
  },
  {
    version: "0.0.14",
    date: "2026-09-15",
    notes: [
      "Fixed commissions drawing a new picture on every retry when the fan could not pay.",
      "Fixed locked pay-per-view messages sending what their picture shows before the fan paid.",
      "Pictures in messages, commissions and your recent posts now reach the AI as stored prompts or descriptions, with an optional image description model. Each picture is described once, and models that cannot read images are skipped.",
      "Characters can remember their Slurp posts, messages, commissions, subscriptions and tips in Engine chats: turn on Carryover to chats in Settings and Include Slurp activity in the chat's settings.",
      "Added lorebook context for Creator posts, prompt presets with import and export, a changed count and Reset section for each settings section, gallery images when no picture is generated, a Professor Mari Creator switch, and a per-character choice for chat image instructions.",
      "Deleting all Slurp data now asks you to type DELETE, and the mobile bottom bar is smaller.",
    ],
  },
  {
    version: "0.0.13",
    date: "2026-09-15",
    notes: [
      'Fixed Creator management (profile, goal, subscription price, projects, arcs, payout, and Story viewers) rejecting edits with "Only the Creator\'s owner can..." — Slurp is single-player, so any Creator is now always yours to manage.',
      "Fixed direct-message replies crashing when two reply attempts collided, along with other duplicate-safe storage operations that crossed the package boundary.",
      "Persona Creators can now like and reply to their own posts as their public Creator identity.",
    ],
  },
  {
    version: "0.0.12",
    date: "2026-09-15",
    notes: [
      "AI Creator drafts are repaired instead of failing: long text is shortened, gender and tag spellings are understood, broken JSON is fixed, and the form lists what still needs a choice.",
      "Persona Creators now have the same drafting tools as character Creators: AI post drafts from your own text, and an AI image toggle in the composer for drafted and manual posts.",
      "Fixed bulk Creator creation skipping open-mode Creators with a wrong gender and tags reason, and draft errors now show the real cause.",
    ],
  },
  {
    version: "0.0.11",
    date: "2026-09-14",
    notes: [
      "Fixed AI Creator drafts that failed or could not be saved because the model left out gender or gave fewer than three tags.",
    ],
  },
  {
    version: "0.0.10",
    date: "2026-09-14",
    notes: [
      "Rebuilt the audience as a deterministic simulation with editable fan types, presets, a seven-day estimate, and JSON import and export.",
      "Added separate free-simulation and AI-text clocks with call limits, a shared model budget, weekly fan spending limits, and a multi-process world lease.",
      "Added Creator pricing: own subscription, post, and commission prices with suggestions, commission quotes that follow the brief, haggling, and weekly dynamic prices for character Creators.",
      "Long posts and long comment threads now collapse, and replies nest under the comment they answer.",
      "Fixed doubled subscriber totals, lost followers after an ended subscription, tips missing from fan relationships, thin like pacing, and silent subscription lapses.",
      "Fixed Slurp images failing with an X-Admin-Secret error on remote installs, and sent image connection custom parameters such as LoRA settings.",
    ],
  },
];

/** Everything newer than the acknowledged version. Fresh installs and versions that have rolled
 *  off the retained history receive the full list, with the splash deciding what to expand. */
export function getSlurp2UnseenReleases(seenVersion: string | null): Slurp2ReleaseEntry[] {
  const seenIndex = seenVersion === null ? -1 : SLURP2_RELEASES.findIndex((release) => release.version === seenVersion);
  return seenIndex === -1 ? SLURP2_RELEASES : SLURP2_RELEASES.slice(0, seenIndex);
}
