import { useEffect, useRef, useState } from "react";
import type { SlpLiveShow } from "./slp-live-contract";
import { SlpCoinText } from "../../modules/coin/SlpCoin";
import { Avatar } from "../../base/chrome/SlpChrome";
import { slpLiveBigTip, slpLivePictureUrl } from "./SlpLiveStage";
import { slpLiveReplyPending } from "./slp-live-hooks";
import { SlpLiveSpokenText } from "../../modules/live/SlpLiveSpokenText";

type ChatItem = {
  at: number;
  kind: "host" | "crowd" | "tip" | "menu" | "picture";
  name: string;
  text: string;
  mediaId?: string;
  amount?: number;
  mine?: boolean;
};
const nameColors = [
  "text-[var(--slurp-violet)]",
  "text-[var(--slurp-success)]",
  "text-[var(--slurp-warning)]",
  "text-[var(--noodle-accent-foreground)]",
];
function nameColor(name: string) {
  const hash = [...name].reduce((value, character) => value + character.charCodeAt(0), 0);
  return nameColors[hash % nameColors.length];
}

/** What a late viewer missed, built from the show itself: the goal, the top tippers and her last lines. */
function catchUpLines(
  show: SlpLiveShow,
  elapsed: number,
  t: (key: string, values?: Record<string, unknown>) => string,
): string[] {
  const totals = new Map<string, number>();
  for (const event of show.events) {
    if (event.kind === "tip" && event.at <= elapsed)
      totals.set(event.name, (totals.get(event.name) ?? 0) + (event.amount ?? 0));
  }
  const top = [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => `${name} (${amount})`);
  const said = show.script
    .filter((line) => line.kind === "narration" && line.at <= elapsed)
    .slice(-3)
    .map((line) => line.text);
  return [
    t("ui.slurp.live.catchUp.raised", { raised: show.raised, goal: show.goal }),
    ...(top.length ? [t("ui.slurp.live.catchUp.top", { names: top.join(", ") })] : []),
    ...said,
  ];
}

export function slpLiveChatItems(show: SlpLiveShow, elapsed: number, personaId: string | null, creatorName: string) {
  return [
    ...show.script
      .filter((line) => line.at <= elapsed && line.kind !== "act")
      .map((line): ChatItem => ({
        at: line.at,
        kind: line.kind === "picture" ? "picture" : line.kind === "narration" ? "host" : "crowd",
        name: line.name ?? creatorName,
        text: line.text,
        mediaId: line.mediaId,
      })),
    ...show.events
      .filter((event) => event.at <= elapsed && !event.join)
      .map((event): ChatItem => ({
        at: event.at,
        kind: event.kind === "tip" ? "tip" : "crowd",
        name: event.name,
        text: event.kind === "tip" ? String(event.amount ?? 0) : event.text,
        amount: event.amount,
        mine: !!personaId && event.personaId === personaId,
      })),
    ...show.queue
      .filter((order) => order.at <= elapsed)
      .map((order): ChatItem => ({ at: order.at, kind: "menu", name: order.name, text: order.label })),
  ].sort((a, b) => a.at - b.at);
}

