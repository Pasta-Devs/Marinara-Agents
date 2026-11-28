// ──────────────────────────────────────────────
// Otome Forge: a background from the Engine's library for a story place (#2147). Choosing one paints nothing: the place
// shows it from then on, in the reader, on Home, on dates and in photos. A search by name or tag, a grid of thumbnails
// (two across on a phone, four on a desktop) and the library's loading, empty and failed states.
// ──────────────────────────────────────────────
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOtomeApi } from "../api";
import { useEngineBackgrounds } from "../hooks/use-engine-resources";
import { Dialog } from "./Dialog";
import { CheckAgain, RetryNotice } from "./RetryNotice";

/** The Engine's thumbnail width for backgrounds (its BACKGROUND_THUMBNAIL_WIDTH). */
const THUMBNAIL_WIDTH = 320;

interface BackgroundPickerProps {
  place: string;
  /** Saves the choice; a rejection is shown in the picker, which stays open. */
  onChoose: (url: string) => Promise<void>;
  onClose: () => void;
}

export function BackgroundPicker({ place, onChoose, onClose }: BackgroundPickerProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const library = useEngineBackgrounds();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchId = useId();
  const noteId = useId();
  const words = query.trim().toLocaleLowerCase();
  const shown = words
    ? library.backgrounds.filter((background) =>
        [background.name, ...background.tags].some((text) => text.toLocaleLowerCase().includes(words)),
      )
    : library.backgrounds;

  const choose = async (url: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onChoose(url);
      onClose();
    } catch (failure) {
      setError(otome.errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <Dialog
      wide
      title={t("ui.otomeForge.reader.backgroundPickerTitle", { place })}
      describedBy={noteId}
      onClose={onClose}
      actions={
        <button type="button" className="of-button of-button--quiet of-glass" onClick={onClose}>
          {t("ui.otomeForge.reader.cancel")}
        </button>
      }
    >
      <p id={noteId} className="of-hint of-bg-note">
        {t("ui.otomeForge.reader.backgroundPickerNote")}
      </p>
      {library.isLoading ? (
        <p className="of-hint" role="status">
          {t("ui.otomeForge.reader.backgroundLoading")}
        </p>
      ) : library.isError ? (
        <RetryNotice
          message={t("ui.otomeForge.reader.backgroundFailed")}
          onRetry={() => void library.refetch()}
          retrying={library.retrying}
        />
      ) : library.backgrounds.length === 0 ? (
        <div className="of-empty">
          <p>{t("ui.otomeForge.reader.backgroundEmpty")}</p>
          <CheckAgain onCheck={library.refetch} />
        </div>
      ) : (
        <>
          <label className="of-label" htmlFor={searchId}>
            {t("ui.otomeForge.reader.backgroundSearch")}
          </label>
          <input
            id={searchId}
            type="search"
            className="of-input of-bg-search"
            value={query}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
          {shown.length ? (
            <ul className="of-bg-grid">
              {shown.map((background) => (
                <li key={background.url}>
                  <button
                    type="button"
                    className="of-bg-tile"
                    aria-disabled={busy || undefined}
                    aria-label={[background.name, ...background.tags].join(", ")}
                    onClick={() => void choose(background.url)}
                  >
                    <img src={`${background.url}?w=${THUMBNAIL_WIDTH}`} alt="" loading="lazy" decoding="async" />
                    <span className="of-bg-name">{background.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="of-hint" role="status">
              {t("ui.otomeForge.reader.backgroundNoMatch")}
            </p>
          )}
        </>
      )}
      <div role="alert" className="of-live">
        {error ? <p className="of-notice of-notice--error">{error}</p> : null}
      </div>
      <span className="of-visually-hidden" role="status">
        {busy ? t("ui.otomeForge.reader.backgroundChoosing") : ""}
      </span>
    </Dialog>
  );
}
