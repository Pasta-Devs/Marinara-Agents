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
  return (
    <div
      className="relative min-h-full bg-[var(--slurp-canvas,var(--background))] pb-5"
      style={accent ? ({ "--noodle-accent": accent } as CSSProperties) : undefined}
    >
      {mobileHeader}
      {banner && (
        <div className="group relative overflow-hidden rounded-b-xl border-b border-[var(--noodle-divider)] bg-[var(--slurp-canvas,var(--background))]">
          <button
            type="button"
            onClick={() => {
              if (banner.canEdit) banner.fileRef?.current?.click();
            }}
            disabled={!banner.canEdit || banner.uploadTarget === "banner"}
            className={cn(
              "relative block h-52 w-full overflow-hidden bg-[var(--noodle-accent)]/15 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default sm:h-72",
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
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,var(--slurp-canvas,var(--background))_0%,transparent_46%),linear-gradient(to_right,rgba(8,4,10,0.28),transparent_55%)]"
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
          "relative mx-3 rounded-xl border border-[var(--noodle-divider)] bg-[color-mix(in_srgb,var(--slurp-surface-raised,var(--background))_94%,transparent)] px-4 pb-5 shadow-xl shadow-black/15 backdrop-blur-md sm:mx-5 sm:px-6",
          hasBanner ? "-mt-14" : "mt-5",
        )}
      >
        <div
          className={cn(
            "flex w-full flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between",
            hasBanner ? "-mt-10" : "pt-5",
          )}
        >
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
          <div className="flex min-h-11 w-full min-w-0 flex-wrap items-center gap-2 [&>button]:flex-1 sm:w-auto sm:justify-end sm:[&>button]:flex-none">
            {leadingActions}
            {editor ? (
              <button
                type="button"
                onClick={() => {
                  if (editor.isEditing) editor.onSave();
                  else editor.onStartEditing();
                }}
                disabled={editor.isEditing ? !editor.canSave || editor.isSaving : false}
                className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-5 text-xs font-bold text-zinc-950 transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                  "min-h-11 rounded-lg px-5 text-xs font-bold transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50",
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
          <div className="mt-4 flex w-full flex-col items-start text-left">
            {identityEyebrow && (
              <div className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">
                {identityEyebrow}
              </div>
            )}
            <h1 className="text-2xl font-bold leading-tight text-balance sm:text-3xl">{account.displayName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <span data-noodle-profile-handle className="font-medium !text-[var(--noodle-accent-foreground)]">
                @{displayHandle || "noodle"}
              </span>
              {handleMeta}
            </div>
            <div className="max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">{bioContent}</div>
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
        )}
      </div>
      <div className="mt-4 overflow-hidden border-y border-[var(--noodle-divider)] bg-[var(--slurp-surface,var(--background))] sm:mx-5 sm:rounded-xl sm:border">
        {preTabsContent}
        {featuredContent}
        <div
          className="flex border-b border-[var(--noodle-divider)]"
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
                "relative flex h-12 min-w-0 flex-1 items-center justify-center px-2 text-sm font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]",
                tab.management &&
                  "border-l border-[var(--noodle-divider)] bg-[var(--slurp-surface-raised,var(--background))]",
                activeTab === tab.id && "text-[var(--foreground)]",
              )}
            >
              <span className="truncate">{tab.label}</span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-[var(--noodle-accent)]" />
              )}
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
