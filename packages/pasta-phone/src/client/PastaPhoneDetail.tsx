// ──────────────────────────────────────────────
// Pasta Phone — agent detail view
//
// This is the package's real mount point. The Engine renders view="detail" for
// any package whose manifest lists the agent under contributions.agentDetail,
// which is the only capability surface the client dispatches generically —
// contributions.slots is declared by manifests but never read, so the
// conversation-toolbar trigger does not mount on its own.
// ──────────────────────────────────────────────
import { useState } from "react";
import { Smartphone } from "lucide-react";
import {
  addChatToGroup,
  createGroup,
  removeChatFromGroup,
  useGroupForChat,
  usePhoneGroups,
  usePhoneState,
} from "./groups";
import { PASTA_PHONE_STYLES } from "./styles";
import { PastaPhoneSheet } from "./PastaPhoneSheet";

interface PastaPhoneDetailProps {
  chatId: string | null;
  chatName: string | null;
}

export function PastaPhoneDetail({ chatId, chatName }: PastaPhoneDetailProps) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<"existing" | "add" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { status, error, chats } = usePhoneState();
  const groups = usePhoneGroups();
  const group = useGroupForChat(chatId);

  // Every mutation refetches, so the UI can never drift from what was stored.
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await operation();
      setPicking(null);
    } catch (problem) {
      setActionError(problem instanceof Error ? problem.message : "That did not work");
    } finally {
      setBusy(false);
    }
  };

  const available = chats.filter(
    (candidate) => candidate.id !== chatId && !group?.chats.some((member) => member.id === candidate.id),
  );

  return (
    <div data-pasta-phone-detail>
      <style data-pasta-phone-styles>{PASTA_PHONE_STYLES}</style>

      <p data-pasta-phone-note>
        Noodle, NoodleR, and App Store are still placeholder screens. Chats and group membership are real.
      </p>

      {status === "error" ? <p data-pasta-phone-error>{error}</p> : null}
      {actionError ? <p data-pasta-phone-error>{actionError}</p> : null}

      {!chatId ? (
        <p data-pasta-phone-detail-empty>Open a chat to manage its Pasta Phone group.</p>
      ) : status === "loading" ? (
        <p data-pasta-phone-detail-empty>Loading groups…</p>
      ) : group ? (
        <section data-pasta-phone-detail-section>
          <p data-pasta-phone-store-heading>{group.name}</p>
          <p data-pasta-phone-detail-hint>
            {group.chats.length === 1 ? "1 chat shares" : `${group.chats.length} chats share`} this phone.
          </p>

          <div data-pasta-phone-detail-actions>
            <button
              type="button"
              data-pasta-phone-button
              disabled={busy || available.length === 0}
              onClick={() => setPicking(picking === "add" ? null : "add")}
            >
              Add another chat
            </button>
            <button
              type="button"
              data-pasta-phone-button="danger"
              disabled={busy}
              onClick={() => void run(() => removeChatFromGroup(group.id, chatId))}
            >
              Remove this chat
            </button>
          </div>

          {picking === "add" ? (
            <ul data-pasta-phone-picker>
              {available.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => addChatToGroup(group.id, candidate.id))}
                  >
                    <span>{candidate.name}</span>
                    <span data-pasta-phone-mode>{candidate.mode}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <section data-pasta-phone-detail-section>
          <p data-pasta-phone-detail-hint>This chat is not part of a Pasta Phone group yet.</p>
          <div data-pasta-phone-detail-actions>
            <button
              type="button"
              data-pasta-phone-button="primary"
              disabled={busy}
              onClick={() => void run(() => createGroup(`${chatName?.trim() || "New"} group`, chatId))}
            >
              Create a new group
            </button>
            <button
              type="button"
              data-pasta-phone-button
              disabled={busy || groups.length === 0}
              onClick={() => setPicking(picking === "existing" ? null : "existing")}
            >
              Add to existing group
            </button>
          </div>

          {picking === "existing" ? (
            <ul data-pasta-phone-picker>
              {groups.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => addChatToGroup(candidate.id, chatId))}
                  >
                    <span>{candidate.name}</span>
                    <span data-pasta-phone-mode>
                      {candidate.chats.length} {candidate.chats.length === 1 ? "chat" : "chats"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}

      <button type="button" data-pasta-phone-button="primary" onClick={() => setOpen(true)}>
        <Smartphone size="0.875rem" /> Open Pasta Phone
      </button>

      <PastaPhoneSheet open={open} onClose={() => setOpen(false)} chatId={chatId} />
    </div>
  );
}
