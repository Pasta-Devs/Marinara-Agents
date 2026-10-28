// ──────────────────────────────────────────────
// Noodle: domain-neutral chrome primitives — accent tokens, logo, avatar, scroll behaviour.
// Split out of the former components/slurp/SlurpShell.tsx in Slice 10. These import no module and
// no feature, so they stay in base/ while the shell itself (which renders a wallet balance) does
// not.
// ──────────────────────────────────────────────
import { UserRound } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import {
  createContext,
  type CSSProperties,
  type SyntheticEvent,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { AvatarCrop } from "@marinara-engine/shared";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { cn, getAvatarCropStyle } from "../../../lib/utils";
import { useSlurpMediaSrc } from "../media/slp-media-src";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SLURP_LOGO_SRC } from "./slp-logo";
import { SLP_MOTION } from "./slp-motion";
import { initials } from "./slp-initials";

export const SLP_BLUE = "#7EA7FF";
export const SLP_PINK = "#FF7EC1";

// The Engine viewport uses `viewport-fit=cover`, so `env(safe-area-inset-bottom)`
// reports the Android system navigation bar as well. Gecko on Android keeps the
// layout viewport above that bar, so honouring the inset there paints an empty
// strip under the mobile nav. WebKit is the engine that really extends the
// viewport under the home indicator, so reserve the inset only there.
// ponytail: WebKit sniff, swap for a measured overhang if another engine ever
// needs the real inset.
export const BOTTOM_SAFE_INSET =
  typeof CSS !== "undefined" && CSS.supports?.("-webkit-touch-callout", "none") === true
    ? "env(safe-area-inset-bottom)"
    : "0px";

// The accent hex that drives `--noodle-accent` for every reused Noodle surface.
// Provided at the shell root so descendants inherit via CSS var, and read here
// so portaled popovers/modals (which escape the shell's CSS scope) can re-apply it.
/** A live `matchMedia` answer (false on the server). Phones are `< 768px`, as for SlpSheet. */
export function useSlpMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

export const SlpAccentContext = createContext<string>(SLP_BLUE);
export const useSlpAccent = () => useContext(SlpAccentContext);
// Icons take the pink *ink*, not the pink fill: the fill (#FF7EC1) is ~2.2:1 on the light canvas.
export const NOODLE_ICON_SCOPE_CLASS = "[&_:where(svg)]:text-[var(--noodle-accent-foreground)]";
// NoodleR's mark. Untranslated on purpose — it is branding, not copy — and a constant so the
// localization audit does not read it as a hardcoded string. Meaning is carried by the adjacent
// label or tooltip, never by the mark alone.
// One highlight for every Slurp destination row — the desktop nav, the settings sections, and
// anything else marking "you are here". Per-row tints are how this started looking like
// three different apps.
export const SLURP_ROW_CLASS =
  "relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-lg px-3 text-start text-sm font-semibold transition-[background-color,color,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100";
export const SLURP_ROW_ACTIVE_CLASS =
  "bg-[color-mix(in_srgb,var(--noodle-accent)_24%,var(--slurp-surface-raised))] text-[var(--foreground)] ring-1 ring-inset ring-[var(--noodle-accent)]/45 shadow-[0_6px_18px_-8px_color-mix(in_srgb,var(--noodle-accent)_70%,transparent)]";
/** The coin balance chip (phone hub header, desktop sidebar Wallet row): glass pill with a warm ring. */
export const SLP_BALANCE_CHIP_CLASS =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--slurp-surface-raised)] px-3 text-[13px] font-bold tabular-nums text-[var(--slurp-text)] shadow-[var(--slurp-highlight)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--slurp-warm)_40%,transparent)]";
/** Selected state for the small pill toggles (feed layout, filters). Same fill, no left bar. */
export const SLURP_TOGGLE_ACTIVE_CLASS =
  "bg-[color-mix(in_srgb,var(--noodle-accent)_28%,var(--slurp-surface-raised))] text-[var(--foreground)] ring-1 ring-inset ring-[var(--noodle-accent)]/50";

