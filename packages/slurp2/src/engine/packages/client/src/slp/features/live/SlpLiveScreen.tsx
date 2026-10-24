import { useEffect, useMemo, useState, type FormEvent } from "react";
import { newRequestId } from "../../base/state/slp-request-id";
import { useTranslation } from "react-i18next";
import { SlpCoinText } from "../../modules/coin/SlpCoin";
import { Avatar } from "../../base/chrome/SlpChrome";
import { useSlpLiveActions, useSlpLiveShow } from "./slp-live-hooks";
import type { SlpLiveMenuItem, SlpLiveShow } from "./slp-live-contract";
import { SlpLiveChat } from "./SlpLiveChat";
import { SlpLiveMenuSheet } from "./SlpLiveMenuSheet";
import { SlpLiveStage } from "./SlpLiveStage";

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
  const { tip, chat, menu, done, privateShow, mode, narrate, end } = useSlpLiveActions(show.id);
  const [message, setMessage] = useState("");
  const [privateRequestId, setPrivateRequestId] = useState<string | null>(null);
  const [tipRequestIds, setTipRequestIds] = useState<Record<number, string>>({});
  const [menuRequestIds, setMenuRequestIds] = useState<Record<string, string>>({});
  const [customAmount, setCustomAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
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
  // Goal Striptease: after the first goal the bar runs on to a second goal at twice the first.
  const goalTarget = show.raised >= show.goal ? show.goal * 2 : show.goal;
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
  const tipLive = (amount: number) => {
    if (!personaId) return;
    const requestId = tipRequestIds[amount] ?? newRequestId();
    setTipRequestIds((current) => ({ ...current, [amount]: requestId }));
    tip.mutate(
      { personaId, amount, requestId },
      {
        // Keep the id after an error, so a retry after a lost response cannot charge twice.
        onSuccess: () =>
          setTipRequestIds((current) => {
            const next = { ...current };
            delete next[amount];
            return next;
          }),
      },
    );
  };
  const buy = (item: SlpLiveMenuItem) => {
    if (!personaId) return;
    const requestId = menuRequestIds[item.id] ?? newRequestId();
    setMenuRequestIds((current) => ({ ...current, [item.id]: requestId }));
    menu.mutate(
      { personaId, itemId: item.id, requestId },
      {
        onSuccess: () => {
          setMenuOpen(false);
          setMenuRequestIds((current) => {
            const next = { ...current };
            delete next[item.id];
            return next;
          });
        },
      },
    );
  };
  const host = show.hostKind === "player";
  const privateActive = !!show.private && Date.parse(show.private.until) > now;
  const privateViewer = privateActive && !!personaId && show.private?.personaId === personaId;
  if (show.endedAt)
    return (
      <main className="relative isolate mx-auto flex h-full w-full max-w-lg flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_srgb,var(--noodle-accent)_28%,transparent),transparent_65%)]"
        />
        <Avatar account={{ displayName: creatorName, avatarUrl: avatarUrl ?? null }} size="xl" />
        <h1 className="slp-display text-2xl">{t("ui.slurp.live.ended")}</h1>
        <p className="rounded-full bg-[var(--card)] px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)]">
          <SlpCoinText>{t("ui.slurp.live.raised", { name: creatorName, amount: show.raised })}</SlpCoinText>
        </p>
        {show.recapPostId && (
          <button
            className="min-h-11 rounded-full bg-[var(--noodle-accent)] px-6 font-semibold text-[var(--noodle-accent-foreground)]"
            onClick={() => onOpenRecap(show.recapPostId!)}
          >
            {t("ui.slurp.live.recap")}
          </button>
        )}
        <button className="min-h-11 px-4 text-sm text-[var(--muted-foreground)]" onClick={onBack}>
          {t("ui.slurp.live.back")}
        </button>
      </main>
    );
  const chip =
    "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ring-1 transition-transform active:scale-95 disabled:opacity-50";
  const stageActions = host ? (
    <button
      type="button"
      disabled={!personaId || end.isPending}
      onClick={() => personaId && end.mutate({ personaId })}
      className="min-h-11 rounded-full bg-red-600 px-4 text-sm font-bold text-white"
    >
      {t("ui.slurp.live.endShow")}
    </button>
  ) : show.picturesAllowed ? (
    <div
      role="group"
      aria-label={t("ui.slurp.live.viewMode")}
      className="flex rounded-full bg-black/40 p-0.5 ring-1 ring-white/15 backdrop-blur-md"
    >
      {(["text", "pictures"] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={mode.isPending || (option === "pictures" && !!show.pictureModeBusy)}
          aria-pressed={show.mode === option && (option === "text" || show.pictureViewerId === personaId)}
          onClick={() => mode.mutate({ personaId, mode: option })}
          className="min-h-10 rounded-full px-3 text-xs font-semibold text-white/80 aria-pressed:bg-white aria-pressed:text-black disabled:opacity-50"
        >
          {t(`ui.slurp.live.${option}`)}
        </button>
      ))}
    </div>
  ) : null;
  return (
    <main className="mx-auto flex h-full w-full max-w-lg flex-col lg:max-w-6xl lg:flex-row lg:gap-4 lg:p-4">
      <SlpLiveStage
        show={show}
        elapsed={elapsed}
        creatorName={creatorName}
        avatarUrl={avatarUrl}
        personaId={personaId}
        left={left}
        goalTarget={goalTarget}
        topTip={topTip}
        onBack={onBack}
        actions={stageActions}
        t={t}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:w-[400px] lg:flex-none lg:overflow-hidden lg:rounded-3xl lg:bg-[var(--card)] lg:ring-1 lg:ring-[var(--border)]">
        {privateActive && (
          <div
            role="status"
            className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--slurp-violet)_14%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--slurp-violet)]"
          >
            {privateViewer
              ? t("ui.slurp.live.privateTimer", {
                  count: Math.max(0, Math.ceil((Date.parse(show.private!.until) - now) / 1000)),
                })
              : t("ui.slurp.live.inPrivate")}
          </div>
        )}
        {(!privateActive || privateViewer) && show.queue.some((order) => !order.served) && (
          <div className="flex items-center gap-2 overflow-x-auto border-b border-[var(--border)] px-3 py-2">
            <b className="shrink-0 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              {t("ui.slurp.live.nextUp")}
            </b>
            {show.queue
              .filter((order) => !order.served)
              .map((order) => (
                <div
                  key={order.requestId}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--slurp-violet)_16%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--slurp-violet)]"
                >
                  <span>{order.label}</span>
                  {host && personaId && (
                    <button
                      type="button"
                      disabled={done.isPending}
                      onClick={() => done.mutate({ personaId, requestId: order.requestId })}
                      className="min-h-8 rounded-full bg-[var(--slurp-violet)] px-2 font-bold text-white"
                    >
                      {t("ui.slurp.live.done")}
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
        <SlpLiveChat
          show={show}
          creatorName={creatorName}
          avatarUrl={avatarUrl}
          elapsed={elapsed}
          t={t}
          personaId={personaId}
        />
        {!personaId && (
          <p className="border-t border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
            {t("ui.noodle.noodleshell.pickAPersona")}
          </p>
        )}
        {personaId && (!privateActive || privateViewer) && (
          <footer className="space-y-2 border-t border-[var(--border)] bg-[var(--background)] px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:bg-transparent">
            {host ? (
              <form onSubmit={sendNarration} className="flex gap-2">
                <input
                  aria-label={t("ui.slurp.live.narrationLabel")}
                  value={narration}
                  onChange={(event) => setNarration(event.target.value)}
                  maxLength={500}
                  disabled={!personaId || narrate.isPending}
                  placeholder={t("ui.slurp.live.narrationPlaceholder")}
                  className="min-h-11 min-w-0 flex-1 rounded-full bg-[var(--card)] px-4 text-sm ring-1 ring-[var(--border)]"
                />
                <button
                  disabled={!personaId || !narration.trim() || narrate.isPending}
                  className="min-h-11 rounded-full bg-[var(--noodle-accent)] px-5 text-sm font-semibold text-[var(--noodle-accent-foreground)] disabled:opacity-50"
                >
                  {t("ui.slurp.live.send")}
                </button>
              </form>
            ) : (
              <>
                {!privateViewer && (
                  <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5">
                    <button
                      type="button"
                      disabled={tip.isPending}
                      onClick={() => tipLive(topTip?.amount ?? prices[0]!)}
                      className={`${chip} bg-[linear-gradient(135deg,var(--noodle-accent),var(--slurp-violet))] text-white ring-transparent`}
                    >
                      <SlpCoinText>
                        {topTip
                          ? t("ui.slurp.live.matchTop", { amount: topTip.amount ?? prices[0] })
                          : t("ui.slurp.live.firstTipper", { amount: prices[0] })}
                      </SlpCoinText>
                    </button>
                    {prices.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        disabled={tip.isPending}
                        onClick={() => tipLive(amount)}
                        className={`${chip} bg-[color-mix(in_srgb,var(--slurp-warning)_16%,transparent)] text-[var(--foreground)] ring-[color-mix(in_srgb,var(--slurp-warning)_45%,transparent)]`}
                      >
                        <SlpCoinText>{`${amount} <coin/>`}</SlpCoinText>
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-expanded={customOpen}
                      onClick={() => setCustomOpen((open) => !open)}
                      className={`${chip} bg-[var(--card)] ring-[var(--border)]`}
                    >
                      {t("ui.slurp.live.customTip")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuOpen(true)}
                      className={`${chip} bg-[color-mix(in_srgb,var(--slurp-violet)_16%,transparent)] text-[var(--slurp-violet)] ring-[color-mix(in_srgb,var(--slurp-violet)_40%,transparent)]`}
                    >
                      {t("ui.slurp.live.openMenu")}
                    </button>
                    {!privateActive && (
                      <button
                        type="button"
                        disabled={privateShow.isPending}
                        onClick={() => {
                          const requestId = privateRequestId ?? newRequestId();
                          setPrivateRequestId(requestId);
                          privateShow.mutate({ personaId, requestId }, { onSuccess: () => setPrivateRequestId(null) });
                        }}
                        className={`${chip} bg-[var(--card)] ring-[var(--border)]`}
                      >
                        <SlpCoinText>{t("ui.slurp.live.goPrivate", { price: show.privatePrice ?? 0 })}</SlpCoinText>
                      </button>
                    )}
                  </div>
                )}
                {privateViewer && (
                  <button
                    type="button"
                    disabled={privateShow.isPending}
                    onClick={() => {
                      const requestId = privateRequestId ?? newRequestId();
                      setPrivateRequestId(requestId);
                      privateShow.mutate({ personaId, requestId }, { onSuccess: () => setPrivateRequestId(null) });
                    }}
                    className={`${chip} w-full bg-[color-mix(in_srgb,var(--slurp-violet)_16%,transparent)] text-[var(--slurp-violet)] ring-[color-mix(in_srgb,var(--slurp-violet)_40%,transparent)]`}
                  >
                    {t("ui.slurp.live.extend")}
                  </button>
                )}
                {customOpen && !privateViewer && (
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
                      className="min-h-11 min-w-0 flex-1 rounded-full bg-[var(--card)] px-4 text-sm ring-1 ring-[var(--border)]"
                    />
                    <button
                      type="button"
                      disabled={tip.isPending || !Number.isInteger(Number(customAmount)) || Number(customAmount) < 1}
                      onClick={() => tipLive(Number(customAmount))}
                      className="min-h-11 rounded-full bg-[var(--slurp-warning)] px-5 text-sm font-bold text-[var(--slurp-ink)] disabled:opacity-50"
                    >
                      {t("ui.slurp.live.tipCustom")}
                    </button>
                  </div>
                )}
                <form onSubmit={sendChat} className="flex gap-2">
                  <input
                    aria-label={t("ui.slurp.live.chatLabel")}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={1000}
                    disabled={chat.isPending}
                    placeholder={t("ui.slurp.live.chatPlaceholder")}
                    className="min-h-11 min-w-0 flex-1 rounded-full bg-[var(--card)] px-4 text-sm ring-1 ring-[var(--border)]"
                  />
                  <button
                    disabled={!message.trim() || chat.isPending}
                    className="min-h-11 rounded-full bg-[var(--noodle-accent)] px-5 text-sm font-semibold text-[var(--noodle-accent-foreground)] disabled:opacity-50"
                  >
                    {t("ui.slurp.live.send")}
                  </button>
                </form>
              </>
            )}
          </footer>
        )}
      </div>
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
