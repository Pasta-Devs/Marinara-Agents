// The splash screen needs the shipped version and its notes inside the client bundle, and the
// client has no route that serves CHANGELOG.md. So the notes are mirrored here, and
// `tests/slurp2-release-notes.regression.ts` fails the build if this file drifts from
// `packages/slurp2/CHANGELOG.md` or from the version in `manifest.json`.
export const SLURP2_VERSION = "0.0.18";

export interface Slurp2ReleaseEntry {
  version: string;
  date: string;
  notes: string[];
}

/** Newest first, same order as CHANGELOG.md. */
export const SLURP2_RELEASES: Slurp2ReleaseEntry[] = [
  {
    version: "0.0.18",
    date: "2026-09-16",
    notes: [
      "Messages: a queued reply now has a Force reply now button that answers at once.",
      "Fixed Creators sometimes never answering a message.",
      "Posts are no longer cut off by their format. New settings: Longest post, and Show more after 300 characters.",
      "New Backstage section: Prompts. Writing guidance, spice level, presets and both image prompts sit together.",
      "New image prompt style: Default, or Danbooru tags (experimental) for anime models that read tags.",
      "Image prompts keep the style tags first and put the Creator's appearance right after them.",
      "When an image fails, you can now edit the image prompt and try again.",
      "When an image fails, you can now edit the image prompt and try again.",
      "Slurp retries loading after an Engine restart, and Try again reloads the page if that fails.",
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
  {
    version: "0.0.9",
    date: "2026-09-14",
    notes: [
      "Added Autopurge with configurable day, week, or month retention; media-only or full-post cleanup; optional direct-message media cleanup; an immediate purge action; and restart-safe scheduling for overdue purges.",
    ],
  },
  {
    version: "0.0.8",
    date: "2026-09-14",
    notes: [
      "Bug fixes for discovery filters and translations, subscription prices, image references, fan privacy, rapport details, message fees, arc editing and generation, profile validation, regression tests, and test-output handling.",
    ],
  },
  {
    version: "0.0.7",
    date: "2026-09-13",
    notes: [
      "Rebuilt Discover around direct subscription actions, persistent grid and list views, and filters for subscription status, gender, weekly price, and Creator tags.",
      "Added Recommended, Newest, Most liked, and Most subscribed sorting with stable results.",
      "Added editable Creator gender and tags, including safe custom tags and AI-suggested curated tags during profile creation and redrafting.",
      "Added Arcs with automatic suggestions, pacing, focus, allowed kinds, and delivery to posts, messages, fan comments, and notifications.",
      "Moved message, photo, subscription, and tip prices from the profile information box to the action that uses each price.",
      "Hid the Follow control for subscribed Creators because a subscription already includes following.",
      "Made Open the default Creator identity mode and removed the Secret identity tier.",
      "Fixed persona Creator creation when Slurp already has the persona's viewer identity.",
    ],
  },
  {
    version: "0.0.6",
    date: "2026-09-13",
    notes: [
      "Added image context options for reactions: stored prompts, vision descriptions, or automatic selection. Public fan reactions keep locked images hidden and respect Creator identity privacy.",
      "Generation now shows how many Creators remain, including skipped or failed requests.",
      "Restored visible success and error notifications for Slurp actions.",
      "Fixed persona Creator creation when Slurp already has the persona's viewer identity. The viewer and Creator accounts can now coexist for one persona.",
    ],
  },
  {
    version: "0.0.5",
    date: "2026-09-13",
    notes: [
      "Made the welcome screen shorter, put Gunterlie beside the greeting, linked Slurp General, and tucked older release notes behind an expander.",
      "Corrected older ad ratings, fallback handles, onboarding text, and invalid digest account errors.",
    ],
  },
  {
    version: "0.0.4",
    date: "2026-09-12",
    notes: [
      'Fixed Refresh Conversation Schedule failing with "chatComplete is not a function". It now creates the schedule.',
      "Fixed the Conversation Schedule refresh dialog and the settings loading screen showing raw text keys instead of words.",
      "Fixed the header logo not loading. The logo is now built into Slurp and no longer depends on the package asset address.",
      "Added Reply timing settings under Messaging: the longest wait, the wait when the return time is unknown, check-in waits for close and regular fans, and away times for Creators without a schedule.",
      "Added Always reachable without a schedule. With it on, a Creator with no Conversation Schedule counts as online.",
      "Corrected the Creator settings text that said a Creator without a Conversation Schedule is always reachable. Slurp guesses from their last post unless the new setting is on.",
    ],
  },
  {
    version: "0.0.3",
    date: "2026-09-12",
    notes: [
      "Fixed Create post and Add story doing nothing on a Creator profile with a tip goal set. The goal used to hide the post composer.",
      "Slurp Remastered now shows its color artwork in the Agents browser. The gray artwork is for Slurp Legacy only.",
    ],
  },
  {
    version: "0.0.2",
    date: "2026-09-12",
    notes: [
      "Added a way to write your own ad in Settings. Give it a brand, a product, ad copy, and a rating, and it joins the pool.",
      "Fixed feed ads stopping after the first server batch, content-rating limits being dropped, and one odd rating rejecting a whole batch.",
      "Fixed ad actions paying out for ads that were never served, and restored read tracking on the default Following feed.",
      "Fixed audience churn, relationship arcs, and subscription billing being starved by the world tick.",
      "Fixed recent Creator activity being ignored when replies and follow-ups decide whether a Creator is online. Drafts no longer count as activity.",
      "Stopped backups, restores, and deletion from overlapping world or Creator writes, and persona-operated Creators from speaking on their own.",
      "Creators no longer write first when you have turned their proactive messages off.",
      "Corrected the logo and the welcome screen's close control and keyboard focus.",
      "A restore now says plainly that it overrides your settings.",
    ],
  },
  {
    version: "0.0.1",
    date: "2026-09-12",
    notes: [
      "First release of the Slurp remaster as its own package. It installs beside Slurp Legacy and keeps its own separate data.",
      "Added direct messages, scheduled follow-ups, commissions, an audience funnel, and creator earnings kept apart from spending money.",
      "Added a backup export and restore. A Slurp Legacy backup can be restored here, which is how you move your data across.",
      "Added a welcome screen. It appears after the install and after every update, warns that this is alpha software, and lists what changed.",
    ],
  },
];

/** Everything newer than the acknowledged version. Fresh installs and versions that have rolled
 *  off the retained history receive the full list, with the splash deciding what to expand. */
export function getSlurp2UnseenReleases(seenVersion: string | null): Slurp2ReleaseEntry[] {
  const seenIndex = seenVersion === null ? -1 : SLURP2_RELEASES.findIndex((release) => release.version === seenVersion);
  return seenIndex === -1 ? SLURP2_RELEASES : SLURP2_RELEASES.slice(0, seenIndex);
}
