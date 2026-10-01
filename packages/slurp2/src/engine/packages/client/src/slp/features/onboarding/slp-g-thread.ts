// G's thread: the welcome and the changelog as one chat with Gunterlie. This builds the messages;
// SlpSplash.tsx renders them in the shared chat shell.
import { getSlurp2UnseenReleases, SLURP2_RELEASES, type Slurp2ReleaseEntry } from "./slp-release";

/** "welcome": first run. "update": opened on its own after an update. "pill": opened from Settings. */
export type SlpGThreadMode = "welcome" | "update" | "pill";

export type SlpGMessage =
  | { kind: "intro"; id: "intro" }
  | { kind: "line"; id: string; text: string }
  | { kind: "discord"; id: "discord" }
  | { kind: "divider"; id: "new" }
  | { kind: "release"; id: string; release: Slurp2ReleaseEntry };

/**
 * The thread top to bottom, plus the message to scroll to. A first run is the welcome only (no
 * release list). Otherwise the welcome stays as history and every release follows, oldest first,
 * with a "New" divider above the first one the browser has not seen.
 */
export function slpGThread({
  mode,
  seen,
  welcome,
  releases = SLURP2_RELEASES,
}: {
  mode: SlpGThreadMode;
  seen: string | null;
  welcome: readonly string[];
  /** Newest first, as in `SLURP2_RELEASES`. */
  releases?: readonly Slurp2ReleaseEntry[];
}): { messages: SlpGMessage[]; scrollTo: string | null } {
  const messages: SlpGMessage[] = [
    { kind: "intro", id: "intro" },
    ...welcome.map((text, index) => ({ kind: "line" as const, id: `welcome-${index}`, text })),
    { kind: "discord", id: "discord" },
  ];
  if (mode === "welcome") return { messages, scrollTo: null };

  const unseen = new Set(getSlurp2UnseenReleases(seen, releases).map((release) => release.version));
  let divided = false;
  for (const release of [...releases].reverse()) {
    if (!divided && unseen.has(release.version)) {
      messages.push({ kind: "divider", id: "new" });
      divided = true;
    }
    messages.push({ kind: "release", id: `release-${release.version}`, release });
  }
  const newest = releases[0] ? `release-${releases[0].version}` : null;
  return { messages, scrollTo: mode === "update" && divided ? "new" : newest };
}
