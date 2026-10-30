// ──────────────────────────────────────────────
// Otome Forge: the phone. One private thread per love interest: what is said there only he knows. The list opens a
// thread; Reply on Home's note opens his thread straight away with the note quoted. The open thread and its waiting
// quote are kept by the view (OtomeForgeView), so the phone opened again after Settings is where the player left it.
// ──────────────────────────────────────────────
// Routes (S/routes/phone.ts): GET /runs/:run/phone → PhoneListView; GET .../phone/:li?page= → PhoneHistoryPage (the
// kit's forgeChatHistoryPage, page 1 newest); POST .../phone/:li/send {text?, quote?, sticker?, id?, retry?} →
// PhoneSendResult (409 busy while his reply or a close is being written); POST .../close → PhoneCloseResult;
// POST .../seen {last?} → {}.
import { useEffect, useRef } from "react";
import { runPath } from "../../hooks/use-reader";
import type { LiId, RunView } from "../../shared/api-types";
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

interface PhoneScreenProps {
  runKey: string;
  view: RunView;
  /** The thread shown (Home's Reply opens one with the note quoted); null, or one not in the cast, shows the list. */
  open: PhoneOpen | null;
  onOpenChange: (open: PhoneOpen | null) => void;
}

export function PhoneScreen({ runKey, view, open, onOpenChange }: PhoneScreenProps) {
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
