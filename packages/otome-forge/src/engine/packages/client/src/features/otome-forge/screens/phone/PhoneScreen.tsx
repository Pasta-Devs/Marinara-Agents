// ──────────────────────────────────────────────
// Otome Forge: the phone. One private thread per love interest: what is said there only he knows. The list opens a
// thread; Reply on Home's note opens his thread straight away with the note quoted. The open thread and its waiting
// quote are kept by the view (OtomeForgeView), so the phone opened again after Settings is where the player left it.
// ──────────────────────────────────────────────
// Routes (S/routes/phone.ts): GET /runs/:run/phone → PhoneListView; GET .../phone/:li?page= → PhoneHistoryPage (the
// kit's forgeChatHistoryPage, page 1 newest); POST .../phone/:li/send {text?, quote?, sticker?, id?, retry?} →
// PhoneSendResult (409 busy while his reply or a close is being written); POST .../close → PhoneCloseResult;
// POST .../seen {last?} → {}; POST /runs/:run/phone/due {open?} → PhoneDueResult (useDailyMessages, #2044).
// #2044: the first time the phone opens with images on, POST /runs/:run/stickers starts the protagonist's five chibi
// stickers (S/art/stickers.ts), and the run view is read again so it polls until they land.
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOtomeApi } from "../../api";
import { imagesOn } from "../../hooks/use-items";
import { runPath } from "../../hooks/use-reader";
import { runQueryKey } from "../../hooks/use-run";
import type { LiId, PhoneDueResult, RunView } from "../../shared/api-types";
import { homeQueryKey } from "../home/HomeScreen";
import { Thread } from "./Thread";
import { ThreadList } from "./ThreadList";

/** Which thread to open, and the note to quote in the first reply. */
export interface PhoneOpen {
  li: LiId;
  quote?: string;
}

export const phoneQueryKey = (runKey: string) => ["otome-forge", "phone", runKey] as const;
/** While his reply or a memory is being written (`busy`), the thread and the list ask again this often. */
export const BUSY_POLL_MS = 2_000;
export const threadQueryKey = (runKey: string, li: LiId) => ["otome-forge", "thread", runKey, li] as const;
export const phonePath = (runKey: string, li?: LiId) =>
  li ? `${runPath(runKey)}/phone/${encodeURIComponent(li)}` : `${runPath(runKey)}/phone`;
/** How often the open app asks whether a love interest writes first (GF's heartbeat; the server spaces the messages). */
export const DAILY_POLL_MS = 60_000;
/** Each run's newest daily message as this page last heard it, kept across remounts and restarts of the heartbeat. */
const heardDaily = new Map<string, string | null>();

/**
 * Settings → Connections' daily messages (S/phone/daily.ts): while the story is forged, its daily number is above 0
 * and the page is visible, asks POST .../phone/due every minute (the first a minute after it starts), naming the thread
 * the player has open, which never gets one. When a new daily message has landed, the thread list, Home's unread count
 * and his thread are read again, so it shows unread like a reply that landed after she left. A message is new when it
 * differs from the newest this page heard (heardDaily), so a remount or a restart (a language or debug change) reads
 * nothing again for one it already heard.
 * ponytail: the first answer since the page loaded only sets that mark, as the screens read fresh when they mounted; a
 * message landing in the minute before that answer (a job queued before a reload) shows the next time Home, the list
 * or his thread opens. Upgrade path: the run view names the newest daily message, and the mark starts from it.
 */
