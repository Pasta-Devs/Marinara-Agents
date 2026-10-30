// ──────────────────────────────────────────────
// Otome Forge setup, step 4: content. Heat, Darkness, Lines & Veils and the image rating. Raising Heat to NSFW,
// Darkness to Dark romance or the image rating above SFW asks for the 18+ confirmation first; lowering never asks.
// The same controls serve Settings → Content and Settings → Images. The server enforces every rule again.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CloudMoon, Eclipse, Flame, HeartCrack, Lock, Moon, Plus, Sun, Trash } from "lucide-react";
import { useAgeGate } from "../../components/AgeGateDialog";
import {
  contentNeedsAgeGate,
  CUSTOM_LIMIT_TEXT_MAX,
  CUSTOM_LIMITS_MAX,
  imageRatingNeedsAgeGate,
  intimacyOpen,
  LIMIT_IDS,
  limitIsFixed,
  limitsForDarkness,
  playerLimits,
  type ContentSettings,
  type Darkness,
  type Heat,
  type ImageRating,
  type LimitId,
  type LimitLevel,
  type McRole,
} from "../../shared/content";
import type { SetupDraft } from "./draft";
import { ChoiceCards, Pills, Section, type Choice } from "./parts";

export type AgeGate = ReturnType<typeof useAgeGate>;

export const LIMIT_LABEL_KEYS: Record<LimitId, string> = {
  "violence-others": "ui.otomeForge.setup.limitViolenceOthers",
  gore: "ui.otomeForge.setup.limitGore",
  threats: "ui.otomeForge.setup.limitThreats",
  captivity: "ui.otomeForge.setup.limitCaptivity",
  manipulation: "ui.otomeForge.setup.limitManipulation",
  stalking: "ui.otomeForge.setup.limitStalking",
  "violence-to-protagonist": "ui.otomeForge.setup.limitViolenceToProtagonist",
  torture: "ui.otomeForge.setup.limitTorture",
  "self-harm": "ui.otomeForge.setup.limitSelfHarm",
  "dubious-consent": "ui.otomeForge.setup.limitDubiousConsent",
  "non-consent": "ui.otomeForge.setup.limitNonConsent",
  pregnancy: "ui.otomeForge.setup.limitPregnancy",
};

const LEVEL_LABEL_KEYS: Record<LimitLevel, string> = {
  allow: "ui.otomeForge.setup.levelAllow",
  veil: "ui.otomeForge.setup.levelVeil",
  line: "ui.otomeForge.setup.levelLine",
};

/** Limits the current Heat, Darkness and gate hold at Line become Lines (the server does the same). */
function holdFixed(content: ContentSettings, ageGate: boolean): ContentSettings {
  const limits = { ...content.limits };
  for (const id of LIMIT_IDS) if (limitIsFixed(id, content, ageGate)) limits[id] = "line";
  return { ...content, limits };
}

interface ContentControlsProps {
  content: ContentSettings;
  onChange: (content: ContentSettings) => void;
  gate: AgeGate;
}

/** The content without the protagonist's role: unspecified, or Heat back at SFW (#1936). */
function withoutRole(content: ContentSettings): ContentSettings {
  const { mcRole: _role, ...rest } = content;
  return rest;
}

