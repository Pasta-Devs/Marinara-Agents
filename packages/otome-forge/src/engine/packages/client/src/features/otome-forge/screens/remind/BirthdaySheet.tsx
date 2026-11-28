// ──────────────────────────────────────────────
// Otome Hearth: Celebrate a love interest's birthday (#2153), opened from Remind Me. One of her Shop gifts, or none;
// then his birthday scene opens in the reader, written as it opens, like any Character Story
// ──────────────────────────────────────────────
// POST /runs/:run/home/birthday {li, gift?} → {key, resumed} (S/home/birthday.ts): no model call; the gift is spent,
// and a scene already made is answered as it is and spends nothing. The gifts are Date Night's picker (owned, and
// offered under the story's Heat); with none it shows only where to buy them, and until the Wardrobe has answered (a
// failed read offers Try again) Celebrate waits. Each refusal says what happened, and what it changed is read again:
// 409 `conflict` (the gift is gone: the Wardrobe), 409 `locked` (Heat no longer offers it: the run) and 404 (the
// birthday can no longer be celebrated: the calendar, read before the sheet can close).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Cake, Feather, RotateCcw } from "lucide-react";
import { otomeErrorCode, useOtomeApi } from "../../api";
import { Dialog } from "../../components/Dialog";
import { invalidateCollection, wardrobeQueryKey } from "../../hooks/use-items";
import { runPath, storyQueryKey } from "../../hooks/use-reader";
import { runQueryKey } from "../../hooks/use-run";
import type { RunLiView, RunView } from "../../shared/api-types";
import { giftsFor, type GiftId } from "../../shared/shop";
import { GiftPicker } from "../dates/DateNight";
import { useWardrobe } from "../wardrobe/Wardrobe";

interface BirthdaySheetProps {
  runKey: string;
  view: RunView;
  li: RunLiView;
  onClose: () => void;
  /** His birthday scene is made: open it. */
  onCelebrated: (key: string) => void;
  /** The birthday can no longer be celebrated: read the calendar again (the sheet stays busy until it is read). */
  onStale: () => Promise<unknown>;
}

export function BirthdaySheet({ runKey, view, li, onClose, onCelebrated, onStale }: BirthdaySheetProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const wardrobe = useWardrobe(runKey);
  const [gift, setGift] = useState<GiftId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gifts = giftsFor(view.world.content).flatMap((id) => {
    const count = wardrobe.data?.gifts?.[id] ?? 0;
    return count > 0 ? [{ id, count }] : [];
  });
  const given = gifts.some((entry) => entry.id === gift) ? gift : null;
  // Her gifts are unknown until the Wardrobe answers (a failed read included): Celebrate waits, so it never gives none
  // unasked.
  const sendable = !busy && !!wardrobe.data;

  const celebrate = async () => {
    setBusy(true);
    setError(null);
    try {
      const { key } = await otome.post<{ key: string; resumed: boolean }>(`${runPath(runKey)}/home/birthday`, {
        li: li.id,
        ...(given ? { gift: given } : {}),
      });
      void invalidateCollection(queryClient, runKey);
      void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
      onCelebrated(key);
    } catch (cause) {
      const code = otomeErrorCode(cause);
      if (code === "conflict" && given) {
        setError(t("ui.otomeForge.birthday.giftGone"));
        void queryClient.invalidateQueries({ queryKey: wardrobeQueryKey(runKey) });
      } else if (code === "locked") {
        setError(t("ui.otomeForge.birthday.giftLocked"));
        void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      } else if (code === "not-found") {
        // Its row leaves Remind Me while the sheet is still open, so closing gives focus to the screen's title.
        await onStale();
        setError(t("ui.otomeForge.birthday.closed"));
      } else {
        setError(otome.errorMessage(cause));
      }
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={t("ui.otomeForge.birthday.celebrateName", { name: li.name })}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          <button
            type="button"
            className="of-button of-button--quiet of-button--small of-glass"
            aria-disabled={busy}
            onClick={() => {
              if (!busy) onClose();
            }}
          >
            {t("ui.otomeForge.remind.cancel")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary of-button--small"
            aria-disabled={!sendable}
            onClick={() => {
              if (sendable) void celebrate();
            }}
          >
            <Cake size={14} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.birthday.celebrate")}
          </button>
        </>
      }
    >
      {!wardrobe.data ? (
        wardrobe.isError ? (
          <div className="of-notice of-notice--error" role="alert">
            <span>{otome.errorMessage(wardrobe.error, "ui.otomeForge.birthday.giftsFailed")}</span>
            <button
              type="button"
              className="of-button of-button--text"
              aria-disabled={wardrobe.isFetching}
              onClick={() => {
                if (!wardrobe.isFetching) void wardrobe.refetch();
              }}
            >
              <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : (
          <p className="of-hint" role="status">
            {t("ui.otomeForge.birthday.loadingGifts")}
          </p>
        )
      ) : gifts.length ? (
        <GiftPicker
          partnerName={li.name}
          gifts={gifts}
          value={given}
          onChange={setGift}
          title={t("ui.otomeForge.birthday.giftTitle")}
          hint={t("ui.otomeForge.birthday.giftHint", { name: li.name })}
        />
      ) : (
        <p className="of-hint">{t("ui.otomeForge.birthday.noGifts")}</p>
      )}
      <p className="of-cost">
        <Feather size={14} strokeWidth={2} aria-hidden="true" />
        <span>{t("ui.otomeForge.birthday.cost")}</span>
      </p>
      {error ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
