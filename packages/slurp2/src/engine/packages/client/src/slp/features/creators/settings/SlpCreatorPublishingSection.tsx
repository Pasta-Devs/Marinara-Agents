import { CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { showConfirmDialog } from "../../../../lib/app-dialogs";
import { ScheduleAgenda } from "../../../modules/settings/SlpBackstageKit";
import { errorMessage } from "../../../modules/settings/slp-backstage-format";
import { SettingsGroup, Toggle } from "../../../modules/settings/SlpSettingsControls";
import {
  useCreatorReserveStatus,
  useUpdateCreatorAutoPosting,
  useUpdateCreatorScheduleSlot,
} from "../../feed/slp-feed-contract";
import {
  SlurpPostGuidanceField,
  useSlurpPostGuidance,
  useUpdateSlurpPostGuidance,
} from "../../settings/slp-post-guidance-contract";
import { accentButton, noteClass, quietButton } from "../slp-creator-classes";
import { SlpSpiceLevelChoice } from "../SlpSpiceLevelChoice";
import { useSlurpSpice } from "../slp-spice-hooks";
import { slpExplicitOfStep, slpSpiceStepOf } from "../../../../../../shared/src/slp/slp-spice.js";
import { useSlpPersonaBackedCreator } from "../slp-creators-hooks";
import { useRefreshCreatorConversationSchedule } from "../slp-creator-refresh-hooks";
import type { SlpCreatorSettingsSectionProps } from "./slp-creator-settings-contract";

/**
 * How and when this Creator publishes: automation, the prepared slots, production strategy, the
 * directions their posts follow, collabs, and what they will and will not do.
 *
 * The prepared slots used to be a modal opened from Backstage. Inside the settings modal they are
 * a group like any other, so editing a slot no longer stacks a dialog on top of a dialog.
 */
export function SlpCreatorPublishingSection({ creator, active, mode = "automation" }: SlpCreatorSettingsSectionProps) {
  const { t } = useTranslation();
  const updateAuto = useUpdateCreatorAutoPosting();
  const updateScheduleSlot = useUpdateCreatorScheduleSlot();
  const refreshConversationSchedule = useRefreshCreatorConversationSchedule();
  const reserveStatusQuery = useCreatorReserveStatus(active);
  const postGuidanceQuery = useSlurpPostGuidance(active);
  const spiceQuery = useSlurpSpice();
  const updatePostGuidance = useUpdateSlurpPostGuidance();
  const personaBacked = useSlpPersonaBackedCreator(creator);
  const slots = reserveStatusQuery.data?.creators.find((entry) => entry.accountId === creator.id)?.slots ?? [];

  return (
    <div className="space-y-5">
      {mode === "automation" && (
        <SettingsGroup title={t("ui.slurp.settings.creators.postingGroup")}>
          {personaBacked ? (
            <p className={noteClass}>{t("ui.slurp.settings.creators.personaAutomationDetail")}</p>
          ) : (
            <Toggle
              label={t("ui.slurp.settings.creators.autoPost")}
              value={creator.autoPosting.enabled}
              onChange={(value) =>
                updateAuto.mutate(
                  { accountId: creator.id, enabled: value },
                  { onError: (error) => toast.error(errorMessage(error)) },
                )
              }
            />
          )}
          {/* The switch and what it will post next, in one card. */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">{t("ui.slurp.settings.creators.postingSchedule")}</h4>
            <p className={noteClass}>{t("ui.slurp.settings.creators.scheduleDetail")}</p>
            {reserveStatusQuery.isLoading ? (
              <div
                className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--slurp-muted)]"
                role="status"
              >
                <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {t("ui.noodle.noodlerschedulemanagermodal.loadingStatus")}
              </div>
            ) : reserveStatusQuery.isError ? (
              <div className="rounded-lg p-4 text-sm ring-1 ring-inset ring-[var(--slurp-danger)]/30">
                <p>{t("ui.noodle.noodlerschedulemanagermodal.couldNotLoadStatus")}</p>
                <button
                  type="button"
                  onClick={() => void reserveStatusQuery.refetch()}
                  className={`mt-3 ${quietButton}`}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  {t("capabilities.actions.tryAgain")}
                </button>
              </div>
            ) : slots.length > 0 ? (
              <ScheduleAgenda
                slots={slots}
                pending={updateScheduleSlot.isPending}
                onMove={async (slot, publishAt) => {
                  try {
                    await updateScheduleSlot.mutateAsync({ slotId: slot.id, publishAt });
                    toast.success(t("ui.slurp.settings.creators.scheduleSaved"));
                  } catch (error) {
                    toast.error(errorMessage(error));
                  }
                }}
              />
            ) : (
              <p className={noteClass}>{t("ui.slurp.settings.creators.scheduleEmpty")}</p>
            )}
          </div>
        </SettingsGroup>
      )}

      {/* A creator who fishes for subscribers in public and pays it off behind the paywall needs
          their own two directions; empty means the global ones apply. */}
      {mode === "content-rules" && (
        <SettingsGroup title={t("ui.slurp.settings.creators.guidanceGroup")}>
          <p className={noteClass}>{t("ui.slurp.settings.creators.guidanceDetail")}</p>
          {/* The one spice scale (0.3.17): this Creator's level for text and pictures. */}
          {postGuidanceQuery.data && (
            <SlpSpiceLevelChoice
              label={t("ui.slurp.spice.level", { name: creator.displayName })}
              value={slpSpiceStepOf(postGuidanceQuery.data.creators[creator.id]?.level)}
              inherited={
                slpSpiceStepOf(postGuidanceQuery.data.defaults.level || postGuidanceQuery.data.builtInLevel) ?? "flirty"
              }
              max={spiceQuery.data?.spice.max ?? "explicit"}
              disabled={updatePostGuidance.isPending}
              onChange={(step) =>
                updatePostGuidance.mutate(
                  { creatorId: creator.id, level: step ? slpExplicitOfStep(step) : "" },
                  { onError: (error) => toast.error(errorMessage(error)) },
                )
              }
            />
          )}
          {(["public", "locked"] as const).map((access) => (
            <SlurpPostGuidanceField
              key={access}
              access={access}
              creatorId={creator.id}
              guidance={postGuidanceQuery.data}
              inherited={
                postGuidanceQuery.data
                  ? postGuidanceQuery.data.defaults[access] || postGuidanceQuery.data.builtIn[access]
                  : ""
              }
              label={t(`ui.slurp.settings.prompts.${access}Guidance`)}
              detail={t("ui.slurp.settings.creators.guidanceInherits")}
              clearLabel={t("ui.slurp.settings.creators.guidanceInherit")}
              savedMessage={t("ui.slurp.settings.prompts.guidanceSavedAccess")}
              disabled={postGuidanceQuery.isLoading || postGuidanceQuery.isError}
            />
          ))}
        </SettingsGroup>
      )}

      {mode === "content-rules" && (
        <SettingsGroup title={t("ui.slurp.settings.creators.contentMenuGroup", { defaultValue: "Content menu" })}>
          <SlurpPostGuidanceField
            access="menu"
            creatorId={creator.id}
            guidance={postGuidanceQuery.data}
            inherited=""
            label={t("ui.slurp.settings.creators.contentMenu", { defaultValue: "What this Creator offers" })}
            detail={t("ui.slurp.settings.creators.contentMenuDetail", {
              defaultValue:
                "Private. List what this Creator offers and what they will not do. Posts, comment replies, and messages follow it. Fans never see it.",
            })}
            clearLabel={t("ui.slurp.settings.creators.contentMenuClear", { defaultValue: "Clear menu" })}
            savedMessage={t("ui.slurp.settings.creators.contentMenuSaved", { defaultValue: "Content menu saved." })}
            disabled={postGuidanceQuery.isLoading || postGuidanceQuery.isError}
          />
        </SettingsGroup>
      )}

      {mode === "automation" && creator.scheduleStatus && creator.scheduleStatus.state !== "not-applicable" && (
        /* A stale or missing schedule is an attention state, so it uses the same tinted callout as
           a missing or changed source instead of a plain note. */
        <div
          className={
            creator.scheduleStatus.state === "active" || creator.scheduleStatus.state === "stale"
              ? `space-y-3 ${noteClass}`
              : "space-y-3 rounded-lg bg-[var(--slurp-warning)]/10 p-3 text-xs leading-5 ring-1 ring-inset ring-[var(--slurp-warning)]/25"
          }
        >
          <p>
            <span className="font-semibold text-[var(--slurp-text)]">
              {t("ui.slurp.settings.creators.conversationSchedule")}
            </span>{" "}
            {t(`ui.slurp.settings.creators.schedule.${creator.scheduleStatus.state}`)}
          </p>
          <p className="text-xs leading-5">{t("ui.slurp.settings.creators.conversationScheduleDetail")}</p>
          {(creator.scheduleStatus.state === "stale" || creator.scheduleStatus.state === "missing") && (
            <button
              type="button"
              disabled={refreshConversationSchedule.isPending}
              onClick={() => {
                void showConfirmDialog({
                  title: t("ui.slurp.settings.creators.refreshConversationSchedule"),
                  message: t("ui.slurp.settings.creators.refreshConversationScheduleConfirm"),
                  confirmLabel: t("ui.slurp.settings.creators.refreshConversationSchedule"),
                  cancelLabel: t("ui.slurp.actions.cancel"),
                }).then((confirmed) => {
                  if (!confirmed) return;
                  refreshConversationSchedule.mutate(creator.id);
                });
              }}
              className={accentButton}
            >
              {refreshConversationSchedule.isPending ? (
                <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <CalendarClock size={14} aria-hidden="true" />
              )}
              {/* The work happens on the server, so the button says so while it waits. The result
                  itself arrives as a toast and as the status line above. */}
              {refreshConversationSchedule.isPending
                ? t("ui.slurp.settings.creators.refreshingConversationSchedule", {
                    defaultValue: "Rebuilding the schedule…",
                  })
                : t("ui.slurp.settings.creators.refreshConversationSchedule")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
