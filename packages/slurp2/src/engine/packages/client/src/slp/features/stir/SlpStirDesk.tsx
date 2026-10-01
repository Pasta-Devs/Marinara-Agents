import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown, Headset, MessageCircle } from "lucide-react";
import { api } from "../../../lib/api-client";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_GROUP_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { slpKeys } from "../../base/state/slp-query-keys";
import { SlpButton, SlpChip, slpTagClass } from "../../modules/chrome/SlpButton";
import { SlpEmptyState, SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SlpDeskCaseFile, SlpDeskTrustChip } from "../../modules/desk/SlpDeskCaseFile";
import { useSlurpSettings } from "../settings/slp-settings-contract";
import { SlpYourFile } from "../onboarding/slp-onboarding-contract";
import type { SlpActionName } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpSupportDesk } from "../../../../../shared/src/slp/slp-support-desk.js";

type DeskCase = {
  creator: { id: string; name: string; handle: string; avatarUrl: string | null };
  desk: SlpSupportDesk;
  thread: { id: string; unread: number; lastMessageAt: string; lastMessagePreview: string } | null;
};

const SHOWN = 8;

/** What needs Support first: a Creator leaving, an open ticket, unread lines, then the latest talk. */
function rank(entry: DeskCase): number {
  if (entry.desk.leaving) return 0;
  if (entry.desk.ticket && entry.desk.ticket.status === "open") return 1;
  if ((entry.thread?.unread ?? 0) > 0) return 2;
  if (entry.thread) return 3;
  return 4;
}

/**
 * The Support desk (docs/SUPPORT-DESK.md), at the bottom of Stir: one case file per Creator, the
 * Support chat one tap away, and the desk's own levers. Shady ones only when Settings › Stir allows.
 */
export function SlpStirDesk({
  personaId,
  onOpenThread,
  onPlay,
  onRunSetupAgain,
}: {
  personaId: string | null;
  /** "Your file" reopens the welcome ticket at the questions. */
  onRunSetupAgain?: () => void;
  /** Their Slurp Support chat. */
  onOpenThread?: (creatorId: string) => void;
  onPlay: (action: SlpActionName, who?: string[]) => void;
}) {
  const { t } = useTranslation();
  const tx = (key: string, defaultValue: string, values: Record<string, unknown> = {}) =>
    t(`ui.slurp.desk.${key}`, { defaultValue, ...values });
  const settings = useSlurpSettings();
  const shady = settings.data?.supportDesk?.shadyMoves !== false;
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const query = useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "desk", personaId ?? "none"] as const,
    enabled: Boolean(personaId),
    queryFn: () =>
      api.get<{ cases: DeskCase[]; unread: number }>(`/slurp2/slurp/desk?personaId=${encodeURIComponent(personaId!)}`),
    refetchInterval: personaId ? 60_000 : false,
  });
  const cases = [...(query.data?.cases ?? [])].sort(
    (left, right) =>
      rank(left) - rank(right) ||
      (right.thread?.lastMessageAt ?? "").localeCompare(left.thread?.lastMessageAt ?? "") ||
      left.creator.name.localeCompare(right.creator.name),
  );
  const shown = all ? cases : cases.slice(0, SHOWN);
  const levers: SlpActionName[] = [
    "grant-perk",
    "set-challenge",
    "offer-contract",
    "cash-favour",
    ...(shady ? (["throttle-reach", "plant-rumour"] as const) : []),
  ];
  return (
    <section aria-labelledby="slp-stir-desk" className="space-y-2" data-slp-stir-desk>
      <header className="flex min-h-11 items-center gap-2 px-1">
        <Headset size={18} aria-hidden="true" className="text-[var(--slurp-ink)]" />
        <h2 id="slp-stir-desk" className={SLP_TYPE.title}>
          {tx("title", "Support desk")}
        </h2>
        {(query.data?.unread ?? 0) > 0 && (
          <span className={slpTagClass(true)}>{tx("unread", "{{count}} unread", { count: query.data!.unread })}</span>
        )}
        <SlpButton variant="tertiary" className="ms-auto text-[13px]" onClick={() => onPlay("seed-trend")}>
          {tx("seedTrend", "Seed a trend")}
        </SlpButton>
      </header>
      <p className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>
        {tx(
          "detail",
          "You are Slurp's staff. Every Creator has a case file: how much they trust Slurp, how suspicious they are, and what you have running with them.",
        )}
      </p>
      <SlpYourFile onRunSetupAgain={onRunSetupAgain} />
      {query.isPending ? (
        <SlpSkeleton count={3} label={t("ui.slurp.state.loading")} />
      ) : query.isError && !query.data ? (
        <SlpErrorState title={tx("loadError", "Could not load the desk")} onRetry={() => void query.refetch()} />
      ) : cases.length === 0 ? (
        <SlpEmptyState icon={Headset} title={tx("empty", "No Creators to look after yet")} />
      ) : (
        <div className={SLP_GROUP_CLASS}>
          {shown.map((entry) => {
            const expanded = open === entry.creator.id;
            const unread = entry.thread?.unread ?? 0;
            const panelId = `slp-desk-case-${entry.creator.id}`;
            return (
              <div key={entry.creator.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpen(expanded ? null : entry.creator.id)}
                  className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
                >
                  <Avatar account={{ displayName: entry.creator.name, avatarUrl: entry.creator.avatarUrl }} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-bold leading-5">{entry.creator.name}</span>
                      <SlpDeskTrustChip desk={entry.desk} className="shrink-0" />
                    </span>
                    <span className="block truncate text-xs leading-4 text-[var(--slurp-muted)]">
                      {entry.desk.pausedAt
                        ? tx("status.left", "Left Slurp")
                        : entry.desk.leaving
                          ? tx("rowLeaving", "Thinking about leaving")
                          : entry.desk.ticket && entry.desk.ticket.status !== "resolved"
                            ? `${tx("ticketStatus.open", "Open ticket")} · ${entry.desk.ticket.topic}`
                            : (entry.thread?.lastMessagePreview ?? tx("noTalk", "No talk with Support yet"))}
                    </span>
                  </span>
                  {unread > 0 && <span className={slpTagClass(true)}>{unread}</span>}
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className={cn(
                      "shrink-0 text-[var(--slurp-muted)] transition-transform motion-reduce:transition-none",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                {expanded && (
                  <div id={panelId} className="px-3 pb-3 pt-1">
                    <SlpDeskCaseFile
                      desk={entry.desk}
                      name={entry.creator.name}
                      actions={
                        <div className="flex flex-wrap gap-1.5">
                          {onOpenThread && (
                            <SlpChip selected onClick={() => onOpenThread(entry.creator.id)}>
                              <MessageCircle size={14} aria-hidden="true" />
                              {tx("openChat", "Talk as Support")}
                            </SlpChip>
                          )}
                          {levers.map((action) => (
                            <SlpChip key={action} onClick={() => onPlay(action, [entry.creator.id])}>
                              {t(`ui.slurp.stir.card.${action}.title`)}
                            </SlpChip>
                          ))}
                        </div>
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
          {cases.length > SHOWN && (
            <button
              type="button"
              onClick={() => setAll((value) => !value)}
              className="min-h-11 w-full px-4 text-start text-[13px] font-semibold text-[var(--slurp-ink)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
            >
              {all
                ? tx("showFewer", "Show fewer")
                : tx("showAll", "Show all {{count}} Creators", { count: cases.length })}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
