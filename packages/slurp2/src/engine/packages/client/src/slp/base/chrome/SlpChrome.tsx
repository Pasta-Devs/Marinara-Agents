// ──────────────────────────────────────────────
// Noodle: domain-neutral chrome primitives — accent tokens, logo, avatar, scroll behaviour.
// Split out of the former components/slurp/SlurpShell.tsx in Slice 10. These import no module and
// no feature, so they stay in base/ while the shell itself (which renders a wallet balance) does
// not.
// ──────────────────────────────────────────────
import { UserRound } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { createContext, type CSSProperties, useContext, useEffect, useState } from "react";
import type { AvatarCrop } from "@marinara-engine/shared";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { cn, getAvatarCropStyle } from "../../../lib/utils";
import { useSlurpMediaSrc } from "../media/slp-media-src";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SLURP_LOGO_SRC } from "./slp-logo";

export const NOODLE_BLUE = "#7EA7FF";
export const NOODLE_PINK = "#FF7EC1";

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
export const NoodleAccentContext = createContext<string>(NOODLE_BLUE);
export const useNoodleAccent = () => useContext(NoodleAccentContext);
export const NOODLE_ICON_SCOPE_CLASS = "[&_:where(svg)]:text-[var(--noodle-accent)]";
// NoodleR's mark. Untranslated on purpose — it is branding, not copy — and a constant so the
// localization audit does not read it as a hardcoded string. Meaning is carried by the adjacent
// label or tooltip, never by the mark alone.
// One highlight for every Slurp destination row — the desktop nav, the settings sections, and
// anything else marking "you are here". Per-row tints are how this started looking like
// three different apps.
export const SLURP_ROW_CLASS =
  "relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-lg px-3 text-start text-sm font-semibold transition-[background-color,color,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100";
export const SLURP_ROW_ACTIVE_CLASS =
  "bg-[color-mix(in_srgb,var(--noodle-accent)_24%,var(--slurp-surface-raised))] text-[var(--foreground)] before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:bg-[var(--noodle-accent)]";
/** Selected state for the small pill toggles (feed layout, filters). Same fill, no left bar. */
export const SLURP_TOGGLE_ACTIVE_CLASS =
  "bg-[color-mix(in_srgb,var(--noodle-accent)_28%,var(--slurp-surface-raised))] text-[var(--foreground)] ring-1 ring-inset ring-[var(--noodle-accent)]/50";

export const NOODLER_MARK = "R";
export const NOODLER_ADD_MARK = "+R";
export const NOODLE_LOGO_SRC = SLURP_LOGO_SRC;
export const NOODLER_LOGO_SRC = SLURP_LOGO_SRC;
export const SLURP_NAME = "Slurp";
export const NOODLE_PERSONA_SWITCHER_PAGE_SIZE = 5;

export function getNoodleAccentStyle(accent: string, style: CSSProperties = {}): CSSProperties {
  return {
    "--noodle-accent": accent,
    "--noodle-accent-foreground": "light-dark(#8d174f, #ff9bd0)",
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
    "--slurp-canvas-art":
      "radial-gradient(ellipse 48rem 34rem at 8% -12%, color-mix(in srgb, var(--noodle-accent) 28%, transparent), transparent 68%), radial-gradient(ellipse 42rem 36rem at 96% 6%, color-mix(in srgb, var(--slurp-violet) 22%, transparent), transparent 70%), radial-gradient(ellipse 34rem 28rem at 62% 98%, color-mix(in srgb, var(--slurp-coral) 15%, transparent), transparent 72%), linear-gradient(180deg, color-mix(in srgb, var(--noodle-accent) 7%, transparent), transparent 30rem)",
    ...style,
  } as CSSProperties;
}

export const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--marinara-chat-chrome-panel-muted)]";

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "N"
  );
}

export function NoodleLogo({ className, src = NOODLE_LOGO_SRC }: { className?: string; src?: string }) {
  return <img src={src} alt="" className={cn("object-contain", className)} />;
}

/** Hide mobile chrome after deliberate movement and restore it after deliberate upward movement. */
export function useHideOnScroll(scroller: HTMLElement | null) {
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!scroller || !bar || reduceMotion) return;
    const DIRECTION_THRESHOLD = 24;
    let previousTop = scroller.scrollTop;
    let directionDistance = 0;
    let movingDownLast = true;
    let hidden = false;

    const update = () => {
      const top = scroller.scrollTop;
      const delta = top - previousTop;
      previousTop = top;
      if (top <= 0) {
        directionDistance = 0;
        hidden = false;
        bar.style.transform = "translate3d(0, 0, 0)";
        return;
      }
      if (!delta) return;
      const movingDown = delta > 0;
      // Distance accumulates while the direction holds and restarts when it turns, so a
      // slow drag back up still adds up to the threshold instead of resetting each event.
      directionDistance = movingDown === movingDownLast ? directionDistance + Math.abs(delta) : Math.abs(delta);
      movingDownLast = movingDown;
      if (movingDown === hidden || directionDistance < DIRECTION_THRESHOLD) return;
      hidden = movingDown;
      directionDistance = 0;
      bar.style.transform = hidden ? "translate3d(0, -100%, 0)" : "translate3d(0, 0, 0)";
    };

    bar.style.transition = "transform 180ms ease-out";
    scroller.addEventListener("scroll", update, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", update);
      bar.style.transition = "";
      bar.style.transform = "";
    };
  }, [scroller, bar, reduceMotion]);

  return setBar;
}

/** Base classes for a sticky bar driven by {@link useHideOnScroll}. */
export const HIDE_ON_SCROLL_CLASS = "will-change-transform";

/** Boundary marker between posts arrived since the last visit and everything already read. */
export function NewSinceLastVisitDivider() {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-2">
      <span className="h-px flex-1 bg-[var(--noodle-accent)]/30" />
      <span className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--noodle-accent)]">
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
  ...props
}: { src: string | null | undefined } & Omit<React.ComponentProps<"img">, "src">) {
  const resolved = useSlurpMediaSrc(src);
  if (!resolved) return null;
  return <img src={resolved} {...props} />;
}

export function Avatar({
  account,
  size = "md",
  solid = false,
}: {
  account: Pick<SlpAccount, "displayName" | "avatarUrl"> & {
    avatarCrop?: AvatarCrop | null;
  };
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  solid?: boolean;
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
  if (avatarSrc) {
    return (
      <div
        className={cn(
          dimension,
          "relative aspect-square flex-none overflow-hidden rounded-full border border-[var(--noodle-accent)]/30",
        )}
      >
        {avatarSrc && (
          <img
            src={avatarSrc}
            alt=""
            decoding="async"
            className="h-full w-full object-cover"
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
