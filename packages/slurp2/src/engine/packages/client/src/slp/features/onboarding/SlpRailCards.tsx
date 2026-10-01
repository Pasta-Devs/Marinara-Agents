// The cards inside the Support ticket (docs/ONBOARDING-RAIL.md): Mari's Creator header, her locked
// post, the "X set · Change" pill, the member file with "Stamp it", and the approval stamp.
import { useEffect, useRef } from "react";
import { Loader2, Star } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlpCreatorPostView, SlpCreatorStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_GROUP_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { slpPrefersReducedMotion } from "../../base/chrome/slp-motion";
import { SlpButton, SlpPrimaryButton, slpTagClass } from "../../modules/chrome/SlpButton";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import { playSlpBurst } from "../../modules/sparkle/SlpSparkle";
import { slpRailAnswers, type SlpRailContext, type SlpRailQuestion, type SlpRailState } from "./slp-site-welcome";

type T = ReturnType<typeof useUiTranslation>["t"];

// Mari demonstrates; the example stays the same whatever the player picks later.
const DEMO_PROFILE: SlpCreatorStageProfile = {
  id: "onboarding-demo",
  noodleAccountId: null,
  handle: "professor_mari",
  displayName: "Professor Mari",
  bio: "",
  avatarUrl: "/sprites/mari/chibi-professor-mari.png",
  avatarCrop: null,
  disclosureMode: "open",
  stagePersonality: "",
  appearance: "",
  wardrobe: "",
  locations: "",
  publicIdentity: null,
  page: null,
  createdAt: "",
  updatedAt: "",
};
const DEMO_POST: Pick<SlpCreatorPostView, "id" | "access" | "createdAt" | "title" | "imageUrl"> &
  Partial<Pick<SlpCreatorPostView, "likeCount" | "replyCount">> = {
  id: "onboarding-demo-post",
  access: "locked",
  createdAt: new Date().toISOString(),
  title: null,
  // Pre-blurred teaser: the card must read as paywalled; unlocking swaps in the payoff image.
  imageUrl: "/sprites/mari/Mari_noodler_teaser_locked.webp",
  likeCount: 12,
  replyCount: 3,
};

const RAISED =
  "rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]";

/** What one answer reads as: a chip or the player's bubble ("answer"), or a file row ("row"). */
export function slpRailAnswerLabel(
  t: T,
  id: SlpRailQuestion,
  value: string | undefined,
  context: SlpRailContext,
  as: "answer" | "row" = "answer",
) {
  if (value === undefined) return t(id === "connection" ? "ui.slurp.site.value.none" : "ui.slurp.scene.page.empty");
  if (id === "pace") return t(`ui.noodle.noodlerwizard.activityChoice.${value}.title`);
  if (id === "who" && as === "row") return t(`ui.slurp.site.value.who.${value}`);
  if (id === "connection" || id === "imageConnection") {
    const list = id === "connection" ? context.textConnections : context.imageConnections;
    return list.find((connection) => connection.id === value)?.name ?? value;
  }
  return t(`ui.slurp.site.a.${id}.${value}`);
}

/** The rating gag's stars as icons: a "★" character is missing from some system fonts. */
export function SlpRailStars({ count, label }: { count: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={label ? "img" : undefined} aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <Star key={index} size={14} aria-hidden="true" className="fill-current !text-current" />
      ))}
    </span>
  );
}

/** Chapter 3: what a Creator looks like (Mari, as in the old tour). */
export function SlpRailSampleCreator() {
  const { t } = useUiTranslation();
  return (
    <div className={cn(RAISED, "flex items-center gap-3 px-4 py-3")}>
      <Avatar account={{ displayName: DEMO_PROFILE.displayName, avatarUrl: DEMO_PROFILE.avatarUrl }} size="lg" />
      <div className="min-w-0">
        <p className={cn(SLP_TYPE.title, "truncate")}>{DEMO_PROFILE.displayName}</p>
        <p className={cn(SLP_TYPE.meta, "truncate text-[var(--slurp-muted)]")}>@{DEMO_PROFILE.handle}</p>
        <p className={cn(SLP_TYPE.body, "mt-1 text-pretty")}>{t("ui.slurp.site.card.sample")}</p>
      </div>
    </div>
  );
}

/** Chapter 4: Mari's locked post. The rail waits for the reveal. */
export function SlpRailLockedDemo({ onReveal }: { onReveal: () => void }) {
  const { t } = useUiTranslation();
  return (
    // Spans the chat (a centred card): in the host's column the post header squeezed Mari's name away.
    <div className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
      <LockedSlurpPostCard
        post={{ ...DEMO_POST, title: t("ui.noodle.noodlerwizard.demoPost.walkthrough.title") }}
        profile={DEMO_PROFILE}
        subscribed={false}
        unlockPending={false}
        subscriptionPending={false}
        onUnlock={() => {}}
        onToggleSubscription={() => {}}
        demo={{
          body: t("ui.noodle.noodlerwizard.demoPost.walkthrough.body"),
          lockedTitle: t("ui.noodle.noodlerwizard.demoPost.walkthrough.lockedTitle"),
          unlockedLabel: t("ui.noodle.postaccess.unlocked"),
          unlockedImageUrl: "/sprites/mari/Mari_noodler_teaser_unlocked.webp",
          onReveal,
        }}
      />
    </div>
  );
}

