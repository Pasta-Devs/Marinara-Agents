import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, Trash2, Upload, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type {
  SlpCreatorArtworkPromptOptions,
  SlpCreatorManagedStageProfile,
  SlpIdentityDisclosure,
} from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpStageProfileInput } from "../../base/state/slp-state-types";
import {
  useRemoveCreatorAvatar,
  useUpdateCreatorStageProfile,
  useUploadCreatorAvatar,
  useUploadCreatorBanner,
  useGenerateCreatorArtwork,
  useUseCreatorSourceAvatar,
} from "./slp-creator-profile-hooks";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { confirmSlurpAvatarReview, StageProfileForm } from "./SlpStageProfileForm";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { Avatar, SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { accentButton, focusRing, quietButton } from "./slp-creator-classes";

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
      disclosureMode: creator.disclosureMode ?? "hinted",
      gender: creator.gender,
      tags: creator.tags,
    }),
    [creator],
  );
  const [draft, setDraft] = useState<SlurpStageProfileInput>(initialDraft);
  const saveStateRef = useRef<{ isPending: boolean; dirty: boolean; save: () => void; discard: () => void }>({
    isPending: false,
    dirty: false,
    save: () => {},
    discard: () => {},
  });

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
        onSuccess: () => {
          setDraft(input);
          onDirtyChange?.(false);
          toast.success(t("ui.noodle.noodlerhome.stageProfileUpdated"));
        },
        onError: (error) => toast.error(errorMessage(error, t("ui.noodle.noodlerhome.couldNotSaveTheStageProfile"))),
      },
    );
  };

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(draft) !== JSON.stringify(initialDraft));
  }, [draft, initialDraft, onDirtyChange]);

  saveStateRef.current = {
    isPending: updateProfile.isPending,
    dirty: JSON.stringify(draft) !== JSON.stringify(initialDraft),
    save: () => void save(),
    discard: () => {
      setDraft(initialDraft);
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
  }, [onSaveStateChange, updateProfile.isPending, draft, initialDraft]);

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
  const [guidance, setGuidance] = useState("");
  const [options, setOptions] = useState<SlpCreatorArtworkPromptOptions>({
    creatorDetails: true,
    appearance: true,
    sourceReferences: true,
    composition: true,
  });
  const uploadAvatar = useUploadCreatorAvatar();
  const uploadBanner = useUploadCreatorBanner();
  const generateArtwork = useGenerateCreatorArtwork();
  const useSourceAvatar = useUseCreatorSourceAvatar();
  const removeAvatar = useRemoveCreatorAvatar();
  const busy =
    uploadAvatar.isPending ||
    uploadBanner.isPending ||
    generateArtwork.isPending ||
    useSourceAvatar.isPending ||
    removeAvatar.isPending;
  const fail = (error: unknown) => toast.error(errorMessage(error, t("ui.slurp.artwork.generateError")));
  const upload = (kind: "avatar" | "banner", file: File) => {
    const mutation = kind === "avatar" ? uploadAvatar : uploadBanner;
    mutation.mutate(
      { accountId: creator.id, file },
      { onError: (error) => toast.error(errorMessage(error, t(`ui.slurp.artwork.${kind}UploadError`))) },
    );
  };
  const startGeneration = (kind: "avatar" | "banner") => {
    setArtworkKind(kind);
    setGuidance("");
    setOptions({
      creatorDetails: true,
      appearance: kind === "avatar",
      sourceReferences: kind === "avatar",
      composition: true,
    });
  };
  const promptOptions: Array<{ key: keyof SlpCreatorArtworkPromptOptions; label: string; detail: string }> = [
    {
      key: "creatorDetails",
      label: t("ui.slurp.artwork.optionCreator"),
      detail: t("ui.slurp.artwork.optionCreatorDetail"),
    },
    {
      key: "appearance",
      label: t("ui.slurp.artwork.optionAppearance"),
      detail: t("ui.slurp.artwork.optionAppearanceDetail"),
    },
    {
      key: "sourceReferences",
      label: t("ui.slurp.artwork.optionSource"),
      detail: t("ui.slurp.artwork.optionSourceDetail"),
    },
    {
      key: "composition",
      label: t("ui.slurp.artwork.optionComposition"),
      detail: t("ui.slurp.artwork.optionCompositionDetail"),
    },
  ];

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
          {creator.bannerUrl && <SlurpMediaImg src={creator.bannerUrl} alt="" className="h-full w-full object-cover" />}
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
                <Sparkles size={15} aria-hidden="true" /> {t("ui.slurp.artwork.generateAvatar")}
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
                <Sparkles size={15} aria-hidden="true" /> {t("ui.slurp.artwork.generateBanner")}
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
        <div className="space-y-3 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--noodle-accent)]/35">
          <label className="block space-y-2 text-sm font-semibold">
            <span>{t("ui.slurp.artwork.guidanceLabel")}</span>
            <textarea
              value={guidance}
              onChange={(event) => setGuidance(event.target.value)}
              maxLength={2000}
              placeholder={t(
                artworkKind === "banner" ? "ui.slurp.artwork.bannerPlaceholder" : "ui.slurp.artwork.avatarPlaceholder",
              )}
              className={`min-h-24 w-full resize-y rounded-lg bg-[var(--slurp-surface)] p-3 text-sm font-normal ring-1 ring-inset ring-[var(--slurp-outline)] ${focusRing}`}
            />
          </label>
          <p className="text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.artwork.optionalHelp")}</p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">{t("ui.slurp.artwork.optionalContext")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {promptOptions.map((option) => (
                <label
                  key={option.key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg bg-[var(--slurp-surface)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
                >
                  <input
                    type="checkbox"
                    checked={options[option.key]}
                    disabled={busy}
                    onChange={(event) => setOptions((current) => ({ ...current, [option.key]: event.target.checked }))}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--noodle-accent)]"
                  />
                  <span>
                    <span className="block text-xs font-bold">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--slurp-muted)]">{option.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => setArtworkKind(null)} className={quietButton}>
              {t("ui.slurp.artwork.cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                generateArtwork.mutate(
                  { accountId: creator.id, kind: artworkKind, guidance: guidance.trim() || undefined, options },
                  {
                    onSuccess: () => {
                      toast.success(
                        t(
                          artworkKind === "avatar"
                            ? "ui.slurp.artwork.avatarGenerated"
                            : "ui.slurp.artwork.bannerGenerated",
                        ),
                      );
                      setArtworkKind(null);
                    },
                    onError: fail,
                  },
                )
              }
              className={accentButton}
            >
              {generateArtwork.isPending ? (
                <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Sparkles size={15} aria-hidden="true" />
              )}
              {t("ui.slurp.artwork.generate")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
