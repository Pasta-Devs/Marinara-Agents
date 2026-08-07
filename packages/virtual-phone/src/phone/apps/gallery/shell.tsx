import React from "react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";

export function GalleryShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const [images, setImages] = React.useState<string[] | null>(null);
  const [openImage, setOpenImage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    void phoneRequest<{ images: string[] }>(`/phones/${encodeURIComponent(phoneId)}/gallery`)
      .then((response) => setImages(response.images))
      .catch(() => setImages((current) => current ?? []))
      .finally(() => setLoading(false));
  }, [phoneId]);

  React.useEffect(() => {
    setImages(null);
    setOpenImage(null);
    load();
  }, [load]);

  return (
    <section aria-labelledby="gallery-title" className="vp-appview">
      <PhoneAppHeader
        title={openImage ? "Photo" : "Gallery"}
        titleId="gallery-title"
        closeLabel="Close Gallery"
        onBack={() => openImage ? setOpenImage(null) : onBack()}
        onClose={onClose}
        actions={openImage ? [] : [{ id: "refresh-gallery", icon: "refresh", label: "Refresh gallery", kind: "button", disabled: loading, reason: "Refreshing" }]}
        onAction={(actionId) => { if (actionId === "refresh-gallery") load(); }}
      />
      {openImage ? (
        <figure className="vp-photo-view">
          <img src={openImage} alt="Photo from this story" />
        </figure>
      ) : !images ? (
        <div role="status" aria-label="Loading gallery" className="vp-gallery-grid">
          {[0, 1, 2, 3, 4, 5].map((index) => <span key={index} className="vp-skeleton vp-gallery-skeleton" />)}
        </div>
      ) : images.length === 0 ? (
        <p className="vp-muted-note">No photos yet. Images that appear in this story's chat show up here.</p>
      ) : (
        <div className="vp-gallery-grid" aria-label="Story photos" aria-busy={loading}>
          {images.map((url) => (
            <button key={url} type="button" onClick={() => setOpenImage(url)} className="vp-gallery-cell" aria-label="Open photo">
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
