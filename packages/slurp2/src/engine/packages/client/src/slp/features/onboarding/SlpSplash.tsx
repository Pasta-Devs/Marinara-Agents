// The first thing Slurp shows after an install and after an update. It appears ahead of the age gate and
// the "what is Slurp" explainer. Consent happens once: a first install gets the welcome in Gunterlie's
// own words (alpha + the AI cost note) and an approval to tick; an update only gets a dismissible
// "What's new" sheet with the notes the player has not seen yet.
import { AlertTriangle, ChevronDown, ExternalLink, X } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { GUNTERLIE_AVATAR_SRC } from "../../base/chrome/slp-gunterlie-avatar";
import { getSlpAccentStyle, SLP_PINK, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpButton, SlpPrimaryButton, SlpSquareCheck } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { getSlurp2UnseenReleases, SLURP2_VERSION, slurp2SplashKind, type Slurp2ReleaseEntry } from "./slp-release";

// Per browser, not per Engine: the splash is a notice, not a setting, and a localStorage key keeps
// it off the server and off the migration path.
const SEEN_KEY = "slurp2:splash-seen-version";

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

/** Only English copy: this is the author speaking, and the notes mirror CHANGELOG.md, which is
 *  English only too. */
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
  // Read once: the kind must not flip while the splash is closing after it was acknowledged.
  const [seen] = useState(readSeenVersion);
  const kind = slurp2SplashKind(seen);
  const dismiss = () => {
    markSeen();
    onDismiss();
  };
  if (kind === "whats-new") return <SlurpWhatsNew open={open} seen={seen} onDismiss={dismiss} />;
  return <SlurpWelcome open={open} onDismiss={dismiss} onLeave={onLeave} />;
}

