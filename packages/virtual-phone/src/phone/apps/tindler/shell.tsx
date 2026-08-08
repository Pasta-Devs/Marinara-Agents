import React from "react";
import { Heart, X } from "lucide-react";
import { parseProfile } from "./manifest";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { useDebouncedSave, usePhoneStore } from "../../platform/use-phone-store";
import { hueFor, initials } from "../../platform/avatars";

/** Past this much horizontal travel, letting go commits the swipe instead of springing back. */
const COMMIT_PX = 96;

export function TindlerShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "tindler");
  const [deck, setDeck] = React.useState<string[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [matches, setMatches] = React.useState<string[]>([]);
  const [preferences, setPreferences] = React.useState("");
  const [view, setView] = React.useState<"deck" | "matches" | "preferences">("deck");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { save: savePreference } = useDebouncedSave(store, "preferences", setError);

  /** Live drag offset, and the direction a committed card is flying out in. */
  const [drag, setDrag] = React.useState(0);
  const [flying, setFlying] = React.useState<"like" | "pass" | null>(null);
  const dragStart = React.useRef<number | null>(null);

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
  const upcoming = deck ? deck.slice(index + 1, index + 3) : [];

  const advance = React.useCallback(() => {
    setIndex((currentIndex) => {
      const next = currentIndex + 1;
      void store.set("deckIndex", next).catch(() => undefined);
      return next;
    });
    setDrag(0);
    setFlying(null);
    dragStart.current = null;
  }, [store]);

  /** The card flies out first, then the deck advances — committing instantly reads as a glitch. */
  const commit = React.useCallback((decision: "like" | "pass") => {
    if (!current || flying) return;
    if (decision === "like") {
      setMatches((currentMatches) => {
        const next = [current, ...currentMatches];
        void store.set("matches", next).catch(() => undefined);
        return next;
      });
    }
    setFlying(decision);
    window.setTimeout(advance, 260);
  }, [current, flying, store, advance]);

  React.useEffect(() => {
    if (view !== "deck") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") commit("pass");
      if (event.key === "ArrowRight") commit("like");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, commit]);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (flying) return;
    dragStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (dragStart.current === null) return;
    setDrag(event.clientX - dragStart.current);
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    const travelled = drag;
    dragStart.current = null;
    if (travelled > COMMIT_PX) commit("like");
    else if (travelled < -COMMIT_PX) commit("pass");
    else setDrag(0);
  };

  const profile = current ? parseProfile(current) : null;
  const offset = flying ? (flying === "like" ? 520 : -520) : drag;
  const cardStyle: React.CSSProperties = {
    transform: `translateX(${offset}px) rotate(${offset / 26}deg)`,
    opacity: flying ? 0 : 1,
    transition: dragStart.current === null ? "transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 260ms ease" : "none",
    touchAction: "pan-y",
  };
  const verdict = Math.abs(offset) > 28 ? (offset > 0 ? "like" : "pass") : null;

  const photoFor = (name: string) => ({
    background: `linear-gradient(160deg, hsl(${hueFor(name)} 65% 58%), hsl(${(hueFor(name) + 50) % 360} 65% 40%))`,
  });

  return (
    <section aria-labelledby="tindler-title" className="vp-appview vp-appview--fixed">
      <PhoneAppHeader
        title={view === "matches" ? "Matches" : view === "preferences" ? "Looking for" : "Tindler"}
        titleId="tindler-title"
        closeLabel="Close Tindler"
        onBack={() => view === "deck" ? onBack() : setView("deck")}
        onClose={onClose}
        actions={view === "deck" ? [
          { id: "preferences", icon: "search", label: "Looking for", kind: "button" },
          { id: "matches", icon: "heart", label: `Matches (${matches.length})`, kind: "button" },
          { id: "refresh-deck", icon: "refresh", label: "New people", kind: "button", disabled: loading, reason: "Finding people" },
        ] : []}
        onAction={(actionId) => {
          if (actionId === "preferences") setView("preferences");
          if (actionId === "matches") {
            setView("matches");
            void store.set("lastSeenMatches", matches.length).catch(() => undefined);
          }
          if (actionId === "refresh-deck") fetchDeck(preferences);
        }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}

      {view === "preferences" ? (
        <div className="vp-card vp-stack" style={{ gap: "0.5rem" }}>
          <p className="vp-muted-note">This shapes who turns up. Leave it empty and the world decides.</p>
          <label><span className="vp-sr-only">Looking for</span>
            <input
              value={preferences}
              onChange={(event) => { setPreferences(event.target.value); savePreference(event.target.value); }}
              placeholder="Looking for…"
              autoFocus
              className="vp-input"
            />
          </label>
          <button type="button" className="vp-accent-btn" onClick={() => { setView("deck"); fetchDeck(preferences); }}>Find people</button>
        </div>
      ) : view === "matches" ? (
        matches.length === 0 ? <p className="vp-muted-note">No matches yet. Go like someone.</p> : (
          <div className="vp-stack" style={{ gap: "0.5rem", overflowY: "auto" }}>
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
        <div className="vp-deck">
          {loading && !current ? (
            <div role="status" aria-label="Finding people" className="vp-tinder-card vp-deck-card" aria-hidden="true">
              <span className="vp-skeleton vp-tinder-photo-skeleton" />
              <div className="vp-tinder-info">
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "45%", height: "0.875rem" }} />
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "70%" }} />
              </div>
            </div>
          ) : profile ? (
            <>
              {/* Cards waiting behind, so the deck reads as a stack with depth rather than one card. */}
              {upcoming.map((entry, depth) => {
                const next = parseProfile(entry);
                return (
                  <article
                    key={`${entry}-${depth}`}
                    aria-hidden="true"
                    className="vp-tinder-card vp-deck-card"
                    style={{ transform: `scale(${0.94 - depth * 0.04}) translateY(${(depth + 1) * 10}px)`, zIndex: 1 - depth, opacity: 0.75 - depth * 0.25 }}
                  >
                    <div className="vp-tinder-photo" style={photoFor(next.name)}>{initials(next.name)}</div>
                  </article>
                );
              })}
              <article
                className="vp-tinder-card vp-deck-card vp-deck-card--top"
                style={cardStyle}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <div className="vp-tinder-photo" style={photoFor(profile.name)} aria-hidden="true">
                  {initials(profile.name)}
                </div>
                {verdict ? (
                  <span className={`vp-deck-stamp vp-deck-stamp--${verdict}`} aria-hidden="true">
                    {verdict === "like" ? "LIKED" : "NOPE"}
                  </span>
                ) : null}
                <div className="vp-tinder-info">
                  <h3>{profile.name}{profile.age ? `, ${profile.age}` : ""}</h3>
                  {profile.tagline ? <p className="vp-tinder-tagline">{profile.tagline}</p> : null}
                  {profile.bio ? <p className="vp-tinder-bio">{profile.bio}</p> : null}
                </div>
              </article>
            </>
          ) : (
            <div className="vp-deck-empty">
              <p>{deck?.length ? "That's everyone for now." : "No one around right now."}</p>
              <button type="button" onClick={() => fetchDeck(preferences)} disabled={loading} className="vp-accent-btn">Find new people</button>
            </div>
          )}
        </div>
      )}

      {view === "deck" && profile ? (
        <div className="vp-tinder-actions">
          <button type="button" aria-label={`Pass on ${profile.name}`} onClick={() => commit("pass")} className="vp-tinder-btn vp-tinder-btn--pass"><X size="1.375rem" aria-hidden="true" /></button>
          <button type="button" aria-label={`Like ${profile.name}`} onClick={() => commit("like")} className="vp-tinder-btn vp-tinder-btn--like"><Heart size="1.375rem" aria-hidden="true" /></button>
        </div>
      ) : null}
    </section>
  );
}
