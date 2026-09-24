import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Heart,
  Image as ImageIcon,
  ListChecks,
  MessageCircle,
  RefreshCw,
  Repeat2,
  Sparkles,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { readNoodlePollFromMetadata } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { noodleKeys, useNoodle, type NoodlePostPage } from "../../hooks/use-noodle";
import { formatTime } from "./NoodleDateTime";
import { Avatar } from "./NoodleShell";
import { countInteractions } from "./NoodlePostCard";
import { useUIStore } from "../../stores/noodle-package.store";
import { useCreateNoodleInteraction, useRemoveNoodleInteraction } from "../../hooks/use-noodle";

export function NoodleLatestPostsWidget({
  active,
  onOpenPost,
  onOpenNoodle,
  widgetLabel,
  widgetDescription,
  widgetAccent,
  packageId,
  packageVersion,
  compact = false,
}: {
  active: boolean;
  onOpenPost?: (postId: string) => void;
  onOpenNoodle?: () => void;
  widgetLabel?: string;
  widgetDescription?: string;
  widgetAccent?: string;
  packageId?: string;
  packageVersion?: string | null;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const bootstrap = useNoodle(active);
  const selectedPersonaId = useUIStore((state) => state.noodleSelectedPersonaId);
  const createInteraction = useCreateNoodleInteraction();
  const removeInteraction = useRemoveNoodleInteraction();
  const persona = (bootstrap.data?.accounts ?? []).find(
    (account) => account.kind === "persona" && (account.entityId === selectedPersonaId || !selectedPersonaId),
  );
  const feed = useQuery({
    queryKey: [...noodleKeys.feed(), "home-widget", compact ? "compact" : "latest-twenty"],
    queryFn: () => api.get<NoodlePostPage>(`/noodle/feed?limit=${compact ? 6 : 20}`),
    enabled: active,
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchInterval: active ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  const posts = feed.data?.items ?? [];
  const postDetails = useQueries({
    queries: posts.map((post) => ({
      queryKey: ["noodle", "post", post.id, "widget"],
      queryFn: () =>
        api.get<{ interactions: Array<{ type: string; actorAccountId?: string }> }>(
          `/noodle/posts/${encodeURIComponent(post.id)}`,
        ),
      enabled: active,
      staleTime: 15_000,
    })),
  });
  const toggleInteraction = (postId: string, type: "like" | "repost", activeInteraction: boolean) => {
    if (!persona) return;
    const input = { postId, actorKind: "persona" as const, actorEntityId: persona.entityId, type };
    if (activeInteraction) removeInteraction.mutate(input);
    else createInteraction.mutate({ ...input, content: null });
  };
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
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] bg-[var(--background)]"
      style={{ "--widget-accent": "var(--noodle-accent)" } as CSSProperties}
    >
      <header className="shrink-0 border-b border-[color-mix(in_srgb,var(--widget-accent)_24%,var(--border))] bg-[color-mix(in_srgb,var(--widget-accent)_11%,transparent)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--noodle-accent)]/10 p-1.5">
              <img
                src={
                  packageId && packageVersion
                    ? `/api/capability-packages/${encodeURIComponent(packageId)}/assets/noodle-klusek.png?v=${encodeURIComponent(packageVersion)}`
                    : undefined
                }
                alt=""
                className="h-full w-full object-contain"
              />
              {!packageId || !packageVersion ? (
                <Sparkles size="1rem" aria-hidden="true" className="text-[var(--noodle-accent)]" />
              ) : null}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-[var(--foreground)]">{t("ui.noodle.widget.title")}</h2>
              {!compact ? (
                <p className="mt-0.5 line-clamp-1 text-[0.68rem] text-[var(--muted-foreground)]">
                  {t("ui.noodle.widget.description")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {!compact && stale ? (
          <div className="mt-2 text-[0.63rem] text-[var(--muted-foreground)]">{t("ui.noodle.widget.stale")}</div>
        ) : null}
      </header>
      <div
        className="h-full min-h-0 overflow-y-auto overscroll-contain px-3 py-3"
        role="region"
        tabIndex={0}
        aria-label={t("ui.noodle.widget.scrollLabel")}
      >
        <div className="grid gap-2">
          {posts.map((post, index) => {
            const author = post.authorSnapshot?.displayName || t("ui.noodle.widget.unknownAuthor");
            const details = postDetails[index]?.data?.interactions ?? [];
            const likes = countInteractions(details as never, "like");
            const replies = countInteractions(details as never, "reply");
            const reposts = countInteractions(details as never, "repost");
            return (
              <div
                key={post.id}
                onClick={() => onOpenPost?.(post.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenPost?.(post.id);
                  }
                }}
                className="group w-full rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--background)] p-3 text-left transition-colors hover:border-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                aria-label={t("ui.noodle.widget.openPost", { author })}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {post.authorSnapshot ? <Avatar account={post.authorSnapshot} size="sm" /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-[var(--foreground)]">{author}</span>
                    <span className="block truncate text-[0.65rem] text-[var(--muted-foreground)]">
                      @{post.authorSnapshot?.handle ?? "noodle"}
                    </span>
                  </span>
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
                <span className="mt-2 flex items-center gap-3 text-[0.65rem] text-[var(--muted-foreground)]">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleInteraction(
                        post.id,
                        "like",
                        details.some((item) => item.type === "like" && item.actorAccountId === persona?.id),
                      );
                    }}
                    className="inline-flex items-center gap-1 hover:text-[var(--noodle-accent)]"
                    aria-label={t("ui.noodle.widget.openPost", { author })}
                  >
                    <Heart size="0.75rem" /> {likes}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenPost?.(post.id);
                    }}
                    className="inline-flex items-center gap-1 hover:text-[var(--noodle-accent)]"
                    aria-label={t("ui.noodle.widget.openPost", { author })}
                  >
                    <MessageCircle size="0.75rem" /> {replies}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleInteraction(
                        post.id,
                        "repost",
                        details.some((item) => item.type === "repost" && item.actorAccountId === persona?.id),
                      );
                    }}
                    className="inline-flex items-center gap-1 hover:text-[var(--noodle-accent)]"
                    aria-label={t("ui.noodle.widget.openPost", { author })}
                  >
                    <Repeat2 size="0.8rem" /> {reposts}
                  </button>
                </span>
              </div>
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
