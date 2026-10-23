import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSlpLiveActions, useSlpLiveShow } from "./slp-live-hooks";
import type { SlpLiveShow } from "./slp-live-contract";
import { useTranslation } from "react-i18next";

export function SlpLiveScreen({ showId, personaId, creatorName, avatarUrl, onBack, onOpenRecap }: {
  showId: string; personaId: string | null; creatorName: string; avatarUrl?: string | null;
  onBack: () => void; onOpenRecap: (postId: string) => void;
}) {
  const { t } = useTranslation();
  const query = useSlpLiveShow(showId);
  if (query.isLoading) return <div className="p-5 text-sm text-[var(--muted-foreground)]">{t("ui.slurp.live.loading")}</div>;
  if (!query.data || query.isError) return <div className="p-5"><button className="min-h-11" onClick={onBack}>{t("ui.slurp.live.back")}</button><p>{t("ui.slurp.live.unavailable")}</p></div>;
  return <SlpLiveContent show={query.data} personaId={personaId} creatorName={creatorName} avatarUrl={avatarUrl} onBack={onBack} onOpenRecap={onOpenRecap} />;
}

function SlpLiveContent({ show, personaId, creatorName, avatarUrl, onBack, onOpenRecap }: {
  show: SlpLiveShow; personaId: string | null; creatorName: string; avatarUrl?: string | null;
  onBack: () => void; onOpenRecap: (postId: string) => void;
}) {
  const { t } = useTranslation();
  const { tip, chat } = useSlpLiveActions(show.id);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (show.endedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [show.endedAt]);
  const elapsed = now - Date.parse(show.startedAt);
  const lines = useMemo(() => [
    ...show.script.filter((line) => line.at <= elapsed).map((line) => ({ ...line, event: false })),
    ...show.events.filter((event) => event.at <= elapsed).map((event) => ({ ...event, kind: event.kind === "tip" ? "tip" as const : "crowd" as const, event: true })),
  ].sort((a, b) => a.at - b.at), [show, elapsed]);
  const left = Math.max(0, Math.ceil((Date.parse(show.endsAt) - now) / 60_000));
  const topTip = show.events.filter((event) => event.kind === "tip").reduce<SlpLiveShow["events"][number] | null>((best, event) => !best || (event.amount ?? 0) > (best.amount ?? 0) ? event : best, null);
  const sendChat = (event: FormEvent) => {
    event.preventDefault();
    if (!personaId || !message.trim() || chat.isPending) return;
    chat.mutate({ personaId, text: message.trim() }, { onSuccess: () => setMessage("") });
  };
  const tipLive = (amount: number) => personaId && tip.mutate({ personaId, amount, requestId: crypto.randomUUID() });
  if (show.endedAt) return <main className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-4 p-6 text-center"><h1 className="text-xl font-bold">{t("ui.slurp.live.ended")}</h1><p className="text-sm text-[var(--muted-foreground)]">{t("ui.slurp.live.raised", { name: creatorName, amount: show.raised })}</p>{show.recapPostId && <button className="min-h-11 rounded-lg bg-[var(--primary)] px-4 text-[var(--primary-foreground)]" onClick={() => onOpenRecap(show.recapPostId!)}>{t("ui.slurp.live.recap")}</button>}<button className="min-h-11 px-4" onClick={onBack}>{t("ui.slurp.live.back")}</button></main>;
  return <main className="mx-auto flex h-full max-w-lg flex-col">
    <header className="flex min-h-16 items-center gap-3 border-b border-[var(--border)] px-4">
      <button onClick={onBack} className="min-h-11 min-w-11" aria-label={t("ui.slurp.live.back")}>‹</button>
      {avatarUrl ? <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="h-10 w-10 rounded-full bg-[var(--muted)]" />}
      <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-bold">{creatorName}</h1><p className="text-xs text-[var(--muted-foreground)]">{t("ui.slurp.live.left", { count: left })}</p></div>
      <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">LIVE</span>
    </header>
    <section className="border-b border-[var(--border)] px-4 py-3" aria-label={t("ui.slurp.live.goalLabel")}><div className="mb-2 flex justify-between text-xs"><span>{t("ui.slurp.live.goal", { raised: show.raised, goal: show.goal })}</span><span>{Math.min(100, Math.round(show.raised / Math.max(1, show.goal) * 100))}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]"><div className="h-full bg-[var(--primary)]" style={{ width: `${Math.min(100, show.raised / Math.max(1, show.goal) * 100)}%` }} /></div></section>
    <section className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">{lines.map((line, index) => <div key={`${line.at}-${line.name ?? "host"}-${index}`} className={line.kind === "narration" ? "rounded-lg bg-[var(--card)] p-3 text-sm text-[var(--foreground)]" : line.kind === "tip" ? "mx-auto w-fit rounded-full bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-700" : "text-xs text-[var(--muted-foreground)]"}>{line.kind === "narration" ? <><span className="mb-1 block text-xs font-bold">{creatorName}</span>{line.text}</> : line.kind === "tip" ? t("ui.slurp.live.tipEvent", { name: line.name, amount: line.amount ?? 0 }) : <><b>{line.name ?? t("ui.slurp.live.crowd")}</b> {line.text}</>}</div>)}</section>
    <footer className="space-y-3 border-t border-[var(--border)] p-3">
      <div className="flex gap-2">{[10, 50, 100].map((amount) => <button key={amount} disabled={!personaId || tip.isPending} onClick={() => tipLive(amount)} className="min-h-11 flex-1 rounded-lg border border-[var(--border)] text-sm font-semibold disabled:opacity-50">{t("ui.slurp.live.tip", { amount })}</button>)}</div>
      <button disabled={!personaId || tip.isPending} onClick={() => tipLive(topTip?.amount ?? 10)} className="min-h-11 w-full rounded-lg bg-[var(--primary)] px-3 text-sm font-bold text-[var(--primary-foreground)]">{topTip ? t("ui.slurp.live.matchTop", { amount: topTip.amount ?? 10 }) : t("ui.slurp.live.firstTipper", { amount: 10 })}</button>
      <form onSubmit={sendChat} className="flex gap-2"><input aria-label={t("ui.slurp.live.chatLabel")} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} disabled={!personaId || chat.isPending} placeholder={t("ui.slurp.live.chatPlaceholder")} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm" /><button disabled={!personaId || !message.trim() || chat.isPending} className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold">{t("ui.slurp.live.send")}</button></form>
    </footer>
  </main>;
}
