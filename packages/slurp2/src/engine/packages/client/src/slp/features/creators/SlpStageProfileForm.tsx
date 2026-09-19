import { createPortal } from "react-dom";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ModalPortalContext } from "../../../components/ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Link,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import type { SlpCreatorStageProfile, SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpStageProfileInput } from "../../base/state/slp-state-types";
import { getSlpAccentStyle, SLP_PINK, ProfileInitial } from "../../base/chrome/SlpChrome";
import { isSlurpDiscoveryProfileIncomplete, SlurpDiscoveryProfileEditor } from "../discovery/slp-discovery-contract";
import { fieldClass, textareaClass } from "../../modules/post/SlpPostCard";
import { cn } from "../../../lib/utils";

/**
 * The Creator profile form lives here, not in the home screen, so the full-page editor and the
 * Creators tab in Backstage render the same controls instead of two copies that drift apart.
 */

const STAGE_PERSONALITY_MAX_LENGTH = 1000;

const DISCLOSURE_RANK: Record<SlpIdentityDisclosure, number> = { secret: 0, hinted: 1, open: 2 };

/**
 * A privacy downgrade on a Creator that carries its own uploaded avatar has to be confirmed: the
 * picture is the part that gives an identity away, and the server re-reviews it when asked to.
 * Both editors ask the same question, so the answer cannot differ between them.
 */
export async function confirmSlurpAvatarReview({
  existing,
  nextDisclosure,
  localize,
  confirm,
}: {
  existing: { id: string; avatarUrl?: string | null; disclosureMode?: SlpIdentityDisclosure | null } | null;
  nextDisclosure: SlpIdentityDisclosure;
  localize: ReturnType<typeof useUiTranslation>["t"];
  confirm: (input: { title: string; message: string; confirmLabel: string }) => Promise<boolean>;
}): Promise<{ proceed: boolean; confirmAvatarReview: boolean }> {
  const keepsSeparateAvatar = Boolean(
    existing?.avatarUrl?.startsWith(`/api/slurp2/noodler/accounts/${encodeURIComponent(existing.id)}/avatar/`),
  );
  const downgrade = Boolean(
    existing?.disclosureMode && DISCLOSURE_RANK[nextDisclosure] < DISCLOSURE_RANK[existing.disclosureMode],
  );
  if (!downgrade || !keepsSeparateAvatar) return { proceed: true, confirmAvatarReview: false };
  const confirmed = await confirm({
    title: localize("ui.noodle.stageprofileform.reviewSeparateAvatar"),
    message: localize("ui.noodle.stageprofileform.separateAvatarReviewMessage"),
    confirmLabel: localize("ui.noodle.stageprofileform.keepAvatar"),
  });
  return { proceed: confirmed, confirmAvatarReview: confirmed };
}

export const AUDIENCE_STANCE_PRESETS = [
  {
    labelKey: "ui.noodle.stageprofileform.stance.girlfriend",
    textKey: "ui.noodle.stageprofileform.stance.girlfriendText",
  },
  {
    labelKey: "ui.noodle.stageprofileform.stance.brattyTease",
    textKey: "ui.noodle.stageprofileform.stance.brattyTeaseText",
  },
  { labelKey: "ui.noodle.stageprofileform.stance.aloof", textKey: "ui.noodle.stageprofileform.stance.aloofText" },
  { labelKey: "ui.noodle.stageprofileform.stance.inCharge", textKey: "ui.noodle.stageprofileform.stance.inChargeText" },
  { labelKey: "ui.noodle.stageprofileform.stance.eager", textKey: "ui.noodle.stageprofileform.stance.eagerText" },
  { labelKey: "ui.noodle.stageprofileform.stance.shy", textKey: "ui.noodle.stageprofileform.stance.shyText" },
] as const;

export function appendAudienceStance(current: string, sentence: string): string {
  const trimmed = current.trim();
  const next = trimmed ? `${trimmed}\n${sentence}` : sentence;
  return next.length <= STAGE_PERSONALITY_MAX_LENGTH ? next : trimmed;
}

