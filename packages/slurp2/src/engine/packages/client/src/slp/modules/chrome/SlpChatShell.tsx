// The chat shell for scripted threads (G's thread, the Slurp Support rail): a header with the host
// and an optional status chip, the message list (bubbles, cards, dividers), reply chips, and a
// composer that is shown but switched off. Props in; the thread decides what is said and when.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { slpPrefersReducedMotion } from "../../base/chrome/slp-motion";
import { SlpChip } from "./SlpButton";

/** A chat bubble's surface: the player's own (accent) or the other side's (raised glass). */
export function slurpBubbleSurface(mine: boolean): string {
  return mine
    ? "bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] shadow-[var(--slurp-highlight),0_6px_16px_-10px_color-mix(in_srgb,var(--noodle-accent)_70%,transparent)]"
    : "bg-[color-mix(in_srgb,var(--slurp-surface-raised)_86%,transparent)] text-[var(--slurp-text)] shadow-[var(--slurp-highlight),var(--slurp-shadow-raised)] backdrop-blur-md";
}

export type SlpChatHost = { name: string; avatarUrl: string | null };

export type SlpChatItem =
  /** A text bubble; `mine` is the player's side. */
  | { kind: "bubble"; id: string; text: ReactNode; mine?: boolean }
  /** Rich content inside the list. "host" sits in the host's column, "center" spans the list. */
  | { kind: "card"; id: string; content: ReactNode; align?: "host" | "center" }
  /** A labelled rule across the list ("New"). */
  | { kind: "divider"; id: string; label: string };

export type SlpChatChip = { id: string; label: string; onSelect: () => void; primary?: boolean };

