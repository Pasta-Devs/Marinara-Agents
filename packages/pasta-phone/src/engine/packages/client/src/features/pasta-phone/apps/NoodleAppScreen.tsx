import { AppScreenHeader } from "./AppScreenHeader";

const MOCK_POSTS = [
  {
    id: "1",
    author: "pasta_official",
    body: "Lorem ipsum dolor sit amet — this is placeholder Noodle content, not final copy.",
    time: "2h",
  },
  {
    id: "2",
    author: "noodle_fan_42",
    body: "Consectetur adipiscing elit. Real feed data is not wired up yet.",
    time: "5h",
  },
  {
    id: "3",
    author: "chef_marianna",
    body: "Sed do eiusmod tempor incididunt ut labore — placeholder post #3.",
    time: "1d",
  },
];

interface NoodleAppScreenProps {
  onBack: () => void;
}

export function NoodleAppScreen({ onBack }: NoodleAppScreenProps) {
  return (
    <div className="flex h-full flex-col">
      <AppScreenHeader title="Noodle" onBack={onBack} />
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {MOCK_POSTS.map((post) => (
          <div
            key={post.id}
            className="rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3"
          >
            <div className="flex items-center justify-between text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
              <span>@{post.author}</span>
              <span className="font-normal text-[var(--marinara-chat-chrome-panel-muted)]">{post.time}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">{post.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
