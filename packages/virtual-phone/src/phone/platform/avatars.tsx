import React from "react";

let avatarCache: Promise<Map<string, string>> | null = null;

function loadAvatarMap() {
  avatarCache ??= Promise.all(
    ["/api/characters", "/api/personas"].map((path) =>
      fetch(path, { cache: "no-store" })
        .then(async (response) => response.ok ? response.json() as Promise<unknown> : [])
        .catch(() => [])),
  ).then((lists) => {
    const map = new Map<string, string>();
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const row of list) {
        const record = row as { id?: unknown; avatarUrl?: unknown; avatarPath?: unknown };
        const url = typeof record.avatarUrl === "string" && record.avatarUrl
          ? record.avatarUrl
          : typeof record.avatarPath === "string" ? record.avatarPath : "";
        if (typeof record.id === "string" && url) map.set(record.id, url);
      }
    }
    return map;
  });
  return avatarCache;
}

export function useAvatarMap() {
  const [map, setMap] = React.useState<Map<string, string> | null>(null);
  React.useEffect(() => {
    let active = true;
    void loadAvatarMap().then((loaded) => { if (active) setMap(loaded); });
    return () => { active = false; };
  }, []);
  return map;
}

function hueFor(value: string) {
  let hue = 0;
  for (const char of value) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
}

function initials(name: string) {
  return name.trim().split(/\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function PhoneAvatar({ name, url, size = "2.5rem" }: { name: string; url?: string | null; size?: string }) {
  const [failed, setFailed] = React.useState(false);
  const hue = hueFor(name);
  return (
    <span
      className="vp-thread-avatar"
      style={{ height: size, width: size, background: url && !failed ? "var(--vp-surface)" : `linear-gradient(180deg, hsl(${hue} 65% 58%), hsl(${hue} 65% 40%))` }}
      aria-hidden="true"
    >
      {url && !failed
        ? <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
        : initials(name)}
    </span>
  );
}
