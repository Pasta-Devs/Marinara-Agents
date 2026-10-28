import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpCoinText } from "../coin/SlpCoin";
import {
  slpDeskActive,
  slpDeskDailyRisk,
  slpDeskTier,
  type SlpDeskTier,
  type SlpSupportDesk,
} from "../../../../../shared/src/slp/slp-support-desk.js";

const TIER_TONE: Record<SlpDeskTier, string> = {
  wary: "bg-[var(--slurp-danger,var(--destructive))]",
  neutral: "bg-[var(--slurp-muted)]",
  cooperative: "bg-[var(--noodle-accent)]",
  partner: "bg-[var(--slurp-success)]",
};

const days = (until: string, at = Date.now()) => Math.max(1, Math.ceil((Date.parse(until) - at) / 86_400_000));

/** The Trust tier as a small chip, for the thread header and the desk rows. */
export function SlpDeskTrustChip({ desk, className }: { desk: SlpSupportDesk; className?: string }) {
  const { t } = useTranslation();
  const tier = slpDeskTier(desk.trust);
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-full bg-[var(--slurp-surface)] px-2 text-[11px] font-bold leading-4 text-[var(--slurp-text)]",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", TIER_TONE[tier])} />
      {t(`ui.slurp.desk.tier.${tier}`, { defaultValue: tier[0]!.toUpperCase() + tier.slice(1) })}
    </span>
  );
}