export const SLP_CREATOR_MARK = "R";
export const SLP_CREATOR_ADD_MARK = "+R";
export const SLP_LOGO_SRC = SLURP_LOGO_SRC;
export const NOODLER_LOGO_SRC = SLURP_LOGO_SRC;
export const SLURP_NAME = "Slurp";
/** The Slurp bug channel on the Marinara Discord: the same link as the release splash. */
export const SLP_DISCORD_BUG_URL = "https://discord.com/channels/1417099416812392641/1539355721853046926";
export const SLP_PERSONA_SWITCHER_PAGE_SIZE = 5;

export function getSlpAccentStyle(accent: string, style: CSSProperties = {}): CSSProperties {
  return {
    "--noodle-accent": accent,
    // Pink *ink*: text and icons. The fill above is for surfaces, rings and sparkles only.
    "--noodle-accent-foreground": "light-dark(#8d174f, #ff9bd0)",
    "--slurp-ink": "var(--noodle-accent-foreground)",
    // Selected chips/rows, own bubbles, callouts.
    "--slurp-tint": "color-mix(in srgb, var(--noodle-accent) 14%, var(--slurp-surface-raised))",
    // Extra halo for the primary CTA and signature cards only.
    "--slurp-glow": "0 10px 28px -10px color-mix(in srgb, var(--noodle-accent) 50%, transparent)",
    // Text on a pink fill. Dark plum in both themes, because the fill does not change with the theme.
    "--slurp-on-accent": "#2a0a1b",
    // Text on the hero gradient, which is dark in both themes.
    "--slurp-on-hero": "#fff",
    // The 1 px top highlight of a raised surface.
    "--slurp-highlight": "inset 0 1px 0 light-dark(rgb(255 255 255 / 0.7), rgb(255 255 255 / 0.06))",
    "--slurp-motion-fast": `${SLP_MOTION.fast}ms`,
    "--slurp-motion-base": `${SLP_MOTION.base}ms`,
    "--slurp-motion-slow": `${SLP_MOTION.slow}ms`,
    "--slurp-ease": SLP_MOTION.ease,
    "--noodle-divider": "light-dark(rgba(95, 32, 67, 0.18), rgba(255, 187, 222, 0.13))",
    "--slurp-canvas": "light-dark(#fff6fb, #100a12)",
    // The room the app sits in on a wide screen. Neutral purple, so the canvas gradients
    // have something to blend into instead of ending at a hard edge.
    "--slurp-outer": "light-dark(#efe7f4, #15101c)",
    "--slurp-surface": "light-dark(#fffafd, #18101b)",
    "--slurp-surface-raised": "light-dark(#f9eaf3, #211624)",
    "--slurp-glass": "light-dark(rgba(255, 250, 253, 0.88), rgba(31, 18, 33, 0.82))",
    "--slurp-text": "light-dark(#321424, #fff7fc)",
    "--slurp-muted": "light-dark(#73576a, #cdb9c7)",
    // Same value as the divider token, which the components already use ~150 times.
    // Kept as an alias so the two names cannot drift apart.
    "--slurp-outline": "var(--noodle-divider)",
    "--slurp-coral": "light-dark(#ad432d, #ff936f)",
    "--slurp-violet": "light-dark(#67417e, #c29af1)",
    "--slurp-warm": "light-dark(#895019, #f2b56f)",
    "--slurp-success": "light-dark(#17694d, #72d6ad)",
    "--slurp-warning": "light-dark(#8a4b0c, #ffc56e)",
    "--slurp-danger": "light-dark(#a51d3d, #ff8ba5)",
    "--slurp-focus": "light-dark(#9d1c5c, #ff9bd0)",
    "--slurp-hero":
      "linear-gradient(118deg, light-dark(#9f1f5c, #8f174f), light-dark(#dc3b7c, #d92e75) 46%, light-dark(#7b3b9e, #6d2b91) 78%, light-dark(#c34e39, #bd452f))",
    "--slurp-nav-active":
      "linear-gradient(105deg, color-mix(in srgb, var(--noodle-accent) 24%, var(--slurp-surface-raised)), color-mix(in srgb, var(--slurp-violet) 12%, var(--slurp-surface-raised)))",
    // Three levels, so nobody hand-rolls a 34th blur radius nobody can tell apart.
    "--slurp-shadow-raised": "0 12px 30px -22px rgba(0, 0, 0, 0.9)",
    "--slurp-shadow-floating": "0 20px 46px -34px rgba(0, 0, 0, 0.95)",
    "--slurp-shadow-modal": "0 28px 70px -46px rgba(99, 13, 60, 0.82)",
    // Kept as an alias: existing callers mean the modal level.
    "--slurp-shadow": "var(--slurp-shadow-modal)",
    "--background": "var(--slurp-canvas)",
    "--foreground": "var(--slurp-text)",
    "--muted-foreground": "var(--slurp-muted)",
    "--border": "var(--slurp-outline)",
    "--accent": "color-mix(in srgb, var(--noodle-accent) 10%, var(--slurp-surface-raised))",
    // One soft wash from the top. The rest of the room's colour comes from the photo on screen
    // (SlpCanvasAmbient); the three radial orbs read as a stock template.
    "--slurp-canvas-art":
      "linear-gradient(180deg, color-mix(in srgb, var(--noodle-accent) 6%, transparent), transparent 30rem)",
    ...style,
  } as CSSProperties;
}

