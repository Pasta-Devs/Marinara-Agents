// ──────────────────────────────────────────────
// Otome Forge: Your thoughts… (#2127). What the protagonist is thinking, feeling or planning after what happened
// lately, in the player's own words: an investigation to follow, something a love interest did, a wish to be held.
// Send saves them with no model call (POST .../home/thoughts {text} → {thoughts}); the next main chapter's plan and
// each of its scenes read them, then they are let go (S/story/chapters.ts). Until then the window opens with them, to
// change or clear. Enter starts a new line, and only Send sends, as in Messages.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOtomeApi } from "../../api";
import { Dialog } from "../../components/Dialog";
import { runPath } from "../../hooks/use-reader";
import type { PlayerThoughts } from "../../shared/api-types";
import { THOUGHTS_MAX } from "../../shared/home";
import { TextField } from "../setup/parts";

/**
 * A thought bubble, drawn on lucide's 24 × 24 grid as its icons are (lucide has none): its Cloud at 0.85 in the top
 * right, and two dots trailing down to the lower left.
 */
export function ThoughtBubbleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18.2 13.9H10.95a5.95 5.95 0 1 1 5.7-7.65h1.55a3.83 3.83 0 1 1 0 7.65Z" />
      <circle cx="7" cy="18" r="1.3" />
      <circle cx="3.4" cy="21.6" r="0.9" />
    </svg>
  );
}

interface ThoughtsSheetProps {
  runKey: string;
  /** The thoughts waiting for the next main chapter, or null. */
  thoughts: PlayerThoughts | null;
  /** Once saved, with what waits now (null once let go). */
  onSaved: (thoughts: PlayerThoughts | null) => void;
  onClose: () => void;
}

export function ThoughtsSheet({ runKey, thoughts, onSaved, onClose }: ThoughtsSheetProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const [draft, setDraft] = useState(thoughts?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      const saved = await otome.post<{ thoughts: PlayerThoughts | null }>(`${runPath(runKey)}/home/thoughts`, { text });
      onSaved(saved.thoughts);
    } catch (failure) {
      setError(otome.errorMessage(failure, "ui.otomeForge.home.thoughtsFailed"));
      setBusy(false);
    }
  };
  // An empty Send lets the waiting thoughts go, as Clear does; with none waiting there is nothing to send.
  const sendable = !busy && (!!draft.trim() || !!thoughts);
  return (
    <Dialog
      title={t("ui.otomeForge.home.thoughts")}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          {thoughts ? (
            <button
              type="button"
              className="of-button of-button--quiet of-button--small of-glass"
              aria-disabled={busy}
              onClick={() => {
                if (!busy) void send("");
              }}
            >
              {t("ui.otomeForge.home.thoughtsClear")}
            </button>
          ) : null}
          <button
            type="button"
            className="of-button of-button--quiet of-button--small of-glass"
            aria-disabled={busy}
            onClick={() => {
              if (!busy) onClose();
            }}
          >
            {t("ui.otomeForge.home.close")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary of-button--small"
            aria-disabled={!sendable}
            onClick={() => {
              if (sendable) void send(draft);
            }}
          >
            {t("ui.otomeForge.home.thoughtsSend")}
          </button>
        </>
      }
    >
      <TextField
        label={t("ui.otomeForge.home.thoughtsLabel")}
        value={draft}
        onChange={setDraft}
        max={THOUGHTS_MAX}
        rows={5}
        hint={t("ui.otomeForge.home.thoughtsHint")}
        counter
      />
      {error ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
