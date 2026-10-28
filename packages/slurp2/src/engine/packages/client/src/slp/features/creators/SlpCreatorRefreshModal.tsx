import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";

import { Modal } from "../../../components/ui/Modal";

import { Avatar, getSlpAccentStyle, SLP_PINK } from "../../base/chrome/SlpChrome";
import { startSlpTask } from "../../base/state/slp-task-store";
import { countSlurpRefreshOutcomes } from "./slp-refresh-batch";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Create posts now: pick Creators and access; the run goes on in Pulse (task B). */
export function SlpCreatorRefreshModal(page: SlpBackstagePageProps) {
  const {
    t,
    refreshModalOpen,
    setRefreshModalOpen,
    refreshAccountIds,
    setRefreshAccountIds,
    refreshAccess,
    setRefreshAccess,
    refreshCreators,
    automationCreators,
  } = page;
  return (
    <Modal
      open={refreshModalOpen}
      onClose={() => setRefreshModalOpen(false)}
      title={t("ui.slurp.settings.refresh.title")}
      width="max-w-xl"
      panelClassName="noodle-icon-scope"
      panelStyle={getSlpAccentStyle(SLP_PINK, {
        "--background": "var(--slurp-surface)",
        "--foreground": "var(--slurp-text)",
        "--muted-foreground": "var(--slurp-muted)",
        "--border": "color-mix(in srgb, var(--noodle-accent) 24%, transparent)",
        "--accent": "color-mix(in srgb, var(--noodle-accent) 12%, transparent)",
      })}
    >
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{t("ui.slurp.settings.refresh.creators")}</h3>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRefreshAccountIds(new Set(automationCreators.map((creator) => creator.id)))}
                className="text-[var(--noodle-accent-foreground)] hover:underline"
              >
                {t("ui.slurp.settings.refresh.selectAll")}
              </button>
              <button
                type="button"
                onClick={() => setRefreshAccountIds(new Set())}
                className="text-[var(--muted-foreground)] hover:underline"
              >
                {t("ui.slurp.settings.refresh.clear")}
              </button>
            </div>
          </div>
          <div className="mt-2 max-h-64 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)]">
            {automationCreators.map((creator) => (
              <label
                key={creator.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--accent)]/40"
              >
                <input
                  type="checkbox"
                  checked={refreshAccountIds.has(creator.id)}
                  onChange={(event) =>
                    setRefreshAccountIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(creator.id);
                      else next.delete(creator.id);
                      return next;
                    })
                  }
                  className="h-4 w-4 accent-[var(--noodle-accent)]"
                />
                <Avatar account={creator} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{creator.displayName}</span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">@{creator.handle}</span>
                </span>
                {creator.autoPosting.enabled && (
                  <span className="text-[0.625rem] font-semibold text-[var(--noodle-accent-foreground)]">
                    {t("ui.slurp.settings.creators.autoPostShort")}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">{t("ui.slurp.settings.refresh.postAccess")}</legend>
          <div className="mt-2 grid grid-cols-2 rounded-lg border border-[var(--border)] p-1">
            {(["public", "locked"] as const).map((access) => (
              <button
                key={access}
                type="button"
                aria-pressed={refreshAccess === access}
                onClick={() => setRefreshAccess(access)}
                className={`min-h-10 rounded-lg text-sm font-semibold capitalize ${refreshAccess === access ? "bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)]" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}
              >
                {t(`ui.slurp.composer.audience.${access}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="text-xs leading-5 text-[var(--muted-foreground)]">{t("ui.slurp.settings.refresh.modalDetail")}</p>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => setRefreshModalOpen(false)}
            className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-xs font-semibold"
          >
            {t("ui.slurp.actions.cancel")}
          </button>
          <button
            type="button"
            disabled={refreshAccountIds.size === 0}
            onClick={() => {
              // B: "Generate" is a Pulse task. The modal closes at once; Pulse shows the run and each
              // Creator's post, a toast says how it went.
              const accountIds = [...refreshAccountIds];
              setRefreshModalOpen(false);
              void startSlpTask({
                t,
                kind: "generate-posts",
                label: t("ui.slurp.pulse.task.generate", { count: accountIds.length }),
                accountIds,
                run: () => refreshCreators.mutateAsync({ accountIds, access: refreshAccess }),
                done: (result) => ({
                  result: t("ui.slurp.pulse.result.generated", {
                    count: countSlurpRefreshOutcomes(result.outcomes).made,
                  }),
                  target: accountIds[0] ? { accountId: accountIds[0] } : undefined,
                }),
              });
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] disabled:opacity-50"
          >
            <SlpSparkleGlyph size={14} />
            <span>{t("ui.slurp.settings.refresh.generate", { count: refreshAccountIds.size || "" })}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
