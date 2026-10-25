import type { ReactNode } from "react";
import { SlpCoinText } from "../../modules/coin/SlpCoin";
import { Avatar } from "../../base/chrome/SlpChrome";
import { SLP_LIVE_STYLES } from "../../modules/live/slp-live-styles";
import { SlpLiveSpokenText } from "../../modules/live/SlpLiveSpokenText";
import type { SlpLiveOrder, SlpLiveShow } from "./slp-live-contract";

export function slpLivePictureUrl(show: SlpLiveShow, mediaId: string, personaId: string) {
  return `/api/slurp2/live/${encodeURIComponent(show.id)}/picture/${encodeURIComponent(mediaId)}?personaId=${encodeURIComponent(personaId)}`;
}

/** A tip counts as big when it alone is a quarter of the goal (the whale tip). */
export function slpLiveBigTip(show: SlpLiveShow, amount: number) {
  return amount >= Math.max(1, show.goal) * 0.25;
}

/** Same length as the server's SLURP_LIVE_SEGMENT_MS: one act per 4 minutes. */
const SEGMENT_MS = 4 * 60_000;

/** The order on stage this segment ("Now") and the next one waiting ("Next"), from what the chat already shows. */
export function slpLiveStageOrders(show: SlpLiveShow, elapsed: number) {
  const segment = Math.floor(elapsed / SEGMENT_MS);
  const visible = show.queue.filter((order) => order.at <= elapsed);
  return {
    now: visible.find((order) => order.served && order.servedIn === segment),
    next: visible.find((order) => !order.served || (order.servedIn ?? -1) > segment),
  };
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
  children,
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
  /** Phone only: the chat overlay and the dock, laid over the bottom of the show. */
  children?: ReactNode;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const seen = show.script.filter((line) => line.at <= elapsed);
  const shots = personaId ? seen.filter((line) => line.kind === "picture" && line.mediaId).slice(-2) : [];
  const onCamera = shots.length > 0 && !!personaId;
  const act = seen.findLast((line) => line.kind === "act")?.text;
  // Her live replies count as her current line when they are newer than the script.
  const spoken = [
    ...seen.filter((line) => line.kind === "narration"),
    ...show.events.filter((event) => event.host && !event.join && event.at <= elapsed),
  ]
    .sort((a, b) => a.at - b.at)
    .slice(-2);
  const tip = show.events.findLast((event) => event.kind === "tip" && event.at <= elapsed);
  const goalAt = show.goalHitAt ? Date.parse(show.goalHitAt) - Date.parse(show.startedAt) : null;
  const goalBanner = goalAt !== null && elapsed >= goalAt && elapsed - goalAt < 6_000;
  const tipBanner = !goalBanner && tip && elapsed - tip.at < 4_500 ? tip : null;
  const percent = Math.min(100, Math.round((show.raised / Math.max(1, goalTarget)) * 100));
  const reward = goalTarget > show.goal ? show.room?.secondGoal : show.room?.goal;
  const shown = show.room?.shown.slice(-4) ?? [];
  const { now, next } = slpLiveStageOrders(show, elapsed);
  const orderLine = (key: string, order: SlpLiveOrder) => t(key, { item: order.label, name: order.name });
  return (
    <section className="relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--slurp-canvas)] text-white lg:min-h-0 lg:flex-1 lg:rounded-3xl">
      <style>{SLP_LIVE_STYLES}</style>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--noodle-accent)_55%,transparent),transparent_60%),radial-gradient(circle_at_80%_90%,color-mix(in_srgb,var(--slurp-violet)_50%,transparent),transparent_55%)]"
      />
      {onCamera &&
        // Keyed by picture: the old shot stays underneath while the new one fades in over it.
        shots.map((shot, index) => (
          <img
            key={shot.mediaId}
            src={slpLivePictureUrl(show, shot.mediaId!, personaId)}
            alt={index === shots.length - 1 ? t("ui.slurp.live.pictureAlt", { name: creatorName }) : ""}
            className="slp-crop slp-live-shot absolute inset-0 -z-10 h-full w-full object-cover"
          />
        ))}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-black/70 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[55%] bg-gradient-to-t from-black/85 via-black/45 to-transparent"
      />
      <header className="flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
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
      <div className="space-y-2 px-3 pt-2">
        <div className="flex items-center gap-2">
          <Avatar account={{ displayName: creatorName, avatarUrl: avatarUrl ?? null }} size="sm" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold drop-shadow">{creatorName}</h1>
            {act && (
              <p key={act} className="slp-live-fade truncate text-xs font-semibold text-white/80 drop-shadow">
                {act}
              </p>
            )}
          </div>
          {topTip && (
            <span className={`max-w-[45%] truncate rounded-full px-2.5 py-1 text-xs font-semibold ${glass}`}>
              👑 {topTip.name}
            </span>
          )}
        </div>
        <div aria-label={t("ui.slurp.live.goalLabel")} className={`rounded-2xl px-3 py-2 ${glass}`}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold">
            <span className="min-w-0 truncate">
              <SlpCoinText>
                {t(goalTarget > show.goal ? "ui.slurp.live.secondGoal" : "ui.slurp.live.goal", {
                  raised: show.raised,
                  goal: goalTarget,
                })}
              </SlpCoinText>
              {reward && <span className="text-white/80"> · {reward}</span>}
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--noodle-accent),var(--slurp-warning))] shadow-[0_0_12px_var(--noodle-accent)] transition-[width] duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        {shown.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-hidden" aria-label={t("ui.slurp.live.shownSoFar")}>
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide drop-shadow-[0_1px_3px_rgb(0_0_0/0.9)]">
              {t("ui.slurp.live.shownSoFar")}
            </span>
            {shown.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className={`max-w-[9rem] shrink-0 truncate rounded-full px-2 py-0.5 text-[11px] ${glass}`}
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
      {(tipBanner || goalBanner) && (
        <div className="pointer-events-none flex justify-center px-4 pt-3" aria-live="polite">
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
              className={`slp-live-pop rounded-2xl px-4 py-2.5 text-center font-extrabold text-neutral-950 shadow-[0_10px_36px_color-mix(in_srgb,var(--slurp-warning)_55%,transparent)] ${
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
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        {!onCamera && (
          <div className="aspect-square h-full max-h-32 rounded-full p-1 ring-4 ring-[color-mix(in_srgb,var(--noodle-accent)_70%,transparent)] shadow-[0_0_60px_color-mix(in_srgb,var(--noodle-accent)_55%,transparent)]">
            <Avatar
              account={{ displayName: creatorName, avatarUrl: avatarUrl ?? null }}
              size="xl"
              className="h-full w-full"
            />
          </div>
        )}
      </div>
      <div className="shrink-0 space-y-2 px-3 pb-3">
        {(now || next) && (
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {now && (
              <span className="slp-live-fade rounded-full bg-[var(--slurp-violet)] px-3 py-1 text-white shadow-md">
                {orderLine("ui.slurp.live.orderNow", now)}
              </span>
            )}
            {next && (
              <span className={`rounded-full px-3 py-1 ${glass}`}>{orderLine("ui.slurp.live.orderNext", next)}</span>
            )}
          </div>
        )}
        {spoken.length > 0 && (
          <div aria-live="polite" className="space-y-1 rounded-2xl bg-black/45 px-4 py-3 backdrop-blur-sm">
            {spoken.map((line, index) => (
              <p
                key={`${line.at}-${line.text}`}
                className={
                  index === spoken.length - 1
                    ? "slp-live-fade text-[17px] leading-snug drop-shadow-[0_1px_6px_rgb(0_0_0/0.8)] lg:text-xl"
                    : "line-clamp-1 text-sm leading-snug text-white/60 lg:line-clamp-2"
                }
              >
                <SlpLiveSpokenText
                  text={line.text}
                  speechClassName={index === spoken.length - 1 ? "text-lg lg:text-2xl" : ""}
                />
              </p>
            ))}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
