import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  Bell,
  BookmarkCheck,
  BookmarkPlus,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  Crown,
  Eye,
  Gift,
  Heart,
  LayoutGrid,
  Link,
  List,
  Loader2,
  Lock,
  Maximize2,
  MessageCircle,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { SubscriptionSections } from "./SlpScreenSubscriptions";
import { cn } from "../../../lib/utils";
import {
  Avatar,
  getNoodleAccentStyle,
  SLURP_TOGGLE_ACTIVE_CLASS,
  NewSinceLastVisitDivider,
  HIDE_ON_SCROLL_CLASS,
  NoodleLogo,
  ProfileInitial,
  useHideOnScroll,
  NOODLE_PERSONA_SWITCHER_PAGE_SIZE,
  NOODLE_PINK,
} from "../../base/chrome/SlpChrome";
import type { SlurpHomeHostView } from "./SlpHomeCreatorFlow";

/** The wide-screen discovery rail beside the feed. Narrow layouts omit it. */
export function SlpHomeFeedRail({ model, showDiscovery }: Pick<SlurpHomeHostView, "model" | "showDiscovery">) {
  const {
    connectionCountsQuery,
    discoverRank,
    feedSearch,
    localizeUi,
    mainAuthorProfile,
    onNavigate,
    setDiscoverRank,
    setFeedSearch,
    viewerQuery,
  } = model;
  return (
  <aside
    className="relative hidden w-[20rem] shrink-0 overflow-hidden bg-[linear-gradient(180deg,color-mix(in_srgb,var(--slurp-surface)_52%,transparent),transparent_32rem)] px-4 py-5 @min-[1280px]:block"
    aria-labelledby="slurp-rail-discover-heading"
    data-slurp-contextual-rail="populated"
  >
    <div className="sticky top-4 space-y-6">
      <label className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--slurp-glass)] px-3 text-sm shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-xl transition-[background-color,box-shadow] focus-within:bg-[var(--slurp-surface-raised)] focus-within:ring-2 focus-within:ring-[var(--noodle-accent)]">
        <Search size={17} className="shrink-0 !text-[var(--noodle-accent)]" />
        <input
          value={feedSearch}
          onChange={(event) => setFeedSearch(event.target.value)}
          placeholder={localizeUi("ui.noodle.noodlerhome.searchPostsOrCreators")}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
        />
        {feedSearch.trim() && (
          <button
            type="button"
            onClick={() => setFeedSearch("")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
            title={localizeUi("ui.noodle.noodlehome.clearSearch")}
          >
            <X size={13} />
          </button>
        )}
      </label>
      {!showDiscovery && (
        <div className="hidden pt-1 @min-[1024px]:block">
          <SubscriptionSections
            creators={(viewerQuery.data?.creators ?? []).filter(
              (creator) => creator.profile.id !== mainAuthorProfile?.id && !creator.subscribed,
            )}
            onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
            embedded
          />
        </div>
      )}
      {showDiscovery && (
        <section className="overflow-hidden rounded-2xl bg-[var(--slurp-surface)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]">
          <div className="flex items-center justify-between gap-3 p-4 pb-3">
            <div>
              <h2 className="text-sm font-black">
                {localizeUi("ui.slurp.discover.topCreators", { defaultValue: "Top creators" })}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.discover.topCreatorsDetail", { defaultValue: "Who everyone is loving" })}
              </p>
            </div>
            <div
              className="flex rounded-full bg-[var(--accent)] p-1"
              role="group"
              aria-label={localizeUi("ui.slurp.discover.rankBy", { defaultValue: "Rank creators by" })}
            >
              {(
                [
                  ["likes", Heart, localizeUi("ui.slurp.discover.likes", { defaultValue: "Likes" })],
                  [
                    "subscribers",
                    Crown,
                    localizeUi("ui.slurp.discover.subscribers", { defaultValue: "Subscribers" }),
                  ],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDiscoverRank(value)}
                  aria-pressed={discoverRank === value}
                  aria-label={label}
                  title={label}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-[background-color,color,transform] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none",
                    discoverRank === value &&
                      "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 shadow-sm",
                  )}
                >
                  <Icon size={14} fill={discoverRank === value ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          <ol className="border-t border-[var(--noodle-divider)]">
            {(viewerQuery.data?.creators ?? [])
              .slice()
              .sort((a, b) => {
                const score = (creator: typeof a) =>
                  discoverRank === "subscribers"
                    ? (connectionCountsQuery.data?.[creator.profile.id]?.fans ?? 0)
                    : creator.posts.reduce((total, post) => total + (post.likeCount ?? 0), 0);
                return score(b) - score(a);
              })
              .slice(0, 5)
              .map((creator, index) => {
                const score =
                  discoverRank === "subscribers"
                    ? (connectionCountsQuery.data?.[creator.profile.id]?.fans ?? 0)
                    : creator.posts.reduce((total, post) => total + (post.likeCount ?? 0), 0);
                return (
                  <li key={creator.profile.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate({ mode: "creator", view: "profile", accountId: creator.profile.id })}
                      className="group flex min-h-14 w-full items-center gap-3 border-b border-[var(--noodle-divider)] px-4 text-left transition-colors last:border-b-0 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.68rem] font-black tabular-nums",
                          index === 0
                            ? "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950"
                            : "bg-[var(--accent)] text-[var(--muted-foreground)]",
                        )}
                      >
                        {index + 1}
                      </span>
                      <Avatar account={creator.profile} size="xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">{creator.profile.displayName}</span>
                        <span className="block truncate text-[0.68rem] text-[var(--muted-foreground)]">
                          @{creator.profile.handle}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-black tabular-nums text-[var(--noodle-accent)]">
                        {discoverRank === "subscribers" ? (
                          <Crown size={12} aria-hidden="true" />
                        ) : (
                          <Heart size={12} fill="currentColor" aria-hidden="true" />
                        )}
                        {score.toLocaleString()}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ol>
        </section>
      )}
    </div>
  </aside>
);
}
