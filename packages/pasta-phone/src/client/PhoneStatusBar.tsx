// ──────────────────────────────────────────────
// Pasta Phone — diegetic status bar
// Fake phone chrome, not real OS data. The clock is
// the only live value; signal/battery are decoration.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";

export function PhoneStatusBar() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div data-pasta-phone-status>
      <span>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      <div data-pasta-phone-status-icons aria-hidden>
        <Signal size="0.8rem" />
        <Wifi size="0.8rem" />
        <BatteryFull size="0.9rem" />
      </div>
    </div>
  );
}
