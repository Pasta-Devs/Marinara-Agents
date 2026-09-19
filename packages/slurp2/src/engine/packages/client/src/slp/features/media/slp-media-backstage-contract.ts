import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { NoodlerManagedStageProfile } from "@marinara-engine/shared";
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import type { SlpBackstageSection, SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";
import type { SlurpSettings } from "../settings/slp-settings-contract";
import { useSlurpImageConnections, useUpdateSlurpImageConnections } from "./slp-image-connection-hooks";

/**
 * Image generation connections and readiness. Media owns these because post, story, message and
 * audience image generation all read the same settings, so no single content feature can own them.
 */
export function useSlpMediaBackstageState({
  section,
  target,
  creators,
}: {
  section: SlpBackstageSection;
  target: SlpBackstageTarget;
  creators: NoodlerManagedStageProfile[];
}) {
  const { t } = useTranslation();
  const imageSettingsQuery = useSlurpImageConnections(
    section === "overview" || section === "automation" || section === "creators",
  );
  const updateImages = useUpdateSlurpImageConnections();
  const connectionsQuery = useSlurpConnections(
    section === "overview" ||
      section === "automation" ||
      target === "images" ||
      target === "ads" ||
      section === "creators" ||
      target === "audience",
  );
  const [imageWizardOpen, setImageWizardOpen] = useState(false);
  const [imageDraft, setImageDraft] = useState<Pick<
    SlurpSettings,
    "imageContextMode" | "autoPostingImagesEnabled" | "allowGalleryImageAttachments" | "imageWidth" | "imageHeight"
  > | null>(null);

  const imageConnections = (connectionsQuery.data ?? []).filter(
    (connection) => connection.provider === "image_generation",
  );
  const imageSettings = imageSettingsQuery.data;
  const imageEnabledCreators = creators.filter((creator) => creator.autoPosting.imagesEnabled);
  const imagesReady = imageConnections.length > 0 && imageEnabledCreators.length > 0;
  const selectedImageConnection = imageConnections.find(
    (connection) => connection.id === imageSettings?.defaultConnectionId,
  );
  const imageConnectionLabel = selectedImageConnection
    ? (selectedImageConnection.name ?? selectedImageConnection.model ?? selectedImageConnection.id)
    : t("ui.slurp.settings.images.engineDefault");

  return {
    imageSettingsQuery,
    updateImages,
    connectionsQuery,
    imageWizardOpen,
    setImageWizardOpen,
    imageDraft,
    setImageDraft,
    imageConnections,
    imageSettings,
    imageEnabledCreators,
    imagesReady,
    selectedImageConnection,
    imageConnectionLabel,
  };
}

export type SlpMediaBackstageState = ReturnType<typeof useSlpMediaBackstageState>;
