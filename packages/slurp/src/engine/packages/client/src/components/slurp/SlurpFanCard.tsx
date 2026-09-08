import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { NoodleAnchoredPopover } from "./NoodleAnchoredPopover";
import { useSlurpAudienceMember } from "../../hooks/use-slurp";
import { cn } from "../../lib/utils";

/** Population ids carry this prefix. An id with it has a fan card; an account id does not. */
export const SLURP_AUDIENCE_ID_PREFIX = "slurp-fan:";

/**
 * Who somebody in the audience is, opened from their name.
 *
 * The generated audience has no profile page — no avatar, no post grid, nothing generated — and
 * that constraint is what makes an audience of thousands affordable. So a name was unclickable and
 * told the player nothing: "Moth Hour liked this" is a database row, not a person.
 *
 * This is the card instead. Stage, direction, what they have paid, and what they are like, fetched
 * only when one is actually opened.
 */
export function SlurpFanCard({
  memberId,
  creatorAccountId,
  className,
  children,
}: {
  memberId: string;
  creatorAccountId: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const query = useSlurpAudienceMember(open ? memberId : null, creatorAccountId);
  const member = query.data ?? null;

  // Any click outside closes it. Without this the card follows the player down the feed, because
  // the popover is portalled and nothing else can see the click.
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (anchorRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const facts = member
    ? [
        member.tie ? localizeUi(`ui.slurp.studio.stage.${member.tie.stage}`, { defaultValue: member.tie.stage }) : null,
        member.tie && member.tie.arc !== "steady"
          ? localizeUi(`ui.slurp.studio.arc.${member.tie.arc}`, { defaultValue: member.tie.arc })
          : null,
        member.tie && member.tie.spent > 0
          ? localizeUi("ui.slurp.studio.fanSpent", { defaultValue: "{{count}}", count: member.tie.spent })
          : null,
        ...member.traits,
      ].filter(Boolean)
    : [];

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn("text-left hover:underline", className)}
      >
        {children}
      </button>
      {open && (
        <NoodleAnchoredPopover anchorRef={anchorRef}>
          <div className="px-3 py-2.5">
            {query.isLoading || !member ? (
              <p className="text-xs text-[var(--muted-foreground)]">{localizeUi("ui.slurp.studio.loading")}</p>
            ) : (
              <>
                <p className="text-sm font-bold">{member.displayName}</p>
                <p className="text-xs text-[var(--muted-foreground)]">@{member.handle}</p>
                {facts.length > 0 && <p className="mt-2 text-xs text-[var(--muted-foreground)]">{facts.join(" · ")}</p>}
                <p className="mt-2 text-[0.7rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.audience.aroundSince", {
                    date: new Date(member.tie?.firstSeenAt ?? member.joinedAt).toLocaleDateString(),
                  })}
                </p>
              </>
            )}
          </div>
        </NoodleAnchoredPopover>
      )}
    </>
  );
}

/**
 * "Moth Hour, Cinder Gazette and 412 others."
 *
 * Likes were a number and nothing else, anywhere in Slurp. A number is the same whether one person
 * or a thousand are behind it, and the audience had been writing real like rows all along with a
 * name on every one of them.
 *
 * Only the rows that exist are named; the remainder stays the aggregate it always was. That is the
 * readable-handful rule — names on a few, a count for the rest — and it is also why this costs
 * nothing: no row is written to make the line longer.
 */
export function SlurpLikedBy({
  likes,
  total,
  creatorAccountId,
}: {
  likes: ReadonlyArray<{ actorAccountId: string; actorSnapshot?: { displayName?: string | null } | null }>;
  total: number;
  creatorAccountId: string | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  const named = likes
    .filter((like) => like.actorSnapshot?.displayName)
    .slice(0, 2)
    .map((like) => ({ id: like.actorAccountId, name: like.actorSnapshot!.displayName! }));
  if (named.length === 0) return null;
  const others = Math.max(0, total - named.length);

  return (
    <p className="mt-2 truncate text-xs text-[var(--muted-foreground)]">
      {named.map((liker, index) => (
        <span key={liker.id}>
          {index > 0 && ", "}
          {liker.id.startsWith(SLURP_AUDIENCE_ID_PREFIX) ? (
            <SlurpFanCard memberId={liker.id} creatorAccountId={creatorAccountId} className="font-bold">
              {liker.name}
            </SlurpFanCard>
          ) : (
            <span className="font-bold">{liker.name}</span>
          )}
        </span>
      ))}
      {others > 0 && ` ${localizeUi("ui.slurp.audience.andOthers", { count: others })}`}
      {others === 0 && ` ${localizeUi("ui.slurp.audience.likedThis")}`}
    </p>
  );
}
