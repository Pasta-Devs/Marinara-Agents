import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../../base/chrome/SlpChrome";
import { useSlpLiveActions, useSlpLiveShow } from "./slp-live-hooks";
import type { SlpLiveMenuItem, SlpLiveShow } from "./slp-live-contract";
import { SlpLiveChat } from "./SlpLiveChat";
import { SlpLiveMenuSheet } from "./SlpLiveMenuSheet";

export function SlpLiveScreen({
  showId,
  personaId,
  creatorName,
  avatarUrl,
  onBack,
  onOpenRecap,
}: {
  showId: string;
  personaId: string | null;
  creatorName: string;
  avatarUrl?: string | null;
  onBack: () => void;
  onOpenRecap: (postId: string) => void;
}) {
  const { t } = useTranslation();
  const query = useSlpLiveShow(showId, personaId);
  if (query.isLoading)
    return <div className="p-5 text-sm text-[var(--muted-foreground)]">{t("ui.slurp.live.loading")}</div>;
  if (!query.data || query.isError)
    return (
      <div className="p-5">
        <button className="min-h-11" onClick={onBack}>
          {t("ui.slurp.live.back")}
        </button>
        <p>{t("ui.slurp.live.unavailable")}</p>
      </div>
    );
  return (
    <SlpLiveContent
      show={query.data}
      personaId={personaId}
      creatorName={creatorName}
      avatarUrl={avatarUrl}
      onBack={onBack}
      onOpenRecap={onOpenRecap}
    />
  );
}

