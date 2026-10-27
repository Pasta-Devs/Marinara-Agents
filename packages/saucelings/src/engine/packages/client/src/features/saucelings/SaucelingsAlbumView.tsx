import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type {
  SaucelingMenagerieResponse,
  SaucelingPet,
  SaucelingPortraitHome,
  SaucelingPortraitsResponse,
  SaucelingStage,
  SaucelingStateResponse,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  PAINT_INSTRUCTIONS_CHARS,
  SAUCELING_PORTRAIT_LIMIT,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  sceneAssetPath,
  spriteStateForPet,
  spriteStrip,
} from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import { marinaraRequest, packageAssetUrl, saucelingsRequest } from "./api.js";
import { FriendlyError } from "./care-ui.js";
import { FormPainter } from "./FormPainter.js";
import { formQuery, PetSprite } from "./PetSprite.js";
import { albumPainting, spriteReference } from "./image-canvas.js";
import { portraitAppearance, portraitNegative } from "./image-prompts.js";
import { useSaucelingsTranslation } from "./localization.js";

type Painting = SaucelingPortraitsResponse["portraits"][number];

/** An evolved sauceling in the nook or the Menagerie, kept in the Album as it was and as it is now. */
interface Keepsake {
  petId: string;
  name: string;
  home: SaucelingPortraitHome;
  art: Pick<SaucelingPet, "design" | "forms" | "evolution">;
  species: SaucelingPet["species"];
  stage: Exclude<SaucelingStage, "egg">;
  backgroundId: string | null;
  form: string;
  at: string | null;
}

/** Before and after, side by side on its Nook background (the species' own when it has none), drawn here rather
 *  than painted. A custom background is the same request the Nook makes, so it is often loaded already. */
function KeepsakePicture({
  keepsake,
  assetUrl,
  large = false,
}: {
  keepsake: Keepsake;
  assetUrl: (path: string) => string;
  large?: boolean;
}) {
  const { t } = useSaucelingsTranslation();
  const { backgroundId } = keepsake;
  const background = useQuery({
    queryKey: ["saucelings", "background", backgroundId],
    queryFn: () => saucelingsRequest<{ image: string }>(`/background/${encodeURIComponent(backgroundId ?? "")}`),
    enabled: backgroundId !== null,
    staleTime: Infinity,
  });
  const src = backgroundId
    ? (background.data?.image ?? null)
    : assetUrl(sceneAssetPath({ species: keepsake.species, stage: keepsake.stage }));
  const before = { ...keepsake.art, evolution: { ...keepsake.art.evolution, look: null } };
  const sides = [
    { art: before, label: t("saucelings.album.before") },
    { art: keepsake.art, label: t("saucelings.album.after") },
  ];
  return (
    <span className={`sl-keepsake${large ? " sl-keepsake--large" : ""}`}>
      {src ? <img className={`sl-stage-bg ${backgroundId ? "" : "sl-stage-bg--pixel"}`} src={src} alt="" /> : null}
      {sides.map((side) => (
        <span key={side.label} className="sl-keepsake-side">
          <PetSprite
            art={side.art}
            species={keepsake.species}
            stage={keepsake.stage}
            mood="happy"
            assetUrl={assetUrl}
            alt=""
            scale={large ? 2 : 1}
            still
            frontOnly
          />
          {large ? <span className="sl-keepsake-label">{side.label}</span> : null}
        </span>
      ))}
    </span>
  );
}

// ponytail: each painting is its own request, which is fine for dozens; past that, page the list.
function PaintingImage({ id, className, alt }: { id: string; className: string; alt: string }) {
  const { t } = useSaucelingsTranslation();
  const image = useQuery({
    queryKey: ["saucelings", "portrait", id],
    queryFn: () => saucelingsRequest<{ image: string }>(`/portrait/${encodeURIComponent(id)}`),
    staleTime: Infinity,
  });
  if (image.data) return <img className={className} src={image.data.image} alt={alt} />;
  return (
    <span className={`${className} sl-gallery-blank`}>{image.isError ? t("saucelings.album.missing") : null}</span>
  );
}

