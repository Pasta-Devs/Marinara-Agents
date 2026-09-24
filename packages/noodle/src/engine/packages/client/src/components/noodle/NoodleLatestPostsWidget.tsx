import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Image as ImageIcon, ListChecks, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { readNoodlePollFromMetadata } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { noodleKeys, useNoodle, type NoodlePostPage } from "../../hooks/use-noodle";
import { formatTime } from "./NoodleDateTime";

export function NoodleLatestPostsWidget({
  active,
  onOpenPost,
  onOpenNoodle,
  widgetLabel,
  widgetDescription,
  widgetAccent,
}: {
  active: boolean;
  onOpenPost?: (postId: string) => void;
  onOpenNoodle?: () => void;
  widgetLabel?: string;
  widgetDescription?: string;
  widgetAccent?: string;
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
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] bg-[color-mix(in_srgb,var(--widget-accent,#28c7c1)_7%,var(--background))]"
      style={{ "--widget-accent": widgetAccent === "violet" ? "#9b8cff" : "#28c7c1" } as CSSProperties}
    >
      <header className="shrink-0 border-b border-[color-mix(in_srgb,var(--widget-accent)_24%,var(--border))] bg-[color-mix(in_srgb,var(--widget-accent)_11%,transparent)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--widget-accent)_18%,var(--card))] text-[var(--widget-accent)]">
              <Sparkles size="1rem" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--widget-accent)]">Noodle</p>
              <h2 className="truncate text-sm font-bold text-[var(--foreground)]">
                {widgetLabel ?? t("ui.noodle.widget.title")}
              </h2>
              <p className="mt-0.5 line-clamp-1 text-[0.68rem] text-[var(--muted-foreground)]">
                {widgetDescription ?? t("ui.noodle.widget.description")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void feed.refetch()}
            aria-label={t("ui.noodle.widget.refresh")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--widget-accent)]"
          >
            <RefreshCw size="0.9rem" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[0.63rem] text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--widget-accent)]" /> {t("ui.noodle.widget.live")}
          </span>
          <span aria-hidden="true">•</span>
          <span>{t("ui.noodle.widget.latestCount", { count: posts.length })}</span>
          {stale ? <span className="ml-auto">{t("ui.noodle.widget.stale")}</span> : null}
        </div>
      </header>
      <div
        className="h-full min-h-0 overflow-y-auto overscroll-contain px-3 py-3"
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
                className="group w-full rounded-2xl border border-[color-mix(in_srgb,var(--widget-accent)_18%,var(--border))] bg-[color-mix(in_srgb,var(--card)_82%,transparent)] p-3 text-left shadow-[0_8px_24px_-20px_var(--widget-accent)] transition-colors hover:border-[color-mix(in_srgb,var(--widget-accent)_40%,var(--border))] hover:bg-[color-mix(in_srgb,var(--widget-accent)_10%,var(--card))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--widget-accent)]"
                aria-label={t("ui.noodle.widget.openPost", { author })}
              >
                <span className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-bold text-[var(--foreground)]">{author}</span>
                  <time className="shrink-0 text-[0.65rem] text-[var(--muted-foreground)]" dateTime={post.createdAt}>
                    {formatTime(post.createdAt, i18n.language)}
                  </time>
                </span>
                <span className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--foreground)]/80">
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
                    <span className="ml-auto inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <MessageCircle size="0.75rem" aria-hidden="true" />
                      <ArrowUpRight size="0.75rem" aria-hidden="true" />
                    </span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {onOpenNoodle ? (
        <footer className="shrink-0 border-t border-[color-mix(in_srgb,var(--widget-accent)_18%,var(--border))] px-3 py-2">
          <button
            type="button"
            onClick={onOpenNoodle}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--widget-accent)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--widget-accent)]"
          >
            {t("ui.noodle.widget.openNoodle")} <ArrowUpRight size="0.8rem" aria-hidden="true" />
          </button>
        </footer>
      ) : null}
    </div>
  );
}