/**
 * The compact type scale (design language §4). Six steps; nothing under 11 px. Numbers and money
 * add `tabular-nums` themselves.
 */
export const SLP_TYPE = {
  caption: "text-[11px] leading-[14px] font-semibold",
  meta: "text-xs leading-4 font-medium",
  body: "text-[13px] leading-[19px]",
  title: "text-[15px] leading-5 font-bold",
  screen: "text-xl leading-[26px] font-extrabold tracking-[-0.01em]",
  hero: "text-[28px] leading-8 font-extrabold",
} as const;
/** The one uppercase style in Slurp: a settings-group heading. Not for any other label. */
export const SLP_EYEBROW_CLASS = "text-xs font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent-foreground)]";

/**
 * The settings-group recipe for fan pages (design language §7 Group / Row): one raised surface, no
 * border, hairline rows. Headed by `SLP_EYEBROW_CLASS`, never boxed inside another box.
 */
export const SLP_GROUP_CLASS =
  "overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] divide-y divide-[var(--noodle-divider)]";

/** A rail list (profile "More creators", hub rail): compact rows in one raised group, no hairlines. */
export const SLP_RAIL_GROUP_CLASS =
  "rounded-2xl bg-[var(--slurp-surface-raised)] p-1 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]";

/** A search field on a fan page: a raised pill with room for a leading 16 px icon at `start-4`. */
export const SLP_SEARCH_FIELD_CLASS =
  "h-11 w-full rounded-full bg-[var(--slurp-surface-raised)] ps-11 pe-4 text-base shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] outline-none placeholder:text-[var(--slurp-muted)] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm";

export const labelClass = `${SLP_TYPE.meta} text-[var(--marinara-chat-chrome-panel-muted)]`;

export function SlpLogo({ className, src = SLP_LOGO_SRC }: { className?: string; src?: string }) {
  return <img src={src} alt="" className={cn("object-contain", className)} />;
}

/**
 * Hide mobile chrome after deliberate movement and restore it after deliberate upward movement.
 * Listens in the capture phase, so `scroller` may be the scroll container itself or any ancestor of
 * the screens' own scroll containers (the shell's bottom nav). A change of `resetKey` (a new screen)
 * shows the bar again.
 */
