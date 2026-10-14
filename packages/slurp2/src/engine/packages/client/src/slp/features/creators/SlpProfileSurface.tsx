import { MapPin, Upload } from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import type { ChangeEvent, CSSProperties, ReactNode, RefObject } from "react";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_IMG_FRAME_CLASS, SLP_TYPE, SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { formatSlpNumber } from "../../base/ui/slp-number-format";
import { SlpRingGlint, SlpTwinkle } from "../../modules/sparkle/SlpSparkle";
import { useSlpStoryRings } from "../../modules/story/SlpStoryRing";
import { useTranslation as useUiTranslation } from "react-i18next";

type SlurpProfileTab = "posts" | "likes" | "media";

/**
 * Editing happens in place: a field keeps the exact typography it had a moment ago and only gains
 * an editable surface. Editing used to swap the whole identity block for a stacked form with tiny
 * labels, so you lost your bearings the instant you clicked Edit and could not tell what the
 * result would look like.
 */
const inPlaceFieldClass =
  "w-full min-w-0 rounded-lg border border-dashed border-[var(--noodle-accent)]/45 bg-[var(--noodle-accent)]/[0.06] px-2 py-1 outline-none transition-colors focus:border-solid focus:border-[var(--noodle-accent)] focus:bg-[var(--noodle-accent)]/10";

const STATUS_DOT = {
  online: "bg-[var(--slurp-success)]",
  away: "bg-[var(--slurp-warning)]",
  offline: "bg-[var(--slurp-muted)]",
} as const;

interface SlurpProfileSurfaceProps<TTab extends string = SlurpProfileTab> {
  mobileHeader: ReactNode;
  account: Parameters<typeof Avatar>[0]["account"];
  /** The Creator whose Story ring the hero avatar wears (none without a live Story). */
  storyCreatorId?: string;
  displayHandle: string;
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
  /** The action row (Subscribe, Follow, Message, Tip, or the owner's own row). */
  leadingActions?: ReactNode;
  location?: string;
  /** Under the location: who they are with, or whose shared page this is (7b-couples). */
  coupleLine?: ReactNode;
  bioContent: ReactNode;
  tabs?: Array<{ id: TTab; label: string; count?: number | null; ariaLabel?: string; management?: boolean }>;
  activeTab: TTab;
  onTabChange: (tab: TTab) => void;
  /** Between the header and the tabs: the Creator's Page. */
  pageContent?: ReactNode;
  /** Right under the sticky tabs, above the list: the Posts tab's fan cards and the Creator tools card. */
  afterTabsContent?: ReactNode;
  postList: ReactNode;
  postPanelId?: string;
  accent?: string;
  status?: "online" | "away" | "offline";
  /** A null stat is still loading and shows a dash, never a false 0. */
  stats?: { followers: number | null; subscribers: number | null; likes: number | null };
  bioCollapsible?: boolean;
}

