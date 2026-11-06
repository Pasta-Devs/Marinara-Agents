import { useQuery } from "@tanstack/react-query";
import { getWidget, listCharacters } from "./api.js";
import { Avatar } from "./parts.js";

const caughtUp = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone }).format(
    new Date(iso),
  );

/** Home card: the newest unheard hooks, or where each quiet Circle stands. Every tap opens the Meanwhile tab. */
export function MeanwhileWidget({ open, active }: { open: () => void; active: boolean }) {
  const widget = useQuery({
    queryKey: ["meanwhile", "widget"],
    queryFn: getWidget,
    refetchInterval: active ? 60_000 : false,
  });
  const characters = useQuery({ queryKey: ["meanwhile", "characters"], queryFn: listCharacters });
  const people = new Map((characters.data ?? []).map((c) => [c.id, c]));
  const { hooks = [], quiet = [] } = widget.data ?? {};
  const empty = widget.data !== undefined && hooks.length === 0 && quiet.length === 0;

  if (widget.isError)
    return (
      <p className="mw-warn" role="alert">
        Meanwhile could not load.
      </p>
    );
  if (!widget.data) return <p className="mw-muted">Loading.</p>;

  return (
    <div className="mw-widget">
      <div className="mw-widget-head">Meanwhile</div>
      <div className="mw-widget-list">
        {empty ? <p className="mw-muted">No Circles yet. Make one to let your characters live on.</p> : null}
        {hooks.map((hook) => {
          const person = people.get(hook.characterId);
          return (
            <button key={`${hook.eventId}:${hook.characterId}`} type="button" className="mw-btn mw-hook" onClick={open}>
              <Avatar id={hook.characterId} name={person?.name ?? "?"} url={person?.avatarUrl} size={36} ring />
              <span>
                <span className="mw-name">{person?.name ?? "Someone"}</span>
                <span>{hook.text}</span>
                <span className="mw-muted">{hook.circleName}</span>
              </span>
            </button>
          );
        })}
        {quiet.map((circle) => (
          <p key={circle.id} className="mw-muted">
            <span className="mw-name">{circle.name}</span>{" "}
            {circle.toHear > 0
              ? `${circle.toHear} ${circle.toHear === 1 ? "thing" : "things"} to hear about`
              : `caught up to ${caughtUp(circle.lastRunCircle, circle.timezone)}`}
          </p>
        ))}
      </div>
      <button type="button" className="mw-btn" onClick={open}>
        {empty ? "Set up a Circle" : "Open Meanwhile"}
      </button>
    </div>
  );
}
