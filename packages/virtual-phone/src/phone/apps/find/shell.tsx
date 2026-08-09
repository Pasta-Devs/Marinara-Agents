import React from "react";
import { MapPin, Radar, RefreshCw } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest, recordActivity } from "../../platform/api";
import { PhoneAvatar } from "../../platform/avatars";
import { emojiFor } from "../../platform/emoji-thumb";
import { PhoneEmptyState } from "../../platform/empty-state";
import { parseFound, type FoundPerson } from "./manifest";

export function FindShell({ phoneId, chatId, onBack, onClose }: { phoneId: string; chatId: string; onBack: () => void; onClose: () => void }) {
  const [people, setPeople] = React.useState<FoundPerson[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState("");

  const locate = React.useCallback(() => {
    setLoading(true);
    setNotice("");
    void phoneRequest<{ people: string[] }>(`/phones/${encodeURIComponent(phoneId)}/find/locate?chatId=${encodeURIComponent(chatId)}`, { method: "POST", body: JSON.stringify({}) })
      .then((r) => {
        const next = r.people.map(parseFound);
        setPeople(next);
        /**
         * Deliberately no world facts here. Every other app writes one for something the owner
         * *did* — bought, sold, posted, ordered. Locating is a read, and it used to write one fact
         * per person per refresh. The model rewords a location each time, so exact-text dedupe
         * never caught them: a few refreshes filled the 60-fact-per-chat store with location
         * snapshots and evicted everything the character had actually done. The activity line
         * below is the right record of a lookup.
         */
        if (next.length) void recordActivity(phoneId, `checked Find to see where ${next.map((p) => p.name).slice(0, 3).join(", ")} were`).catch(() => undefined);
      })
      .catch((e) => { setNotice(e instanceof Error ? e.message : "Find is unavailable."); setPeople([]); })
      .finally(() => setLoading(false));
  }, [phoneId, chatId]);

  /**
   * Locating is a heavy generation. It used to run on mount, so merely opening the app spent
   * tokens the user never asked to spend — the same thing unprompted texts are opt-in to avoid.
   */

  return <section aria-labelledby="find-title" className="vp-appview">
    <PhoneAppHeader title="Find" titleId="find-title" closeLabel="Close Find" onBack={onBack} onClose={onClose}
      actions={[{ id: "refresh", icon: "refresh", label: "Refresh locations", kind: "button", disabled: loading }]} onAction={() => locate()} />
    {notice ? <p role="status" className="vp-muted-note">{notice}</p> : null}
    {loading ? (
      <div role="status" aria-label="Locating" className="vp-stack" style={{ gap: "0.5rem" }}>{[0, 1, 2].map((i) => <div key={i} className="vp-thread-row" aria-hidden="true"><span className="vp-skeleton vp-skeleton--avatar" /><span className="vp-thread-body"><span className="vp-skeleton vp-skeleton--line" style={{ width: "40%" }} /><span className="vp-skeleton vp-skeleton--line" style={{ width: "70%" }} /></span></div>)}</div>
    ) : !people ? (
      <PhoneEmptyState
        icon={Radar}
        title="Find people"
        body="See where the people on this phone are right now, as far as the story knows."
        action={{ label: "Locate", onClick: () => locate() }}
      />
    ) : people.length === 0 ? (
      <PhoneEmptyState
        icon={MapPin}
        title="No one to find"
        body="People you meet and save on this phone show up here with where they are."
        action={{ label: "Try again", onClick: () => locate() }}
      />
    ) : (
      <div className="vp-stack" style={{ gap: "0.5rem" }}>{people.map((person) => (
        <div key={person.name} className="vp-card vp-find-row">
          <PhoneAvatar name={person.name} url={null} />
          <div className="vp-thread-body"><span className="vp-thread-name">{person.name}</span><span className="vp-thread-preview" style={{ whiteSpace: "normal" }}><MapPin size="0.7rem" aria-hidden="true" style={{ verticalAlign: "-1px" }} /> {person.place}{person.status ? ` · ${person.status}` : ""}</span></div>
          <span className="vp-emoji-thumb vp-emoji-thumb--sm" aria-hidden="true">{emojiFor(person.place, "📍")}</span>
        </div>
      ))}
        <p className="vp-muted-note"><RefreshCw size="0.7rem" aria-hidden="true" /> Locations are what the story knows right now. The owner now knows them too.</p>
      </div>
    )}
  </section>;
}
