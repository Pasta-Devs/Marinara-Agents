import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  SAUCELING_BACKGROUND_LIMIT,
  type SaucelingBackground,
  type SaucelingBackgroundsResponse,
  type SaucelingPet,
  type SaucelingStateResponse,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { sceneAssetPath } from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import { marinaraRequest, saucelingsRequest } from "./api.js";
import { FriendlyError } from "./care-ui.js";
import { loadImage } from "./image-canvas.js";
import { SCENE_NEGATIVE, sceneRequest, startingScene } from "./image-prompts.js";
import { useSaucelingsTranslation } from "./localization.js";

/** A background is shown at 16:9, so a picture is cropped to that and shrunk to at most this size before it is saved. */
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;
/** A file larger than this is refused before it is decoded. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Crops a picture to 16:9 from the middle, shrinks it to at most 1280x720 and encodes it as WebP, or as JPEG
 *  where the browser cannot write WebP (Safari returns PNG for it, which would be far larger). */
async function toBackgroundImage(src: string): Promise<string> {
  const image = await loadImage(src);
  const width = Math.min(image.naturalWidth, (image.naturalHeight * 16) / 9);
  const height = (width * 9) / 16;
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(MAX_WIDTH, Math.round(width));
  canvas.height = Math.min(MAX_HEIGHT, Math.round((canvas.width * 9) / 16));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize pictures.");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    (image.naturalWidth - width) / 2,
    (image.naturalHeight - height) / 2,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.88);
}

// ponytail: each saved background is its own request, which is fine for the library's 24; a larger library would
// want small thumbnails saved beside each picture.
function BackgroundImage({ id }: { id: string }) {
  const { t } = useSaucelingsTranslation();
  // The Nook's stage asks for the same picture under the same key, so a picked background is already loaded.
  const image = useQuery({
    queryKey: ["saucelings", "background", id],
    queryFn: () => saucelingsRequest<{ image: string }>(`/background/${encodeURIComponent(id)}`),
    staleTime: Infinity,
  });
  if (image.data) return <img className="sl-gallery-image" src={image.data.image} alt="" />;
  return (
    <span className="sl-gallery-image sl-gallery-blank">
      {image.isError ? t("saucelings.background.missing") : null}
    </span>
  );
}

/**
 * Where the Nook's background is changed: pick the built-in one or a saved one, upload a picture, or generate one
 * with the image connection from Settings. Every sauceling shares the saved ones. A picture is resized here, so
 * what reaches the server is small.
 */
