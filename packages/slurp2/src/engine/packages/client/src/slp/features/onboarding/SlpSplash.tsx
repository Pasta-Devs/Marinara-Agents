// The first thing Slurp shows after an install and after an update, ahead of the age gate: G's thread,
// a chat with Gunterlie. Consent happens once: a first install gets G's welcome as bubbles (alpha +
// the AI cost note) and answers with a reply chip; an update opens the same thread on the release
// notes the player has not seen yet. Settings › Overview opens it again from the version pill.
import { ExternalLink, X } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { GUNTERLIE_AVATAR_SRC } from "../../base/chrome/slp-gunterlie-avatar";
import { getSlpAccentStyle, SLP_DISCORD_BUG_URL, SLP_PINK, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpChatShell, type SlpChatChip, type SlpChatItem } from "../../modules/chrome/SlpChatShell";
import { slpGThread, type SlpGThreadMode } from "./slp-g-thread";
import { SLURP2_VERSION, slurp2SplashKind, type Slurp2ReleaseEntry } from "./slp-release";

// Per browser, not per Engine: the splash is a notice, not a setting, and a localStorage key keeps
// it off the server and off the migration path.
const SEEN_KEY = "slurp2:splash-seen-version";

// Only English copy: this is the author speaking, and the notes mirror CHANGELOG.md, which is
// English only too.
const G_WELCOME = [
  "Hey, I’m G. The dude responsible for all the bugs.",
  "You’re testing alpha software. It’s unfinished, occasionally feral, and absolutely full of bugs.",
  "Heads up: Slurp calls your text and image models on its own, and one tap can call them more than once. Your provider may bill every call.",
];
const G_HANDOFF = "Cool. Support will take it from here. Be nice to them, they’re me in a tie.";
const G_HOST = { name: "G", avatarUrl: GUNTERLIE_AVATAR_SRC };
/** Typing dots before each of G's first-run lines. */
const G_PACE_MS = 700;
/** After the hand-off line: time to read it before the thread closes. */
const G_HANDOFF_MS = 2800;

function DiscordMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 48" className="h-5 w-5 shrink-0 text-[#5865f2]">
      <path
        fill="currentColor"
        d="M40.575 0c-.619 1.099-1.174 2.235-1.68 3.397a48.85 48.85 0 0 0-14.497 0A27.663 27.663 0 0 0 22.719 0 47.524 47.524 0 0 0 9.648 4.028C1.39 16.265-.846 28.186.266 39.943A53.278 53.278 0 0 0 16.29 47.987a35.09 35.09 0 0 0 3.435-5.531 31.46 31.46 0 0 1-5.405-2.576l1.326-.998c10.14 4.774 21.885 4.774 32.038 0 .43.354.871.695 1.326.998a31.22 31.22 0 0 1-5.417 2.589 35.05 35.05 0 0 0 3.435 5.531 53.25 53.25 0 0 0 16.025-8.032C64.367 26.33 60.806 14.51 53.645 4.041A47.417 47.417 0 0 0 40.588.025L40.575 0ZM21.14 32.707c-3.119 0-5.708-2.828-5.708-6.327 0-3.498 2.488-6.339 5.696-6.339s5.758 2.854 5.707 6.339c-.05 3.486-2.513 6.327-5.695 6.327Zm21.039 0c-3.132 0-5.696-2.828-5.696-6.327 0-3.498 2.488-6.339 5.696-6.339s5.746 2.854 5.695 6.339c-.05 3.486-2.513 6.327-5.695 6.327Z"
      />
    </svg>
  );
}

function readSeenVersion(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    // Storage can be blocked (private mode, strict cookie settings). Showing the splash every time
    // is the harmless failure here, hiding it forever is not.
    return null;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, SLURP2_VERSION);
  } catch {
    // Nothing to do. The splash simply returns next time.
  }
}

/**
 * The Engine Modal's onClose for a consent step (splash, age gate): the X and Escape leave Slurp, a
 * backdrop tap does nothing, so a stray tap never throws the player out.
 */
