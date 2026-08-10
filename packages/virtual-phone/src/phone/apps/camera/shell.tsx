import React from "react";
import { PhoneAppHeader } from "../../platform/app-header";
import { useStoryClock } from "../../platform/story-clock";
import { phoneRequest, recordActivity } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";

interface Shot {
  id: string;
  text: string;
  at: string;
}

const MAX_SHOTS = 24;

export function CameraShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "camera");
  const clock = useStoryClock();
  const [shots, setShots] = React.useState<Shot[] | null>(null);
  const [shooting, setShooting] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  /**
   * The shutter produces a description you can edit before it is committed. Refining the prompt is
   * the interesting half of the interaction and it needs no Engine change; committing produces a
   * text photo card, which stays as the permanent fallback for hosts with no image connection.
   * Real image generation from this draft is Step 11.3.
   */
  const [draft, setDraft] = React.useState<string | null>(null);
  /** The roll is a screen you go to from the thumbnail, the way a camera app works. */
  const [view, setView] = React.useState<"camera" | "roll">("camera");

  React.useEffect(() => {
    let active = true;
    void store.get("shots").then((value) => {
      if (!active) return;
      setShots(Array.isArray(value)
        ? value.filter((shot): shot is Shot => !!shot && typeof (shot as Shot).text === "string" && typeof (shot as Shot).id === "string")
        : []);
    }).catch(() => { if (active) setShots([]); });
    return () => { active = false; };
  }, [store]);

  const persist = (next: Shot[]) => {
    setShots(next);
    void store.set("shots", next).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "The camera roll could not be saved.");
    });
  };

  const shoot = () => {
    setShooting(true);
    setError(null);
    void phoneRequest<{ photo: string }>(`/phones/${encodeURIComponent(phoneId)}/camera/shot`, {
      method: "POST",
      body: JSON.stringify({ subject: subject.trim() }),
    })
      .then((response) => {
        if (!response.photo.trim()) {
          setError("The camera came back with nothing. Try again, or aim it at something specific.");
          return;
        }
        setDraft(response.photo);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "The photo could not be taken.");
      })
      .finally(() => setShooting(false));
  };

  const commit = () => {
    if (!draft?.trim()) return;
    const shot: Shot = { id: crypto.randomUUID(), text: draft.trim(), at: new Date().toISOString() };
    persist([shot, ...(shots ?? [])].slice(0, MAX_SHOTS));
    void recordActivity(phoneId, `took a photo — ${shot.text.slice(0, 120)}`)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The photo action could not be recorded."));
    setDraft(null);
    setSubject("");
  };

  const deleteShot = (id: string) => {
    if (!shots) return;
    persist(shots.filter((shot) => shot.id !== id));
  };

  const latest = shots?.[0] ?? null;

  return (
    <section aria-labelledby="camera-title" className="vp-appview vp-appview--fixed vp-camera">
      <PhoneAppHeader
        title={view === "roll" ? "Camera roll" : "Camera"}
        titleId="camera-title"
        closeLabel="Close Camera"
        onBack={() => view === "roll" ? setView("camera") : onBack()}
        onClose={onClose}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {view === "roll" ? (
        shots?.length ? (
          <div className="vp-roll-grid">
            {shots.map((shot) => (
              <figure key={shot.id} className="vp-card vp-polaroid">
                <p>{shot.text}</p>
                <figcaption>
                  {`${clock.shortDate(shot.at)}, ${clock.time(shot.at)}`}
                  <button type="button" onClick={() => deleteShot(shot.id)} className="vp-surface-btn">Delete</button>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="vp-muted-note">Nothing on the roll yet.</p>
        )
      ) : (
        <>
          {/* The viewfinder is the app: it takes the whole screen above the controls. */}
          <div className={`vp-viewfinder${draft !== null ? " vp-viewfinder--review" : ""}`} aria-live="polite" aria-label={draft !== null ? "Photo review" : "Camera viewfinder"}>
            {shooting ? (
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "70%" }} />
            ) : draft !== null ? (
              <label style={{ width: "100%", height: "100%" }}>
                <span className="vp-sr-only">What the photo shows</span>
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={800} autoFocus className="vp-viewfinder-edit" />
              </label>
            ) : (
              <p className="vp-viewfinder-text vp-muted-note">A phone-camera snapshot, described from the current scene.</p>
            )}
          </div>
          {draft === null ? (
            <label className="vp-camera-subject">
              <span className="vp-sr-only">What are you aiming at?</span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Aim at something (optional)" maxLength={200} className="vp-input" />
            </label>
          ) : null}
          {/* Controls at the bottom, where a thumb is: last shot, shutter, roll. */}
          <div className="vp-camera-bar">
            {draft !== null ? (
              <>
                <button type="button" onClick={() => setDraft(null)} className="vp-surface-btn">Discard</button>
                <button type="button" onClick={commit} disabled={!draft.trim()} className="vp-accent-btn">Keep photo</button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="vp-camera-thumb"
                  disabled={!shots?.length}
                  aria-label={shots?.length ? `Camera roll, ${shots.length} photos` : "Camera roll is empty"}
                  onClick={() => setView("roll")}
                >
                  {latest ? <span>{latest.text.slice(0, 40)}</span> : null}
                </button>
                <button type="button" aria-label="Take photo" onClick={shoot} disabled={shooting} className="vp-shutter" />
                <span className="vp-camera-count">{shots?.length ?? 0}/{MAX_SHOTS}</span>
              </>
            )}
          </div>
          {shots && shots.length >= MAX_SHOTS ? <p className="vp-muted-note">The roll is full — delete a photo to make room.</p> : null}
        </>
      )}
    </section>
  );
}
