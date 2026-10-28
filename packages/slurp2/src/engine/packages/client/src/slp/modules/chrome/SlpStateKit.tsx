import { ExternalLink, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_DISCORD_BUG_URL, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpTwinkle } from "../sparkle/SlpSparkle";
import { SlpButton } from "./SlpButton";
import { SlpSheet, SlpSheetItem } from "./SlpSheet";

// The state kit (design language §7): a wait looks like the content it waits for, a failure says what
// failed and offers Try again, and an empty list says what to do next.

/** After this long a wait says so, so a slow Engine never looks frozen. */
const STILL_CONNECTING_MS = 4000;

const BONE = "animate-pulse bg-[color-mix(in_srgb,var(--slurp-text)_9%,transparent)] motion-reduce:animate-none";

function Bone({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("block", BONE, className)} />;
}

/**
 * A skeleton shaped like the content it stands in for: `rows` (inbox, lists, followers), `thread`
 * (chat bubbles), `card` (wallet, Studio: a big block and rows), `stories` (the Story shelf), `hub`
 * (the whole hub while Slurp itself loads: a Story row and two post cards), `posts` (two post cards)
 * `grid` (a 3-column media grid) or `creators` (Discover: a Featured banner and a 2-column card grid).
 */
export function SlpSkeleton({
  shape = "rows",
  count = 4,
  label,
  waitText,
}: {
  shape?: "rows" | "thread" | "card" | "stories" | "hub" | "posts" | "grid" | "creators";
  count?: number;
  label?: string;
  /** What the wait line says now ("Retrying…"); shown at once and in place of "Still connecting…". */
  waitText?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [late, setLate] = useState(false);
  const slow = late || Boolean(waitText);
  useEffect(() => {
    const timer = window.setTimeout(() => setLate(true), STILL_CONNECTING_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const items = Array.from({ length: count }, (_, index) => index);
  const stillConnecting = (
    <p
      className={cn(
        SLP_TYPE.meta,
        "text-[var(--slurp-muted)]",
        shape === "stories"
          ? "px-2"
          : shape === "hub" || shape === "creators"
            ? "pb-4 text-center"
            : "pt-3 text-center",
      )}
    >
      {waitText ?? localizeUi("ui.slurp.state.stillConnecting", { defaultValue: "Still connecting…" })}
    </p>
  );
  return (
    <div role="status" aria-busy="true" className={cn(shape === "stories" ? "flex items-center gap-2.5" : "px-4 py-4")}>
      <span className="sr-only">{label ?? localizeUi("ui.slurp.state.loading", { defaultValue: "Loading…" })}</span>
      {/* The hub and Discover skeletons are taller than a phone, so their wait message leads instead of trailing. */}
      {slow && (shape === "hub" || shape === "creators") && stillConnecting}
      {shape === "rows" &&
        items.map((index) => (
          <div key={index} className="flex items-center gap-3 py-2.5">
            <Bone className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className={cn("h-3 rounded-full", index % 2 ? "w-2/5" : "w-1/2")} />
              <Bone className={cn("h-3 rounded-full", index % 2 ? "w-4/5" : "w-3/5")} />
            </div>
          </div>
        ))}
      {shape === "thread" && (
        <div className="space-y-3">
          {items.map((index) => (
            <Bone
              key={index}
              className={cn(
                "h-10 rounded-2xl",
                index % 2 ? "ms-auto w-1/2 rounded-ee-md" : "w-3/5 rounded-es-md",
                index % 3 === 2 && "h-16",
              )}
            />
          ))}
        </div>
      )}
      {shape === "card" && (
        <div className="space-y-3">
          <Bone className="h-32 rounded-2xl" />
          {items.map((index) => (
            <div key={index} className="flex items-center justify-between gap-4 py-1.5">
              <Bone className={cn("h-3 rounded-full", index % 2 ? "w-1/3" : "w-1/2")} />
              <Bone className="h-3 w-12 rounded-full" />
            </div>
          ))}
        </div>
      )}
      {shape === "stories" &&
        items.map((index) => (
          <Bone
            key={index}
            className="h-[8.25rem] w-[5.5rem] shrink-0 rounded-2xl @min-[1024px]:h-[9rem] @min-[1024px]:w-[6rem]"
          />
        ))}
      {shape === "creators" && (
        <div className="space-y-4">
          <Bone className="aspect-[4/3] w-[86%] rounded-3xl" />
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="space-y-2 rounded-2xl pb-3">
                <Bone className="aspect-[16/10] w-full rounded-2xl" />
                <Bone className="h-3 w-3/5 rounded-full" />
                <Bone className="h-3 w-4/5 rounded-full" />
                <Bone className="h-11 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      )}
      {shape === "grid" && (
        <div className="grid grid-cols-3 gap-0.5">
          {Array.from({ length: 9 }, (_, index) => (
            <Bone key={index} className="aspect-square rounded-md" />
          ))}
        </div>
      )}
      {(shape === "hub" || shape === "posts") && (
        <div className="space-y-6">
          {shape === "hub" && (
            <div className="flex gap-2.5 overflow-hidden">
              {items.map((index) => (
                <Bone key={index} className="h-[8.25rem] w-[5.5rem] shrink-0 rounded-2xl" />
              ))}
            </div>
          )}
          {[0, 1].map((card) => (
            <div key={card} className="space-y-3">
              <div className="flex items-center gap-3">
                <Bone className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Bone className="h-3 w-2/5 rounded-full" />
                  <Bone className="h-3 w-1/4 rounded-full" />
                </div>
              </div>
              <Bone className="h-3 w-4/5 rounded-full" />
              <Bone className="h-48 rounded-xl" />
            </div>
          ))}
        </div>
      )}
      {slow && shape !== "hub" && shape !== "creators" && stillConnecting}
    </div>
  );
}

// ponytail: reports leave Slurp (Discord channel or a prefilled GitHub issue); swap for an in-app report flow if one appears.
const BUG_REPORT_URL = "https://github.com/Pasta-Devs/Marinara-Agents/issues/new";
const bugReportHref = (cause: string) =>
  `${BUG_REPORT_URL}?${new URLSearchParams({
    title: `Slurp: ${cause}`,
    body: `What I was doing:\n\nWhat Slurp said: ${cause}\n`,
  }).toString()}`;

/** "Report bug": a small sheet with the two places a report can go. */
function SlpReportBug({ cause }: { cause: string }) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openLink = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  };
  const title = localizeUi("ui.slurp.state.reportBug", { defaultValue: "Report bug" });
  return (
    <>
      <SlpButton
        ref={triggerRef}
        variant="tertiary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
      </SlpButton>
      <SlpSheet open={open} onClose={() => setOpen(false)} title={title} kind="menu" anchorRef={triggerRef}>
        <SlpSheetItem onSelect={() => openLink(SLP_DISCORD_BUG_URL)}>
          <MessageCircle aria-hidden="true" />
          {localizeUi("ui.slurp.state.reportOnDiscord", { defaultValue: "Report on Discord" })}
        </SlpSheetItem>
        <SlpSheetItem onSelect={() => openLink(bugReportHref(cause))}>
          <ExternalLink aria-hidden="true" />
          {localizeUi("ui.slurp.state.openGithubIssue", { defaultValue: "Open GitHub issue" })}
        </SlpSheetItem>
      </SlpSheet>
    </>
  );
}

/** A failure: an icon, what failed, that nothing was lost, Try again, and a way to report it. */
export function SlpErrorState({
  title,
  detail,
  onRetry,
}: {
  title?: string;
  /** Replaces the default "Nothing was lost" line when the cause needs its own explanation. */
  detail?: string;
  onRetry: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const cause = title ?? localizeUi("ui.slurp.state.error", { defaultValue: "Could not load this" });
  return (
    <div role="alert" className="px-8 py-10 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--slurp-warning)_14%,transparent)] text-[var(--slurp-warning)]">
        <TriangleAlert size={24} aria-hidden="true" className="!text-current" />
      </span>
      <p className={cn(SLP_TYPE.title, "mt-4")}>{cause}</p>
      <p className={cn(SLP_TYPE.body, "mx-auto mt-1.5 max-w-sm text-[var(--slurp-muted)]")}>
        {detail ??
          localizeUi("ui.slurp.state.errorDetail", {
            defaultValue: "Nothing was lost. Check your connection and try again.",
          })}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <SlpButton onClick={onRetry}>{localizeUi("capabilities.actions.tryAgain")}</SlpButton>
        <SlpReportBug cause={cause} />
      </div>
    </div>
  );
}

/** An empty list: a twinkling icon, what is missing, and the next thing to do. */
export function SlpEmptyState({
  title,
  detail,
  action,
  onAction,
  icon: Icon = SlpSparkleGlyph,
}: {
  title: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}) {
  return (
    <div className="px-8 py-8 text-center sm:py-14">
      <span className="relative isolate mx-auto grid size-20 place-items-center">
        <SlpTwinkle />
        <span className="grid size-14 place-items-center rounded-full bg-[var(--slurp-tint)] text-[var(--slurp-ink)] shadow-[var(--slurp-highlight)]">
          <Icon size={24} aria-hidden="true" className="!text-current" />
        </span>
      </span>
      <p className={cn(SLP_TYPE.title, "mt-3")}>{title}</p>
      {detail && <p className={cn(SLP_TYPE.body, "mx-auto mt-1.5 max-w-sm text-[var(--slurp-muted)]")}>{detail}</p>}
      {action && onAction && (
        <SlpButton onClick={onAction} className="mt-5">
          {action}
        </SlpButton>
      )}
    </div>
  );
}
