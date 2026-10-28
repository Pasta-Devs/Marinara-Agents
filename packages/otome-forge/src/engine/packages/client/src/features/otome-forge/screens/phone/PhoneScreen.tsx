// ──────────────────────────────────────────────
// Otome Forge: the phone. One private thread per love interest: what is said there only he knows. The list opens a
// thread; Reply on Home's note opens his thread straight away with the note quoted.
// ──────────────────────────────────────────────
// Routes (S/routes/phone.ts): GET /runs/:run/phone → PhoneListView; GET .../phone/:li?page= → PhoneHistoryPage (the
// kit's forgeChatHistoryPage, page 1 newest); POST .../phone/:li/send {text?, quote?, sticker?, id?, retry?} →
// PhoneSendResult (409 busy while his reply or a close is being written); POST .../close → PhoneCloseResult;
// POST .../seen {last?} → {}.
import { useEffect, useRef, useState } from "react";
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
export const threadQueryKey = (runKey: string, li: LiId) => ["otome-forge", "thread", runKey, li] as const;
export const phonePath = (runKey: string, li?: LiId) =>
  li ? `${runPath(runKey)}/phone/${encodeURIComponent(li)}` : `${runPath(runKey)}/phone`;

interface PhoneScreenProps {
  runKey: string;
  view: RunView;
  /** Opens this thread at once (Home's Reply); null opens the thread list. */
  initial: PhoneOpen | null;
}

export function PhoneScreen({ runKey, view, initial }: PhoneScreenProps) {
  const [open, setOpen] = useState<PhoneOpen | null>(() =>
    initial && view.lis.some((li) => li.id === initial.li) ? initial : null,
  );
  // Focus follows the player inside the phone: into a thread they opened here, back to its row when they leave it.
  const openedHere = useRef(false);
  const returnTo = useRef<LiId | null>(null);
  const rows = useRef(new Map<LiId, HTMLButtonElement | null>());
  useEffect(() => {
    if (open || !returnTo.current) return;
    rows.current.get(returnTo.current)?.focus({ preventScroll: true });
    returnTo.current = null;
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
          setOpen(null);
        }}
      />
    );
  }
  return (
    <ThreadList
      runKey={runKey}
      view={view}
      rowRef={(id, element) => rows.current.set(id, element)}
      onOpen={(id) => {
        openedHere.current = true;
        setOpen({ li: id });
      }}
    />
  );
}
