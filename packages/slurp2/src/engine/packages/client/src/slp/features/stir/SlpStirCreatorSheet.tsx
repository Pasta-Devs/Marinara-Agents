import { useEffect, useState } from "react";
import { ChevronDown, MessageCircleHeart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import type { SlpActionName } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpStirPlan, SlpStirPlanRequest } from "../../../../../shared/src/slp/slp-stir.js";
import { SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SlpCreatorSteeringCard } from "../creators/slp-creators-contract";
import { useSlurpUIStore } from "../../base/state/slp-package-store";
import { openSlpStir, setSlpStirDraft, useSlpStirSheet } from "../../base/state/slp-stir-sheet-store";
import { useSlurpStir } from "./slp-stir-hooks";
import { SlpStirBox } from "./SlpStirBox";
import { SlpStirPlanSheet } from "./SlpStirCards";
import { SlpStirPlaySheet } from "./SlpStirPlaySheet";
import { SLP_STIR_DECK } from "./slp-stir-deck";

/** The quick levers on a Creator, most used first. Each opens its card with them already picked. */
const QUICK: SlpActionName[] = [
  "add-idea",
  "write-post",
  "set-up-couple",
  "suggest-collab",
  "start-rivalry",
  "steer-creator",
  "start-storyline",
  "new-look",
  "steer-storyline",
];

/**
 * The ✦ sheet (W): Stir, from the Creator or post you are looking at. The same box (about them),
 * their quick cards, the full steering (moved here from Creator tools), and a way to talk to them as
 * Slurp Support. Mounted once in the app; opened from a profile, a post's ⋯ or Creator tools.
 */
