import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Camera, ChevronLeft, Clock, Eye, Flame, ListOrdered, Lock } from "lucide-react";
import { Avatar, SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SlpCoinText } from "../../modules/coin/SlpCoin";
import { SlpLiveChat } from "../../modules/live/SlpLiveChat";
import { slpLiveFeedDelay, slpLiveFeedMerge, type SlpLiveLine } from "../../modules/live/slp-live-feed";
import type { SlpLiveEvent } from "../../../../../shared/src/slp/slp-live.js";
import { useCreatorAccounts } from "../creators/slp-creators-contract";
import { newRequestId, SlpThreadTaskLayer } from "../messages/slp-messages-contract";
import { useSlpLiveBeat, useSlpLiveEnd, useSlpLivePrivate, useSlpLiveShow, useSlpLiveTip } from "./slp-live-hooks";

const LIVE_STYLES = `
@keyframes slp-live-drift { from { transform: scale(1.08) translate3d(-1.5%, -1%, 0); } to { transform: scale(1.16) translate3d(1.5%, 1%, 0); } }
@keyframes slp-live-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes slp-live-pop { 0% { opacity: 0; transform: scale(0.8); } 15% { opacity: 1; transform: scale(1.05); } 85% { opacity: 1; transform: none; } 100% { opacity: 0; } }
@keyframes slp-live-dot { 50% { opacity: 0.35; } }
.slp-live-drift { animation: slp-live-drift 18s ease-in-out infinite alternate; }
.slp-live-in { animation: slp-live-in 300ms ease-out both; }
.slp-live-in.slp-live-drift { animation: slp-live-in 300ms ease-out both, slp-live-drift 18s ease-in-out infinite alternate; }
.slp-live-pop { animation: slp-live-pop 4s ease-out both; }
.slp-live-dot { animation: slp-live-dot 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .slp-live-drift, .slp-live-in, .slp-live-in.slp-live-drift, .slp-live-pop, .slp-live-dot { animation: none; } }
`;
const QUICK_TIPS = [10, 25, 50, 100];
const glass = "bg-black/40 text-white ring-1 ring-white/10 backdrop-blur-md";

/** The chat as a flowing room: new events from a poll come in one by one (`slp-live-feed.ts`). */
function useLiveFeed(events: readonly SlpLiveEvent[] | undefined) {
  const [feed, setFeed] = useState(() => ({
    shown: [] as SlpLiveLine[],
    queue: [] as SlpLiveLine[],
    seen: new Set<string>(),
  }));
  useEffect(() => {
    if (events) setFeed((current) => slpLiveFeedMerge(current, events));
  }, [events]);
  useEffect(() => {
    if (!feed.queue.length) return;
    const timer = window.setTimeout(
      () =>
        setFeed((current) => ({
          ...current,
          shown: [...current.shown, ...current.queue.slice(0, 1)].slice(-40),
          queue: current.queue.slice(1),
        })),
      slpLiveFeedDelay(feed.queue.length),
    );
    return () => window.clearTimeout(timer);
  }, [feed.queue]);
  return feed.shown;
}

