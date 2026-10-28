import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  SaucelingEvolveMove,
  SaucelingPet,
  SaucelingStateResponse,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { saucelingsRequest } from "./api.js";
import { FriendlyError } from "./care-ui.js";
import { HelpTip } from "./HelpTip.js";
import { useSaucelingsTranslation } from "./localization.js";
import { PetSprite } from "./PetSprite.js";
import { STEP_MS, moveSteps, type MoveAct } from "./move-player.js";
import { stageIsStill } from "./stage-director.js";

/** Evolve… for the nook's sauceling while its caretaker has offered an evolution and it has not taken one. */
export function EvolveButton({
  state,
  assetUrl,
}: {
  state: SaucelingStateResponse;
  assetUrl: (path: string) => string;
}) {
  const { t } = useSaucelingsTranslation();
  const [open, setOpen] = useState(false);
  const pet = state.world.activePet;
  if (!pet || pet.stage === "egg" || pet.evolution.offer !== "offered" || pet.evolution.look) return null;
  return (
    <div className="sl-about-row">
      <button type="button" className="sl-btn sl-btn--primary" onClick={() => setOpen(true)}>
        ✨ {t("saucelings.evolve.button")}
      </button>
      <span className="sl-care-note">{t("saucelings.evolve.note", { name: pet.name })}</span>
      {open ? <EvolveDialog pet={pet} assetUrl={assetUrl} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

/** Undo evolution: back to how it looked, with Evolve… and the same two choices back. */
export function UndoEvolution({ state }: { state: SaucelingStateResponse }) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const undo = useMutation({
    mutationFn: () => saucelingsRequest<SaucelingStateResponse>("/evolve/undo", "POST", {}),
    onSuccess: (next) => queryClient.setQueryData(["saucelings", "state"], next),
  });
  const pet = state.world.activePet;
  if (!pet?.evolution.look) return null;
  return (
    <div className="sl-about-row">
      <HelpTip
        text={t("saucelings.evolve.undoNote", { name: pet.name })}
        label={t("saucelings.help.label", { action: t("saucelings.evolve.undo") })}
      >
        <button type="button" className="sl-btn" disabled={undo.isPending} onClick={() => undo.mutate()}>
          ↩ {t("saucelings.evolve.undo")}
        </button>
      </HelpTip>
      {undo.error && !undo.isPending ? (
        <span role="alert" className="sl-error">
          <FriendlyError error={undo.error} />
        </span>
      ) : null}
    </div>
  );
}

/** The previews' signature moves, played on the spot together every few seconds unless the page asks for stillness:
 *  one act per move, or nulls between plays. */
function useMoveLoop(moves: SaucelingEvolveMove[]): Array<MoveAct | null> {
  const [at, setAt] = useState<number | null>(null);
  const key = moves.join(" ");
  useEffect(() => {
    if (!key) return;
    const ms = Math.max(...key.split(" ").map((move) => moveSteps(move as SaucelingEvolveMove, false))) * STEP_MS;
    let timer = 0;
    const cycle = (on: boolean) => {
      setAt(on && !stageIsStill() ? Date.now() : null);
      timer = window.setTimeout(() => cycle(!on), on ? ms : 2100);
    };
    timer = window.setTimeout(() => cycle(true), 1200);
    return () => window.clearTimeout(timer);
  }, [key]);
  return useMemo(
    () =>
      key
        .split(" ")
        .map((move): MoveAct | null =>
          at === null
            ? null
            : { kind: "move", move: move as SaucelingEvolveMove, encore: false, travel: 0, spot: true, at },
        ),
    [key, at],
  );
}

/** The two looks its caretaker offered, each drawn live on its own sprite. The first open asks for them (the
 *  writing connection, or the plain fallback); after that they are the same two every time. */
function EvolveDialog({
  pet,
  assetUrl,
  onClose,
}: {
  pet: SaucelingPet;
  assetUrl: (path: string) => string;
  onClose: () => void;
}) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const caretaker = pet.careProfile.characterName;
  const done = (next: SaucelingStateResponse) => {
    queryClient.setQueryData(["saucelings", "state"], next);
  };
  const options = useMutation({
    mutationFn: () => saucelingsRequest<SaucelingStateResponse>("/evolve/options", "POST", {}),
    onSuccess: done,
  });
  const choose = useMutation({
    mutationFn: (index: 0 | 1) => saucelingsRequest<SaucelingStateResponse>("/evolve/choose", "POST", { index }),
    onSuccess: (next) => {
      done(next);
      onClose();
    },
  });
  const decline = useMutation({
    mutationFn: () => saucelingsRequest<SaucelingStateResponse>("/evolve/decline", "POST", {}),
    onSuccess: (next) => {
      done(next);
      onClose();
    },
  });
  const choices = pet.evolution.choices;
  const acts = useMoveLoop(choices?.map((look) => look.move) ?? []);
  const busy = options.isPending || choose.isPending || decline.isPending;
  // Writing the looks can be left: `done` still stores them when they arrive. A choice in flight cannot.
  const locked = choose.isPending || decline.isPending;
  const error = options.error ?? choose.error ?? decline.error;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.focus();
    return () => dialog?.close();
  }, []);
  useEffect(() => {
    if (!choices) options.mutate();
    // Asked once when it opens; a failed ask shows its error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog
      ref={ref}
      className="sl-dialog sl-dialog--wide"
      tabIndex={-1}
      aria-labelledby="sl-evolve-title"
      onCancel={(e) => {
        e.preventDefault();
        if (confirming) setConfirming(false);
        else if (!locked) onClose();
      }}
      // A browser can close the dialog itself (a second Escape with no click between); the button must know.
      onClose={onClose}
    >
      <h2 id="sl-evolve-title">
        {confirming
          ? t("saucelings.evolve.declineConfirm", { name: pet.name })
          : t("saucelings.evolve.title", { name: pet.name })}
      </h2>
      {confirming ? (
        <div className="sl-dialog-actions">
          <button type="button" className="sl-btn" autoFocus onClick={() => setConfirming(false)}>
            {t("saucelings.common.cancel")}
          </button>
          <button type="button" className="sl-btn" disabled={busy} onClick={() => decline.mutate()}>
            {t("saucelings.evolve.decline")}
          </button>
        </div>
      ) : (
        <>
          {!choices ? (
            <p role="status">
              {options.isPending || !error ? t("saucelings.evolve.writing", { caretaker, name: pet.name }) : null}
            </p>
          ) : (
            <div className="sl-evolve-choices">
              {choices.map((look, index) => (
                <div key={look.form} className="sl-evolve-choice">
                  <span className="sl-sprite-stage sl-sprite-stage--tile">
                    <PetSprite
                      art={{ ...pet, evolution: { ...pet.evolution, look } }}
                      species={pet.species}
                      stage={pet.stage}
                      mood="happy"
                      act={acts[index] ?? null}
                      facing={pet.flipped ? "left" : "right"}
                      flipped={pet.flipped}
                      assetUrl={assetUrl}
                      alt=""
                      scale={2}
                    />
                  </span>
                  <h3>{look.form}</h3>
                  <p>{look.description}</p>
                  <p className="sl-evolve-from">{t("saucelings.evolve.from", { from: look.from })}</p>
                  <p>{t("saucelings.evolve.move", { move: t(`saucelings.evolve.moves.${look.move}`) })}</p>
                  <button
                    type="button"
                    className="sl-btn sl-btn--primary"
                    disabled={busy}
                    onClick={() => choose.mutate(index as 0 | 1)}
                  >
                    {t("saucelings.evolve.become", { form: look.form })}
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && !busy ? (
            <p role="alert" className="sl-error">
              <FriendlyError error={error} />
            </p>
          ) : null}
          <div className="sl-dialog-actions">
            {error && !choices && !busy ? (
              <button type="button" className="sl-btn sl-btn--primary" onClick={() => options.mutate()}>
                {t("saucelings.error.retry")}
              </button>
            ) : null}
            <button type="button" className="sl-btn" disabled={locked} onClick={onClose}>
              {t("saucelings.evolve.keep")}
            </button>
          </div>
          <p className="sl-evolve-decline">
            <button type="button" className="sl-link" disabled={busy} onClick={() => setConfirming(true)}>
              {t("saucelings.evolve.decline")}
            </button>{" "}
            {t("saucelings.evolve.declineNote", { name: pet.name })}
          </p>
        </>
      )}
    </dialog>
  );
}