export function SlpStirCreatorSheet({
  personaId,
  onOpenSupport,
}: {
  personaId: string | null;
  /** Talk to them as Slurp Support (their Support thread). */
  onOpenSupport?: (creatorId: string) => void;
}) {
  const { t } = useTranslation();
  const { target, close } = useSlpStirSheet();
  // Kept after the sheet closes, so the plan and card sheets it opens stay about them.
  const [about, setAbout] = useState(target);
  const [steerOpen, setSteerOpen] = useState(false);
  useEffect(() => {
    if (!target) return;
    setAbout(target);
    // Each Creator's sheet opens as it starts, not as the last one was left.
    setSteerOpen(false);
  }, [target]);
  // Keyed on `about`, not `target`: a quick card's play sheet closes this sheet (one overlay at a
  // time), and a "none" key would leave the play sheet with no Creators, couples or storylines.
  const query = useSlurpStir(about ? personaId : null);
  const view = query.data;
  const [playing, setPlaying] = useState<SlpActionName | null>(null);
  const [plan, setPlan] = useState<{
    plan: SlpStirPlan;
    key: number;
    request: Omit<SlpStirPlanRequest, "followUp">;
  } | null>(null);
  const creator = view?.creators.find((entry) => entry.id === about?.creatorId);
  const name = creator?.name ?? "";
  const hasStoryline = Boolean(view?.storylines.some((story) => story.accountId === about?.creatorId));
  const quick = QUICK.filter((action) =>
    action === "steer-storyline"
      ? hasStoryline
      : action === "add-idea" || action === "write-post" || action === "steer-creator" || action === "start-storyline"
        ? creator?.automatic
        : true,
  );
  return (
    <>
      <SlpSheet
        open={Boolean(target)}
        onClose={close}
        back
        title={name ? t("ui.slurp.stir.sheetTitle", { name }) : t("ui.slurp.stir.title")}
      >
        <div className="space-y-4 px-2 pb-2" data-slp-stir-sheet>
          {query.isPending && <SlpSkeleton shape="card" count={2} label={t("ui.slurp.state.loading")} />}
          {query.isError && !view && (
            <SlpErrorState title={t("ui.slurp.stir.loadError")} onRetry={() => void query.refetch()} />
          )}
          {creator && (
            <div className="flex items-center gap-3 px-1">
              <Avatar account={{ displayName: creator.name, avatarUrl: creator.avatarUrl }} size="md" />
              <p className={cn(SLP_TYPE.meta, "min-w-0 flex-1 text-[var(--slurp-muted)]")}>
                {target?.postId ? t("ui.slurp.stir.sheetPost", { name }) : t("ui.slurp.stir.sheetIntro", { name })}
              </p>
            </div>
          )}
          {creator && (
            <SlpStirBox
              names={(view?.creators ?? []).filter((entry) => !entry.couplePage).map((entry) => entry.name)}
              about={{ id: creator.id, name: creator.name }}
              postId={target?.postId}
              personaId={personaId}
              onPlan={(answer, request) => setPlan({ plan: answer, key: Date.now(), request })}
            />
          )}
          {view && (
            <section aria-labelledby="slp-stir-quick" className="space-y-2">
              <h3 id="slp-stir-quick" className={cn(SLP_TYPE.title, "px-1")}>
                {t("ui.slurp.stir.quick", { name })}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {quick.map((action) => {
                  const Icon = SLP_STIR_DECK[action].icon;
                  return (
                    <button
                      key={action}
                      type="button"
                      onClick={() => {
                        if (action === "write-post" && creator) {
                          close();
                          const store = useSlurpUIStore.getState();
                          store.setComposeGuide({ accountId: creator.id, idea: "" });
                          store.setNavigation({ mode: "creator", view: "profile", accountId: creator.id });
                        } else setPlaying(action);
                      }}
                      className="flex min-h-12 items-center gap-2.5 rounded-2xl bg-[var(--slurp-canvas)] px-3 py-2 text-start ring-1 ring-inset ring-[var(--slurp-outline)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none [&_svg]:!text-[var(--slurp-ink)]"
                    >
                      <Icon size={18} aria-hidden="true" className="shrink-0" />
                      <span className={cn(SLP_TYPE.body, "min-w-0 flex-1 font-semibold")}>
                        {t(
                          action === "write-post"
                            ? "ui.slurp.postGuide.draftInComposer"
                            : `ui.slurp.stir.card.${action}.title`,
                        )}
                      </span>
                      {SLP_STIR_DECK[action].ai && <SlpUsesAiMark />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {creator?.automatic && !creator.couplePage && (
            <section className="rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
              <button
                type="button"
                aria-expanded={steerOpen}
                onClick={() => setSteerOpen((open) => !open)}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
              >
                <span className="min-w-0 flex-1">
                  <span className={cn(SLP_TYPE.body, "block font-semibold")}>{t("ui.slurp.stir.steer", { name })}</span>
                  <span className={cn(SLP_TYPE.meta, "block truncate text-[var(--slurp-muted)]")}>
                    {t("ui.slurp.stir.steerDetail")}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-[var(--slurp-muted)] transition-transform motion-reduce:transition-none",
                    steerOpen && "rotate-180",
                  )}
                />
              </button>
              {steerOpen && (
                <div className="border-t border-[var(--noodle-divider)] px-4 pb-4 pt-3">
                  <SlpCreatorSteeringCard creatorId={creator.id} name={creator.name} />
                </div>
              )}
            </section>
          )}
          {creator && onOpenSupport && (
            <button
              type="button"
              onClick={() => {
                close();
                onOpenSupport(creator.id);
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-start text-[var(--slurp-ink)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-current"
            >
              <MessageCircleHeart size={18} aria-hidden="true" className="shrink-0" />
              <span className={cn(SLP_TYPE.body, "min-w-0 flex-1 font-semibold")}>
                {t("ui.slurp.stir.talkAsSupport", { name })}
              </span>
            </button>
          )}
        </div>
      </SlpSheet>
      <SlpStirPlaySheet
        action={playing}
        prefill={about ? { who: [about.creatorId] } : undefined}
        view={view}
        onClose={() => setPlaying(null)}
      />
      <SlpStirPlanSheet
        key={plan?.key ?? 0}
        open={Boolean(plan)}
        onClose={() => setPlan(null)}
        onChangeWords={() => {
          setPlan(null);
          if (about) openSlpStir(about);
        }}
        onPlayed={() => about && setSlpStirDraft(`creator:${about.creatorId}`, "")}
        cards={plan?.plan.cards ?? []}
        cant={plan?.plan.cant ?? []}
        question={plan?.plan.question ?? null}
        request={plan?.request}
        origin="sheet"
      />
    </>
  );
}