export function useDailyMessages(runKey: string | null, view: RunView | null, open: LiId | null) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const openRef = useRef(open);
  openRef.current = open;
  const on = !!runKey && view?.forge.phase === "ready" && (view.world.dailyMessages ?? 0) > 0;
  useEffect(() => {
    if (!on || !runKey) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const due = await otome.post<PhoneDueResult>(`${phonePath(runKey)}/due`, { open: openRef.current });
          const key = due.latest ? `${due.latest.li} ${due.latest.at}` : null;
          const heard = heardDaily.get(runKey);
          if (!stopped) heardDaily.set(runKey, key);
          if (!stopped && due.latest && heard !== undefined && key !== heard) {
            void queryClient.invalidateQueries({ queryKey: phoneQueryKey(runKey) });
            void queryClient.invalidateQueries({ queryKey: homeQueryKey(runKey) });
            void queryClient.invalidateQueries({ queryKey: threadQueryKey(runKey, due.latest.li) });
          }
        } catch {
          // The server spends an attempt before any work, so a failed heartbeat simply waits for the next one.
        }
      }
      if (!stopped) timer = setTimeout(() => void poll(), DAILY_POLL_MS);
    };
    timer = setTimeout(() => void poll(), DAILY_POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [on, otome, queryClient, runKey]);
}

interface PhoneScreenProps {
  runKey: string;
  view: RunView;
  /** The thread shown (Home's Reply opens one with the note quoted); null, or one not in the cast, shows the list. */
  open: PhoneOpen | null;
  onOpenChange: (open: PhoneOpen | null) => void;
}

/** Starts the protagonist's stickers once, the first time the phone opens with images on (#2044). */
function useStartStickers(runKey: string, view: RunView) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const asked = useRef<string | null>(null);
  const due = imagesOn(view) && !view.player.stickers && view.forge.phase === "ready";
  useEffect(() => {
    if (!due || asked.current === runKey) return;
    asked.current = runKey;
    otome
      .post<{ started: boolean }>(`${runPath(runKey)}/stickers`)
      .then(({ started }) => {
        if (started) void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      })
      .catch((failure: unknown) => console.warn("Otome Forge could not start the protagonist's stickers", failure));
  }, [due, otome, queryClient, runKey]);
}

export function PhoneScreen({ runKey, view, open, onOpenChange }: PhoneScreenProps) {
  useStartStickers(runKey, view);
  // Focus follows the player inside the phone: into a thread they opened here, back to its row when they leave it.
  // A thread opened from Home's Reply leaves for a list read for the first time, whose rows come after it loads: the
  // list's heading holds focus meanwhile, and the row takes it as it is drawn.
  const openedHere = useRef(false);
  const returnTo = useRef<LiId | null>(null);
  const rows = useRef(new Map<LiId, HTMLButtonElement | null>());
  const heading = useRef<HTMLHeadingElement>(null);
  const focusRow = (id: LiId, element: HTMLButtonElement | null) => {
    if (!element || returnTo.current !== id) return;
    returnTo.current = null;
    // Never away from wherever the player has moved meanwhile.
    const active = document.activeElement;
    if (!active || active === document.body || active === heading.current) element.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (open || !returnTo.current) return;
    const row = rows.current.get(returnTo.current);
    if (row) {
      row.focus({ preventScroll: true });
      returnTo.current = null;
    } else heading.current?.focus({ preventScroll: true });
  }, [open]);

  const li = open ? (view.lis.find((item) => item.id === open.li) ?? null) : null;
  if (open && li) {
    return (
      <Thread
        key={li.id}
        runKey={runKey}
        view={view}
        li={li}
        quote={open.quote}
        focusHeading={openedHere.current}
        onBack={() => {
          returnTo.current = li.id;
          onOpenChange(null);
        }}
        onQuoteChange={(quote) => {
          if ((open.quote?.trim() || null) !== quote) onOpenChange({ li: li.id, ...(quote ? { quote } : {}) });
        }}
      />
    );
  }
  return (
    <ThreadList
      runKey={runKey}
      view={view}
      headingRef={heading}
      rowRef={(id, element) => {
        rows.current.set(id, element);
        focusRow(id, element);
      }}
      onOpen={(id) => {
        openedHere.current = true;
        onOpenChange({ li: id });
      }}
    />
  );
}
