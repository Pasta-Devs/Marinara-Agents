import { Loader2, RefreshCw } from "lucide-react";




import { toast } from "sonner";

















import { Modal } from "../../../components/ui/Modal";









import { errorMessage, ScheduleSlotEditor } from "../../../components/slurp/SlurpBackstageWorkflow";









import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** One Creator's prepared publishing slots, editable from the creator table. */
export function SlpCreatorScheduleModal(page: SlpBackstagePageProps) {
  const {
    t,
    settings,
    scheduleCreatorId,
    setScheduleCreatorId,
    reserveStatusQuery,
    updateScheduleSlot,
    scheduleCreator,
    scheduleSlots,
    creators,
  } = page;
  return (
      <Modal
        open={Boolean(scheduleCreatorId)}
        onClose={() => setScheduleCreatorId(null)}
        title={t("ui.slurp.settings.creators.scheduleTitle", { name: scheduleCreator?.displayName ?? "" })}
        width="max-w-xl"
        closeDisabled={updateScheduleSlot.isPending}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">{t("ui.slurp.settings.creators.scheduleDetail")}</p>
          {reserveStatusQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
              <Loader2 size={18} className="animate-spin" />
              {t("ui.noodle.noodlerschedulemanagermodal.loadingStatus")}
            </div>
          ) : reserveStatusQuery.isError ? (
            <div className="rounded-lg border border-red-400/30 p-5 text-sm">
              <p>{t("ui.noodle.noodlerschedulemanagermodal.couldNotLoadStatus")}</p>
              <button
                type="button"
                onClick={() => void reserveStatusQuery.refetch()}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 font-semibold"
              >
                <RefreshCw size={14} />
                {t("capabilities.actions.tryAgain")}
              </button>
            </div>
          ) : scheduleSlots.length > 0 ? (
            <div className="space-y-3">
              {scheduleSlots.map((slot) => (
                <ScheduleSlotEditor
                  key={`${slot.id}:${slot.publishAt}`}
                  slot={slot}
                  pending={updateScheduleSlot.isPending}
                  onSave={async (publishAt) => {
                    try {
                      await updateScheduleSlot.mutateAsync({ slotId: slot.id, publishAt });
                      toast.success(t("ui.slurp.settings.creators.scheduleSaved"));
                    } catch (error) {
                      toast.error(errorMessage(error));
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.creators.scheduleEmpty")}
            </p>
          )}
        </div>
      </Modal>
  );
}
