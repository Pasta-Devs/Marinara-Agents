// The splash screen needs the shipped version and its notes inside the client bundle, and the
// client has no route that serves CHANGELOG.md. So the notes are mirrored here, and
// `tests/slurp2-release-notes.regression.ts` fails the build if this file drifts from
// `packages/slurp2/CHANGELOG.md` or from the version in `manifest.json`.
export const SLURP2_VERSION = "0.0.10";

export interface Slurp2ReleaseEntry {
  version: string;
  date: string;
  notes: string[];
}

/** Newest first, same order as CHANGELOG.md. */
export const SLURP2_RELEASES: Slurp2ReleaseEntry[] = [
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
