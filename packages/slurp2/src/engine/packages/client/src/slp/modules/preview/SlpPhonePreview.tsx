// ──────────────────────────────────────────────
// Opening day (docs/OPENING-DAY.md): the owner's Slurp as a small phone on the stage. Props in;
// every answer changes it at once, with a glow on what changed and a callout. Decorative
// (aria-hidden) except Mari's Unlock button: the talk announces the changes.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MessageCircle, Moon } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import {
  SlpDiscoverGlyph,
  SlpHeartGlyph,
  SlpHubGlyph,
  SlpInboxGlyph,
  SlpLockGlyph,
  SlpStirGlyph,
} from "../../base/chrome/SlpGlyphs";
import { SLURP_LOGO_SRC } from "../../base/chrome/slp-logo";
import { slpPrefersReducedMotion } from "../../base/chrome/slp-motion";
import { initials } from "../../base/chrome/slp-initials";
import {
  SLP_PHONE_REGIONS,
  slpPhoneCreatorNameKey,
  slpPhonePreview,
  type SlpPhonePost,
  type SlpPhonePreviewInput,
  type SlpPhoneRegion,
} from "./slp-phone-preview";

const MARI_AVATAR = "/sprites/mari/chibi-professor-mari.png";
const MARI_LOCKED = "/sprites/mari/Mari_noodler_teaser_locked.webp";
const MARI_UNLOCKED = "/sprites/mari/Mari_noodler_teaser_unlocked.webp";
const BOWL: CSSProperties = {
  WebkitMask: `url("${SLURP_LOGO_SRC}") center / contain no-repeat`,
  mask: `url("${SLURP_LOGO_SRC}") center / contain no-repeat`,
};

export type SlpPhonePreviewProps = {
  input: SlpPhonePreviewInput;
  doors?: "none" | "shut" | "open";
  /** An answer key (`pace`, `spice`, …). When it changes, its region glows and `callout` shows. A `:n` suffix replays the same key. */
  changed?: string | null;
  /** Already localized. */
  callout?: string | null;
  onUnlock?: () => void;
  className?: string;
};

