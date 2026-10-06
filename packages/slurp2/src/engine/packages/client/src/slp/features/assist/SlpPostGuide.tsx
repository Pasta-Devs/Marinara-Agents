/**
 * The guided post (0.3.14): one line in, a post to review out. The caption in the page's voice and
 * its picture land in the composer; nothing is posted until the player presses Post. An owed #ad or a
 * collab can ride along, so the player's own page reaches the same business its Creators do.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Handshake, ImagePlus, Loader2, Megaphone } from "lucide-react";
import { cn } from "../../../lib/utils";
import { getApiErrorMessage } from "../../../lib/api-client";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";
import { SlpButton, SlpChip, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { useSlurpTies } from "../projects/slp-projects-contract";
import { runSlpAction } from "./slp-assist-hooks";

export type SlpPostGuideDraft = {
  text: string;
  image: string | null;
  imageError: string | null;
  dealId: string | null;
  collabId: string | null;
};

export function SlpPostGuide({
  accountId,
  personaId,
  story,
  disabled = false,
  initialIdea = "",
  autoRun = false,
  onDraft,
  onPendingChange,
  onUpload,
}: {
  accountId: string;
  personaId: string | null;
  story: boolean;
  disabled?: boolean;
  /** An idea handed over from Stir; with `autoRun` the draft starts at once. */
  initialIdea?: string;
  autoRun?: boolean;
  onDraft: (draft: SlpPostGuideDraft) => void;
  onPendingChange?: (pending: boolean) => void;
  onUpload?: () => void;
}) {
  const { t } = useTranslation();
  const ties = useSlurpTies(personaId).data;
  const [idea, setIdea] = useState(initialIdea);
  const [picture, setPicture] = useState(true);
  const [dealId, setDealId] = useState<string | null>(null);
  const [collabId, setCollabId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What this page owes or plans: an accepted #ad not posted yet, a collab that is on.
  const deals = (ties?.deals ?? []).filter((deal) => deal.creatorId === accountId && deal.owesPost);
  const collabs = (ties?.collabs ?? []).filter(
    (collab) =>
      (collab.hostId === accountId || collab.partnerId === accountId) &&
      (collab.status === "agreed" || collab.status === "planned"),
  );
  const nameOf = (id: string) => ties?.creators.find((creator) => creator.id === id)?.name ?? "";

  async function write(text = idea) {
    if (!text.trim() || pending) return;
    setPending(true);
    onPendingChange?.(true);
    setError(null);
    try {
      const draft = await runSlpAction("draft-post", {
        accountId,
        idea: text.trim(),
        story,
        picture,
        ...(dealId ? { dealId } : {}),
        ...(collabId ? { collabId } : {}),
      });
      if (draft.imageError) setError(t("ui.slurp.postGuide.noPicture", { reason: draft.imageError }));
      onDraft({ ...draft, dealId, collabId });
    } catch (cause) {
      setError(getApiErrorMessage(cause, t("ui.slurp.postGuide.failed")));
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  }

  // An idea from Stir drafts once, as soon as the composer opens with it.
  const autoRan = useRef<string | null>(null);
  useEffect(() => {
    if (!autoRun) {
      autoRan.current = null;
      return;
    }
    if (autoRan.current === initialIdea || !initialIdea.trim()) return;
    autoRan.current = initialIdea;
    setIdea(initialIdea);
    void write(initialIdea);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per handed-over idea
  }, [autoRun, initialIdea]);

  return (
    <section
      aria-label={t("ui.slurp.postGuide.label")}
      className="space-y-2 rounded-2xl bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)]"
    >
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void write();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className={cn(SLP_TYPE.meta, "mb-1 block text-[var(--slurp-muted)]")}>
            {t(story ? "ui.slurp.postGuide.storyQuestion" : "ui.slurp.postGuide.question")}
          </span>
          <input
            value={idea}
            maxLength={600}
            disabled={disabled || pending}
            onChange={(event) => setIdea(event.target.value)}
            placeholder={t("ui.slurp.postGuide.placeholder")}
            className="h-11 w-full rounded-xl bg-[var(--slurp-surface-raised)] px-3 text-base text-[var(--slurp-text)] shadow-[var(--slurp-highlight)] outline-none placeholder:text-[var(--slurp-muted)] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-60 sm:text-[15px]"
          />
        </label>
        <SlpPrimaryButton type="submit" disabled={disabled || pending || !idea.trim()} className="shrink-0 px-4">
          {pending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <SlpSparkleGlyph size={16} aria-hidden="true" />
          )}
          {pending ? t("ui.slurp.postGuide.writing") : t("ui.slurp.postGuide.write")}
          <SlpUsesAiMark />
        </SlpPrimaryButton>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          className={cn(SLP_TYPE.meta, "flex min-h-11 cursor-pointer items-center gap-2 text-[var(--slurp-text)]")}
        >
          <input
            type="checkbox"
            checked={picture}
            disabled={disabled || pending}
            onChange={(event) => setPicture(event.target.checked)}
            className="size-4 accent-[var(--noodle-accent)]"
          />
          {t("ui.slurp.postGuide.generatePicture")}
        </label>
        {onUpload && (
          <SlpButton
            variant="secondary"
            disabled={disabled || pending}
            onClick={() => {
              setPicture(false);
              onUpload();
            }}
          >
            <ImagePlus size={16} aria-hidden="true" />
            {t("ui.slurp.postGuide.uploadPicture")}
          </SlpButton>
        )}
      </div>
      {(deals.length > 0 || collabs.length > 0) && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("ui.slurp.postGuide.forLabel")}>
          {deals.map((deal) => (
            <SlpChip
              key={deal.id}
              selected={dealId === deal.id}
              disabled={pending}
              onClick={() => setDealId((current) => (current === deal.id ? null : deal.id))}
              className="min-h-9"
            >
              <Megaphone size={14} aria-hidden="true" />
              {t("ui.slurp.postGuide.deal", { brand: deal.brand })}
            </SlpChip>
          ))}
          {collabs.map((collab) => (
            <SlpChip
              key={collab.id}
              selected={collabId === collab.id}
              disabled={pending}
              onClick={() => setCollabId((current) => (current === collab.id ? null : collab.id))}
              className="min-h-9"
            >
              <Handshake size={14} aria-hidden="true" />
              {t("ui.slurp.postGuide.collab", {
                name: nameOf(collab.hostId === accountId ? collab.partnerId : collab.hostId),
              })}
            </SlpChip>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className={cn(SLP_TYPE.meta, "text-[var(--slurp-danger)]")}>
          {error}
        </p>
      )}
    </section>
  );
}
