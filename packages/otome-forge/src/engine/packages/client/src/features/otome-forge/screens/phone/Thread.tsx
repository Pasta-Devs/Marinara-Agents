// ──────────────────────────────────────────────
// Otome Forge: one private thread. Bubbles in his accent colour, chibi stickers (#2044), a typing delay that feels
// human (lib/typing-delay.ts), earlier messages page by page, and Close and remember: each closed conversation shows
// that he remembers it and the line he keeps from it, never the summary written for his prompts.
// ──────────────────────────────────────────────
// One reply in flight per thread: a send waits for the last one (on this page, and on the server, which answers 409
// busy and reports `busy` in the history, polled until it clears). Each message carries its own id, so the server
// never saves it twice. A failed send never goes again by itself: the thread is read back, the words return to the
// box when the server never saved them, and "Ask again" appears when it saved them but no reply came.
// The group chat (#2154) is this thread without `li`: "Everyone" with its members' portraits and names in the header,
// each bubble in its speaker's accent with their name when the speaker changes and their portrait on the last of a run,
// the protagonist's five stickers, no quote, and Close and remember for everyone in it (no affection).
// #2156: his invitation to clear the air (PhoneMessage.invite) shows under his message with Accept and Decline while it
// waits (POST .../invite), then what became of it; Accept opens Date Night with him (onDate).
// A picked sticker is attached to the message box (shown above it, with Remove), not sent: Send sends it with the words
// in the box, or alone, as one message; picking another replaces it. A failed send that was never saved gives it back.
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookHeart, ChevronLeft, Heart, HeartHandshake, RotateCcw, SendHorizontal, X } from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar, AvatarCluster } from "../../components/Avatar";
import { storyQueryKey } from "../../hooks/use-reader";
import { runQueryKey } from "../../hooks/use-run";
import { accentOf } from "../../lib/accent";
import { typingDelay } from "../../lib/typing-delay";
import { useOtomeProps } from "../../props";
import type {
  PhoneCloseResult,
  PhoneHistoryPage,
  PhoneListView,
  PhoneMessage,
  PhoneSendResult,
  PhoneSession,
  RunLiView,
  RunView,
} from "../../shared/api-types";
import { isFace } from "../../shared/faces";
import { GROUP_THREAD } from "../../shared/home";
import { playQueryKey } from "../dates/DatesHub";
import { homeQueryKey } from "../home/HomeScreen";
import { CloseAndRemember } from "./CloseAndRemember";
import { BUSY_POLL_MS, phonePath, phoneQueryKey, threadQueryKey } from "./PhoneScreen";
import { Sticker, StickerArt, StickerPicker, stickerLabel, useStickers, type Stickers } from "./StickerPicker";
import { messageTime } from "./ThreadList";
import { TypingIndicator } from "./TypingIndicator";

const TEXT_MAX = 1_000;
const COUNTER_FROM = 900;
const NEAR_BOTTOM_PX = 96;

/** Threads with a send or close on its way from this page. */
const sending = new Set<string>();

type Row = PhoneMessage & { archived?: boolean };
type SendBody = { text: string; quote?: string; sticker?: string; id: string } | { retry: true };

