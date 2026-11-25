// ──────────────────────────────────────────────
// Otome Forge: Close and remember, labelled just "Close" so it fits beside his name on one row at any phone width; its
// accessible name and tooltip still say "Close and remember". The open conversation becomes a memory only this love
// interest can recall (a chat source with audience [li]), the next message starts a new one, and closing grants a
// little affection (capped per day). One close at a time: the confirm button is inert while it is sent, and the
// trigger while a reply is on its way, the conversation is being remembered or nothing is open to remember, its
// tooltip and description saying which. The server holds one send or close per thread (409 busy), and a close sent
// again after it landed gets the same memory and earns nothing. In the group chat (#2154) the memory is everyone's in
// it, and it earns nothing.
// 0.46.3: the server answers once the close is accepted and writes the memory in the background, so the thread goes
// back to Messages at once (onClosed). closeSent remembers the closes this page sent, so the list can say once what
// each earned when it lands (ThreadList); CloseRetry is Try again for a close that failed, in the list and the thread.
// ──────────────────────────────────────────────
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { BookHeart, RotateCcw } from "lucide-react";
import { forgeStepErrorKey, useOtomeApi } from "../../api";
import { Dialog } from "../../components/Dialog";
import type { LiId, PhoneCloseResult, PhoneListView } from "../../shared/api-types";
import { GROUP_THREAD } from "../../shared/home";
import { phonePath, phoneQueryKey, threadQueryKey } from "./PhoneScreen";

/** The closes this page sent and is waiting on, by `${runKey} ${thread}`: the start of the session each will add. */
export const sentCloses = new Map<string, number>();
export const closeKey = (runKey: string, id: LiId) => `${runKey} ${id}`;

/** After an accepted close: waits for it, shows the list's row remembering at once, and reads the list and thread. */
export function closeSent(queryClient: QueryClient, runKey: string, id: LiId, result: PhoneCloseResult) {
  if ("remembering" in result) {
    sentCloses.set(closeKey(runKey, id), result.start);
    queryClient.setQueryData<PhoneListView>(phoneQueryKey(runKey), (list) =>
      list
        ? {
            ...list,
            threads: list.threads.map((row) => (row.li === id ? { ...row, closing: {} } : row)),
            group: list.group && id === GROUP_THREAD ? { ...list.group, closing: {} } : list.group,
          }
        : list,
    );
  }
  void queryClient.invalidateQueries({ queryKey: phoneQueryKey(runKey) });
  void queryClient.invalidateQueries({ queryKey: threadQueryKey(runKey, id) });
}

interface CloseAndRememberProps {
  /** The thread's path (PhoneScreen phonePath). */
  path: string;
  /** What the dialog says becomes of the conversation, and why the trigger waits while a reply is on its way. */
  text: string;
  waitText: string;
  /**
   * Why it is inert: a reply is still on its way (`waiting`), the conversation is being remembered (`remembering`), or
   * there is no open conversation (`empty`).
   */
  blocked: "waiting" | "remembering" | "empty" | null;
  onClosed: (result: PhoneCloseResult) => void;
}

export function CloseAndRemember({ path, text, waitText, blocked, onClosed }: CloseAndRememberProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const [asking, setAsking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = t("ui.otomeForge.phone.closeRemember");
  const reasonId = useId();
  const reason =
    blocked === "waiting"
      ? waitText
      : blocked === "remembering"
        ? t("ui.otomeForge.phone.closeRemembering")
        : blocked === "empty"
          ? t("ui.otomeForge.phone.closeNothing")
          : null;

  const close = async () => {
    if (closing) return;
    setClosing(true);
    setError(null);
    try {
      const result = await otome.post<PhoneCloseResult>(`${path}/close`);
      setAsking(false);
      onClosed(result);
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setClosing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="of-button of-button--quiet of-button--small of-glass of-thread-close"
        aria-disabled={!!blocked}
        aria-label={label}
        aria-describedby={reason ? reasonId : undefined}
        title={reason ?? label}
        onClick={() => {
          if (blocked) return;
          // A new dialog starts clean: the last attempt's failure is not news.
          setError(null);
          setAsking(true);
        }}
      >
        <BookHeart size={15} strokeWidth={2} aria-hidden="true" />
        <span>{t("ui.otomeForge.phone.close")}</span>
      </button>
      {reason ? (
        <span id={reasonId} className="of-visually-hidden">
          {reason}
        </span>
      ) : null}
      {asking ? (
        <Dialog
          title={t("ui.otomeForge.phone.closeTitle")}
          onClose={closing ? undefined : () => setAsking(false)}
          actions={
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-button--small of-glass"
                aria-disabled={closing}
                onClick={() => !closing && setAsking(false)}
              >
                {t("ui.otomeForge.phone.closeCancel")}
              </button>
              <button
                type="button"
                className="of-button of-button--primary of-button--small"
                aria-disabled={closing}
                onClick={() => void close()}
              >
                <BookHeart size={15} strokeWidth={2} aria-hidden="true" />
                {closing ? t("ui.otomeForge.phone.closing") : t("ui.otomeForge.phone.closeConfirm")}
              </button>
            </>
          }
        >
          <p className="of-body">{text}</p>
          {error ? (
            <p className="of-notice of-notice--error" role="alert">
              {error}
            </p>
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}

/** 0.46.3: a close that failed in the background, why (its stored code), and Try again, which closes it again. */
export function CloseRetry({ runKey, id, error }: { runKey: string; id: LiId; error: string }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      closeSent(queryClient, runKey, id, await otome.post<PhoneCloseResult>(`${phonePath(runKey, id)}/close`));
    } catch (problem) {
      setFailure(otome.errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="of-notice of-notice--error of-reader-notice" role="alert">
      <span>{t("ui.otomeForge.phone.closeFailed", { reason: failure ?? t(forgeStepErrorKey(error)) })}</span>
      <button type="button" className="of-button of-button--text" aria-disabled={busy} onClick={() => void retry()}>
        <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
        {t("ui.otomeForge.common.retry")}
      </button>
    </div>
  );
}
