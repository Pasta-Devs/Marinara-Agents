import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { focusRing } from "../../base/chrome/slp-focus";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { SlpButton, SlpChip, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { Toggle } from "../../modules/settings/SlpSettingsControls";
import { SlpBreakupAftermathPick } from "../../modules/creator/SlpBreakupAftermath";
import { slpAftermathChoices } from "../../modules/creator/slp-breakup-aftermath";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import {
  SLP_ACTION_META,
  SLP_BOND_KINDS,
  SLP_STORYLINE_MOVES,
  type SlpActionName,
  type SlpBreakupAftermath,
} from "../../../../../shared/src/slp/slp-actions.js";
import { SLP_STEERING_MOODS, SLP_STEERING_PACES } from "../../../../../shared/src/slp/slp-creator-steering.js";
import { SLP_SPICE_LEVELS } from "../../../../../shared/src/slp/slp-spice.js";
import type { SlpActionPreview, SlpStirView } from "../../../../../shared/src/slp/slp-stir.js";
import { SlpTextAssist } from "../assist/slp-assist-contract";
import { useSlurpStirPreview } from "./slp-stir-hooks";
import { SlpStirCard, slpStirCantLine, useSlpStirDoIt } from "./SlpStirCards";
import { SlpStirDeskFields } from "./SlpStirDeskFields";
import { SlpStirBrandPick } from "./SlpStirBrandPick";
import { Choice, CreatorPicker } from "./SlpStirFormParts";
import { slpStirCoupleSteers, slpStirStepOf, type SlpStirForm } from "./slp-stir-steps";

const inputClass = `min-h-11 w-full rounded-xl bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm ${focusRing}`;

type Creator = SlpStirView["creators"][number];
type Form = SlpStirForm;

/** What each lever may pick: the pages Slurp posts for write posts and throw shade; anyone can be set up. */
const needsAutomatic = new Set<SlpActionName>([
  "add-idea",
  "write-post",
  "steer-creator",
  "set-spice",
  "start-storyline",
]);

/** Everyday moments a Creator could post about (0.3.1): one tap fills the idea. */
const MOMENTS = ["badDay", "workout", "newOutfit", "bigWin", "quietWeek", "tripAway"] as const;

/** A picked thing in the world (a couple, a collab, a rivalry, an event, a storyline) as rows. */
function Pick({
  label,
  empty,
  items,
  value,
  onChange,
}: {
  label: string;
  empty: string;
  items: { id: string; title: string; detail?: string; who: Creator[] }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className={cn(SLP_TYPE.meta, "font-semibold")}>{label}</legend>
      {items.length === 0 ? (
        <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{empty}</p>
      ) : (
        <div className="space-y-1.5" role="radiogroup">
          {items.map((item) => {
            const on = value === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(item.id)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-start ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
                  on
                    ? "bg-[image:var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45"
                    : "bg-[var(--slurp-canvas)] ring-[var(--slurp-outline)] hover:bg-[var(--accent)]",
                )}
              >
                {item.who.length > 0 && (
                  <span className="flex shrink-0 -space-x-2" aria-hidden="true">
                    {item.who.map((person) => (
                      <Avatar
                        key={person.id}
                        account={{ displayName: person.name, avatarUrl: person.avatarUrl }}
                        size="xs"
                        className="ring-2 ring-[var(--slurp-canvas)]"
                      />
                    ))}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn(SLP_TYPE.body, "block truncate font-semibold")}>{item.title}</span>
                  {item.detail && (
                    <span className={cn(SLP_TYPE.meta, "block truncate text-[var(--slurp-muted)]")}>{item.detail}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

/**
 * Playing one card: who (and a few options), then the preview card, then "Do it". Nothing runs
 * before the tap, and the preview is free.
 */
export function SlpStirPlaySheet({
  action,
  view,
  prefill,
  onClose,
  onUse,
  useLabel,
}: {
  action: SlpActionName | null;
  view: SlpStirView | undefined;
  /** The Creator the sheet came from (the ✦ sheet, a suggestion). */
  prefill?: { who?: string[]; pick?: string };
  onClose: () => void;
  /**
   * Hands the checked card back instead of running it: a Support thread attaches it to the next
   * line as an Offer or a move (docs/SUPPORT-DESK.md).
   */
  onUse?: (card: SlpActionPreview) => void;
  useLabel?: string;
}) {
  const { t } = useTranslation();
  const textId = useId();
  const [form, setForm] = useState<Form>({});
  const [cards, setCards] = useState<SlpActionPreview[] | null>(null);
  // Why a step made no card, so an empty sheet never leaves "Do it" greyed out without a word.
  const [cant, setCant] = useState<string[]>([]);
  const preview = useSlurpStirPreview();
  const doIt = useSlpStirDoIt();
  // Each reset starts a new generation; a preview that answers for an older one is dropped.
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setForm({ who: prefill?.who ?? [], pick: prefill?.pick ?? null });
    setCards(null);
    setCant([]);
    // The prefill's ids, not its object: a caller may build a new one on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, prefill?.who?.join("|"), prefill?.pick]);
  if (!action) return null;
  const set = (patch: Form) => {
    generation.current += 1;
    setForm((current) => ({ ...current, ...patch }));
    setCards(null);
    setCant([]);
  };
  const creators = (view?.creators ?? []).filter((creator) => !creator.couplePage);
  const byId = new Map((view?.creators ?? []).map((creator) => [creator.id, creator]));
  const who = (...ids: string[]) => ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
  const nameOf = (id: string) => byId.get(id)?.name ?? "";
  const step = slpStirStepOf(action, form);
  const picked = (form.who as string[] | undefined) ?? [];
  // Desk levers (0.3.5) are no deck cards, so the action's own metadata says what it acts on.
  const deck = SLP_ACTION_META[action];

  const body: ReactNode[] = [];
  const textField = (label: string, placeholder: string, field?: "idea" | "chapter", max = 160) =>
    body.push(
      <div key="text" className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <label htmlFor={textId} className={cn(SLP_TYPE.meta, "font-semibold")}>
            {label}
          </label>
          {field && picked[0] && (
            <SlpTextAssist
              field={field}
              value={String(form.text ?? "")}
              accountId={picked[0] ?? (typeof form.pick === "string" ? form.pick.split("|")[0] : undefined)}
              onApply={(text) => set({ text })}
            />
          )}
        </div>
        <input
          id={textId}
          value={String(form.text ?? "")}
          maxLength={max}
          placeholder={placeholder}
          onChange={(event) => set({ text: event.target.value })}
          className={inputClass}
        />
      </div>,
    );

  const titleField = (label: string, placeholder: string) =>
    body.push(
      <div key="title" className="space-y-2">
        <label htmlFor={`${textId}-title`} className={cn(SLP_TYPE.meta, "font-semibold")}>
          {label}
        </label>
        <input
          id={`${textId}-title`}
          value={String(form.title ?? "")}
          maxLength={60}
          placeholder={placeholder}
          onChange={(event) => set({ title: event.target.value })}
          className={inputClass}
        />
      </div>,
    );

  if (deck.targets === "creator")
    body.push(
      <CreatorPicker
        key="who"
        max={1}
        label={t("ui.slurp.stir.form.who")}
        creators={needsAutomatic.has(action) ? creators.filter((creator) => creator.automatic) : creators}
        picked={picked}
        onPick={(ids) => set(action === "offer-brand-deal" ? { who: ids, pick: null } : { who: ids })}
      />,
    );
  if (deck.targets === "pair")
    body.push(
      <CreatorPicker
        key="who"
        max={2}
        label={action === "start-rivalry" ? t("ui.slurp.stir.form.rivals") : t("ui.slurp.stir.form.two")}
        // Another persona's page is not the player's to pair (Drama audit); their own pages are.
        creators={creators.filter((creator) => creator.automatic || creator.own)}
        picked={picked}
        onPick={(ids) => set({ who: ids })}
      />,
    );
  // Who starts a rivalry matters: say the order and let it flip (0.3.1).
  if (action === "start-rivalry" && picked.length === 2)
    body.push(
      <div key="order" className="flex items-center justify-between gap-2">
        <p className={cn(SLP_TYPE.meta, "min-w-0 text-[var(--slurp-muted)]")}>
          {t("ui.slurp.stir.form.rivalOrder", { a: nameOf(picked[0]!), b: nameOf(picked[1]!) })}
        </p>
        <SlpButton
          variant="quiet"
          className="min-h-11 shrink-0 text-xs"
          onClick={() => set({ who: [picked[1]!, picked[0]!] })}
        >
          {t("ui.slurp.stir.form.swap")}
        </SlpButton>
      </div>,
    );
  if (deck.category === "desk")
    body.push(<SlpStirDeskFields key="desk" action={action} form={form} set={set} creators={creators} />);
  switch (action) {
    case "add-idea":
      textField(t("ui.slurp.stir.form.idea"), t("ui.slurp.stir.form.ideaPlaceholder"), "idea");
      body.push(
        <div key="moments" role="group" aria-label={t("ui.slurp.stir.form.moments")} className="space-y-2">
          <p className={cn(SLP_TYPE.meta, "font-semibold")} aria-hidden="true">
            {t("ui.slurp.stir.form.moments")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MOMENTS.map((moment) => (
              <SlpChip key={moment} onClick={() => set({ text: t(`ui.slurp.stir.moment.${moment}`) })}>
                {t(`ui.slurp.stir.moment.${moment}`)}
              </SlpChip>
            ))}
          </div>
        </div>,
      );
      body.push(
        <Toggle
          key="story"
          compact
          label={t("ui.slurp.steering.asStory")}
          value={form.story === true}
          onChange={(story) => set({ story })}
        />,
      );
      break;
    case "start-storyline":
      titleField(t("ui.slurp.stir.form.storyTitle"), t("ui.slurp.stir.form.storyTitlePlaceholder"));
      textField(t("ui.slurp.stir.form.storyWhere"), t("ui.slurp.stir.form.storyWherePlaceholder"));
      if (picked[0])
        body.push(
          <CreatorPicker
            key="with"
            max={2}
            label={t("ui.slurp.stir.form.storyWith")}
            creators={creators.filter((creator) => creator.automatic && creator.id !== picked[0])}
            picked={(form.with as string[] | undefined) ?? []}
            onPick={(ids) => set({ with: ids })}
          />,
        );
      break;
    case "set-tip-goal":
      // The goal's label is 80 characters at most (the schema); a longer one only failed as "invalid".
      textField(t("ui.slurp.stir.form.goalFor"), t("ui.slurp.stir.form.goalForPlaceholder"), undefined, 80);
      body.push(
        <div key="target" className="space-y-2">
          <label htmlFor={`${textId}-target`} className={cn(SLP_TYPE.meta, "font-semibold")}>
            {t("ui.slurp.stir.form.goalTarget")}
          </label>
          <input
            id={`${textId}-target`}
            type="number"
            inputMode="numeric"
            min={1}
            max={1_000_000}
            step={1}
            value={String(form.target ?? "")}
            onChange={(event) => set({ target: event.target.value })}
            className={inputClass}
          />
        </div>,
      );
      break;
    case "new-look":
      textField(t("ui.slurp.stir.form.lookChange"), t("ui.slurp.stir.form.lookChangePlaceholder"));
      break;
    case "invent-event":
      titleField(t("ui.slurp.stir.form.eventName"), t("ui.slurp.stir.form.eventNamePlaceholder"));
      textField(t("ui.slurp.stir.form.eventWhat"), t("ui.slurp.stir.form.eventWhatPlaceholder"));
      body.push(
        <Choice
          key="days"
          label={t("ui.slurp.stir.form.eventDays")}
          value={String(form.days ?? "1")}
          onChange={(days) => set({ days })}
          options={["1", "3", "7", "14"].map((days) => ({
            value: days,
            label: t("ui.slurp.stir.form.days", { count: Number(days) }),
          }))}
        />,
      );
      break;
    case "write-post":
      textField(t("ui.slurp.stir.form.postIdea"), t("ui.slurp.stir.form.ideaPlaceholder"), "idea");
      body.push(
        <Toggle
          key="story"
          compact
          label={t("ui.slurp.steering.asStory")}
          value={form.story === true}
          onChange={(story) => set({ story })}
        />,
      );
      break;
    case "steer-creator":
      body.push(
        <Choice
          key="mood"
          label={t("ui.slurp.steering.mood")}
          value={(form.mood as string) ?? null}
          onChange={(mood) => set({ mood })}
          options={[
            { value: "none", label: t("ui.slurp.steering.moods.none") },
            ...SLP_STEERING_MOODS.map((mood) => ({ value: mood, label: t(`ui.slurp.steering.moods.${mood}`) })),
          ]}
        />,
        <Choice
          key="pace"
          label={t("ui.slurp.steering.pace")}
          value={(form.pace as string) ?? null}
          onChange={(pace) => set({ pace })}
          options={SLP_STEERING_PACES.map((pace) => ({ value: pace, label: t(`ui.slurp.steering.paces.${pace}`) }))}
        />,
      );
      break;
    case "set-spice":
      body.push(
        <Choice
          key="level"
          label={t("ui.slurp.stir.form.level")}
          value={(form.level as string) ?? null}
          onChange={(level) => set({ level })}
          options={[
            ...SLP_SPICE_LEVELS.map((level) => ({ value: level, label: t(`ui.slurp.spice.levels.${level}`) })),
            { value: "default", label: t("ui.slurp.stir.defaultLevel") },
          ]}
        />,
      );
      break;
    case "offer-brand-deal":
      if (picked[0])
        body.push(
          <SlpStirBrandPick
            key="pick"
            accountId={picked[0]}
            value={(form.pick as string) ?? null}
            onChange={(pick) => set({ pick })}
          />,
        );
    // falls through: a deal can be pushed like a collab ("Make it happen").
    case "suggest-collab":
      body.push(
        <div key="happen" className="space-y-1">
          <Toggle
            compact
            label={t("ui.slurp.stir.form.happen")}
            value={form.happen === true}
            onChange={(happen) => set({ happen })}
          />
          <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
            {form.happen ? t("ui.slurp.stir.form.happenOn") : t("ui.slurp.stir.form.happenOff")}
          </p>
        </div>,
      );
      break;
    case "start-rivalry":
      textField(t("ui.slurp.stir.form.cause"), t("ui.slurp.stir.form.causePlaceholder"));
      break;
    case "set-bond":
      body.push(
        <Choice
          key="kind"
          label={t("ui.slurp.stir.form.bondKind")}
          value={(form.kind as string) ?? null}
          onChange={(kind) => set({ kind })}
          options={SLP_BOND_KINDS.map((kind) => ({ value: kind, label: t(`ui.slurp.stir.bond.${kind}`) }))}
        />,
      );
      if (form.kind === "friend")
        body.push(
          <Choice
            key="level"
            label={t("ui.slurp.stir.form.bondLevel")}
            value={String(form.level ?? "1")}
            onChange={(level) => set({ level })}
            options={["0", "1", "2", "3"].map((level) => ({
              value: level,
              label: t(`ui.slurp.stir.bond.level${level}`),
            }))}
          />,
        );
      break;
    case "start-drama":
      body.push(
        <Pick
          key="pick"
          label={t("ui.slurp.stir.form.drama")}
          empty={t("ui.slurp.stir.needs.dramaOff")}
          value={(form.pick as string) ?? null}
          onChange={(pick) => set({ pick })}
          items={(view?.dramas ?? [])
            .filter((drama) => !(view?.runs ?? []).some((run) => run.dramaId === drama.id))
            .map((drama) => ({ id: drama.id, title: drama.name, detail: drama.description, who: [] }))}
        />,
      );
      if (form.pick)
        body.push(
          <CreatorPicker
            key="who"
            max={1}
            label={t("ui.slurp.stir.form.dramaLead")}
            // The first role is a Creator's: the player's own pages play their own roles.
            creators={creators.filter((creator) => creator.automatic)}
            picked={picked}
            onPick={(ids) => set({ who: ids })}
          />,
        );
      break;
    case "add-to-couple": {
      // Polyamory (0.3.5): a couple that is dating or together, and someone who is in no couple.
      const couples = (view?.couples ?? []).filter(
        (couple) =>
          (couple.stage === "dating" || couple.stage === "together" || couple.stage === "rocky") &&
          2 + (couple.moreIds?.length ?? 0) < 4,
      );
      body.push(
        <Pick
          key="pick"
          label={t("ui.slurp.stir.form.couple")}
          empty={t("ui.slurp.stir.form.noCouples")}
          value={(form.pick as string) ?? null}
          onChange={(pick) => set({ pick })}
          items={couples.map((couple) => ({
            id: couple.id,
            title: [couple.aId, couple.bId, ...(couple.moreIds ?? [])].map(nameOf).join(" · "),
            detail: t(`ui.slurp.stir.live.couple.${couple.stage}`),
            who: who(couple.aId, couple.bId, ...(couple.moreIds ?? [])),
          }))}
        />,
        <CreatorPicker
          key="who"
          max={1}
          label={t("ui.slurp.stir.form.joiner", { defaultValue: "Who joins them" })}
          creators={creators.filter(
            (creator) =>
              !couples.some(
                (couple) =>
                  couple.id === form.pick && [couple.aId, couple.bId, ...(couple.moreIds ?? [])].includes(creator.id),
              ),
          )}
          picked={picked}
          onPick={(ids) => set({ who: ids })}
        />,
      );
      break;
    }
    case "steer-couple":
    case "couple-page": {
      const couples = (view?.couples ?? []).filter((couple) =>
        action === "couple-page" ? couple.stage === "dating" || couple.stage === "together" : true,
      );
      body.push(
        <Pick
          key="pick"
          label={t("ui.slurp.stir.form.couple")}
          empty={t("ui.slurp.stir.form.noCouples")}
          value={(form.pick as string) ?? null}
          onChange={(pick) => set({ pick, steer: null, aftermath: null })}
          items={couples.map((couple) => ({
            id: couple.id,
            title: couple.moreIds?.length
              ? [couple.aId, couple.bId, ...couple.moreIds].map(nameOf).join(" · ")
              : t("ui.slurp.stir.pair", { a: nameOf(couple.aId), b: nameOf(couple.bId) }),
            detail: [
              t(`ui.slurp.stir.live.couple.${couple.stage}`),
              couple.stage === "split" && couple.aftermath ? t(`ui.slurp.breakup.state.${couple.aftermath}`) : "",
            ]
              .filter(Boolean)
              .join(" · "),
            who: who(couple.aId, couple.bId),
          }))}
        />,
      );
      const couple = couples.find((entry) => entry.id === form.pick);
      if (couple && action === "steer-couple") {
        const withPlayer = [couple.aId, couple.bId, ...(couple.moreIds ?? [])].some(
          (id) => creators.find((creator) => creator.id === id)?.automatic === false,
        );
        const allowed = slpStirCoupleSteers(couple, withPlayer);
        body.push(
          <Choice
            key="steer"
            label={t("ui.slurp.stir.form.steer")}
            value={(form.steer as string) ?? null}
            onChange={(steer) => set({ steer, aftermath: null })}
            options={allowed.map((steer) => ({ value: steer, label: t(`ui.slurp.stir.steer.${steer}`) }))}
          />,
        );
        // #1293: a breakup says what it leaves behind; the usual memory and fallout stay the default.
        if (form.steer === "breakUp")
          body.push(
            <SlpBreakupAftermathPick
              key="aftermath"
              label={t("ui.slurp.breakup.aftermath.label")}
              options={slpAftermathChoices(couple)}
              value={(form.aftermath as SlpBreakupAftermath | null) ?? "keep"}
              onChange={(aftermath) => set({ aftermath })}
            />,
          );
        if (form.steer === "moveOn" || form.steer === "forget")
          body.push(
            <p key="aftermathHint" className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
              {t(`ui.slurp.breakup.aftermath.${form.steer}Hint`)}
            </p>,
          );
      }
      if (couple && action === "couple-page")
        body.push(
          <Choice
            key="open"
            label={t("ui.slurp.stir.form.page")}
            value={form.open === false ? "close" : "open"}
            onChange={(value) => set({ open: value === "open" })}
            options={[
              { value: "open", label: t("ui.slurp.stir.form.pageOpen") },
              { value: "close", label: t("ui.slurp.stir.form.pageClose") },
            ]}
          />,
        );
      break;
    }
    case "push-collab":
      body.push(
        <Pick
          key="pick"
          label={t("ui.slurp.stir.form.collab")}
          empty={t("ui.slurp.stir.form.noCollabs")}
          value={(form.pick as string) ?? null}
          onChange={(pick) => set({ pick })}
          items={(view?.collabs ?? [])
            .filter((collab) => collab.status === "asked")
            .map((collab) => ({
              id: collab.id,
              title: t("ui.slurp.stir.pair", { a: nameOf(collab.hostId), b: nameOf(collab.partnerId) }),
              detail: t("ui.slurp.stir.live.collab.asked"),
              who: who(collab.hostId, collab.partnerId),
            }))}
        />,
      );
      break;
    case "cool-rivalry":
      body.push(
        <Pick
          key="pick"
          label={t("ui.slurp.stir.form.rivalry")}
          empty={t("ui.slurp.stir.form.noRivalries")}
          value={(form.pick as string) ?? null}
          onChange={(pick) => set({ pick })}
          items={(view?.rivalries ?? [])
            .filter((rivalry) => rivalry.stage !== "cooling")
            .map((rivalry) => ({
              id: rivalry.id,
              title: t("ui.slurp.stir.versus", { a: nameOf(rivalry.fromId), b: nameOf(rivalry.toId) }),
              detail: t(`ui.slurp.stir.live.rivalry.${rivalry.stage}`),
              who: who(rivalry.fromId, rivalry.toId),
            }))}
        />,
      );
      break;
    case "start-event":
      body.push(
        <Pick
          key="pick"
          label={t("ui.slurp.stir.form.event")}
          empty={t("ui.slurp.stir.form.noEvents")}
          value={(form.pick as string) ?? null}
          onChange={(pick) => set({ pick })}
          items={[...(view?.events ?? [])]
            .sort((a, b) => Number(a.running) - Number(b.running))
            .map((event) => ({
              id: event.id,
              title: event.name,
              detail: event.running ? t("ui.slurp.stir.live.event.running") : undefined,
              who: [],
            }))}
        />,
      );
      break;
    case "steer-storyline": {
      body.push(
        <Pick
          key="pick"
          label={t("ui.slurp.stir.form.storyline")}
          empty={t("ui.slurp.stir.form.noStorylines")}
          value={(form.pick as string) ?? null}
          onChange={(pick) => set({ pick, move: null })}
          items={(view?.storylines ?? [])
            .filter((story) => !prefill?.who?.length || prefill.who.includes(story.accountId))
            .map((story) => ({
              id: `${story.accountId}|${story.projectId}`,
              title: story.title,
              detail: t("ui.slurp.stir.form.chapterNow", { name: nameOf(story.accountId), chapter: story.chapter }),
              who: who(story.accountId),
            }))}
        />,
      );
      const story = (view?.storylines ?? []).find((entry) => `${entry.accountId}|${entry.projectId}` === form.pick);
      if (story) {
        body.push(
          <Choice
            key="move"
            label={t("ui.slurp.stir.form.move")}
            value={(form.move as string) ?? null}
            onChange={(move) => set({ move })}
            options={SLP_STORYLINE_MOVES.filter((move) => (story.held ? move !== "hold" : move !== "release")).map(
              (move) => ({ value: move, label: t(`ui.slurp.stir.move.${move}`) }),
            )}
          />,
        );
        if (form.move === "insert" || form.move === "label")
          textField(t("ui.slurp.stir.form.chapter"), t("ui.slurp.projects.addNextPlaceholder"), "chapter");
      }
      break;
    }
    default:
      break;
  }

  const onPreview = () => {
    if (!step) return;
    const asked = generation.current;
    preview.mutate([{ action, input: step }], {
      onSuccess: (answer) => {
        if (asked !== generation.current) return;
        setCant(answer.cant);
        setCards(answer.cards);
      },
      onError: () => {
        if (asked !== generation.current) return;
        setCant([]);
        setCards([]);
      },
    });
  };

  return (
    <SlpSheet
      open={Boolean(action)}
      onClose={onClose}
      back
      title={t(`ui.slurp.stir.card.${action}.title`)}
      footer={
        <div className="flex gap-2 px-3 py-2">
          {cards ? (
            <>
              <SlpButton variant="quiet" className="flex-1" disabled={doIt.pending} onClick={() => setCards(null)}>
                {t("ui.slurp.stir.change")}
              </SlpButton>
              <SlpPrimaryButton
                className="flex-1"
                disabled={!cards.some((card) => !card.error) || doIt.pending}
                onClick={(event) => {
                  const usable = cards.find((card) => !card.error);
                  if (onUse) {
                    if (usable) onUse(usable);
                    onClose();
                    return;
                  }
                  doIt.run(cards, "deck", { from: event.currentTarget.getBoundingClientRect(), onDone: onClose });
                }}
              >
                <SlpSparkleGlyph size={16} aria-hidden="true" />
                {onUse
                  ? (useLabel ?? t("ui.slurp.stir.desk.attach", { defaultValue: "Attach" }))
                  : doIt.pending
                    ? t("ui.slurp.stir.doing")
                    : t("ui.slurp.stir.doIt")}
              </SlpPrimaryButton>
            </>
          ) : (
            <SlpPrimaryButton className="w-full" disabled={!step || preview.isPending} onClick={onPreview}>
              {preview.isPending ? t("ui.slurp.stir.looking") : t("ui.slurp.stir.see")}
            </SlpPrimaryButton>
          )}
        </div>
      }
    >
      <div className="space-y-4 px-2 pb-2" data-slp-stir-play={action}>
        <p className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>{t(`ui.slurp.stir.card.${action}.blurb`)}</p>
        {cards ? (
          <ul className="space-y-2">
            {cards.map((card, index) => (
              <SlpStirCard key={`${card.action}:${index}`} card={card} />
            ))}
            {cant.map((line, index) => (
              <li key={`${index}:${line}`} className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>
                {slpStirCantLine(t, line)}
              </li>
            ))}
            {preview.error && (
              <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-danger)]")}>{errorMessage(preview.error)}</p>
            )}
          </ul>
        ) : (
          <div className="space-y-4 px-1">{body}</div>
        )}
      </div>
    </SlpSheet>
  );
}