export function leaveUnlessBackdrop(onLeave: (() => void) | undefined) {
  // ponytail: the Engine Modal gives no way to tell a backdrop tap from the X, so a click that
  // did not land on a button is the backdrop. Upgrade path: a `dismissOnBackdrop` Modal prop.
  const event = window.event;
  if (event?.type === "click" && !(event.target instanceof Element && event.target.closest("button"))) return;
  onLeave?.();
}

/** True when the splash is due: a fresh install, or an update since it was last acknowledged.
 *  Callers hold this as state so the gate behind the splash stays shut until it is dismissed. */
export function slurp2SplashPending(): boolean {
  return readSeenVersion() !== SLURP2_VERSION;
}

export function SlurpSplash({
  open,
  onDismiss,
  onLeave,
}: {
  open: boolean;
  onDismiss: () => void;
  /** The way out of the first-run consent (X, Escape, "Leave Slurp"). Nothing is stored. */
  onLeave?: () => void;
}) {
  // Read once: the thread must not flip while it is closing after it was acknowledged.
  const [seen] = useState(readSeenVersion);
  const mode = slurp2SplashKind(seen) === "whats-new" ? "update" : "welcome";
  return <SlpGThread open={open} mode={mode} seen={seen} onDismiss={onDismiss} onLeave={onLeave} />;
}

