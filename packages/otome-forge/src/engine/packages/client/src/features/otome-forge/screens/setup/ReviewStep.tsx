// ──────────────────────────────────────────────
// Otome Forge setup, step 6: review. Everything chosen, each with a way back to change it, and what forging will cost:
// one planning call, one bible per love interest, and images only when the player asks.
// ──────────────────────────────────────────────
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PencilLine } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { CostHint } from "../../components/CostHint";
import { useConnections } from "../../hooks/use-engine-resources";
import { nameAccent } from "../../lib/accent";
import type { Darkness, Heat, ImageRating } from "../../shared/content";
import { ARCHETYPE_LABELS } from "./CastStep";
import { FACES_PER_LOOK, resolvePronouns, type PronounChoice, type SetupDraft, type SetupStep } from "./draft";

const HEAT_KEYS: Record<Heat, string> = {
  sfw: "ui.otomeForge.setup.heatSfw",
  fade: "ui.otomeForge.setup.heatFade",
  explicit: "ui.otomeForge.setup.heatExplicit",
};
const DARKNESS_KEYS: Record<Darkness, string> = {
  gentle: "ui.otomeForge.setup.darknessGentle",
  angst: "ui.otomeForge.setup.darknessAngst",
  dark: "ui.otomeForge.setup.darknessDark",
};
const RATING_KEYS: Record<ImageRating, string> = {
  sfw: "ui.otomeForge.setup.ratingSfw",
  suggestive: "ui.otomeForge.setup.ratingSuggestive",
  explicit: "ui.otomeForge.setup.ratingExplicit",
};

export function pronounText(choice: PronounChoice): string {
  const pronouns = resolvePronouns(choice);
  return pronouns ? `${pronouns.subject}/${pronouns.object}` : "";
}

function ReviewCard({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: SetupStep;
  onEdit: (step: SetupStep) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="of-review of-glass">
      <div className="of-review-head">
        <h3 className="of-section-title">{title}</h3>
        <button
          type="button"
          className="of-button of-button--text of-button--small"
          aria-label={t("ui.otomeForge.setup.reviewEdit", { section: title })}
          onClick={() => onEdit(step)}
        >
          <PencilLine size={14} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.setup.edit")}
        </button>
      </div>
      {children}
    </section>
  );
}

interface ReviewStepProps {
  draft: SetupDraft;
  onEdit: (step: SetupStep) => void;
}

export function ReviewStep({ draft, onEdit }: ReviewStepProps) {
  const { t } = useTranslation();
  const connections = useConnections();
  const costId = useId();
  const nameOf = (id: string) => connections.text.find((connection) => connection.id === id)?.name ?? id;
  const imageConnection = connections.image.find((connection) => connection.id === draft.images.connectionId);
  const count = draft.lis.length;
  const lines = Object.values(draft.content.limits).filter((level) => level === "line").length;
  const veils = Object.values(draft.content.limits).filter((level) => level === "veil").length;
  const customs = draft.content.custom.filter((limit) => limit.text.trim()).length;
  const liName = (li: SetupDraft["lis"][number]) =>
    li.name.trim() || (li.archetype ? t(ARCHETYPE_LABELS[li.archetype].nameKey) : "");

  return (
    <div className="of-step-body">
      <p className="of-hand of-step-note">{t("ui.otomeForge.setup.reviewNote")}</p>
      <ReviewCard title={t("ui.otomeForge.setup.stepPremise")} step="premise" onEdit={onEdit}>
        {draft.title.trim() ? <p className="of-review-title">{draft.title.trim()}</p> : null}
        <p className="of-review-premise">{draft.premise.trim()}</p>
        <p className="of-hint">{t("ui.otomeForge.setup.reviewLanguage", { language: draft.language.trim() })}</p>
      </ReviewCard>
      <ReviewCard title={t("ui.otomeForge.setup.stepProtagonist")} step="protagonist" onEdit={onEdit}>
        <div className="of-review-person">
          <Avatar name={draft.protagonist.name} size={38} />
          <div>
            <p className="of-member-name">{draft.protagonist.name}</p>
            <p className="of-hint">{pronounText(draft.protagonist.pronouns)}</p>
          </div>
        </div>
        {draft.protagonist.traits.length ? <p className="of-body">{draft.protagonist.traits.join(" · ")}</p> : null}
        {draft.protagonist.goal.trim() ? <p className="of-hint">{draft.protagonist.goal.trim()}</p> : null}
      </ReviewCard>
      <ReviewCard title={t("ui.otomeForge.setup.stepCast")} step="cast" onEdit={onEdit}>
        <ul className="of-review-cast">
          {draft.lis.map((li) => (
            <li key={li.key} className="of-review-person">
              <Avatar
                name={liName(li)}
                url={li.source === "card" ? li.avatarUrl : null}
                accent={nameAccent(liName(li))}
                size={38}
              />
              <div>
                <p className="of-member-name">{liName(li)}</p>
                <p className="of-hint">
                  {pronounText(li.pronouns)} ·{" "}
                  {li.source === "card"
                    ? t("ui.otomeForge.setup.fromCard")
                    : t("ui.otomeForge.setup.fromArchetype", {
                        archetype: li.archetype ? t(ARCHETYPE_LABELS[li.archetype].nameKey) : "",
                      })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </ReviewCard>
      <ReviewCard title={t("ui.otomeForge.setup.stepContent")} step="content" onEdit={onEdit}>
        <dl className="of-review-list">
          <dt>{t("ui.otomeForge.setup.heatLegend")}</dt>
          <dd>{t(HEAT_KEYS[draft.content.heat])}</dd>
          <dt>{t("ui.otomeForge.setup.darknessLegend")}</dt>
          <dd>{t(DARKNESS_KEYS[draft.content.darkness])}</dd>
          <dt>{t("ui.otomeForge.setup.limitsLegend")}</dt>
          <dd>{t("ui.otomeForge.setup.reviewLimits", { lines, veils, customs })}</dd>
          <dt>{t("ui.otomeForge.setup.ratingLegend")}</dt>
          <dd>{t(RATING_KEYS[draft.images.rating])}</dd>
        </dl>
      </ReviewCard>
      <ReviewCard title={t("ui.otomeForge.setup.stepConnections")} step="connections" onEdit={onEdit}>
        <dl className="of-review-list">
          <dt>{t("ui.otomeForge.setup.connectionNarration")}</dt>
          <dd>{nameOf(draft.connections.narration)}</dd>
          <dt>{t("ui.otomeForge.setup.connectionImage")}</dt>
          <dd>{imageConnection ? imageConnection.name : t("ui.otomeForge.setup.noImages")}</dd>
        </dl>
      </ReviewCard>
      <section className="of-review of-review--cost of-glass" aria-labelledby={costId}>
        <h3 id={costId} className="of-section-title">
          {t("ui.otomeForge.setup.costTitle")}
        </h3>
        <p className="of-body">{t("ui.otomeForge.setup.costText", { count: count + 1 })}</p>
        {imageConnection ? (
          <>
            <CostHint images={count + 1} note={t("ui.otomeForge.setup.costLooksNote")} />
            {draft.images.expressions ? (
              <CostHint images={FACES_PER_LOOK * count} about note={t("ui.otomeForge.setup.costExpressionsNote")} />
            ) : null}
          </>
        ) : (
          <p className="of-hint">{t("ui.otomeForge.setup.costNoImages")}</p>
        )}
      </section>
    </div>
  );
}
