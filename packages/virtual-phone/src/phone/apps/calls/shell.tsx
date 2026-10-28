import React from "react";
import { Clock3, Info, Phone, PhoneIncoming, PhoneMissed, PhoneOff, Search, UserRound, Video } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { PhoneAvatar, useAvatarMap } from "../../platform/avatars";
import { PhoneEmptyState } from "../../platform/empty-state";
import { useStoryClock } from "../../platform/story-clock";

type CallStatus = "ringing" | "active" | "ended" | "declined" | "missed";
type CallMode = "audio" | "video";

interface PhoneCall {
  id: string;
  status: CallStatus;
  mode: CallMode;
  direction: "incoming" | "outgoing";
  characterId: string;
  characterName: string;
  startedAt: string | null;
  endedAt: string | null;
  summary: string | null;
  createdAt: string;
}

interface CallsPayload {
  available: boolean;
  reason?: string;
  canDial: boolean;
  calls: PhoneCall[];
  contacts: Array<{ characterId: string; name: string }>;
}

function callSubtitle(call: PhoneCall) {
  if (call.status === "ringing") return call.direction === "incoming" ? "Incoming call" : "Calling…";
  if (call.status === "active") return "In progress";
  if (call.status === "missed") return "Missed call";
  if (call.status === "declined") return "Declined";
  return call.direction === "incoming" ? "Incoming call" : "Outgoing call";
}

function CallGlyph({ call }: { call: PhoneCall }) {
  if (call.status === "missed") return <PhoneMissed size="1rem" aria-hidden="true" />;
  if (call.status === "declined") return <PhoneOff size="1rem" aria-hidden="true" />;
  if (call.direction === "incoming") return <PhoneIncoming size="1rem" aria-hidden="true" />;
  return call.mode === "video" ? <Video size="1rem" aria-hidden="true" /> : <Phone size="1rem" aria-hidden="true" />;
}

