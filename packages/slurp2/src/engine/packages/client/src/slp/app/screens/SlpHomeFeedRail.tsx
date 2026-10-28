import { Crown, Search, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlpHeartGlyph } from "../../base/chrome/SlpGlyphs";
import { SubscriptionSections } from "./SlpScreenSubscriptions";
import { cn } from "../../../lib/utils";
import { SLP_EYEBROW_CLASS, SLP_RAIL_GROUP_CLASS, SLP_SEARCH_FIELD_CLASS } from "../../base/chrome/SlpChrome";
import { SlpSegment } from "../../modules/chrome/SlpButton";
import { SlpCreatorAvatar } from "../../modules/creator/SlpCreatorProfileCard";
import { formatSlpNumber } from "../../base/ui/slp-number-format";
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
  const { i18n } = useUiTranslation();
  const creators = viewerQuery.data?.creators ?? [];
  const openProfile = (accountId: string) => onNavigate({ mode: "creator", view: "profile", accountId });
  const scoreOf = (creator: (typeof creators)[number]) =>
    discoverRank === "subscribers"
      ? (connectionCountsQuery.data?.[creator.profile.id]?.fans ?? 0)
      : creator.posts.reduce((total, post) => total + (post.likeCount ?? 0), 0);
  const searchLabel = localizeUi("ui.noodle.noodlerhome.searchPostsOrCreators");
  return (
    <aside
      className="relative hidden w-[20rem] shrink-0 overflow-hidden px-4 py-5 @min-[1280px]:block"
      aria-labelledby="slurp-rail-discover-heading"
      data-slurp-contextual-rail="populated"
    >
      <div className="sticky top-4 space-y-5">
        <label className="relative block">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
          />
          <span className="sr-only">{searchLabel}</span>
          <input
            value={feedSearch}
            onChange={(event) => setFeedSearch(event.target.value)}
            placeholder={searchLabel}
            className={cn(SLP_SEARCH_FIELD_CLASS, feedSearch && "pe-11", "text-sm")}
          />
          {feedSearch && (
            <button
              type="button"
              onClick={() => setFeedSearch("")}
              className="absolute end-0 top-0 flex h-11 w-11 items-center justify-center rounded-full text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
              aria-label={localizeUi("ui.noodle.noodlehome.clearSearch")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
        {!showDiscovery && (
          <div className="hidden @min-[1024px]:block">
            <SubscriptionSections
              creators={creators.filter(
                (creator) => creator.profile.id !== mainAuthorProfile?.id && !creator.subscribed,
              )}
              onOpenProfile={openProfile}
              embedded
            />
          </div>
        )}
        {showDiscovery && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 id="slurp-rail-discover-heading" className={SLP_EYEBROW_CLASS}>
                {localizeUi("ui.slurp.discover.topCreators", { defaultValue: "Top creators" })}
              </h2>
              <SlpSegment
                label={localizeUi("ui.slurp.discover.rankBy", { defaultValue: "Rank creators by" })}
                value={discoverRank}
                onChange={setDiscoverRank}
                options={[
                  {
                    value: "likes",
                    label: localizeUi("ui.slurp.discover.likes", { defaultValue: "Likes" }),
                    icon: <SlpHeartGlyph size={15} aria-hidden="true" />,
                  },
                  {
                    value: "subscribers",
                    label: localizeUi("ui.slurp.discover.subscribers", { defaultValue: "Subscribers" }),
                    icon: <Crown size={15} aria-hidden="true" />,
                  },
                ]}
              />
            </div>
            <ol className={SLP_RAIL_GROUP_CLASS}>
              {creators
                .slice()
                .sort((a, b) => scoreOf(b) - scoreOf(a))
                .slice(0, 5)
                .map((creator, index) => (
                  <li key={creator.profile.id}>
                    <button
                      type="button"
                      onClick={() => openProfile(creator.profile.id)}
                      className="flex min-h-14 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
                    >
                      <span
                        className={cn(
                          "w-4 shrink-0 text-center text-xs font-bold tabular-nums",
                          index === 0 ? "text-[var(--slurp-ink)]" : "text-[var(--slurp-muted)]",
                        )}
                      >
                        {index + 1}
                      </span>
                      <SlpCreatorAvatar profile={creator.profile} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold leading-5">
                          {creator.profile.displayName}
                        </span>
                        <span className="block truncate text-xs leading-4 text-[var(--slurp-muted)]">
                          @{creator.profile.handle}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-[var(--slurp-muted)]">
                        {discoverRank === "subscribers" ? (
                          <Crown size={13} aria-hidden="true" />
                        ) : (
                          <SlpHeartGlyph size={13} aria-hidden="true" />
                        )}
                        {formatSlpNumber(scoreOf(creator), i18n.language)}
                      </span>
                    </button>
                  </li>
                ))}
            </ol>
          </section>
        )}
      </div>
    </aside>
  );
}