/** "Pace set · Change" after an answer. */
export function SlpRailChangePill({
  label,
  recent,
  onChange,
}: {
  label: string;
  recent: boolean;
  /** Absent once the file is stamped. */
  onChange?: () => void;
}) {
  const { t } = useUiTranslation();
  return (
    <div
      className={cn(
        "my-1 flex min-h-9 items-center gap-1 rounded-full ps-3 pe-1 text-xs font-semibold shadow-[var(--slurp-highlight)]",
        recent ? "bg-[var(--slurp-tint)]" : "bg-[var(--slurp-surface-raised)]",
        !onChange && "pe-3",
      )}
    >
      <SlpSparkleGlyph size={12} aria-hidden="true" className="shrink-0 text-[var(--slurp-ink)]" />
      <span className="px-1">{t("ui.slurp.site.set", { setting: label })}</span>
      {onChange && (
        <SlpButton variant="tertiary" className="min-h-9 px-2.5 text-xs" onClick={onChange}>
          {t("ui.slurp.site.change")}
        </SlpButton>
      )}
    </div>
  );
}

/** Every answer as a row: the member file, "Your Slurp", and "Your file" in the Support desk. */
export function SlpRailFileRows({
  rows,
  state,
  context,
  recent,
  onChange,
}: {
  rows: readonly SlpRailQuestion[];
  state: SlpRailState;
  context: SlpRailContext;
  recent?: SlpRailQuestion | null;
  onChange?: (id: SlpRailQuestion) => void;
}) {
  const { t } = useUiTranslation();
  const answers = slpRailAnswers(state, context);
  return (
    <ul className={SLP_GROUP_CLASS}>
      {rows.map((id) => (
        <li
          key={id}
          className={cn(
            "flex min-h-12 items-center gap-2 px-4 py-2 transition-colors duration-[var(--slurp-motion-slow)] motion-reduce:transition-none",
            id === recent && "bg-[var(--slurp-tint)]",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t(`ui.slurp.site.label.${id}`)}</p>
            <p className={cn(SLP_TYPE.body, "break-words")}>
              {slpRailAnswerLabel(t, id, id === "fun" ? (answers.fun ?? "skip") : answers[id], context, "row")}
            </p>
          </div>
          {onChange && (
            <SlpButton
              variant="tertiary"
              className="min-h-11 shrink-0 px-3 text-xs"
              aria-label={`${t("ui.slurp.site.change")}: ${t(`ui.slurp.site.label.${id}`)}`}
              onClick={() => onChange(id)}
            >
              {t("ui.slurp.site.change")}
            </SlpButton>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Chapter 7: the file with Change per row and "Stamp it", the only write. */
export function SlpRailMemberFile({
  rows,
  state,
  context,
  stamped,
  pending,
  onChange,
  onStamp,
}: {
  rows: readonly SlpRailQuestion[];
  state: SlpRailState;
  context: SlpRailContext;
  stamped: boolean;
  pending: boolean;
  onChange: (id: SlpRailQuestion) => void;
  onStamp: () => void;
}) {
  const { t } = useUiTranslation();
  return (
    <section className={cn(RAISED, "flex w-full flex-col gap-3 p-3")}>
      <header className="flex items-center justify-between gap-2 px-1">
        <h3 className={SLP_TYPE.title}>{t("ui.slurp.site.memberFile")}</h3>
        <span className={slpTagClass(stamped)}>
          {t(stamped ? "ui.slurp.site.status.resolved" : "ui.slurp.site.status.open")}
        </span>
      </header>
      <SlpRailFileRows rows={rows} state={state} context={context} onChange={stamped ? undefined : onChange} />
      {!stamped && (
        <SlpPrimaryButton className="h-12 text-[15px]" disabled={pending} onClick={onStamp}>
          {pending && <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
          {t("ui.slurp.site.tap.stamp")}
        </SlpPrimaryButton>
      )}
    </section>
  );
}

/** Chapter 8: the approval stamp lands on the file, with a Burst. */
export function SlpRailStampCard() {
  const { t } = useUiTranslation();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current && !slpPrefersReducedMotion()) playSlpBurst(ref.current, 12);
  }, []);
  return (
    <div
      ref={ref}
      className="my-2 -rotate-6 rounded-xl px-4 py-1.5 text-lg font-black uppercase tracking-[0.18em] text-[var(--noodle-accent-foreground)] ring-[3px] ring-inset ring-[var(--noodle-accent)] motion-reduce:rotate-0"
    >
      {t("ui.slurp.site.stamped")}
    </div>
  );
}
