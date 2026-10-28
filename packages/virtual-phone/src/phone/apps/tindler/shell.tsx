import React from "react";
import { Heart, MessageCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import { parseProfile } from "./manifest";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { useDebouncedSave, usePhoneStore } from "../../platform/use-phone-store";
import { hueFor, initials } from "../../platform/avatars";
import { rememberPerson } from "../../platform/people";
import { PhoneEmptyState } from "../../platform/empty-state";

/** Past this much horizontal travel, letting go commits the swipe instead of springing back. */
const COMMIT_PX = 96;

type Match = { profile: string; contactPhoneId?: string };
type MatchNotice = Match & { name: string; opener: string };

const readMatches = (value: unknown): Match[] => Array.isArray(value)
  ? value.flatMap((item) => {
    if (typeof item === "string") return [{ profile: item }];
    if (!item || typeof item !== "object" || typeof (item as Match).profile !== "string") return [];
    return [{ profile: (item as Match).profile, ...typeof (item as Match).contactPhoneId === "string" ? { contactPhoneId: (item as Match).contactPhoneId } : {} }];
  })
  : [];

export function TindlerShell({ phoneId, openMessages, onBack, onClose }: {
  phoneId: string;
  openMessages?: (phoneId: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const store = usePhoneStore(phoneId, "tindler");
  const [deck, setDeck] = React.useState<string[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [preferences, setPreferences] = React.useState("");
  const [intent, setIntent] = React.useState("Open to dating");
  const [view, setView] = React.useState<"deck" | "matches" | "preferences">("deck");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [checkingLike, setCheckingLike] = React.useState(false);
  const [matchNotice, setMatchNotice] = React.useState<MatchNotice | null>(null);
  const { save: savePreference } = useDebouncedSave(store, "preferences", setError);
  const { save: saveIntent } = useDebouncedSave(store, "intent", setError);

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
        void store.set("deck", response.profiles).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The deck could not be saved."));
        void store.set("deckIndex", 0).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The deck position could not be saved."));
      })
      .catch(() => setDeck((current) => current ?? []))
      .finally(() => setLoading(false));
  }, [phoneId, store]);

  React.useEffect(() => {
    let active = true;
    void Promise.all([store.get("deck"), store.get("deckIndex"), store.get("matches"), store.get("preferences"), store.get("intent")]).then(([savedDeck, savedIndex, savedMatches, savedPrefs, savedIntent]) => {
      if (!active) return;
      setMatches(readMatches(savedMatches));
      const prefs = typeof savedPrefs === "string" ? savedPrefs : "";
      setPreferences(prefs);
      if (typeof savedIntent === "string" && savedIntent) setIntent(savedIntent);
      if (Array.isArray(savedDeck) && savedDeck.length) {
        setDeck(savedDeck.filter((item): item is string => typeof item === "string"));
        setIndex(typeof savedIndex === "number" ? savedIndex : 0);
      } else {
        fetchDeck([typeof savedIntent === "string" ? savedIntent : "Open to dating", prefs].filter(Boolean).join("; "));
      }
    }).catch(() => { if (active) fetchDeck(""); });
    return () => { active = false; };
  }, [store, fetchDeck]);

  const current = deck && index < deck.length ? deck[index]! : null;
  const upcoming = deck ? deck.slice(index + 1, index + 3) : [];

  const advance = React.useCallback(() => {
    setIndex((currentIndex) => {
      const next = currentIndex + 1;
      void store.set("deckIndex", next).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The deck position could not be saved."));
      return next;
    });
    setDrag(0);
    setFlying(null);
    dragStart.current = null;
  }, [store]);

  /** The card flies out first, then the deck advances — committing instantly reads as a glitch. */
  const checkForMatch = React.useCallback(async (entry: string) => {
    setCheckingLike(true);
    try {
      const result = await phoneRequest<{ matched: boolean; opener: string }>(`/phones/${encodeURIComponent(phoneId)}/tindler/match`, {
        method: "POST",
        body: JSON.stringify({ profile: entry, preferences: [intent, preferences].filter(Boolean).join("; ") }),
      });
      if (!result.matched) return;
      const matched = parseProfile(entry);
      const remembered = await rememberPerson(phoneId, {
        name: matched.name,
        bio: [matched.tagline, matched.bio].filter(Boolean).join(" — "),
        phoneLabel: "Tindler",
        source: "Mutual match on Tindler",
        firstMessage: result.opener || "Hey — it's a match.",
      });
      const nextMatch: Match = { profile: entry, contactPhoneId: remembered?.contact.phoneId };
      setMatches((currentMatches) => {
        if (currentMatches.some((match) => match.profile === entry)) return currentMatches;
        const next = [nextMatch, ...currentMatches];
        void store.set("matches", next).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The match could not be saved."));
        return next;
      });
      setMatchNotice({ ...nextMatch, name: matched.name, opener: result.opener });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your like could not be sent.");
    } finally {
      setCheckingLike(false);
    }
  }, [phoneId, intent, preferences, store]);

  const commit = React.useCallback((decision: "like" | "pass") => {
    if (!current || flying) return;
    if (decision === "like") void checkForMatch(current);
    setFlying(decision);
    window.setTimeout(advance, 260);
  }, [current, flying, advance, checkForMatch]);

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
  const removeMatch = (index: number) => {
    const next = matches.filter((_, matchIndex) => matchIndex !== index);
    setMatches(next);
    void store.set("matches", next).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The match could not be removed."));
  };
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
    <section aria-labelledby="tindler-title" className="vp-appview vp-appview--fixed" data-phone-app="tindler">
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
            void store.set("lastSeenMatches", matches.length).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Matches could not be marked as seen."));
          }
          if (actionId === "refresh-deck") fetchDeck([intent, preferences].filter(Boolean).join("; "));
        }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}

      {view === "preferences" ? (
        <div className="vp-tindler-preferences">
          <div className="vp-tindler-assurance"><ShieldCheck size="1.1rem" aria-hidden="true" /><p><strong>Your choices stay yours.</strong><span>These guide discovery. They are not shown as your bio or sent to people.</span></p></div>
          <fieldset className="vp-tindler-intents">
            <legend>What are you open to?</legend>
            {["Open to dating", "A relationship", "Something casual", "New connections"].map((option) => <button key={option} type="button" aria-pressed={intent === option} onClick={() => { setIntent(option); saveIntent(option, true); }}>{option}</button>)}
          </fieldset>
          <label><span className="vp-sr-only">Looking for</span>
            <span className="vp-field-label">People and boundaries</span>
            <input
              value={preferences}
              onChange={(event) => { setPreferences(event.target.value); savePreference(event.target.value); }}
              placeholder="Kind, nearby, no coworkers…"
              className="vp-input"
              maxLength={200}
            />
          </label>
          <button type="button" className="vp-accent-btn" onClick={() => { setView("deck"); fetchDeck([intent, preferences].filter(Boolean).join("; ")); }}>Update discovery</button>
        </div>
      ) : view === "matches" ? (
        matches.length === 0 ? <PhoneEmptyState icon={Heart} title="No matches yet" body="People you both choose appear here and are added to Contacts." action={{ label: "Browse people", onClick: () => setView("deck") }} /> : (
          <div className="vp-stack" style={{ gap: "0.5rem", overflowY: "auto" }}>
            {matches.map((match, matchIndex) => {
              const matched = parseProfile(match.profile);
              return (
                <div key={`${match.profile}-${matchIndex}`} className="vp-tindler-match">
                  <span className="vp-thread-avatar" style={{ background: `linear-gradient(180deg, hsl(${hueFor(matched.name)} 65% 60%), hsl(${hueFor(matched.name)} 65% 42%))` }} aria-hidden="true">{initials(matched.name)}</span>
                  <span className="vp-thread-body">
                    <span className="vp-thread-name">{matched.name}{matched.age ? `, ${matched.age}` : ""}</span>
                    <span className="vp-thread-preview">{matched.tagline || "It's a match"}</span>
                  </span>
                  {match.contactPhoneId && openMessages ? <button type="button" className="vp-tindler-message" aria-label={`Message ${matched.name}`} onClick={() => openMessages(match.contactPhoneId!)}><MessageCircle size="1rem" aria-hidden="true" /></button> : null}
                  <button type="button" className="vp-store-remove vp-tindler-unmatch" aria-label={`Remove match with ${matched.name}`} title="Remove match" onClick={() => removeMatch(matchIndex)}><X size="0.9rem" aria-hidden="true" /></button>
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
      {view === "deck" && profile ? <p className="vp-tindler-private-note">Likes are private unless you both choose each other.</p> : null}
      {checkingLike ? <div className="vp-tindler-toast" role="status"><Sparkles size="0.9rem" aria-hidden="true" /> Like sent</div> : null}
      {matchNotice ? (
        <div className="vp-tindler-match-sheet" role="dialog" aria-modal="true" aria-labelledby="tindler-match-title">
          <div className="vp-tindler-match-burst" style={photoFor(matchNotice.name)}>{initials(matchNotice.name)}</div>
          <span className="vp-section-label">It’s mutual</span>
          <h3 id="tindler-match-title">You matched with {matchNotice.name}</h3>
          {matchNotice.opener ? <p>“{matchNotice.opener}”</p> : <p>You can start a conversation whenever you’re ready.</p>}
          <div className="vp-review-actions">
            {matchNotice.contactPhoneId && openMessages ? <button type="button" className="vp-accent-btn" onClick={() => { const target = matchNotice.contactPhoneId!; setMatchNotice(null); openMessages(target); }}>Message</button> : null}
            <button type="button" className="vp-surface-btn" onClick={() => setMatchNotice(null)}>Keep browsing</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