export function useHideOnScroll(
  scroller: HTMLElement | null,
  {
    hiddenTransform = "translate3d(0, -100%, 0)",
    resetKey,
    onHiddenChange,
  }: {
    hiddenTransform?: string;
    resetKey?: unknown;
    /** For a caller that gives the bar's space back while it is hidden. */
    onHiddenChange?: (hidden: boolean) => void;
  } = {},
) {
  const [bar, setBar] = useState<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const onHiddenChangeRef = useRef(onHiddenChange);
  onHiddenChangeRef.current = onHiddenChange;

  useEffect(() => {
    if (!scroller || !bar || reduceMotion) return;
    const DIRECTION_THRESHOLD = 24;
    let source: EventTarget | null = null;
    let previousTop = 0;
    let directionDistance = 0;
    let movingDownLast = true;
    let hidden = false;
    // Giving the bar's space back resizes the scroller, and near the end of a page the browser then
    // clamps scrollTop. That scroll is ours, not the reader's, so it must not flip the bar back.
    let settleUntil = 0;
    const setHidden = (next: boolean) => {
      if (next === hidden) return;
      hidden = next;
      directionDistance = 0;
      settleUntil = performance.now() + 300;
      bar.style.transform = hidden ? hiddenTransform : "translate3d(0, 0, 0)";
      onHiddenChangeRef.current?.(hidden);
    };

    const update = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const top = target.scrollTop;
      // A different scroll container (a new list, a nested panel) starts its own count.
      if (target !== source) {
        source = target;
        previousTop = top;
        directionDistance = 0;
        return;
      }
      const delta = top - previousTop;
      previousTop = top;
      if (performance.now() < settleUntil) return;
      // Sideways scrollers (the Story shelf) never move vertically, so they never touch the bar.
      if (!delta) return;
      if (top <= 0) {
        setHidden(false);
        return;
      }
      const movingDown = delta > 0;
      // Distance accumulates while the direction holds and restarts when it turns, so a
      // slow drag back up still adds up to the threshold instead of resetting each event.
      directionDistance = movingDown === movingDownLast ? directionDistance + Math.abs(delta) : Math.abs(delta);
      movingDownLast = movingDown;
      if (movingDown === hidden || directionDistance < DIRECTION_THRESHOLD) return;
      setHidden(movingDown);
    };

    // A bar that takes keyboard focus while hidden comes back, so focus never sits off screen.
    const show = () => setHidden(false);
    bar.style.transition = `transform ${SLP_MOTION.bar}ms ${SLP_MOTION.barEase}`;
    scroller.addEventListener("scroll", update, { passive: true, capture: true });
    bar.addEventListener("focusin", show);
    return () => {
      scroller.removeEventListener("scroll", update, { capture: true });
      bar.removeEventListener("focusin", show);
      bar.style.transition = "";
      bar.style.transform = "";
      if (hidden) onHiddenChangeRef.current?.(false);
    };
  }, [scroller, bar, reduceMotion, hiddenTransform, resetKey]);

  return setBar;
}

/** Base classes for a sticky bar driven by {@link useHideOnScroll}. */
export const HIDE_ON_SCROLL_CLASS = "will-change-transform";

/** The one bar glass: the phone header and the floating nav pill see through exactly the same. */
export const SLP_BAR_GLASS_CLASS =
  "bg-[color-mix(in_srgb,var(--noodle-accent)_6%,var(--slurp-glass))] backdrop-blur-xl";

/**
 * A screen's top bar: the bar glass with the hub header's hairline, lift and highlight. The framed
 * pages (Inbox, Wallet, Studio…) and the message list wear it, so no top bar is bare canvas.
 */
export const SLP_TOP_BAR_CLASS = cn(
  "relative z-30 border-b border-[var(--noodle-divider)] shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)]",
  SLP_BAR_GLASS_CLASS,
);

/**
 * A screen's own vertical scroller. Content scrolls behind the floating phone nav, so only the end of
 * the list gets room to clear it (`--slp-nav-space`, set by the shell; 0 on desktop). The spacer goes
 * on the innermost marked scroller only (injected CSS in slp-client-entry.tsx), so a frame that wraps
 * a scrolling list does not become scrollable itself.
 */
