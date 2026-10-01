// The player's own join (the role-play sign-up with the roles swapped): Slurp Support asks five
// quick questions in the chat, the player answers with a tap, and every answer shows as a page
// change with "Change". The old five-screen tour stays one tap away ("Show me around").
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { cn } from "../../../lib/utils";
import { SLP_GROUP_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import type { SlurpActivityPreset } from "../../modules/creator/slp-activity-presets";
import { SlpButton, SlpChip, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpWizardFooter, SlpWizardProgress } from "../../modules/chrome/SlpWizardChrome";
import { slurpBubbleSurface } from "../../modules/chrome/SlpChatShell";
import {
  SLP_SITE_WELCOME_OPTIONS,
  SLP_SITE_WELCOME_QUESTIONS,
  slpSiteWelcomeLead,
  slpSiteWelcomeNext,
  slpSiteWelcomeSetting,
  type SlpSiteWelcomeAnswers,
  type SlpSiteWelcomeQuestion,
} from "./slp-site-welcome";

export function SlpSiteWelcome({
  settings,
  onSignUp,
  onFeed,
  onTour,
}: {
  settings: {
    activityChoice: SlurpActivityPreset | null;
    imagesEnabled: boolean;
    nightQuiet: boolean;
    disclosure: SlpIdentityDisclosure;
    chooseActivity: (choice: SlurpActivityPreset) => void;
    setImagesEnabled: (value: boolean) => void;
    setNightQuiet: (value: boolean) => void;
    setDisclosure: (value: SlpIdentityDisclosure) => void;
  };
  onSignUp: () => void;
  onFeed: () => void;
  onTour: () => void;
}) {
  const { t } = useUiTranslation();
  const [answers, setAnswers] = useState<SlpSiteWelcomeAnswers>({});
  const [order, setOrder] = useState<SlpSiteWelcomeQuestion[]>([]);
  const [editing, setEditing] = useState<SlpSiteWelcomeQuestion | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const current = editing ?? slpSiteWelcomeNext(answers);
  const lead = slpSiteWelcomeLead(answers);
  const support = t("ui.slurp.scene.host.support");
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [order.length, current]);

  const answerLabel = (question: SlpSiteWelcomeQuestion, value: string) =>
    question === "pace"
      ? t(`ui.noodle.noodlerwizard.activityChoice.${value}.title`)
      : t(`ui.slurp.site.a.${question}.${value}`);
  const answer = (question: SlpSiteWelcomeQuestion, value: string) => {
    const setting = slpSiteWelcomeSetting(question, value);
    if (setting?.kind === "pace") settings.chooseActivity(setting.value);
    if (setting?.kind === "pictures") settings.setImagesEnabled(setting.value);
    if (setting?.kind === "nights") settings.setNightQuiet(setting.value);
    if (setting?.kind === "names") settings.setDisclosure(setting.value);
    setAnswers((previous) => ({ ...previous, [question]: value }));
    setOrder((previous) => [...previous.filter((entry) => entry !== question), question]);
    setEditing(null);
  };
  const values: Record<SlpSiteWelcomeQuestion, string> = {
    who: answers.who ? t(`ui.slurp.site.value.who.${answers.who}`) : t("ui.slurp.scene.page.empty"),
    pace: settings.activityChoice
      ? t(`ui.noodle.noodlerwizard.activityChoice.${settings.activityChoice}.title`)
      : t("ui.slurp.scene.page.empty"),
    pictures: t(`ui.slurp.site.value.${settings.imagesEnabled ? "on" : "off"}`),
    nights: t(`ui.slurp.site.value.${settings.nightQuiet ? "on" : "off"}`),
    names: t(`ui.slurp.site.a.names.${settings.disclosure === "open" ? "open" : "hinted"}`),
  };
  const index = current ? SLP_SITE_WELCOME_QUESTIONS.indexOf(current) : SLP_SITE_WELCOME_QUESTIONS.length - 1;
  const done = current === null;
  const recent = order[order.length - 1];

  const bubble = (key: string, text: string, mine: boolean) => (
    <p
      key={key}
      className={cn(
        "max-w-[86%] whitespace-pre-wrap break-words rounded-[1.25rem] px-3.5 py-2 text-[0.95rem] leading-snug sm:max-w-[78%] sm:text-sm sm:leading-relaxed",
        mine ? "self-end" : "self-start",
        slurpBubbleSurface(mine),
      )}
    >
      {text}
    </p>
  );
  return (
    <>
      {/* Roles swapped: here the player is the one being asked. */}
      <p className={cn(SLP_TYPE.body, "pb-2 font-semibold text-pretty")}>{t("ui.slurp.site.role")}</p>
      <SlpWizardProgress
        current={index + 1}
        total={SLP_SITE_WELCOME_QUESTIONS.length}
        stepOf={t("ui.slurp.scene.progress.support", {
          current: index + 1,
          total: SLP_SITE_WELCOME_QUESTIONS.length,
        })}
        label={t(`ui.slurp.site.label.${current ?? "names"}`)}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-label={t("ui.slurp.scene.chatLabel")}
            className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 py-2"
          >
            <p className={cn(SLP_TYPE.caption, "px-2 text-[var(--slurp-muted)]")}>{support}</p>
            {bubble("greet1", t("ui.slurp.site.greet1"), false)}
            {bubble("greet2", t("ui.slurp.site.greet2"), false)}
            {order.map((question) => (
              <div key={question} className="flex flex-col gap-1.5 pt-1.5">
                {bubble(`q-${question}`, t(`ui.slurp.site.q.${question}`), false)}
                {bubble(`a-${question}`, answerLabel(question, String(answers[question])), true)}
                <div
                  className={cn(
                    "my-1 flex min-h-9 items-center gap-1 self-center rounded-full ps-3 pe-1 text-xs font-semibold shadow-[var(--slurp-highlight)]",
                    question === recent ? "bg-[var(--slurp-tint)]" : "bg-[var(--slurp-surface-raised)]",
                  )}
                >
                  <SlpSparkleGlyph size={12} aria-hidden="true" className="shrink-0 text-[var(--slurp-ink)]" />
                  <span className="px-1">
                    {t("ui.slurp.site.set", { setting: t(`ui.slurp.site.label.${question}`) })}
                  </span>
                  <SlpButton variant="tertiary" className="min-h-9 px-2.5 text-xs" onClick={() => setEditing(question)}>
                    {t("ui.slurp.site.change")}
                  </SlpButton>
                </div>
              </div>
            ))}
            {current && !order.includes(current) && bubble(`q-${current}`, t(`ui.slurp.site.q.${current}`), false)}
            {editing && bubble(`again-${editing}`, t(`ui.slurp.site.q.${editing}`), false)}
            {done && bubble("done", t(`ui.slurp.site.done.${lead}`), false)}
          </div>
          <div
            role="group"
            aria-label={current ? t(`ui.slurp.site.q.${current}`) : t("ui.slurp.site.nextLabel")}
            className="flex flex-wrap justify-end gap-1.5 pt-2"
          >
            {current
              ? SLP_SITE_WELCOME_OPTIONS[current].map((value) => (
                  <SlpChip
                    key={value}
                    selected={answers[current] === value}
                    className="min-h-10 px-3.5"
                    onClick={() => answer(current, value)}
                  >
                    {answerLabel(current, value)}
                  </SlpChip>
                ))
              : [
                  <SlpChip key="signup" className="min-h-10 px-3.5" onClick={onSignUp}>
                    {t("ui.slurp.site.signUp")}
                  </SlpChip>,
                  <SlpChip key="feed" className="min-h-10 px-3.5" onClick={onFeed}>
                    {t("ui.slurp.site.feed")}
                  </SlpChip>,
                ]}
          </div>
        </div>
        <section aria-label={t("ui.slurp.site.preview")} className="min-h-0 overflow-y-auto max-sm:hidden">
          <h4 className={cn(SLP_TYPE.title, "flex min-h-11 items-center")}>{t("ui.slurp.site.preview")}</h4>
          <ul className={SLP_GROUP_CLASS}>
            {SLP_SITE_WELCOME_QUESTIONS.map((question) => (
              <li
                key={question}
                className={cn(
                  "px-4 py-2.5 transition-colors duration-[var(--slurp-motion-slow)] motion-reduce:transition-none",
                  question === recent && "bg-[var(--slurp-tint)]",
                )}
              >
                <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t(`ui.slurp.site.label.${question}`)}</p>
                <p className={SLP_TYPE.body}>{values[question]}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <SlpWizardFooter
        skip={{ label: t("ui.slurp.site.tour"), onClick: onTour }}
        primary={
          <SlpPrimaryButton onClick={done && lead === "feed" ? onFeed : onSignUp}>
            {done && lead === "feed" ? t("ui.slurp.site.feed") : t("ui.slurp.site.signUp")}
            <ChevronRight size={16} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
          </SlpPrimaryButton>
        }
      />
    </>
  );
}
