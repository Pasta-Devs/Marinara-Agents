import { useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  CalendarHeart,
  DoorClosed,
  DoorOpen,
  HeartCrack,
  HeartHandshake,
  HeartOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_EYEBROW_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpHeartGlyph } from "../../base/chrome/SlpGlyphs";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { SlpBreakupAftermathSheet } from "../../modules/creator/SlpBreakupAftermath";
import { slpAftermathChoices } from "../../modules/creator/slp-breakup-aftermath";
import { formatRelativeTime } from "../../base/ui/slp-date-time";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import {
  slurpCoupleForAccount,
  useSlurpTies,
  useSlurpTiesMutations,
  type SlurpCoupleSteer,
  type SlurpTiesCouple,
  type SlurpTiesCreator,
} from "./slp-ties-hooks";

const rowClass = "flex flex-col gap-2 py-3";
const listClass = "divide-y divide-[var(--noodle-divider)]";

/** The newest thing that happened to them, as one plain line. */
function useMomentLine() {
  const { t } = useTranslation();
  return (couple: SlurpTiesCouple, name: (id: string) => string) => {
    const moment = couple.moments.at(-1);
    if (!moment) return couple.origin === "card" ? t("ui.slurp.ties.couple.fromCards") : "";
    if (moment.kind === "jealous" && moment.withId)
      return t("ui.slurp.ties.moment.jealousCollab", { name: name(moment.withId) });
    if (moment.kind === "joined" && moment.withId)
      return t("ui.slurp.ties.moment.joined", { name: name(moment.withId) });
    return t(`ui.slurp.ties.moment.${moment.kind}`, { detail: moment.detail });
  };
}

/**
 * One list of Studio's Relationships (U: couples, crushes or exes; 7b-couples): who is together, what
 * happened last, and the player's steering: plan a date, stir some drama, patch it up, break them
 * up, get them back together, the opt-in shared page, and a real collab for a couple (work, not life).
 */