function SlpLiveContent({
  show,
  personaId,
  creatorName,
  avatarUrl,
  onBack,
  onOpenRecap,
}: {
  show: SlpLiveShow;
  personaId: string | null;
  creatorName: string;
  avatarUrl?: string | null;
  onBack: () => void;
  onOpenRecap: (postId: string) => void;
}) {
  const { t } = useTranslation();
  const { tip, chat, menu, narrate, end } = useSlpLiveActions(show.id);
  const [message, setMessage] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (show.endedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [show.endedAt]);
  const elapsed = now - Date.parse(show.startedAt);
  const left = Math.max(0, Math.ceil((Date.parse(show.endsAt) - now) / 60_000));
  const topTip = show.events
    .filter((event) => event.kind === "tip")
    .reduce<SlpLiveShow["events"][number] | null>(
      (best, event) => (!best || (event.amount ?? 0) > (best.amount ?? 0) ? event : best),
      null,
    );
  const tipPrices = useMemo(
    () =>
      [...new Set(show.menu.map((item) => item.price).filter((price) => Number.isInteger(price) && price > 0))]
        .sort((a, b) => a - b)
        .slice(0, 3),
    [show.menu],
  );
  const prices = tipPrices.length ? tipPrices : [Math.max(1, Math.round(show.goal * 0.05))];
  const sendChat = (event: FormEvent) => {
    event.preventDefault();
    if (!personaId || !message.trim() || chat.isPending) return;
    chat.mutate({ personaId, text: message.trim() }, { onSuccess: () => setMessage("") });
  };
  const sendNarration = (event: FormEvent) => {
    event.preventDefault();
    if (!personaId || !narration.trim() || narrate.isPending) return;
    narrate.mutate({ personaId, text: narration.trim() }, { onSuccess: () => setNarration("") });
  };
  const tipLive = (amount: number) => personaId && tip.mutate({ personaId, amount, requestId: crypto.randomUUID() });
  const buy = (item: SlpLiveMenuItem) =>
    personaId &&
    menu.mutate(
      { personaId, itemId: item.id, requestId: crypto.randomUUID() },
      { onSuccess: () => setMenuOpen(false) },
    );
  const host = show.hostKind === "player";
  if (show.endedAt)
    return (
      <main className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">{t("ui.slurp.live.ended")}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("ui.slurp.live.raised", { name: creatorName, amount: show.raised })}
        </p>
        {show.recapPostId && (
          <button
            className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-4 text-[var(--noodle-accent-foreground)]"
            onClick={() => onOpenRecap(show.recapPostId!)}
          >
            {t("ui.slurp.live.recap")}
          </button>
        )}
        <button className="min-h-11 px-4" onClick={onBack}>
          {t("ui.slurp.live.back")}
        </button>
      </main>
    );
  return (
    <main className="mx-auto flex h-full max-w-lg flex-col">
      <header className="flex min-h-16 items-center gap-3 border-b border-[var(--border)] px-3">
        <button onClick={onBack} className="min-h-11 min-w-11" aria-label={t("ui.slurp.live.back")}>
          ‹
        </button>
        <Avatar account={{ displayName: creatorName, avatarUrl: avatarUrl ?? null }} size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold">{creatorName}</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("ui.slurp.live.left", { count: left })} · {t("ui.slurp.live.viewers", { count: show.viewers ?? 0 })}
          </p>
        </div>
        <span
          role="status"
          aria-label={t("ui.slurp.live.liveNow")}
          className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white"
        >
          {t("ui.slurp.live.badge")}
        </span>
      </header>
      <section className="border-b border-[var(--border)] px-4 py-3" aria-label={t("ui.slurp.live.goalLabel")}>
        <div className="mb-2 flex justify-between text-xs">
          <span>{t("ui.slurp.live.goal", { raised: show.raised, goal: show.goal })}</span>
          <span>{Math.min(100, Math.round((show.raised / Math.max(1, show.goal)) * 100))}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className="h-full bg-[var(--noodle-accent)]"
            style={{ width: `${Math.min(100, (show.raised / Math.max(1, show.goal)) * 100)}%` }}
          />
        </div>
      </section>
      {show.queue.some((order) => !order.served) && (
        <div className="flex gap-2 overflow-x-auto border-b border-[var(--border)] px-3 py-2">
          <b className="shrink-0 text-xs">{t("ui.slurp.live.nextUp")}</b>
          {show.queue
            .filter((order) => !order.served)
            .map((order) => (
              <span key={order.requestId} className="shrink-0 rounded-full bg-[var(--muted)] px-2 py-1 text-xs">
                {order.label}
              </span>
            ))}
        </div>
      )}
      <SlpLiveChat show={show} creatorName={creatorName} elapsed={elapsed} t={t} />
      {!personaId && (
        <p className="border-t border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
          {t("ui.noodle.noodleshell.pickAPersona")}
        </p>
      )}
      {personaId && (
        <footer className="space-y-2 border-t border-[var(--border)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {host ? (
            <>
              <form onSubmit={sendNarration} className="flex gap-2">
                <input
                  aria-label={t("ui.slurp.live.narrationLabel")}
                  value={narration}
                  onChange={(event) => setNarration(event.target.value)}
                  maxLength={500}
                  disabled={!personaId || narrate.isPending}
                  placeholder={t("ui.slurp.live.narrationPlaceholder")}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                />
                <button
                  disabled={!personaId || !narration.trim() || narrate.isPending}
                  className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold"
                >
                  {t("ui.slurp.live.send")}
                </button>
              </form>
              <button
                type="button"
                disabled={!personaId || end.isPending}
                onClick={() => personaId && end.mutate({ personaId })}
                className="min-h-11 w-full rounded-lg bg-red-600 px-3 text-sm font-bold text-white"
              >
                {t("ui.slurp.live.endShow")}
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                {prices.map((amount) => (
                  <button
                    key={amount}
                    disabled={!personaId || tip.isPending}
                    onClick={() => tipLive(amount)}
                    className="min-h-11 flex-1 rounded-lg border border-[var(--border)] text-sm font-semibold disabled:opacity-50"
                  >
                    {t("ui.slurp.live.tip", { amount })}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="live-custom-tip">
                  {t("ui.slurp.live.customTip")}
                </label>
                <input
                  id="live-custom-tip"
                  type="number"
                  min="1"
                  step="1"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  placeholder={t("ui.slurp.live.customTip")}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                />
                <button
                  type="button"
                  disabled={
                    !personaId || tip.isPending || !Number.isInteger(Number(customAmount)) || Number(customAmount) < 1
                  }
                  onClick={() => tipLive(Number(customAmount))}
                  className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold"
                >
                  {t("ui.slurp.live.tipCustom")}
                </button>
              </div>
              <button
                disabled={!personaId || tip.isPending}
                onClick={() => tipLive(topTip?.amount ?? prices[0]!)}
                className="min-h-11 w-full rounded-lg bg-[var(--noodle-accent)] px-3 text-sm font-bold text-[var(--noodle-accent-foreground)]"
              >
                {topTip
                  ? t("ui.slurp.live.matchTop", { amount: topTip.amount ?? prices[0] })
                  : t("ui.slurp.live.firstTipper", { amount: prices[0] })}
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="min-h-11 w-full rounded-lg border border-[var(--border)] text-sm font-semibold"
              >
                {t("ui.slurp.live.openMenu")}
              </button>
              <form onSubmit={sendChat} className="flex gap-2">
                <input
                  aria-label={t("ui.slurp.live.chatLabel")}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={1000}
                  disabled={!personaId || chat.isPending}
                  placeholder={t("ui.slurp.live.chatPlaceholder")}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                />
                <button
                  disabled={!personaId || !message.trim() || chat.isPending}
                  className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold"
                >
                  {t("ui.slurp.live.send")}
                </button>
              </form>
            </>
          )}
        </footer>
      )}
      {menuOpen && (
        <SlpLiveMenuSheet
          items={show.menu}
          pending={menu.isPending}
          onBuy={buy}
          onClose={() => setMenuOpen(false)}
          t={t}
        />
      )}
    </main>
  );
}
