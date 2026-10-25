import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SaucelingStateResponse } from "../../../../shared/src/features/agents/saucelings/types.js";
import { saucelingsRequest } from "./api.js";
import { useSaucelingsTranslation } from "./localization.js";

interface Asking {
  characterId: string;
  name: string;
  onDone?: (go: boolean) => void;
}

/**
 * Offers to give a caretaker their own voice when they have none yet: the writing connection reads their card once
 * (POST /voice). `ask` opens the dialog for a character without a voice and does nothing for anyone else. `onDone`
 * hears whether to go on: true once the voice is made, after "Not now", or straight away when nothing was asked;
 * false when the dialog is closed.
 */
export function useVoicePrompt(): {
  ask: (characterId: string, onDone?: (go: boolean) => void) => void;
  dialog: ReactNode;
} {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<Asking | null>(null);
  const ask = useCallback(
    (characterId: string, onDone?: (go: boolean) => void) => {
      const state = queryClient.getQueryData<SaucelingStateResponse>(["saucelings", "state"]);
      const character = state?.characters.find((ch) => ch.id === characterId);
      if (!character || character.hasVoice) {
        onDone?.(true);
        return;
      }
      setAsking({ characterId, name: character.name, onDone });
    },
    [queryClient],
  );
  const finish = (go: boolean) => {
    asking?.onDone?.(go);
    setAsking(null);
  };
  return {
    ask,
    dialog: asking ? (
      <VoiceDialog key={asking.characterId} characterId={asking.characterId} name={asking.name} onFinish={finish} />
    ) : null,
  };
}

function VoiceDialog({
  characterId,
  name,
  onFinish,
}: {
  characterId: string;
  name: string;
  onFinish: (go: boolean) => void;
}) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<"ask" | "reading" | "failed">("ask");
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // autoFocus ran while the dialog was still closed.
    dialog?.querySelector<HTMLButtonElement>(".sl-btn--primary")?.focus();
    return () => dialog?.close();
  }, []);
  const read = async () => {
    setPhase("reading");
    // The buttons go while the card is read, so focus stays in the dialog.
    ref.current?.focus();
    try {
      const next = await saucelingsRequest<SaucelingStateResponse>("/voice", "POST", { characterId });
      queryClient.setQueryData(["saucelings", "state"], next);
      onFinish(true);
    } catch {
      setPhase("failed");
    }
  };
  return (
    <dialog
      ref={ref}
      className="sl-dialog"
      tabIndex={-1}
      aria-labelledby="sl-voice-title"
      onCancel={(e) => {
        e.preventDefault();
        if (phase !== "reading") onFinish(false);
      }}
    >
      <h2 id="sl-voice-title">{t("saucelings.voice.title", { name })}</h2>
      <p role="status">
        {phase === "reading"
          ? t("saucelings.about.refreshingVoice", { name })
          : phase === "failed"
            ? t("saucelings.voice.failed", { name })
            : t("saucelings.voice.body", { name })}
      </p>
      {phase === "reading" ? null : (
        <div className="sl-dialog-actions">
          <button type="button" className="sl-btn" onClick={() => onFinish(phase === "ask")}>
            {phase === "ask" ? t("saucelings.voice.notNow") : t("saucelings.voice.close")}
          </button>
          <button type="button" className="sl-btn sl-btn--primary" autoFocus onClick={() => void read()}>
            {phase === "ask" ? t("saucelings.voice.read", { name }) : t("saucelings.voice.tryAgain")}
          </button>
        </div>
      )}
    </dialog>
  );
}