export function SlpChatShell({
  host,
  status,
  headerEnd,
  titleRef,
  items,
  chips = [],
  chipsLabel,
  composer,
  pace = 0,
  scrollTo = null,
  labels,
}: {
  host: SlpChatHost;
  /** A chip after the host name ("Ticket #000001 · Open", "Slurp 0.3.12"). */
  status?: ReactNode;
  /** The end of the header (a close button). */
  headerEnd?: ReactNode;
  /** The host name; it takes `data-autofocus`, so a dialog's first focus lands here. */
  titleRef?: Ref<HTMLHeadingElement>;
  items: readonly SlpChatItem[];
  /** The replies on offer. They show once every item is on screen. */
  chips?: readonly SlpChatChip[];
  chipsLabel?: string;
  /** Shown but switched off: the placeholder says why, the link says where to go instead. */
  composer?: { placeholder: string; link?: { href: string; label: string; icon: ReactNode } };
  /**
   * Milliseconds of typing dots before each host item. Items arrive one at a time; the player's
   * own bubbles appear at once. 0, or reduced motion, shows everything at once.
   */
  pace?: number;
  /** The item to bring into view on open (the "New" divider); otherwise the list follows the bottom. */
  scrollTo?: string | null;
  labels: { log: string; typing: string };
}) {
  const paced = pace > 0 && !slpPrefersReducedMotion();
  const [shown, setShown] = useState(() => (paced ? 0 : items.length));
  // A thread that rewinds (a "Change" in the Support rail) must not skip the pause on its new lines.
  if (paced && shown > items.length) setShown(items.length);
  const visible = paced ? Math.min(shown, items.length) : items.length;
  const pending = items[visible];
  const typing = pending !== undefined && !(pending.kind === "bubble" && pending.mine);
  useEffect(() => {
    if (!paced || visible >= items.length) return;
    const timer = window.setTimeout(() => setShown(visible + 1), typing ? pace : 0);
    return () => window.clearTimeout(timer);
  }, [paced, pace, visible, items.length, typing]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const scrolledTo = useRef<string | null>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const target =
      scrollTo && scrolledTo.current !== scrollTo
        ? list.querySelector<HTMLElement>(`[data-chat-item="${scrollTo}"]`)
        : null;
    if (target) {
      scrolledTo.current = scrollTo;
      list.scrollTop = target.offsetTop - 8;
      return;
    }
    if (scrolledTo.current) return;
    list.scrollTo({ top: list.scrollHeight, behavior: paced ? "smooth" : "auto" });
  }, [visible, paced, scrollTo]);

  const shownItems = items.slice(0, visible);
  const account = { displayName: host.name, avatarUrl: host.avatarUrl };
  return (
    <div className="flex min-h-0 flex-1 flex-col text-[var(--slurp-text)]">
      <header className="flex min-h-14 shrink-0 items-center gap-2.5 border-b border-[var(--noodle-divider)] py-2 ps-3 pe-2">
        <Avatar account={account} size="sm" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <h2 ref={titleRef} tabIndex={-1} data-autofocus className={cn(SLP_TYPE.title, "truncate outline-none")}>
            {host.name}
          </h2>
          {status && (
            <span className="truncate rounded-full bg-[var(--slurp-tint)] px-2 text-[11px] font-bold leading-6 text-[var(--slurp-text)]">
              {status}
            </span>
          )}
        </div>
        {headerEnd}
      </header>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={labels.log}
        className="relative flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {shownItems.map((item, index) => {
          if (item.kind === "divider")
            return (
              <div
                key={item.id}
                data-chat-item={item.id}
                role="separator"
                className="my-2 flex shrink-0 items-center gap-2 text-xs font-bold text-[var(--noodle-accent-foreground)]"
              >
                <span aria-hidden="true" className="h-px flex-1 bg-[var(--noodle-accent)]/45" />
                {item.label}
                <span aria-hidden="true" className="h-px flex-1 bg-[var(--noodle-accent)]/45" />
              </div>
            );
          const mine = item.kind === "bubble" && Boolean(item.mine);
          if (item.kind === "card" && item.align === "center")
            return (
              <div key={item.id} data-chat-item={item.id} className="shrink-0 self-center">
                {item.content}
              </div>
            );
          const previous = shownItems[index - 1];
          const first =
            mine ||
            !previous ||
            previous.kind === "divider" ||
            (previous.kind === "card" && previous.align === "center") ||
            (previous.kind === "bubble" && Boolean(previous.mine));
          return (
            <div
              key={item.id}
              data-chat-item={item.id}
              className={cn(
                "flex max-w-[86%] shrink-0 items-end gap-2 sm:max-w-[78%]",
                mine ? "flex-row-reverse self-end" : "self-start",
                item.kind === "card" && "w-full",
                first && "mt-1.5",
              )}
            >
              {!mine && (
                <span className={cn("w-8 shrink-0", !first && "invisible")} aria-hidden="true">
                  <Avatar account={account} size="sm" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {first && !mine && (
                  <p className={cn(SLP_TYPE.caption, "mb-0.5 px-2 text-[var(--slurp-muted)]")}>{host.name}</p>
                )}
                {item.kind === "card" ? (
                  item.content
                ) : (
                  <p
                    className={cn(
                      "w-fit whitespace-pre-wrap break-words rounded-[1.25rem] px-3.5 py-2 text-[0.95rem] leading-snug text-pretty sm:text-sm sm:leading-relaxed",
                      mine && "ms-auto",
                      slurpBubbleSurface(mine),
                    )}
                  >
                    {item.text}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {paced && typing && (
          <p
            className={cn(
              SLP_TYPE.meta,
              "mt-1 flex shrink-0 items-center gap-2 self-start px-2 text-[var(--slurp-muted)]",
            )}
          >
            <span aria-hidden="true" className="flex gap-0.5">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1.5 animate-bounce rounded-full bg-[var(--noodle-accent)] motion-reduce:animate-none"
                  style={{ animationDelay: `${dot * 120}ms` }}
                />
              ))}
            </span>
            {labels.typing}
          </p>
        )}
      </div>

      {chips.length > 0 && visible === items.length && (
        <div role="group" aria-label={chipsLabel} className="flex shrink-0 flex-wrap justify-end gap-1.5 px-3 pt-2">
          {chips.map((chip) => (
            <SlpChip
              key={chip.id}
              aria-pressed={undefined}
              selected={chip.primary}
              className="min-h-11 px-4"
              onClick={chip.onSelect}
            >
              {chip.label}
            </SlpChip>
          ))}
        </div>
      )}

      {composer && (
        <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <div
            aria-disabled="true"
            className="flex min-h-11 items-center gap-1 rounded-[1.4rem] bg-[var(--slurp-surface)] p-1 ps-3.5 shadow-sm ring-1 ring-inset ring-[var(--noodle-divider)]"
          >
            <p className={cn(SLP_TYPE.body, "min-w-0 flex-1 py-1.5 text-pretty text-[var(--muted-foreground)]")}>
              {composer.placeholder}
            </p>
            {composer.link && (
              <a
                href={composer.link.href}
                target="_blank"
                rel="noreferrer"
                aria-label={composer.link.label}
                title={composer.link.label}
                className="grid size-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
              >
                {composer.link.icon}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
