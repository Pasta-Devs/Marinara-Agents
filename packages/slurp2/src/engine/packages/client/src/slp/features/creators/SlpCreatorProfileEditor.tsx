import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload, UserRound } from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type {
  SlpCreatorManagedStageProfile,
  SlpIdentityDisclosure,
} from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpStageProfileInput } from "../../base/state/slp-state-types";
import {
  useRemoveCreatorAvatar,
  useUpdateCreatorStageProfile,
  useUploadCreatorAvatar,
  useUploadCreatorBanner,
  useUseCreatorSourceAvatar,
} from "./slp-creator-profile-hooks";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { confirmSlurpAvatarReview, StageProfileForm } from "./SlpStageProfileForm";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { Avatar, SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { quietButton, selectClass } from "./slp-creator-classes";
import { SlpPictureAssist } from "../assist/slp-assist-contract";

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
  onDirtyChange,
  onSaveStateChange,
}: {
  creator: SlpCreatorManagedStageProfile;
  onRedraft?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveStateChange?: (state: { isPending: boolean; dirty: boolean; save: () => void; discard: () => void }) => void;
}) {
  const { t } = useTranslation();
  const updateProfile = useUpdateCreatorStageProfile();
  const initialDraft = useMemo<SlurpStageProfileInput>(
    () => ({
      displayName: creator.displayName,
      handle: creator.handle,
      bio: creator.bio,
      stagePersonality: creator.stagePersonality,
      appearance: creator.appearance,
      wardrobe: creator.wardrobe,
      locations: creator.locations,
      clothingStyle: creator.clothingStyle ?? "auto",
      disclosureMode: creator.disclosureMode ?? "hinted",
      gender: creator.gender,
      tags: creator.tags,
    }),
    [creator],
  );
  const [draft, setDraft] = useState<SlurpStageProfileInput>(initialDraft);
  // The profile's location line; "Edit profile" could not reach it, only "Redraft with AI" (R1-069).
  const initialLocation = (creator as { location?: string }).location ?? "";
  const [location, setLocation] = useState(initialLocation);
  const saveStateRef = useRef<{ isPending: boolean; dirty: boolean; save: () => void; discard: () => void }>({
    isPending: false,
    dirty: false,
    save: () => {},
    discard: () => {},
  });

  const save = async () => {
    const input = { ...draft, handle: draft.handle.replace(/^@+/u, "") };
    const nextLocation = location.trim();
    const review = await confirmSlurpAvatarReview({
      existing: creator,
      nextDisclosure: input.disclosureMode,
      localize: t,
      confirm: showConfirmDialog,
    });
    if (!review.proceed) return;
    updateProfile.mutate(
      {
        accountId: creator.id,
        ...input,
        location: nextLocation,
        ...(review.confirmAvatarReview && { confirmAvatarReview: true }),
      },
      {
        onSuccess: () => {
          setDraft(input);
          onDirtyChange?.(false);
          toast.success(t("ui.noodle.noodlerhome.stageProfileUpdated"));
        },
        onError: (error) => toast.error(errorMessage(error, t("ui.noodle.noodlerhome.couldNotSaveTheStageProfile"))),
      },
    );
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft) || location !== initialLocation;
  useEffect(() => {
    onDirtyChange?.(JSON.stringify(draft) !== JSON.stringify(initialDraft));
    if (location !== initialLocation) onDirtyChange?.(true);
  }, [draft, initialDraft, location, initialLocation, onDirtyChange]);

  saveStateRef.current = {
    isPending: updateProfile.isPending,
    dirty,
    save: () => void save(),
    discard: () => {
      setDraft(initialDraft);
      setLocation(initialLocation);
      onDirtyChange?.(false);
    },
  };

  useEffect(() => {
    onSaveStateChange?.({
      isPending: updateProfile.isPending,
      dirty: saveStateRef.current.dirty,
      save: () => saveStateRef.current.save(),
      discard: () => saveStateRef.current.discard(),
    });
  }, [onSaveStateChange, updateProfile.isPending, draft, initialDraft, location]);

  return (
    <div className="space-y-5">
      <CreatorArtworkControls creator={creator} />
      <StageProfileForm
        draft={draft}
        source={null}
        disclosureMode={draft.disclosureMode}
        onDisclosureChange={(value: SlpIdentityDisclosure) =>
          setDraft((current) => ({ ...current, disclosureMode: value }))
        }
        guidance=""
        onGuidanceChange={() => {}}
        connections={[]}
        connectionId=""
        onConnectionChange={() => {}}
        onGenerate={onRedraft ?? (() => undefined)}
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
        avatarPending={false}
        onUploadAvatar={() => {}}
        onUseSourceAvatar={() => {}}
        onRemoveAvatar={() => {}}
        onCancel={() => {
          setDraft(initialDraft);
          onDirtyChange?.(false);
        }}
        onSave={() => void save()}
        showFooter={false}
        showAvatarControls={false}
      />
      <label className="block space-y-1">
        <span className="text-xs font-semibold">{t("ui.noodle.noodleprofilesurface.location")}</span>
        <input
          value={location}
          maxLength={120}
          disabled={updateProfile.isPending}
          onChange={(event) => setLocation(event.target.value)}
          placeholder={t("ui.noodle.noodleprofilesurface.somewhereCozy")}
          className={selectClass}
        />
      </label>
    </div>
  );
}

