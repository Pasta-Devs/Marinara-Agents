// The one AI assist for pictures: the player types what they want, Slurp draws it through the Creator's
// image pipeline (their look, their brief, their spice level) and shows it with Retry / Use, then Undo.
// A profile picture or cover is used through the action layer; a post or Story picture goes to the
// composer that opened it (`onUse`), which keeps its own Undo.
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, Undo2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { slpKeys } from "../../base/state/slp-query-keys";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { noteSlpAiUseOnce, SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { SLP_ASSIST_REQUEST_MAX, type SlpPictureTarget } from "../../../../../shared/src/slp/slp-actions.js";
import { runSlpAction } from "./slp-assist-hooks";

type Options = { creatorDetails: boolean; appearance: boolean; sourceReferences: boolean; composition: boolean };

const ASPECT: Record<SlpPictureTarget, string> = { avatar: "1 / 1", cover: "3 / 1", post: "4 / 5", story: "9 / 16" };

export function SlpPictureAssist({
  accountId,
  target,
  context,
  onUse,
  onUndo,
  onDone,
  onCancel,
  advanced = false,
  drawWith,
  placeholder,
}: {
  /** The Creator. Unused with `drawWith`. */
  accountId: string;
  target: SlpPictureTarget;
  /** The caption or Story line it goes with; a post drawn with no request is drawn from it. */
  context?: string;
  /** Post or Story: the composer takes the picture. Absent for a profile picture or cover. */
  onUse?: (image: string, prompt: string) => void;
  /** Post or Story: the composer puts back what it had before. */
  onUndo?: () => void;
  /** The player is done (Done, or the sheet around this closed). */
  onDone?: () => void;
  /** Close without using anything (an inline panel with no close button of its own). */
  onCancel?: () => void;
  /** Creator settings: the optional context switches of the old artwork tool, under Advanced. */
  advanced?: boolean;
  /** Something that is not a Creator (a brand logo or product, R): how to draw it. Needs `onUse`. */
  drawWith?: (request: string) => Promise<{ image: string; prompt: string }>;
  /** The request box's hint, when the target's own hint does not fit. */
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [request, setRequest] = useState("");
  const [options, setOptions] = useState<Options>({
    creatorDetails: true,
    appearance: target !== "cover",
    sourceReferences: target !== "cover",
    composition: true,
  });
  const [busy, setBusy] = useState<"draw" | "use" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ image: string; prompt: string } | null>(null);
  const [used, setUsed] = useState(false);
  // Whoever takes the picture (`onUse`) owns it; only a Creator's own avatar or cover goes through use-picture.
  const profileSlot = !onUse && (target === "avatar" || target === "cover") ? target : null;
  // A used profile picture stays kept for Undo until the player is done; then the old one goes.
  const usedRef = useRef(false);
  usedRef.current = used;
  useEffect(
    () => () => {
      if (profileSlot && usedRef.current) void runSlpAction("keep-picture", { accountId, target: profileSlot });
    },
    [accountId, profileSlot],
  );
  const refreshProfiles = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
      qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() }),
    ]);

  const act = async (step: "draw" | "use" | "undo", run: () => Promise<void>, fallback: string) => {
    setBusy(step);
    setError(null);
    try {
      await run();
    } catch (failure) {
      setError(errorMessage(failure, fallback));
    } finally {
      setBusy(null);
    }
  };
  const draw = () => {
    noteSlpAiUseOnce(t);
    return act(
      "draw",
      async () => {
        setResult(
          drawWith
            ? await drawWith(request.trim())
            : await runSlpAction("draw-picture", {
                accountId,
                target,
                request: request.trim(),
                context,
                ...(advanced ? { options } : {}),
              }),
        );
      },
      t("ui.slurp.assist.drawFailed", { defaultValue: "The picture did not come out. Try again." }),
    );
  };
  const use = () =>
    act(
      "use",
      async () => {
        if (!result) return;
        if (profileSlot) {
          await runSlpAction("use-picture", { accountId, target: profileSlot, image: result.image });
          await refreshProfiles();
        } else onUse?.(result.image, result.prompt);
        setUsed(true);
      },
      t("ui.slurp.assist.useFailed", { defaultValue: "Could not use this picture. Try again." }),
    );
  const undo = () =>
    act(
      "undo",
      async () => {
        if (profileSlot) {
          await runSlpAction("undo-picture", { accountId, target: profileSlot });
          await refreshProfiles();
        } else onUndo?.();
        setUsed(false);
      },
      t("ui.slurp.assist.useFailed", { defaultValue: "Could not use this picture. Try again." }),
    );

  const pending = busy !== null;
  // A composer shows the used picture itself, so the assist folds down to In use · Undo · Done.
  const folded = used && Boolean(onUse);
  return (
    <div data-slurp-picture-assist={target} className="space-y-3">
      <label className={cn("block space-y-1.5", folded && "hidden")}>
        <span className={cn(SLP_TYPE.body, "font-semibold")}>
          {t("ui.slurp.assist.pictureAsk", { defaultValue: "What should the picture show?" })}
        </span>
        <textarea
          value={request}
          maxLength={SLP_ASSIST_REQUEST_MAX}
          disabled={pending}
          rows={2}
          placeholder={placeholder ?? t(`ui.slurp.assist.picturePlaceholder.${target}`)}
          onChange={(event) => setRequest(event.target.value)}
          className="min-h-16 w-full resize-y rounded-xl bg-[var(--slurp-canvas)] p-3 text-base text-[var(--slurp-text)] outline-none ring-1 ring-inset ring-[var(--noodle-divider)] placeholder:text-[var(--slurp-muted)] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-[13px]"
        />
      </label>
      {advanced && !folded && (
        <details className="group">
          <summary className={cn(SLP_TYPE.meta, "min-h-11 cursor-pointer content-center text-[var(--slurp-muted)]")}>
            {t("ui.slurp.settings.advanced.group", { defaultValue: "Advanced" })}
          </summary>
          <div className="grid gap-1 pt-1">
            {(
              [
                ["creatorDetails", "ui.slurp.artwork.optionCreator"],
                ["appearance", "ui.slurp.artwork.optionAppearance"],
                ["sourceReferences", "ui.slurp.artwork.optionSource"],
                ["composition", "ui.slurp.artwork.optionComposition"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className={cn(SLP_TYPE.body, "flex min-h-11 cursor-pointer items-center gap-3")}>
                <input
                  type="checkbox"
                  checked={options[key]}
                  disabled={pending}
                  onChange={(event) => setOptions((current) => ({ ...current, [key]: event.target.checked }))}
                  className="size-4 shrink-0 accent-[var(--noodle-accent)]"
                />
                {t(label)}
              </label>
            ))}
          </div>
        </details>
      )}

      {(result || busy === "draw") && !folded && (
        <div
          className={cn(
            "relative mx-auto max-w-sm overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]",
            // A Story is tall: its height sets the size, so it stays 9:16 on a short phone screen.
            target === "story" ? "h-[min(60dvh,30rem)]" : "w-full",
          )}
          style={{ aspectRatio: ASPECT[target] }}
        >
          {result && (
            <img
              src={result.image}
              alt={t("ui.slurp.assist.pictureAlt", { defaultValue: "The picture Slurp drew" })}
              className={cn("slp-crop-top size-full object-cover", busy === "draw" && "opacity-40")}
            />
          )}
          {busy === "draw" && (
            <span
              role="status"
              className="absolute inset-0 grid place-items-center animate-pulse bg-[color-mix(in_srgb,var(--slurp-text)_9%,transparent)] motion-reduce:animate-none"
            >
              <span className={cn(SLP_TYPE.meta, "inline-flex items-center gap-1.5 text-[var(--slurp-muted)]")}>
                <Loader2 size={14} aria-hidden="true" className="animate-spin" />
                {t("ui.slurp.assist.drawing", { defaultValue: "Drawing…" })}
              </span>
            </span>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className={cn(SLP_TYPE.meta, "text-[var(--slurp-danger)]")}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && !used && (
          <SlpButton variant="tertiary" disabled={pending} onClick={onCancel} className="me-auto min-h-10 text-xs">
            {t("ui.slurp.artwork.cancel")}
          </SlpButton>
        )}
        {!result ? (
          <SlpButton disabled={pending} onClick={() => void draw()} className="min-h-10 px-4 text-xs">
            {busy === "draw" ? (
              <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            ) : (
              <SlpSparkleGlyph size={14} aria-hidden="true" />
            )}
            {error
              ? t("capabilities.actions.tryAgain", { defaultValue: "Try again" })
              : t("ui.slurp.assist.drawIt", { defaultValue: "Draw it" })}
            <SlpUsesAiMark />
          </SlpButton>
        ) : used ? (
          <>
            <p className={cn(SLP_TYPE.meta, "me-auto inline-flex items-center gap-1 text-[var(--slurp-muted)]")}>
              <Check size={14} aria-hidden="true" />
              {t("ui.slurp.assist.used", { defaultValue: "In use" })}
            </p>
            <SlpButton variant="tertiary" disabled={pending} onClick={() => void undo()} className="min-h-10 text-xs">
              {busy === "undo" ? (
                <Loader2 size={14} aria-hidden="true" className="animate-spin" />
              ) : (
                <Undo2 size={14} aria-hidden="true" />
              )}
              {t("ui.slurp.assist.undo", { defaultValue: "Undo" })}
            </SlpButton>
            {onDone && (
              <SlpButton disabled={pending} onClick={onDone} className="min-h-10 px-4 text-xs">
                {t("ui.slurp.assist.done", { defaultValue: "Done" })}
              </SlpButton>
            )}
          </>
        ) : (
          <>
            <SlpButton variant="quiet" disabled={pending} onClick={() => void draw()} className="min-h-10 px-4 text-xs">
              <RotateCcw size={14} aria-hidden="true" />
              {t("ui.slurp.assist.retry", { defaultValue: "Retry" })}
              <SlpUsesAiMark />
            </SlpButton>
            <SlpPrimaryButton disabled={pending} onClick={() => void use()} className="min-h-10 px-5 text-xs">
              {busy === "use" ? (
                <Loader2 size={14} aria-hidden="true" className="animate-spin" />
              ) : (
                <Check size={14} aria-hidden="true" />
              )}
              {t("ui.slurp.assist.use", { defaultValue: "Use" })}
            </SlpPrimaryButton>
          </>
        )}
      </div>
    </div>
  );
}