export function SlpLiveScreen({
  showId,
  personaId,
  onBack,
}: {
  showId: string;
  personaId: string | null;
  onBack: () => void;
}) {
  const { t } = useUiTranslation();
  const query = useSlpLiveShow(showId, personaId);
  const tip = useSlpLiveTip(showId, personaId);
  const beat = useSlpLiveBeat(showId, personaId);
  const privateBuy = useSlpLivePrivate(showId, personaId);
  const end = useSlpLiveEnd(showId, personaId);
  const [said, setSaid] = useState("");
  const joined = useRef(false);
  const askedAt = useRef(0);
  const show = query.data;
  const host = useCreatorAccounts().data?.find((account) => account.id === show?.hostId) ?? null;
  const lines = useLiveFeed(show?.log);
  // The newest money line shows as a banner for 4 s. State, not a CSS fade, so reduced motion hides it too.
  const newest = [...lines]
    .reverse()
    .find((event) => event.kind === "tip" || event.kind === "order" || event.kind === "goal");
  const sayFailed = beat.isError && !!beat.variables?.message;
  // The box clears on send so later typing is safe; a failed send puts the text back unless the player typed on.
  useEffect(() => {
    const sent = beat.variables?.message;
    if (beat.isError && sent) setSaid((current) => current || sent);
  }, [beat.isError, beat.variables]);
  const [bannerKey, setBannerKey] = useState<string | null>(null);
  useEffect(() => {
    if (!newest) return;
    setBannerKey(newest.key);
    const timer = window.setTimeout(() => setBannerKey(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [newest?.key]);
  const banner = newest && newest.key === bannerKey ? newest : undefined;
  const [sheet, setSheet] = useState<null | "tip" | "menu" | "private">(null);
  const [custom, setCustom] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  // Ask for the next beat when the one playing runs low; the first ask is the join (recap and welcome).
  useEffect(() => {
    if (!show || show.endedAt || beat.isPending || document.visibilityState !== "visible") return;
    const sinceAsk = Date.now() - askedAt.current;
    if (sinceAsk < (beat.isError ? 20_000 : 6_000)) return;
    const playing = show.elapsed + Math.max(0, Date.now() - query.dataUpdatedAt);
    // The welcome waits for the persona, so it greets the player by name once it has loaded.
    const welcome = !joined.current && !!personaId && !show.hosting;
    if (!welcome && playing < show.beatTo - 10_000) return;
    askedAt.current = Date.now();
    beat.mutate(welcome ? { joined: true } : {});
    if (welcome) joined.current = true;
  }, [now, show, beat, personaId]);
  const name = host?.displayName ?? t("ui.slurp.live.creator");
  const me = personaId ? `persona:${personaId}` : null;
  const itemLabel = (id: string | undefined) =>
    show?.menu.find((item) => item.id === id)?.label ?? (id ? t(`ui.slurp.live.menu.${id}`) : "");

  const back = (
    <button
      type="button"
      onClick={onBack}
      aria-label={t("ui.slurp.live.back")}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${glass}`}
    >
      <ChevronLeft size={20} aria-hidden="true" />
    </button>
  );

  if (query.isError && !show)
    return (
      <SlpThreadTaskLayer>
        <div className="relative flex min-h-[70dvh] flex-1 flex-col items-center justify-center p-6">
          <div className="absolute start-3 top-3">{back}</div>
          <SlpErrorState title={t("ui.slurp.live.loadFailed")} onRetry={() => void query.refetch()} />
        </div>
      </SlpThreadTaskLayer>
    );
  if (!show)
    return (
      <SlpThreadTaskLayer>
        <div className="relative min-h-[70dvh] flex-1 p-6 pt-16">
          <div className="absolute start-3 top-3">{back}</div>
          <SlpSkeleton label={t("ui.slurp.live.loading")} />
        </div>
      </SlpThreadTaskLayer>
    );

  const elapsed = show.elapsed + Math.max(0, now - query.dataUpdatedAt);
  // What the webcam shows now, in words: the stage for a show without pictures, a caption with them.
  const cam = show.log.filter((event) => event.kind === "cam").at(-1)?.text ?? null;
  const left = Math.max(0, Date.parse(show.endsAt) - Date.parse(show.startedAt) - elapsed);
  const ended = !!show.endedAt || left === 0;
  const goal = show.goals.find((entry) => entry.hitAt === null) ?? null;
  const goalStart = goal
    ? Math.max(0, ...show.goals.filter((entry) => entry.target < goal.target).map((entry) => entry.target))
    : 0;
  const percent = goal
    ? Math.min(100, Math.round(((show.raised - goalStart) / Math.max(1, goal.target - goalStart)) * 100))
    : 100;
  const open = show.queue.filter((order) => order.doneAt === null);
  // The newest money line the chat has shown, so a fan tip pops when it reaches the screen; the pop fades itself out.
  const pay = (amount: number, itemId?: string) => {
    if (!personaId) return;
    setSheet(null);
    tip.mutate({ amount, ...(itemId ? { itemId } : {}), requestId: newRequestId() });
  };
  const goPrivate = () => {
    if (!personaId) return;
    setSheet(null);
    privateBuy.mutate({ requestId: newRequestId() });
  };
  // Somebody else's private block, or a show another persona hosts: no talk or tips from here.
  const outside = (!!show.private && !show.private.mine) || (show.hostKind === "player" && !show.hosting);
  const privateLeft = show.private ? Math.max(0, show.private.to - elapsed) : 0;
  const mmss = (ms: number) =>
    `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1_000)).padStart(2, "0")}`;

  return (
    <SlpThreadTaskLayer>
      {/* Portrait on every screen, like the Story viewer: pictures are drawn at the Story size. */}
      <div className="flex flex-1 justify-center bg-black">
        <section className="relative isolate flex min-h-[70dvh] w-full flex-1 flex-col overflow-hidden text-white sm:max-w-md">
          <style>{LIVE_STYLES}</style>

          {/* The bar: who is live, then the live stats, then the goal. */}
          <header className="space-y-1.5 bg-black px-2 pb-2 pt-2 sm:px-3">
            <div className="flex items-center gap-2">
              {back}
              <Avatar account={{ displayName: name, avatarUrl: host?.avatarUrl ?? null }} size="xs" />
              <h1 className="min-w-0 truncate text-sm font-bold">{name}</h1>
              <span
                role="status"
                aria-label={t("ui.slurp.live.liveNow")}
                className="flex shrink-0 items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black tracking-wide"
              >
                <span className="slp-live-dot h-1.5 w-1.5 rounded-full bg-white" />
                {t("ui.slurp.live.badge")}
              </span>
            </div>
            <div className="flex items-center gap-4 px-1 text-xs font-semibold text-white/90">
              <span className="flex items-center gap-1">
                <Eye size={13} aria-hidden="true" />
                {show.viewers}
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <Clock size={13} aria-hidden="true" />
                {t("ui.slurp.live.left", { time: mmss(left) })}
              </span>
              <span className="flex items-center gap-1.5" aria-label={t("ui.slurp.live.heat", { heat: show.heat })}>
                <Flame size={13} aria-hidden="true" className="text-orange-300" />
                <span className="h-1 w-12 overflow-hidden rounded-full bg-white/20">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-amber-300 to-[var(--noodle-accent)]"
                    style={{ width: `${show.heat}%` }}
                  />
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setGoalOpen((value) => !value)}
              aria-expanded={goalOpen}
              className="block w-full px-1 text-start"
            >
              <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-white/85">
                <span className="truncate">
                  {goal ? t("ui.slurp.live.goal", { item: itemLabel(goal.reward) }) : t("ui.slurp.live.allGoals")}
                </span>
                {goal && (
                  <span className="shrink-0">
                    <SlpCoinText>
                      {t("ui.slurp.live.goalProgress", { raised: show.raised, goal: goal.target })}
                    </SlpCoinText>
                  </span>
                )}
              </span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/20">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-[var(--noodle-accent)] to-[var(--slurp-warning)] transition-[width] duration-700"
                  style={{ width: `${percent}%` }}
                />
              </span>
              {goalOpen && goal && (
                <span className="mt-1 block text-[11px] text-white/75">
                  {t("ui.slurp.live.goalHint", { name, item: itemLabel(goal.reward) })}
                </span>
              )}
            </button>
          </header>
          {/* Below the bar: the picture never runs under it. */}
          <div className="relative isolate flex min-h-0 flex-1 flex-col">
            {/* The stage: the newest live picture of the Creator; a drifting glow until the cam's first picture lands. */}
            <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
              <div className="slp-live-drift h-full w-full bg-[radial-gradient(circle_at_40%_30%,var(--noodle-accent),transparent_60%),radial-gradient(circle_at_70%_80%,var(--slurp-violet),transparent_55%)]" />
              {show.picture &&
                // The last picture stays under the new one until it has loaded and faded in.
                [show.picture.n - 1, show.picture.n]
                  .filter((n) => n >= 0)
                  .map((n) => (
                    <SlurpMediaImg
                      key={n}
                      src={`/api/slurp2/slurp/live/${encodeURIComponent(show.id)}/picture/${n}`}
                      mediaWidth={720}
                      alt=""
                      className="slp-crop slp-live-in slp-live-drift absolute inset-0 h-full w-full object-cover"
                    />
                  ))}
              <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            </div>
            {/* The next picture is on its way: said in the window, where it will land. */}
            {show.shooting && !ended && (
              <p
                role="status"
                className={`mx-3 mt-3 flex w-fit items-center gap-1.5 self-end rounded-full px-2.5 py-1 text-xs font-semibold ${glass}`}
              >
                <Camera size={13} aria-hidden="true" className="slp-live-dot text-[var(--noodle-accent)]" />
                {t("ui.slurp.live.shooting")}
              </p>
            )}
            {!ended && cam ? (
              <p
                key={cam}
                aria-live="polite"
                className={`slp-live-in mx-3 mt-3 rounded-2xl px-3 py-2 text-sm italic leading-snug ${glass}`}
              >
                {cam}
              </p>
            ) : (
              !show.picture &&
              !ended && (
                <p
                  role="status"
                  className="slp-live-dot absolute inset-x-0 top-1/3 text-center text-sm font-semibold text-white/80"
                >
                  {t("ui.slurp.live.starting")}
                </p>
              )
            )}

            {banner && (
              <div className="pointer-events-none flex justify-center px-4 pt-4" aria-live="polite">
                <p
                  key={banner.key}
                  className={`slp-live-pop rounded-2xl px-4 py-2.5 text-center font-extrabold shadow-xl ${banner.kind === "goal" ? "bg-gradient-to-br from-[var(--noodle-accent)] to-[var(--slurp-violet)] text-lg" : "bg-[var(--slurp-warning)] text-sm text-neutral-950"}`}
                >
                  {banner.kind === "goal" ? (
                    t("ui.slurp.live.goalHit", { item: itemLabel(banner.itemId) })
                  ) : (
                    <SlpCoinText>
                      {t("ui.slurp.live.tipBanner", { name: banner.name ?? "", amount: banner.amount ?? 0 })}
                    </SlpCoinText>
                  )}
                </p>
              </div>
            )}

            <div className="min-h-0 flex-1" />

            <div className="slp-nav-live mb-[var(--slp-nav-live,0px)] space-y-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <SlpLiveChat lines={lines} me={me} host={name} itemLabel={itemLabel} t={t} />
              {open.length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                  <span className="rounded-full bg-emerald-500/25 px-3 py-1 ring-1 ring-emerald-300/40">
                    {t("ui.slurp.live.now", {
                      item: itemLabel(open[0]!.itemId),
                      name: open[0]!.name || t("ui.slurp.live.everyone"),
                    })}
                  </span>
                  {open[1] && (
                    <span className={`rounded-full px-3 py-1 ${glass}`}>
                      {t("ui.slurp.live.next", {
                        item: itemLabel(open[1].itemId),
                        name: open[1].name || t("ui.slurp.live.everyone"),
                      })}
                    </span>
                  )}
                </div>
              )}
              {show.private && !ended && (
                <div
                  role="status"
                  className={`flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${glass}`}
                >
                  <Lock size={14} aria-hidden="true" className="text-[var(--noodle-accent)]" />
                  {show.private.mine
                    ? t("ui.slurp.live.privateMine", { time: mmss(privateLeft) })
                    : t("ui.slurp.live.privateOther", { name })}
                  {show.private.mine && privateLeft < 60_000 && (
                    <button
                      type="button"
                      onClick={() => setSheet("private")}
                      className="rounded-full bg-[var(--noodle-accent)] px-3 py-1 text-xs font-bold text-white"
                    >
                      {t("ui.slurp.live.privateStay")}
                    </button>
                  )}
                </div>
              )}
              {show.hosting && !ended && show.next.length > 0 && (
                <div role="group" aria-label={t("ui.slurp.live.hostIdeas")} className="flex gap-2 overflow-x-auto pb-1">
                  {show.next.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setSaid(idea.slice(0, 300))}
                      className={`w-56 shrink-0 rounded-2xl px-3 py-1.5 text-start text-xs font-semibold ${glass}`}
                    >
                      <span className="line-clamp-2">{idea.replaceAll("*", "")}</span>
                    </button>
                  ))}
                </div>
              )}
              {ended ? (
                <div className={`rounded-2xl p-4 text-center ${glass}`}>
                  <p className="font-bold">{t("ui.slurp.live.ended", { name })}</p>
                  <p className="mt-1 text-sm text-white/80">
                    <SlpCoinText>{t("ui.slurp.live.endedRaised", { amount: show.raised })}</SlpCoinText>
                    {show.top ? ` · ${t("ui.slurp.live.topTipper", { name: show.top.name })}` : ""}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {personaId ? (
                    <form
                      className="min-w-0 flex-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const message = said.trim();
                        if (!message) return;
                        setSaid("");
                        askedAt.current = Date.now();
                        beat.mutate({ message });
                      }}
                    >
                      <input
                        value={said}
                        disabled={outside}
                        onChange={(event) => setSaid(event.target.value.slice(0, 300))}
                        enterKeyHint="send"
                        placeholder={show.hosting ? t("ui.slurp.live.hostSay") : t("ui.slurp.live.say", { name })}
                        aria-label={show.hosting ? t("ui.slurp.live.hostSay") : t("ui.slurp.live.say", { name })}
                        className={`h-12 w-full rounded-full px-4 text-base placeholder:text-white/60 ${glass}`}
                      />
                    </form>
                  ) : (
                    <p className="min-w-0 flex-1 truncate text-sm text-white/70">{t("ui.slurp.live.pickPersona")}</p>
                  )}
                  {show.hosting ? (
                    <button
                      type="button"
                      disabled={end.isPending}
                      onClick={() => end.mutate()}
                      className={`h-12 rounded-full px-5 text-sm font-bold disabled:opacity-40 ${glass}`}
                    >
                      {t("ui.slurp.live.endShow")}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={!personaId || outside || privateBuy.isPending}
                        onClick={() => setSheet("private")}
                        aria-label={t("ui.slurp.live.privateButton")}
                        className={`flex h-12 w-12 items-center justify-center rounded-full disabled:opacity-40 ${glass}`}
                      >
                        <Lock size={20} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={!personaId || outside}
                        onClick={() => setSheet("menu")}
                        aria-label={t("ui.slurp.live.menuTitle")}
                        className={`flex h-12 w-12 items-center justify-center rounded-full disabled:opacity-40 ${glass}`}
                      >
                        <ListOrdered size={20} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={!personaId || outside || tip.isPending}
                        onClick={() => setSheet("tip")}
                        className="h-12 rounded-full bg-[var(--noodle-accent)] px-5 text-sm font-black text-white shadow-[0_0_24px_color-mix(in_srgb,var(--noodle-accent)_60%,transparent)] disabled:opacity-40"
                      >
                        {t("ui.slurp.live.tip")}
                      </button>
                    </>
                  )}
                </div>
              )}
              {!ended && show.mine > 0 && (
                <p className="text-sm text-white/70">
                  <SlpCoinText>{t("ui.slurp.live.mine", { amount: show.mine })}</SlpCoinText>
                </p>
              )}
              {privateBuy.isError && (
                <p role="alert" className="text-center text-sm text-red-300">
                  {t("ui.slurp.live.privateFailed")}
                </p>
              )}
              {sayFailed && (
                <p role="alert" className="text-center text-sm text-red-300">
                  {t("ui.slurp.live.sayFailed")}
                </p>
              )}
              {tip.isError && (
                <p role="alert" className="text-center text-sm text-red-300">
                  {t("ui.slurp.live.tipFailed")}
                </p>
              )}
            </div>

            <SlpSheet
              open={sheet === "tip"}
              onClose={() => setSheet(null)}
              title={t("ui.slurp.live.tipTitle", { name })}
            >
              <div className="grid grid-cols-4 gap-2">
                {QUICK_TIPS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => pay(amount)}
                    className="h-12 rounded-xl bg-[var(--card)] font-bold ring-1 ring-[var(--border)]"
                  >
                    <SlpCoinText>{t("ui.slurp.live.amount", { amount })}</SlpCoinText>
                  </button>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const amount = Number(custom);
                  if (Number.isInteger(amount) && amount > 0) pay(amount);
                }}
              >
                <input
                  inputMode="numeric"
                  value={custom}
                  onChange={(event) => setCustom(event.target.value.replace(/\D/g, ""))}
                  placeholder={t("ui.slurp.live.customTip")}
                  aria-label={t("ui.slurp.live.customTip")}
                  className="h-12 min-w-0 flex-1 rounded-xl bg-[var(--card)] px-3 text-base ring-1 ring-[var(--border)]"
                />
                <button
                  type="submit"
                  disabled={!custom}
                  className="h-12 rounded-xl bg-[var(--noodle-accent)] px-5 font-bold text-white disabled:opacity-40"
                >
                  {t("ui.slurp.live.send")}
                </button>
              </form>
            </SlpSheet>

            <SlpSheet open={sheet === "menu"} onClose={() => setSheet(null)} title={t("ui.slurp.live.menuTitle")}>
              <ul className="space-y-2 p-0.5">
                {show.menu
                  .filter((item) => !item.strip || show.strip < show.stripMax)
                  .map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => pay(item.price, item.id)}
                        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-[var(--card)] px-4 py-2 text-start ring-1 ring-[var(--border)]"
                      >
                        <span>
                          <b className="block">{itemLabel(item.id)}</b>
                        </span>
                        <span className="shrink-0 font-bold">
                          <SlpCoinText>{t("ui.slurp.live.amount", { amount: item.price })}</SlpCoinText>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </SlpSheet>
            <SlpSheet
              open={sheet === "private"}
              onClose={() => setSheet(null)}
              title={t("ui.slurp.live.privateTitle", { name })}
            >
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("ui.slurp.live.privateBody", { name, minutes: show.offer?.minutes ?? 10 })}
              </p>
              <button
                type="button"
                onClick={goPrivate}
                disabled={!show.offer}
                className="mt-3 h-12 w-full rounded-xl bg-[var(--noodle-accent)] text-base font-bold text-white disabled:opacity-40"
              >
                <SlpCoinText>
                  {t(show.private?.mine ? "ui.slurp.live.privateExtend" : "ui.slurp.live.privateGo", {
                    amount: show.offer?.price ?? 0,
                    minutes: show.offer?.minutes ?? 10,
                  })}
                </SlpCoinText>
              </button>
            </SlpSheet>
          </div>
        </section>
      </div>
    </SlpThreadTaskLayer>
  );
}
