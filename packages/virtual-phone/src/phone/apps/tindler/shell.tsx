import React from "react";
import { Heart, X } from "lucide-react";
import { parseProfile } from "./manifest";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { useDebouncedSave, usePhoneStore } from "../../platform/use-phone-store";
import { hueFor, initials } from "../../platform/avatars";

export function TindlerShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "tindler");
  const [deck, setDeck] = React.useState<string[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [matches, setMatches] = React.useState<string[]>([]);
  const [preferences, setPreferences] = React.useState("");
  const [view, setView] = React.useState<"deck" | "matches">("deck");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { save: savePreference } = useDebouncedSave(store, "preferences", setError);

  const fetchDeck = React.useCallback((prefs: string) => {
    setLoading(true);
    void phoneRequest<{ profiles: string[] }>(`/phones/${encodeURIComponent(phoneId)}/tindler/deck`, {
      method: "POST", body: JSON.stringify({ preferences: prefs }),
    })
      .then((response) => {
        setDeck(response.profiles);
        setIndex(0);
        void store.set("deck", response.profiles).catch(() => undefined);
        void store.set("deckIndex", 0).catch(() => undefined);
      })
      .catch(() => setDeck((current) => current ?? []))
      .finally(() => setLoading(false));
  }, [phoneId, store]);

  React.useEffect(() => {
    let active = true;
    void Promise.all([store.get("deck"), store.get("deckIndex"), store.get("matches"), store.get("preferences")]).then(([savedDeck, savedIndex, savedMatches, savedPrefs]) => {
      if (!active) return;
      if (Array.isArray(savedMatches)) setMatches(savedMatches.filter((item): item is string => typeof item === "string"));
      const prefs = typeof savedPrefs === "string" ? savedPrefs : "";
      setPreferences(prefs);
      if (Array.isArray(savedDeck) && savedDeck.length) {
        setDeck(savedDeck.filter((item): item is string => typeof item === "string"));
        setIndex(typeof savedIndex === "number" ? savedIndex : 0);
      } else {
        fetchDeck(prefs);
      }
    }).catch(() => { if (active) fetchDeck(""); });
    return () => { active = false; };
  }, [store, fetchDeck]);

  const current = deck && index < deck.length ? deck[index]! : null;
  const advance = () => {
    const next = index + 1;
    setIndex(next);
    void store.set("deckIndex", next).catch(() => undefined);
  };
  const like = () => {
    if (!current) return;
    const nextMatches = [current, ...matches];
    setMatches(nextMatches);
    void store.set("matches", nextMatches).catch(() => undefined);
    advance();
  };
  const savePreferences = (value: string) => {
    setPreferences(value);
    savePreference(value);
  };

  const profile = current ? parseProfile(current) : null;

  return (
    <section aria-labelledby="tindler-title" className="vp-appview">
      <PhoneAppHeader
        title={view === "matches" ? "Matches" : "Tindler"}
        titleId="tindler-title"
        closeLabel="Close Tindler"
        onBack={() => view === "matches" ? setView("deck") : onBack()}
        onClose={onClose}
        actions={view === "matches" ? [] : [
          { id: "matches", icon: "heart", label: `Matches (${matches.length})`, kind: "button" },
          { id: "refresh-deck", icon: "refresh", label: "New people", kind: "button", disabled: loading, reason: "Finding people" },
        ]}
        onAction={(actionId) => {
          if (actionId === "matches") {
            setView("matches");
            // Matches are only "new" until you have looked at them (Stage 8.2).
            void store.set("lastSeenMatches", matches.length).catch(() => undefined);
          }
          if (actionId === "refresh-deck") fetchDeck(preferences);
        }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {view === "matches" ? (
        matches.length === 0 ? <p className="vp-muted-note">No matches yet. Go like someone.</p> : (
          <div className="vp-stack" style={{ gap: "0.5rem" }}>
            {matches.map((match, matchIndex) => {
              const matched = parseProfile(match);
              return (
                <div key={matchIndex} className="vp-thread-row">
                  <span className="vp-thread-avatar" style={{ background: `linear-gradient(180deg, hsl(${hueFor(matched.name)} 65% 60%), hsl(${hueFor(matched.name)} 65% 42%))` }} aria-hidden="true">{initials(matched.name)}</span>
                  <span className="vp-thread-body">
                    <span className="vp-thread-name">{matched.name}{matched.age ? `, ${matched.age}` : ""}</span>
                    <span className="vp-thread-preview">{matched.tagline || "It's a match"}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <>
          <label className="vp-field" style={{ marginBottom: "0.875rem" }}>
            <span className="vp-sr-only">Preferences</span>
            <input value={preferences} onChange={(event) => savePreferences(event.target.value)} placeholder="Looking for… (shapes who you see)" className="vp-input" />
          </label>
          {loading && !current ? (
            <div role="status" aria-label="Finding people" className="vp-tinder-card" aria-hidden="true">
              <span className="vp-skeleton vp-tinder-photo-skeleton" />
              <div className="vp-tinder-info">
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "45%", height: "0.875rem" }} />
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "70%" }} />
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "90%" }} />
              </div>
            </div>
          ) : profile ? (
            <>
              <article className="vp-tinder-card">
                <div className="vp-tinder-photo" style={{ background: `linear-gradient(160deg, hsl(${hueFor(profile.name)} 65% 58%), hsl(${(hueFor(profile.name) + 50) % 360} 65% 40%))` }} aria-hidden="true">
                  {initials(profile.name)}
                </div>
                <div className="vp-tinder-info">
                  <h3>{profile.name}{profile.age ? `, ${profile.age}` : ""}</h3>
                  {profile.tagline ? <p className="vp-tinder-tagline">{profile.tagline}</p> : null}
                  {profile.bio ? <p className="vp-tinder-bio">{profile.bio}</p> : null}
                </div>
              </article>
              <div className="vp-tinder-actions">
                <button type="button" aria-label={`Pass on ${profile.name}`} onClick={advance} className="vp-tinder-btn vp-tinder-btn--pass"><X size="1.375rem" aria-hidden="true" /></button>
                <button type="button" aria-label={`Like ${profile.name}`} onClick={like} className="vp-tinder-btn vp-tinder-btn--like"><Heart size="1.375rem" aria-hidden="true" /></button>
              </div>
            </>
          ) : (
            <div className="vp-app-error" style={{ position: "static", minHeight: "14rem" }}>
              <p>{deck?.length ? "That's everyone for now." : "No one around right now."}</p>
              <button type="button" onClick={() => fetchDeck(preferences)} disabled={loading} className="vp-surface-btn">Find new people</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
