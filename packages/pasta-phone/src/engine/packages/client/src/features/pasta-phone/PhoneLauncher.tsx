import type { ComponentType } from "react";
import { MessageCircle, Rss, Sparkles, Store } from "lucide-react";

export type PastaPhoneAppId = "noodle" | "noodler" | "chats" | "appstore";

interface PhoneApp {
  id: PastaPhoneAppId;
  label: string;
  icon: ComponentType<{ size?: string | number }>;
  accent: string;
}

const APPS: PhoneApp[] = [
  { id: "noodle", label: "Noodle", icon: Rss, accent: "#f97362" },
  { id: "noodler", label: "NoodleR", icon: Sparkles, accent: "#7c9cf9" },
  { id: "chats", label: "Chats", icon: MessageCircle, accent: "#3ecf8e" },
  { id: "appstore", label: "App Store", icon: Store, accent: "#c084fc" },
];

interface PhoneLauncherProps {
  onOpenApp: (id: PastaPhoneAppId) => void;
}

export function PhoneLauncher({ onOpenApp }: PhoneLauncherProps) {
  return (
    <div className="flex h-full flex-col gap-8 px-6 py-8">
      <div>
        <h2 className="text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">Pasta Phone</h2>
        <p className="mt-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
          Preview build — every screen here is placeholder content.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-6 place-items-center">
        {APPS.map(({ id, label, icon: Icon, accent }) => (
          <button
            key={id}
            type="button"
            onClick={() => onOpenApp(id)}
            className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-highlight-bg-hover)]"
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md"
              style={{ backgroundColor: accent }}
            >
              <Icon size="1.5rem" />
            </span>
            <span className="text-[0.6875rem] font-medium text-[var(--marinara-chat-chrome-panel-text)]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
