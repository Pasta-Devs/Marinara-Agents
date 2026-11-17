import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SlpCreatorManagedStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import { Modal } from "../../../components/ui/Modal";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { Avatar, getSlpAccentStyle, SLP_PINK } from "../../base/chrome/SlpChrome";
import { startSlpTask } from "../../base/state/slp-task-store";
import { quietButton } from "./slp-creator-classes";
import { useCreatorAppearanceAction } from "./slp-creator-profile-hooks";
import { Checkbox } from "../../../components/ui/Checkbox";

/**
 * Refresh looks from cards: the player ticks Creators, Slurp drafts each look again from the
 * card. A Stage look is saved again as the Stage look; a drafted look only gets a fresh draft. Slurp
 * cannot tell a copied Stage look from an edited one, so nothing is ticked at first.
 */
export function SlpCreatorLooksRefresh({ creators }: { creators: readonly SlpCreatorManagedStageProfile[] }) {
  const { t } = useTranslation();
  const appearanceAction = useCreatorAppearanceAction();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // A "linked" look already follows the card's own appearance text.
  const withCard = creators.filter((creator) => creator.sourceAccountId && creator.appearanceState.source !== "linked");
  if (!withCard.length) return null;

  const run = () => {
    const chosen = withCard.filter((creator) => picked.has(creator.id));
    setOpen(false);
    setPicked(new Set());
    void startSlpTask({
      t,
      kind: "refresh-looks",
      label: t("ui.slurp.settings.looks.task", { count: chosen.length }),
      accountIds: chosen.map((creator) => creator.id),
      run: async (progress) => {
        let refreshed = 0;
        for (const [index, creator] of chosen.entries()) {
          progress(`${index + 1}/${chosen.length}`);
          try {
            await appearanceAction.mutateAsync({ accountId: creator.id, action: "regenerate" });
            if (creator.appearanceState.source === "override") {
              await appearanceAction.mutateAsync({ accountId: creator.id, action: "keep_override" });
            }
            refreshed += 1;
          } catch {
            // The Creator keeps the old look; the end line counts it as failed.
          }
        }
        if (!refreshed) throw new Error(t("ui.slurp.settings.looks.allFailed"));
        return refreshed;
      },
      done: (refreshed) => ({
        result:
          refreshed === chosen.length
            ? t("ui.slurp.settings.looks.done", { count: refreshed })
            : t("ui.slurp.settings.looks.partly", { count: refreshed, failed: chosen.length - refreshed }),
      }),
    });
  };

  const badge = (source: SlpCreatorManagedStageProfile["appearanceState"]["source"]) =>
    t(`ui.slurp.settings.looks.source.${source}`);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={quietButton}>
        <SlpSparkleGlyph size={14} className="text-[var(--noodle-accent-foreground)]" aria-hidden="true" />
        {t("ui.slurp.settings.looks.open")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("ui.slurp.settings.looks.open")}
        width="max-w-xl"
        panelClassName="noodle-icon-scope"
        panelStyle={{
          ...getSlpAccentStyle(SLP_PINK),
          ["--background" as string]: "var(--slurp-surface)",
          ["--foreground" as string]: "var(--slurp-text)",
          ["--muted-foreground" as string]: "var(--slurp-muted)",
          ["--border" as string]: "color-mix(in srgb, var(--noodle-accent) 24%, transparent)",
          ["--accent" as string]: "color-mix(in srgb, var(--noodle-accent) 12%, transparent)",
        }}
      >
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{t("ui.slurp.settings.looks.list")}</h3>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPicked(new Set(withCard.map((creator) => creator.id)))}
                  className="text-[var(--noodle-accent-foreground)] hover:underline"
                >
                  {t("ui.slurp.settings.refresh.selectAll")}
                </button>
                <button
                  type="button"
                  onClick={() => setPicked(new Set())}
                  className="text-[var(--muted-foreground)] hover:underline"
                >
                  {t("ui.slurp.settings.refresh.clear")}
                </button>
              </div>
            </div>
            <div className="mt-2 max-h-80 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)]">
              {withCard.map((creator) => (
                <label
                  key={creator.id}
                  className="flex min-h-12 cursor-pointer items-start gap-3 px-3 py-2 hover:bg-[var(--accent)]/40"
                >
                  <Checkbox
                    checked={picked.has(creator.id)}
                    onChange={(event) =>
                      setPicked((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(creator.id);
                        else next.delete(creator.id);
                        return next;
                      })
                    }
                    className="mt-1 h-4 w-4 accent-[var(--noodle-accent)]"
                  />
                  <Avatar account={creator} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{creator.displayName}</span>
                      <span className="rounded-full bg-[var(--accent)] px-1.5 text-[0.625rem] font-semibold text-[var(--noodle-accent-foreground)]">
                        {badge(creator.appearanceState.source)}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs text-[var(--muted-foreground)]">
                      {creator.appearanceState.text || t("ui.slurp.settings.looks.none")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">{t("ui.slurp.settings.looks.detail")}</p>
          <p className="text-xs font-semibold">{t("ui.slurp.settings.looks.cost")}</p>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-xs font-semibold"
            >
              {t("ui.slurp.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={run}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] disabled:opacity-50"
            >
              <SlpSparkleGlyph size={14} />
              <span>{t("ui.slurp.settings.looks.run", { count: picked.size })}</span>
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