function SlurpWelcome({ open, onDismiss, onLeave }: { open: boolean; onDismiss: () => void; onLeave?: () => void }) {
  const [approved, setApproved] = useState(false);
  const topRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // The avatar must be the first thing users see. Keep the modal content at the top after the
  // modal focus cycle and after the avatar loads, because either operation can change scroll state.
  // Focus lands on the heading (not the Discord link), so a pointer open shows no focus ring.
  const scrollToTop = useCallback(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, []);
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      topRef.current?.focus({ preventScroll: true });
      scrollToTop();
      window.requestAnimationFrame(scrollToTop);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, scrollToTop]);

  const dismiss = () => {
    if (!approved) return;
    onDismiss();
  };

  return (
    <Modal
      open={open}
      // The X and Escape mean Leave Slurp, like the age gate: consent has a real way out.
      onClose={() => leaveUnlessBackdrop(onLeave)}
      title={`Slurp ${SLURP2_VERSION}`}
      width="max-w-2xl"
      contentRef={contentRef}
      panelStyle={getSlpAccentStyle(SLP_PINK)}
      closeDisabled={!onLeave}
    >
      <div data-component="SlurpSplash" className="flex flex-col gap-4 text-[var(--slurp-text)]">
        <div
          ref={topRef}
          tabIndex={-1}
          data-autofocus
          className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 overflow-hidden outline-none sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-5"
        >
          <div className="min-w-0">
            <h2 className="text-2xl font-black leading-tight sm:text-3xl">Hey, I’m G.</h2>
            <p className="mt-1 text-sm leading-5 text-[var(--muted-foreground)] sm:text-base sm:leading-6">
              The dude responsible for all the bugs.
            </p>
          </div>
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
              onLoad={scrollToTop}
              className="relative h-[118%] w-[118%] translate-x-2 rotate-6 object-contain sm:translate-x-3"
            />
          </div>
        </div>

        <p className={cn(SLP_TYPE.body, "text-pretty")}>
          You’re testing <span className="font-bold">alpha</span>
          {" software. It’s unfinished, occasionally feral, and absolutely full of bugs."}
        </p>

        <div
          className={cn(
            SLP_TYPE.body,
            "flex items-start gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--slurp-warning)_12%,var(--slurp-surface-raised))] px-4 py-3 shadow-[var(--slurp-highlight)]",
          )}
        >
          <AlertTriangle size={18} aria-hidden="true" className="mt-px shrink-0 text-[var(--slurp-warning)]" />
          <span className="text-pretty">
            Heads up: Slurp calls your text and image models on its own, and one tap can call them more than once. Your
            provider may bill every call.
          </span>
        </div>

        <DiscordRow>
          Found a bug? Obviously. Tell me what happened in <span className="font-semibold">Slurp General</span>.
        </DiscordRow>

        <label
          className={cn(
            SLP_TYPE.body,
            "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-3 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--slurp-focus)]",
          )}
        >
          <input
            type="checkbox"
            checked={approved}
            onChange={(event) => setApproved(event.target.checked)}
            className="sr-only"
          />
          <SlpSquareCheck checked={approved} />
          <span className="text-pretty">I understand this is alpha software and I use it at my own risk.</span>
        </label>

        <div className="flex flex-col items-stretch gap-1">
          <SlpPrimaryButton onClick={dismiss} disabled={!approved} className="h-12 text-[15px]">
            Let me in
          </SlpPrimaryButton>
          <p aria-live="polite" className={cn(SLP_TYPE.meta, "min-h-4 text-center text-[var(--slurp-muted)]")}>
            {approved ? "" : "Tick the box above to get in."}
          </p>
          {onLeave && (
            <SlpButton variant="tertiary" onClick={onLeave} className="self-center text-[var(--slurp-muted)]">
              Leave Slurp
            </SlpButton>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DiscordRow({ children }: { children: ReactNode }) {
  return (
    <a
      href="https://discord.com/channels/1417099416812392641/1539355721853046926"
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

function ReleaseNotes({ release }: { release: Slurp2ReleaseEntry }) {
  return (
    <ul className={cn(SLP_TYPE.body, "list-disc space-y-1.5 ps-5 marker:text-[var(--noodle-accent)]")}>
      {release.notes.map((note) => (
        <li key={note} className="text-pretty">
          {note}
        </li>
      ))}
    </ul>
  );
}

function releaseDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** After an update: what is new since the version this browser last saw. No checkbox, one scroll container. */
function SlurpWhatsNew({ open, seen, onDismiss }: { open: boolean; seen: string | null; onDismiss: () => void }) {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const unseen = getSlurp2UnseenReleases(seen);
  const featuredRelease = unseen[0];
  const earlierReleases = unseen.slice(1);
  return (
    <SlpSheet
      open={open}
      onClose={onDismiss}
      title={`What's new in ${SLURP2_VERSION}`}
      width="max-w-lg"
      headerAccessory={
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="-me-2 grid size-10 shrink-0 place-items-center rounded-full text-[var(--slurp-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-current"
        >
          <X size={20} aria-hidden="true" />
        </button>
      }
      footer={
        <SlpPrimaryButton onClick={onDismiss} className="w-full">
          Got it
        </SlpPrimaryButton>
      }
    >
      <div data-component="SlurpSplash" className="flex flex-col gap-4 px-3 pb-2">
        <section
          className="overflow-hidden rounded-2xl p-4 shadow-[var(--slurp-highlight)]"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--noodle-accent) 14%, var(--slurp-surface-raised)), var(--slurp-surface-raised))",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center sm:h-32 sm:w-32">
              <span
                aria-hidden="true"
                className="absolute inset-2 rounded-full bg-[var(--noodle-accent)]/15 shadow-[0_0_32px_color-mix(in_srgb,var(--noodle-accent)_20%,transparent)]"
              />
              <img src={GUNTERLIE_AVATAR_SRC} alt="" className="relative h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-black leading-tight sm:text-3xl">Hey, I’m G.</h2>
              <p className={cn(SLP_TYPE.body, "mt-1 text-pretty text-[var(--slurp-muted)]")}>
                The dude responsible for all the bugs.
              </p>
            </div>
          </div>
          <p className={cn(SLP_TYPE.body, "mt-3 border-t border-[var(--noodle-divider)] pt-3 text-pretty")}>
            You’re testing <span className="font-bold">alpha</span> software. It’s unfinished, occasionally feral, and
            absolutely full of bugs.
          </p>
        </section>
        {featuredRelease && (
          <section>
            <h3
              tabIndex={-1}
              data-autofocus
              className={cn(SLP_TYPE.meta, "pb-2 text-[var(--slurp-muted)] outline-none")}
            >
              {featuredRelease.version} · {releaseDate(featuredRelease.date)}
            </h3>
            <ReleaseNotes release={featuredRelease} />
          </section>
        )}

        {earlierReleases.length > 0 && (
          <div>
            <button
              type="button"
              aria-expanded={historyExpanded}
              aria-controls="slurp2-earlier-releases"
              onClick={() => setHistoryExpanded((expanded) => !expanded)}
              className={cn(
                SLP_TYPE.body,
                "flex min-h-11 w-full items-center gap-2 rounded-xl px-1 text-start font-semibold text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]",
              )}
            >
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`shrink-0 transition-transform motion-reduce:transition-none ${historyExpanded ? "rotate-180" : ""}`}
              />
              {historyExpanded
                ? "Hide earlier releases"
                : `Show ${earlierReleases.length} earlier release${earlierReleases.length === 1 ? "" : "s"}`}
            </button>
            <div id="slurp2-earlier-releases" hidden={!historyExpanded}>
              {earlierReleases.map((release) => (
                <section key={release.version} className="pb-3">
                  {/* Sticky inside the one scroll container, so scrolled notes keep their version. */}
                  <h3
                    className={cn(
                      SLP_TYPE.meta,
                      "sticky top-0 z-[1] -mx-1 bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface))] px-1 py-2 font-semibold",
                    )}
                  >
                    {release.version}{" "}
                    <span className="font-medium text-[var(--slurp-muted)]">· {releaseDate(release.date)}</span>
                  </h3>
                  <ReleaseNotes release={release} />
                </section>
              ))}
            </div>
          </div>
        )}

        <p className={cn(SLP_TYPE.meta, "flex items-start gap-2 text-pretty text-[var(--slurp-muted)]")}>
          <AlertTriangle size={16} aria-hidden="true" className="mt-px shrink-0 text-[var(--slurp-warning)]" />
          Keep in mind: Slurp uses image and text generation in the background. Be sure you can afford that.
        </p>

        <DiscordRow>
          Found a bug? Tell me in <span className="font-semibold">Slurp General</span>.
        </DiscordRow>
      </div>
    </SlpSheet>
  );
}
