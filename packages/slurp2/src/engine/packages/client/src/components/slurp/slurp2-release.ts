// The splash screen needs the shipped version and its notes inside the client bundle, and the
// client has no route that serves CHANGELOG.md. So the notes are mirrored here, and
// `tests/slurp2-release-notes.regression.ts` fails the build if this file drifts from
// `packages/slurp2/CHANGELOG.md` or from the version in `manifest.json`.
export const SLURP2_VERSION = "0.0.1";

export interface Slurp2ReleaseEntry {
  version: string;
  date: string;
  notes: string[];
}

/** Newest first, same order as CHANGELOG.md. */
export const SLURP2_RELEASES: Slurp2ReleaseEntry[] = [
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