export function ContentControls({ content, onChange, gate }: ContentControlsProps) {
  const { t } = useTranslation();
  const locked = !gate.confirmed;
  // The levels the player chose, kept across Darkness changes (an arrow key through the Darkness radios included).
  const [picks, setPicks] = useState(() => playerLimits(content, gate.confirmed));

  const heats: Choice<Heat>[] = [
    {
      value: "sfw",
      title: t("ui.otomeForge.setup.heatSfw"),
      description: t("ui.otomeForge.setup.heatSfwText"),
      Icon: Moon,
    },
    {
      value: "fade",
      title: t("ui.otomeForge.setup.heatFade"),
      description: t("ui.otomeForge.setup.heatFadeText"),
      Icon: CloudMoon,
      gated: locked,
    },
    {
      value: "explicit",
      title: t("ui.otomeForge.setup.heatExplicit"),
      description: t("ui.otomeForge.setup.heatExplicitText"),
      Icon: Flame,
      gated: locked,
    },
  ];
  const darknesses: Choice<Darkness>[] = [
    {
      value: "gentle",
      title: t("ui.otomeForge.setup.darknessGentle"),
      description: t("ui.otomeForge.setup.darknessGentleText"),
      Icon: Sun,
    },
    {
      value: "angst",
      title: t("ui.otomeForge.setup.darknessAngst"),
      description: t("ui.otomeForge.setup.darknessAngstText"),
      Icon: HeartCrack,
    },
    {
      value: "dark",
      title: t("ui.otomeForge.setup.darknessDark"),
      description: t("ui.otomeForge.setup.darknessDarkText"),
      Icon: Eclipse,
      gated: locked,
    },
  ];

  /**
   * Applies a raise only once the gate is confirmed; a lowered setting applies at once. Past this point the gate only
   * matters for non-consent, which needs Dark and NSFW Heat, so it is confirmed whenever it counts.
   */
  const change = async (next: ContentSettings) => {
    if (contentNeedsAgeGate(next) && !gate.confirmed && !(await gate.request())) return;
    onChange(holdFixed(next, true));
  };

  const levels = (["allow", "veil", "line"] as const).map((level) => ({
    value: level,
    label: t(LEVEL_LABEL_KEYS[level]),
  }));
  const customLevels = (["veil", "line"] as const).map((level) => ({
    value: level,
    label: t(LEVEL_LABEL_KEYS[level]),
  }));
  const setCustom = (index: number, patch: Partial<ContentSettings["custom"][number]>) =>
    onChange({
      ...content,
      custom: content.custom.map((limit, at) => (at === index ? { ...limit, ...patch } : limit)),
    });

  return (
    <>
      <ChoiceCards
        legend={t("ui.otomeForge.setup.heatLegend")}
        value={content.heat}
        choices={heats}
        onChange={(heat) => void change(heat === "sfw" ? { ...withoutRole(content), heat } : { ...content, heat })}
      />
      <ChoiceCards
        legend={t("ui.otomeForge.setup.darknessLegend")}
        value={content.darkness}
        choices={darknesses}
        onChange={(darkness) => void change({ ...content, darkness, limits: limitsForDarkness(darkness, picks) })}
      />
      {content.darkness === "dark" ? <p className="of-notice">{t("ui.otomeForge.setup.darkPromise")}</p> : null}
      {intimacyOpen(content) ? (
        <>
          <Pills<McRole | "none">
            legend={t("ui.otomeForge.setup.mcRoleLegend")}
            value={content.mcRole ?? "none"}
            options={[
              { value: "none", label: t("ui.otomeForge.setup.mcRoleNone") },
              { value: "sub", label: t("ui.otomeForge.setup.mcRoleSub") },
              { value: "dom", label: t("ui.otomeForge.setup.mcRoleDom") },
              { value: "switch", label: t("ui.otomeForge.setup.mcRoleSwitch") },
            ]}
            onChange={(role) => onChange(role === "none" ? withoutRole(content) : { ...content, mcRole: role })}
          />
          <p className="of-hint">{t("ui.otomeForge.setup.mcRoleHint")}</p>
        </>
      ) : null}
      <Section title={t("ui.otomeForge.setup.limitsLegend")} hint={t("ui.otomeForge.setup.limitsHint")}>
        <ul className="of-limits">
          {LIMIT_IDS.map((limit) => {
            const fixed = limitIsFixed(limit, content, gate.confirmed);
            const label = t(LIMIT_LABEL_KEYS[limit]);
            return (
              <li key={limit} className="of-limit" data-fixed={fixed}>
                <span className="of-limit-name">
                  {label}
                  {fixed ? (
                    <span className="of-limit-fixed">
                      <Lock size={11} strokeWidth={2.4} aria-hidden="true" />
                      {limit === "non-consent"
                        ? t("ui.otomeForge.setup.limitFixedNonConsent")
                        : t("ui.otomeForge.setup.limitFixed")}
                    </span>
                  ) : null}
                </span>
                <Pills
                  legend={label}
                  hideLegend
                  small
                  disabled={fixed}
                  value={fixed ? "line" : content.limits[limit]}
                  options={levels}
                  onChange={(level) => {
                    setPicks((current) => ({ ...current, [limit]: level }));
                    onChange({ ...content, limits: { ...content.limits, [limit]: level } });
                  }}
                />
              </li>
            );
          })}
        </ul>
        <div className="of-custom-limits">
          <p className="of-legend of-legend--small">{t("ui.otomeForge.setup.customLegend")}</p>
          {content.custom.map((limit, index) => (
            <div key={index} className="of-custom-limit">
              <input
                className="of-input"
                value={limit.text}
                maxLength={CUSTOM_LIMIT_TEXT_MAX}
                placeholder={t("ui.otomeForge.setup.customPlaceholder")}
                aria-label={t("ui.otomeForge.setup.customText", { number: index + 1 })}
                onChange={(event) => setCustom(index, { text: event.target.value })}
              />
              <Pills
                legend={t("ui.otomeForge.setup.customLevel", { number: index + 1 })}
                hideLegend
                small
                value={limit.level}
                options={customLevels}
                onChange={(level) => setCustom(index, { level })}
              />
              <button
                type="button"
                className="of-icon-button of-glass"
                aria-label={t("ui.otomeForge.setup.customRemove", { number: index + 1 })}
                title={t("ui.otomeForge.setup.customRemove", { number: index + 1 })}
                onClick={() => onChange({ ...content, custom: content.custom.filter((_, at) => at !== index) })}
              >
                <Trash size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          ))}
          {content.custom.length < CUSTOM_LIMITS_MAX ? (
            <button
              type="button"
              className="of-button of-button--quiet of-glass of-button--small"
              onClick={() => onChange({ ...content, custom: [...content.custom, { text: "", level: "line" }] })}
            >
              <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
              {t("ui.otomeForge.setup.customAdd")}
            </button>
          ) : (
            <p className="of-hint">{t("ui.otomeForge.setup.customFull", { max: CUSTOM_LIMITS_MAX })}</p>
          )}
        </div>
      </Section>
    </>
  );
}