/** The version pill in Settings › Overview: opens G's thread at the newest release, a dot while one is unseen. */
export function SlpVersionPill({
  label,
  unseenLabel,
}: {
  /** "Slurp 0.3.12", localized by the caller. */
  label: (version: string) => string;
  unseenLabel: string;
}) {
  const [seen, setSeen] = useState(readSeenVersion);
  const [open, setOpen] = useState(false);
  const unseen = seen !== SLURP2_VERSION;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group -my-2 inline-flex min-h-11 shrink-0 items-center rounded-full focus-visible:outline-none"
      >
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-white/15 px-2.5 text-xs font-bold tabular-nums text-white ring-1 ring-inset ring-white/35 transition-colors group-hover:bg-white/25 group-focus-visible:ring-2 group-focus-visible:ring-white motion-reduce:transition-none">
          {label(SLURP2_VERSION)}
          {unseen && (
            <>
              <span aria-hidden="true" className="size-2 rounded-full bg-white" />
              <span className="sr-only">{unseenLabel}</span>
            </>
          )}
        </span>
      </button>
      {open && (
        <SlpGThread
          open
          mode="pill"
          seen={seen}
          onDismiss={() => {
            setSeen(SLURP2_VERSION);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function SlpGThread({
  open,
  mode,
  seen,
  onDismiss,
  onLeave,
}: {
  open: boolean;
  mode: SlpGThreadMode;
  seen: string | null;
  /** Called after the version is stored as seen. */
  onDismiss: () => void;
  onLeave?: () => void;
}) {
  const [consented, setConsented] = useState(false);
  // First-run consent: until the chip, the X and Escape mean Leave Slurp and nothing is stored.
  const consenting = mode === "welcome" && !consented;
  const finish = () => {
    markSeen();
    onDismiss();
  };
  const close = () => (consenting ? leaveUnlessBackdrop(onLeave) : finish());

  // The host passes a fresh onDismiss on every render; a re-render must not restart the hand-off.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!consented) return;
    const timer = window.setTimeout(() => dismissRef.current(), G_HANDOFF_MS);
    return () => window.clearTimeout(timer);
  }, [consented]);

  const thread = slpGThread({ mode, seen, welcome: G_WELCOME });
  const items = thread.messages.map((message): SlpChatItem => {
    if (message.kind === "intro") return { kind: "card", id: message.id, align: "center", content: <GIntro /> };
    if (message.kind === "line") return { kind: "bubble", id: message.id, text: message.text };
    if (message.kind === "divider") return { kind: "divider", id: message.id, label: "New" };
    if (message.kind === "release")
      return { kind: "card", id: message.id, content: <ReleaseCard release={message.release} /> };
    return {
      kind: "card",
      id: message.id,
      content: (
        <DiscordRow>
          Found a bug? Obviously. Tell me what happened in <span className="font-semibold">Slurp General</span>.
        </DiscordRow>
      ),
    };
  });
  if (consented) items.push({ kind: "bubble", id: "handoff", text: G_HANDOFF });

  const chips: SlpChatChip[] = consenting
    ? [
        {
          id: "consent",
          label: "I get it: alpha, my own risk",
          primary: true,
          onSelect: () => {
            markSeen();
            setConsented(true);
          },
        },
        ...(onLeave ? [{ id: "leave", label: "Leave Slurp", onSelect: onLeave }] : []),
      ]
    : mode === "welcome"
      ? []
      : [{ id: "got-it", label: "Got it", primary: true, onSelect: finish }];

  return (
    <Modal
      open={open}
      // Consent has a real way out: the X and Escape leave Slurp, like the age gate.
      onClose={close}
      title={`Slurp ${SLURP2_VERSION}`}
      width="max-w-lg"
      mobileFullscreen
      // The chat shell draws its own header (G, the version, the X), so the Modal's is hidden.
      panelClassName="sm:h-[min(44rem,90dvh)] [&>div:first-child]:hidden"
      contentClassName="flex flex-col !overflow-hidden !p-0"
      panelStyle={getSlpAccentStyle(SLP_PINK)}
      closeDisabled={consenting && !onLeave}
    >
      <div data-component="SlurpSplash" className="flex min-h-0 flex-1 flex-col">
        <SlpChatShell
          host={G_HOST}
          status={`Slurp ${SLURP2_VERSION}`}
          headerEnd={
            consenting && !onLeave ? null : (
              <button
                type="button"
                onClick={close}
                aria-label={consenting ? "Leave Slurp" : "Close"}
                className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--slurp-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none [&_svg]:!text-current"
              >
                <X size={20} aria-hidden="true" />
              </button>
            )
          }
          items={items}
          chips={chips}
          chipsLabel="Reply to G"
          pace={mode === "welcome" ? G_PACE_MS : 0}
          scrollTo={thread.scrollTo}
          composer={{
            placeholder: "G can’t read this. Find me in Slurp General.",
            link: {
              href: SLP_DISCORD_BUG_URL,
              label: "Slurp General on Discord. Opens in a new tab.",
              icon: <DiscordMark />,
            },
          }}
          labels={{ log: "Chat with G", typing: "G is typing…" }}
        />
      </div>
    </Modal>
  );
}

/** The top of the thread: G himself, as big as the old splash had him. */
function GIntro() {
  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center sm:h-32 sm:w-32">
      <span
        aria-hidden="true"
        className="absolute inset-2 rounded-full bg-[var(--noodle-accent)]/15 shadow-[0_0_32px_color-mix(in_srgb,var(--noodle-accent)_20%,transparent)]"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 28 44"
        className="absolute -left-2 top-1/2 h-10 w-7 -translate-y-1/2 overflow-visible text-[var(--noodle-accent-foreground)] sm:-left-3 sm:h-12 sm:w-8"
      >
        <path
          d="M22 4 13 0M18 22H4m18 18-9 4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
      <img
        src={GUNTERLIE_AVATAR_SRC}
        alt=""
        className="relative h-[118%] w-[118%] translate-x-2 rotate-6 object-contain sm:translate-x-3"
      />
    </div>
  );
}

function DiscordRow({ children }: { children: ReactNode }) {
  return (
    <a
      href={SLP_DISCORD_BUG_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        SLP_TYPE.body,
        "flex min-h-11 items-center gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-2.5 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]",
      )}
    >
      <DiscordMark />
      <span className="min-w-0 flex-1 text-pretty">
        {children}
        <span className="sr-only"> Opens in a new tab.</span>
      </span>
      <ExternalLink size={16} aria-hidden="true" className="shrink-0 text-[var(--slurp-muted)]" />
    </a>
  );
}

function releaseDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** One release as a message from G: version, date, and its notes. */
function ReleaseCard({ release }: { release: Slurp2ReleaseEntry }) {
  return (
    <section className="rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-3 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
      <h3 className={cn(SLP_TYPE.title, "flex flex-wrap items-baseline gap-x-2")}>
        Slurp {release.version}
        <span className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{releaseDate(release.date)}</span>
      </h3>
      <ul className={cn(SLP_TYPE.body, "mt-1.5 list-disc space-y-1.5 ps-5 marker:text-[var(--noodle-accent)]")}>
        {release.notes.map((note) => (
          <li key={note} className="text-pretty">
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
}
