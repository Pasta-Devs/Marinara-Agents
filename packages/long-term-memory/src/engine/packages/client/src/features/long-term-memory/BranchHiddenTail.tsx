import { useEffect, useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  branchHiddenTailPath,
  chatMemoriesQueryOptions,
  errorMessage,
  invalidateLtmQueries,
  queryKeys,
  request,
  requestHost,
} from "./api";
import { useLtmActivitySignal } from "./ActivityCard";
import { hiddenToastStep, isLtmCardOpen, ltmHiddenLine } from "./auto-import-status";
import { Button, ModalDialog, lockedActionProps } from "./shared-controls";
import { sourceCheckboxClass } from "./sources/source-shared";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";
import type { CapabilityProps } from "./types";

/**
 * On a branch, its latest copied messages its parent hid by hand: the AI reads neither them nor their memories.
 * `show` sends the Engine's own unhide, as `/unhide` does, so the shown messages stay the user's choice; it resolves
 * true once they are shown.
 */
export function useBranchHiddenTail(chatId: string | null | undefined) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const hiddenTail = useQuery({
    enabled: Boolean(chatId),
    queryKey: queryKeys.branchHiddenTail(chatId),
    queryFn: () => request<{ messageIds: string[] }>(branchHiddenTailPath(chatId!)),
  });
  const ids = chatId ? (hiddenTail.data?.messageIds ?? []) : [];
  const [showing, setShowing] = useState(false);
  const show = async () => {
    if (showing || !chatId || !ids.length) return false;
    setShowing(true);
    try {
      await requestHost(`/api/chats/${encodeURIComponent(chatId)}/messages/bulk-hidden`, "PATCH", {
        messageIds: ids,
        hidden: false,
      });
      // The Engine's message list for this chat, so the chat's eye icons follow.
      await invalidateLtmQueries(queryClient, [queryKeys.branchHiddenTail(chatId), ["chats", "messages", chatId]]);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat")));
      return false;
    } finally {
      setShowing(false);
    }
  };
  const line = ids.length
    ? localizeUi(
        selectLtmPluralForm(locale, ids.length) === "one"
          ? "ui.longTermMemory.chatsettings.branchHiddenTailOne"
          : "ui.longTermMemory.chatsettings.branchHiddenTailOther",
        { count: ids.length },
      )
    : "";
  return { ids, line, showing, show };
}

// "Don't show this again" is kept per browser; Chat Settings still offers the same button. Storage that is missing,
// blocked or throwing reads as not chosen and drops the write.
export const LTM_BRANCH_HIDDEN_TAIL_POPUP_KEY = "marinara-long-term-memory-branch-hidden-tail-popup";
const popupTurnedOff = () => {
  try {
    return globalThis.localStorage?.getItem(LTM_BRANCH_HIDDEN_TAIL_POPUP_KEY) === "off";
  } catch {
    return false;
  }
};
const turnPopupOff = () => {
  try {
    globalThis.localStorage?.setItem(LTM_BRANCH_HIDDEN_TAIL_POPUP_KEY, "off");
  } catch {
    // Not kept: the pop-up returns on the next branch.
  }
};
// Closed pop-ups stay closed for that chat until the page reloads.
const closedFor = new Set<string>();

// The newest hide each chat's toast has already dealt with (said, or seen while the card said it).
const hideSeen = new Map<string, string>();
const HIDE_POLL_MS = 10_000;

/**
 * Says once, in a toast, that an import saved messages as memories and hid them from the AI, when Chat Settings is
 * closed (open, its card says the same sentence, so a toast would repeat it). The first read of a chat only records
 * the hide it finds: an old one is not news. ponytail: polled every 10 s while the chat is open, so the toast can lag
 * the hide by that much; a host event instead of a poll would replace it. The Agent activity icon's signal reads this same poll.
 */
function useHiddenMessagesToast(chatId: string | null) {
  const { t: localizeUi } = useLtmTranslation();
  const memories = useQuery({ ...chatMemoriesQueryOptions(chatId), refetchInterval: HIDE_POLL_MS });
  const loaded = memories.data !== undefined;
  const hidden = memories.data?.hidden ?? null;
  useEffect(() => {
    if (!chatId || !loaded) return;
    const step = hiddenToastStep(hideSeen.get(chatId), hidden, isLtmCardOpen(chatId));
    hideSeen.set(chatId, step.seen);
    if (!step.say || !hidden) return;
    const [key, values] = ltmHiddenLine(hidden);
    toast(localizeUi(key, values));
  }, [chatId, loaded, hidden, localizeUi]);
}

/**
 * The chat's conversation surface (mounted only while Long-Term Memory is on for the chat): opening a branch whose
 * latest copied messages were hidden by hand asks once whether the AI should see them.
 */
export function BranchHiddenTailPopup({ props }: { props: CapabilityProps }) {
  const chatId = props.chatId ?? null;
  const [off, setOff] = useState(popupTurnedOff);
  const [, redraw] = useState(0);
  useHiddenMessagesToast(chatId);
  useLtmActivitySignal(props);
  const tail = useBranchHiddenTail(off || !chatId || closedFor.has(chatId) ? null : chatId);
  if (!chatId || !tail.ids.length) return null;
  return (
    <BranchHiddenTailDialog
      key={chatId}
      tail={tail}
      close={(dontShow) => {
        if (dontShow) {
          turnPopupOff();
          setOff(true);
        }
        closedFor.add(chatId);
        redraw((value) => value + 1);
      }}
    />
  );
}

function BranchHiddenTailDialog({
  tail,
  close,
}: {
  tail: ReturnType<typeof useBranchHiddenTail>;
  close: (dontShow: boolean) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const id = useId();
  const [dontShow, setDontShow] = useState(false);
  return (
    <ModalDialog
      titleId={`${id}-title`}
      descriptionId={`${id}-description`}
      initialFocus="[data-ltm-branch-hidden-tail-show]"
      onCancel={() => close(dontShow)}
      panelClassName="max-w-sm"
      data-ltm-branch-hidden-tail-popup
    >
      <h2 id={`${id}-title`} className="text-base font-semibold">
        {localizeUi("ui.longTermMemory.chatsettings.branchHiddenTailTitle")}
      </h2>
      <p id={`${id}-description`} className="text-sm text-[var(--muted-foreground)]">
        {tail.line}
      </p>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className={sourceCheckboxClass}
          checked={dontShow}
          data-ltm-branch-hidden-tail-dont-show
          onChange={(event) => setDontShow(event.currentTarget.checked)}
        />
        <span>{localizeUi("ui.longTermMemory.chatsettings.branchHiddenTailDontShow")}</span>
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <Button data-ltm-branch-hidden-tail-later onClick={() => close(dontShow)}>
          {localizeUi("ui.longTermMemory.chatsettings.branchHiddenTailLater")}
        </Button>
        <Button
          data-ltm-branch-hidden-tail-show
          primary
          {...lockedActionProps(tail.showing)}
          onClick={async () => {
            if (await tail.show()) close(dontShow);
          }}
        >
          {localizeUi("ui.longTermMemory.chatsettings.branchHiddenTailShow")}
        </Button>
      </div>
    </ModalDialog>
  );
}
