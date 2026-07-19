import { ArrowLeft } from "lucide-react";

interface AppScreenHeaderProps {
  title: string;
  onBack: () => void;
}

export function AppScreenHeader({ title, onBack }: AppScreenHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2.5">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to home"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-highlight-text)]"
      >
        <ArrowLeft size="1rem" />
      </button>
      <h3 className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">{title}</h3>
    </div>
  );
}