function Bar({
  label,
  value,
  min,
  max,
  valueText,
  tone,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  valueText: string;
  tone: string;
}) {
  const percent = Math.round(((value - min) / (max - min)) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{label}</span>
        <span className={cn(SLP_TYPE.meta, "font-bold tabular-nums")}>{valueText}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className="h-2 overflow-hidden rounded-full bg-[var(--slurp-surface)]"
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(3, percent)}%` }} />
      </div>
    </div>
  );
}

/**
 * One Creator's case file at the Slurp Support desk (docs/SUPPORT-DESK.md): trust, the risk of being
 * caught, what is running with them, and what happened lately. Props in; the caller adds the actions.
 */
export function SlpDeskCaseFile({
  desk,
  name,
  actions,
  compact = false,
}: {
  desk: SlpSupportDesk;
  name: string;
  actions?: ReactNode;
  /** The desk list shows the meters and status only; the thread's Details show everything. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const tx = (key: string, defaultValue: string, values: Record<string, unknown> = {}) =>
    t(`ui.slurp.desk.${key}`, { defaultValue, ...values });
  const tier = slpDeskTier(desk.trust);
  const risk = Math.round(slpDeskDailyRisk(desk.suspicion) * 100);
  const now = Date.now();
  const status = [
    desk.pausedAt ? tx("status.left", "Left Slurp") : null,
    desk.leaving ? tx("status.leaving", "Leaving in {{count}} days", { count: days(desk.leaving.until, now) }) : null,
    desk.contract?.status === "active" ? tx("status.contract", "Under contract") : null,
    slpDeskActive(desk.featuredUntil)
      ? tx("status.featured", "Featured for {{count}} days", { count: days(desk.featuredUntil!, now) })
      : null,
    desk.throttle && slpDeskActive(desk.throttle.until)
      ? tx("status.throttled", "Throttled for {{count}} days", { count: days(desk.throttle.until, now) })
      : null,
    desk.favours > 0 ? tx("status.favours", "Owes {{count}} favours", { count: desk.favours }) : null,
    ...desk.badges.map((badge) => tx(`badge.${badge}`, badge[0]!.toUpperCase() + badge.slice(1))),
  ].filter((entry): entry is string => Boolean(entry));
  const challenges = desk.challenges.filter((entry) => entry.status === "active");
  return (
    <section aria-label={tx("caseFileOf", "Case file: {{name}}", { name })} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Bar
          label={tx("trust", "Trust")}
          value={desk.trust}
          min={-100}
          max={100}
          valueText={`${tx(`tier.${tier}`, tier)} · ${desk.trust > 0 ? `+${desk.trust}` : desk.trust}`}
          tone={TIER_TONE[tier]}
        />
        <Bar
          label={tx("suspicion", "Suspicion")}
          value={desk.suspicion}
          min={0}
          max={100}
          valueText={tx("risk", "Risk {{count}}% a day", { count: risk })}
          tone={risk >= 30 ? "bg-[var(--slurp-danger,var(--destructive))]" : "bg-[var(--slurp-warning)]"}
        />
      </div>
      {status.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={tx("statusLabel", "Status")}>
          {status.map((entry) => (
            <li
              key={entry}
              className={cn(SLP_TYPE.caption, "rounded-full bg-[var(--slurp-tint)] px-2 py-1 text-[var(--slurp-text)]")}
            >
              {entry}
            </li>
          ))}
        </ul>
      )}
      {!compact && desk.ticket && desk.ticket.status !== "resolved" && (
        <p className={cn(SLP_TYPE.body, "rounded-xl bg-[var(--slurp-surface)] px-3 py-2")}>
          <span className="font-bold">{tx(`ticketStatus.${desk.ticket.status}`, "Open ticket")}</span>
          {" · "}
          {desk.ticket.topic}
        </p>
      )}
      {!compact && challenges.length > 0 && (
        <div className="space-y-2">
          <h3 className={cn(SLP_TYPE.meta, "font-bold")}>{tx("challenges", "Challenges")}</h3>
          {challenges.map((entry) => (
            <Bar
              key={entry.id}
              label={tx(
                `challenge.${entry.metric}`,
                entry.metric === "stories" ? "{{count}} Stories" : "{{count}} posts",
                {
                  count: entry.count,
                },
              )}
              value={Math.min(entry.count, entry.progress)}
              min={0}
              max={entry.count}
              valueText={tx("challengeLeft", "{{progress}}/{{count}} · {{days}} days left", {
                progress: entry.progress,
                count: entry.count,
                days: days(entry.until, now),
              })}
              tone="bg-[var(--noodle-accent)]"
            />
          ))}
        </div>
      )}
      {!compact && desk.contract?.status === "active" && (
        <p className={cn(SLP_TYPE.body, "text-[var(--slurp-muted)]")}>
          <SlpCoinText>
            {tx("contractTerms", "{{count}} posts a week · {{coins}} <coin/> a kept week · {{broken}} weeks missed", {
              count: desk.contract.postsPerWeek,
              coins: desk.contract.weeklyBonus,
              broken: desk.contract.broken,
            })}
          </SlpCoinText>
          {desk.contract.themes.length ? ` · ${desk.contract.themes.join(", ")}` : ""}
        </p>
      )}
      {!compact && desk.intel.some((entry) => !entry.used) && (
        <div className="space-y-1">
          <h3 className={cn(SLP_TYPE.meta, "font-bold")}>{tx("intel", "What they told Support")}</h3>
          <ul className="space-y-1">
            {desk.intel
              .filter((entry) => !entry.used)
              .map((entry) => (
                <li key={entry.id} className={cn(SLP_TYPE.body, "rounded-xl bg-[var(--slurp-surface)] px-3 py-2")}>
                  {entry.text}
                </li>
              ))}
          </ul>
        </div>
      )}
      {actions}
      {!compact && desk.log.length > 0 && (
        <div className="space-y-1">
          <h3 className={cn(SLP_TYPE.meta, "font-bold")}>{tx("history", "Lately")}</h3>
          <ol className="space-y-1">
            {[...desk.log]
              .reverse()
              .slice(0, 8)
              .map((entry) => (
                <li key={`${entry.at}:${entry.text}`} className={cn(SLP_TYPE.meta, "flex items-baseline gap-2")}>
                  <span className="min-w-0 flex-1 text-[var(--slurp-text)]">{entry.text}</span>
                  {(entry.trust !== 0 || entry.suspicion !== 0) && (
                    <span className="shrink-0 tabular-nums text-[var(--slurp-muted)]">
                      {[
                        entry.trust
                          ? tx("logTrust", "Trust {{value}}", {
                              value: entry.trust > 0 ? `+${entry.trust}` : entry.trust,
                            })
                          : null,
                        entry.suspicion
                          ? tx("logSuspicion", "Suspicion {{value}}", {
                              value: entry.suspicion > 0 ? `+${entry.suspicion}` : entry.suspicion,
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </li>
              ))}
          </ol>
        </div>
      )}
    </section>
  );
}
