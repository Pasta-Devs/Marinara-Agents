import { AppScreenHeader } from "./AppScreenHeader";

const MOCK_CHATS = [
  { id: "1", name: "Marianna", preview: "Placeholder last message — not a real chat.", time: "2m" },
  { id: "2", name: "Study Group", preview: "Placeholder preview text goes here.", time: "1h" },
  { id: "3", name: "Chef Support", preview: "This is a mock conversation entry.", time: "3h" },
];

interface ChatsAppScreenProps {
  onBack: () => void;
}

export function ChatsAppScreen({ onBack }: ChatsAppScreenProps) {
  return (
    <div className="flex h-full flex-col">
      <AppScreenHeader title="Chats" onBack={onBack} />
      <div className="flex-1 divide-y divide-[var(--marinara-chat-chrome-panel-divider)] overflow-y-auto">
        {MOCK_CHATS.map((chat) => (
          <div key={chat.id} className="flex items-center gap-3 px-3 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)] text-xs font-semibold text-[var(--marinara-chat-chrome-highlight-text)]">
              {chat.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                <span className="truncate">{chat.name}</span>
                <span className="shrink-0 text-[0.625rem] font-normal text-[var(--marinara-chat-chrome-panel-muted)]">
                  {chat.time}
                </span>
              </div>
              <p className="truncate text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">{chat.preview}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
