import { useQuery } from "@tanstack/react-query";
import { Image as ImageIcon, ListChecks, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { readNoodlePollFromMetadata } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { noodleKeys, useNoodle, type NoodlePostPage } from "../../hooks/use-noodle";
import { formatTime } from "./NoodleDateTime";

export function NoodleLatestPostsWidget({
  active,
  onOpenPost,
  onOpenNoodle,
}: {
  active: boolean;
  onOpenPost?: (postId: string) => void;
  onOpenNoodle?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const bootstrap = useNoodle(active);
  const feed = useQuery({
    queryKey: [...noodleKeys.feed(), "home-widget", "latest-five"],
    queryFn: () => api.get<NoodlePostPage>("/noodle/feed?limit=5"),
    enabled: active,
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchInterval: active ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  if (feed.isPending || bootstrap.isPending) {
    return (
      <p role="status" className="px-1 py-3 text-xs text-[var(--muted-foreground)]">
        {t("ui.noodle.widget.loading")}
      </p>
    );
  }
  if (feed.isError || bootstrap.isError) {
    return (
      <div role="alert" className="flex h-full min-h-0 flex-col items-start justify-center gap-2 px-1">
        <p className="text-xs text-[var(--muted-foreground)]">{t("ui.noodle.widget.unavailable")}</p>
        <button
          type="button"
          onClick={() => void feed.refetch()}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <RefreshCw size="0.875rem" aria-hidden="true" /> {t("ui.noodle.widget.retry")}
        </button>
      </div>
    );
  }
  const posts = feed.data?.items ?? [];
  const stale = feed.dataUpdatedAt > 0 && Date.now() - feed.dataUpdatedAt > 60_000;
  if (posts.length === 0) {
    const needsSetup = (bootstrap.data?.accounts ?? []).length === 0;
    return (
      <div className="flex h-full min-h-0 flex-col items-start justify-center gap-2 px-1">
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          {t(needsSetup ? "ui.noodle.widget.setup" : "ui.noodle.widget.empty")}
        </p>
        {onOpenNoodle ? (
          <button
            type="button"
            onClick={onOpenNoodle}
            className="min-h-10 rounded-lg px-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            {t("ui.noodle.widget.openNoodle")}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      {stale && (
        <p role="status" className="shrink-0 pb-1 text-[0.65rem] text-[var(--muted-foreground)]">
          {t("ui.noodle.widget.stale")}
        </p>
      )}
      <div
        className="h-full min-h-0 overflow-y-auto overscroll-contain pr-1"
        role="region"
        tabIndex={0}
        aria-label={t("ui.noodle.widget.scrollLabel")}
      >
        <div className="grid gap-2">
          {posts.map((post) => {
            const author = post.authorSnapshot?.displayName || t("ui.noodle.widget.unknownAuthor");
            return (
              <button
                key={post.id}
                type="button"
                onClick={() => onOpenPost?.(post.id)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)]/75 p-3 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                aria-label={t("ui.noodle.widget.openPost", { author })}
              >
                <span className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-bold text-[var(--foreground)]">{author}</span>
                  <time className="shrink-0 text-[0.65rem] text-[var(--muted-foreground)]" dateTime={post.createdAt}>
                    {formatTime(post.createdAt, i18n.language)}
                  </time>
                </span>
                <span className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {post.content}
                </span>
                {post.imageUrl || readNoodlePollFromMetadata(post.metadata) ? (
                  <span className="mt-2 flex items-center gap-2 text-[0.65rem] text-[var(--muted-foreground)]">
                    {post.imageUrl ? (
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon size="0.75rem" aria-hidden="true" /> {t("ui.noodle.widget.image")}
                      </span>
                    ) : null}
                    {readNoodlePollFromMetadata(post.metadata) ? (
                      <span className="inline-flex items-center gap-1">
                        <ListChecks size="0.75rem" aria-hidden="true" /> {t("ui.noodle.widget.poll")}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