interface ImageRatingControlProps {
  rating: ImageRating;
  onChange: (rating: ImageRating) => void;
  gate: AgeGate;
}

export function ImageRatingControl({ rating, onChange, gate }: ImageRatingControlProps) {
  const { t } = useTranslation();
  const locked = !gate.confirmed;
  const ratings: Choice<ImageRating>[] = [
    { value: "sfw", title: t("ui.otomeForge.setup.ratingSfw"), description: t("ui.otomeForge.setup.ratingSfwText") },
    {
      value: "suggestive",
      title: t("ui.otomeForge.setup.ratingSuggestive"),
      description: t("ui.otomeForge.setup.ratingSuggestiveText"),
      gated: locked,
    },
    {
      value: "explicit",
      title: t("ui.otomeForge.setup.ratingExplicit"),
      description: t("ui.otomeForge.setup.ratingExplicitText"),
      gated: locked,
    },
  ];
  return (
    <ChoiceCards
      legend={t("ui.otomeForge.setup.ratingLegend")}
      hint={t("ui.otomeForge.setup.ratingHint")}
      value={rating}
      choices={ratings}
      onChange={(next) => {
        if (imageRatingNeedsAgeGate(next) && !gate.confirmed) {
          void gate.request().then((confirmed) => confirmed && onChange(next));
        } else onChange(next);
      }}
    />
  );
}

interface ContentStepProps {
  draft: SetupDraft;
  update: (change: (draft: SetupDraft) => SetupDraft) => void;
}

export function ContentStep({ draft, update }: ContentStepProps) {
  const { t } = useTranslation();
  const gate = useAgeGate();
  return (
    <div className="of-step-body">
      <p className="of-hand of-step-note">{t("ui.otomeForge.setup.contentNote")}</p>
      <ContentControls
        content={draft.content}
        gate={gate}
        onChange={(content) => update((current) => ({ ...current, content }))}
      />
      <ImageRatingControl
        rating={draft.images.rating}
        gate={gate}
        onChange={(rating) => update((current) => ({ ...current, images: { ...current.images, rating } }))}
      />
      <p className="of-hint">
        {gate.confirmed ? t("ui.otomeForge.gate.confirmedNote") : t("ui.otomeForge.gate.lockedNote")}
      </p>
      {gate.dialog}
    </div>
  );
}
