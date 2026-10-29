// ──────────────────────────────────────────────
// Otome Forge: a dark chapter opens with its content tags. Nothing is written until the player begins, and Ease off
// is offered for any moment after.
// ──────────────────────────────────────────────
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Feather, Undo2 } from "lucide-react";
import { LIMIT_IDS, type LimitId } from "../../shared/content";
import { LIMIT_LABEL_KEYS } from "../setup/ContentStep";

/** The planner's extra tags, beside the Lines & Veils catalog (S/story/prompts.ts lists the same five). */
const STORY_TAG_KEYS: Record<string, string> = {
  jealousy: "ui.otomeForge.reader.tagJealousy",
  grief: "ui.otomeForge.reader.tagGrief",
  possessiveness: "ui.otomeForge.reader.tagPossessiveness",
  betrayal: "ui.otomeForge.reader.tagBetrayal",
  violence: "ui.otomeForge.reader.tagViolence",
};

const isLimitId = (tag: string): tag is LimitId => (LIMIT_IDS as readonly string[]).includes(tag);

/** A tag's catalog key, or null for a tag the client has no label for (it is left out). */
export function tagLabelKey(tag: string): string | null {
  return isLimitId(tag) ? LIMIT_LABEL_KEYS[tag] : Object.hasOwn(STORY_TAG_KEYS, tag) ? STORY_TAG_KEYS[tag]! : null;
}

interface ContentTagsCardProps {
  tags: string[];
  onBegin: () => void;
  onLeave: () => void;
}

export function ContentTagsCard({ tags, onBegin, onLeave }: ContentTagsCardProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const labels = tags.flatMap((tag) => {
    const key = tagLabelKey(tag);
    return key ? [t(key)] : [];
  });
  return (
    <section className="of-tags-card of-glass of-glass--strong" aria-labelledby={titleId}>
      <h2 id={titleId} className="of-section-title">
        {t("ui.otomeForge.reader.tagsTitle")}
      </h2>
      <p className="of-body">{t("ui.otomeForge.reader.tagsIntro")}</p>
      <ul className="of-tag-list" aria-label={t("ui.otomeForge.reader.tagsLabel")}>
        {labels.map((label) => (
          <li key={label} className="of-tag">
            {label}
          </li>
        ))}
      </ul>
      <p className="of-hint">
        {t("ui.otomeForge.reader.tagsEaseOff")} <Feather size={13} strokeWidth={2} aria-hidden="true" />
      </p>
      <div className="of-inline-actions">
        <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={onLeave}>
          <Undo2 size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.reader.notNow")}
        </button>
        <button type="button" className="of-button of-button--primary of-button--small" onClick={onBegin}>
          <BookOpen size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.reader.begin")}
        </button>
      </div>
    </section>
  );
}