function callDuration(call: PhoneCall) {
  if (!call.startedAt || !call.endedAt) return null;
  const seconds = Math.max(0, Math.round((Date.parse(call.endedAt) - Date.parse(call.startedAt)) / 1000));
  if (!Number.isFinite(seconds)) return null;
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

export function CallsShell({ phoneId, chatId, launchTarget = "", onBack, onClose }: {
  phoneId: string;
  chatId: string;
  launchTarget?: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const [data, setData] = React.useState<CallsPayload | null>(null);
  const [view, setView] = React.useState<"recents" | "contacts">(launchTarget ? "contacts" : "recents");
  const [selectedId, setSelectedId] = React.useState(launchTarget);
  const [query, setQuery] = React.useState("");
  const [expandedId, setExpandedId] = React.useState("");
  const [pending, setPending] = React.useState("");
  const [error, setError] = React.useState("");
  const avatars = useAvatarMap();
  const clock = useStoryClock();

  React.useEffect(() => {
    if (!launchTarget) return;
    setSelectedId(launchTarget);
    setView("contacts");
  }, [launchTarget]);

  const refresh = React.useCallback(async () => {
    const payload = await phoneRequest<CallsPayload>(`/phones/${encodeURIComponent(phoneId)}/calls?chatId=${encodeURIComponent(chatId)}`);
    setData(payload);
    if (launchTarget && payload.contacts.some((contact) => contact.characterId === launchTarget)) setSelectedId(launchTarget);
  }, [phoneId, chatId, launchTarget]);

  React.useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    void refresh().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Calls could not be loaded"); });
    const timer = window.setInterval(() => { void refresh().catch(() => undefined); }, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [refresh]);

  React.useEffect(() => {
    if (!data?.available) return;
    void phoneRequest(`/phones/${encodeURIComponent(phoneId)}/apps/calls/storage/lastSeenAt`, {
      method: "PUT",
      body: JSON.stringify({ value: new Date().toISOString() }),
    }).catch(() => undefined);
  }, [data?.available, phoneId]);

  const placeCall = async (characterId = selectedId, mode: CallMode = "audio") => {
    if (!characterId) return;
    setPending("place");
    setError("");
    try {
      await phoneRequest(`/phones/${encodeURIComponent(phoneId)}/calls?chatId=${encodeURIComponent(chatId)}`, {
        method: "POST",
        body: JSON.stringify({ characterId, mode }),
      });
      await refresh();
      setView("recents");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The call could not be placed");
    } finally {
      setPending("");
    }
  };

  const updateCall = async (call: PhoneCall, status: "ended" | "declined") => {
    setPending(call.id);
    setError("");
    try {
      await phoneRequest(`/phones/${encodeURIComponent(phoneId)}/calls/${encodeURIComponent(call.id)}?chatId=${encodeURIComponent(chatId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The call could not be updated");
    } finally {
      setPending("");
    }
  };
  const visibleContacts = data?.contacts.filter((contact) => !query.trim() || contact.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [];
  const liveCall = data?.calls.find((call) => call.status === "active" || call.status === "ringing") ?? null;
  const recentCalls = data?.calls.filter((call) => call.id !== liveCall?.id) ?? [];

  return (
    <section aria-labelledby="calls-title" className="vp-appview" data-phone-app="calls">
      <PhoneAppHeader
        title="Phone"
        titleId="calls-title"
        closeLabel="Close Phone"
        onBack={onBack}
        onClose={onClose}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {!data && !error ? <p role="status" className="vp-muted-note">Loading calls…</p> : null}
      {data && !data.available ? (
        <PhoneEmptyState icon={PhoneOff} title="Calls unavailable" body={data.reason ?? "Update Marinara Engine to use Phone calls."} />
      ) : null}
      {data?.available && view === "contacts" ? (
        <div className="vp-stack vp-call-contacts">
          <label className="vp-inline-search"><Search size="0.875rem" aria-hidden="true" /><span className="vp-sr-only">Search people to call</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts" /></label>
          <div className="vp-list vp-list--inset-rules">
            {visibleContacts.map((contact) => (
              <div key={contact.characterId} className={`vp-call-contact${selectedId === contact.characterId ? " vp-call-contact--launched" : ""}`}>
                <PhoneAvatar name={contact.name} url={avatars?.get(contact.characterId)} />
                <span className="vp-thread-body"><span className="vp-thread-name">{contact.name}</span><span className="vp-thread-preview">Available in this conversation</span></span>
                <span className="vp-call-contact-actions">
                  <button type="button" disabled={pending === "place"} aria-label={`Audio call ${contact.name}`} onClick={() => void placeCall(contact.characterId, "audio")}><Phone size="0.9rem" aria-hidden="true" /></button>
                  <button type="button" disabled={pending === "place"} aria-label={`Video call ${contact.name}`} onClick={() => void placeCall(contact.characterId, "video")}><Video size="0.95rem" aria-hidden="true" /></button>
                </span>
              </div>
            ))}
          </div>
          {data.contacts.length === 0 ? <PhoneEmptyState icon={Phone} title="Nobody to call" body="Add a configured character to this chat first." /> : null}
          {query.trim() && visibleContacts.length === 0 ? <PhoneEmptyState icon={Search} title="No contact found" body="Only configured characters in this chat can receive calls." /> : null}
          {pending === "place" ? <p role="status" className="vp-muted-note">Starting call…</p> : null}
        </div>
      ) : null}
      {data?.available && view === "recents" ? (
        data.calls.length === 0 ? <PhoneEmptyState icon={Phone} title="No recent calls" body={data.canDial ? "Your call history will appear here." : "Calls involving this phone will appear here."} /> : (<>
          {liveCall ? <section className={`vp-call-live vp-call-live--${liveCall.status}`} aria-label={`${callSubtitle(liveCall)} with ${liveCall.characterName}`}><PhoneAvatar name={liveCall.characterName} url={avatars?.get(liveCall.characterId)} /><span><small>{callSubtitle(liveCall)}</small><strong>{liveCall.characterName}</strong><span>{liveCall.mode === "video" ? "Video" : "Audio"}{liveCall.status === "ringing" && liveCall.direction === "incoming" ? " · Answer from the conversation" : ""}</span></span><button type="button" disabled={pending === liveCall.id} aria-label={liveCall.status === "active" ? `End call with ${liveCall.characterName}` : `Decline call from ${liveCall.characterName}`} onClick={() => void updateCall(liveCall, liveCall.status === "active" ? "ended" : "declined")}><PhoneOff size="1rem" aria-hidden="true" /></button></section> : null}
          {recentCalls.length ? <h3 className="vp-section-label">Recent</h3> : null}
          <div className="vp-list vp-list--inset-rules">
            {recentCalls.map((call) => (
              <div key={call.id} className={`vp-call-row${call.status === "missed" ? " vp-call-row--missed" : ""}`}>
                <PhoneAvatar name={call.characterName} url={avatars?.get(call.characterId)} />
                <span className="vp-thread-body">
                  <span className="vp-thread-name">{call.characterName}</span>
                  <span className="vp-thread-preview vp-call-meta"><CallGlyph call={call} /> {callSubtitle(call)} · {call.mode}</span>
                  {expandedId === call.id && call.summary ? <span className="vp-call-summary">{call.summary}</span> : null}
                  {expandedId === call.id && callDuration(call) ? <span className="vp-thread-preview"><Clock3 size="0.7rem" aria-hidden="true" /> {callDuration(call)}</span> : null}
                </span>
                <span className="vp-call-end">
                  <time className="vp-row-stamp" dateTime={call.createdAt}>{clock.stamp(call.createdAt)}</time>
                  {call.status === "ringing" ? <button type="button" disabled={pending === call.id} aria-label={call.direction === "incoming" ? `Decline call from ${call.characterName}` : `Cancel call to ${call.characterName}`} onClick={() => void updateCall(call, "declined")}><PhoneOff size="0.875rem" aria-hidden="true" /></button> : null}
                  {call.status === "active" ? <button type="button" disabled={pending === call.id} aria-label={`End call with ${call.characterName}`} onClick={() => void updateCall(call, "ended")}><PhoneOff size="0.875rem" aria-hidden="true" /></button> : null}
                  {call.summary || callDuration(call) ? <button type="button" aria-label={`${expandedId === call.id ? "Hide" : "Show"} call details`} aria-pressed={expandedId === call.id} onClick={() => setExpandedId((current) => current === call.id ? "" : call.id)}><Info size="0.875rem" aria-hidden="true" /></button> : null}
                  {data.canDial ? <button type="button" disabled={pending === "place"} aria-label={`Call ${call.characterName} again`} onClick={() => void placeCall(call.characterId, call.mode)}>{call.mode === "video" ? <Video size="0.875rem" aria-hidden="true" /> : <Phone size="0.875rem" aria-hidden="true" />}</button> : null}
                </span>
              </div>
            ))}
          </div>
        </>)
      ) : null}
      {data?.available && data.canDial ? <nav className="vp-tabbar vp-call-tabbar" aria-label="Phone sections">
        <button type="button" className="vp-tabbar-btn" aria-current={view === "recents" ? "true" : undefined} onClick={() => setView("recents")}><Clock3 size="1rem" aria-hidden="true" />Recents</button>
        <button type="button" className="vp-tabbar-btn" aria-current={view === "contacts" ? "true" : undefined} onClick={() => setView("contacts")}><UserRound size="1rem" aria-hidden="true" />Contacts</button>
      </nav> : null}
    </section>
  );
}
