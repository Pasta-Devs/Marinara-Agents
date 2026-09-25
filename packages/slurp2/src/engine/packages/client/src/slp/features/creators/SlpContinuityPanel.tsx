import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AdvancedGroup, SettingsGroup } from "../../modules/settings/SlpSettingsControls";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { formatDateTime } from "../../base/ui/slp-date-time";
import { quietButton, selectClass } from "./slp-creator-classes";
import {
  useSlurpContinuity,
  useSlurpContinuityAction,
  useSlurpContinuityEdit,
  type SlurpContinuityFactView,
  type SlurpContinuityFilters,
} from "./slp-continuity-hooks";
import {
  SLURP_AUDIENCE_SCOPES,
  SLURP_CONTINUITY_EVENT_TYPES,
  SLURP_CONTINUITY_FACT_TYPES,
  SLURP_CONTINUITY_SOURCES,
  SLURP_CONTINUITY_STATUSES,
} from "../../../../../shared/src/slp/slp-continuity.js";

const PROMOTION_TARGETS = ["creator_private", "creator_public", "cross_platform"] as const;

/** `YYYY-MM-DD` of an ISO time in the viewer's time zone, for a date input. */
const localDate = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

type ContinuityLabelKind = "factType" | "eventType" | "scope" | "status" | "source" | "delivery";

/** One label for every stored continuity value, so no raw id like `multi_image_set` reaches the screen. */
export function continuityLabel(t: ReturnType<typeof useTranslation>["t"], kind: ContinuityLabelKind, value: string) {
  const key = kind === "delivery" ? `ui.slurp.composer.delivery.${value}` : `ui.slurp.continuity.${kind}.${value}`;
  return t(key, { defaultValue: value.replaceAll("_", " ") });
}

/**
 * What this Creator remembers, and what is waiting to be remembered.
 *
 * The editor is the one place that sees everything, including records no prompt may read: a fan's
 * private request, a personal disclosure held for review, and the plans behind the posts. Every
 * change here is explicit — approve, reject, edit, retract, or publish — and publishing writes a
 * new public note rather than changing the private one.
 */
