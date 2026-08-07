import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";
import { ShareSheet } from "../../platform/share-sheet";

export function GalleryShell({ phoneId, onSettingsPatch, onBack, onClose }: { phoneId: string; onSettingsPatch: (patch: Record<string, unknown>) => Promise<void>; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "gallery");
  const [images, setImages] = React.useState<string[] | null>(null);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /**
   * Captions are a field the Gallery owns, keyed by image URL, so Step 11.3 can populate them from
   * the Engine's stored generation prompt by changing only where they come from. They double as
   * real alt text — every image was `alt=""`, which is an accessibility hole as much as a UX one.
   */
  const [captions, setCaptions] = React.useState<Record<string, string>>({});
  /** Hidden images stay out of the grid without the phone being able to delete chat history. */
  const [hidden, setHidden] = React.useState<string[]>([]);
  const [sharing, setSharing] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    void phoneRequest<{ images: string[] }>(`/phones/${encodeURIComponent(phoneId)}/gallery`)
      .then((response) => setImages(response.images))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "The gallery could not be loaded.");
        setImages((current) => current ?? []);
      })
      .finally(() => setLoading(false));
  }, [phoneId]);

  React.useEffect(() => {
    setImages(null);
    setOpenIndex(null);
    load();
  }, [load]);

  React.useEffect(() => {
    let active = true;
    void Promise.all([store.get("captions"), store.get("hidden")]).then(([savedCaptions, savedHidden]) => {
      if (!active) return;
      if (savedCaptions && typeof savedCaptions === "object" && !Array.isArray(savedCaptions)) {
        setCaptions(savedCaptions as Record<string, string>);
      }
      if (Array.isArray(savedHidden)) setHidden(savedHidden.filter((url): url is string => typeof url === "string"));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [store]);

  const visible = (images ?? []).filter((url) => !hidden.includes(url));
  const openUrl = openIndex !== null ? visible[openIndex] ?? null : null;

  const step = React.useCallback((delta: number) => {
    setOpenIndex((current) => {
      if (current === null || visible.length === 0) return current;
      return (current + delta + visible.length) % visible.length;
    });
  }, [visible.length]);

  React.useEffect(() => {
    if (openUrl === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openUrl, step]);

  const setCaption = (url: string, caption: string) => {
    const next = { ...captions, [url]: caption };
    setCaptions(next);
    void store.set("captions", next).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "The caption could not be saved.");
    });
  };
  const hide = (url: string) => {
    const next = [...hidden, url];
    setHidden(next);
    setOpenIndex(null);
    void store.set("hidden", next).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "The photo could not be hidden.");
    });
  };

  return (
    <section aria-labelledby="gallery-title" className="vp-appview">
      <PhoneAppHeader
        title={openUrl ? "Photo" : "Gallery"}
        titleId="gallery-title"
        closeLabel="Close Gallery"
        onBack={() => openUrl ? setOpenIndex(null) : onBack()}
        onClose={onClose}
        actions={openUrl
          ? [
            { id: "share-photo", icon: "menu", label: "Share photo", kind: "button" },
            { id: "hide-photo", icon: "trash", label: "Hide photo", kind: "button" },
          ]
          : [{ id: "refresh-gallery", icon: "refresh", label: "Refresh gallery", kind: "button", disabled: loading, reason: "Refreshing" }]}
        onAction={(actionId) => {
          if (actionId === "refresh-gallery") load();
          if (actionId === "share-photo") setSharing(true);
          if (actionId === "hide-photo" && openUrl) hide(openUrl);
        }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {sharing && openUrl ? (
        <ShareSheet
          title="Share photo"
          onClose={() => setSharing(false)}
          actions={[
            { id: "wallpaper", label: "Set as wallpaper", run: () => onSettingsPatch({ wallpaper: openUrl }) },
            {
              id: "noodle",
              label: "Post to Noodle",
              run: async () => {
                await phoneRequest(`/phones/${encodeURIComponent(phoneId)}/noodle/post`, {
                  method: "POST",
                  body: JSON.stringify({ text: captions[openUrl]?.trim() || "Took this.", image: openUrl }),
                });
              },
            },
          ]}
        />
      ) : null}
      {openUrl ? (
        <figure className="vp-photo-view">
          <img src={openUrl} alt={captions[openUrl]?.trim() || "Photo from this story, undescribed"} />
          <figcaption className="vp-stack" style={{ gap: "0.5rem" }}>
            <label>
              <span className="vp-sr-only">Caption</span>
              <input
                key={openUrl}
                defaultValue={captions[openUrl] ?? ""}
                onBlur={(event) => setCaption(openUrl, event.target.value)}
                placeholder="Describe this photo"
                maxLength={300}
                className="vp-input"
              />
            </label>
            {visible.length > 1 ? (
              <span className="vp-shutter-row" style={{ gap: "0.5rem" }}>
                <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="vp-icon-btn"><ChevronLeft size="1rem" aria-hidden="true" /></button>
                <span className="vp-muted-note">{(openIndex ?? 0) + 1} of {visible.length}</span>
                <button type="button" onClick={() => step(1)} aria-label="Next photo" className="vp-icon-btn"><ChevronRight size="1rem" aria-hidden="true" /></button>
              </span>
            ) : null}
          </figcaption>
        </figure>
      ) : !images ? (
        <div role="status" aria-label="Loading gallery" className="vp-gallery-grid">
          {[0, 1, 2, 3, 4, 5].map((index) => <span key={index} className="vp-skeleton vp-gallery-skeleton" />)}
        </div>
      ) : visible.length === 0 ? (
        <p className="vp-muted-note">No photos yet. Images that appear in this story's chat show up here.</p>
      ) : (
        <div className="vp-gallery-grid" aria-label="Story photos" aria-busy={loading}>
          {visible.map((url, index) => (
            <button key={url} type="button" onClick={() => setOpenIndex(index)} className="vp-gallery-cell" aria-label={captions[url]?.trim() || "Open undescribed photo"}>
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
