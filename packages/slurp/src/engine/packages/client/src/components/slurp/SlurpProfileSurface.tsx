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
    onCancel: () => void;
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
    privateFields?: ReactNode;
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
    <div className="grid min-h-11 w-full min-w-0 grid-cols-2 gap-2 [&>button]:min-w-0 [&>button:only-child]:col-span-2 @min-[560px]:flex @min-[560px]:w-auto @min-[560px]:flex-wrap @min-[560px]:justify-start @min-[560px]:[&>button:only-child]:col-span-1 @min-[860px]:justify-end">
      {!editor?.isEditing && leadingActions}
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
      {editor?.isEditing ? (
        <button
          type="button"
          onClick={editor.onCancel}
          className="min-h-11 rounded-xl border border-[var(--noodle-divider)] px-5 text-xs font-bold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
        >
          {localizeUi("ui.slurp.creatorForm.cancel")}
        </button>
      ) : (
        secondaryActions
      )}
    </div>
  );
  return (
    <div
      className="@container relative min-h-full overflow-x-hidden bg-[var(--slurp-canvas,var(--background))] pb-6 [background-image:radial-gradient(ellipse_42rem_30rem_at_10%_0%,color-mix(in_srgb,var(--noodle-accent)_18%,transparent),transparent_70%),radial-gradient(ellipse_38rem_32rem_at_94%_16%,color-mix(in_srgb,var(--slurp-violet)_14%,transparent),transparent_74%)]"
      style={accent ? ({ "--noodle-accent": accent } as CSSProperties) : undefined}
    >
      {mobileHeader}
      {banner && (
        <div
          className={cn(
            "group relative isolate overflow-hidden bg-[var(--slurp-canvas,var(--background))]",
            spotlight
              ? "shadow-[0_34px_84px_-60px_var(--noodle-accent)] ring-1 ring-inset ring-white/[0.06]"
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
              "relative block h-52 w-full overflow-hidden bg-[var(--noodle-accent)]/15 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default @min-[540px]:h-64 @min-[760px]:h-72 @min-[1040px]:h-80",
              banner.uploadTarget === "banner" && "cursor-wait opacity-80",
            )}
            title={banner.canEdit ? localizeUi("ui.noodle.noodleprofilesurface.uploadBanner") : undefined}
            aria-label={banner.canEdit ? localizeUi("ui.noodle.noodleprofilesurface.uploadBanner") : undefined}
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
                  ? "bg-[radial-gradient(ellipse_at_82%_18%,color-mix(in_srgb,var(--slurp-coral)_18%,transparent),transparent_48%),linear-gradient(to_top,var(--slurp-canvas,var(--background))_0%,color-mix(in_srgb,var(--slurp-canvas,var(--background))_96%,transparent)_20%,color-mix(in_srgb,var(--slurp-canvas,var(--background))_62%,transparent)_44%,transparent_74%),linear-gradient(to_right,rgba(8,4,10,0.62),transparent_64%)]"
                  : "bg-[linear-gradient(to_top,var(--slurp-canvas,var(--background))_0%,transparent_46%),linear-gradient(to_right,rgba(8,4,10,0.28),transparent_55%)]",
              )}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent"
              aria-hidden="true"
            />
            {banner.uploadTarget === "banner" && (
              <span className="absolute right-2 top-2 rounded-full bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--noodle-accent)] shadow-lg ring-1 ring-[var(--marinara-chat-chrome-panel-border)]">
                {localizeUi("ui.noodle.noodleprofilesurface.uploading")}
              </span>
            )}
            {banner.canEdit && banner.uploadTarget !== "banner" && (
              <span
                className="absolute end-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl bg-black/60 text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.95)] ring-1 ring-white/15 backdrop-blur-md"
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
              className="absolute end-[4.25rem] top-3 flex h-11 w-11 items-center justify-center rounded-xl bg-black/60 text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.95)] ring-1 ring-white/15 backdrop-blur-md transition-[background-color,transform] hover:bg-black/80 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none motion-reduce:active:scale-100"
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
          "relative px-4 pb-6 @min-[680px]:px-6 @min-[680px]:pb-7 @min-[1040px]:px-8",
          spotlight
            ? "bg-[linear-gradient(110deg,color-mix(in_srgb,var(--slurp-canvas)_96%,transparent),color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-canvas))_56%,color-mix(in_srgb,var(--slurp-violet)_5%,var(--slurp-canvas)))] @min-[680px]:grid @min-[680px]:grid-cols-[auto_minmax(0,1fr)] @min-[680px]:items-end @min-[680px]:gap-x-6 @min-[1040px]:gap-x-8"
            : "rounded-[1.5rem] bg-[color-mix(in_srgb,var(--slurp-surface-raised,var(--background))_96%,transparent)] shadow-[0_28px_62px_-38px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-[var(--noodle-divider)] backdrop-blur-md",
          hasBanner ? "-mt-14 @min-[680px]:-mt-20" : "mt-5",
        )}
        data-slurp-creator-hero
      >
        <div
          className={cn(
            "flex items-end",
            spotlight ? "w-auto" : "w-full",
            hasBanner ? (spotlight ? "pt-0" : "-mt-14") : "pt-5",
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
                  "relative rounded-full bg-[var(--background)] p-1 text-left shadow-[0_18px_46px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--slurp-surface-raised,var(--background))] disabled:cursor-default",
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
                    className="absolute bottom-0 end-0 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-md ring-1 ring-white/15 backdrop-blur-md"
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
                  className="absolute bottom-0 start-0 flex h-11 w-11 items-center justify-center rounded-xl bg-black/70 text-white shadow-md ring-1 ring-white/15 backdrop-blur-md transition-[background-color,transform] hover:bg-black/90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none motion-reduce:active:scale-100"
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
          <div className="mt-5 w-full space-y-3 text-left @min-[680px]:mt-0">
            <div className="grid grid-cols-1 gap-3 @min-[680px]:grid-cols-2">
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
            {editor.privateFields}
          </div>
        ) : (
          <div
            className={cn(
              "mt-4 grid w-full min-w-0 items-start gap-4 text-left @min-[680px]:mt-0",
              hasProfileActions &&
                "@min-[860px]:grid-cols-[minmax(0,1fr)_auto] @min-[860px]:items-center @min-[860px]:gap-8",
            )}
          >
            <div className="flex min-w-0 flex-col items-start">
              {identityEyebrow && (
                <div className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">
                  {identityEyebrow}
                </div>
              )}
              <h1 className="max-w-full text-2xl font-black leading-[1.08] tracking-[-0.025em] text-balance @min-[680px]:text-3xl @min-[1040px]:text-4xl">
                {account.displayName}
              </h1>
              <div className="mt-1 flex max-w-full flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <span
                  data-noodle-profile-handle
                  className="min-w-0 break-all font-medium !text-[var(--noodle-accent-foreground)]"
                >
                  @{displayHandle || localizeUi("ui.slurp.profile.fallbackHandle")}
                </span>
                {handleMeta}
              </div>
              <div className="max-w-[65ch] text-sm leading-relaxed text-[var(--muted-foreground)] text-pretty">
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
            {hasProfileActions && <div className="min-w-0 @min-[860px]:max-w-[22rem]">{profileActions}</div>}
          </div>
        )}
        {editor?.isEditing && hasProfileActions && (
          <div className={cn("mt-4", spotlight && "@min-[680px]:col-start-2")}>{profileActions}</div>
        )}
      </div>
      {preTabsContent && (
        <div
          className={cn(
            "mx-3 overflow-hidden @min-[680px]:mx-5 @min-[1040px]:mx-8",
            spotlight
              ? "mt-2 rounded-xl border-y border-white/[0.055] bg-[linear-gradient(110deg,color-mix(in_srgb,var(--noodle-accent)_6%,transparent),color-mix(in_srgb,var(--slurp-violet)_4%,transparent)_64%,transparent)]"
              : "mt-4 rounded-2xl shadow-[0_18px_42px_-34px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-[var(--noodle-divider)]",
          )}
        >
          {preTabsContent}
        </div>
      )}
      <div
        className={cn(
          "overflow-hidden @min-[680px]:mx-5 @min-[1040px]:mx-8",
          spotlight
            ? "mt-4 bg-transparent"
            : "mt-4 shadow-[0_20px_46px_-38px_rgba(0,0,0,0.95)] sm:rounded-2xl sm:ring-1 sm:ring-inset sm:ring-[var(--noodle-divider)]",
        )}
      >
        {featuredContent}
        <div
          className="flex snap-x overflow-x-auto border-b border-white/[0.07] bg-[color-mix(in_srgb,var(--slurp-canvas)_92%,transparent)] pe-8 [scrollbar-width:none] backdrop-blur-xl [&::-webkit-scrollbar]:hidden @min-[620px]:pe-0"
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
                "relative flex min-h-12 min-w-[6.25rem] flex-none snap-start items-center justify-center px-3 text-sm font-semibold text-[var(--muted-foreground)] transition-[background-color,color,transform] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-[var(--noodle-accent)] after:transition-transform hover:bg-[var(--accent)]/20 hover:text-[var(--foreground)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:after:transition-none motion-reduce:active:scale-100 @min-[620px]:min-w-0 @min-[620px]:flex-1",
                tab.management && "ms-1 min-w-[8.5rem] border-s border-white/[0.07] @min-[620px]:min-w-0",
                activeTab === tab.id && "text-[var(--foreground)] after:scale-x-100",
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