export function SlpPhonePreview({
  input,
  doors = "none",
  changed = null,
  callout = null,
  onUnlock,
  className,
}: SlpPhonePreviewProps) {
  const { t: localizeUi } = useUiTranslation();
  const view = slpPhonePreview(input);
  const screenRef = useRef<HTMLDivElement>(null);
  const [shownCallout, setShownCallout] = useState<{ text: string; n: number } | null>(null);
  const k = (key: string, options?: Record<string, unknown>) => localizeUi(key, options);
  const name = (creator: number) => k(slpPhoneCreatorNameKey(creator, input.names));
  const number = (value: number) =>
    new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const region = (r: SlpPhoneRegion) => ({ "data-slp-region": r });

  useEffect(() => {
    if (!changed) return;
    const target = SLP_PHONE_REGIONS[changed.split(":")[0]!];
    if (target && !slpPrefersReducedMotion())
      for (const el of screenRef.current?.querySelectorAll(`[data-slp-region="${target}"]`) ?? [])
        el.animate(target === "feed" || target === "footer" ? GLOW_INSET : GLOW, {
          duration: 1100,
          easing: "cubic-bezier(.22, 1, .36, 1)",
        });
    if (!callout) return;
    setShownCallout((prev) => ({ text: callout, n: (prev?.n ?? 0) + 1 }));
    const timer = setTimeout(() => setShownCallout(null), 1700);
    return () => clearTimeout(timer);
  }, [changed, callout]);

  const renderPost = (post: SlpPhonePost) => {
    const own = post.creator === 0;
    const pictureSrc = own ? (post.locked ? MARI_LOCKED : MARI_UNLOCKED) : null;
    const unlock = post.locked && (
      <button
        type="button"
        className="slp-phone-unlock"
        onClick={onUnlock}
        aria-label={k("ui.slurp.opening.preview.unlockLabel", { name: name(post.creator) })}
      >
        {k("ui.slurp.opening.preview.unlock")}
      </button>
    );
    return (
      <div key={`post-${post.creator}`} className="slp-phone-card slp-phone-in">
        <div className="slp-phone-head" aria-hidden="true">
          <span
            className="slp-phone-av"
            data-art={post.creator}
            style={own ? { backgroundImage: `url(${MARI_AVATAR})` } : undefined}
          >
            {own ? null : initials(name(post.creator))}
          </span>
          <b {...region("names")}>{name(post.creator)}</b>
          <span className="slp-phone-age">
            {post.ageHours === 0
              ? k("ui.slurp.opening.preview.now")
              : k("ui.slurp.opening.preview.hours", { count: post.ageHours })}
          </span>
          {post.locked && (
            <em className="slp-phone-lock">
              <SlpLockGlyph size="1.1em" strokeWidth={2} />
              {k("ui.slurp.opening.preview.locked")}
            </em>
          )}
        </div>
        {post.picture ? (
          <div className={cn("slp-phone-pic", post.locked && "is-locked")} data-blur={post.blur} {...region("picture")}>
            <div
              className="slp-phone-img"
              data-art={post.creator}
              aria-hidden="true"
              style={pictureSrc ? { backgroundImage: `url(${pictureSrc})` } : undefined}
            />
            {unlock}
          </div>
        ) : (
          unlock && <div className="slp-phone-textlock">{unlock}</div>
        )}
        <div aria-hidden="true">
          <p className={cn("slp-phone-cap", post.locked && !post.picture && "is-hidden")} {...region("caption")}>
            {k(post.captionKey)}
          </p>
          {post.comment && (
            <p className="slp-phone-cmt" {...region("comment")}>
              <b>{k(post.comment.nameKey)}</b> {k(post.comment.textKey)}
            </p>
          )}
          <div className="slp-phone-meta">
            <span {...region("likes")}>
              <SlpHeartGlyph size="1.15em" strokeWidth={2} />
              {number(post.likes)}
            </span>
            <span>
              <MessageCircle size="1.1em" strokeWidth={2} />
              {post.comments}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("slp-phone-room", className)}>
      <PhoneStyles />
      <div className="slp-phone">
        <div ref={screenRef} className="slp-phone-screen" inert={doors === "shut"}>
          <div className="slp-phone-top" aria-hidden="true">
            <span className="slp-phone-bowl" style={BOWL} />
            <span className="slp-display">Slurp</span>
            {view.top.moon && (
              <span className="slp-phone-moon" {...region("moon")}>
                <Moon size="1em" strokeWidth={2.25} fill="currentColor" />
              </span>
            )}
            <span className="slp-phone-chip" {...region("chip")}>
              {k(view.top.chipKey, view.top.fans === null ? undefined : { fans: number(view.top.fans) })}
            </span>
          </div>
          <div className="slp-phone-feed" {...region("feed")}>
            {view.empty ? (
              <p className="slp-phone-empty" aria-hidden="true">
                <b>{k(view.empty.titleKey)}</b>
                {k(view.empty.bodyKey)}
              </p>
            ) : null}
            {view.gossip && (
              <div
                key={`gossip-${view.gossip.level}`}
                className="slp-phone-card slp-phone-gossip slp-phone-in"
                data-level={view.gossip.level}
                aria-hidden="true"
                {...region("gossip")}
              >
                {k(view.gossip.textKey, { a: name(view.gossip.creators[0]), b: name(view.gossip.creators[1]) })}
              </div>
            )}
            {view.items.map((item) =>
              item.kind === "post" ? (
                renderPost(item)
              ) : (
                <div
                  key={`ad-${item.variant}`}
                  className="slp-phone-card slp-phone-ad slp-phone-in"
                  aria-hidden="true"
                  {...region("ads")}
                >
                  <span className="slp-phone-tag">{k("ui.slurp.opening.preview.ad.tag")}</span>
                  <b>{k(item.brandKey)}</b> {k(item.textKey)}
                </div>
              ),
            )}
            {view.hintKey && (
              <p className="slp-phone-hint" aria-hidden="true">
                {k(view.hintKey)}
              </p>
            )}
          </div>
          {view.footer.length > 0 && (
            <div className="slp-phone-foot" aria-hidden="true" {...region("footer")}>
              {view.footer.map((line) => (
                <span key={line.key}>{k(line.key, { name: line.name })}</span>
              ))}
            </div>
          )}
          <div className="slp-phone-bar" aria-hidden="true">
            <span className="is-active">
              <SlpHubGlyph size="1.6em" filled />
              {k("ui.slurp.opening.preview.tab.feed")}
            </span>
            <span>
              <SlpDiscoverGlyph size="1.6em" />
              {k("ui.slurp.opening.preview.tab.discover")}
            </span>
            <span {...region("stir")}>
              <SlpStirGlyph size="1.6em" />
              {view.stirBadge && <i className="slp-phone-badge" />}
              {k("ui.slurp.opening.preview.tab.stir")}
            </span>
            <span>
              <SlpInboxGlyph size="1.6em" />
              {k("ui.slurp.opening.preview.tab.inbox")}
            </span>
          </div>
          {doors !== "none" && (
            <div className="slp-phone-doors" data-doors={doors} aria-hidden="true">
              <i />
              <i />
              <span className="slp-phone-plate slp-display">{k("ui.slurp.opening.preview.soon")}</span>
            </div>
          )}
        </div>
        {shownCallout && (
          <span key={shownCallout.n} className="slp-phone-callout" aria-hidden="true">
            {shownCallout.text}
          </span>
        )}
      </div>
    </div>
  );
}