export function SlurpProfileSurface<TTab extends string = SlurpProfileTab>({
  mobileHeader,
  account,
  storyCreatorId,
  displayHandle,
  banner,
  avatarUpload,
  editor,
  leadingActions,
  location,
  coupleLine,
  bioContent,
  tabs,
  activeTab,
  onTabChange,
  pageContent,
  afterTabsContent,
  postList,
  postPanelId = "slurp-profile-panel",
  accent,
  status = "away",
  stats,
  bioCollapsible = true,
}: SlurpProfileSurfaceProps<TTab>) {
  const { t: localizeUi } = useUiTranslation();
  const editing = Boolean(editor?.isEditing);
  const resolvedTabs =
    tabs ??
    ([
      { id: "posts", label: localizeUi("ui.noodle.profile.tabs.posts") },
      { id: "likes", label: localizeUi("ui.noodle.profile.tabs.likes") },
      { id: "media", label: localizeUi("ui.noodle.profile.tabs.media") },
    ] as Array<{ id: TTab; label: string; count?: number | null; ariaLabel?: string; management?: boolean }>);
  const focusTabAt = (index: number) => {
    const next = resolvedTabs[(index + resolvedTabs.length) % resolvedTabs.length];
    if (!next) return;
    onTabChange(next.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`${postPanelId}-tab-${String(next.id)}`)?.focus();
    });
  };
  const statusLabel = localizeUi(`ui.slurp.profile.status.${status}`, { defaultValue: status });

  const storyRings = useSlpStoryRings();
  const heroRing = storyCreatorId ? storyRings.ringOf(storyCreatorId) : null;
  const avatar = (
    <div className="relative w-fit shrink-0" data-slp-story-ring={heroRing ?? undefined}>
      {/* The glint ring: a canvas-coloured gap, then the hero ring with one travelling glint. */}
      <span className="relative isolate block rounded-full bg-[var(--slurp-canvas)] p-[5px] shadow-[var(--slurp-shadow-floating)]">
        {avatarUpload?.canEdit ? (
          <button
            type="button"
            onClick={() => avatarUpload.fileRef.current?.click()}
            disabled={avatarUpload.uploadTarget === "avatar"}
            className={cn(
              "relative block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]",
              avatarUpload.uploadTarget === "avatar" && "cursor-wait opacity-80",
            )}
            title={localizeUi("editor.avatar.upload")}
            aria-label={localizeUi("editor.avatar.upload")}
          >
            <ProfileAvatar account={account} />
            {avatarUpload.uploadTarget === "avatar" ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[11px] font-semibold text-white">
                {localizeUi("ui.noodle.noodleprofilesurface.uploading_de27240")}
              </span>
            ) : (
              <span
                className="absolute bottom-0 end-0 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-md ring-1 ring-white/15 backdrop-blur-md"
                aria-hidden="true"
              >
                <Upload size={12} className="!text-white" />
              </span>
            )}
          </button>
        ) : heroRing && storyRings.open ? (
          // A live Story: the avatar plays it, like everywhere else the ring shows.
          <button
            type="button"
            onClick={() => storyRings.open?.(storyCreatorId!)}
            className="relative block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            aria-label={localizeUi("ui.slurp.moments.open", { name: account.displayName })}
          >
            <ProfileAvatar account={account} />
          </button>
        ) : (
          <ProfileAvatar account={account} />
        )}
        {/* The ring means "has a live Story" only: glint while unwatched, muted once watched (T). */}
        {!editing && heroRing && <SlpRingGlint seen={heroRing === "seen"} />}
      </span>
      {/* Status sits on the avatar (B36): a dot, with the word for screen readers and on hover. */}
      {!editing && (
        <span
          className={cn(
            "absolute bottom-[9%] end-[9%] z-10 size-4 rounded-full ring-[3px] ring-[var(--slurp-canvas)] @min-[680px]:size-5",
            STATUS_DOT[status],
          )}
          title={statusLabel}
        >
          <span className="sr-only">{statusLabel}</span>
        </span>
      )}
      {avatarUpload?.canEdit && avatarUpload.onGenerate && (
        <button
          type="button"
          onClick={avatarUpload.onGenerate}
          className="absolute bottom-0 start-0 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white shadow-md ring-1 ring-white/15 backdrop-blur-md transition-[background-color,transform] hover:bg-black/90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none motion-reduce:active:scale-100"
          title={localizeUi("ui.slurp.artwork.generateAvatar")}
          aria-label={localizeUi("ui.slurp.artwork.generateAvatar")}
        >
          <SlpSparkleGlyph size={12} className="!text-white" />
        </button>
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
  );

  const name = editor?.isEditing ? (
    <input
      value={editor.name}
      onChange={(event) => editor.onNameChange(event.target.value)}
      aria-label={localizeUi("ui.noodle.noodleprofilesurface.displayName")}
      className={cn(inPlaceFieldClass, "text-[28px] font-extrabold leading-8 tracking-[-0.02em]")}
    />
  ) : (
    <h1
      className={cn(
        "slp-display max-w-full text-[28px] leading-8 text-balance [overflow-wrap:anywhere]",
        "@min-[680px]:text-3xl @min-[1040px]:text-4xl",
      )}
    >
      {account.displayName}
    </h1>
  );

  const handle = editor?.isEditing ? (
    <span className="mt-1 flex min-w-0 items-center gap-1 text-sm font-medium !text-[var(--slurp-ink)]">
      @
      <input
        value={editor.handle}
        onChange={(event) => editor.onHandleChange(event.target.value)}
        aria-label={localizeUi("ui.noodle.noodleprofilesurface.name")}
        placeholder={localizeUi("ui.noodle.noodleprofilesurface.mari")}
        className={cn(inPlaceFieldClass, "text-sm font-medium")}
      />
    </span>
  ) : (
    // One line; a long handle truncates with the full text in its title (no mid-word breaks).
    <p
      data-noodle-profile-handle
      title={`@${displayHandle}`}
      className={cn(SLP_TYPE.meta, "mt-0.5 max-w-full truncate font-semibold !text-[var(--slurp-ink)]")}
    >
      @{displayHandle || localizeUi("ui.slurp.profile.fallbackHandle")}
    </p>
  );

  const statsRow = stats && !editing && <ProfileStats stats={stats} />;

  const bio = editor?.isEditing ? (
    <textarea
      value={editor.bio}
      onChange={(event) => editor.onBioChange(event.target.value)}
      aria-label={localizeUi("ui.noodle.noodleprofilesurface.bio")}
      className={cn(inPlaceFieldClass, "mt-3 h-24 resize-none text-sm leading-relaxed")}
    />
  ) : bioContent ? (
    // No "Bio" label (B37, design language §4: the only eyebrow is a group heading).
    <div className="mt-3 max-w-[65ch] text-[13px] leading-[19px] text-[color-mix(in_srgb,var(--slurp-text)_82%,transparent)] text-pretty">
      {bioContent && bioCollapsible && (
        <details className="group/bio">
          <summary className="list-none cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
            {/* The full text follows the summary once open, so the clamped preview steps aside. */}
            <div className="line-clamp-4 group-open/bio:hidden">{bioContent}</div>
            <span className="mt-0.5 block text-xs font-bold text-[var(--slurp-ink)] group-open/bio:hidden">
              {localizeUi("ui.slurp.profile.expandBio", { defaultValue: "Show more" })}
            </span>
          </summary>
          <div>{bioContent}</div>
          <button
            type="button"
            onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
            className="mt-0.5 block text-xs font-bold text-[var(--slurp-ink)]"
          >
            {localizeUi("ui.slurp.profile.collapseBio", { defaultValue: "Show less" })}
          </button>
        </details>
      )}
      {bioContent && !bioCollapsible && bioContent}
    </div>
  ) : null;

  const locationLine = editor?.isEditing ? (
    <span className="mt-2 flex w-full items-center gap-1.5 text-sm text-[var(--slurp-muted)]">
      <MapPin size={15} className="shrink-0 text-[var(--slurp-ink)]" />
      <input
        value={editor.location}
        onChange={(event) => editor.onLocationChange(event.target.value)}
        aria-label={localizeUi("ui.noodle.noodleprofilesurface.location")}
        placeholder={localizeUi("ui.noodle.noodleprofilesurface.somewhereCozy")}
        className={cn(inPlaceFieldClass, "text-sm")}
      />
    </span>
  ) : location ? (
    <p className={cn(SLP_TYPE.meta, "mt-2 flex items-center gap-1 text-[var(--slurp-muted)]")}>
      <MapPin size={14} className="shrink-0 text-[var(--slurp-ink)]" aria-hidden="true" />
      <span className="min-w-0 truncate">{location}</span>
    </p>
  ) : null;

  const actions = !editing && leadingActions ? <div className="mt-4 min-w-0">{leadingActions}</div> : null;

  return (
    <div
      // `clip`, not `hidden`: a hidden overflow would make this a scroll box and stop the tabs sticking.
      className="@container relative min-h-full overflow-x-clip bg-[var(--slurp-canvas,var(--background))] pb-6"
      style={accent ? ({ "--noodle-accent": accent } as CSSProperties) : undefined}
    >
      {mobileHeader}
      {banner && <ProfileBanner banner={banner} account={account} />}

      <div
        className={cn(
          "relative z-10 px-4 @min-[680px]:grid @min-[680px]:grid-cols-[auto_minmax(0,1fr)] @min-[680px]:items-start @min-[680px]:gap-x-6 @min-[680px]:px-6 @min-[1040px]:gap-x-8 @min-[1040px]:px-8",
          // The avatar rides half over the banner's pink fade.
          banner ? "-mt-16" : "pt-5",
          "@min-[680px]:-mt-16",
        )}
        data-slurp-creator-hero
      >
        {avatar}
        <div className="mt-3 min-w-0 @min-[680px]:mt-0 @min-[680px]:pt-16">
          {name}
          {handle}
          {statsRow}
          {bio}
          {locationLine}
          {!editing && coupleLine}
          {actions}
          {editing && editor?.privateFields && <div className="mt-4 w-full space-y-3">{editor.privateFields}</div>}
        </div>
      </div>

      {editing && editor && (
        <div className="mx-4 mt-4 flex justify-end gap-2 @min-[680px]:mx-6">
          <button
            type="button"
            onClick={editor.onCancel}
            className="min-h-11 rounded-full px-4 text-sm font-bold text-[var(--slurp-ink)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            {localizeUi("ui.slurp.creatorForm.cancel")}
          </button>
          <button
            type="button"
            onClick={editor.onSave}
            disabled={!editor.canSave || editor.isSaving}
            className="min-h-11 rounded-full bg-[var(--noodle-accent)] px-5 text-sm font-bold text-[var(--slurp-on-accent)] shadow-[var(--slurp-glow),var(--slurp-highlight)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            {editor.isSaving ? localizeUi("ui.noodle.noodlehome.saving") : localizeUi("ui.noodle.noodlehome.save")}
          </button>
        </div>
      )}

      {pageContent && <div className="@min-[680px]:mx-5 @min-[1040px]:mx-8">{pageContent}</div>}

      <div className="mt-5 @min-[680px]:mx-5 @min-[1040px]:mx-8">
        {/* Sticky under the profile's scroll top, on glass, so switching tabs never needs a scroll up. */}
        <div
          className="sticky top-0 z-20 flex snap-x overflow-x-auto border-b border-[var(--noodle-divider)] bg-[color-mix(in_srgb,var(--slurp-canvas)_86%,transparent)] px-2 [scrollbar-width:none] backdrop-blur-xl [mask-image:linear-gradient(to_right,#000_88%,transparent)] [&::-webkit-scrollbar]:hidden @min-[620px]:px-0 @min-[620px]:[mask-image:none]"
          role="tablist"
          aria-label={localizeUi("ui.noodle.noodleprofilesurface.profileSections")}
        >
          {resolvedTabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${postPanelId}-tab-${String(tab.id)}`}
              aria-controls={`${postPanelId}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onKeyDown={(event) => {
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
                "relative flex min-h-12 flex-none snap-start items-center justify-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-semibold text-[var(--slurp-muted)] transition-[color,transform] after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:origin-center after:scale-x-0 after:rounded-full after:bg-[var(--noodle-accent)] after:shadow-[0_0_10px_var(--noodle-accent)] after:transition-transform hover:text-[var(--slurp-text)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:after:transition-none motion-reduce:active:scale-100 @min-[620px]:flex-1",
                // Management tabs follow a hairline, so they read as a second group.
                tab.management &&
                  !resolvedTabs[index - 1]?.management &&
                  "ms-2 before:absolute before:inset-y-3 before:-start-1 before:w-px before:bg-[var(--noodle-divider)]",
                activeTab === tab.id && "font-bold text-[var(--slurp-text)] after:scale-x-100",
              )}
            >
              {tab.label}
              {/* Counts only once known and above zero: no "(0)" while loading. */}
              {typeof tab.count === "number" && tab.count > 0 && (
                <span className="text-xs font-semibold tabular-nums text-[var(--slurp-muted)]">
                  {formatSlpCompact(tab.count)}
                </span>
              )}
            </button>
          ))}
        </div>
        <div id={`${postPanelId}-panel`} role="tabpanel" aria-labelledby={`${postPanelId}-tab-${String(activeTab)}`}>
          {afterTabsContent}
          {postList}
        </div>
      </div>
    </div>
  );
}

