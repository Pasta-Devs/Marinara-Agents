// The first thing Slurp shows after an install and after every update. It appears ahead of the age gate and
// the "what is Slurp" explainer. It is the alpha warning, in Gunterlie's own words, plus the notes
// for the versions the user has not seen yet and an approval the user has to tick.
import { AlertTriangle, ChevronDown, ExternalLink, Wrench } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useCallback, useEffect, useRef, useState } from "react";
import { GUNTERLIE_AVATAR_SRC } from "./slurp-gunterlie-avatar";
import { getNoodleAccentStyle, NOODLE_PINK } from "./SlurpShell";
import { getSlurp2UnseenReleases, SLURP2_VERSION } from "./slurp2-release";

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

/** True when the splash is due: a fresh install, or an update since it was last acknowledged.
 *  Callers hold this as state so the gate behind the splash stays shut until it is dismissed. */
export function slurp2SplashPending(): boolean {
  return readSeenVersion() !== SLURP2_VERSION;
}

/** Only English copy: this is the author speaking, and the notes mirror CHANGELOG.md, which is
 *  English only too. */
export function SlurpSplash({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const [approved, setApproved] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const topRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // The avatar must be the first thing users see. Keep the modal content at the top after the
  // modal focus cycle and after the avatar loads, because either operation can change scroll state.
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
  const seen = readSeenVersion();
  const unseen = getSlurp2UnseenReleases(seen);
  const featuredRelease = unseen[0];
  const earlierReleases = unseen.slice(1);

  const dismiss = () => {
    if (!approved) return;
    try {
      window.localStorage.setItem(SEEN_KEY, SLURP2_VERSION);
    } catch {
      // Nothing to do. The splash simply returns next time.
    }
    onDismiss();
  };

  return (
    <Modal
      open={open}
      onClose={() => undefined}
      title={`Slurp ${SLURP2_VERSION}`}
      width="max-w-2xl"
      contentRef={contentRef}
      // This is a required acknowledgement screen. Hide the disabled close control instead of
      // passing a prop the shared Modal does not support.
      panelClassName="[&>div:first-child>button]:hidden"
      panelStyle={getNoodleAccentStyle(NOODLE_PINK)}
      closeDisabled
    >
      <div data-component="SlurpSplash" className="flex flex-col gap-4">
        <div
          ref={topRef}
          tabIndex={-1}
          className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 overflow-hidden outline-none sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-5"
        >
          <div className="min-w-0">
            <p className="text-2xl font-black leading-tight sm:text-3xl">Hey, I’m G.</p>
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
              className="absolute -left-2 top-1/2 h-10 w-7 -translate-y-1/2 overflow-visible text-[var(--noodle-accent)] sm:-left-3 sm:h-12 sm:w-8"
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

        <p className="text-sm leading-6">
          You’re testing <span className="font-black uppercase">alpha</span> software. It’s unfinished, occasionally
          feral, and absolutely full of bugs.
        </p>

        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-6">
          <AlertTriangle size={18} aria-hidden="true" className="mt-1 shrink-0 text-amber-500" />
          <span>
            Slurp can use text and image models without always asking first. One click may cost more than you expect.
          </span>
        </div>

        <a
          href="https://discord.com/channels/1417099416812392641/1539355721853046926"
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-2 text-sm leading-5 transition-[background-color,border-color] hover:border-[var(--noodle-accent)]/45 hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        >
          <DiscordMark />
          <span>
            Found a bug? Obviously. Tell me what happened in <span className="font-semibold">Slurp General</span>.
            <span className="sr-only"> Opens in a new tab.</span>
          </span>
          <ExternalLink size={15} aria-hidden="true" className="ms-auto shrink-0 text-[var(--muted-foreground)]" />
        </a>

        {featuredRelease && (
          <div className="rounded-lg border border-[var(--border)] px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-black">
              <Wrench size={15} aria-hidden="true" className="text-[var(--muted-foreground)]" />
              What changed
            </h3>
            <div className="mt-1 max-h-64 overflow-y-auto pe-1">
              <section className="mt-2">
                <p className="text-sm font-semibold">
                  {featuredRelease.version}{" "}
                  <span className="text-[var(--muted-foreground)]">({featuredRelease.date})</span>
                </p>
                <ul className="mt-1 list-disc space-y-1 ps-5 text-sm leading-6">
                  {featuredRelease.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </section>

              {earlierReleases.length > 0 && (
                <>
                  <button
                    type="button"
                    aria-expanded={historyExpanded}
                    aria-controls="slurp2-earlier-releases"
                    onClick={() => setHistoryExpanded((expanded) => !expanded)}
                    className="mt-3 flex min-h-11 w-full items-center gap-2 border-t border-[var(--border)] pt-2 text-start text-sm font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
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
                      <section key={release.version} className="mt-3">
                        <p className="text-sm font-semibold">
                          {release.version} <span className="text-[var(--muted-foreground)]">({release.date})</span>
                        </p>
                        <ul className="mt-1 list-disc space-y-1 ps-5 text-sm leading-6">
                          {release.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm leading-5">
          <input
            type="checkbox"
            checked={approved}
            onChange={(event) => setApproved(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--noodle-accent)]"
          />
          <span>I understand this is alpha software and I use it at my own risk.</span>
        </label>

        <button
          type="button"
          onClick={dismiss}
          disabled={!approved}
          className="h-12 rounded-lg bg-[var(--noodle-accent)] text-base font-black uppercase tracking-wide text-zinc-950 transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          Let me in
        </button>
      </div>
    </Modal>
  );
}