const GLOW: Keyframe[] = [
  { boxShadow: "0 0 0 0 var(--noodle-accent)" },
  { boxShadow: "0 0 0 0.35em color-mix(in srgb, var(--noodle-accent) 70%, transparent)", offset: 0.3 },
  { boxShadow: "0 0 0 0.9em transparent" },
];

/** Full-width regions glow inward: the screen clips anything outside them. */
const GLOW_INSET: Keyframe[] = GLOW.map((frame) => ({ ...frame, boxShadow: `inset ${frame.boxShadow}` }));

// Component-scoped styles, like the age gate's: the phone is sized in em off its own height
// (height-driven, fits the parent), so a Tailwind class per detail would be noise.
function PhoneStyles() {
  return (
    <style>{`
      .slp-phone-room { container-type: size; position: relative; display: grid; place-items: center; width: 100%; height: 100%; min-height: 0; }
      .slp-phone {
        --h: min(100cqh, 540px, 200cqw);
        position: relative; height: var(--h); aspect-ratio: 9 / 18; font-size: calc(var(--h) / 51.4); line-height: 1.35;
        padding: 0.95em 0.85em; border-radius: 3.4em; background: var(--slurp-surface); color: var(--slurp-text);
        box-shadow: 0 0 0 0.65em var(--slurp-surface-raised), 0 0 0 0.75em var(--slurp-outline), var(--slurp-shadow-modal);
        display: flex; flex-direction: column;
        animation: slp-phone-enter 1s cubic-bezier(.34, 1.56, .64, 1) both;
      }
      @keyframes slp-phone-enter { from { transform: translateY(4em) rotate(-4deg) scale(.9); opacity: 0; } }
      .slp-phone-screen { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: 2.6em; background: var(--slurp-canvas); }
      .slp-phone-top { display: flex; align-items: center; gap: 0.55em; padding: 0.9em 1.1em 0.55em; font-size: 1.3em; line-height: 1; }
      .slp-phone-bowl { width: 1.6em; height: 1.05em; flex: none; background: var(--noodle-accent); }
      .slp-phone-moon { display: grid; place-items: center; width: 1.6em; height: 1.6em; border-radius: 999px; color: var(--slurp-violet);
        background: color-mix(in srgb, var(--slurp-violet) 18%, transparent); font-size: 0.75em; animation: slp-phone-pop .5s cubic-bezier(.34, 1.56, .64, 1) both; }
      .slp-phone-chip { margin-left: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.68em; font-weight: 700;
        padding: 0.4em 0.7em; border-radius: 999px; background: var(--slurp-surface-raised); color: var(--slurp-muted); }
      .slp-phone-feed { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 0.65em; padding: 0.35em 0.75em 0.75em; border-radius: 1.2em; }
      .slp-phone-empty { margin: auto; display: grid; gap: 0.3em; padding: 0 1.6em; text-align: center; color: var(--slurp-muted); }
      .slp-phone-empty b { color: var(--slurp-text); font-size: 1.15em; }
      .slp-phone-card { flex: none; border-radius: 1.25em; background: var(--slurp-surface-raised); box-shadow: var(--slurp-highlight); padding: 0.65em; }
      .slp-phone-in { animation: slp-phone-in .55s cubic-bezier(.34, 1.56, .64, 1) both; }
      @keyframes slp-phone-in { from { opacity: 0; transform: translateY(-1.5em) scale(.96); } }
      @keyframes slp-phone-pop { from { opacity: 0; transform: scale(.6); } }
      .slp-phone-head { display: flex; align-items: center; gap: 0.55em; min-width: 0; }
      .slp-phone-head b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 0.4em; }
      .slp-phone-av { width: 2.55em; height: 2.55em; flex: none; display: grid; place-items: center; border-radius: 999px; font-size: 0.75em;
        font-weight: 800; color: var(--slurp-on-accent); background: var(--noodle-accent) center / cover; }
      .slp-phone-av[data-art="0"] { background-color: var(--slurp-surface); }
      .slp-phone-av[data-art="2"], .slp-phone-img[data-art="2"] { background: linear-gradient(140deg, var(--slurp-violet), color-mix(in srgb, var(--slurp-violet) 40%, var(--slurp-canvas))); }
      .slp-phone-av[data-art="3"], .slp-phone-img[data-art="3"] { background: linear-gradient(140deg, var(--slurp-coral), color-mix(in srgb, var(--slurp-warm) 60%, var(--slurp-canvas))); }
      .slp-phone-img[data-art="1"] { background: var(--slurp-hero); }
      .slp-phone-age { flex: none; color: var(--slurp-muted); font-size: 0.9em; }
      .slp-phone-lock { margin-left: auto; flex: none; display: inline-flex; align-items: center; gap: 0.25em; font-style: normal; font-weight: 700; font-size: 0.85em;
        color: var(--slurp-ink); padding: 0.2em 0.6em; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--noodle-accent); }
      .slp-phone-pic { position: relative; margin-top: 0.55em; aspect-ratio: 3 / 2; border-radius: 0.85em; overflow: hidden; display: grid; place-items: center; }
      .slp-phone-img { position: absolute; inset: 0; background: center / cover; transition: filter .7s cubic-bezier(.22, 1, .36, 1), transform .7s cubic-bezier(.22, 1, .36, 1); }
      .slp-phone-pic.is-locked .slp-phone-img { filter: blur(0.8em) saturate(1.2); transform: scale(1.15); }
      .slp-phone-pic.is-locked[data-blur="soft"] .slp-phone-img { filter: blur(0.55em) saturate(1.2); }
      .slp-phone-pic.is-locked[data-blur="strong"] .slp-phone-img { filter: blur(1.3em) saturate(1.2); }
      .slp-phone-textlock { display: grid; place-items: center; margin-top: 0.55em; padding: 0.7em; border-radius: 0.85em; background: var(--slurp-tint); }
      .slp-phone-unlock { position: relative; min-height: 44px; min-width: 44px; border: 0; border-radius: 999px; padding: 0 1.6em; cursor: pointer;
        background: var(--noodle-accent); color: var(--slurp-on-accent); font: inherit; font-weight: 800; font-size: 1.1em;
        box-shadow: var(--slurp-glow); animation: slp-phone-pulse 1.6s ease-out 3; }
      .slp-phone-unlock:focus-visible { outline: 2px solid var(--slurp-focus); outline-offset: 3px; }
      @keyframes slp-phone-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--noodle-accent) 60%, transparent); } 100% { box-shadow: 0 0 0 1.4em transparent; } }
      .slp-phone-cap { margin: 0.5em 0 0; border-radius: 0.4em; }
      .slp-phone-cap.is-hidden { filter: blur(0.35em); user-select: none; }
      .slp-phone-cmt { margin: 0.35em 0 0; color: var(--slurp-muted); font-size: 0.95em; border-radius: 0.4em; }
      .slp-phone-cmt b { color: var(--slurp-text); }
      .slp-phone-meta { display: flex; gap: 1em; margin-top: 0.45em; color: var(--slurp-muted); font-size: 0.9em; font-variant-numeric: tabular-nums; }
      .slp-phone-meta span { display: inline-flex; align-items: center; gap: 0.3em; border-radius: 0.4em; }
      .slp-phone-gossip { font-weight: 600; background: color-mix(in srgb, var(--noodle-accent) 14%, var(--slurp-surface-raised)); }
      .slp-phone-gossip[data-level="loud"] { background: color-mix(in srgb, var(--noodle-accent) 30%, var(--slurp-surface-raised)); box-shadow: inset 0 0 0 1px var(--noodle-accent); }
      .slp-phone-ad { background: color-mix(in srgb, var(--slurp-warning) 12%, var(--slurp-surface-raised)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--slurp-warning) 35%, transparent); }
      .slp-phone-tag { display: block; font-size: 0.8em; font-weight: 800; color: var(--slurp-warning); }
      .slp-phone-hint { margin: 0; text-align: center; color: var(--slurp-muted); font-size: 0.9em; }
      .slp-phone-foot { display: grid; padding: 0.3em 0; text-align: center; font-size: 0.85em; color: var(--slurp-muted); border-radius: 0.6em; }
      .slp-phone-bar { display: flex; justify-content: space-around; padding: 0.55em 0 0.75em; border-top: 1px solid var(--slurp-outline); font-size: 0.82em; color: var(--slurp-muted); }
      .slp-phone-bar span { position: relative; display: grid; justify-items: center; gap: 0.15em; border-radius: 0.6em; padding: 0 0.3em; }
      .slp-phone-bar .is-active { color: var(--slurp-ink); font-weight: 700; }
      .slp-phone-badge { position: absolute; top: 0; right: 0.2em; width: 0.7em; height: 0.7em; border-radius: 999px; background: var(--noodle-accent);
        box-shadow: 0 0 0 2px var(--slurp-canvas); animation: slp-phone-pop .5s cubic-bezier(.34, 1.56, .64, 1) both; }
      .slp-phone-doors { position: absolute; inset: 0; z-index: 2; display: flex; pointer-events: none; }
      .slp-phone-doors i { flex: 1; transition: transform 1s cubic-bezier(.22, 1, .36, 1);
        background: linear-gradient(90deg, var(--slurp-surface-raised), color-mix(in srgb, var(--noodle-accent) 16%, var(--slurp-surface-raised))); }
      .slp-phone-doors i:nth-of-type(1) { box-shadow: inset -2px 0 0 color-mix(in srgb, var(--noodle-accent) 40%, transparent); }
      .slp-phone-doors i:nth-of-type(2) { box-shadow: inset 2px 0 0 color-mix(in srgb, var(--noodle-accent) 40%, transparent); }
      .slp-phone-doors[data-doors="shut"] i:nth-of-type(1) { animation: slp-phone-shut-l .7s cubic-bezier(.34, 1.56, .64, 1) both; }
      .slp-phone-doors[data-doors="shut"] i:nth-of-type(2) { animation: slp-phone-shut-r .7s cubic-bezier(.34, 1.56, .64, 1) both; }
      @keyframes slp-phone-shut-l { from { transform: translateX(-102%); } }
      @keyframes slp-phone-shut-r { from { transform: translateX(102%); } }
      .slp-phone-doors[data-doors="open"] i:nth-of-type(1) { transform: translateX(-102%); }
      .slp-phone-doors[data-doors="open"] i:nth-of-type(2) { transform: translateX(102%); }
      .slp-phone-plate { position: absolute; left: 50%; top: 42%; translate: -50% 0; max-width: 80%; padding: 0.6em 0.9em; border-radius: 0.8em; text-align: center;
        font-size: 1.35em; line-height: 1.1; background: var(--noodle-accent); color: var(--slurp-on-accent); box-shadow: var(--slurp-shadow-floating);
        transition: opacity .3s, transform .5s cubic-bezier(.34, 1.56, .64, 1); }
      .slp-phone-doors[data-doors="open"] .slp-phone-plate { opacity: 0; transform: translateY(-2em) rotate(-8deg); }
      .slp-phone-callout { position: absolute; z-index: 3; left: 50%; top: 40%; translate: -50% 0; max-width: 120%; padding: 0.5em 1em; border-radius: 999px;
        background: var(--noodle-accent); color: var(--slurp-on-accent); font-weight: 800; font-size: 1.25em; line-height: 1.2; white-space: nowrap;
        box-shadow: var(--slurp-shadow-floating); pointer-events: none; animation: slp-phone-callout 1.6s cubic-bezier(.22, 1, .36, 1) both; }
      @keyframes slp-phone-callout { 0% { opacity: 0; transform: translateY(1em) scale(.8); } 15% { opacity: 1; transform: none; } 75% { opacity: 1; } 100% { opacity: 0; transform: translateY(-2em); } }
      @media (prefers-reduced-motion: reduce) {
        .slp-phone, .slp-phone *, .slp-phone-doors i, .slp-phone-plate { animation: none !important; transition: none !important; }
        .slp-phone-doors[data-doors="open"] { display: none; }
      }
    `}</style>
  );
}