export function SlpCouplesSection({
  personaId,
  title: heading,
  couples,
  byId,
  Row,
}: {
  personaId: string;
  title: string;
  couples: SlurpTiesCouple[];
  byId: Map<string, SlurpTiesCreator>;
  Row: (props: { a?: SlurpTiesCreator; b?: SlurpTiesCreator; title: string; detail?: ReactNode }) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const actions = useSlurpTiesMutations(personaId);
  const momentLine = useMomentLine();
  // #1293: a breakup (or an ex's later change) asks what it leaves behind before it runs.
  const [ending, setEnding] = useState<SlurpTiesCouple | null>(null);
  if (!couples.length) return null;
  const name = (id: string) => byId.get(id)?.name ?? t("ui.slurp.ties.someone");
  const busy = actions.steerCouple.isPending || actions.couplePage.isPending || actions.suggest.isPending;
  const onError = (error: unknown) => toast.error(errorMessage(error));
  const steer = (couple: SlurpTiesCouple, value: SlurpCoupleSteer, aftermath?: "moveOn" | "forget") =>
    actions.steerCouple.mutate(
      { id: couple.id, steer: value, aftermath },
      {
        onSuccess: () => {
          setEnding(null);
          toast.success(
            t(
              value === "breakUp" && aftermath === "moveOn"
                ? "ui.slurp.ties.couple.done.breakUpMoveOn"
                : value === "breakUp" && aftermath === "forget"
                  ? "ui.slurp.ties.couple.done.breakUpForget"
                  : `ui.slurp.ties.couple.done.${value}`,
            ),
          );
        },
        onError,
      },
    );
  const endingNames = ending
    ? { a: [ending.aId, ...(ending.moreIds ?? [])].map(name).join(", "), b: name(ending.bId) }
    : { a: "", b: "" };
  const page = (couple: SlurpTiesCouple, open: boolean) =>
    actions.couplePage.mutate(
      { id: couple.id, open },
      {
        onSuccess: () => toast.success(t(open ? "ui.slurp.ties.couple.pageOpened" : "ui.slurp.ties.couple.pageClosed")),
        onError,
      },
    );
  // A couple can make a real collab too (U): it goes to Business as a request, and it is work.
  const workTogether = (couple: SlurpTiesCouple) =>
    actions.suggest.mutate(
      { aId: couple.aId, bId: couple.bId },
      { onSuccess: () => toast.success(t("ui.slurp.ties.couple.workDone")), onError },
    );
  // Polyamory (0.3.5): a couple of three or four reads "A, B & C" in the same line.
  const title = (couple: SlurpTiesCouple) =>
    t(`ui.slurp.ties.couple.${couple.stage === "split" && couple.ending === "fizzled" ? "fizzled" : couple.stage}`, {
      a: [couple.aId, ...(couple.moreIds ?? [])].map(name).join(", "),
      b: name(couple.bId),
    });

  return (
    <section className="space-y-2" aria-label={heading} data-slurp-couples>
      <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{heading}</h4>
      <ul className={listClass}>
        {couples.map((couple) => {
          const live = couple.stage !== "split";
          const pageOpen = Boolean(couple.page && !couple.page.closedAt);
          // A couple with the player's own page has no shared page (the server refuses one).
          const withPlayer = [couple.aId, couple.bId].some((id) => byId.get(id)?.automatic === false);
          const forced = couple.forced
            ? t(`ui.slurp.ties.couple.forced.${couple.forced.misfit}`, { name: name(couple.forced.byId) })
            : "";
          const after = !live && couple.aftermath ? t(`ui.slurp.breakup.state.${couple.aftermath}`) : "";
          const line = [momentLine(couple, name), forced, after].filter(Boolean).join(" · ");
          const when = formatRelativeTime(couple.moments.at(-1)?.at ?? couple.stageAt, i18n.language);
          return (
            <li key={couple.id} className={rowClass} data-slurp-couple={couple.stage}>
              <Row
                a={byId.get(couple.aId)}
                b={byId.get(couple.bId)}
                title={title(couple)}
                detail={line ? `${line} · ${when}` : when}
              />
              {couple.page && (
                <p className={cn(SLP_TYPE.meta, "flex items-center gap-1.5 text-[var(--slurp-muted)]")}>
                  <SlpHeartGlyph size={12} filled color="var(--noodle-accent)" aria-hidden="true" />
                  {pageOpen
                    ? t("ui.slurp.ties.couple.pageLine", { name: name(couple.page.accountId) })
                    : t("ui.slurp.ties.couple.pageClosedLine", { name: name(couple.page.accountId) })}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {live && couple.stage !== "rocky" && (
                  <SlpButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() => steer(couple, "date")}
                    className="min-h-11 px-4 text-sm"
                  >
                    <CalendarHeart size={15} aria-hidden="true" />
                    {t("ui.slurp.ties.couple.date")}
                  </SlpButton>
                )}
                {couple.stage === "rocky" && (
                  <SlpButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() => steer(couple, "patchUp")}
                    className="min-h-11 px-4 text-sm"
                  >
                    <HeartHandshake size={15} aria-hidden="true" />
                    {t("ui.slurp.ties.couple.patchUp")}
                  </SlpButton>
                )}
                {/* Opened while it is good; a page already open can be closed any time. */}
                {(pageOpen ? live : !withPlayer && (couple.stage === "dating" || couple.stage === "together")) && (
                  <SlpButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() => page(couple, !pageOpen)}
                    className="min-h-11 px-4 text-sm"
                  >
                    {pageOpen ? <DoorClosed size={15} aria-hidden="true" /> : <DoorOpen size={15} aria-hidden="true" />}
                    {t(pageOpen ? "ui.slurp.ties.couple.closePage" : "ui.slurp.ties.couple.openPage")}
                  </SlpButton>
                )}
                {!live && (
                  <SlpButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() => steer(couple, "reunite")}
                    className="min-h-11 px-4 text-sm"
                  >
                    <SlpHeartGlyph size={15} aria-hidden="true" />
                    {t(couple.ending === "fizzled" ? "ui.slurp.ties.couple.retry" : "ui.slurp.ties.couple.reunite")}
                  </SlpButton>
                )}
                {!live && (
                  <SlpButton
                    variant="tertiary"
                    disabled={busy}
                    onClick={() => setEnding(couple)}
                    className="min-h-11 text-sm"
                    data-slurp-couple-aftermath
                  >
                    <HeartOff size={15} aria-hidden="true" />
                    {t("ui.slurp.breakup.afterwards")}
                  </SlpButton>
                )}
              </div>
              {live ? (
                <div className="flex flex-wrap gap-x-2">
                  {(couple.stage === "dating" || couple.stage === "together") && (
                    <SlpButton
                      variant="tertiary"
                      disabled={busy}
                      onClick={() => workTogether(couple)}
                      className="min-h-11 text-sm"
                    >
                      <BriefcaseBusiness size={15} aria-hidden="true" />
                      {t("ui.slurp.ties.couple.work")}
                    </SlpButton>
                  )}
                  {(couple.stage === "dating" || couple.stage === "together") && (
                    <SlpButton
                      variant="tertiary"
                      disabled={busy}
                      onClick={() => steer(couple, "drama")}
                      className="min-h-11 text-sm"
                    >
                      <Zap size={15} aria-hidden="true" />
                      {t("ui.slurp.ties.couple.drama")}
                    </SlpButton>
                  )}
                  {
                    <SlpButton
                      variant="tertiary"
                      disabled={busy}
                      onClick={() => setEnding(couple)}
                      data-slurp-couple-break-up
                      className="min-h-11 text-sm"
                    >
                      <HeartCrack size={15} aria-hidden="true" />
                      {t(couple.stage === "sparks" ? "ui.slurp.ties.couple.callOff" : "ui.slurp.ties.couple.breakUp")}
                    </SlpButton>
                  }
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <SlpBreakupAftermathSheet
        open={Boolean(ending)}
        title={t(ending?.stage === "split" ? "ui.slurp.breakup.afterTitle" : "ui.slurp.breakup.title", endingNames)}
        label={t(ending?.stage === "split" ? "ui.slurp.breakup.aftermath.labelEx" : "ui.slurp.breakup.aftermath.label")}
        options={ending ? slpAftermathChoices(ending) : []}
        confirmLabel={t(ending?.stage === "split" ? "ui.slurp.breakup.apply" : "ui.slurp.ties.couple.breakUp")}
        busy={actions.steerCouple.isPending}
        // A breakup closes an open shared page, and Undo does not reopen it (runSlurpTieLever).
        undoable={ending?.stage === "split" || !ending?.page || Boolean(ending.page.closedAt)}
        onClose={() => setEnding(null)}
        onConfirm={(aftermath) =>
          ending &&
          (ending.stage === "split"
            ? steer(ending, aftermath as SlurpCoupleSteer)
            : steer(ending, "breakUp", aftermath === "keep" ? undefined : aftermath))
        }
      />
    </section>
  );
}

/**
 * The couple line on a profile, under the location: "With @kai" once they are official (both
 * pages), or on a shared page "Shared page of @mira and @kai", and a quiet note when it closed.
 */
export function SlpProfileCoupleLine({
  personaId,
  accountId,
  onOpenProfile,
}: {
  personaId: string | null;
  accountId: string;
  onOpenProfile?: (accountId: string) => void;
}) {
  const { t } = useTranslation();
  const { data } = useSlurpTies(personaId);
  const found = slurpCoupleForAccount(data, accountId);
  if (!data || !found) return null;
  const byId = new Map(data.creators.map((creator) => [creator.id, creator]));
  const link = (id: string) => {
    const creator = byId.get(id);
    if (!creator) return null;
    return (
      <button
        type="button"
        disabled={!onOpenProfile}
        onClick={() => onOpenProfile?.(id)}
        className="min-w-0 truncate rounded font-semibold text-[var(--noodle-accent-foreground)] enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:cursor-default"
      >
        @{creator.handle}
      </button>
    );
  };
  const heart = <SlpHeartGlyph size={14} filled color="var(--noodle-accent)" aria-hidden="true" className="shrink-0" />;
  const lineClass = cn(SLP_TYPE.meta, "mt-2 flex min-w-0 items-center gap-1 text-[var(--slurp-muted)]");
  if (found.page?.page) {
    const couple = found.page;
    const closed = Boolean(couple.page?.closedAt);
    return (
      <div data-slurp-couple-line="page">
        <p className={lineClass}>
          {heart}
          <span className="shrink-0">{t("ui.slurp.profile.couple.page")}</span>
          {link(couple.aId)}
          {(couple.moreIds ?? []).map((id) => (
            <span key={id} className="contents">
              <span className="shrink-0">,</span>
              {link(id)}
            </span>
          ))}
          <span className="shrink-0">{t("ui.slurp.profile.couple.and")}</span>
          {link(couple.bId)}
        </p>
        {closed && (
          <p className={cn(SLP_TYPE.meta, "mt-1 text-[var(--slurp-muted)]")}>
            {couple.stage === "split"
              ? t("ui.slurp.profile.couple.closedSplit", {
                  a: byId.get(couple.aId)?.name ?? "",
                  b: byId.get(couple.bId)?.name ?? "",
                })
              : t("ui.slurp.profile.couple.closed")}
          </p>
        )}
      </div>
    );
  }
  // Official only: flirting and early dates are not on the badge (they are in the posts).
  const couple = found.couple;
  if (!couple || (couple.stage !== "together" && couple.stage !== "rocky")) return null;
  return (
    <p className={lineClass} data-slurp-couple-line="badge">
      {heart}
      <span className="shrink-0">{t("ui.slurp.profile.couple.with")}</span>
      {[couple.aId, couple.bId, ...(couple.moreIds ?? [])]
        .filter((id) => id !== accountId)
        .map((id) => (
          <span key={id} className="contents">
            {link(id)}
          </span>
        ))}
    </p>
  );
}

/**
 * A shared couple page is not a person (7c M-002): its Message button opens this sheet, and the
 * player writes to one of the two partners on their own chat.
 */
export function SlpCouplePageWriteSheet({
  personaId,
  accountId,
  open,
  onClose,
  onWrite,
}: {
  personaId: string | null;
  accountId: string;
  open: boolean;
  onClose: () => void;
  onWrite: (creatorId: string) => void;
}) {
  const { t } = useTranslation();
  const { data } = useSlurpTies(personaId);
  const couple = data?.couples.find((entry) => entry.page?.accountId === accountId);
  const partners = couple
    ? [couple.aId, couple.bId, ...(couple.moreIds ?? [])].flatMap(
        (id) => data?.creators.filter((creator) => creator.id === id) ?? [],
      )
    : [];
  return (
    <SlpSheet open={open} onClose={onClose} title={t("ui.slurp.profile.couple.writeTitle")}>
      <div className="flex flex-col gap-2 px-3 pb-3 pt-1" data-slurp-couple-write>
        <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.profile.couple.writeHint")}</p>
        {partners.map((creator) => (
          <SlpButton
            key={creator.id}
            variant="quiet"
            onClick={() => {
              onClose();
              onWrite(creator.id);
            }}
            className="justify-start px-3"
          >
            {t("ui.slurp.profile.couple.writeTo", { name: creator.name })}
          </SlpButton>
        ))}
      </div>
    </SlpSheet>
  );
}
