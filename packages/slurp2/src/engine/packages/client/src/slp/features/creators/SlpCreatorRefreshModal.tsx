import { Loader2, Sparkles } from "lucide-react";

import { toast } from "sonner";

import { Modal } from "../../../components/ui/Modal";

import { Avatar, getNoodleAccentStyle, NOODLE_PINK } from "../../base/chrome/SlpChrome";

import { errorMessage } from "../../../components/slurp/SlurpBackstageWorkflow";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** Create posts now: pick Creators, pick access, and watch the run finish. */
export function SlpCreatorRefreshModal(page: SlpBackstagePageProps) {
  const {
    t,
    refreshModalOpen,
    setRefreshModalOpen,
    refreshAccountIds,
    setRefreshAccountIds,
    refreshRemaining,
    refreshAccess,
    setRefreshAccess,
    accountsQuery,
    refreshCreators,
    automationCreators,
  } = page;
  return (
    <Modal
      open={refreshModalOpen}
      onClose={() => setRefreshModalOpen(false)}
      title={t("ui.slurp.settings.refresh.title")}
      width="max-w-xl"
      closeDisabled={refreshCreators.isPending}
      panelClassName="noodle-icon-scope"
      panelStyle={getNoodleAccentStyle(NOODLE_PINK, {
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
                disabled={refreshCreators.isPending}
                className="text-[var(--noodle-accent)] hover:underline"
              >
                {t("ui.slurp.settings.refresh.selectAll")}
              </button>
              <button
                type="button"
                onClick={() => setRefreshAccountIds(new Set())}
                disabled={refreshCreators.isPending}
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
                  disabled={refreshCreators.isPending}
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
                  <span className="text-[0.625rem] font-semibold text-[var(--noodle-accent)]">
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
                disabled={refreshCreators.isPending}
                onClick={() => setRefreshAccess(access)}
                className={`min-h-10 rounded-lg text-sm font-semibold capitalize ${refreshAccess === access ? "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}
              >
                {access}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="text-xs leading-5 text-[var(--muted-foreground)]">{t("ui.slurp.settings.refresh.modalDetail")}</p>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            disabled={refreshCreators.isPending}
            onClick={() => setRefreshModalOpen(false)}
            className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-xs font-semibold"
          >
            {t("ui.slurp.actions.cancel")}
          </button>
          <button
            type="button"
            disabled={refreshCreators.isPending || refreshAccountIds.size === 0}
            onClick={() =>
              refreshCreators.mutate(
                { accountIds: [...refreshAccountIds], access: refreshAccess },
                {
                  onSuccess: ({ outcomes }) => {
                    const generated = outcomes.filter((outcome) => outcome.status === "generated").length;
                    const skipped = outcomes.filter((outcome) => outcome.status === "skipped").length;
                    const failed = outcomes.length - generated - skipped;
                    setRefreshModalOpen(false);
                    toast.success(t("ui.slurp.settings.refresh.result", { count: generated }));
                    // Name the Creators that did not post, so a short batch is never a mystery.
                    const names = (wanted: (status: string) => boolean) =>
                      outcomes
                        .filter((outcome) => wanted(outcome.status))
                        .map(
                          (outcome) =>
                            accountsQuery.data?.find((creator) => creator.id === outcome.accountId)?.displayName ??
                            outcome.accountId,
                        )
                        .join(", ");
                    if (skipped)
                      toast(t("ui.slurp.settings.refresh.skipped", { count: skipped }), {
                        description: names((status) => status === "skipped"),
                        duration: 10_000,
                      });
                    if (failed)
                      toast.error(t("ui.slurp.settings.refresh.failed", { count: failed }), {
                        description: names((status) => status !== "generated" && status !== "skipped"),
                        duration: 10_000,
                      });
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
          >
            {refreshCreators.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span role={refreshCreators.isPending ? "status" : undefined}>
              {refreshCreators.isPending
                ? t("ui.slurp.settings.refresh.remaining", { count: refreshRemaining })
                : t("ui.slurp.settings.refresh.generate", { count: refreshAccountIds.size || "" })}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
