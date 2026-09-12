// The first thing Slurp shows after an install and after every update. It appears ahead of the age gate and
// the "what is Slurp" explainer. It is the alpha warning, in Gunterlie's own words, plus the notes
// for the versions the user has not seen yet and an approval the user has to tick.
import { AlertTriangle, Ban, MessageCircle, Wrench } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useCallback, useEffect, useRef, useState } from "react";
import { GUNTERLIE_AVATAR_SRC } from "./slurp-gunterlie-avatar";
import { SLURP2_RELEASES, SLURP2_VERSION } from "./slurp2-release";

// Per browser, not per Engine: the splash is a notice, not a setting, and a localStorage key keeps
// it off the server and off the migration path.
const SEEN_KEY = "slurp2:splash-seen-version";

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

const BROKEN = [
  "Settings. Half of them do nothing, the other half do something you did not ask for.",
  "Ads. They do not work. Garnish is in here, it just sits there.",
  "Defaults. Whatever you land on is not what I would have picked, I just have not picked yet.",
  "The looks. Yes. I know. It is ugly in places and I saw it before you did.",
  "Everything else. Assume it is on this list even if I forgot to type it.",
];

/** Only English copy: this is the author speaking, and the notes mirror CHANGELOG.md, which is
 *  English only too. */
export function SlurpSplash({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const [approved, setApproved] = useState(false);
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
  // Everything newer than what was last acknowledged. A fresh install has nothing acknowledged, and
  // an acknowledged version that has rolled off the list is no better than none, so both show the
  // full history rather than silently dropping the newest entry to a -1 index.
  const seenIndex = seen === null ? -1 : SLURP2_RELEASES.findIndex((release) => release.version === seen);
  const unseen = seenIndex === -1 ? SLURP2_RELEASES : SLURP2_RELEASES.slice(0, seenIndex);

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
      closeDisabled
    >
      <div data-component="SlurpSplash" className="flex flex-col gap-6">
        <div ref={topRef} tabIndex={-1} className="flex flex-col items-center gap-3 outline-none">
          <img src={GUNTERLIE_AVATAR_SRC} alt="Gunterlie" onLoad={scrollToTop} className="h-56 w-56 object-contain" />
          <p className="text-center text-lg font-black leading-7">
            Hey, I am G.
            <span className="block text-base">The Dude who is responsible for all the bugs.</span>
          </p>
        </div>

        <p className="text-center text-sm leading-6">
          You are testing <span className="font-black uppercase">alpha</span> software here. Nothing is finished, and
          nothing is bug-free. If I am honest: it is a bugfest. This build exists so I do not have to keep two codebases
          alive at once. You get the rebuild early, and I get to stop copying fixes back and forth.
        </p>

        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-6">
          <AlertTriangle size={18} className="mt-1 shrink-0 text-amber-500" />
          <span>
            Heavy image and text model use, and not always announced. A single click can spend more than you expect. The
            defaults are not sensible yet.
            <span className="mt-1 block font-black uppercase tracking-wide">Use at your own risk.</span>
          </span>
        </div>

        <div className="rounded-lg border border-[var(--border)] px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-black">
            <Ban size={15} className="text-[var(--muted-foreground)]" />
            Everything that is not really working
          </h3>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Short version: all of it. Long version:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
            {BROKEN.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm leading-6">
          <MessageCircle size={16} className="mt-1 shrink-0 text-[var(--noodle-accent)]" />
          <span>
            Found one? Of course you did. Leave bug reports and feature ideas in the Discord thread called{" "}
            <span className="font-semibold">Slurp General</span>. Tell me what you did and what happened instead. That
            is the whole ritual, no template.
          </span>
        </div>

        {unseen.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-black">
              <Wrench size={15} className="text-[var(--muted-foreground)]" />
              What changed
            </h3>
            <div className="mt-1 max-h-64 overflow-y-auto pr-1">
              {unseen.map((release) => (
                <section key={release.version} className="mt-2">
                  <p className="text-sm font-semibold">
                    {release.version} <span className="text-[var(--muted-foreground)]">({release.date})</span>
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6">
                    {release.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </section>
              ))}
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
          <span>I understand this is alpha software, I use it at my own risk, and the bugs are not a surprise.</span>
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
