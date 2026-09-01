import { MapPin, Sparkles, Upload } from "lucide-react";
import type { ChangeEvent, CSSProperties, ReactNode, RefObject } from "react";
import { cn } from "../../lib/utils";
import { Avatar } from "./SlurpShell";
import { useTranslation as useUiTranslation } from "react-i18next";

type SlurpProfileTab = "posts" | "likes" | "media";

const fieldClass =
  "mari-chrome-field h-9 w-full min-w-0 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--marinara-chat-chrome-panel-muted)]";

interface SlurpProfileSurfaceProps<TTab extends string = SlurpProfileTab> {
  mobileHeader: ReactNode;
  account: Parameters<typeof Avatar>[0]["account"];
  displayHandle: string;
  identityEyebrow?: ReactNode;
  handleMeta?: ReactNode;
  banner?: {
    url: string | null;
    canEdit: boolean;
    uploadTarget: "avatar" | "banner" | null;
    /** Omitted by read-only hosts (NoodleR), which show a banner but never replace it. */
    fileRef?: RefObject<HTMLInputElement | null>;
    onFileChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    onGenerate?: () => void;
  };
  avatarUpload?: {
    canEdit: boolean;
    uploadTarget: "avatar" | "banner" | null;
    fileRef: RefObject<HTMLInputElement | null>;
    onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onGenerate?: () => void;
  };
  editor?: {
    isEditing: boolean;
    onStartEditing: () => void;
    onSave: () => void;
    canSave: boolean;
    isSaving: boolean;
    name: string;
    onNameChange: (value: string) => void;
    handle: string;
    onHandleChange: (value: string) => void;
    bio: string;
    onBioChange: (value: string) => void;
    location: string;
    onLocationChange: (value: string) => void;
  };
  followAction?: { followed: boolean; pending: boolean; onToggle: () => void };
  leadingActions?: ReactNode;
  secondaryActions?: ReactNode;
  decorativeBanner?: boolean;
  location?: string;
  bioContent: ReactNode;
  contentActions?: ReactNode;
  connections?: {
    followingCount: number;
    followerCount: number;
    onOpenFollowing: () => void;
    onOpenFollowers: () => void;
  };
  tabs?: Array<{ id: TTab; label: ReactNode; ariaLabel?: string; management?: boolean }>;
  activeTab: TTab;
  onTabChange: (tab: TTab) => void;
  preTabsContent?: ReactNode;
  postList: ReactNode;
  postPanelId?: string;
  accent?: string;
  featuredContent?: ReactNode;
  spotlight?: boolean;
}

