import { AppScreenHeader } from "./AppScreenHeader";

const MOCK_THREAD = {
  root: {
    author: "pasta_official",
    body: "Ut enim ad minim veniam — placeholder root post for NoodleR.",
  },
  replies: [
    { id: "r1", author: "noodle_fan_42", body: "Quis nostrud exercitation ullamco — placeholder reply #1." },
    { id: "r2", author: "chef_marianna", body: "Duis aute irure dolor in reprehenderit — placeholder reply #2." },
  ],
};

interface NoodleRAppScreenProps {
  onBack: () => void;
}

export function NoodleRAppScreen({ onBack }: NoodleRAppScreenProps) {
  return (
    <div className="flex h-full flex-col">
      <AppScreenHeader title="NoodleR" onBack={onBack} />
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <div className="rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3">
          <div className="text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
            @{MOCK_THREAD.root.author}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">
            {MOCK_THREAD.root.body}
          </p>
        </div>
        <div className="ml-4 space-y-2 border-l-2 border-[var(--marinara-chat-chrome-panel-divider)] pl-3">
          {MOCK_THREAD.replies.map((reply) => (
            <div key={reply.id} className="rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] p-2.5">
              <div className="text-[0.625rem] font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                @{reply.author}
              </div>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">
                {reply.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