function CreatorArtworkControls({
  creator,
}: {
  creator: SlpCreatorManagedStageProfile & { bannerUrl?: string | null };
}) {
  const { t } = useTranslation();
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const [artworkKind, setArtworkKind] = useState<"avatar" | "banner" | null>(null);
  const uploadAvatar = useUploadCreatorAvatar();
  const uploadBanner = useUploadCreatorBanner();
  const useSourceAvatar = useUseCreatorSourceAvatar();
  const removeAvatar = useRemoveCreatorAvatar();
  const busy = uploadAvatar.isPending || uploadBanner.isPending || useSourceAvatar.isPending || removeAvatar.isPending;
  const fail = (error: unknown) => toast.error(errorMessage(error, t("ui.slurp.artwork.generateError")));
  const upload = (kind: "avatar" | "banner", file: File) => {
    const mutation = kind === "avatar" ? uploadAvatar : uploadBanner;
    mutation.mutate(
      { accountId: creator.id, file },
      { onError: (error) => toast.error(errorMessage(error, t(`ui.slurp.artwork.${kind}UploadError`))) },
    );
  };
  const startGeneration = (kind: "avatar" | "banner") => setArtworkKind(kind);

  return (
    <section aria-label={t("ui.slurp.settings.creators.artworkHeading")} className="space-y-3">
      <div>
        <h3 className="text-base font-bold">{t("ui.slurp.settings.creators.artworkHeading")}</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.creators.artworkDetail")}
        </p>
      </div>
      <div className="overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        <div className="relative h-36 overflow-hidden bg-[linear-gradient(115deg,var(--slurp-coral),var(--slurp-violet))]">
          {creator.bannerUrl && (
            <SlurpMediaImg src={creator.bannerUrl} alt="" className="slp-crop-top h-full w-full object-cover" />
          )}
          <span className="absolute inset-x-3 top-3 rounded-md bg-black/55 px-2 py-1 text-xs font-bold text-white backdrop-blur-sm w-fit">
            {t("ui.slurp.settings.creators.bannerHeading")}
          </span>
        </div>
        <div className="relative flex flex-wrap items-end gap-3 px-4 pb-4">
          <div className="-mt-9 rounded-full bg-[var(--slurp-surface-raised)] p-1 ring-1 ring-[var(--slurp-outline)]">
            <Avatar account={creator} size="lg" />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="truncate text-sm font-bold">{creator.displayName}</p>
            <p className="truncate text-xs text-[var(--slurp-muted)]">@{creator.handle}</p>
          </div>
        </div>
        <div className="grid gap-4 border-t border-[var(--slurp-outline)] p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--slurp-muted)]">
              {t("ui.noodle.stageprofileform.creatorAvatar")}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => avatarFileRef.current?.click()}
                className={quietButton}
              >
                <Upload size={15} aria-hidden="true" /> {t("ui.noodle.stageprofileform.uploadAvatar")}
              </button>
              <button type="button" disabled={busy} onClick={() => startGeneration("avatar")} className={quietButton}>
                <SlpSparkleGlyph size={15} aria-hidden="true" /> {t("ui.slurp.artwork.generateAvatar")}
              </button>
              {creator.sourceAccountId && creator.disclosureMode === "open" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => useSourceAvatar.mutate({ accountId: creator.id }, { onError: fail })}
                  className={quietButton}
                >
                  <UserRound size={15} aria-hidden="true" /> {t("ui.noodle.stageprofileform.useSource")}
                </button>
              )}
              {creator.avatarUrl && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeAvatar.mutate({ accountId: creator.id }, { onError: fail })}
                  className={quietButton}
                >
                  <Trash2 size={15} aria-hidden="true" /> {t("ui.noodle.stageprofileform.removeAvatar")}
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.creators.bannerHeading")}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => bannerFileRef.current?.click()}
                className={quietButton}
              >
                <ImagePlus size={15} aria-hidden="true" /> {t("ui.noodle.noodleprofilesurface.uploadBanner")}
              </button>
              <button type="button" disabled={busy} onClick={() => startGeneration("banner")} className={quietButton}>
                <SlpSparkleGlyph size={15} aria-hidden="true" /> {t("ui.slurp.artwork.generateBanner")}
              </button>
            </div>
          </div>
        </div>
      </div>
      <input
        ref={avatarFileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
        className="sr-only"
        aria-label={t("ui.noodle.stageprofileform.uploadAvatar")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload("avatar", file);
        }}
      />
      <input
        ref={bannerFileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
        className="sr-only"
        aria-label={t("ui.noodle.noodleprofilesurface.uploadBanner")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload("banner", file);
        }}
      />
      {artworkKind && (
        <div className="space-y-2 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--noodle-accent)]/35">
          <p className="text-sm font-bold">
            {t(artworkKind === "banner" ? "ui.slurp.assist.drawTitle.cover" : "ui.slurp.assist.drawTitle.avatar")}
          </p>
          <SlpPictureAssist
            key={artworkKind}
            accountId={creator.id}
            target={artworkKind === "banner" ? "cover" : "avatar"}
            context={creator.bio}
            advanced
            onDone={() => setArtworkKind(null)}
            onCancel={() => setArtworkKind(null)}
          />
        </div>
      )}
    </section>
  );
}