export type DisclosureOption = {
  value: SlpIdentityDisclosure;
  label: string;
  shortLabel: string;
  detail: string;
  guidance: string;
};

export function disclosureOptions(t: ReturnType<typeof useUiTranslation>["t"]): DisclosureOption[] {
  return [
    {
      value: "open",
      label: "Linked identity",
      shortLabel: "Open",
      detail: "This Creator may openly use the source identity.",
      guidance: "Names, handles, recognizable details, and continuity may carry over.",
    },
    {
      value: "hinted",
      label: t("ui.noodle.disclosure.hinted.label"),
      shortLabel: t("ui.noodle.disclosure.hinted.shortLabel"),
      detail: t("ui.noodle.disclosure.hinted.detail"),
      guidance: t("ui.noodle.disclosure.hinted.guidance"),
    },
  ];
}

export function profileAccent(_profileId: string): string {
  return SLP_PINK;
}

export function WizardFooter({
  step,
  onBack,
  onNext,
  nextDisabled = false,
  finalAction,
  disabled = false,
  backLabel = "Back",
  showProgress = true,
}: {
  step: 0 | 1 | 2;
  onBack: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  finalAction?: ReactNode;
  disabled?: boolean;
  backLabel?: string;
  showProgress?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const labels = ["Source", "Disclosure", "Profile"];
  return (
    <div className="sticky bottom-0 z-[60] shrink-0 border-t border-[var(--noodle-divider)] bg-[var(--background)] px-4 pb-3 pt-3 sm:px-6">
      {showProgress && (
        <div
          className="mb-3 flex items-center justify-center gap-1.5"
          role="status"
          aria-label={localizeUi("ui.noodle.wizardfooter.stepValue1OfValue2Value3", {
            value1: step + 1,
            value2: labels.length,
            value3: labels[step],
          })}
        >
          {labels.map((label, index) => (
            <span key={label} className="flex items-center gap-1.5">
              <span
                aria-current={index === step ? "step" : undefined}
                aria-label={localizeUi("ui.noodle.wizardfooter.stepValue1Value2Value3", {
                  value1: index + 1,
                  value2: label,
                  value3:
                    index === step
                      ? localizeUi("ui.noodle.wizardfooter.current")
                      : index < step
                        ? localizeUi("ui.noodle.wizardfooter.complete")
                        : "",
                })}
                title={label}
                className={`h-1.5 rounded-full transition-all ${index === step ? "w-6 bg-[var(--noodle-accent)]" : index < step ? "w-4 bg-[var(--noodle-accent)]/45" : "w-2 bg-[var(--muted-foreground)]/25"}`}
              />
              {index < labels.length - 1 && <span className="sr-only">{localizeUi("ui.noodle.wizardfooter.to")}</span>}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-4 text-sm font-semibold hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-50"
        >
          <ArrowLeft size={15} /> {backLabel}
        </button>
        {finalAction ?? (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || disabled}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-5 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {localizeUi("ui.noodle.wizardfooter.continue")} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export function AudienceStancePresets({
  disabled,
  onApply,
}: {
  disabled: boolean;
  onApply: (sentence: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div data-component="SlurpHome.AudienceStancePresets" className="space-y-1 pt-1">
      <span className="block text-[11px] font-semibold text-[var(--muted-foreground)]">
        {localizeUi("ui.noodle.stageprofileform.audienceStance")}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {AUDIENCE_STANCE_PRESETS.map((preset) => (
          <button
            key={preset.labelKey}
            type="button"
            disabled={disabled}
            onClick={() => onApply(localizeUi(preset.textKey))}
            className="min-h-8 rounded-full border border-[var(--noodle-divider)] px-3 text-xs font-semibold transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
          >
            {localizeUi(preset.labelKey)}
          </button>
        ))}
      </div>
      <span className="block text-[11px] text-[var(--muted-foreground)]">
        {localizeUi("ui.noodle.stageprofileform.audienceStanceHint")}
      </span>
    </div>
  );
}

export function StageProfileForm({
  draft,
  source,
  disclosureMode,
  onDisclosureChange,
  guidance,
  onGuidanceChange,
  connections,
  connectionId,
  onConnectionChange,
  onGenerate,
  isGenerating,
  previousDraft,
  onUndoDraft,
  onChange,
  sourceAccountId,
  accentId,
  isEditing,
  isPending,
  avatar,
  sourceAvatarUrl,
  avatarPending,
  onUploadAvatar,
  onUseSourceAvatar,
  onRemoveAvatar,
  onCancel,
  onSave,
  onOpenRedraft,
}: {
  draft: SlurpStageProfileInput;
  source: { displayName: string; handle: string; avatarUrl?: string | null } | null;
  disclosureMode: SlpIdentityDisclosure;
  onDisclosureChange: (value: SlpIdentityDisclosure) => void;
  guidance: string;
  onGuidanceChange: (value: string) => void;
  connections: Array<{ id: string; name: string; model?: string }>;
  connectionId: string;
  onConnectionChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  previousDraft: SlurpStageProfileInput | null;
  onUndoDraft: () => void;
  onChange: (patch: Partial<SlurpStageProfileInput>) => void;
  sourceAccountId: string | null;
  accentId: string;
  isEditing: boolean;
  isPending: boolean;
  avatar: SlpCreatorStageProfile | null;
  sourceAvatarUrl: string | null;
  avatarPending: boolean;
  onUploadAvatar: (file: File) => void;
  onUseSourceAvatar: () => void;
  onRemoveAvatar: () => void;
  onCancel: () => void;
  onSave: () => void;
  /** When set, the inline AI generator is replaced by a link into the redraft review. */
  onOpenRedraft?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const disclosureChoices = disclosureOptions(localizeUi);
  const accent = profileAccent(accentId);
  const portalContainer = useContext(ModalPortalContext);
  const [connectionPickerOpen, setConnectionPickerOpen] = useState(false);
  const [relationshipPickerOpen, setRelationshipPickerOpen] = useState(false);
  const [relationshipPickerPosition, setRelationshipPickerPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const connectionPickerRef = useRef<HTMLDivElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const relationshipPickerRef = useRef<HTMLDivElement>(null);
  const relationshipPickerMenuRef = useRef<HTMLDivElement>(null);
  const canSave =
    Boolean((isEditing || sourceAccountId) && draft.displayName.trim() && draft.handle.trim()) &&
    // A new Creator needs a gender and at least 3 tags; the server enforces the same rule.
    (isEditing || !isSlurpDiscoveryProfileIncomplete(draft)) &&
    !isPending &&
    !isGenerating;
  const selectedConnection = connections.find((connection) => connection.id === connectionId) ?? null;
  const selectedDisclosure =
    disclosureChoices.find((option) => option.value === disclosureMode) ?? disclosureChoices[0];

  useEffect(() => {
    if (!connectionPickerOpen) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!connectionPickerRef.current?.contains(event.target as Node)) {
        setConnectionPickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [connectionPickerOpen]);

  useEffect(() => {
    if (!relationshipPickerOpen) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (
        !relationshipPickerRef.current?.contains(event.target as Node) &&
        !relationshipPickerMenuRef.current?.contains(event.target as Node)
      ) {
        setRelationshipPickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [relationshipPickerOpen]);

  useEffect(() => {
    if (!relationshipPickerOpen || !relationshipPickerRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const anchor = relationshipPickerRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const menuWidth = relationshipPickerMenuRef.current?.offsetWidth ?? 288;
      const menuHeight = relationshipPickerMenuRef.current?.offsetHeight ?? 224;
      const left = Math.min(Math.max(8, anchor.left), window.innerWidth - menuWidth - 8);
      const roomBelow = window.innerHeight - anchor.bottom;
      const top = roomBelow >= menuHeight + 8 ? anchor.bottom + 4 : Math.max(8, anchor.top - menuHeight - 4);
      setRelationshipPickerPosition({ left, top });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [relationshipPickerOpen]);

  const relationshipPickerMenu =
    relationshipPickerOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={relationshipPickerMenuRef}
            role="listbox"
            aria-label={localizeUi("ui.noodle.stageprofileform.identityRelationship")}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setRelationshipPickerOpen(false);
                relationshipPickerRef.current?.querySelector("button")?.focus();
              }
            }}
            className="pointer-events-auto fixed z-[9999] w-72 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] p-1 shadow-2xl"
            style={getSlpAccentStyle(
              accent,
              relationshipPickerPosition
                ? { left: relationshipPickerPosition.left, top: relationshipPickerPosition.top }
                : { visibility: "hidden" },
            )}
          >
            {disclosureChoices.map((option) => {
              const isSelected = option.value === disclosureMode;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onDisclosureChange(option.value);
                    setRelationshipPickerOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-foreground/10",
                    isSelected && "bg-foreground/5",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-[var(--foreground)]">{option.label}</span>
                    <span className="mt-0.5 block text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
                      {option.detail}
                    </span>
                  </span>
                  {isSelected && <Check size={14} className="mt-0.5 shrink-0 text-[var(--noodle-accent)]" />}
                </button>
              );
            })}
          </div>,
          portalContainer ?? document.body,
        )
      : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <div className="px-4 py-5 sm:px-6 @min-[1024px]:py-6">
        <div className="rounded-lg border border-[var(--noodle-divider)] bg-[var(--accent)]/40 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)]">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {isEditing
                  ? localizeUi("ui.noodle.stageprofileform.refineThisStageIdentity")
                  : localizeUi("ui.noodle.stageprofileform.createTheStageIdentity")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-1 text-xs leading-5 text-[var(--muted-foreground)]">
                <span>
                  {source
                    ? localizeUi("ui.noodle.stageprofileform.builtFromValue1Value2", {
                        value1: source.displayName,
                        value2: source.handle,
                      })
                    : localizeUi("ui.noodle.stageprofileform.yourSourceIdentityIsKeptSeparateFromThisStage")}
                </span>
                <span>{localizeUi("ui.noodle.stageprofileform.relationship")}</span>
                <div ref={relationshipPickerRef} className="relative">
                  <button
                    type="button"
                    disabled={isGenerating || isPending}
                    onClick={() => setRelationshipPickerOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={relationshipPickerOpen}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-bold text-[var(--foreground)] transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {selectedDisclosure.label}
                    <ChevronDown
                      size={13}
                      className={cn("transition-transform", relationshipPickerOpen && "rotate-180")}
                    />
                  </button>
                  {relationshipPickerMenu}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {isEditing && avatar && (
            <div className="flex flex-col gap-4 rounded-lg border border-[var(--noodle-divider)] p-4 sm:flex-row sm:items-center">
              <div className="shrink-0">
                <ProfileInitial profile={avatar} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{localizeUi("ui.noodle.stageprofileform.creatorAvatar")}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                  {localizeUi("ui.noodle.stageprofileform.avatarHelp")}
                </p>
                {disclosureMode !== "open" && (
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    {localizeUi("ui.noodle.stageprofileform.sourceAvatarOpenOnly")}
                  </p>
                )}
              </div>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onUploadAvatar(file);
                }}
              />
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={avatarPending}
                  onClick={() => avatarFileRef.current?.click()}
                  title={localizeUi("ui.noodle.stageprofileform.uploadAvatar")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <Upload size={15} /> {localizeUi("ui.noodle.stageprofileform.upload")}
                </button>
                <button
                  type="button"
                  disabled={avatarPending || disclosureMode !== "open" || !sourceAvatarUrl}
                  onClick={onUseSourceAvatar}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <UserRound size={15} /> {localizeUi("ui.noodle.stageprofileform.useSource")}
                </button>
                {avatar.avatarUrl && (
                  <button
                    type="button"
                    disabled={avatarPending}
                    onClick={onRemoveAvatar}
                    title={localizeUi("ui.noodle.stageprofileform.removeAvatar")}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--noodle-divider)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{localizeUi("ui.noodle.stageprofileform.stageName")}</span>
              <input
                required
                aria-required="true"
                disabled={isGenerating || isPending}
                value={draft.displayName}
                maxLength={120}
                onChange={(event) => onChange({ displayName: event.target.value })}
                className={`${fieldClass} !h-10`}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{localizeUi("ui.noodle.stageprofileform.stageHandle")}</span>
              <span className="relative block">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-[var(--noodle-accent)]"
                >
                  @
                </span>
                <input
                  required
                  aria-required="true"
                  disabled={isGenerating || isPending}
                  value={draft.handle}
                  maxLength={40}
                  onChange={(event) => onChange({ handle: event.target.value })}
                  placeholder={localizeUi("ui.noodle.stageprofileform.afterhours")}
                  className={`${fieldClass} !h-10 !pl-7`}
                />
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{localizeUi("ui.noodle.noodleprofilesurface.bio")}</span>
              <textarea
                rows={2}
                disabled={isGenerating || isPending}
                value={draft.bio}
                maxLength={500}
                onChange={(event) => onChange({ bio: event.target.value })}
                className={`${textareaClass} !min-h-0`}
              />
              <AudienceStancePresets
                disabled={isGenerating || isPending}
                onApply={(sentence) =>
                  onChange({ stagePersonality: appendAudienceStance(draft.stagePersonality, sentence) })
                }
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{localizeUi("ui.noodle.stageprofileform.stageVoice")}</span>
              <textarea
                rows={2}
                disabled={isGenerating || isPending}
                value={draft.stagePersonality}
                maxLength={1000}
                onChange={(event) => onChange({ stagePersonality: event.target.value })}
                placeholder={localizeUi("ui.noodle.stageprofileform.voiceAttitudeBoundariesAndCreatorPersona")}
                className={`${textareaClass} !min-h-0`}
              />
            </label>
          </div>
          <SlurpDiscoveryProfileEditor
            gender={draft.gender}
            tags={draft.tags}
            disabled={isGenerating || isPending}
            onChange={onChange}
          />
          {/* In Backstage the AI rewrite goes to the redraft review, which also has to accept the
              source snapshot the model was shown. That acceptance stays in one place. */}
          {onOpenRedraft ? (
            <button
              type="button"
              onClick={onOpenRedraft}
              disabled={isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-3 text-sm font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              <Sparkles size={16} className="text-[var(--noodle-accent)]" aria-hidden="true" />
              {localizeUi("ui.noodle.stageprofileform.aiGuidance")}
            </button>
          ) : (
            <details className="group overflow-visible rounded-lg border border-[var(--noodle-divider)]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)]">
                  <Sparkles size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{localizeUi("ui.noodle.stageprofileform.aiGuidance")}</span>
                  <span className="block text-xs leading-5 text-[var(--muted-foreground)]">
                    {localizeUi("ui.noodle.stageprofileform.generateOrRewriteAnEditableProfileDraft")}
                  </span>
                </span>
                <ChevronDown
                  size={18}
                  className="shrink-0 text-[var(--muted-foreground)] transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="border-t border-[var(--noodle-divider)] p-4">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold">
                    {localizeUi("ui.noodle.stageprofileform.optionalDirectionForAi")}
                  </span>
                  <textarea
                    value={guidance}
                    maxLength={2000}
                    disabled={isGenerating || isPending}
                    onChange={(event) => onGuidanceChange(event.target.value)}
                    placeholder={localizeUi("ui.noodle.stageprofileform.aMysteriousLateNightPhotographerWithAWarmBut")}
                    className={`${textareaClass} min-h-20`}
                  />
                </label>
                {connections.length === 0 && (
                  <p className="mt-3 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-3 text-xs leading-5">
                    {localizeUi("ui.noodle.stageprofileform.noConnectionsConfiguredAddOneInSettingsConnections")}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-end gap-2">
                  {connections.length > 0 && (
                    <div ref={connectionPickerRef} className="relative shrink-0">
                      <button
                        type="button"
                        disabled={isGenerating || isPending}
                        onClick={() => setConnectionPickerOpen((open) => !open)}
                        aria-label={localizeUi("ui.noodle.connection.generationLabel", {
                          name: selectedConnection?.name ?? localizeUi("ui.noodle.connection.default"),
                        })}
                        aria-haspopup="listbox"
                        aria-expanded={connectionPickerOpen}
                        title={localizeUi("ui.noodle.connection.title", {
                          name: selectedConnection?.name ?? localizeUi("ui.noodle.connection.default"),
                        })}
                        className={cn(
                          "flex h-11 max-w-[calc(100%-10.5rem)] items-center justify-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-3 transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] sm:max-w-64",
                          connectionPickerOpen && "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10",
                          (isGenerating || isPending) && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <Link size={18} className="shrink-0 !text-[var(--noodle-accent)]" />
                        <span className="truncate text-xs font-semibold">
                          {selectedConnection?.name ?? "Default connection"}
                        </span>
                      </button>
                      {connectionPickerOpen && (
                        <div
                          role="listbox"
                          aria-label={localizeUi("ui.noodle.stageprofileform.generationConnections")}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.stopPropagation();
                              setConnectionPickerOpen(false);
                            }
                          }}
                          className="absolute bottom-full left-0 z-50 mb-2 flex w-64 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] shadow-2xl"
                        >
                          <div className="border-b border-foreground/10 px-3 py-2 text-[0.6875rem] font-semibold">
                            {localizeUi("navigation.topbar.connections")}
                          </div>
                          <div className="max-h-60 overflow-y-auto p-1">
                            <button
                              type="button"
                              role="option"
                              aria-selected={!connectionId}
                              onClick={() => {
                                onConnectionChange("");
                                setConnectionPickerOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-foreground/10",
                                !connectionId && "bg-foreground/5 font-semibold",
                              )}
                            >
                              <span className="flex-1 truncate">{localizeUi("ui.noodle.connection.default")}</span>
                              {!connectionId && <Check size={14} />}
                            </button>
                            {connections.map((connection) => {
                              const isSelected = connection.id === connectionId;
                              return (
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  key={connection.id}
                                  onClick={() => {
                                    onConnectionChange(connection.id);
                                    setConnectionPickerOpen(false);
                                  }}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-foreground/10",
                                    isSelected && "bg-foreground/5 font-semibold",
                                  )}
                                >
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate">{connection.name}</span>
                                    {connection.model && (
                                      <span className="block truncate text-[0.6875rem] font-normal text-[var(--muted-foreground)]">
                                        {connection.model}
                                      </span>
                                    )}
                                  </span>
                                  {isSelected && <Check size={14} className="shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={isGenerating || isPending || connections.length === 0}
                    className="inline-flex min-h-11 w-40 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{" "}
                    {isGenerating
                      ? localizeUi("ui.noodle.stageprofileform.generatingDraft")
                      : previousDraft
                        ? localizeUi("ui.noodle.stageprofileform.rewriteDraft")
                        : localizeUi("ui.noodle.stageprofileform.generateDraft")}
                  </button>
                </div>
                {previousDraft && !isGenerating && (
                  <button
                    type="button"
                    onClick={onUndoDraft}
                    className="mt-1 flex min-h-11 w-full items-center justify-center text-xs font-semibold text-[var(--noodle-accent)] hover:underline"
                  >
                    {localizeUi("ui.noodle.stageprofileform.undoAiChanges")}
                  </button>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
      <WizardFooter
        step={2}
        onBack={onCancel}
        backLabel={localizeUi("ui.slurp.creatorForm.cancel")}
        showProgress={!isEditing}
        disabled={isPending || isGenerating}
        finalAction={
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-5 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {isPending
              ? localizeUi("ui.noodle.stageprofileform.saving")
              : isEditing
                ? localizeUi("ui.noodle.stageprofileform.saveChanges")
                : localizeUi("ui.noodle.noodlehome.createStageProfile")}
          </button>
        }
      />
    </div>
  );
}
