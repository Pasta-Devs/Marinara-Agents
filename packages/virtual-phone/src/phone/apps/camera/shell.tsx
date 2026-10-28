import React from "react";
import { ChevronLeft, ChevronRight, Images, RotateCcw, Share2, Star, Trash2 } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { PhoneEmptyState } from "../../platform/empty-state";
import { useStoryClock } from "../../platform/story-clock";
import { phoneRequest, recordActivity } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";

interface Shot {
  id: string;
  text: string;
  at: string;
  lens?: "front" | "rear";
  favorite?: boolean;
}

const MAX_SHOTS = 24;

export function readCameraShots(value: unknown): Shot[] {
  if (!Array.isArray(value)) return [];
  return value.filter((shot): shot is Shot => !!shot
    && typeof (shot as Shot).text === "string"
    && !!(shot as Shot).text.trim()
    && typeof (shot as Shot).id === "string"
    && typeof (shot as Shot).at === "string")
    .map((shot) => ({
      id: shot.id,
      text: shot.text.trim().slice(0, 800),
      at: shot.at,
      lens: shot.lens === "front" ? "front" : "rear",
      favorite: shot.favorite === true,
    }))
    .slice(0, MAX_SHOTS);
}

export function CameraShell({ phoneId, openGallery, openMessages, onBack, onClose }: {
  phoneId: string;
  openGallery?: () => void;
  openMessages?: (draft: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const store = usePhoneStore(phoneId, "camera");
  const clock = useStoryClock();
  const [shots, setShots] = React.useState<Shot[] | null>(null);
  const [shooting, setShooting] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [lens, setLens] = React.useState<"front" | "rear">("rear");
  const [openShotId, setOpenShotId] = React.useState<string | null>(null);
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
      setShots(readCameraShots(value));
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
    if ((shots?.length ?? 0) >= MAX_SHOTS) {
      setError("The camera roll is full. Delete a photo before taking another.");
      return;
    }
    setShooting(true);
    setError(null);
    void phoneRequest<{ photo: string }>(`/phones/${encodeURIComponent(phoneId)}/camera/shot`, {
      method: "POST",
      body: JSON.stringify({ subject: subject.trim(), lens }),
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
    if ((shots?.length ?? 0) >= MAX_SHOTS) return;
    const shot: Shot = { id: crypto.randomUUID(), text: draft.trim(), at: new Date().toISOString(), lens };
    persist([shot, ...(shots ?? [])]);
    void recordActivity(phoneId, "took a photo with the Phone")
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The photo action could not be recorded."));
    setDraft(null);
    setSubject("");
  };

  const deleteShot = (id: string) => {
    if (!shots) return;
    if (!window.confirm("Delete this photo from the camera roll?")) return;
    persist(shots.filter((shot) => shot.id !== id));
    setOpenShotId(null);
  };

  const updateShot = (id: string, patch: Partial<Shot>) => {
    if (!shots) return;
    persist(shots.map((shot) => shot.id === id ? { ...shot, ...patch } : shot));
  };

  const latest = shots?.[0] ?? null;
  const openShotIndex = openShotId ? (shots ?? []).findIndex((shot) => shot.id === openShotId) : -1;
  const openShot = openShotIndex >= 0 ? shots?.[openShotIndex] ?? null : null;
  const stepShot = (delta: number) => {
    if (!shots?.length || openShotIndex < 0) return;
    setOpenShotId(shots[(openShotIndex + delta + shots.length) % shots.length]!.id);
  };

  return (
    <section aria-labelledby="camera-title" className="vp-appview vp-appview--fixed vp-camera" data-phone-app="camera">
      <PhoneAppHeader
        title={openShot ? "Photo" : view === "roll" ? "Camera roll" : "Camera"}
        titleId="camera-title"
        closeLabel="Close Camera"
        onBack={() => openShot ? setOpenShotId(null) : view === "roll" ? setView("camera") : onBack()}
        onClose={onClose}
        actions={view === "roll" && openGallery ? [{ id: "gallery", icon: "menu", label: "Open Gallery", kind: "button" }] : []}
        onAction={(actionId) => { if (actionId === "gallery") openGallery?.(); }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {view === "roll" ? (
        openShot ? (
          <article className="vp-camera-photo">
            <div className="vp-camera-photo-frame"><p>{openShot.text}</p>{openShot.favorite ? <Star size="1rem" fill="currentColor" aria-label="Favorite" /> : null}</div>
            <div className="vp-camera-photo-meta">
              <span>{`${clock.shortDate(openShot.at)}, ${clock.time(openShot.at)}`}</span>
              <span>{openShot.lens === "front" ? "Front camera" : "Rear camera"}</span>
            </div>
            {shots && shots.length > 1 ? <div className="vp-camera-pager">
              <button type="button" onClick={() => stepShot(-1)} aria-label="Previous photo" className="vp-icon-btn"><ChevronLeft size="1rem" /></button>
              <span>{openShotIndex + 1} of {shots.length}</span>
              <button type="button" onClick={() => stepShot(1)} aria-label="Next photo" className="vp-icon-btn"><ChevronRight size="1rem" /></button>
            </div> : null}
            <div className="vp-camera-photo-actions">
              <button type="button" onClick={() => updateShot(openShot.id, { favorite: !openShot.favorite })} className="vp-surface-btn"><Star size="0.9rem" fill={openShot.favorite ? "currentColor" : "none"} />{openShot.favorite ? "Unfavorite" : "Favorite"}</button>
              {openMessages ? <button type="button" onClick={() => openMessages(`📷 ${openShot.text}`)} className="vp-surface-btn"><Share2 size="0.9rem" />Share</button> : null}
              <button type="button" onClick={() => deleteShot(openShot.id)} className="vp-surface-btn vp-camera-delete"><Trash2 size="0.9rem" />Delete</button>
            </div>
          </article>
        ) : shots?.length ? (
          <div className="vp-roll-grid" aria-label="Camera roll">
            {shots.map((shot) => (
              <button key={shot.id} type="button" onClick={() => setOpenShotId(shot.id)} className="vp-camera-roll-cell" aria-label={`Open photo: ${shot.text}`}>
                <span>{shot.text}</span>{shot.favorite ? <Star size="0.75rem" fill="currentColor" aria-label="Favorite" /> : null}
              </button>
            ))}
          </div>
        ) : (
          <PhoneEmptyState icon={Images} title="Camera roll is empty" body="Take a shot, review what the camera saw, and keep it here." action={{ label: "Open camera", onClick: () => setView("camera") }} />
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
            <div className="vp-camera-aim-row">
              <label className="vp-camera-subject">
                <span className="vp-sr-only">What are you aiming at?</span>
                <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={lens === "front" ? "Selfie focus (optional)" : "Aim at something (optional)"} maxLength={200} className="vp-input" />
              </label>
              <button type="button" onClick={() => setLens((current) => current === "rear" ? "front" : "rear")} className="vp-icon-btn" aria-label={`Switch to ${lens === "rear" ? "front" : "rear"} camera`} title={`${lens === "front" ? "Front" : "Rear"} camera`}><RotateCcw size="1rem" /></button>
            </div>
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
                <button type="button" aria-label="Take photo" onClick={shoot} disabled={shooting || (shots?.length ?? 0) >= MAX_SHOTS} className="vp-shutter" />
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
