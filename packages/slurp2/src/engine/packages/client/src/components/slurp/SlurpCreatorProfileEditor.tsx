import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { NoodleIdentityDisclosure, NoodlerManagedStageProfile } from "@marinara-engine/shared";
import {
  useRemoveNoodlerAvatar,
  useUpdateNoodlerStageProfile,
  useUploadNoodlerAvatar,
  useUseNoodlerSourceAvatar,
  type SlurpStageProfileInput,
} from "../../hooks/use-slurp";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { confirmSlurpAvatarReview, StageProfileForm } from "./SlurpStageProfileForm";
import { errorMessage } from "./SlurpBackstageWorkflow";

/**
 * The Creator's own profile fields, inside Backstage.
 *
 * It renders the same form the full-page editor does, so there is one set of profile controls
 * rather than a settings tab that can only reach half of them. Writing a fresh draft with AI still
 * goes through the redraft review, because that flow also has to accept the source snapshot the
 * model was given, and that acceptance must not exist in two places.
 */
export function SlurpCreatorProfileEditor({
  creator,
  onRedraft,
}: {
  creator: NoodlerManagedStageProfile;
  onRedraft: () => void;
}) {
  const { t } = useTranslation();
  const updateProfile = useUpdateNoodlerStageProfile();
  const uploadAvatar = useUploadNoodlerAvatar();
  const useSourceAvatar = useUseNoodlerSourceAvatar();
  const removeAvatar = useRemoveNoodlerAvatar();
  const [draft, setDraft] = useState<SlurpStageProfileInput>({
    displayName: creator.displayName,
    handle: creator.handle,
    bio: creator.bio,
    stagePersonality: creator.stagePersonality,
    disclosureMode: creator.disclosureMode ?? "hinted",
    gender: creator.gender,
    tags: creator.tags,
  });

  const avatarFailed = (error: unknown) =>
    toast.error(errorMessage(error, t("ui.noodle.stageprofileform.couldNotUpdateAvatar")));

  const save = async () => {
    const input = { ...draft, handle: draft.handle.replace(/^@+/u, "") };
    const review = await confirmSlurpAvatarReview({
      existing: creator,
      nextDisclosure: input.disclosureMode,
      localize: t,
      confirm: showConfirmDialog,
    });
    if (!review.proceed) return;
    updateProfile.mutate(
      { accountId: creator.id, ...input, ...(review.confirmAvatarReview && { confirmAvatarReview: true }) },
      {
        onSuccess: () => toast.success(t("ui.noodle.noodlerhome.stageProfileUpdated")),
        onError: (error) => toast.error(errorMessage(error, t("ui.noodle.noodlerhome.couldNotSaveTheStageProfile"))),
      },
    );
  };

  return (
    <StageProfileForm
      draft={draft}
      source={null}
      disclosureMode={draft.disclosureMode}
      onDisclosureChange={(value: NoodleIdentityDisclosure) =>
        setDraft((current) => ({ ...current, disclosureMode: value }))
      }
      guidance=""
      onGuidanceChange={() => {}}
      connections={[]}
      connectionId=""
      onConnectionChange={() => {}}
      onGenerate={onRedraft}
      onOpenRedraft={onRedraft}
      isGenerating={false}
      previousDraft={null}
      onUndoDraft={() => {}}
      onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      sourceAccountId={creator.sourceAccountId}
      accentId={creator.id}
      isEditing
      isPending={updateProfile.isPending}
      avatar={creator}
      sourceAvatarUrl={null}
      avatarPending={uploadAvatar.isPending || useSourceAvatar.isPending || removeAvatar.isPending}
      onUploadAvatar={(file) => uploadAvatar.mutate({ accountId: creator.id, file }, { onError: avatarFailed })}
      onUseSourceAvatar={() => useSourceAvatar.mutate({ accountId: creator.id }, { onError: avatarFailed })}
      onRemoveAvatar={() => removeAvatar.mutate({ accountId: creator.id }, { onError: avatarFailed })}
      onCancel={() =>
        setDraft({
          displayName: creator.displayName,
          handle: creator.handle,
          bio: creator.bio,
          stagePersonality: creator.stagePersonality,
          disclosureMode: creator.disclosureMode ?? "hinted",
          gender: creator.gender,
          tags: creator.tags,
        })
      }
      onSave={() => void save()}
    />
  );
}
