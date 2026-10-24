import type { ReactNode } from "react";
import { SlpCoinText } from "../../modules/coin/SlpCoin";
import { Avatar } from "../../base/chrome/SlpChrome";
import { SLP_LIVE_STYLES } from "../../modules/live/slp-live-styles";
import type { SlpLiveShow } from "./slp-live-contract";

export function slpLivePictureUrl(show: SlpLiveShow, mediaId: string, personaId: string) {
  return `/api/slurp2/live/${encodeURIComponent(show.id)}/picture/${encodeURIComponent(mediaId)}?personaId=${encodeURIComponent(personaId)}`;
}

/** A tip counts as big when it alone is a quarter of the goal (the whale tip). */
export function slpLiveBigTip(show: SlpLiveShow, amount: number) {
  return amount >= Math.max(1, show.goal) * 0.25;
}

const glass = "bg-black/40 text-white ring-1 ring-white/15 backdrop-blur-md";

export function SlpLiveStage({
  show,
  elapsed,
  creatorName,
  avatarUrl,
  personaId,
  left,
  goalTarget,
  topTip,
  onBack,
  actions,
  t,
}: {
  show: SlpLiveShow;
  elapsed: number;
  creatorName: string;
  avatarUrl?: string | null;
  personaId: string | null;
  left: number;
  goalTarget: number;
  topTip: { name: string; amount?: number } | null;
  onBack: () => void;
  actions?: ReactNode;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const seen = show.script.filter((line) => line.at <= elapsed);
  const picture = personaId ? seen.findLast((line) => line.kind === "picture" && line.mediaId) : undefined;
  const caption = seen.findLast((line) => line.kind === "narration");
  const tip = show.events.findLast((event) => event.kind === "tip" && event.at <= elapsed);
  const goalAt = show.goalHitAt ? Date.parse(show.goalHitAt) - Date.parse(show.startedAt) : null;
  const goalBanner = goalAt !== null && elapsed >= goalAt && elapsed - goalAt < 6_000;
  const tipBanner = !goalBanner && tip && elapsed - tip.at < 4_500 ? tip : null;
  const percent = Math.min(100, Math.round((show.raised / Math.max(1, goalTarget)) * 100));
  const backdrop = picture?.mediaId && personaId ? slpLivePictureUrl(show, picture.mediaId, personaId) : avatarUrl;
  return (
    <section className="relative isolate h-[44dvh] min-h-64 shrink-0 overflow-hidden bg-[var(--slurp-canvas)] text-white lg:h-auto lg:min-h-0 lg:flex-1 lg:rounded-3xl">
      <style>{SLP_LIVE_STYLES}</style>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--noodle-accent)_55%,transparent),transparent_60%),radial-gradient(circle_at_80%_90%,color-mix(in_srgb,var(--slurp-violet)_50%,transparent),transparent_55%)]"
      />
      {backdrop && (
        <img
          aria-hidden="true"
          src={backdrop}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
        />
      )}
      {picture?.mediaId && personaId ? (
        <img
          key={picture.mediaId}
          src={slpLivePictureUrl(show, picture.mediaId, personaId)}
          alt={t("ui.slurp.live.pictureAlt", { name: creatorName })}
          className="slp-live-fade absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center pb-16">
          <div className="rounded-full p-1 ring-4 ring-[color-mix(in_srgb,var(--noodle-accent)_70%,transparent)] shadow-[0_0_60px_color-mix(in_srgb,var(--noodle-accent)_55%,transparent)]">
            <Avatar
              account={{ displayName: creatorName, avatarUrl: avatarUrl ?? null }}
              size="xl"
              className="h-28 w-28"
            />
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
      <header className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("ui.slurp.live.back")}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${glass}`}
        >
          ‹
        </button>
        <span
          role="status"
          aria-label={t("ui.slurp.live.liveNow")}
          className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-black tracking-wide shadow-[0_0_18px_rgb(220_38_38/0.6)]"
        >
          <span className="slp-live-dot h-2 w-2 rounded-full bg-white" />
          {t("ui.slurp.live.badge")}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${glass}`}>
          {t("ui.slurp.live.viewers", { count: show.viewers ?? 0 })}
        </span>
        <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold min-[380px]:inline ${glass}`}>
          {t("ui.slurp.live.left", { count: left })}
        </span>
        <span className="flex-1" />
        {actions}
      </header>
      {(tipBanner || goalBanner) && (
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4" aria-live="polite">
          {goalBanner ? (
            <p
              key="goal"
              className="slp-live-pop rounded-2xl bg-[linear-gradient(135deg,var(--noodle-accent),var(--slurp-violet))] px-5 py-3 text-center text-lg font-black text-white shadow-[0_10px_40px_color-mix(in_srgb,var(--noodle-accent)_60%,transparent)]"
            >
              {t("ui.slurp.live.goalHit")}
            </p>
          ) : tipBanner ? (
            <p
              key={tipBanner.requestId ?? tipBanner.at}
              className={`slp-live-pop rounded-2xl px-4 py-2.5 text-center font-extrabold text-[var(--slurp-ink)] shadow-[0_10px_36px_color-mix(in_srgb,var(--slurp-warning)_55%,transparent)] ${
                slpLiveBigTip(show, tipBanner.amount ?? 0)
                  ? "bg-[linear-gradient(135deg,var(--slurp-warning),var(--noodle-accent))] text-xl"
                  : "bg-[var(--slurp-warning)] text-sm"
              }`}
            >
              <SlpCoinText>
                {t("ui.slurp.live.tipEvent", { name: tipBanner.name, amount: tipBanner.amount ?? 0 })}
              </SlpCoinText>
            </p>
          ) : null}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 space-y-2.5 px-4 pb-4">
        {caption && (
          <p
            key={`${caption.at}-${caption.text}`}
            className="slp-live-fade line-clamp-3 text-[15px] leading-snug font-medium italic drop-shadow-[0_1px_6px_rgb(0_0_0/0.8)]"
          >
            {caption.text}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Avatar account={{ displayName: creatorName, avatarUrl: avatarUrl ?? null }} size="sm" />
          <h1 className="min-w-0 flex-1 truncate text-base font-bold drop-shadow">{creatorName}</h1>
          {topTip && (
            <span className={`max-w-[45%] truncate rounded-full px-2.5 py-1 text-xs font-semibold ${glass}`}>
              👑 {topTip.name}
            </span>
          )}
        </div>
        <div aria-label={t("ui.slurp.live.goalLabel")}>
          <div className="mb-1 flex justify-between text-xs font-semibold drop-shadow">
            <SlpCoinText>
              {t(goalTarget > show.goal ? "ui.slurp.live.secondGoal" : "ui.slurp.live.goal", {
                raised: show.raised,
                goal: goalTarget,
              })}
            </SlpCoinText>
            <span>{percent}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/20 ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--noodle-accent),var(--slurp-warning))] shadow-[0_0_12px_var(--noodle-accent)] transition-[width] duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