/** 1,842 → "1.8K" for the tab strip, where room is short. */
function formatSlpCompact(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function ProfileAvatar({ account }: { account: Parameters<typeof Avatar>[0]["account"] }) {
  return (
    <Avatar
      account={account}
      size="xl"
      className={cn(
        "h-[104px] w-[104px] border-0 text-4xl font-extrabold @min-[680px]:h-32 @min-[680px]:w-32 @min-[1040px]:h-36 @min-[1040px]:w-36",
      )}
    />
  );
}

/**
 * The banner: short and cinematic, never taller than 240 px, fading into
 * the page through a pink glow. No banner: the avatar blurred into a wash, or a pink wash with a
 * few sparkles, instead of the old decorative wave.
 */
function ProfileBanner({
  banner,
  account,
}: {
  banner: NonNullable<SlurpProfileSurfaceProps["banner"]>;
  account: Parameters<typeof Avatar>[0]["account"];
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="group relative isolate overflow-hidden">
      <button
        type="button"
        onClick={() => {
          if (banner.canEdit) banner.fileRef?.current?.click();
        }}
        disabled={!banner.canEdit || banner.uploadTarget === "banner"}
        className={cn(
          "relative block w-full overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] disabled:cursor-default",
          "h-52 @min-[540px]:h-56 @min-[760px]:h-60",
          banner.uploadTarget === "banner" && "cursor-wait opacity-80",
          banner.url && SLP_IMG_FRAME_CLASS,
        )}
        title={banner.canEdit ? localizeUi("ui.noodle.noodleprofilesurface.uploadBanner") : undefined}
        aria-label={banner.canEdit ? localizeUi("ui.noodle.noodleprofilesurface.uploadBanner") : undefined}
      >
        {banner.url ? (
          <SlurpMediaImg src={banner.url} alt="" className="slp-crop-top h-full w-full object-cover" />
        ) : (
          <span
            className="absolute inset-0 isolate block"
            style={{
              backgroundImage:
                "radial-gradient(90% 120% at 15% 10%, color-mix(in srgb, var(--noodle-accent) 42%, transparent), transparent 70%), radial-gradient(80% 110% at 90% 20%, color-mix(in srgb, var(--slurp-violet) 36%, transparent), transparent 70%)",
            }}
          >
            {account.avatarUrl && (
              <SlurpMediaImg
                src={account.avatarUrl}
                mediaWidth={160}
                alt=""
                className="slp-crop-top h-full w-full scale-125 object-cover opacity-60 blur-2xl saturate-150"
              />
            )}
            <SlpTwinkle
              points={[
                { x: "12%", y: "22%", size: 12 },
                { x: "72%", y: "18%", size: 9 },
                { x: "88%", y: "46%", size: 13 },
                { x: "40%", y: "34%", size: 7 },
              ]}
            />
          </span>
        )}
        {/* Readable controls on top, and a strong pink fade into the page at the bottom. */}
        <span
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(to top, var(--slurp-canvas) 0%, color-mix(in srgb, var(--noodle-accent) 22%, var(--slurp-canvas)) 18%, color-mix(in srgb, var(--noodle-accent) 30%, transparent) 38%, transparent 62%), radial-gradient(110% 60% at 25% 100%, color-mix(in srgb, var(--noodle-accent) 55%, transparent), transparent 72%), linear-gradient(to bottom, rgb(8 4 10 / 0.45), transparent 32%)",
          }}
        />
        {banner.uploadTarget === "banner" && (
          <span className="absolute end-2 top-14 rounded-full bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--slurp-ink)] shadow-lg ring-1 ring-[var(--marinara-chat-chrome-panel-border)]">
            {localizeUi("ui.noodle.noodleprofilesurface.uploading")}
          </span>
        )}
        {banner.canEdit && banner.uploadTarget !== "banner" && (
          <span
            className="absolute end-3 top-14 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-[var(--slurp-shadow-raised)] ring-1 ring-white/15 backdrop-blur-md"
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
          className="absolute end-[4.25rem] top-14 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-[var(--slurp-shadow-raised)] ring-1 ring-white/15 backdrop-blur-md transition-[background-color,transform] hover:bg-black/80 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none motion-reduce:active:scale-100"
          title={localizeUi("ui.slurp.artwork.generateBanner")}
          aria-label={localizeUi("ui.slurp.artwork.generateBanner")}
        >
          <SlpSparkleGlyph size={13} className="!text-white" />
        </button>
      )}
      {banner.fileRef && (
        <input ref={banner.fileRef} type="file" accept="image/*" className="hidden" onChange={banner.onFileChange} />
      )}
    </div>
  );
}

