import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { showConfirmDialog } from "../../../../lib/app-dialogs";
import { errorMessage } from "../../../modules/settings/slp-backstage-format";
import { Field, SettingsGroup, Toggle } from "../../../modules/settings/SlpSettingsControls";
import { useUpdateCreatorFanActivity } from "../../audience/slp-audience-contract";
import { useUpdateCreatorAutoPosting } from "../../feed/slp-feed-contract";
import {
  useSlurpImageConnections,
  useSlurpImageStyleProfiles,
  useUpdateSlurpImageConnections,
} from "../../media/slp-media-contract";
import { useSlurpConnections } from "../../../base/state/slp-host-connections";
import { CreatorMessagingGroup, useSetSlurpCreatorMessaging } from "../../messages/slp-messages-contract";
import { useSetSlurpCreatorPrice } from "../../economy/slp-economy-contract";
import { useSlurpSettings, useUpdateSlurpSettings } from "../../settings/slp-settings-contract";
import { useSlurpUIStore } from "../../../base/state/slp-package-store";
import { SlurpContinuityPanel } from "../SlpContinuityPanel";
import { SlurpCreatorImprover } from "../SlpCreatorImprover";
import { SlurpCreatorProfileEditor } from "../SlpCreatorProfileEditor";
import { SlpWardrobeManager } from "../SlpWardrobeManager";
import {
  useDeleteCreatorStageProfile,
  useAdoptCreatorSourceIdentity,
  useDismissCreatorSourceChanges,
} from "../slp-creator-profile-hooks";
import { useSlpPersonaBackedCreator } from "../slp-creators-hooks";
import { accentButton, focusRing, noteClass, quietButton, selectClass } from "../slp-creator-classes";
import type { SlpCreatorSettingsSectionProps } from "./slp-creator-settings-contract";

const FAN_ARCHETYPES = ["ordinary", "eccentric", "crossFandom", "raider", "organicDiscovery", "freeResource"] as const;

