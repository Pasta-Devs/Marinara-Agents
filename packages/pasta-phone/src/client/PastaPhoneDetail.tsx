// ──────────────────────────────────────────────
// Pasta Phone — agent detail view
//
// This is the package's real mount point. The Engine renders view="detail" for
// any package whose manifest lists the agent under contributions.agentDetail,
// which is the only capability surface the client dispatches generically —
// contributions.slots is declared by manifests but never read, so the
// conversation-toolbar trigger does not mount on its own.
//
// Group management here is UI only, against the in-memory store in groups.ts.
// ──────────────────────────────────────────────
import { useState } from "react";
import { Smartphone } from "lucide-react";
import {
  addChatToGroup,
  CANDIDATE_CHATS,
  createGroup,
  removeChatFromGroup,
  useGroupForChat,
  usePhoneGroups,
  type PhoneChat,
  type PhoneChatMode,
} from "./groups";
import { PASTA_PHONE_STYLES } from "./styles";
import { PastaPhoneSheet } from "./PastaPhoneSheet";

interface PastaPhoneDetailProps {
  chatId: string | null;
  chatName: string | null;
  chatMode: string | null;
}

function asMode(mode: string | null): PhoneChatMode {
  return mode === "roleplay" || mode === "game" ? mode : "conversation";
}

export function PastaPhoneDetail({ chatId, chatName, chatMode }: PastaPhoneDetailProps) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<"existing" | "add" | null>(null);
  const groups = usePhoneGroups();
  const group = useGroupForChat(chatId);

  const currentChat: PhoneChat | null = chatId
    ? { id: chatId, name: chatName?.trim() || "This chat", mode: asMode(chatMode) }
    : null;

  const available = CANDIDATE_CHATS.filter(
    (candidate) => candidate.id !== chatId && !group?.chats.some((member) => member.id === candidate.id),
  );

  return (
    <div data-pasta-phone-detail>
      <style data-pasta-phone-styles>{PASTA_PHONE_STYLES}</style>

      <p data-pasta-phone-note>
        Preview build — group membership is in-memory only and resets on reload. Noodle, NoodleR, and
        App Store are still placeholder screens.
      </p>

      {!currentChat ? (
        <p data-pasta-phone-detail-empty>Open a chat to manage its Pasta Phone group.</p>
      ) : group ? (
        <section data-pasta-phone-detail-section>
          <p data-pasta-phone-store-heading>{group.name}</p>
          <p data-pasta-phone-detail-hint>
            {group.chats.length} {group.chats.length === 1 ? "chat" : "chats"} share this phone.
          </p>

          <div data-pasta-phone-detail-actions>
            <button
              type="button"
              data-pasta-phone-button
              disabled={available.length === 0}
              onClick={() => setPicking(picking === "add" ? null : "add")}
            >
              Add another chat
            </button>
            <button
              type="button"
              data-pasta-phone-button="danger"
              onClick={() => removeChatFromGroup(group.id, currentChat.id)}
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
                    onClick={() => {
                      addChatToGroup(group.id, candidate);
                      setPicking(null);
                    }}
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
              onClick={() => createGroup(`${currentChat.name} group`, currentChat)}
            >
              Create a new group
            </button>
            <button
              type="button"
              data-pasta-phone-button
              disabled={groups.length === 0}
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
                    onClick={() => {
                      addChatToGroup(candidate.id, currentChat);
                      setPicking(null);
                    }}
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
