import React from "react";
import { ChevronLeft, ChevronRight, EyeOff, Heart, Images, Search } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { PhoneEmptyState } from "../../platform/empty-state";
import { usePhoneStore } from "../../platform/use-phone-store";
import { ShareSheet } from "../../platform/share-sheet";

type GalleryView = "library" | "favorites" | "hidden";

export function GalleryShell({ phoneId, onSettingsPatch, openApp, messagesAvailable = false, noodleAvailable = false, onBack, onClose }: {
  phoneId: string;
  onSettingsPatch: (patch: Record<string, unknown>) => Promise<void>;
  openApp?: (appId: string, target?: { target?: string; draft?: string }) => void;
  messagesAvailable?: boolean;
  onBack: () => void;
  onClose: () => void;
  noodleAvailable?: boolean;
}) {
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
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const [sharing, setSharing] = React.useState(false);
  const [view, setView] = React.useState<GalleryView>("library");
  const [query, setQuery] = React.useState("");

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
    void Promise.all([store.get("captions"), store.get("hidden"), store.get("favorites")]).then(([savedCaptions, savedHidden, savedFavorites]) => {
      if (!active) return;
      if (savedCaptions && typeof savedCaptions === "object" && !Array.isArray(savedCaptions)) {
        setCaptions(savedCaptions as Record<string, string>);
      }
      if (Array.isArray(savedHidden)) setHidden(savedHidden.filter((url): url is string => typeof url === "string"));
      if (Array.isArray(savedFavorites)) setFavorites(savedFavorites.filter((url): url is string => typeof url === "string"));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [store]);

  const library = images ?? [];
  const collection = library.filter((url) => view === "hidden" ? hidden.includes(url) : !hidden.includes(url) && (view !== "favorites" || favorites.includes(url)));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = collection.filter((url) => !normalizedQuery || (captions[url] ?? "").toLocaleLowerCase().includes(normalizedQuery));
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
  const restore = (url: string) => {
    const next = hidden.filter((item) => item !== url);
    setHidden(next);
    void store.set("hidden", next).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The photo could not be restored."));
  };
  const toggleFavorite = (url: string) => {
    const removing = favorites.includes(url);
    const next = removing ? favorites.filter((item) => item !== url) : [...favorites, url];
    setFavorites(next);
    if (removing && view === "favorites") setOpenIndex(null);
    void store.set("favorites", next).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The favorite could not be saved."));
  };

  return (
    <section aria-labelledby="gallery-title" className="vp-appview" data-phone-app="gallery">
      <PhoneAppHeader
        title={openUrl ? "Photo" : view === "library" ? "Gallery" : view === "favorites" ? "Favorites" : "Hidden"}
        titleId="gallery-title"
        closeLabel="Close Gallery"
        onBack={() => openUrl ? setOpenIndex(null) : onBack()}
        onClose={onClose}
        actions={openUrl
          ? [
            { id: "favorite-photo", icon: "heart", label: favorites.includes(openUrl) ? "Remove from favorites" : "Add to favorites", kind: "button" },
            { id: "share-photo", icon: "menu", label: "Share photo", kind: "button" },
            { id: view === "hidden" ? "restore-photo" : "hide-photo", icon: view === "hidden" ? "refresh" : "trash", label: view === "hidden" ? "Restore photo" : "Hide photo", kind: "button" },
          ]
          : [{ id: "refresh-gallery", icon: "refresh", label: "Refresh gallery", kind: "button", disabled: loading, reason: "Refreshing" }]}
        onAction={(actionId) => {
          if (actionId === "refresh-gallery") load();
          if (actionId === "share-photo") setSharing(true);
          if (actionId === "favorite-photo" && openUrl) toggleFavorite(openUrl);
          if (actionId === "hide-photo" && openUrl) hide(openUrl);
          if (actionId === "restore-photo" && openUrl) { restore(openUrl); setOpenIndex(null); }
        }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {sharing && openUrl ? (
        <ShareSheet
          title="Share photo"
          onClose={() => setSharing(false)}
          actions={[
            { id: "wallpaper", label: "Set as wallpaper", run: () => onSettingsPatch({ wallpaper: openUrl }) },
            ...(messagesAvailable && openApp ? [{
              id: "messages",
              label: "Send in Messages",
              run: () => openApp("messages", {
                draft: [captions[openUrl]?.trim(), openUrl].filter(Boolean).join("\n"),
              }),
            }] : []),
            ...(noodleAvailable ? [{
              id: "noodle",
              label: "Post to Noodle",
              run: async () => {
                await phoneRequest(`/phones/${encodeURIComponent(phoneId)}/noodle/post`, {
                  method: "POST",
                  body: JSON.stringify({ text: captions[openUrl]?.trim() || "Took this.", image: openUrl }),
                });
              },
            }] : []),
          ]}
        />
      ) : null}
      {openUrl ? (
        <figure className="vp-photo-view">
          <div className="vp-photo-stage"><img src={openUrl} alt={captions[openUrl]?.trim() || "Photo from this story, undescribed"} />{favorites.includes(openUrl) ? <span className="vp-photo-favorite" aria-label="Favorite"><Heart size="0.8rem" fill="currentColor" aria-hidden="true" /></span> : null}</div>
          <figcaption className="vp-stack" style={{ gap: "0.5rem" }}>
            <label>
              <span className="vp-sr-only">Caption</span>
              <input
                key={openUrl}
                defaultValue={captions[openUrl] ?? ""}
                onBlur={(event) => setCaption(openUrl, event.target.value)}
                placeholder="Add a caption"
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
      ) : (
        <div className="vp-gallery-library">
          <nav className="vp-gallery-tabs" aria-label="Gallery views">
            <button type="button" aria-current={view === "library" ? "page" : undefined} onClick={() => { setView("library"); setQuery(""); }}>Photos <small>{library.filter((url) => !hidden.includes(url)).length}</small></button>
            <button type="button" aria-current={view === "favorites" ? "page" : undefined} onClick={() => { setView("favorites"); setQuery(""); }}>Favorites <small>{favorites.filter((url) => library.includes(url) && !hidden.includes(url)).length}</small></button>
            <button type="button" aria-current={view === "hidden" ? "page" : undefined} onClick={() => { setView("hidden"); setQuery(""); }}>Hidden <small>{hidden.filter((url) => library.includes(url)).length}</small></button>
          </nav>
          {collection.length > 0 ? <label className="vp-inline-search"><Search size="0.875rem" aria-hidden="true" /><span className="vp-sr-only">Search photo captions</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search captions" /></label> : null}
          {visible.length === 0 ? (
            <PhoneEmptyState
              icon={view === "favorites" ? Heart : view === "hidden" ? EyeOff : Images}
              title={normalizedQuery ? "No matching photos" : view === "favorites" ? "No favorites" : view === "hidden" ? "Nothing hidden" : "No photos"}
              body={normalizedQuery ? "Try another caption." : view === "favorites" ? "Mark the photos you want to find again." : view === "hidden" ? "Photos you hide stay here until you restore them." : "Story images and photos taken with Camera appear here."}
              action={normalizedQuery ? { label: "Clear search", onClick: () => setQuery("") } : undefined}
            />
          ) : <div className="vp-gallery-grid" aria-label={`${view} photos`} aria-busy={loading}>
            {visible.map((url, index) => (
              <button key={url} type="button" onClick={() => setOpenIndex(index)} className="vp-gallery-cell" aria-label={captions[url]?.trim() || "Open undescribed photo"}>
                <img src={url} alt="" loading="lazy" />
                {favorites.includes(url) ? <Heart className="vp-gallery-heart" size="0.75rem" fill="currentColor" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>}
        </div>
      )}
    </section>
  );
}