export function SaucelingsAlbumView({
  state,
  packageId,
  packageVersion,
}: {
  state: SaucelingStateResponse;
  packageId?: string;
  packageVersion?: string | null;
}) {
  const { t } = useSaucelingsTranslation();
  const assetUrl = (path: string) => packageAssetUrl(packageId, path, packageVersion);
  const queryClient = useQueryClient();
  const pet = state.world.activePet;
  const settings = state.world.settings;
  const [openId, setOpenId] = useState<string | null>(null);
  const [keepsakeId, setKeepsakeId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The player's own words for the next painting, kept after a paint so they can paint again.
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const viewerRef = useRef<HTMLDivElement>(null);
  // The viewer opens above the paintings, so take the reader there.
  useEffect(() => {
    if (openId || keepsakeId) viewerRef.current?.focus();
  }, [openId, keepsakeId]);
  const portraitsQuery = useQuery({
    queryKey: ["saucelings", "portraits"],
    queryFn: () => saucelingsRequest<SaucelingPortraitsResponse>("/portraits"),
    refetchOnMount: "always",
  });
  const portraits = portraitsQuery.data?.portraits ?? [];
  const menagerieQuery = useQuery({
    queryKey: ["saucelings", "menagerie"],
    queryFn: () => saucelingsRequest<SaucelingMenagerieResponse>("/menagerie"),
    enabled: state.menagerieCount > 0,
  });

  // A keepsake for each evolved sauceling in the nook or the Menagerie, at the stage it shows now. An old-style
  // evolved one has no look to set beside how it was, and a released one is gone, so neither has one.
  const keepsakes: Keepsake[] = [];
  if (pet?.evolution.look && pet.stage !== "egg") {
    const stage = spriteStateForPet(pet).stage;
    keepsakes.push({
      petId: pet.id,
      name: pet.name,
      home: "nook",
      art: pet,
      species: pet.species,
      stage: stage === "egg" ? "hatchling" : stage,
      backgroundId: pet.backgroundId,
      form: pet.evolution.look.form,
      at: pet.evolution.at,
    });
  }
  // A query that is switched off keeps what it last held, so a Menagerie that has since emptied (the last one restored
  // or released) is read as empty, and a restored pet is the nook's own keepsake, not its old Menagerie entry.
  for (const entry of state.menagerieCount > 0 ? (menagerieQuery.data?.menagerie ?? []) : []) {
    const stage = entry.reachedElder ? "elder" : (entry.lockedStage ?? entry.stageAtRetirement);
    if (!entry.evolution.look || stage === "egg" || entry.id === pet?.id) continue;
    keepsakes.push({
      petId: entry.id,
      name: entry.name,
      home: "menagerie",
      art: entry,
      species: entry.species,
      stage,
      backgroundId: entry.backgroundId,
      form: entry.evolution.look.form,
      at: entry.evolution.at,
    });
  }

  const afterChange = (next: SaucelingStateResponse) => {
    queryClient.setQueryData(["saucelings", "state"], next);
    void queryClient.invalidateQueries({ queryKey: ["saucelings", "portraits"] });
  };

  const paintMutation = useMutation({
    mutationFn: async (target: SaucelingPet) => {
      if (!settings.portraitConnectionId) throw new Error(t("saucelings.album.needsConnection"));
      // The sprite (or the painted form of an invented sauceling) goes along as a reference picture, so the
      // painting shows this creature; a model that takes no pictures ignores it, and one that will not load is left
      // out. An invented sauceling with no form yet has no picture to send: its species sprite is not what it is.
      const stage = spriteStateForPet(target).stage;
      const formId = target.forms[stage];
      const sprite = spriteStrip(target.species, stage, "content");
      const source = formId
        ? queryClient.fetchQuery(formQuery(formId, true)).then((form) => spriteReference(form.image))
        : target.design
          ? null
          : spriteReference(assetUrl(sprite.path), sprite.row);
      const reference = source ? await source.catch(() => null) : null;
      // Hidden instructions keep their words for next time but are not sent.
      const wish = instructionsOpen ? instructions.replace(/\s+/gu, " ").trim() : "";
      const prompt = portraitAppearance(target, reference !== null, wish);
      const generated = await marinaraRequest<{ image: string }>("/api/characters/avatar-generation", "POST", {
        connectionId: settings.portraitConnectionId,
        // The name gives the override's id, so the request is exactly this prompt and none of the Engine's own, which
        // would ask for a face-and-shoulders chat avatar.
        name: "sauceling-portrait",
        appearance: prompt,
        promptOverrides: [{ id: "avatar:sauceling-portrait", prompt, negativePrompt: portraitNegative(wish) }],
        // The Engine's "Off" style profile, so the user's own image style cannot pull away from pixel art.
        styleProfileId: "off",
        ...(reference ? { referenceImages: [reference] } : {}),
      });
      // A painting that will not load into a canvas goes as it came.
      const image = await albumPainting(generated.image).catch(() => generated.image);
      return saucelingsRequest<SaucelingStateResponse>("/portrait", "POST", {
        petId: target.id,
        image,
        instructions: wish,
      });
    },
    onSuccess: afterChange,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      saucelingsRequest<SaucelingStateResponse>(`/portrait/${encodeURIComponent(id)}/delete`, "POST", {}),
    onSuccess: (next) => {
      setOpenId(null);
      setConfirmDelete(false);
      afterChange(next);
    },
  });

  // One group per sauceling: the one in the nook first, then the rest by their newest painting, then evolved ones
  // with only a keepsake. A keepsake leads its group.
  type Group = {
    petId: string;
    name: string;
    home: SaucelingPortraitHome;
    keepsake: Keepsake | null;
    paintings: Painting[];
  };
  const groups = new Map<string, Group>();
  for (const painting of portraits) {
    const group = groups.get(painting.petId) ?? {
      petId: painting.petId,
      name: painting.petName,
      home: painting.home,
      keepsake: null,
      paintings: [],
    };
    group.paintings.push(painting);
    groups.set(painting.petId, group);
  }
  for (const keepsake of keepsakes) {
    const group = groups.get(keepsake.petId);
    if (group) group.keepsake = keepsake;
    else
      groups.set(keepsake.petId, {
        petId: keepsake.petId,
        name: keepsake.name,
        home: keepsake.home,
        keepsake,
        paintings: [],
      });
  }
  const ordered = [...groups.values()].sort((a, b) => Number(b.home === "nook") - Number(a.home === "nook"));
  const open = portraits.find((painting) => painting.id === openId) ?? null;
  const openKeepsake = keepsakes.find((keepsake) => keepsake.petId === keepsakeId) ?? null;
  const failure = paintMutation.error ?? deleteMutation.error ?? portraitsQuery.error;

  const paintNote = !settings.portraitEnabled
    ? t("saucelings.album.off")
    : !pet
      ? t("saucelings.album.noPet")
      : pet.stage === "egg"
        ? t("saucelings.album.egg")
        : state.portraitCount >= SAUCELING_PORTRAIT_LIMIT
          ? t("saucelings.album.full", { limit: SAUCELING_PORTRAIT_LIMIT })
          : null;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="sl-card" style={{ display: "grid", gap: "0.6rem", justifyItems: "start" }}>
        {paintNote || !pet ? (
          <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>{paintNote}</span>
        ) : (
          <>
            <button
              type="button"
              className="sl-btn sl-btn--primary"
              disabled={paintMutation.isPending}
              onClick={() => {
                // Only a finished failure is cleared: reset() would also let go of a delete still in flight.
                if (deleteMutation.isError) deleteMutation.reset();
                paintMutation.mutate(pet);
              }}
            >
              {paintMutation.isPending
                ? t("saucelings.album.painting")
                : `🎨 ${t("saucelings.album.paint", { name: pet.name })}`}
            </button>
            <button
              type="button"
              className="sl-link"
              disabled={paintMutation.isPending}
              onClick={() => setInstructionsOpen(!instructionsOpen)}
            >
              {instructionsOpen ? t("saucelings.album.removeInstructions") : t("saucelings.album.addInstructions")}
            </button>
            {instructionsOpen ? (
              <div style={{ display: "grid", gap: "0.3rem", width: "100%" }}>
                <label className="sl-picker-label" htmlFor="sl-paint-instructions">
                  {t("saucelings.album.instructionsLabel")}
                </label>
                <textarea
                  id="sl-paint-instructions"
                  className="sl-input sl-picker-prompt"
                  rows={2}
                  maxLength={PAINT_INSTRUCTIONS_CHARS}
                  placeholder={t("saucelings.album.instructionsPlaceholder")}
                  disabled={paintMutation.isPending}
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                />
                <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{t("saucelings.album.instructionsNote")}</span>
              </div>
            ) : null}
          </>
        )}
        {failure ? (
          <span role="alert" className="sl-error">
            <FriendlyError error={failure} />
          </span>
        ) : null}
        {pet && !paintNote ? <FormPainter state={state} assetUrl={assetUrl} /> : null}
      </div>

      {openKeepsake ? (
        <div className="sl-card sl-viewer" ref={viewerRef} tabIndex={-1}>
          <KeepsakePicture keepsake={openKeepsake} assetUrl={assetUrl} large />
          <div style={{ fontSize: "0.85rem" }}>
            {t("saucelings.album.keepsakeCaption", {
              name: openKeepsake.name,
              form: openKeepsake.form,
              date: openKeepsake.at ? new Date(openKeepsake.at).toLocaleDateString() : "",
            })}
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>{t("saucelings.album.keepsakeNote")}</div>
          <button type="button" className="sl-btn" onClick={() => setKeepsakeId(null)}>
            {t("saucelings.album.close")}
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="sl-card sl-viewer" ref={viewerRef} tabIndex={-1}>
          <PaintingImage
            id={open.id}
            className="sl-viewer-image"
            alt={t("saucelings.album.alt", { name: open.petName })}
          />
          <div style={{ fontSize: "0.85rem" }}>
            <strong>{open.petName}</strong>{" "}
            <span style={{ opacity: 0.75 }}>
              {t("saucelings.album.caption", {
                stage: t(`saucelings.stage.${open.stage}`),
                date: new Date(open.savedAt).toLocaleDateString(),
              })}
            </span>
            {open.instructions ? (
              <div style={{ fontStyle: "italic", opacity: 0.75 }}>
                {t("saucelings.album.instructionsCaption", { instructions: open.instructions })}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  className="sl-btn sl-btn--danger"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (paintMutation.isError) paintMutation.reset();
                    deleteMutation.mutate(open.id);
                  }}
                >
                  {t("saucelings.album.deleteConfirm")}
                </button>
                <button type="button" className="sl-btn" onClick={() => setConfirmDelete(false)}>
                  {t("saucelings.common.cancel")}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="sl-btn" onClick={() => setConfirmDelete(true)}>
                  {t("saucelings.album.delete")}
                </button>
                <button type="button" className="sl-btn" onClick={() => setOpenId(null)}>
                  {t("saucelings.album.close")}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {portraitsQuery.isLoading ? (
        <div className="sl-card" style={{ textAlign: "center", padding: "2rem", opacity: 0.75 }}>
          {t("saucelings.loading")}
        </div>
      ) : ordered.length === 0 ? (
        <div className="sl-card" style={{ textAlign: "center", padding: "2rem", opacity: 0.75 }}>
          {t("saucelings.album.empty")}
          {pet && !paintNote ? ` ${t("saucelings.album.emptyHint")}` : null}
        </div>
      ) : (
        ordered.map((group) => (
          <div key={group.petId} className="sl-card" style={{ display: "grid", gap: "0.6rem" }}>
            <div style={{ fontSize: "0.9rem" }}>
              <strong>{group.name}</strong>{" "}
              <span style={{ opacity: 0.7 }}>
                {group.home === "menagerie"
                  ? t("saucelings.album.inMenagerie")
                  : group.home === "released"
                    ? t("saucelings.album.released")
                    : ""}
              </span>
            </div>
            <div className="sl-gallery">
              {group.keepsake ? (
                <button
                  type="button"
                  className="sl-gallery-tile"
                  aria-label={t("saucelings.album.keepsakeLabel", { name: group.name })}
                  aria-pressed={group.petId === keepsakeId}
                  onClick={() => {
                    setOpenId(null);
                    setKeepsakeId(group.petId);
                  }}
                >
                  <KeepsakePicture keepsake={group.keepsake} assetUrl={assetUrl} />
                </button>
              ) : null}
              {group.paintings.map((painting) => (
                <button
                  key={painting.id}
                  type="button"
                  className="sl-gallery-tile"
                  aria-label={t("saucelings.album.alt", { name: painting.petName })}
                  aria-pressed={painting.id === openId}
                  onClick={() => {
                    setConfirmDelete(false);
                    setKeepsakeId(null);
                    setOpenId(painting.id);
                  }}
                >
                  <PaintingImage id={painting.id} className="sl-gallery-image" alt="" />
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