export function SlurpContinuityPanel({
  creatorAccountId,
  lifeDetails,
}: {
  creatorAccountId: string;
  /** Shown right after "Waiting for you": what a player corrects most, above the long lists. */
  lifeDetails?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const act = useSlurpContinuityAction(creatorAccountId);
  const edit = useSlurpContinuityEdit(creatorAccountId);
  const [filter, setFilter] = useState("");
  const [filters, setFilters] = useState<SlurpContinuityFilters>({});
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const query = useSlurpContinuity(creatorAccountId, filters);
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);
  const busy = act.isPending || edit.isPending;
  const onError = (error: unknown) => toast.error(errorMessage(error));

  const facts = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase();
    const rows = query.data?.facts ?? [];
    return needle
      ? rows.filter((fact) =>
          `${fact.text} ${fact.subject} ${fact.factType} ${fact.audienceScope} ${fact.status}`
            .toLocaleLowerCase()
            .includes(needle),
        )
      : rows;
  }, [filter, query.data?.facts]);

  if (query.isLoading) {
    return (
      <p className="text-sm text-[var(--slurp-muted)]">
        {t("ui.slurp.continuity.loading", { defaultValue: "Loading…" })}
      </p>
    );
  }

  const scope = (value: string) => continuityLabel(t, "scope", value);
  const factLine = (fact: SlurpContinuityFactView) => (
    <article key={fact.id} className="space-y-2 rounded-lg bg-[var(--slurp-surface-raised)] p-3">
      <p className="text-sm leading-6 text-pretty">
        {draft?.id === fact.id ? (
          <textarea
            rows={3}
            value={draft.text}
            maxLength={500}
            onChange={(event) => setDraft({ id: fact.id, text: event.target.value })}
            className={`${selectClass} min-h-20 py-2`}
          />
        ) : (
          fact.text
        )}
      </p>
      <p className="text-xs text-[var(--slurp-muted)]">
        {continuityLabel(t, "factType", fact.factType)} · {scope(fact.audienceScope)} ·{" "}
        {continuityLabel(t, "status", fact.status)} ·{" "}
        {t(`ui.slurp.continuity.contribution.${fact.contribution}`, { defaultValue: fact.contribution })} ·{" "}
        {formatDateTime(fact.updatedAt, i18n.language)}
      </p>
      {fact.evidence && (
        <p className="text-xs italic text-[var(--slurp-muted)]">
          {t("ui.slurp.continuity.evidence", { defaultValue: "Evidence" })}: “{fact.evidence}”
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {draft?.id === fact.id ? (
          <>
            <button
              type="button"
              className={quietButton}
              disabled={busy}
              onClick={() =>
                edit.mutate({ id: fact.id, text: draft.text }, { onError, onSuccess: () => setDraft(null) })
              }
            >
              {t("ui.slurp.continuity.save", { defaultValue: "Save" })}
            </button>
            <button type="button" className={quietButton} onClick={() => setDraft(null)}>
              {t("ui.slurp.continuity.cancel", { defaultValue: "Cancel" })}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={quietButton}
              disabled={busy || fact.status === "retracted"}
              onClick={() => setDraft({ id: fact.id, text: fact.text })}
            >
              {t("ui.slurp.continuity.edit", { defaultValue: "Edit" })}
            </button>
            <button
              type="button"
              className={quietButton}
              disabled={busy || fact.status === "retracted"}
              onClick={() => act.mutate({ path: `facts/${encodeURIComponent(fact.id)}/retract` }, { onError })}
            >
              {t("ui.slurp.continuity.retract", { defaultValue: "Retract" })}
            </button>
            <select
              className="min-h-9 rounded-lg bg-[var(--slurp-canvas)] px-2 text-xs font-bold ring-1 ring-inset ring-[var(--slurp-outline)]"
              value=""
              disabled={busy || fact.status === "retracted"}
              onChange={(event) =>
                event.target.value &&
                act.mutate(
                  { path: `facts/${encodeURIComponent(fact.id)}/promote`, body: { audienceScope: event.target.value } },
                  { onError },
                )
              }
            >
              <option value="">{t("ui.slurp.continuity.promote", { defaultValue: "Publish to…" })}</option>
              {PROMOTION_TARGETS.filter((target) => target !== fact.audienceScope).map((target) => (
                <option key={target} value={target}>
                  {scope(target)}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </article>
  );

  return (
    <div className="space-y-4">
      <SettingsGroup title={t("ui.slurp.continuity.proposalsGroup", { defaultValue: "Waiting for you" })}>
        {(query.data?.proposals ?? []).length === 0 ? (
          <p className="text-sm text-[var(--slurp-muted)]">
            {t("ui.slurp.continuity.noProposals", { defaultValue: "Nothing is waiting to be remembered." })}
          </p>
        ) : (
          (query.data?.proposals ?? []).map((proposal) => (
            <article key={proposal.id} className="space-y-2 rounded-lg bg-[var(--slurp-surface-raised)] p-3">
              <p className="text-sm leading-6 text-pretty">{String(proposal.candidate.text ?? "")}</p>
              <p className="text-xs text-[var(--slurp-muted)]">
                {continuityLabel(t, "factType", String(proposal.candidate.factType ?? ""))} ·{" "}
                {scope(String(proposal.candidate.audienceScope ?? ""))} ·{" "}
                {t("ui.slurp.continuity.confidence", { defaultValue: "Confidence" })}{" "}
                {Math.round(proposal.confidence * 100)}%
              </p>
              <div className="flex flex-wrap gap-2">
                {(["approve", "reject"] as const).map((decision) => (
                  <button
                    key={decision}
                    type="button"
                    className={quietButton}
                    disabled={busy}
                    onClick={() =>
                      act.mutate({ path: `proposals/${encodeURIComponent(proposal.id)}/${decision}` }, { onError })
                    }
                  >
                    {t(`ui.slurp.continuity.${decision}`, { defaultValue: decision })}
                  </button>
                ))}
              </div>
            </article>
          ))
        )}
      </SettingsGroup>

      {lifeDetails}

      <SettingsGroup title={t("ui.slurp.continuity.factsGroup", { defaultValue: "What they remember" })}>
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label={t("ui.slurp.continuity.search", { defaultValue: "Search notes" })}
          placeholder={t("ui.slurp.continuity.search", { defaultValue: "Search notes" })}
          className={selectClass}
        />
        <AdvancedGroup
          title={
            activeFilters
              ? t("ui.slurp.continuity.filtersActive", { count: activeFilters })
              : t("ui.slurp.continuity.filters")
          }
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["type", "Type", [...SLURP_CONTINUITY_FACT_TYPES, ...SLURP_CONTINUITY_EVENT_TYPES]],
              ["source", "Source", SLURP_CONTINUITY_SOURCES],
              ["scope", "Scope", SLURP_AUDIENCE_SCOPES],
              ["status", "Status", SLURP_CONTINUITY_STATUSES],
            ].map(([key, label, values]) => (
              <label key={String(key)} className="space-y-1 text-xs font-semibold">
                <span>{t(`ui.slurp.continuity.filter.${key}`, { defaultValue: String(label) })}</span>
                <select
                  className={selectClass}
                  value={filters[key as keyof SlurpContinuityFilters] ?? ""}
                  onChange={(event) => setFilters((current) => ({ ...current, [String(key)]: event.target.value }))}
                >
                  <option value="">{t("ui.slurp.continuity.filter.any", { defaultValue: "Any" })}</option>
                  {(values as readonly string[]).map((value) => (
                    <option key={value} value={value}>
                      {continuityLabel(
                        t,
                        key === "type"
                          ? (SLURP_CONTINUITY_FACT_TYPES as readonly string[]).includes(value)
                            ? "factType"
                            : "eventType"
                          : key === "scope"
                            ? "scope"
                            : key === "status"
                              ? "status"
                              : "source",
                        value,
                      )}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="space-y-1 text-xs font-semibold">
              <span>
                {t("ui.slurp.continuity.filter.confidence", { defaultValue: "Minimum confidence" })}:{" "}
                {Math.round(Number(filters.minConfidence || 0) * 100)} %
              </span>
              <input
                className="block h-11 w-full accent-[var(--noodle-accent)]"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={filters.minConfidence || "0"}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    minConfidence: event.target.value === "0" ? "" : event.target.value,
                  }))
                }
              />
            </label>
            {(["from", "to"] as const).map((key) => (
              <label key={key} className="space-y-1 text-xs font-semibold">
                <span>{t(`ui.slurp.continuity.filter.${key}`, { defaultValue: key === "from" ? "From" : "To" })}</span>
                <input
                  className={selectClass}
                  type="date"
                  value={filters[key] ? localDate(filters[key]) : ""}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      // A day filter covers the whole local day on both ends.
                      [key]: event.target.value
                        ? new Date(
                            `${event.target.value}T${key === "from" ? "00:00:00" : "23:59:59.999"}`,
                          ).toISOString()
                        : "",
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </AdvancedGroup>
        {facts.length === 0 ? (
          <p className="text-sm text-[var(--slurp-muted)]">
            {t("ui.slurp.continuity.noFacts", { defaultValue: "Nothing yet." })}
          </p>
        ) : (
          <div className="space-y-2">{facts.map(factLine)}</div>
        )}
      </SettingsGroup>

      <SettingsGroup title={t("ui.slurp.continuity.plansGroup", { defaultValue: "Recent plans" })}>
        {(query.data?.opportunities ?? []).length === 0 ? (
          <p className="text-sm text-[var(--slurp-muted)]">
            {t("ui.slurp.continuity.noPlans", { defaultValue: "No plans yet." })}
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(query.data?.opportunities ?? []).map((plan) => (
              <li key={plan.id} className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">
                  {plan.workflow === "skip"
                    ? t("ui.slurp.continuity.quietSlot", { defaultValue: "Quiet slot" })
                    : t(`ui.slurp.continuity.intent.${plan.intent ?? "unknown"}`, { defaultValue: plan.intent ?? "" })}
                </span>
                <span className="text-xs text-[var(--slurp-muted)]">
                  {plan.skipReason
                    ? t(`ui.slurp.continuity.skipReason.${plan.skipReason}`, { defaultValue: plan.skipReason })
                    : plan.delivery
                      ? continuityLabel(t, "delivery", plan.delivery)
                      : ""}{" "}
                  · {formatDateTime(plan.plannedAt, i18n.language)}
                  {plan.sourceEventId ? ` · ${t("ui.slurp.continuity.promised", { defaultValue: "promised" })}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsGroup>

      <SettingsGroup title={t("ui.slurp.continuity.eventsGroup", { defaultValue: "What happened" })}>
        <ul className="space-y-1 text-sm">
          {(query.data?.events ?? []).slice(0, 25).map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline gap-2">
              <span className="font-semibold">{continuityLabel(t, "eventType", event.eventType)}</span>
              <span className="text-xs text-[var(--slurp-muted)]">
                {scope(event.audienceScope)} · {formatDateTime(event.occurredAt, i18n.language)}
              </span>
            </li>
          ))}
        </ul>
      </SettingsGroup>
    </div>
  );
}
