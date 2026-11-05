import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Aperture, Gift, Stamp, X } from "lucide-react";
import type { SlpCreatorPostView } from "../../../../../shared/src/slp/slp-social.types.js";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { useShareSlpPost } from "../../modules/post/slp-post-action-hooks";
import { useCreatorPosts } from "../feed/slp-feed-contract";
import { invalidateSlurpMessages } from "./slp-message-keys";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { SlpCoinText } from "../../modules/coin/SlpCoin";
import { SLP_IMG_FRAME_CLASS, SLP_TYPE, slpImgFade } from "../../base/chrome/SlpChrome";
import { focusRing } from "../../base/chrome/slp-focus";
import { SlpChip, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheetGroup } from "../../modules/chrome/SlpSheet";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { SLP_DESK_NOW, SLP_DESK_OFFERABLE, type SlpActionName } from "../../../../../shared/src/slp/slp-actions.js";
import { slpActionAllowed } from "../../../../../shared/src/slp/slp-extensions.js";
import { useSlurpSettings } from "../settings/slp-settings-contract";
import { SlpStirPlaySheet, slpStirWhat, useSlurpStir } from "../stir/slp-stir-contract";
import { useAddSlurpDeskNote } from "./slp-message-action-hooks";
import type { SlurpThreadViewModel } from "./slp-thread-actions";

/**
 * Slurp Support's composer tools (docs/SUPPORT-DESK.md): pick an Offer or a move, build it in the
 * Stir play sheet, and it rides the next line. The composer bar itself is unchanged.
 */
export function SlpDeskToolPanel({ model, onPicked }: { model: SlurpThreadViewModel; onPicked: () => void }) {
  const { t } = useTranslation();
  const { toolTab, setDeskPick, personaId, targetCreatorAccountId } = model;
  const note = useAddSlurpDeskNote();
  const settings = useSlurpSettings().data;
  const [text, setText] = useState("");
  if (toolTab === "note")
    return (
      <form
        className="space-y-2 px-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!personaId || !targetCreatorAccountId || !text.trim()) return;
          note.mutate(
            { personaId, creatorAccountId: targetCreatorAccountId, text: text.trim() },
            {
              onSuccess: () => {
                setText("");
                onPicked();
              },
              onError: (error) => toast.error(errorMessage(error)),
            },
          );
        }}
      >
        <label htmlFor="slurp-desk-note" className={cn(SLP_TYPE.meta, "font-semibold")}>
          {t("ui.slurp.desk.noteLabel", { defaultValue: "A note for yourself. The Creator never sees it." })}
        </label>
        <textarea
          id="slurp-desk-note"
          value={text}
          rows={3}
          maxLength={1000}
          onChange={(event) => setText(event.target.value)}
          className={cn(
            "w-full resize-none rounded-xl bg-[var(--slurp-canvas)] px-3 py-2 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm",
            focusRing,
          )}
        />
        <SlpPrimaryButton type="submit" className="w-full" disabled={!text.trim() || note.isPending}>
          {t("ui.slurp.desk.addNote", { defaultValue: "Add note" })}
        </SlpPrimaryButton>
      </form>
    );
  const mode = toolTab === "offer" ? "offer" : "now";
  // Offers of a switched-off extension (a brand deal without Brands & ads) are not on the desk.
  const actions = (mode === "offer" ? SLP_DESK_OFFERABLE : SLP_DESK_NOW).filter(
    (action: SlpActionName) => !settings || slpActionAllowed(settings, action),
  );
  return (
    <SlpSheetGroup>
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => {
            setDeskPick({ action, mode });
            onPicked();
          }}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
        >
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold leading-5">
              {t(`ui.slurp.stir.card.${action}.title`)}
            </span>
            <span className="block text-xs leading-4 text-[var(--slurp-muted)]">
              {t(`ui.slurp.stir.card.${action}.line`)}
            </span>
          </span>
        </button>
      ))}
    </SlpSheetGroup>
  );
}