export function BackgroundPicker({
  pet,
  settings,
  assetUrl,
  onClose,
}: {
  pet: SaucelingPet;
  settings: SaucelingStateResponse["world"]["settings"];
  assetUrl: (path: string) => string;
  onClose: () => void;
}) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  // Like the Nook's other panels, it takes focus as it opens, so it scrolls into view on a phone.
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.focus();
  }, []);
  const [prompt, setPrompt] = useState(() => startingScene(pet));
  const [confirmDelete, setConfirmDelete] = useState<SaucelingBackground | null>(null);
  const library = useQuery({
    queryKey: ["saucelings", "backgrounds"],
    queryFn: () => saucelingsRequest<SaucelingBackgroundsResponse>("/backgrounds"),
    refetchOnMount: "always",
  });
  const backgrounds = library.data?.backgrounds ?? [];
  const full = backgrounds.length >= SAUCELING_BACKGROUND_LIMIT;
  const labelOf = (background: SaucelingBackground) => background.label || t("saucelings.background.earlier");

  const saved = (next: SaucelingStateResponse) => {
    queryClient.setQueryData(["saucelings", "state"], next);
    void queryClient.invalidateQueries({ queryKey: ["saucelings", "backgrounds"] });
  };

  // One report for all five actions: starting any of them clears the last failure, and a failure replaces it, so an
  // earlier failed action never hides a later one or lingers after a success.
  const [actionError, setActionError] = useState<unknown>(null);
  const reporting = { onMutate: () => setActionError(null), onError: (error: unknown) => setActionError(error) };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_FILE_BYTES) throw new Error(t("saucelings.background.tooBig"));
      const url = URL.createObjectURL(file);
      try {
        const image = await toBackgroundImage(url);
        const label = file.name.replace(/\.[^.]+$/u, "").slice(0, 120);
        return await saucelingsRequest<SaucelingStateResponse>("/background", "POST", {
          image,
          label,
          source: "upload",
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    onSuccess: saved,
    ...reporting,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!settings.portraitConnectionId) throw new Error(t("saucelings.background.noConnection"));
      const full = sceneRequest(prompt);
      const generated = await marinaraRequest<{ image: string }>("/api/characters/avatar-generation", "POST", {
        connectionId: settings.portraitConnectionId,
        name: "sauceling-background",
        appearance: full,
        width: MAX_WIDTH,
        height: MAX_HEIGHT,
        // The Engine's "Off" style profile, so the user's own image style cannot pull away from pixel art.
        styleProfileId: "off",
        // The prompt replaces the Engine's portrait wording, which would otherwise ask for a face.
        promptOverrides: [{ id: "avatar:sauceling-background", prompt: full, negativePrompt: SCENE_NEGATIVE }],
      });
      const image = await toBackgroundImage(generated.image);
      return saucelingsRequest<SaucelingStateResponse>("/background", "POST", {
        image,
        label: prompt.trim().slice(0, 120),
        source: "generated",
      });
    },
    onSuccess: saved,
    ...reporting,
  });

  // The writing connection suggests a place that suits the sauceling; without one, the box gets the starting prompt.
  // The box is locked while it answers (see below), so the answer never replaces something typed meanwhile.
  const suggestMutation = useMutation({
    mutationFn: () => saucelingsRequest<{ scene: string | null }>("/background/suggest", "POST", {}),
    onSuccess: ({ scene }) => setPrompt(scene ?? startingScene(pet)),
    ...reporting,
  });

  // null is the species' built-in background.
  const selectMutation = useMutation({
    mutationFn: (id: string | null) =>
      saucelingsRequest<SaucelingStateResponse>(
        id ? `/background/${encodeURIComponent(id)}/select` : "/background/clear",
        "POST",
        {},
      ),
    onSuccess: saved,
    ...reporting,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      saucelingsRequest<SaucelingStateResponse>(`/background/${encodeURIComponent(id)}/delete`, "POST", {}),
    onSuccess: (next) => {
      setConfirmDelete(null);
      saved(next);
    },
    ...reporting,
  });

  const busy =
    uploadMutation.isPending ||
    generateMutation.isPending ||
    suggestMutation.isPending ||
    selectMutation.isPending ||
    deleteMutation.isPending;
  const failure = actionError ?? library.error;
  const cannotGenerate = !settings.portraitEnabled
    ? t("saucelings.background.off")
    : !settings.portraitConnectionId
      ? t("saucelings.background.noConnection")
      : null;

  return (
    <section
      ref={section}
      className="sl-card sl-picker"
      tabIndex={-1}
      aria-label={t("saucelings.background.title")}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <strong>{t("saucelings.background.title")}</strong>

      <div className="sl-gallery sl-gallery--wide" role="group" aria-label={t("saucelings.background.library")}>
        <button
          type="button"
          className="sl-gallery-tile"
          aria-label={t("saucelings.background.useBuiltIn")}
          title={t("saucelings.background.useBuiltIn")}
          aria-pressed={pet.backgroundId === null}
          disabled={busy}
          onClick={() => pet.backgroundId !== null && selectMutation.mutate(null)}
        >
          <img className="sl-gallery-image sl-stage-bg--pixel" src={assetUrl(sceneAssetPath(pet))} alt="" />
        </button>
        {backgrounds.map((background) => (
          <div key={background.id} className="sl-gallery-item">
            <button
              type="button"
              className="sl-gallery-tile"
              aria-label={t("saucelings.background.tileAlt", { label: labelOf(background) })}
              title={labelOf(background)}
              aria-pressed={pet.backgroundId === background.id}
              disabled={busy}
              onClick={() => pet.backgroundId !== background.id && selectMutation.mutate(background.id)}
            >
              <BackgroundImage id={background.id} />
            </button>
            <button
              type="button"
              className="sl-gallery-remove"
              aria-label={t("saucelings.background.delete", { label: labelOf(background) })}
              title={t("saucelings.background.delete", { label: labelOf(background) })}
              disabled={busy}
              onClick={() => setConfirmDelete(background)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <span className="sl-box-note">{t("saucelings.background.sharedNote")}</span>

      {confirmDelete ? (
        <div
          className="sl-picker-row"
          role="group"
          aria-label={t("saucelings.background.delete", { label: labelOf(confirmDelete) })}
        >
          <span className="sl-box-note">
            {t("saucelings.background.deleteNote", { label: labelOf(confirmDelete) })}
          </span>
          <button
            type="button"
            className="sl-btn sl-btn--danger"
            disabled={busy}
            onClick={() => deleteMutation.mutate(confirmDelete.id)}
          >
            {t("saucelings.background.deleteConfirm")}
          </button>
          <button type="button" className="sl-btn" onClick={() => setConfirmDelete(null)}>
            {t("saucelings.common.cancel")}
          </button>
        </div>
      ) : null}

      <div className="sl-picker-row">
        <input
          ref={fileInput}
          type="file"
          className="sl-sr-only"
          accept="image/png,image/jpeg,image/webp"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) uploadMutation.mutate(file);
          }}
        />
        <button type="button" className="sl-btn" disabled={busy || full} onClick={() => fileInput.current?.click()}>
          {uploadMutation.isPending ? t("saucelings.background.uploading") : `⬆ ${t("saucelings.background.upload")}`}
        </button>
        <button type="button" className="sl-btn" onClick={onClose}>
          {t("saucelings.album.close")}
        </button>
        {full ? (
          <span className="sl-box-note">{t("saucelings.background.full", { limit: SAUCELING_BACKGROUND_LIMIT })}</span>
        ) : null}
      </div>

      <label className="sl-picker-label" htmlFor="sl-background-prompt">
        {t("saucelings.background.promptLabel")}
      </label>
      <textarea
        id="sl-background-prompt"
        className="sl-input sl-picker-prompt"
        rows={3}
        maxLength={600}
        value={prompt}
        disabled={suggestMutation.isPending}
        onChange={(event) => {
          setPrompt(event.target.value);
          suggestMutation.reset();
        }}
      />
      <div className="sl-picker-row">
        <button
          type="button"
          className="sl-btn"
          disabled={busy || cannotGenerate !== null}
          onClick={() => suggestMutation.mutate()}
        >
          {suggestMutation.isPending
            ? t("saucelings.background.suggesting")
            : `✍ ${pet.stage === "egg" ? t("saucelings.background.suggestEgg") : t("saucelings.background.suggest", { name: pet.name })}`}
        </button>
        <button
          type="button"
          className="sl-btn sl-btn--primary"
          disabled={busy || full || cannotGenerate !== null || !prompt.trim()}
          onClick={() => generateMutation.mutate()}
        >
          {generateMutation.isPending
            ? t("saucelings.background.generating")
            : `✨ ${t("saucelings.background.generate")}`}
        </button>
        {cannotGenerate ? <span className="sl-box-note">{cannotGenerate}</span> : null}
        {suggestMutation.data?.scene === null ? (
          <span className="sl-box-note">{t("saucelings.background.suggestPlain")}</span>
        ) : null}
      </div>

      {failure ? (
        <span role="alert" className="sl-error">
          <FriendlyError error={failure} />
        </span>
      ) : null}
    </section>
  );
}
