import React from "react";
import { ChevronRight, Clock3, LocateFixed, MapPin, Radar, RefreshCw, ShieldCheck } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest, recordActivity } from "../../platform/api";
import { PhoneAvatar } from "../../platform/avatars";
import { PhoneEmptyState } from "../../platform/empty-state";
import { usePhoneStore } from "../../platform/use-phone-store";
import { parseFound, type FoundPerson } from "./manifest";

type FindSnapshot = { people: FoundPerson[]; updatedAt: string };
type FindFilter = "shared" | "all";

const hasSharedLocation = (person: FoundPerson) => person.place.toLocaleLowerCase() !== "unavailable"
  && person.place.toLocaleLowerCase() !== "unknown";

function validSnapshot(value: unknown): FindSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<FindSnapshot>;
  if (!Array.isArray(candidate.people) || typeof candidate.updatedAt !== "string") return null;
  const people = candidate.people.filter((person): person is FoundPerson => !!person
    && typeof person === "object"
    && typeof person.name === "string"
    && typeof person.place === "string"
    && typeof person.status === "string").slice(0, 14);
  return { people, updatedAt: candidate.updatedAt };
}

function checkedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Previously checked";
  const elapsed = Date.now() - date.getTime();
  if (elapsed < 60_000) return "Updated just now";
  if (elapsed < 3_600_000) return `Updated ${Math.max(1, Math.floor(elapsed / 60_000))}m ago`;
  return `Updated ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)}`;
}