export function SlurpProfileSurface<TTab extends string = SlurpProfileTab>({
  mobileHeader,
  account,
  displayHandle,
  identityEyebrow,
  handleMeta,
  banner,
  avatarUpload,
  editor,
  followAction,
  leadingActions,
  secondaryActions,
  decorativeBanner = false,
  location,
  bioContent,
  contentActions,
  connections,
  tabs,
  activeTab,
  onTabChange,
  preTabsContent,
  postList,
  postPanelId = "slurp-profile-panel",
  accent,
  featuredContent,
  spotlight = false,
}: SlurpProfileSurfaceProps<TTab>) {
  const { t: localizeUi } = useUiTranslation();
  const hasBanner = Boolean(banner) || decorativeBanner;
  const resolvedTabs =
    tabs ??
    ([
      { id: "posts", label: localizeUi("ui.noodle.profile.tabs.posts") },
      { id: "likes", label: localizeUi("ui.noodle.profile.tabs.likes") },
      { id: "media", label: localizeUi("ui.noodle.profile.tabs.media") },
    ] as Array<{ id: TTab; label: ReactNode; ariaLabel?: string; management?: boolean }>);
  const focusTabAt = (index: number) => {
    const next = resolvedTabs[(index + resolvedTabs.length) % resolvedTabs.length];
    if (!next) return;
    onTabChange(next.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`${postPanelId}-tab-${String(next.id)}`)?.focus();
    });
  };
  const hasProfileActions = Boolean(leadingActions || editor || followAction || secondaryActions);
  const profileActions = (
    <div className="grid min-h-11 w-full min-w-0 grid-cols-2 gap-2 [&>button]:min-w-0 [&>button:only-child]:col-span-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:[&>button:only-child]:col-span-1">
      {leadingActions}
      {editor ? (
        <button
          type="button"
          onClick={() => {
            if (editor.isEditing) editor.onSave();
            else editor.onStartEditing();
          }}
          disabled={editor.isEditing ? !editor.canSave || editor.isSaving : false}
          className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-5 text-xs font-bold text-zinc-950 shadow-sm transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {editor.isEditing
            ? editor.isSaving
              ? localizeUi("ui.noodle.noodlehome.saving")
              : localizeUi("ui.noodle.noodlehome.save")
            : localizeUi("ui.noodle.stageprofileview.editProfile")}
        </button>
      ) : followAction ? (
        <button
          type="button"
          onClick={followAction.onToggle}
          disabled={followAction.pending}
          className={cn(
            "min-h-11 rounded-xl px-5 text-xs font-bold transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50",
            followAction.followed
              ? "border border-[var(--noodle-divider)] text-[var(--foreground)]"
              : "bg-[var(--foreground)] text-[var(--background)]",
          )}
        >
          {followAction.followed
            ? localizeUi("ui.noodle.connections.tabs.following")
            : localizeUi("ui.noodle.noodlehome.follow")}
        </button>
      ) : null}
      {secondaryActions}
    </div>
  );
  return (
    <div
      className="relative min-h-full bg-[var(--slurp-canvas,var(--background))] pb-6 [background-image:radial-gradient(circle_at_50%_8%,color-mix(in_srgb,var(--noodle-accent)_8%,transparent),transparent_28rem)]"
      style={accent ? ({ "--noodle-accent": accent } as CSSProperties) : undefined}
    >
      {mobileHeader}
      {banner && (
        <div
          className={cn(
            "group relative overflow-hidden bg-[var(--slurp-canvas,var(--background))]",
            spotlight
              ? "shadow-[0_28px_70px_-54px_var(--noodle-accent)]"
              : "rounded-b-2xl shadow-[0_24px_54px_-40px_rgba(0,0,0,0.95)]",
          )}
        >
          <button
            type="button"
            onClick={() => {
              if (banner.canEdit) banner.fileRef?.current?.click();
            }}
            disabled={!banner.canEdit || banner.uploadTarget === "banner"}
            className={cn(
              "relative block h-60 w-full overflow-hidden bg-[var(--noodle-accent)]/15 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default sm:h-72",
              banner.uploadTarget === "banner" && "cursor-wait opacity-80",
            )}
            title={banner.canEdit ? localizeUi("ui.noodle.noodleprofilesurface.uploadBanner") : undefined}
          >
            {banner.url ? (
              <img src={banner.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-[var(--noodle-accent)]/10">
                <span className="text-3xl font-black tracking-[0.12em] text-[var(--noodle-accent)]/70">SLURP</span>
              </div>
            )}
            <span
              className={cn(
                "pointer-events-none absolute inset-0",
                spotlight
                  ? "bg-[linear-gradient(to_top,var(--slurp-canvas,var(--background))_0%,color-mix(in_srgb,var(--slurp-canvas,var(--background))_88%,transparent)_16%,color-mix(in_srgb,var(--slurp-canvas,var(--background))_42%,transparent)_38%,transparent_68%),linear-gradient(to_right,rgba(8,4,10,0.42),transparent_58%)]"
                  : "bg-[linear-gradient(to_top,var(--slurp-canvas,var(--background))_0%,transparent_46%),linear-gradient(to_right,rgba(8,4,10,0.28),transparent_55%)]",
              )}
              aria-hidden="true"
            />
            {banner.uploadTarget === "banner" && (
              <span className="absolute bottom-3 right-3 rounded-full bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--noodle-accent)] shadow-lg ring-1 ring-[var(--marinara-chat-chrome-panel-border)]">
                {localizeUi("ui.noodle.noodleprofilesurface.uploading")}
              </span>
            )}
            {banner.canEdit && banner.uploadTarget !== "banner" && (
              <span
                className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-lg bg-black/70 text-white shadow-md"
                aria-hidden="true"
              >
                <Upload size={13} className="!text-white" />
              </span>
            )}
          </button>
          {banner.canEdit && banner.onGenerate && (
            <button
              type="button"
              onClick={banner.onGenerate}
              className="absolute bottom-2 right-14 flex h-11 w-11 items-center justify-center rounded-lg bg-black/70 text-white shadow-md hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              title={localizeUi("ui.slurp.artwork.generateBanner")}
              aria-label={localizeUi("ui.slurp.artwork.generateBanner")}
            >
              <Sparkles size={13} className="!text-white" />
            </button>
          )}
          {banner.fileRef && (
            <input
              ref={banner.fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={banner.onFileChange}
            />
          )}
        </div>
      )}
      {!banner && decorativeBanner && <div className="h-40 w-full bg-[var(--noodle-accent)]/10" aria-hidden="true" />}

      <div
        className={cn(
          "relative mx-3 px-4 pb-5 sm:mx-5 sm:px-6 sm:pb-6",
          spotlight
            ? "sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end sm:gap-x-6"
            : "rounded-[1.5rem] bg-[color-mix(in_srgb,var(--slurp-surface-raised,var(--background))_96%,transparent)] shadow-[0_28px_62px_-38px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-[var(--noodle-divider)] backdrop-blur-md",
          hasBanner ? "-mt-12" : "mt-5",
        )}
        data-slurp-creator-hero
      >
        <div className={cn("flex items-end", spotlight ? "w-auto" : "w-full", hasBanner ? "-mt-14" : "pt-5")}>
          {avatarUpload ? (
            <div className="group relative">
              <button
                type="button"
                onClick={() => {
                  if (avatarUpload.canEdit) avatarUpload.fileRef.current?.click();
                }}
                disabled={!avatarUpload.canEdit || avatarUpload.uploadTarget === "avatar"}
                className={cn(
                  "relative rounded-full bg-[var(--background)] p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--slurp-surface-raised,var(--background))] disabled:cursor-default",
                  avatarUpload.uploadTarget === "avatar" && "cursor-wait opacity-80",
                )}
                title={avatarUpload.canEdit ? localizeUi("editor.avatar.upload") : undefined}
              >
                <Avatar account={account} size="xl" />
                {avatarUpload.uploadTarget === "avatar" && (
                  <span className="absolute inset-1 flex items-center justify-center rounded-full bg-black/50 text-[0.625rem] font-semibold text-white">
                    {localizeUi("ui.noodle.noodleprofilesurface.uploading_de27240")}
                  </span>
                )}
                {avatarUpload.canEdit && avatarUpload.uploadTarget !== "avatar" && (
                  <span
                    className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-white shadow-md"
                    aria-hidden="true"
                  >
                    <Upload size={12} className="!text-white" />
                  </span>
                )}
              </button>
              {avatarUpload.canEdit && avatarUpload.onGenerate && (
                <button
                  type="button"
                  onClick={avatarUpload.onGenerate}
                  className="absolute bottom-0 left-full ml-2 flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-black/75 text-white shadow-md hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  title={localizeUi("ui.slurp.artwork.generateAvatar")}
                  aria-label={localizeUi("ui.slurp.artwork.generateAvatar")}
                >
                  <Sparkles size={12} className="!text-white" />
                </button>
              )}
            </div>
          ) : decorativeBanner ? (
            <div className="shrink-0 rounded-full ring-4 ring-[var(--background)]">
              <Avatar account={account} size="xl" solid />
            </div>
          ) : (
            <Avatar account={account} size="xl" />
          )}
          {avatarUpload && (
            <input
              ref={avatarUpload.fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={avatarUpload.onFileChange}
            />
          )}
        </div>

        {editor?.isEditing ? (
          <div className="mt-5 w-full space-y-3 text-left">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className={labelClass}>{localizeUi("ui.noodle.noodleprofilesurface.displayName")}</span>
                <input
                  value={editor.name}
                  onChange={(event) => editor.onNameChange(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className={labelClass}>{localizeUi("ui.noodle.noodleprofilesurface.name")}</span>
                <input
                  value={editor.handle}
                  onChange={(event) => editor.onHandleChange(event.target.value)}
                  className={fieldClass}
                  placeholder={localizeUi("ui.noodle.noodleprofilesurface.mari")}
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className={labelClass}>{localizeUi("ui.noodle.noodleprofilesurface.bio")}</span>
              <textarea
                value={editor.bio}
                onChange={(event) => editor.onBioChange(event.target.value)}
                className={cn(fieldClass, "h-24 resize-none py-2")}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClass}>{localizeUi("ui.noodle.noodleprofilesurface.location")}</span>
              <input
                value={editor.location}
                onChange={(event) => editor.onLocationChange(event.target.value)}
                className={fieldClass}
                placeholder={localizeUi("ui.noodle.noodleprofilesurface.somewhereCozy")}
              />
            </label>
          </div>
        ) : (
          <div
            className={cn(
              "mt-4 grid w-full min-w-0 items-start gap-4 text-left",
              spotlight && "sm:mt-0",
              hasProfileActions && "sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6",
            )}
          >
            <div className="flex min-w-0 flex-col items-start">
              {identityEyebrow && (
                <div className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">
                  {identityEyebrow}
                </div>
              )}
              <h1 className="max-w-full text-2xl font-black leading-tight tracking-tight text-balance sm:text-3xl">
                {account.displayName}
              </h1>
              <div className="mt-1 flex max-w-full flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <span
                  data-noodle-profile-handle
                  className="min-w-0 break-all font-medium !text-[var(--noodle-accent-foreground)]"
                >
                  @{displayHandle || "noodle"}
                </span>
                {handleMeta}
              </div>
              <div className="max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)] text-pretty">
                {bioContent}
              </div>
              {contentActions}
              {location && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                  <MapPin size={15} className="text-[var(--noodle-accent)]" />
                  {location}
                </p>
              )}
              {connections && (
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--noodle-divider)] pt-3 text-sm text-[var(--muted-foreground)]">
                  <button
                    type="button"
                    onClick={connections.onOpenFollowing}
                    className="min-h-11 px-1 transition-colors hover:text-[var(--noodle-accent)]"
                  >
                    <span className="font-bold text-[var(--foreground)]">{connections.followingCount}</span>{" "}
                    {localizeUi("ui.noodle.noodleprofilesurface.following")}
                  </button>
                  <button
                    type="button"
                    onClick={connections.onOpenFollowers}
                    className="min-h-11 px-1 transition-colors hover:text-[var(--noodle-accent)]"
                  >
                    <span className="font-bold text-[var(--foreground)]">{connections.followerCount}</span>{" "}
                    {localizeUi("ui.noodle.noodleprofilesurface.followers")}
                  </button>
                </div>
              )}
            </div>
            {hasProfileActions && <div className="min-w-0 sm:max-w-[22rem]">{profileActions}</div>}
          </div>
        )}
        {editor?.isEditing && hasProfileActions && (
          <div className={cn("mt-4", spotlight && "sm:col-start-2")}>{profileActions}</div>
        )}
      </div>
      {preTabsContent && (
        <div
          className={cn(
            "mx-3 overflow-hidden bg-[var(--slurp-surface,var(--background))] sm:mx-5",
            spotlight
              ? "mt-2 rounded-xl shadow-[0_18px_48px_-38px_var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/15"
              : "mt-4 rounded-2xl shadow-[0_18px_42px_-34px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-[var(--noodle-divider)]",
          )}
        >
          {preTabsContent}
        </div>
      )}
      <div
        className={cn(
          "overflow-hidden border-y border-[var(--noodle-divider)] bg-[var(--slurp-surface,var(--background))] sm:mx-5 sm:border-0",
          spotlight
            ? "mt-3 sm:rounded-xl sm:ring-1 sm:ring-inset sm:ring-[var(--noodle-divider)]"
            : "mt-4 shadow-[0_20px_46px_-38px_rgba(0,0,0,0.95)] sm:rounded-2xl sm:ring-1 sm:ring-inset sm:ring-[var(--noodle-divider)]",
        )}
      >
        {featuredContent}
        <div
          className="m-2 flex rounded-xl bg-[var(--slurp-canvas,var(--background))] p-1 ring-1 ring-inset ring-[var(--noodle-divider)]"
          role="tablist"
          aria-label={localizeUi("ui.noodle.noodleprofilesurface.profileSections")}
        >
          {resolvedTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${postPanelId}-tab-${String(tab.id)}`}
              aria-controls={`${postPanelId}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onKeyDown={(event) => {
                const index = resolvedTabs.findIndex((item) => item.id === tab.id);
                if (event.key === "ArrowRight") focusTabAt(index + 1);
                else if (event.key === "ArrowLeft") focusTabAt(index - 1);
                else if (event.key === "Home") focusTabAt(0);
                else if (event.key === "End") focusTabAt(resolvedTabs.length - 1);
                else return;
                event.preventDefault();
              }}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.ariaLabel}
              aria-selected={activeTab === tab.id}
              className={cn(
                "relative flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-2 text-sm font-semibold text-[var(--muted-foreground)] transition-[background-color,color,box-shadow,transform] hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100",
                tab.management &&
                  "ms-1 border-s border-[var(--noodle-divider)] bg-[var(--slurp-surface-raised,var(--background))]",
                activeTab === tab.id &&
                  "bg-[var(--slurp-surface-raised,var(--background))] text-[var(--foreground)] shadow-sm",
              )}
            >
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
        <div id={`${postPanelId}-panel`} role="tabpanel" aria-labelledby={`${postPanelId}-tab-${String(activeTab)}`}>
          {postList}
        </div>
      </div>
    </div>
  );
}
