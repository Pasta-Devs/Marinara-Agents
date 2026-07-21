// ──────────────────────────────────────────────
// Pasta Phone — home screen launcher
// Four apps, each with its own glyph and accent so
// they read as distinct without real branding work.
// ──────────────────────────────────────────────
import type { ComponentType } from "react";
import { MessageCircle, Rss, Store, Waypoints } from "lucide-react";

export type PastaPhoneAppId = "noodle" | "noodler" | "chats" | "app-store";

interface PhoneApp {
  id: PastaPhoneAppId;
  label: string;
  icon: ComponentType<{ size?: string | number }>;
  accent: string;
}

export const PHONE_APPS: PhoneApp[] = [
  { id: "noodle", label: "Noodle", icon: Rss, accent: "#e0523f" },
  { id: "noodler", label: "NoodleR", icon: Waypoints, accent: "#4f7bd8" },
  { id: "chats", label: "Chats", icon: MessageCircle, accent: "#1f9d68" },
  { id: "app-store", label: "App Store", icon: Store, accent: "#8b5cf6" },
];

interface PhoneLauncherProps {
  onOpenApp: (id: PastaPhoneAppId) => void;
}

export function PhoneLauncher({ onOpenApp }: PhoneLauncherProps) {
  return (
    <div data-pasta-phone-launcher>
      <h2>Pasta Phone</h2>
      <p>Preview build — every screen here is placeholder content.</p>

      <div data-pasta-phone-grid>
        {PHONE_APPS.map(({ id, label, icon: Icon, accent }) => (
          <button key={id} type="button" data-pasta-phone-app onClick={() => onOpenApp(id)}>
            <span data-pasta-phone-app-tile aria-hidden style={{ backgroundColor: accent }}>
              <Icon size="1.5rem" />
            </span>
            <span data-pasta-phone-app-label>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