export function FindShell({ phoneId, chatId, openMaps, onBack, onClose }: { phoneId: string; chatId: string; openMaps?: (place: string) => void; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "find");
  const [snapshot, setSnapshot] = React.useState<FindSnapshot | null>(null);
  const [selected, setSelected] = React.useState<FoundPerson | null>(null);
  const [filter, setFilter] = React.useState<FindFilter>("shared");
  const [loading, setLoading] = React.useState(false);
  const [restoring, setRestoring] = React.useState(true);
  const [notice, setNotice] = React.useState("");

  React.useEffect(() => {
    let active = true;
    void store.get("snapshot")
      .then((stored) => { if (active) setSnapshot(validSnapshot(stored)); })
      .catch(() => undefined)
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [store]);

  const locate = React.useCallback(() => {
    if (loading) return;
    setLoading(true);
    setNotice("");
    void phoneRequest<{ people: string[] }>(`/phones/${encodeURIComponent(phoneId)}/find/locate?chatId=${encodeURIComponent(chatId)}`, { method: "POST", body: JSON.stringify({}) })
      .then((response) => {
        const next = { people: response.people.map(parseFound), updatedAt: new Date().toISOString() };
        setSnapshot(next);
        setSelected((current) => current ? next.people.find((person) => person.name === current.name) ?? null : null);
        void store.set("snapshot", next).catch(() => setNotice("Locations were checked, but the snapshot could not be saved."));
        if (next.people.length) void recordActivity(phoneId, "checked privately shared locations in Find").catch(() => undefined);
      })
      .catch((cause) => setNotice(cause instanceof Error ? cause.message : "Find is unavailable."))
      .finally(() => setLoading(false));
  }, [chatId, loading, phoneId, store]);

  const people = snapshot?.people ?? [];
  const shared = people.filter(hasSharedLocation);
  const visible = filter === "shared" ? shared : people;
  const title = selected ? selected.name : "Find";

  return <section aria-labelledby="find-title" className="vp-appview" data-phone-app="find">
    <PhoneAppHeader title={title} titleId="find-title" closeLabel="Close Find" onBack={() => selected ? setSelected(null) : onBack()} onClose={onClose}
      actions={selected ? [] : [{ id: "refresh", icon: "refresh", label: snapshot ? "Refresh locations" : "Check locations", kind: "button", disabled: loading }]} onAction={() => locate()} />
    {notice ? <p role="status" className="vp-muted-note">{notice}</p> : null}
    {selected ? (
      <div className="vp-find-detail">
        <div className="vp-find-person">
          <PhoneAvatar name={selected.name} url={null} />
          <h3>{selected.name}</h3>
          <span className={`vp-find-availability${hasSharedLocation(selected) ? " is-shared" : ""}`}>
            {hasSharedLocation(selected) ? <><LocateFixed size="0.75rem" aria-hidden="true" /> Location available</> : <><ShieldCheck size="0.75rem" aria-hidden="true" /> Location private</>}
          </span>
        </div>
        {hasSharedLocation(selected) ? (
          <section className="vp-card vp-find-place">
            <span className="vp-find-place-icon"><MapPin size="1.15rem" aria-hidden="true" /></span>
            <span><small>Current shared location</small><strong>{selected.place}</strong>{selected.status ? <p>{selected.status}</p> : null}</span>
          </section>
        ) : (
          <section className="vp-card vp-find-private">
            <ShieldCheck size="1.25rem" aria-hidden="true" />
            <div><strong>No shared location</strong><p>{selected.status || "This person has not shared a current location with this phone."}</p></div>
          </section>
        )}
        {hasSharedLocation(selected) && openMaps ? <button type="button" className="vp-accent-btn" onClick={() => openMaps(selected.place)}><MapPin size="0.95rem" aria-hidden="true" /> Open in Maps</button> : null}
        {hasSharedLocation(selected) && !openMaps ? <p className="vp-muted-note">Install Maps to view this location.</p> : null}
        {snapshot ? <p className="vp-find-checked"><Clock3 size="0.7rem" aria-hidden="true" /> {checkedLabel(snapshot.updatedAt)}</p> : null}
      </div>
    ) : restoring || loading && !snapshot ? (
      <div role="status" aria-label={restoring ? "Loading saved locations" : "Checking shared locations"} className="vp-stack" style={{ gap: "0.5rem" }}>{[0, 1, 2].map((index) => <div key={index} className="vp-thread-row" aria-hidden="true"><span className="vp-skeleton vp-skeleton--avatar" /><span className="vp-thread-body"><span className="vp-skeleton vp-skeleton--line" style={{ width: "40%" }} /><span className="vp-skeleton vp-skeleton--line" style={{ width: "70%" }} /></span></div>)}</div>
    ) : !snapshot ? (
      <PhoneEmptyState icon={Radar} title="People you know" body="Check locations that contacts chose to share or the story has already established." action={{ label: "Check locations", onClick: locate }} />
    ) : people.length === 0 ? (
      <PhoneEmptyState icon={MapPin} title="No contacts yet" body="Find can check people after they appear in this phone's contacts." action={{ label: "Check again", onClick: locate }} />
    ) : (
      <div className="vp-find-list">
        <div className="vp-find-summary"><span><strong>{shared.length}</strong><small>{shared.length === 1 ? "shared location" : "shared locations"}</small></span><span><RefreshCw className={loading ? "is-spinning" : ""} size="0.75rem" aria-hidden="true" /> {checkedLabel(snapshot.updatedAt)}</span></div>
        <div className="vp-filter-tabs" role="tablist" aria-label="Location availability">
          <button type="button" role="tab" aria-selected={filter === "shared"} onClick={() => setFilter("shared")}>Shared · {shared.length}</button>
          <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>Everyone · {people.length}</button>
        </div>
        {visible.length ? <div className="vp-list vp-list--inset-rules">{visible.map((person) => {
          const available = hasSharedLocation(person);
          return <button key={person.name} type="button" className="vp-thread-row vp-find-row" onClick={() => setSelected(person)}>
            <span className="vp-find-avatar"><PhoneAvatar name={person.name} url={null} />{available ? <span aria-label="Location shared"><LocateFixed size="0.55rem" aria-hidden="true" /></span> : null}</span>
            <span className="vp-thread-body"><span className="vp-thread-name">{person.name}</span><span className="vp-thread-preview">{available ? <>{person.place}{person.status ? ` · ${person.status}` : ""}</> : "Location not shared"}</span></span>
            <ChevronRight className="vp-row-chevron" size="0.9rem" aria-hidden="true" />
          </button>;
        })}</div> : <PhoneEmptyState icon={ShieldCheck} title="No shared locations" body="Nobody is sharing a supported current location with this phone." />}
        <p className="vp-find-privacy"><ShieldCheck size="0.7rem" aria-hidden="true" /> Find only shows locations shared with this phone or established by the story.</p>
      </div>
    )}
  </section>;
}