export const SLP_PAGE_SCROLL_CLASS = "slp-page-scroll";

/**
 * Pictures arrive softly, never with a pop (CSS in slp-client-entry.tsx). The frame that directly
 * holds the `<img>` gets `SLP_IMG_FRAME_CLASS`: it keeps its size and shows a soft pink shimmer until
 * the picture has loaded, including while a package image is still being fetched. The `<img>` gets
 * `slpImgFade`: it fades in and un-blurs once loaded. Key the `<img>` by its src, so a new picture
 * in the same frame fades in too.
 */
export const SLP_IMG_FRAME_CLASS = "slp-img-frame";

/**
 * Cropped previews (CSS in slp-client-entry.tsx). A picture preview that fills its frame keeps the
 * top centre of the picture, where faces usually are. `SLP_CROP_CLASS` is a post picture preview: it
 * also gets the quiet "cropped" mark on its frame when the picture is really cut, and shows whole
 * with "Show whole pictures" on. `SLP_CROP_TOP_CLASS` only anchors (banners, covers, blurred teasers).
 * The frame holding an `SLP_CROP_CLASS` picture must be positioned (`relative`), for the mark.
 */
export const SLP_CROP_CLASS = "slp-crop";
export const SLP_CROP_TOP_CLASS = "slp-crop-top";
/** Whether a picture of this size loses more than a sliver when it fills a box of this size. */
export function slpPreviewIsCut(naturalWidth: number, naturalHeight: number, boxWidth: number, boxHeight: number) {
  if (!naturalWidth || !naturalHeight || !boxWidth || !boxHeight) return false;
  return Math.abs(Math.log(naturalWidth / naturalHeight / (boxWidth / boxHeight))) > 0.04;
}
// Pictures that loaded since the last frame. Their marks are written together in one frame, reads
// first: marking each picture in its own load event forced a layout per picture while the feed
// scrolled (0.3.6).
let slpLoadedImages: HTMLImageElement[] = [];
const flushSlpLoadedImages = () => {
  const images = slpLoadedImages;
  slpLoadedImages = [];
  // ponytail: measured once on load; a frame that later changes shape keeps its first answer. Add a
  // ResizeObserver if a preview frame ever resizes with the window.
  const cuts = images.map((image) =>
    image.classList.contains(SLP_CROP_CLASS)
      ? slpPreviewIsCut(image.naturalWidth, image.naturalHeight, image.clientWidth, image.clientHeight)
      : null,
  );
  images.forEach((image, index) => {
    image.setAttribute("data-slp-loaded", "");
    if (cuts[index] !== null) image.toggleAttribute("data-slp-cut", cuts[index]);
  });
};
const markSlpImgLoaded = (event: SyntheticEvent<HTMLImageElement>) => {
  if (!slpLoadedImages.length) requestAnimationFrame(flushSlpLoadedImages);
  slpLoadedImages.push(event.currentTarget);
};
// A failed picture also ends the shimmer; its caller shows its own fallback.
export const slpImgFade = { "data-slp-fade": "", onLoad: markSlpImgLoaded, onError: markSlpImgLoaded };

/** Boundary marker between posts arrived since the last visit and everything already read. */
export function NewSinceLastVisitDivider() {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-2">
      <span className="h-px flex-1 bg-[var(--noodle-accent)]/30" />
      <span className="text-xs font-bold text-[var(--noodle-accent-foreground)]">
        {localizeUi("ui.noodle.viewerhub.newSinceYourLastVisit")}
      </span>
      <span className="h-px flex-1 bg-[var(--noodle-accent)]/30" />
    </div>
  );
}

/**
 * An `<img>` for a URL that may be served by this package. Slurp's own media routes sit behind the
 * Engine's X-Admin-Secret gate, which a bare `src` cannot pass, so those load through the API client.
 */