/** Who this Creator is: the full stage profile, plus whatever its Engine source is doing. */
export function SlpCreatorIdentitySection({ creator, onRedraft }: SlpCreatorSettingsSectionProps) {
  const { t } = useTranslation();
  const adoptSourceIdentity = useAdoptCreatorSourceIdentity();
  const dismissSourceChanges = useDismissCreatorSourceChanges();

  return (
    <div className="space-y-4">
      <SlurpCreatorProfileEditor
        key={creator.id}
        creator={creator}
        onRedraft={onRedraft ? () => onRedraft(creator) : undefined}
      />
      {creator.sourceStatus.state === "missing" && (
        <p className="rounded-lg bg-[var(--slurp-danger)]/10 p-3 text-xs text-[var(--slurp-danger)] ring-1 ring-inset ring-[var(--slurp-danger)]/25">
          {t("ui.slurp.settings.creators.sourceMissing")}
        </p>
      )}
      {creator.sourceStatus.state === "changed" && (
        <div className="rounded-lg bg-[var(--slurp-warning)]/10 p-3 ring-1 ring-inset ring-[var(--slurp-warning)]/25">
          <p className="text-xs font-semibold">{t("ui.slurp.settings.creators.sourceChanged")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {creator.disclosureMode === "open" && (
              <button
                type="button"
                disabled={adoptSourceIdentity.isPending}
                onClick={() =>
                  adoptSourceIdentity.mutate(creator.id, { onError: (error) => toast.error(errorMessage(error)) })
                }
                className={accentButton}
              >
                {t("ui.slurp.settings.creators.acceptIdentity")}
              </button>
            )}
            {onRedraft && (
              <button type="button" onClick={() => onRedraft(creator)} className={quietButton}>
                {t("ui.slurp.settings.creators.reviewRedraft")}
              </button>
            )}
            <button
              type="button"
              disabled={dismissSourceChanges.isPending}
              onClick={() =>
                dismissSourceChanges.mutate(creator.id, {
                  onSuccess: () => toast.success(t("ui.slurp.settings.creators.acceptedChanges")),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
              className={quietButton}
            >
              {t("ui.slurp.settings.creators.acceptChanges")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Saved looks. Its own tab now: it used to sit below the profile form where nobody scrolled. */
export function SlpCreatorWardrobeSection({ creator }: SlpCreatorSettingsSectionProps) {
  return <SlpWardrobeManager creatorId={creator.id} legacyWardrobe={creator.wardrobe ?? ""} />;
}

/**
 * How lively this Creator's audience is, and which kinds of fan show up.
 *
 * These controls were only reachable from a dialog on the Creator's own profile, so Backstage
 * could not see them at all. Every value inherits until it is set here.
 */
export function SlpCreatorAudienceSection({ creator }: SlpCreatorSettingsSectionProps) {
  const { t } = useTranslation();
  const updateFanActivity = useUpdateCreatorFanActivity();
  const settingsQuery = useSlurpSettings();
  const globalSettings = settingsQuery.data;
  const fanActivity = creator.fanActivity;
  const mode = fanActivity?.enabled === true ? "on" : fanActivity?.enabled === false ? "off" : "inherit";

  return (
    <SettingsGroup title={t("ui.noodle.noodlerfanactivity.creatorTitle")}>
      <Field label={t("ui.noodle.noodlerfanactivity.creatorMode")}>
        <select
          disabled={updateFanActivity.isPending}
          value={mode}
          onChange={(event) =>
            updateFanActivity.mutate(
              {
                accountId: creator.id,
                fanActivity:
                  event.target.value === "inherit" ? null : { ...fanActivity, enabled: event.target.value === "on" },
              },
              { onError: (error) => toast.error(errorMessage(error)) },
            )
          }
          className={selectClass}
        >
          {/* "Use global defaults" is meaningless without saying what that resolves to right now,
              which used to mean leaving the Creator to go and look. */}
          <option value="inherit">
            {globalSettings
              ? t("ui.noodle.noodlerfanactivity.inheritResolved", {
                  value: t(
                    globalSettings.fanActivityEnabled
                      ? "ui.noodle.noodlerfanactivity.on"
                      : "ui.noodle.noodlerfanactivity.off",
                  ),
                })
              : t("ui.noodle.noodlerfanactivity.inherit")}
          </option>
          <option value="on">{t("ui.noodle.noodlerfanactivity.on")}</option>
          <option value="off">{t("ui.noodle.noodlerfanactivity.off")}</option>
        </select>
      </Field>
      {fanActivity && globalSettings && (
        <div className="grid grid-cols-2 gap-3">
          {FAN_ARCHETYPES.map((archetype) => {
            const override = fanActivity.archetypeWeights?.[archetype];
            const current = override ?? globalSettings.fanArchetypeWeights[archetype];
            return (
              <label key={archetype} className="space-y-1 text-xs font-semibold">
                <span className="block text-[var(--slurp-muted)]">
                  {t(`ui.noodle.noodlerfanactivity.archetype.${archetype}`)}
                  {/* Without this an inherited value and a deliberate override that happens to
                      match look identical. */}
                  {override === undefined && (
                    <span className="ms-1 font-normal opacity-70">
                      {t("ui.noodle.noodlerfanactivity.inheritedValue")}
                    </span>
                  )}
                </span>
                <input
                  key={`${creator.id}-${archetype}-${current}`}
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={current}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isInteger(value) || value < 0 || value > 100) {
                      event.target.value = String(current);
                      return;
                    }
                    const resolved = {
                      ...globalSettings.fanArchetypeWeights,
                      ...fanActivity.archetypeWeights,
                      [archetype]: value,
                    };
                    if (!Object.values(resolved).some((weight) => weight > 0)) {
                      toast.error(t("ui.noodle.noodlerfanactivity.allWeightsZero"));
                      event.target.value = String(current);
                      return;
                    }
                    updateFanActivity.mutate(
                      {
                        accountId: creator.id,
                        fanActivity: {
                          ...fanActivity,
                          archetypeWeights: { ...fanActivity.archetypeWeights, [archetype]: value },
                        },
                      },
                      {
                        onError: (error) => {
                          toast.error(errorMessage(error));
                          event.target.value = String(current);
                        },
                      },
                    );
                  }}
                  className={`min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm ${focusRing}`}
                />
              </label>
            );
          })}
        </div>
      )}
    </SettingsGroup>
  );
}

/** Whether posts carry pictures, which model draws them, and whose instructions to follow. */
export function SlpCreatorImagesSection({ creator, active }: SlpCreatorSettingsSectionProps) {
  const { t } = useTranslation();
  const updateAuto = useUpdateCreatorAutoPosting();
  const updateImages = useUpdateSlurpImageConnections();
  const imageSettingsQuery = useSlurpImageConnections(active);
  const styleProfilesQuery = useSlurpImageStyleProfiles(active);
  const connectionsQuery = useSlurpConnections(active);
  const settingsQuery = useSlurpSettings();
  const updateSettings = useUpdateSlurpSettings();
  const personaBacked = useSlpPersonaBackedCreator(creator);
  const settings = settingsQuery.data;
  const imageConnections = (connectionsQuery.data ?? []).filter(
    (connection) => connection.provider === "image_generation",
  );

  return (
    <SettingsGroup title={t("ui.slurp.settings.creators.imagesGroup")}>
      <Toggle
        label={t("ui.slurp.settings.creators.images")}
        value={creator.autoPosting.imagesEnabled}
        onChange={(value) =>
          updateAuto.mutate(
            { accountId: creator.id, imagesEnabled: value },
            { onError: (error) => toast.error(errorMessage(error)) },
          )
        }
      />
      <Field
        label={t("ui.slurp.settings.creators.imageConnection")}
        detail={t("ui.slurp.settings.creators.imageConnectionDetail")}
      >
        <select
          disabled={
            imageSettingsQuery.isLoading ||
            imageSettingsQuery.isError ||
            connectionsQuery.isLoading ||
            connectionsQuery.isError ||
            updateImages.isPending
          }
          value={imageSettingsQuery.data?.creatorConnectionIds[creator.id] ?? ""}
          onChange={(event) =>
            updateImages.mutate(
              { creatorId: creator.id, connectionId: event.target.value || null },
              { onError: (error) => toast.error(errorMessage(error)) },
            )
          }
          className={selectClass}
        >
          <option value="">{t("ui.slurp.settings.creators.inheritImageConnection")}</option>
          {imageConnections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.name ?? connection.model ?? connection.id}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.imageStyle", { defaultValue: "Image style" })}
        detail={t("ui.slurp.settings.creators.imageStyleDetail", {
          defaultValue: "Use the global style or choose a style for this Creator.",
        })}
      >
        <select
          disabled={styleProfilesQuery.isLoading || styleProfilesQuery.isError || updateImages.isPending}
          value={imageSettingsQuery.data?.creatorStyleProfileIds[creator.id] ?? ""}
          onChange={(event) =>
            updateImages.mutate(
              { creatorId: creator.id, styleProfileId: event.target.value || null },
              { onError: (error) => toast.error(errorMessage(error)) },
            )
          }
          className={selectClass}
        >
          <option value="">
            {t("ui.slurp.settings.creators.inheritImageStyle", { defaultValue: "Use global default" })}
          </option>
          {(styleProfilesQuery.data ?? []).map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </Field>
      {creator.sourceAccountId && !personaBacked && settings && (
        <Field
          settingKey="characterImageInstructions"
          label={t("ui.slurp.settings.creators.imageInstructions")}
          detail={t("ui.slurp.settings.creators.imageInstructionsDetail")}
        >
          <select
            disabled={updateSettings.isPending}
            value={String(settings.characterImageInstructions[creator.sourceAccountId] ?? "engine")}
            onChange={(event) => {
              const characterId = creator.sourceAccountId!;
              const { [characterId]: _previous, ...rest } = settings.characterImageInstructions;
              updateSettings.mutate({
                characterImageInstructions:
                  event.target.value === "engine" ? rest : { ...rest, [characterId]: event.target.value === "true" },
              });
            }}
            className={selectClass}
          >
            <option value="engine">{t("ui.slurp.settings.creators.imageInstructionsEngine")}</option>
            <option value="true">{t("ui.slurp.settings.creators.imageInstructionsOn")}</option>
            <option value="false">{t("ui.slurp.settings.creators.imageInstructionsOff")}</option>
          </select>
        </Field>
      )}
    </SettingsGroup>
  );
}

/** Who may message this Creator, and what a reply or an unlock costs. */
export function SlpCreatorMessagesSection({ creator, onClose }: SlpCreatorSettingsSectionProps) {
  const { t } = useTranslation();
  const setMessaging = useSetSlurpCreatorMessaging();
  const setPrice = useSetSlurpCreatorPrice();
  const viewerPersonaId = useSlurpUIStore((state) => state.viewerPersonaId);
  const setNavigation = useSlurpUIStore((state) => state.setNavigation);

  /* Every Creator's policy and prices are the player's to set, world-run ones included: Slurp is
     single-player and this modal is where Creators are managed. An unset value still falls back to
     the world default. The persona identifies the viewer to the route and nothing else. */
  if (!viewerPersonaId) return <p className={noteClass}>{t("ui.slurp.settings.creators.messagesWorldRules")}</p>;
  return (
    <CreatorMessagingGroup
      creatorId={creator.id}
      personaId={viewerPersonaId}
      setMessaging={setMessaging}
      setPrice={setPrice}
      worldRulesAction={
        <button
          type="button"
          onClick={() => {
            onClose();
            setNavigation({ mode: "creator-settings", section: "world", target: "messaging" });
          }}
          className={quietButton}
        >
          {t("ui.slurp.settings.creators.openWorldMessaging")}
        </button>
      }
    />
  );
}

/** What this Creator's world remembers about them. */
export function SlpCreatorContinuitySection({ creator }: SlpCreatorSettingsSectionProps) {
  return <SlurpContinuityPanel creatorAccountId={creator.id} />;
}

/** The AI checkup, scoped to this one Creator rather than the whole roster. */
export function SlpCreatorImproveSection({ creator }: SlpCreatorSettingsSectionProps) {
  const { t } = useTranslation();
  const settingsQuery = useSlurpSettings();
  if (!settingsQuery.data)
    return <p className={noteClass}>{t("ui.slurp.settings.loading", { defaultValue: "Loading…" })}</p>;
  return <SlurpCreatorImprover creators={[creator]} settings={settingsQuery.data} />;
}

/** Removing the Creator. Alone in its own tab so it is never a mis-click away from a setting. */
export function SlpCreatorDangerSection({ creator, onClose }: SlpCreatorSettingsSectionProps) {
  const { t } = useTranslation();
  const deleteCreator = useDeleteCreatorStageProfile();

  const confirmDelete = async () => {
    try {
      const confirmed = await showConfirmDialog({
        title: t("ui.slurp.settings.creators.deleteTitle"),
        message: t("ui.slurp.settings.creators.deleteDetail", { name: creator.displayName }),
      });
      if (!confirmed) return;
      deleteCreator.mutate(creator.id, {
        onSuccess: () => {
          toast.success(t("ui.slurp.settings.creators.deleted", { name: creator.displayName }));
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error)),
      });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="space-y-3 rounded-lg p-4 ring-1 ring-inset ring-[var(--slurp-danger)]/30">
      <p className="text-xs font-semibold text-[var(--slurp-danger)]">{t("ui.slurp.settings.creators.moreActions")}</p>
      <button
        type="button"
        disabled={deleteCreator.isPending}
        onClick={() => void confirmDelete()}
        className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[var(--slurp-danger)] ring-1 ring-inset ring-[var(--slurp-danger)]/50 hover:bg-[var(--slurp-danger)]/10 disabled:opacity-50 ${focusRing}`}
      >
        <Trash2 size={14} aria-hidden="true" />
        {t("ui.slurp.settings.creators.delete")}
      </button>
    </div>
  );
}
