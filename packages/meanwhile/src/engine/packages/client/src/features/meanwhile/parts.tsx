import React from "react";

// Small shared pieces for the Meanwhile view and the Home widget.

const ICONS: Record<string, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  more: <path d="M12 5h.01M12 12h.01M12 19h.01" strokeWidth={3} />,
  forward: <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />,
  back: <path d="m15 18-6-6 6-6" />,
  paper: (
    <>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
    </>
  ),
};

export function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function hueOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

/** A character picture, or initials on a gradient picked from the id. */
export function Avatar({
  id,
  name,
  url,
  size = 40,
  ring = false,
  status,
}: {
  id: string;
  name: string;
  url?: string;
  size?: number;
  ring?: boolean;
  status?: "online" | "busy" | "offline";
}) {
  const hue = hueOf(id);
  const [broken, setBroken] = React.useState(false);
  const showImage = url && !broken;
  return (
    <span
      className={`mw-av${ring ? " mw-av-ring" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: showImage
          ? undefined
          : `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 50% 30%))`,
      }}
    >
      {showImage ? (
        <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        (name.trim()[0] ?? "?").toUpperCase()
      )}
      {status ? <i className={`mw-dot mw-dot-${status}`} /> : null}
    </span>
  );
}

const DAY = 86_400_000;
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`);

function partOfDay(time: string): string {
  const hour = Number(time.slice(0, 2));
  return hour < 5 ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
}

/** "7:40 PM" from a "19:40" wall time. */
export function clockTime(time: string): string {
  return new Date(`2000-01-01T${time.slice(0, 5)}:00Z`).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Plain dates in Circle time. Without a time of day: Today, Yesterday, a weekday
 * for the past week, else "Mon, Nov 3". With one: "Today, 2:10 PM",
 * "Yesterday evening", "Sunday morning".
 */
export function friendlyDay(day: string, today: string, time?: string): string {
  const diff = Math.round((dayNumber(today) - dayNumber(day)) / DAY);
  const part = time ? ` ${partOfDay(time)}` : "";
  if (diff === 0) return time ? `Today, ${clockTime(time)}` : "Today";
  if (diff === 1) return `Yesterday${part}`;
  if (diff > 1 && diff < 7) {
    const weekday = new Date(dayNumber(day)).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
    return `${weekday}${part}`;
  }
  return new Date(dayNumber(day)).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Where a person is, as a status dot. Free text from the routine, so a best guess. */
export function presence(now: { activity: string; place: string | null } | null | undefined) {
  if (!now) return "offline" as const;
  if (/sleep|nap|\bbed\b/i.test(now.activity)) return "offline" as const;
  return now.place === "home" ? ("online" as const) : ("busy" as const);
}