/** A message id the server accepts as the client's own (S/phone/chat.ts MESSAGE_ID). */
const messageId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`;

/** Rows by id, in first-seen order; a later copy of a row replaces its fields. */
function mergeRows(...lists: Row[][]): Row[] {
  const order: string[] = [];
  const rows = new Map<string, Row>();
  for (const list of lists) {
    for (const row of list) {
      if (!rows.has(row.id)) order.push(row.id);
      rows.set(row.id, { ...rows.get(row.id), ...row });
    }
  }
  return order.map((id) => rows.get(id)!);
}

interface Incoming {
  mine: PhoneMessage[];
  his: PhoneMessage[];
  /** How many of his messages have appeared. */
  shown: number;
  started: number;
}

interface ThreadProps {
  runKey: string;
  /** The run, for its stickers and (in the group chat) who sent each message. */
  view: Pick<RunView, "world" | "stickers" | "lis">;
  /** His thread; absent, the group chat (#2154). */
  li?: RunLiView;
  quote?: string;
  /** Opened from the thread list: focus moves to the heading (a screen change already does). */
  focusHeading: boolean;
  onBack: () => void;
  /** The quote still waiting for her next message, or null once it went with one or she removed it. */
  onQuoteChange: (quote: string | null) => void;
  /** #2156: she accepted his invitation to clear the air: Date Night with him opens. */
  onDate?: (li: string) => void;
}

export function Thread({
  runKey,
  view,
  li,
  quote: initialQuote,
  focusHeading,
  onBack,
  onQuoteChange,
  onDate,
}: ThreadProps) {
  const { t } = useTranslation();
  const stickers = useStickers(view, li);
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { localization, timeZone } = useOtomeProps();
  const id = li?.id ?? GROUP_THREAD;
  const key = threadQueryKey(runKey, id);
  const path = phonePath(runKey, id);
  const threadKey = `${runKey} ${id}`;
  const accent = li ? accentOf(li) : "var(--of-rose)";
  const title = li ? li.name : t("ui.otomeForge.phone.groupName");

  const fetchPage = (page: number) => otome.get<PhoneHistoryPage>(path, { page });
  // Read again whenever the thread opens: a reply that landed after the player left (this page wrote nothing then) is
  // in the server's page, and so is `busy` while it is still being written, which polls until it clears.
  const latest = useQuery({
    queryKey: key,
    queryFn: () => fetchPage(1),
    refetchOnMount: "always",
    refetchInterval: (query) => (query.state.data?.busy ? BUSY_POLL_MS : false),
  });

  const [olderPages, setOlderPages] = useState<PhoneHistoryPage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [quote, setQuote] = useState<string | null>(initialQuote?.trim() || null);
  /** The sticker attached to the message box, sent with its words on Send. */
  const [attached, setAttached] = useState<string | null>(null);
  // The phone keeps the quote while it waits, so the thread opened again (after Settings) never brings back one spent.
  useEffect(() => {
    onQuoteChange(quote);
    // Only when the quote changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote]);
  /** Her message on its way (null when asking again), from when it was sent. */
  const [outgoing, setOutgoing] = useState<{ local: PhoneMessage | null; started: number } | null>(null);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closedGrant, setClosedGrant] = useState(0);
  const [announce, setAnnounce] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  /** Who sent one of their messages: him, or in the group chat its speaker (unknown when it names none). */
  const speakerOf = (row: PhoneMessage) => li ?? view.lis.find((entry) => entry.id === row.li);
  const nameOf = (row: PhoneMessage) => speakerOf(row)?.name ?? t("ui.otomeForge.phone.groupSomeone");
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLOListElement>(null);
  const stick = useRef(true);
  const prepend = useRef<{ height: number; top: number } | null>(null);

  useEffect(() => {
    if (focusHeading) heading.current?.focus({ preventScroll: true });
    // Once, as the thread opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What the thread shows: earlier pages, the newest page, her message on its way, and his messages as they appear.
  const pages = [...olderPages].reverse();
  if (latest.data) pages.push(latest.data);
  const indexOf = new Map<string, number>();
  for (const page of pages) page.messages.forEach((row, at) => indexOf.set(row.id, page.from + at));
  const unrevealed = new Set(incoming ? incoming.his.slice(incoming.shown).map((row) => row.id) : []);
  const mine: Row[] = incoming?.mine.length ? incoming.mine : outgoing?.local ? [outgoing.local] : [];
  const messages = mergeRows(
    ...pages.map((page) => page.messages),
    mine,
    incoming ? incoming.his.slice(0, incoming.shown) : [],
  ).filter((row) => !unrevealed.has(row.id));
  // Each closed conversation ends with what he remembers of it.
  const sessions = latest.data?.sessions ?? [];
  const sessionEnds = new Map<number, PhoneSession>(
    sessions.map((session) => [session.start + session.count - 1, session]),
  );
  const newestSession = sessions.at(-1);

  const waiting = !!outgoing && !incoming;
  const revealing = !!incoming && incoming.shown < incoming.his.length;
  const remoteBusy = !outgoing && latest.data?.busy === true;
  const typing = waiting || revealing || remoteBusy;
  const busy = !!outgoing || remoteBusy;
  const canSend = !busy && (draft.trim().length > 0 || !!attached);

  /** `fromDraft`: the box's own words (and the sticker attached to it) are sent. */
  const send = async (body: SendBody, fromDraft = false) => {
    if (busy || sending.has(threadKey)) return;
    sending.add(threadKey);
    const started = Date.now();
    const before = new Set(messages.map((row) => row.id));
    const local: PhoneMessage | null =
      "retry" in body
        ? null
        : {
            id: body.id,
            who: "player",
            text: body.text,
            at: new Date(started).toISOString(),
            ...(body.sticker ? { sticker: body.sticker } : {}),
            ...(body.quote ? { quote: body.quote } : {}),
          };
    stick.current = true;
    setOutgoing({ local, started });
    setError(null);
    setClosedGrant(0);
    setAnnounce(li ? t("ui.otomeForge.phone.typing", { name: li.name }) : t("ui.otomeForge.phone.groupTyping"));
    if (local) {
      if (fromDraft) {
        setDraft("");
        setAttached(null);
      }
      setQuote(null);
    }
    try {
      const result = await otome.post<PhoneSendResult>(`${path}/send`, body);
      const rows = Array.isArray(result.messages) ? result.messages : [];
      setIncoming({
        mine: rows.filter((row) => row.who === "player"),
        his: rows.filter((row) => row.who === "li" && !before.has(row.id)),
        shown: 0,
        started,
      });
    } catch (failure) {
      // Read the thread back to learn whether her message was saved; never send it again unasked.
      let saved = !local;
      try {
        const page = await queryClient.fetchQuery({ queryKey: key, queryFn: () => fetchPage(1), staleTime: 0 });
        saved = !!local && page.messages.some((row) => row.id === local.id);
      } catch {
        // Unknown: keep her words.
      }
      if (local && !saved) {
        // A newer draft, or a sticker attached since, is never overwritten.
        setDraft((current) => current || local.text);
        if (local.sticker) setAttached((current) => current ?? local.sticker ?? null);
        if (local.quote) setQuote((current) => current ?? local.quote ?? null);
      }
      setOutgoing(null);
      setAnnounce("");
      setError(otome.errorMessage(failure));
    } finally {
      sending.delete(threadKey);
    }
  };

  // His messages appear one by one, each after its typing delay; then the thread keeps them.
  useEffect(() => {
    if (!incoming) return;
    if (incoming.shown < incoming.his.length) {
      const next = incoming.his[incoming.shown]!;
      const waited = incoming.shown === 0 ? Date.now() - incoming.started : 0;
      const timer = setTimeout(
        () => {
          setIncoming((current) => (current === incoming ? { ...current, shown: current.shown + 1 } : current));
          setAnnounce(
            next.text.trim()
              ? t("ui.otomeForge.phone.said", { name: nameOf(next), text: next.text })
              : next.sticker
                ? t("ui.otomeForge.phone.saidSticker", {
                    name: nameOf(next),
                    face: stickerLabel(t, stickers, next.sticker),
                  })
                : "",
          );
        },
        typingDelay(next.text, waited),
      );
      return () => clearTimeout(timer);
    }
    queryClient.setQueryData<PhoneHistoryPage>(key, (page) =>
      page
        ? {
            ...page,
            messages: mergeRows(page.messages, incoming.mine, incoming.his).map((row) => ({
              ...row,
              archived: row.archived === true,
            })),
            busy: false,
            retry: false,
          }
        : page,
    );
    setIncoming(null);
    setOutgoing(null);
    if (!incoming.his.length) setAnnounce("");
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: phoneQueryKey(runKey) });
    // Advances only when `incoming` changes; the rest is read as it is then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  // His newest message has been seen once the thread shows it.
  const lastHis = [...messages].reverse().find((row) => row.who === "li")?.id ?? null;
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!lastHis || seen.current === lastHis) return;
    seen.current = lastHis;
    otome
      .post<Record<string, never>>(`${path}/seen`, { last: lastHis })
      .then(() => {
        queryClient.setQueryData<PhoneListView>(phoneQueryKey(runKey), (list) =>
          list
            ? {
                ...list,
                threads: list.threads.map((row) => (row.li === id ? { ...row, unread: 0 } : row)),
                group: list.group && !li ? { ...list.group, unread: 0 } : list.group,
              }
            : list,
        );
        void queryClient.invalidateQueries({ queryKey: homeQueryKey(runKey) });
      })
      .catch((failure: unknown) => console.warn("Otome Forge could not mark a thread as read", failure));
    // `li` changes only with `id` (PhoneScreen keys the thread by it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastHis, id, otome, path, queryClient, runKey]);

  // The log stays at its newest line while the player is there, and keeps its place when earlier messages load.
  useLayoutEffect(() => {
    const element = log.current;
    if (!element) return;
    if (prepend.current) {
      element.scrollTop = prepend.current.top + element.scrollHeight - prepend.current.height;
      prepend.current = null;
    } else if (stick.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages.length, typing, sessions.length, latest.isPending]);

  // Pages count from the newest message, so every new message moves every page's bounds. Once the newest page has
  // moved, the earlier pages already loaded are read again by their numbers, or the messages between them and the
  // newest page would drop out of view. If that read fails they are let go (Earlier messages loads them again).
  const latestFrom = latest.data?.from;
  const loadedFrom = useRef(latestFrom);
  useEffect(() => {
    if (latestFrom === undefined || loadedFrom.current === latestFrom) return;
    loadedFrom.current = latestFrom;
    if (!olderPages.length) return;
    let live = true;
    Promise.all(olderPages.map((older) => fetchPage(older.page))).then(
      (fresh) => live && setOlderPages(fresh),
      () => live && setOlderPages([]),
    );
    return () => {
      live = false;
    };
    // Only when the newest page moves; the pages loaded are read as they are then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestFrom]);

  const oldest = pages[0];
  const hasOlder = !!oldest && oldest.page < oldest.pages;
  const loadOlder = async () => {
    if (loadingOlder || !oldest) return;
    setLoadingOlder(true);
    try {
      const page = await fetchPage(oldest.page + 1);
      const element = log.current;
      if (element) prepend.current = { height: element.scrollHeight, top: element.scrollTop };
      setOlderPages((current) => [...current, page]);
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setLoadingOlder(false);
    }
  };

  const submit = () => {
    if (!canSend) return;
    void send(
      {
        text: draft.trim(),
        id: messageId(),
        ...(attached ? { sticker: attached } : {}),
        ...(quote ? { quote } : {}),
      },
      true,
    );
  };

  const closed = (result: PhoneCloseResult) => {
    // Shown at once as the newest closed conversation; the server's page follows.
    queryClient.setQueryData<PhoneHistoryPage>(key, (page) => {
      if (!page || page.activeCount === 0) return page;
      const end = page.from + page.messages.length;
      const session: PhoneSession = {
        start: end - page.activeCount,
        count: page.activeCount,
        memory: result.memory,
        closedAt: new Date().toISOString(),
      };
      return {
        ...page,
        messages: page.messages.map((row) => ({ ...row, archived: true })),
        sessions: [...page.sessions, session],
        past: page.past + 1,
        activeCount: 0,
        retry: false,
      };
    });
    setClosedGrant(result.grants.reduce((sum, grant) => sum + (grant.affection ?? 0), 0));
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: phoneQueryKey(runKey) });
    void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
  };

  const askAgain = latest.data?.retry === true && !busy && !incoming;
  const activeCount = latest.data?.activeCount ?? 0;
  // The group chat's members now, as its page names them, and their names for the header and the log.
  const members = (latest.data?.members ?? []).flatMap((member) => view.lis.filter((entry) => entry.id === member));
  const memberNames = members.map((member) => member.name).join(", ");

  return (
    <div className="of-thread" style={{ "--of-li-accent": accent } as CSSProperties}>
      <header className="of-thread-head of-glass">
        <button
          type="button"
          className="of-icon-button"
          aria-label={t("ui.otomeForge.phone.allMessages")}
          title={t("ui.otomeForge.phone.allMessages")}
          onClick={onBack}
        >
          <ChevronLeft className="of-back-icon" size={20} strokeWidth={2.1} aria-hidden="true" />
        </button>
        {li ? (
          <>
            <Avatar name={li.name} url={li.portrait} accent={accent} size={36} />
            <h1 ref={heading} className="of-thread-title" tabIndex={-1}>
              {li.name}
            </h1>
          </>
        ) : (
          <>
            <AvatarCluster
              people={members.map((member) => ({ name: member.name, url: member.portrait, accent: accentOf(member) }))}
              size={40}
            />
            <div className="of-thread-titles">
              <h1 ref={heading} className="of-thread-title" tabIndex={-1}>
                {title}
              </h1>
              {memberNames ? (
                <p className="of-thread-subtitle">{t("ui.otomeForge.phone.groupMembers", { names: memberNames })}</p>
              ) : null}
            </div>
          </>
        )}
        <CloseAndRemember
          path={path}
          text={
            li
              ? t("ui.otomeForge.phone.closeText", { name: li.name })
              : t("ui.otomeForge.phone.groupCloseText", { names: memberNames })
          }
          waitText={
            li ? t("ui.otomeForge.phone.closeWait", { name: li.name }) : t("ui.otomeForge.phone.groupCloseWait")
          }
          blocked={busy || incoming ? "waiting" : activeCount === 0 ? "empty" : null}
          onClosed={closed}
        />
      </header>

      {latest.isError && !latest.data ? (
        <div className="of-notice of-notice--error of-reader-notice" role="alert">
          <span>{otome.errorMessage(latest.error, "ui.otomeForge.phone.loadFailed")}</span>
          <button type="button" className="of-button of-button--text" onClick={() => void latest.refetch()}>
            <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
            {t("ui.otomeForge.common.retry")}
          </button>
        </div>
      ) : null}

      <ol
        ref={log}
        className="of-thread-log"
        aria-label={
          li
            ? t("ui.otomeForge.phone.messagesWith", { name: li.name })
            : t("ui.otomeForge.phone.groupMessagesWith", { names: memberNames })
        }
        aria-busy={latest.isPending}
        onScroll={(event) => {
          const element = event.currentTarget;
          stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
        }}
      >
        {hasOlder ? (
          <li className="of-thread-older">
            <button
              type="button"
              className="of-button of-button--text"
              aria-disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {t("ui.otomeForge.phone.loadOlder")}
            </button>
          </li>
        ) : null}
        {latest.isPending ? (
          <li className="of-thread-empty" role="status">
            <Heart className="of-pulse" size={20} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
            {t("ui.otomeForge.phone.loading")}
          </li>
        ) : messages.length === 0 && !typing ? (
          <li className="of-thread-empty">
            {li ? t("ui.otomeForge.phone.startHint", { name: li.name }) : t("ui.otomeForge.phone.groupStartHint")}
          </li>
        ) : null}
        {messages.map((row, at) => {
          const next = messages[at + 1];
          const before = messages[at - 1];
          const index = indexOf.get(row.id);
          const session = index === undefined ? undefined : sessionEnds.get(index);
          // A run is one sender's messages in a row (in the group chat, one speaker's), and never crosses a Close and
          // remember divider: the row that ends a session closes its run, and the row after it starts one (Dottore, #2168).
          const same = (other: PhoneMessage | undefined) => !!other && other.who === row.who && other.li === row.li;
          const endsSession = (other: PhoneMessage | undefined) =>
            !!other && sessionEnds.has(indexOf.get(other.id) ?? -1);
          const joinsNext = !session && same(next);
          const joinsBefore = !endsSession(before) && same(before);
          return (
            <Fragment key={row.id}>
              <Bubble
                row={row}
                li={speakerOf(row)}
                name={nameOf(row)}
                stickers={stickers}
                pending={!incoming && outgoing?.local?.id === row.id}
                time={!joinsNext ? messageTime(row.at, localization.locale, timeZone) : ""}
                group={!li && row.who === "li" ? { first: !joinsBefore, last: !joinsNext } : undefined}
              />
              {li && row.invite && row.who === "li" ? (
                <InviteCard runKey={runKey} li={li} row={row} onDate={onDate} />
              ) : null}
              {session ? (
                <li className="of-thread-divider">
                  <p className="of-thread-divider-title">
                    <BookHeart size={13} strokeWidth={2} aria-hidden="true" />
                    {li
                      ? t("ui.otomeForge.phone.remembered", { name: session.name || li.name })
                      : t("ui.otomeForge.phone.groupRemembered")}
                  </p>
                  {session.memory.quote ? (
                    <p className="of-memory-quote">
                      {t("ui.otomeForge.home.noteText", { text: session.memory.quote })}
                    </p>
                  ) : null}
                  {closedGrant > 0 && session === newestSession ? (
                    <p className="of-badge of-badge--soft" role="status">
                      {t("ui.otomeForge.phone.affection", { amount: closedGrant })}
                    </p>
                  ) : null}
                </li>
              ) : null}
            </Fragment>
          );
        })}
        {typing ? <TypingIndicator group={!li} /> : null}
      </ol>

      {askAgain ? (
        <div className="of-notice of-reader-notice" role="status">
          <span>
            {li ? t("ui.otomeForge.phone.noAnswer", { name: li.name }) : t("ui.otomeForge.phone.groupNoAnswer")}
          </span>
          <button type="button" className="of-button of-button--text" onClick={() => void send({ retry: true })}>
            <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
            {t("ui.otomeForge.phone.askAgain")}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
      <form
        className="of-composer of-glass of-glass--strong"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {quote ? (
          <div className="of-quote-chip">
            <span className="of-quote-text">
              <span className="of-quote-label">{t("ui.otomeForge.phone.replyingTo", { name: title })}</span>
              <q>{quote}</q>
            </span>
            <button
              type="button"
              className="of-icon-button"
              aria-label={t("ui.otomeForge.phone.removeQuote")}
              title={t("ui.otomeForge.phone.removeQuote")}
              onClick={() => {
                setQuote(null);
                input.current?.focus({ preventScroll: true });
              }}
            >
              <X size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {attached ? (
          <div className="of-quote-chip of-attached-sticker">
            {isFace(attached) && li ? (
              <Sticker li={li} face={attached} />
            ) : (
              <StickerArt stickers={stickers} id={attached} />
            )}
            <span className="of-quote-text">
              <span className="of-quote-label">
                {t("ui.otomeForge.phone.stickerAttached", { face: stickerLabel(t, stickers, attached) })}
              </span>
            </span>
            <button
              type="button"
              className="of-icon-button"
              aria-label={t("ui.otomeForge.phone.removeSticker")}
              title={t("ui.otomeForge.phone.removeSticker")}
              onClick={() => {
                setAttached(null);
                input.current?.focus({ preventScroll: true });
              }}
            >
              <X size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="of-composer-row">
          <StickerPicker
            stickers={stickers}
            name={title}
            disabled={busy}
            onPick={(sticker) => {
              setAttached(sticker);
              setAnnounce(t("ui.otomeForge.phone.stickerAttached", { face: stickerLabel(t, stickers, sticker) }));
              input.current?.focus({ preventScroll: true });
            }}
          />
          {/* No Enter shortcut: Enter starts a new line on a phone and on a computer alike, and only Send sends. */}
          <textarea
            ref={input}
            className="of-input of-composer-input"
            rows={1}
            value={draft}
            maxLength={TEXT_MAX}
            aria-label={
              li ? t("ui.otomeForge.phone.inputLabel", { name: li.name }) : t("ui.otomeForge.phone.groupInputLabel")
            }
            placeholder={
              li ? t("ui.otomeForge.phone.placeholder", { name: li.name }) : t("ui.otomeForge.phone.groupPlaceholder")
            }
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className="of-icon-button of-send"
            aria-label={t("ui.otomeForge.phone.send")}
            title={t("ui.otomeForge.phone.send")}
            aria-disabled={!canSend}
          >
            <SendHorizontal size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        {draft.length >= COUNTER_FROM ? (
          <span className="of-counter of-composer-counter">
            {draft.length}/{TEXT_MAX}
          </span>
        ) : null}
      </form>

      <p className="of-visually-hidden" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

const INVITE_KEYS = {
  pending: "ui.otomeForge.phone.invitePending",
  accepted: "ui.otomeForge.phone.inviteAccepted",
  declined: "ui.otomeForge.phone.inviteDeclined",
  lapsed: "ui.otomeForge.phone.inviteLapsed",
} as const;

/** #2156: his invitation to clear the air: Accept or Decline while it waits, then what became of it. */
function InviteCard({
  runKey,
  li,
  row,
  onDate,
}: {
  runKey: string;
  li: RunLiView;
  row: Row;
  onDate?: (li: string) => void;
}) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const status = row.invite!.status;
  // Her answer takes the buttons away: focus moves to the card, whose status line announces what became of it.
  const cardRef = useRef<HTMLDivElement>(null);
  const answered = useRef(false);
  useEffect(() => {
    if (!answered.current || status === "pending") return;
    answered.current = false;
    cardRef.current?.focus();
  }, [status]);
  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await otome.post(`${phonePath(runKey, li.id)}/invite`, { message: row.id, accept });
      answered.current = true;
      void queryClient.invalidateQueries({ queryKey: playQueryKey(runKey) });
      void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
      if (accept) onDate?.(li.id);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: threadQueryKey(runKey, li.id) });
    }
  };
  return (
    <li className="of-invite-row">
      <div
        ref={cardRef}
        className="of-invite of-glass"
        role="group"
        tabIndex={-1}
        aria-label={t("ui.otomeForge.phone.inviteLabel", { name: li.name })}
      >
        <p className="of-invite-text" role="status">
          <HeartHandshake size={15} strokeWidth={2} aria-hidden="true" />
          <span>{t(INVITE_KEYS[status], { name: li.name })}</span>
        </p>
        {status === "pending" ? (
          <div className="of-invite-actions">
            <button
              type="button"
              className="of-button of-button--primary of-button--small"
              aria-disabled={busy}
              onClick={() => void answer(true)}
            >
              {t("ui.otomeForge.phone.inviteAccept")}
            </button>
            <button
              type="button"
              className="of-button of-button--quiet of-glass of-button--small"
              aria-disabled={busy}
              onClick={() => void answer(false)}
            >
              {t("ui.otomeForge.phone.inviteDecline")}
            </button>
          </div>
        ) : null}
        {error ? (
          <p className="of-error" role="alert">
            {otome.errorMessage(error)}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * One message. `li` and `name` are who sent his (in the group chat its speaker, when known); `group` marks a member's
 * message there, the first and the last of their run.
 */
function Bubble({
  row,
  li,
  name,
  stickers,
  pending,
  time,
  group,
}: {
  row: Row;
  li: RunLiView | undefined;
  name: string;
  stickers: Stickers;
  pending: boolean;
  time: string;
  group?: { first: boolean; last: boolean };
}) {
  const { t } = useTranslation();
  const text = row.text.trim();
  const accent = group && li ? accentOf(li) : undefined;
  const bubble = (
    <div className="of-bubble" data-sticker={row.sticker && !text ? "true" : undefined}>
      <span className="of-visually-hidden">
        {row.who === "li" ? t("ui.otomeForge.phone.from", { name }) : t("ui.otomeForge.phone.fromYou")}
      </span>
      {row.quote ? <q className="of-bubble-quote">{row.quote}</q> : null}
      {row.sticker ? (
        isFace(row.sticker) && li ? (
          <Sticker li={li} face={row.sticker} />
        ) : (
          <StickerArt stickers={stickers} id={row.sticker} />
        )
      ) : null}
      {text ? <span className="of-bubble-text">{row.text}</span> : null}
    </div>
  );
  return (
    <li
      className="of-bubble-row"
      data-who={row.who}
      data-group={group ? "true" : undefined}
      data-archived={row.archived ? "true" : undefined}
      data-pending={pending ? "true" : undefined}
      style={accent ? ({ "--of-li-accent": accent } as CSSProperties) : undefined}
    >
      {group?.first ? (
        <span className="of-bubble-name" aria-hidden="true">
          {name}
        </span>
      ) : null}
      {group ? (
        <div className="of-bubble-line">
          {group.last ? (
            <Avatar name={name} url={li?.portrait} accent={accent} size={24} />
          ) : (
            <span className="of-bubble-gap" aria-hidden="true" />
          )}
          {bubble}
        </div>
      ) : (
        bubble
      )}
      {time ? (
        <time className="of-bubble-time" dateTime={row.at}>
          {time}
        </time>
      ) : null}
    </li>
  );
}
