import { SlpCoinText } from "../coin/SlpCoin";
import type { SlpLiveLine } from "./slp-live-feed";

/** A stable colour per name, so a regular reads as the same person all show long. */
const NAME_COLOURS = ["#f9a8d4", "#a5b4fc", "#86efac", "#fcd34d", "#67e8f9", "#fca5a5", "#c4b5fd", "#fdba74"];
export function slpLiveNameColour(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) | 0;
  return NAME_COLOURS[Math.abs(hash) % NAME_COLOURS.length]!;
}

/**
 * The room's chat over the bottom of the stage: newest at the bottom, older lines fade out so the picture
 * stays free. `me` marks the viewer's own tips.
 */
export function SlpLiveChat({
  lines,
  me,
  host,
  itemLabel,
  t,
}: {
  lines: readonly SlpLiveLine[];
  me: string | null;
  host: string;
  itemLabel: (id: string | undefined) => string;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const recent = lines.slice(-8);
  return (
    <ol
      aria-live="polite"
      className="flex flex-col justify-end gap-1.5 [mask-image:linear-gradient(to_bottom,transparent,black_45%)]"
    >
      {recent.map((event) => {
        const mine = !!me && event.by === me;
        const name = event.name ?? "";
        const item = itemLabel(event.itemId);
        if (event.kind === "say") {
          return (
            <li
              key={event.key}
              className="slp-live-in self-start rounded-2xl bg-black/55 px-3 py-1.5 text-[15px] text-white backdrop-blur-sm"
            >
              <b className="text-[var(--noodle-accent)]">{host}</b>{" "}
              {event.action && <i className="text-white/70">{event.action} </i>}
              {event.text}
            </li>
          );
        }
        if (event.kind === "chat" || event.kind === "you") {
          return (
            <li key={event.key} className="slp-live-in text-sm text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]">
              <b
                style={event.kind === "you" ? undefined : { color: slpLiveNameColour(name) }}
                className={event.kind === "you" ? "text-[var(--slurp-violet)]" : undefined}
              >
                {name}
              </b>{" "}
              {event.text}
            </li>
          );
        }
        if (event.kind === "goal" || event.kind === "done" || event.kind === "strip") {
          const text =
            event.kind === "goal"
              ? t("ui.slurp.live.feed.goal", { item })
              : event.kind === "strip"
                ? t("ui.slurp.live.feed.strip", { host })
                : event.by === "goal"
                  ? t("ui.slurp.live.feed.doneGoal", { host, item })
                  : t("ui.slurp.live.feed.done", { host, item, name });
          return (
            <li
              key={event.key}
              className="slp-live-in self-start rounded-xl bg-black/45 px-3 py-1.5 text-sm font-semibold text-[var(--noodle-accent)] backdrop-blur-sm"
            >
              {text}
            </li>
          );
        }
        if (event.kind === "tip" || event.kind === "order") {
          return (
            <li
              key={event.key}
              className={`slp-live-in self-start rounded-full px-3 py-1 text-sm font-semibold text-white shadow ${mine ? "bg-[var(--slurp-violet)]" : "bg-[color-mix(in_srgb,var(--noodle-accent)_80%,black)]"}`}
            >
              <SlpCoinText>
                {event.kind === "order"
                  ? t("ui.slurp.live.feed.order", { name, amount: event.amount ?? 0, item })
                  : t("ui.slurp.live.feed.tip", { name, amount: event.amount ?? 0 })}
              </SlpCoinText>
            </li>
          );
        }
        return (
          <li key={event.key} className="slp-live-in text-sm text-white/75 drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]">
            <b style={{ color: slpLiveNameColour(name) }}>{name}</b> {t("ui.slurp.live.feed.join")}
          </li>
        );
      })}
    </ol>
  );
}
