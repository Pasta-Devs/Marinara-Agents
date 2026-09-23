import { useMemo, useState } from "react";
import { MessageSquarePlus, Search } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { Modal } from "../../../components/ui/Modal";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { useSlurpComposeTargets, useSlurpThreads } from "./slp-messages-hooks";
import { useShareSlpPost } from "../../modules/post/slp-post-action-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateSlurpMessages } from "./slp-message-keys";
import type { SlpPostCardModel } from "../../modules/post/SlpPostTypes";

/**
 * Pick the chat a post is shared into.
 *
 * Share used to send the post straight back to its own author, which is the one chat the reader
 * never means. The targets and the open threads both already have hooks, so this only decides
 * which of them to show: chats the persona already has, or — behind "New chat" — everyone the
 * persona may write to.
 */
export function SlpSharePostModal({
  post,
  personaId,
  open,
  onClose,
}: {
  post: SlpPostCardModel | null;
  personaId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [search, setSearch] = useState("");
  const [newChat, setNewChat] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const sharePost = useShareSlpPost();
  const queryClient = useQueryClient();
  const targets = useSlurpComposeTargets(personaId, open);
  const threads = useSlurpThreads(open ? personaId : null);

  const openCreatorIds = useMemo(
    () => new Set((threads.data?.threads ?? []).map((thread) => thread.creatorAccountId)),
    [threads.data],
  );
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (targets.data?.targets ?? [])
      .filter((target) => target.kind === "creator")
      .filter((target) => newChat || openCreatorIds.has(target.id))
      .filter(
        (target) =>
          !term || target.displayName.toLowerCase().includes(term) || target.handle.toLowerCase().includes(term),
      );
  }, [targets.data, newChat, openCreatorIds, search]);

  const share = (creatorAccountId: string) => {
    if (!personaId || !post) return;
    setSendingId(creatorAccountId);
    void sharePost
      .mutateAsync({ personaId, creatorAccountId, postId: post.id })
      .then(() => {
        // The shared card, and any thread it opened, show at once instead of on the next poll.
        void invalidateSlurpMessages(queryClient);
        toast.success(localizeUi("ui.slurp.post.shared", { defaultValue: "Post shared." }));
        onClose();
      })
      .catch((error: unknown) =>
        toast.error(
          errorMessage(error, localizeUi("ui.slurp.post.shareFailed", { defaultValue: "Could not share the post." })),
        ),
      )
      .finally(() => {
        void invalidateSlurpMessages(queryClient);
        setSendingId(null);
      });
  };

  return (
    <Modal open={open} onClose={onClose} title={localizeUi("ui.slurp.post.share", { defaultValue: "Share post" })}>
      <div className="space-y-3 p-4">
        <label className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--slurp-surface)] px-3 ring-1 ring-inset ring-[var(--noodle-divider)]">
          <Search size={14} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localizeUi("ui.slurp.post.shareSearch", { defaultValue: "Search chats" })}
            aria-label={localizeUi("ui.slurp.post.shareSearch", { defaultValue: "Search chats" })}
            className="h-9 w-full bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="button"
          aria-pressed={newChat}
          onClick={() => setNewChat((value) => !value)}
          className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-start text-sm font-semibold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 hover:bg-[var(--noodle-accent)]/10"
        >
          <MessageSquarePlus size={16} aria-hidden="true" />
          {newChat
            ? localizeUi("ui.slurp.post.shareExistingChats", { defaultValue: "Your chats" })
            : localizeUi("ui.slurp.post.shareNewChat", { defaultValue: "New chat" })}
        </button>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {rows.map((target) => (
            <li key={target.id}>
              <button
                type="button"
                disabled={sendingId !== null}
                onClick={() => share(target.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-start hover:bg-[var(--accent)] disabled:opacity-50"
              >
                {target.avatarUrl ? (
                  <img src={target.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="h-8 w-8 rounded-full bg-[var(--slurp-surface-raised)]" aria-hidden="true" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{target.displayName}</span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">@{target.handle}</span>
                </span>
              </button>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
              {newChat
                ? localizeUi("ui.slurp.post.shareNoCreators", { defaultValue: "No Creator matches that search." })
                : localizeUi("ui.slurp.post.shareNoChats", {
                    defaultValue: "No open chats yet. Use New chat to start one.",
                  })}
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
