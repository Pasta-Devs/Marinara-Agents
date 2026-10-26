import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  SAUCELING_POST_EGG_STAGES,
  type SaucelingCharacterSummary,
  type SaucelingMenagerieEntry,
  type SaucelingMenagerieResponse,
  type SaucelingPostEggStage,
  type SaucelingStateResponse,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  menagerieSections,
  petKind,
  temperamentOf,
} from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import { packageAssetUrl, saucelingsRequest } from "./api.js";
import { FriendlyError } from "./care-ui.js";
import { EggPaintNote } from "./FormPainter.js";
import { HelpTip } from "./HelpTip.js";
import { useSaucelingsTranslation } from "./localization.js";
import { PetSprite } from "./PetSprite.js";
import { RareMark, rareKind } from "./RareMark.js";

/** A pasta sauceling's sauce colours; the others keep the house colours. */
function sauceStyle(entry: SaucelingMenagerieEntry): CSSProperties {
  const sauce = temperamentOf(entry)?.sauce;
  return (sauce ? { "--sl-sauce-accent": sauce.accentColor, "--sl-sauce-bg": sauce.badgeBg } : {}) as CSSProperties;
}

export function SaucelingsMenagerieView({
  state,
  packageId,
  packageVersion,
  onRestored,
}: {
  state: SaucelingStateResponse;
  packageId?: string;
  packageVersion?: string | null;
  /** Called with the caretaker the pet came back to. */
  onRestored: (caretakerId: string) => void;
}) {
  const { t } = useSaucelingsTranslation();
  const assetUrl = (path: string) => packageAssetUrl(packageId, path, packageVersion);
  const queryClient = useQueryClient();
  const menagerieQuery = useQuery({
    queryKey: ["saucelings", "menagerie"],
    queryFn: () => saucelingsRequest<SaucelingMenagerieResponse>("/menagerie"),
    refetchOnMount: "always",
  });
  const menagerie = menagerieQuery.data?.menagerie ?? [];
  const activePet = state.world.activePet;
  const activeName = activePet
    ? activePet.stage === "egg"
      ? t("saucelings.menagerie.activeEgg")
      : activePet.name
    : "";
  const [stagePickById, setStagePickById] = useState<Record<string, SaucelingPostEggStage>>({});
  // A pet that lived in the nook comes back to its caretaker unless another is picked; an egg found while chatting
  // comes with its finder picked while that character is still there, and otherwise waits for the player to pick.
  const [caretakerPickById, setCaretakerPickById] = useState<Record<string, string>>({});
  const caretakerFor = (entry: SaucelingMenagerieEntry) =>
    caretakerPickById[entry.id] ??
    (entry.farewellScene
      ? entry.caretakerId
      : (state.characters.find((character) => character.id === entry.foundBy)?.id ?? ""));
  // One pet is open at a time, in a card above the sections, as a painting is in the Album.
  const [openId, setOpenId] = useState<string | null>(null);
  // Releasing, or bringing one back over the pet in the nook, waits for a second click.
  const [confirming, setConfirming] = useState<"swap" | "release" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  // The tile to go back to once the card has closed and the sections have moved up.
  const returnTo = useRef<string | null>(null);
  // The card opens above the sections, so take the reader there; closing it takes them back to the pet's tile.
  useEffect(() => {
    if (openId) cardRef.current?.focus();
    else if (returnTo.current) tileRefs.current.get(returnTo.current)?.focus();
    returnTo.current = null;
  }, [openId]);

  const restoreMutation = useMutation({
    mutationFn: (input: { id: string; stage?: SaucelingPostEggStage; swap: boolean; caretakerId: string }) =>
      saucelingsRequest<SaucelingStateResponse>(`/menagerie/${encodeURIComponent(input.id)}/restore`, "POST", {
        stage: input.stage,
        swap: input.swap,
        caretakerId: input.caretakerId,
      }),
    onSuccess: (next, input) => {
      setConfirming(null);
      queryClient.setQueryData(["saucelings", "state"], next);
      onRestored(input.caretakerId);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) =>
      saucelingsRequest<SaucelingStateResponse>(`/menagerie/${encodeURIComponent(id)}/release`, "POST", {}),
    onSuccess: (next) => {
      setConfirming(null);
      setOpenId(null);
      queryClient.setQueryData(["saucelings", "state"], next);
      void queryClient.invalidateQueries({ queryKey: ["saucelings", "menagerie"] });
      void queryClient.invalidateQueries({ queryKey: ["saucelings", "portraits"] });
    },
  });
  const failure = restoreMutation.error ?? releaseMutation.error ?? menagerieQuery.error;
  const pending = restoreMutation.isPending || releaseMutation.isPending;
  const open = menagerie.find((entry) => entry.id === openId) ?? null;

  const openEntry = (id: string) => {
    setConfirming(null);
    setOpenId(id);
  };
  const close = () => {
    returnTo.current = openId;
    setConfirming(null);
    setOpenId(null);
  };

  if (menagerieQuery.isLoading) {
    return (
      <div className="sl-card" style={{ textAlign: "center", padding: "2.5rem", opacity: 0.75 }}>
        {t("saucelings.loading")}
      </div>
    );
  }

  if (menagerie.length === 0 && !failure) {
    return (
      <div className="sl-card" style={{ display: "grid", gap: "0.5rem", textAlign: "center", padding: "2.5rem" }}>
        <span style={{ opacity: 0.75 }}>{t("saucelings.menagerie.empty")}</span>
        <span style={{ fontSize: "0.8rem", opacity: 0.65 }}>{t("saucelings.menagerie.emptyHow")}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {failure ? (
        <div
          role="alert"
          className="sl-card"
          style={{ borderColor: "#ef4444", color: "#fca5a5", fontSize: "0.8125rem", padding: "0.65rem 1rem" }}
        >
          <FriendlyError error={failure} />
        </div>
      ) : null}
      {open ? (
        <MenagerieCard
          key={open.id}
          entry={open}
          cardRef={cardRef}
          assetUrl={assetUrl}
          chosenStage={stagePickById[open.id] ?? "elder"}
          onPickStage={(stage) => setStagePickById((prev) => ({ ...prev, [open.id]: stage }))}
          characters={state.characters}
          caretakerId={caretakerFor(open)}
          onPickCaretaker={(id) => setCaretakerPickById((prev) => ({ ...prev, [open.id]: id }))}
          activeName={activeName}
          hasActivePet={Boolean(activePet)}
          confirming={confirming}
          setConfirming={setConfirming}
          pending={pending}
          onRestore={(stage, swap) =>
            restoreMutation.mutate({ id: open.id, stage, swap, caretakerId: caretakerFor(open) })
          }
          onRelease={() => releaseMutation.mutate(open.id)}
          onClose={close}
        />
      ) : null}
      {menagerieSections(menagerie).map((section) => (
        <section key={section.stage} className="sl-menagerie-section">
          <h3 className="sl-menagerie-heading">
            {t(`saucelings.menagerie.section.${section.stage}`)}
            <span className="sl-menagerie-count">{section.entries.length}</span>
          </h3>
          <div className="sl-gallery sl-gallery--pets">
            {section.entries.map((entry) => {
              // An egg keeps its kind a surprise in the Menagerie too; the section already says what it is.
              const isEgg = entry.stageAtRetirement === "egg";
              const entryName = isEgg ? t("saucelings.egg.name") : entry.name;
              const rare = isEgg ? null : rareKind(entry);
              return (
                <button
                  key={entry.id}
                  ref={(tile) => {
                    if (tile) tileRefs.current.set(entry.id, tile);
                    else tileRefs.current.delete(entry.id);
                  }}
                  type="button"
                  className="sl-gallery-tile"
                  style={sauceStyle(entry)}
                  aria-label={rare ? `${entryName}, ${t(`saucelings.pet.rare.${rare}`)}` : entryName}
                  aria-pressed={entry.id === openId}
                  onClick={() => openEntry(entry.id)}
                >
                  <span className="sl-sprite-stage sl-sprite-stage--tile">
                    <PetSprite
                      art={entry}
                      species={entry.species}
                      stage={
                        entry.reachedElder
                          ? (stagePickById[entry.id] ?? "elder")
                          : (entry.lockedStage ?? entry.stageAtRetirement)
                      }
                      mood="happy"
                      assetUrl={assetUrl}
                      alt=""
                      scale={2}
                      still
                      frontOnly
                    />
                  </span>
                  {isEgg ? null : (
                    <span className="sl-pet-tile-name">
                      <RareMark pet={entry} labelled={false} />
                      {entry.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function MenagerieCard({
  entry,
  cardRef,
  assetUrl,
  chosenStage,
  onPickStage,
  characters,
  caretakerId,
  onPickCaretaker,
  activeName,
  hasActivePet,
  confirming,
  setConfirming,
  pending,
  onRestore,
  onRelease,
  onClose,
}: {
  entry: SaucelingMenagerieEntry;
  cardRef: RefObject<HTMLDivElement | null>;
  assetUrl: (path: string) => string;
  chosenStage: SaucelingPostEggStage;
  onPickStage: (stage: SaucelingPostEggStage) => void;
  characters: SaucelingCharacterSummary[];
  /** Who it comes back to; empty until the player picks. */
  caretakerId: string;
  onPickCaretaker: (id: string) => void;
  activeName: string;
  hasActivePet: boolean;
  confirming: "swap" | "release" | null;
  setConfirming: (action: "swap" | "release" | null) => void;
  pending: boolean;
  onRestore: (stage: SaucelingPostEggStage | undefined, swap: boolean) => void;
  onRelease: () => void;
  onClose: () => void;
}) {
  const { t } = useSaucelingsTranslation();
  // Bring back with nobody chosen says so and moves to the choice.
  const [askCaretaker, setAskCaretaker] = useState(false);
  const caretakerSelect = useRef<HTMLSelectElement>(null);
  const kind = petKind(entry);
  // An egg keeps its kind a surprise in the Menagerie too.
  const isEgg = entry.stageAtRetirement === "egg";
  const entryName = isEgg ? t("saucelings.egg.name") : entry.name;
  // How the swap note names it: "and this egg comes back".
  const noteName = isEgg ? t("saucelings.menagerie.thisEgg") : entry.name;
  const temper = temperamentOf(entry);
  const displayStage = entry.reachedElder ? chosenStage : (entry.lockedStage ?? entry.stageAtRetirement);
  const restore = (swap: boolean) => onRestore(entry.reachedElder ? chosenStage : undefined, swap);
  // The same choice as Adopt, plus the caretaker it had when that one is no longer a character.
  const caretakers =
    characters.length > 0
      ? characters.map((ch) => ({ id: ch.id, name: ch.name }))
      : [{ id: "caretaker", name: t("saucelings.empty.houseCaretaker") }];
  if (entry.farewellScene && !caretakers.some((ch) => ch.id === entry.caretakerId)) {
    caretakers.unshift({ id: entry.caretakerId, name: entry.careProfile.characterName });
  }

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className="sl-card sl-viewer"
      style={{ display: "grid", gap: "0.75rem", justifyItems: "stretch", ...sauceStyle(entry) }}
    >
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <div className="sl-sprite-stage" style={{ width: "7.5rem", height: "7.5rem" }}>
          <PetSprite
            art={entry}
            species={entry.species}
            stage={displayStage}
            mood="happy"
            assetUrl={assetUrl}
            alt={entryName}
            scale={2}
            still
            frontOnly
          />
        </div>
        <div style={{ flex: "1 1 16rem", display: "grid", gap: "0.35rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "1.1rem" }}>{entryName}</strong>
            {isEgg ? null : <RareMark pet={entry} />}
            {isEgg || !temper ? null : (
              <span className="sl-badge" title={temper.readsAs}>
                {temper.sauce
                  ? t("saucelings.pet.sauce", { sauce: temper.name })
                  : t("saucelings.pet.temperament", { temperament: temper.name })}
              </span>
            )}
            <span className="sl-badge">{t("saucelings.menagerie.foundBy", { name: entry.finder.name })}</span>
            {!isEgg && entry.evolution?.at ? (
              <span className="sl-badge">{t("saucelings.menagerie.evolved")}</span>
            ) : null}
            <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>
              {isEgg ? "" : `${kind.name} · `}
              {/* An egg found while chatting went straight to the Menagerie, so it was never retired. */}
              {entry.farewellScene
                ? t("saucelings.menagerie.retiredAs", {
                    stage: t(`saucelings.stage.${entry.stageAtRetirement}`),
                    name: entry.careProfile.characterName,
                  })
                : ""}
            </span>
          </div>
          {entry.farewellScene ? (
            <p style={{ margin: 0, fontSize: "0.825rem", opacity: 0.85 }}>{entry.farewellScene}</p>
          ) : null}
          {isEgg && entry.design ? <EggPaintNote petId={entry.id} /> : null}
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8rem", flexWrap: "wrap" }}>
        <span>{t("saucelings.menagerie.lookedAfterBy")}</span>
        <select
          ref={caretakerSelect}
          className="sl-select"
          value={caretakerId}
          disabled={pending}
          onChange={(e) => onPickCaretaker(e.target.value)}
        >
          {caretakerId ? null : (
            <option value="" disabled>
              {t("saucelings.menagerie.chooseCaretaker")}
            </option>
          )}
          {caretakers.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>
        {askCaretaker && !caretakerId ? (
          <span className="sl-care-note" role="status">
            {t("saucelings.menagerie.chooseFirst")}
          </span>
        ) : null}
      </label>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          borderTop: "1px solid var(--border, rgba(255,255,255,0.08))",
          paddingTop: "0.65rem",
        }}
      >
        {confirming ? (
          <>
            <span style={{ fontSize: "0.8rem" }}>
              {confirming === "release"
                ? isEgg
                  ? t("saucelings.menagerie.releaseNoteEgg")
                  : t("saucelings.menagerie.releaseNote", { name: entry.name })
                : t("saucelings.menagerie.swapNote", { name: noteName, active: activeName })}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {confirming === "release" ? (
                <button type="button" className="sl-btn sl-btn--danger" disabled={pending} onClick={onRelease}>
                  {t("saucelings.menagerie.releaseConfirm")}
                </button>
              ) : (
                <button
                  type="button"
                  className="sl-btn sl-btn--primary"
                  disabled={pending || !caretakerId}
                  onClick={() => restore(true)}
                >
                  {t("saucelings.menagerie.swapConfirm")}
                </button>
              )}
              <button type="button" className="sl-btn" onClick={() => setConfirming(null)}>
                {t("saucelings.common.cancel")}
              </button>
            </div>
          </>
        ) : entry.reachedElder ? (
          <HelpTip
            text={t("saucelings.menagerie.lockStageHelp")}
            label={t("saucelings.help.label", { action: t("saucelings.menagerie.lockStage") })}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8rem" }}>
              <span>{t("saucelings.menagerie.lockStage")}</span>
              <select
                className="sl-select"
                value={chosenStage}
                onChange={(e) => onPickStage(e.target.value as SaucelingPostEggStage)}
              >
                {SAUCELING_POST_EGG_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {t(`saucelings.stage.${st}`)}
                  </option>
                ))}
              </select>
            </label>
          </HelpTip>
        ) : entry.farewellScene ? null : (
          // Only when no "Retired as <stage>" line above already says where it comes back.
          <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
            {t("saucelings.menagerie.returnsAt")} <strong>{t(`saucelings.stage.${entry.stageAtRetirement}`)}</strong>
          </span>
        )}

        {confirming ? null : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginLeft: "auto" }}>
            <button type="button" className="sl-btn" onClick={onClose}>
              {t("saucelings.menagerie.close")}
            </button>
            <button type="button" className="sl-btn" disabled={pending} onClick={() => setConfirming("release")}>
              {t("saucelings.menagerie.release")}
            </button>
            <button
              type="button"
              className="sl-btn sl-btn--primary"
              disabled={pending}
              aria-disabled={!caretakerId || undefined}
              onClick={() => {
                if (!caretakerId) {
                  setAskCaretaker(true);
                  caretakerSelect.current?.focus();
                } else if (hasActivePet) setConfirming("swap");
                else restore(false);
              }}
            >
              {t("saucelings.menagerie.bringBack")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
