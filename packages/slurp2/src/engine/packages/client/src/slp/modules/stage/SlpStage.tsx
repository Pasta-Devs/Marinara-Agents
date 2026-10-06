// The stage for scripted first-run scenes (docs/OPENING-DAY.md): a header with the host, the scene and
// its progress; a stage that shows one object per scene; and the talk, where the host's lines arrive
// one at a time with steam for typing dots, the player's replies show as small pills, and big answer
// cards sit in the thumb zone. Phones: stage on top, talk below. Wide screens: side by side. Props in.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { slpPrefersReducedMotion } from "../../base/chrome/slp-motion";
import { SlpChoiceCards, type SlpChoice, type SlpChoiceLayout } from "./SlpChoiceCards";

export type SlpStageLine = {
  id: string;
  text: ReactNode;
  /** "host": a line in the display face; "aside": a smaller muted line; "mine": the player's reply. */
  kind: "host" | "aside" | "mine";
  /** An earlier line of this scene: dimmed, so the newest one leads. */
  old?: boolean;
};

export function SlpStage({
  host,
  scene,
  progress,
  headerEnd,
  stage,
  stageKey,
  stageOverlay,
  actions,
  lines,
  history = 0,
  cards,
  pace = 0,
  labels,
}: {
  /** The host's mark (the Slurp bowl, G's face) and name. */
  host: { mark: ReactNode; name: string };
  /** The scene's name under the host name ("Opening day"). */
  scene: string;
  progress: { current: number; total: number; label: string };
  /** The end of the header (the close button). */
  headerEnd?: ReactNode;
  stage: ReactNode;
  /** A new key plays the stage's entrance; keep it while the object stays (the phone). */
  stageKey: string;
  /** Floating effects over the stage (hearts, callouts). Decorative. */
  stageOverlay?: ReactNode;
  /** Small actions above the talk ("Skip to the questions"). */
  actions?: ReactNode;
  lines: readonly SlpStageLine[];
  /** The first lines arrive at once (a resumed scene); the rest are paced. */
  history?: number;
  cards?: { choices: readonly SlpChoice[]; layout?: SlpChoiceLayout; label: string; onSelect: (id: string) => void };
  /** Milliseconds of steam before each host line; 0 or reduced motion shows everything at once. */
  pace?: number;
  labels: { log: string; typing: string };
}) {
  const paced = pace > 0 && !slpPrefersReducedMotion();
  const [shown, setShown] = useState(() => (paced ? history : lines.length));
  // A scene that rewinds (a Change) must not skip the pause on its new lines.
  if (paced && shown > lines.length) setShown(lines.length);
  else if (paced && shown < Math.min(history, lines.length)) setShown(Math.min(history, lines.length));
  const visible = paced ? Math.min(shown, lines.length) : lines.length;
  const pending = lines[visible];
  const typing = pending !== undefined && pending.kind !== "mine";
  useEffect(() => {
    if (!paced || visible >= lines.length) return;
    const delay = typing ? Math.min(1000, pace + (typeof pending?.text === "string" ? pending.text.length * 8 : 0)) : 0;
    const timer = window.setTimeout(() => setShown(visible + 1), delay);
    return () => window.clearTimeout(timer);
  }, [paced, pace, visible, lines.length, typing, pending]);

  const talkRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const talk = talkRef.current;
    if (talk) talk.scrollTo({ top: talk.scrollHeight, behavior: paced ? "smooth" : "auto" });
  }, [visible, paced]);

  const ready = visible === lines.length;
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col text-[var(--slurp-text)] [background:radial-gradient(110%_55%_at_50%_0%,color-mix(in_srgb,var(--noodle-accent)_14%,transparent),transparent_62%),var(--slurp-surface)]">
      <style>{SLP_STAGE_STYLES}</style>
      <header className="flex min-h-14 shrink-0 items-center gap-2.5 pb-1.5 pe-2 ps-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <span aria-hidden="true" className="flex h-7 w-10 shrink-0 items-center justify-center">
          {host.mark}
        </span>
        <span className="min-w-0">
          <h2 tabIndex={-1} data-autofocus className="slp-display truncate text-[17px] leading-5 outline-none">
            {host.name}
          </h2>
          <span className="block truncate text-xs font-semibold leading-4 text-[var(--slurp-muted)]">{scene}</span>
        </span>
        <span
          role="progressbar"
          aria-label={progress.label}
          aria-valuemin={1}
          aria-valuemax={progress.total}
          aria-valuenow={progress.current}
          className="ms-auto flex shrink-0 gap-1.5 pe-1"
        >
          {Array.from({ length: progress.total }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-[5px] rounded-full transition-[width,background-color] duration-300 ease-[var(--slurp-ease)] motion-reduce:transition-none",
                index + 1 === progress.current ? "w-7 bg-[var(--noodle-accent)]" : "w-[18px]",
                index + 1 < progress.current && "bg-[var(--noodle-accent)]",
                index + 1 > progress.current && "bg-[color-mix(in_srgb,var(--slurp-text)_14%,transparent)]",
              )}
            />
          ))}
        </span>
        {headerEnd}
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,52fr)_minmax(0,48fr)] md:mx-auto md:w-full md:max-w-[1120px] md:grid-cols-2 md:grid-rows-1">
        <section className="relative grid min-h-0 place-items-center overflow-hidden [perspective:1200px]">
          <div key={stageKey} className="slp-stage-in absolute inset-0 flex flex-col items-center justify-center gap-3.5 px-4 py-2">
            {stage}
          </div>
          {stageOverlay}
        </section>

        <section className="flex min-h-0 flex-col px-[18px] pb-[max(0.875rem,env(safe-area-inset-bottom))] md:justify-center md:px-10 md:pb-10">
          {actions && <div className="flex shrink-0 justify-end">{actions}</div>}
          <div
            ref={talkRef}
            role="log"
            aria-live="polite"
            aria-label={labels.log}
            className="flex min-h-0 flex-col gap-2 overflow-y-auto pt-5 [mask-image:linear-gradient(transparent,#000_22px)] md:max-h-[46dvh]"
          >
            {lines.slice(0, visible).map((line) =>
              line.kind === "mine" ? (
                <p
                  key={line.id}
                  className="slp-line-mine max-w-[80%] self-end rounded-[18px_18px_4px_18px] bg-[var(--noodle-accent)] px-3.5 py-1.5 text-[14.5px] font-bold leading-5 text-[var(--slurp-on-accent)] [&_svg]:!text-current"
                >
                  {line.text}
                </p>
              ) : (
                <p
                  key={line.id}
                  className={cn(
                    "slp-line max-w-[34ch] text-pretty transition-opacity duration-300 motion-reduce:transition-none",
                    line.kind === "host"
                      ? "slp-display text-[clamp(19px,2.2vw,25px)] leading-[1.22]"
                      : "text-[15.5px] leading-[1.45] text-[var(--slurp-muted)]",
                    line.old && "opacity-40",
                  )}
                >
                  {line.text}
                </p>
              ),
            )}
          </div>
          <p
            aria-hidden={!(paced && typing)}
            className={cn(
              "flex h-6 shrink-0 items-center gap-2 text-[13px] text-[var(--slurp-muted)] transition-opacity duration-200",
              paced && typing ? "opacity-100" : "opacity-0",
            )}
          >
            <span aria-hidden="true" className="relative h-[18px] w-[22px]">
              {[0, 1, 2].map((dot) => (
                <i
                  key={dot}
                  className="slp-steam absolute bottom-0 h-3.5 w-[3px] rounded-[3px] bg-[var(--noodle-accent)]"
                  style={{ left: 3 + dot * 7, animationDelay: `${dot * 250}ms` }}
                />
              ))}
            </span>
            {labels.typing}
          </p>
          <div className="mt-auto shrink-0 pt-3 md:mt-4">
            {cards && ready && (
              <SlpChoiceCards
                key={cards.label + cards.choices.map((choice) => choice.id).join()}
                choices={cards.choices}
                layout={cards.layout}
                label={cards.label}
                onSelect={cards.onSelect}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// Entrances only; nothing loops but the steam while the host types. All of it is off with reduced motion.
const SLP_STAGE_STYLES = `
@keyframes slp-stage-in { from { opacity: 0; transform: translateY(26px) scale(.97); } }
@keyframes slp-line-in { from { opacity: 0; transform: translateY(14px) scale(.94); } }
@keyframes slp-choice-in { from { opacity: 0; transform: translateY(18px) scale(.96); } }
@keyframes slp-steam { 0% { opacity: 0; transform: translateY(4px) scaleY(.4); } 40% { opacity: .9; } 100% { opacity: 0; transform: translateY(-8px) skewX(-12deg); } }
.slp-stage-in { animation: slp-stage-in .6s cubic-bezier(.22,1,.36,1) both; }
.slp-line { transform-origin: 0 100%; animation: slp-line-in .55s cubic-bezier(.34,1.56,.64,1) both; }
.slp-line-mine { transform-origin: 100% 100%; animation: slp-line-in .45s cubic-bezier(.34,1.56,.64,1) both; }
.slp-choice-in { animation: slp-choice-in .45s cubic-bezier(.34,1.56,.64,1) both; }
.slp-steam { opacity: 0; animation: slp-steam 1.1s ease-in-out infinite; }
@keyframes slp-bob { 50% { transform: translateY(-6px) rotate(-2deg); } }
.slp-bob { animation: slp-bob 3.2s ease-in-out infinite; }
@keyframes slp-float { from { opacity: 0; transform: translateY(20px) scale(.6); } 20% { opacity: 1; } to { opacity: 0; transform: translateY(-170px) scale(1.15); } }
.slp-float { opacity: 0; animation: slp-float 2.2s ease-in both; }
@media (prefers-reduced-motion: reduce) {
  .slp-stage-in, .slp-line, .slp-line-mine, .slp-choice-in, .slp-steam, .slp-bob { animation: none; }
  .slp-float { display: none; }
}
`;

/** Hearts, comments and coins floating up over the stage once (the fans arriving). Decorative. */
export function SlpStageFloaters({ glyphs }: { glyphs: readonly string[] }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
      {glyphs.map((glyph, index) => (
        <span
          key={index}
          className="slp-float absolute bottom-[28%] text-lg"
          style={{ left: `${22 + ((index * 37) % 52)}%`, animationDelay: `${index * 180}ms` }}
        >
          {glyph}
        </span>
      ))}
    </div>
  );
}
