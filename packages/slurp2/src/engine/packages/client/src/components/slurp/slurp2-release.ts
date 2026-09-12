// The splash screen needs the shipped version and its notes inside the client bundle, and the
// client has no route that serves CHANGELOG.md. So the notes are mirrored here, and
// `tests/slurp2-release-notes.regression.ts` fails the build if this file drifts from
// `packages/slurp2/CHANGELOG.md` or from the version in `manifest.json`.
export const SLURP2_VERSION = "0.0.2";

export interface Slurp2ReleaseEntry {
  version: string;
  date: string;
  notes: string[];
}

/** Newest first, same order as CHANGELOG.md. */
export const SLURP2_RELEASES: Slurp2ReleaseEntry[] = [
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