export function SlurpMediaImg({
  src,
  mediaWidth,
  ...props
}: {
  src: string | null | undefined;
  /** The width variant to ask for; without it the original is served. */
  mediaWidth?: number;
} & Omit<React.ComponentProps<"img">, "src">) {
  const resolved = useSlurpMediaSrc(src, { width: mediaWidth });
  if (!resolved) return null;
  return <img key={resolved} src={resolved} {...slpImgFade} {...props} />;
}

export function Avatar({
  account,
  size = "md",
  solid = false,
  className,
}: {
  account: Pick<SlpAccount, "displayName" | "avatarUrl"> & {
    avatarCrop?: AvatarCrop | null;
  };
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  solid?: boolean;
  /** Overrides the size classes (the profile hero sizes its avatar per layout). */
  className?: string;
}) {
  const dimension =
    // `xs` exists for the persona badge that overlaps a Creator avatar: `sm` is h-8, which on an
    // h-11 avatar reads as a second avatar rather than a corner mark.
    size === "xs"
      ? "h-5 w-5"
      : size === "sm"
        ? "h-8 w-8"
        : size === "xl"
          ? "h-24 w-24 @min-[680px]:h-32 @min-[680px]:w-32 @min-[1040px]:h-36 @min-[1040px]:w-36"
          : size === "lg"
            ? "h-24 w-24"
            : "h-11 w-11";
  // NoodleR avatars are served by the package's own route, which a bare <img> cannot
  // authenticate against; the hook swaps those for a fetched object URL and passes the rest through.
  const avatarSrc = useSlurpMediaSrc(account.avatarUrl, { width: size === "xl" || size === "lg" ? 320 : 96 });
  if (account.avatarUrl) {
    // The initials hold the frame while the picture is fetched and loaded, then the picture fades in
    // over them; a picture that never arrives leaves the initials, not an empty ring.
    return (
      <div
        className={cn(
          dimension,
          SLP_IMG_FRAME_CLASS,
          "relative flex aspect-square flex-none items-center justify-center overflow-hidden rounded-full border border-[var(--noodle-accent)]/30 text-xs font-bold !text-[var(--noodle-accent-foreground)]",
          className,
        )}
      >
        <span data-slp-img-placeholder aria-hidden="true">
          {initials(account.displayName)}
        </span>
        {avatarSrc && (
          <img
            key={avatarSrc}
            src={avatarSrc}
            alt=""
            decoding="async"
            {...slpImgFade}
            className="absolute inset-0 h-full w-full object-cover"
            style={getAvatarCropStyle(account.avatarCrop)}
          />
        )}
      </div>
    );
  }
  return (
    <div
      data-noodle-avatar-fallback
      className={cn(
        dimension,
        "flex aspect-square flex-none items-center justify-center rounded-full text-xs font-bold !text-[var(--noodle-accent-foreground)] ring-1 ring-[var(--noodle-accent)]/25",
        solid ? "bg-[color-mix(in_srgb,var(--noodle-accent)_15%,var(--background))]" : "bg-[var(--noodle-accent)]/15",
        className,
      )}
    >
      {initials(account.displayName)}
    </div>
  );
}

/** Avatar for stage profiles: their picture when they have one, their initial when they do not. */
export function ProfileInitial({
  profile,
  large = false,
}: {
  profile: {
    displayName: string;
    avatarUrl?: string | null;
    avatarCrop?: AvatarCrop | null;
  };
  large?: boolean;
}) {
  if (profile.avatarUrl)
    return (
      <Avatar
        account={{
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          avatarCrop: profile.avatarCrop,
        }}
        size={large ? "lg" : "md"}
      />
    );
  return (
    <span
      data-noodle-avatar-fallback
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 font-black !text-[var(--noodle-accent-foreground)] ring-1 ring-[var(--noodle-accent)]/25",
        large ? "h-24 w-24 text-3xl" : "h-11 w-11",
      )}
    >
      {Array.from(profile.displayName)[0]?.toUpperCase() || <UserRound size={20} />}
    </span>
  );
}