export function SlpLiveChat({
  show,
  creatorName,
  avatarUrl,
  elapsed,
  personaId,
  t,
}: {
  show: SlpLiveShow;
  creatorName: string;
  avatarUrl?: string | null;
  elapsed: number;
  personaId: string | null;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const previousLines = useRef<string[] | null>(null);
  const previousShow = useRef(show.id);
  const [newCount, setNewCount] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(true);
  // Only a viewer who opens the show after its first 2 minutes gets the catch-up.
  const [joinedLate] = useState(() => !show.endedAt && elapsed > 120_000);
  const catchUp = joinedLate ? catchUpLines(show, elapsed, t) : [];
  const lines = slpLiveChatItems(show, elapsed, personaId, creatorName);
  const lineKeys = JSON.stringify(lines.map((line) => [line.at, line.kind, line.name, line.text]));
  useEffect(() => {
    const currentKeys = (JSON.parse(lineKeys) as [number, string, string, string][]).map((line) =>
      JSON.stringify(line),
    );
    const prior = previousShow.current === show.id ? previousLines.current : null;
    previousShow.current = show.id;
    previousLines.current = currentKeys;
    const node = scroll.current;
    if (!node) return;
    if (atBottom.current) node.scrollTop = node.scrollHeight;
    else if (prior) {
      const previous = new Map<string, number>();
      for (const key of prior) previous.set(key, (previous.get(key) ?? 0) + 1);
      const added = currentKeys.reduce((count, key) => {
        const remaining = previous.get(key) ?? 0;
        if (remaining) previous.set(key, remaining - 1);
        return count + (remaining ? 0 : 1);
      }, 0);
      if (added) setNewCount((count) => count + added);
    }
  }, [lineKeys, show.id]);
  const jumpDown = () => {
    const node = scroll.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    atBottom.current = true;
    setNewCount(0);
  };
  return (
    <section
      ref={scroll}
      onScroll={(event) => {
        const node = event.currentTarget;
        atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 32;
        if (atBottom.current) setNewCount(0);
      }}
      className="relative min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3"
      aria-live="polite"
    >
      {catchUp.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <button
            type="button"
            className="min-h-9 font-semibold"
            aria-expanded={summaryOpen}
            onClick={() => setSummaryOpen((open) => !open)}
          >
            {t("ui.slurp.live.missed")}
          </button>
          {summaryOpen && (
            <ul className="list-inside list-disc text-sm text-[var(--muted-foreground)]">
              {catchUp.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <SlpCoinText>{item}</SlpCoinText>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {lines.map((line, index) =>
        line.kind === "picture" && line.mediaId && personaId ? (
          <img
            key={`${line.at}-${index}`}
            src={slpLivePictureUrl(show, line.mediaId, personaId)}
            alt={t("ui.slurp.live.pictureAlt", { name: creatorName })}
            className="slp-live-fade max-h-80 max-w-full rounded-2xl object-contain ring-1 ring-[var(--border)]"
            loading="lazy"
          />
        ) : line.kind === "host" ? (
          <article key={`${line.at}-${index}`} className="slp-live-fade flex items-start gap-2 py-1">
            <Avatar account={{ displayName: creatorName, avatarUrl: avatarUrl ?? null }} size="sm" />
            <div className="min-w-0 rounded-2xl rounded-tl-md bg-[color-mix(in_srgb,var(--noodle-accent)_14%,var(--card))] px-3 py-2 text-sm ring-1 ring-[color-mix(in_srgb,var(--noodle-accent)_30%,transparent)]">
              <strong className="mb-0.5 block text-xs text-[var(--noodle-accent)]">{creatorName}</strong>
              <SlpLiveSpokenText text={line.text} />
            </div>
          </article>
        ) : line.kind === "tip" ? (
          <div
            key={`${line.at}-${index}`}
            className={`slp-live-pop mx-auto w-fit rounded-full px-3 py-1.5 text-sm font-bold ${
              slpLiveBigTip(show, line.amount ?? 0)
                ? "bg-[linear-gradient(135deg,var(--slurp-warning),var(--noodle-accent))] text-neutral-950 shadow-[0_4px_18px_color-mix(in_srgb,var(--slurp-warning)_45%,transparent)]"
                : "bg-[color-mix(in_srgb,var(--slurp-warning)_18%,transparent)] text-[var(--slurp-warning)]"
            }`}
          >
            <SlpCoinText>{t("ui.slurp.live.tipEvent", { name: line.name, amount: line.text })}</SlpCoinText>
          </div>
        ) : line.kind === "menu" ? (
          <div
            key={`${line.at}-${index}`}
            className="mx-auto w-fit rounded-full bg-[color-mix(in_srgb,var(--slurp-violet)_16%,transparent)] px-3 py-1.5 text-sm font-semibold text-[var(--slurp-violet)]"
          >
            {t("ui.slurp.live.menuEvent", { name: line.name, item: line.text })}
          </div>
        ) : (
          <p
            key={`${line.at}-${index}`}
            className={`text-[13px] leading-snug ${line.mine ? "-mx-1.5 rounded-lg bg-[color-mix(in_srgb,var(--noodle-accent)_10%,transparent)] px-1.5 py-0.5" : ""}`}
          >
            <b className={line.mine ? "text-[var(--noodle-accent)]" : nameColor(line.name)}>{line.name}</b>{" "}
            <span>
              <SlpLiveSpokenText text={line.text} />
            </span>
          </p>
        ),
      )}
      {slpLiveReplyPending(show) && (
        <p className="px-1 text-xs italic text-[var(--muted-foreground)]" aria-live="polite">
          {t("ui.slurp.live.readingChat", { name: creatorName })}
        </p>
      )}
      {newCount > 0 && (
        <button
          type="button"
          onClick={jumpDown}
          className="sticky bottom-1 mx-auto flex min-h-10 rounded-full bg-[var(--noodle-accent)] px-4 text-sm font-semibold text-[var(--noodle-accent-foreground)] shadow-md"
        >
          {t("ui.slurp.live.newMessages", { count: newCount })}
        </button>
      )}
    </section>
  );
}

/** Phone: the last few chat lines see-through over the show, fading out at the top; a tap opens the full chat. */
export function SlpLiveChatPeek({
  show,
  elapsed,
  personaId,
  creatorName,
  onOpen,
  t,
}: {
  show: SlpLiveShow;
  elapsed: number;
  personaId: string | null;
  creatorName: string;
  onOpen: () => void;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  // Her lines and the pictures are on the stage itself; the peek is the room around her.
  const lines = slpLiveChatItems(show, elapsed, personaId, creatorName)
    .filter((line) => line.kind !== "picture" && line.kind !== "host")
    .slice(-5);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("ui.slurp.live.openChat")}
      className="slp-live-chat-fade flex max-h-36 min-h-11 w-full flex-col justify-end gap-0.5 overflow-hidden px-3 pb-1 pt-6 text-left text-white"
    >
      {lines.map((line, index) =>
        line.kind === "tip" ? (
          <span
            key={`${line.at}-${index}`}
            className="slp-live-fade w-fit shrink-0 rounded-full bg-[color-mix(in_srgb,var(--slurp-warning)_85%,transparent)] px-2.5 py-0.5 text-xs font-bold text-neutral-950"
          >
            <SlpCoinText>{t("ui.slurp.live.tipEvent", { name: line.name, amount: line.text })}</SlpCoinText>
          </span>
        ) : line.kind === "menu" ? (
          <span
            key={`${line.at}-${index}`}
            className="slp-live-fade w-fit shrink-0 rounded-full bg-[color-mix(in_srgb,var(--slurp-violet)_70%,transparent)] px-2.5 py-0.5 text-xs font-semibold"
          >
            {t("ui.slurp.live.menuEvent", { name: line.name, item: line.text })}
          </span>
        ) : (
          <span
            key={`${line.at}-${index}`}
            className="slp-live-fade block shrink-0 text-[13px] leading-snug drop-shadow-[0_1px_3px_rgb(0_0_0/0.9)]"
          >
            <b className={line.mine ? "text-[var(--noodle-accent)]" : nameColor(line.name)}>{line.name}</b>{" "}
            <SlpLiveSpokenText text={line.text} />
          </span>
        ),
      )}
    </button>
  );
}