/**
 * "1,842 followers · 37 subscribers · 248 likes": number bold, word muted. A stat still loading
 * shows a dash; a loaded zero is left out, and a Creator with nothing yet reads "New on Slurp"
 * instead of a row of zeros.
 */
function ProfileStats({
  stats,
}: {
  stats: { followers: number | null; subscribers: number | null; likes: number | null };
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const items = (["followers", "subscribers", "likes"] as const).filter((key) => stats[key] !== 0);
  if (items.length === 0) {
    return (
      <p className="mt-3">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--slurp-tint)] px-3 text-xs font-bold text-[var(--slurp-ink)] shadow-[var(--slurp-highlight)]">
          <SlpSparkleGlyph size={13} aria-hidden="true" className="!text-current" />
          {localizeUi("ui.slurp.profile.newOnSlurp", { defaultValue: "New on Slurp" })}
        </span>
      </p>
    );
  }
  return (
    <p className={cn(SLP_TYPE.meta, "mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[var(--slurp-muted)]")}>
      {items.map((key, index) => {
        const value = stats[key];
        return (
          <span key={key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {index > 0 && <span aria-hidden="true">·</span>}
            <strong className="text-[13px] font-extrabold tabular-nums text-[var(--slurp-text)]">
              {value === null ? "–" : formatSlpNumber(value, i18n.language)}
            </strong>
            {localizeUi(`ui.slurp.profile.stat.${key}`, { count: value ?? 2 })}
          </span>
        );
      })}
    </p>
  );
}