/** The attached Offer or move, above the composer, one tap from removing it. */
export function SlpDeskComposerChip({ model }: { model: SlurpThreadViewModel }) {
  const { t } = useTranslation();
  const { composerDesk, setComposerDesk } = model;
  if (!composerDesk) return null;
  const Icon = composerDesk.mode === "offer" ? Stamp : Gift;
  return (
    <div className="slurp-bubble-in flex min-h-9 max-w-full items-center gap-2 self-start rounded-full bg-[var(--slurp-tint)] ps-3 pe-1 text-xs font-semibold text-[var(--slurp-text)]">
      <Icon size={14} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 truncate">
        <SlpCoinText>
          {composerDesk.mode === "offer"
            ? t("ui.slurp.desk.offerAttached", {
                defaultValue: "Offer: {{what}}",
                what: slpStirWhat(t, composerDesk.card),
              })
            : t("ui.slurp.desk.moveAttached", {
                defaultValue: "With this line: {{what}}",
                what: slpStirWhat(t, composerDesk.card),
              })}
        </SlpCoinText>
      </span>
      <button
        type="button"
        onClick={() => setComposerDesk(null)}
        aria-label={t("ui.slurp.desk.removeAttached", { defaultValue: "Remove" })}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/** The play sheet an Offer or a move is built in, outside the tools sheet (one overlay at a time). */
export function SlpDeskPlayHost({ model }: { model: SlurpThreadViewModel }) {
  const { t } = useTranslation();
  const { deskPick, setDeskPick, setComposerDesk, personaId, targetCreatorAccountId, draft, setDraft, composerRef } =
    model;
  const stir = useSlurpStir(deskPick ? personaId : null);
  return (
    <SlpStirPlaySheet
      action={deskPick?.action ?? null}
      view={stir.data}
      prefill={targetCreatorAccountId ? { who: [targetCreatorAccountId] } : undefined}
      onClose={() => setDeskPick(null)}
      useLabel={
        deskPick?.mode === "offer"
          ? t("ui.slurp.desk.attachOffer", { defaultValue: "Attach as offer" })
          : t("ui.slurp.desk.attachMove", { defaultValue: "Attach to my message" })
      }
      onUse={(card) => {
        if (!deskPick) return;
        setComposerDesk({ mode: deskPick.mode, card });
        // A warning or a rumour is the line itself: its words fill an empty box.
        const words =
          card.action === "warn-creator"
            ? String(card.input.reason ?? "")
            : card.action === "plant-rumour"
              ? String(card.input.text ?? "")
              : "";
        if (words && !draft.trim()) setDraft(words);
        composerRef.current?.focus();
      }}
    />
  );
}

/** "Photo, right now" on the next line, above the composer, one tap from removing it (0.3.6). */
export function SlpPhotoDemandChip({ model }: { model: SlurpThreadViewModel }) {
  const { t } = useTranslation();
  const { photoDemand, setPhotoDemand } = model;
  if (!photoDemand) return null;
  return (
    <div className="slurp-bubble-in flex min-h-9 max-w-full items-center gap-2 self-start rounded-full bg-[var(--slurp-tint)] ps-3 pe-1 text-xs font-semibold text-[var(--slurp-text)]">
      <Aperture size={14} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 truncate">
        {t("ui.slurp.desk.photoCheckAttached", { defaultValue: "With this reply: photo verification" })}
      </span>
      <button
        type="button"
        onClick={() => setPhotoDemand(false)}
        aria-label={t("ui.slurp.desk.removeAttached", { defaultValue: "Remove" })}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/** The "Photo, right now" tool: attach the demand to the next line, with words ready if the box is empty. */
export function SlpPhotoDemandTool({ model, onDone }: { model: SlurpThreadViewModel; onDone: () => void }) {
  const { t } = useTranslation();
  const { setPhotoDemand, draft, setDraft, composerRef } = model;
  return (
    <div className="flex flex-col gap-3 px-1">
      <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
        {t("ui.slurp.desk.photoCheckHelp", {
          defaultValue:
            "Write what the photo must show in your reply. The Creator must answer with a photo taken now; if you name nothing, it shows where they are. No fee, no delay.",
        })}
      </p>
      <SlpPrimaryButton
        onClick={() => {
          setPhotoDemand(true);
          if (!draft.trim())
            setDraft(
              t("ui.slurp.desk.photoCheckWords", {
                defaultValue: "Verification: please send a photo taken right now.",
              }),
            );
          onDone();
          composerRef.current?.focus();
        }}
      >
        <Aperture size={16} aria-hidden="true" />
        {t("ui.slurp.desk.photoCheckAttach", { defaultValue: "Add to my reply" })}
      </SlpPrimaryButton>
    </div>
  );
}

const isStory = (post: SlpCreatorPostView) =>
  (post as SlpCreatorPostView & { story?: boolean }).story === true || post.metadata?.noodlerPostType === "story";

function SlpSupportPostRow({ post, busy, onPick }: { post: SlpCreatorPostView; busy: boolean; onPick: () => void }) {
  const { t } = useTranslation();
  const { src, observe } = useNearViewportSlurpMediaSrc(post.imageUrl ?? null, { width: 160 });
  const words = (post.title || post.content || "").trim();
  return (
    <li>
      <button
        type="button"
        ref={observe}
        disabled={busy}
        onClick={onPick}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-start hover:bg-[var(--accent)] disabled:opacity-60",
          focusRing,
        )}
      >
        <span className={cn(SLP_IMG_FRAME_CLASS, "relative block size-12 shrink-0 overflow-hidden rounded-lg")}>
          {src && <img src={src} alt="" {...slpImgFade} className="slp-crop-top h-full w-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn(SLP_TYPE.body, "line-clamp-2")}>
            {words || t("ui.slurp.desk.showPostNoWords", { defaultValue: "A picture" })}
          </span>
        </span>
        {isStory(post) && (
          <SlpChip className="pointer-events-none shrink-0">
            {t("ui.slurp.desk.story", { defaultValue: "Story" })}
          </SlpChip>
        )}
      </button>
    </li>
  );
}

/** "Show a post" (0.3.6): one of this Creator's posts or Stories goes into Support's thread as a card. */
export function SlpSupportPostPicker({ model, onDone }: { model: SlurpThreadViewModel; onDone: () => void }) {
  const { t } = useTranslation();
  const { personaId, targetCreatorAccountId } = model;
  const posts = useCreatorPosts(targetCreatorAccountId ?? null, personaId ?? null);
  const share = useShareSlpPost();
  const queryClient = useQueryClient();
  const items = (posts.data ?? [])
    .map((item) => item.viewerPost ?? ("managed" in item ? (item.managed as unknown as SlpCreatorPostView) : null))
    .filter((post): post is SlpCreatorPostView => Boolean(post))
    .slice(0, 40);
  if (posts.isLoading)
    return (
      <p className={cn(SLP_TYPE.meta, "px-2 text-[var(--slurp-muted)]")}>
        {t("ui.slurp.state.loading", { defaultValue: "Loading…" })}
      </p>
    );
  if (!items.length)
    return (
      <p className={cn(SLP_TYPE.meta, "px-2 text-[var(--slurp-muted)]")}>
        {t("ui.slurp.desk.showPostEmpty", { defaultValue: "They have not posted anything yet." })}
      </p>
    );
  return (
    <ul
      className="max-h-80 space-y-0.5 overflow-y-auto"
      aria-label={t("ui.slurp.desk.tools.pullUp", { defaultValue: "Link a post" })}
    >
      {items.map((post) => (
        <SlpSupportPostRow
          key={post.id}
          post={post}
          busy={share.isPending}
          onPick={() => {
            if (!personaId || !targetCreatorAccountId) return;
            share
              .mutateAsync({ personaId, creatorAccountId: targetCreatorAccountId, postId: post.id, asSupport: true })
              .then(() => {
                void invalidateSlurpMessages(queryClient);
                onDone();
              })
              .catch((error: unknown) => toast.error(errorMessage(error)));
          }}
        />
      ))}
    </ul>
  );
}
