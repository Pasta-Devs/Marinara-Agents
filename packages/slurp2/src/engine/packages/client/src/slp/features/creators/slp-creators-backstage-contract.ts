import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { SlpCreatorManagedStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import type { SlpBackstageSection } from "../../base/navigation/slp-backstage-target";
import {
  useAdoptNoodlerSourceIdentity,
  useDeleteNoodlerStageProfile,
  useDismissNoodlerSourceChanges,
} from "./slp-creator-profile-hooks";
import {
  useRefreshNoodlerConversationSchedule,
  useRefreshTargetedNoodlerCreatorsNow,
} from "./slp-creator-refresh-hooks";
import { useBulkUpdateSlurpCreators, useNoodlerAccounts } from "./slp-creators-hooks";

export type SlpCreatorFilter = "all" | "active" | "paused" | "attention";
export type SlpCreatorTab = "profile" | "publishing" | "images" | "messages" | "danger";

/**
 * Creator accounts, the creator-table view state and the creator mutations Backstage drives. The
 * list view state lives here rather than in the panel so switching between the Creators and Improve
 * targets keeps the search text, filter, tab and expanded row, exactly as the single-page host did.
 */
export function useSlpCreatorsBackstageState({
  section,
  personaSourceIds,
  setRefreshRemaining,
}: {
  section: SlpBackstageSection;
  personaSourceIds: ReadonlySet<string>;
  setRefreshRemaining: (remaining: number) => void;
}) {
  const { t } = useTranslation();
  const accountsQuery = useNoodlerAccounts(
    section === "overview" || section === "creators" || section === "automation",
  );
  const refreshCreators = useRefreshTargetedNoodlerCreatorsNow(setRefreshRemaining);
  const refreshConversationSchedule = useRefreshNoodlerConversationSchedule();
  const deleteCreator = useDeleteNoodlerStageProfile();
  const adoptSourceIdentity = useAdoptNoodlerSourceIdentity();
  const dismissSourceChanges = useDismissNoodlerSourceChanges();
  const bulkUpdateCreators = useBulkUpdateSlurpCreators();
  const [scheduleCreatorId, setScheduleCreatorId] = useState<string | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  // null while select mode is off.
  const [bulkCreatorIds, setBulkCreatorIds] = useState<Set<string> | null>(null);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<SlpCreatorFilter>("all");
  const [creatorTab, setCreatorTab] = useState<SlpCreatorTab>("profile");
  const [expandedCreatorId, setExpandedCreatorId] = useState<string | null>(null);

  const personaCreator = (creator: SlpCreatorManagedStageProfile) =>
    Boolean(creator.sourceAccountId && personaSourceIds.has(creator.sourceAccountId));
  const creators = accountsQuery.data ?? [];
  const automationCreators = creators.filter((creator) => !personaCreator(creator));
  const scheduleCreator = accountsQuery.data?.find((creator) => creator.id === scheduleCreatorId) ?? null;
  const selectedCreator =
    accountsQuery.data?.find((creator) => creator.id === selectedCreatorId) ?? accountsQuery.data?.[0] ?? null;

  useEffect(() => {
    if (!accountsQuery.data?.length) {
      setSelectedCreatorId(null);
      return;
    }
    if (!accountsQuery.data.some((creator) => creator.id === selectedCreatorId)) {
      setSelectedCreatorId(accountsQuery.data[0]?.id ?? null);
    }
  }, [accountsQuery.data, selectedCreatorId]);

  const confirmDeleteCreator = async (creator: SlpCreatorManagedStageProfile) => {
    try {
      const confirmed = await showConfirmDialog({
        title: t("ui.slurp.settings.creators.deleteTitle"),
        message: t("ui.slurp.settings.creators.deleteDetail", { name: creator.displayName }),
      });
      if (!confirmed) return;
      deleteCreator.mutate(creator.id, {
        onSuccess: () => toast.success(t("ui.slurp.settings.creators.deleted", { name: creator.displayName })),
        onError: (error) => toast.error(errorMessage(error)),
      });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return {
    accountsQuery,
    refreshCreators,
    refreshConversationSchedule,
    deleteCreator,
    adoptSourceIdentity,
    dismissSourceChanges,
    bulkUpdateCreators,
    scheduleCreatorId,
    setScheduleCreatorId,
    selectedCreatorId,
    setSelectedCreatorId,
    bulkCreatorIds,
    setBulkCreatorIds,
    creatorQuery,
    setCreatorQuery,
    creatorFilter,
    setCreatorFilter,
    creatorTab,
    setCreatorTab,
    expandedCreatorId,
    setExpandedCreatorId,
    personaCreator,
    creators,
    automationCreators,
    scheduleCreator,
    selectedCreator,
    confirmDeleteCreator,
  };
}

export type SlpCreatorsBackstageState = ReturnType<typeof useSlpCreatorsBackstageState>;
