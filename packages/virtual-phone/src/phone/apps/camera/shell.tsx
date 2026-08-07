import React from "react";
import { Aperture } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";

interface Shot {
  id: string;
  text: string;
  at: string;
}

export function CameraShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "camera");
  const [shots, setShots] = React.useState<Shot[] | null>(null);
  const [shooting, setShooting] = React.useState(false);

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

  const shoot = () => {
    setShooting(true);
    void phoneRequest<{ photo: string }>(`/phones/${encodeURIComponent(phoneId)}/camera/shot`, { method: "POST", body: JSON.stringify({}) })
      .then((response) => {
        if (!response.photo.trim()) return;
        const shot: Shot = { id: crypto.randomUUID(), text: response.photo, at: new Date().toISOString() };
        const next = [shot, ...(shots ?? [])].slice(0, 24);
        setShots(next);
        void store.set("shots", next).catch(() => undefined);
      })
      .catch(() => undefined)
      .finally(() => setShooting(false));
  };
  const latest = shots?.[0] ?? null;

  return (
    <section aria-labelledby="camera-title" className="vp-appview">
      <PhoneAppHeader title="Camera" titleId="camera-title" closeLabel="Close Camera" onBack={onBack} onClose={onClose} />
      <div className="vp-viewfinder" aria-live="polite">
        {shooting ? (
          <span className="vp-skeleton vp-skeleton--line" style={{ width: "70%" }} />
        ) : latest ? (
          <p className="vp-viewfinder-text">{latest.text}</p>
        ) : (
          <p className="vp-viewfinder-text vp-muted-note">Point the camera at the story and press the shutter.</p>
        )}
      </div>
      <div className="vp-shutter-row">
        <button type="button" aria-label="Take photo" onClick={shoot} disabled={shooting} className="vp-shutter" />
      </div>
      {shots === null ? null : shots.length > 0 ? (
        <>
          <h3 className="vp-section-label" style={{ marginTop: "0.75rem" }}>Camera roll</h3>
          <div className="vp-stack" style={{ gap: "0.5rem", marginTop: "0.625rem" }}>
            {shots.map((shot) => (
              <figure key={shot.id} className="vp-card vp-polaroid">
                <p>{shot.text}</p>
                <figcaption>{new Date(shot.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</figcaption>
              </figure>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
