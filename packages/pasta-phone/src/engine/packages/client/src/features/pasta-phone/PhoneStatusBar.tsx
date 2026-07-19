import { useEffect, useState } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function PhoneStatusBar() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-2 text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
      <span>{formatTime(now)}</span>
      <div className="flex items-center gap-1.5 text-[var(--marinara-chat-chrome-panel-muted)]">
        <Signal size="0.8rem" />
        <Wifi size="0.8rem" />
        <BatteryFull size="0.9rem" />
      </div>
    </div>
  );
}
