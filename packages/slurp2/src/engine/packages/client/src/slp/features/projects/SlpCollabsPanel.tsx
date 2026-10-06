import { useState, type ReactNode } from "react";
import { formatSlpDollars } from "../../base/ui/slp-number-format";
import { Ban, Check, Handshake, HeartHandshake, Zap } from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import {
  Avatar,
  SLP_EYEBROW_CLASS,
  SLP_GROUP_CLASS,
  SLP_IMG_FRAME_CLASS,
  SLP_TYPE,
  SlurpMediaImg,
} from "../../base/chrome/SlpChrome";
import { SlpButton, SlpPrimaryButton, slpTagClass } from "../../modules/chrome/SlpButton";
import { SlpCreatorChips } from "../../modules/chrome/SlpCreatorChips";
import { SlpCoinText } from "../../modules/coin/SlpCoin";
import { formatRelativeTime } from "../../base/ui/slp-date-time";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import {
  useSlurpTies,
  useSlurpTiesMutations,
  type SlurpTiesCollab,
  type SlurpTiesCreator,
  type SlurpTiesDeal,
  type SlurpTiesRivalry,
} from "./slp-ties-hooks";
import { SlpCouplesSection } from "./SlpCouples";
import { SlpStoryRingAvatar } from "../../modules/story/SlpStoryRing";
import { SLP_CARD_STACK_CLASS } from "../../modules/post/SlpPostHelpers";

const rowClass = "flex flex-col gap-2 py-3";
// Inside Studio's group surface: rows and hairlines, no second box.
const listClass = "divide-y divide-[var(--noodle-divider)]";

/** Two overlapping avatars: who is in it. A Creator with a live Story wears the Story ring (T). */
function Pair({ a, b }: { a?: SlurpTiesCreator; b?: SlurpTiesCreator }) {
  return (
    <span className="flex shrink-0 -space-x-2" aria-hidden="true">
      {[a, b].map((creator, index) =>
        creator ? (
          <SlpStoryRingAvatar
            key={creator.id}
            creatorId={creator.id}
            name={creator.name}
            outset={2}
            className={cn(index === 1 && "relative")}
          >
            <Avatar
              account={{ displayName: creator.name, avatarUrl: creator.avatarUrl }}
              size="sm"
              className="ring-2 ring-[var(--slurp-surface-raised)]"
            />
          </SlpStoryRingAvatar>
        ) : null,
      )}
    </span>
  );
}

function Row({
  a,
  b,
  title,
  detail,
}: {
  a?: SlurpTiesCreator;
  b?: SlurpTiesCreator;
  title: string;
  detail?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Pair a={a} b={b} />
      <span className="min-w-0 flex-1">
        <span className={cn(SLP_TYPE.body, "block font-semibold [overflow-wrap:anywhere]")}>{title}</span>
        {detail && (
          <span className={cn(SLP_TYPE.meta, "block text-[var(--slurp-muted)] [overflow-wrap:anywhere]")}>
            {detail}
          </span>
        )}
      </span>
    </div>
  );
}

/** Pick two Creators as chips (a couple's shared page is not a Creator to pair with). */
function SlpPairPicker({
  creators,
  picked,
  onPick,
  label,
}: {
  creators: SlurpTiesCreator[];
  picked: string[];
  onPick: (ids: string[]) => void;
  label: string;
}) {
  const toggle = (id: string) =>
    onPick(picked.includes(id) ? picked.filter((entry) => entry !== id) : [...picked, id].slice(-2));
  return (
    <SlpCreatorChips
      creators={creators.filter((creator) => !creator.couplePage)}
      picked={picked}
      onToggle={toggle}
      label={label}
    />
  );
}

/** One plain line under a Studio area's header: what the area is, in the world's words. */
function Intro({ children }: { children: ReactNode }) {
  return <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{children}</p>;
}

/**
 * Business (U: collab = work): collab requests between Creators (push one through, block a pair,
 * suggest a collab), where an agreed collab stands (announced, drops on a day, up on both pages, the
 * fans it brought across), rivalries (cool one down) and brand deals. Studio, after the Creators.
 * Everything here happens in-world on its own; this is where the player steers. Couples, crushes and
 * exes are life, not work: `SlpRelationshipsPanel` below.
 */
export function SlpCollabsPanel({ personaId }: { personaId: string }) {
  const { t, i18n } = useTranslation();
  const query = useSlurpTies(personaId);
  const actions = useSlurpTiesMutations(personaId);
  const [picked, setPicked] = useState<string[]>([]);
  const view = query.data;
  if (query.isError)
    return <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.ties.loadFailed")}</p>;
  if (!view) return <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.settings.loading")}</p>;

  const byId = new Map(view.creators.map((creator) => [creator.id, creator]));
  const name = (id: string) => byId.get(id)?.name ?? t("ui.slurp.ties.someone");
  const onError = (error: unknown) => toast.error(errorMessage(error));
  const busy = Object.values(actions).some((mutation) => mutation.isPending);
  const when = (at: string | null) => (at ? formatRelativeTime(at, i18n.language) : "");
  const openCollabs = view.collabs.filter((collab) => ["asked", "agreed", "planned"].includes(collab.status));
  const pastCollabs = view.collabs.filter((collab) => !openCollabs.includes(collab));
  const empty = !view.collabs.length && !view.rivalries.length && !view.deals.length;

  const collabTitle = (collab: SlurpTiesCollab) =>
    collab.status === "asked"
      ? t("ui.slurp.ties.collab.asked", { host: name(collab.hostId), partner: name(collab.partnerId) })
      : t("ui.slurp.ties.collab.together", { host: name(collab.hostId), partner: name(collab.partnerId) });
  const collabStatus = (collab: SlurpTiesCollab) => {
    const split =
      collab.hostShare === 50
        ? t("ui.slurp.ties.collab.splitEven")
        : t("ui.slurp.ties.collab.split", {
            host: name(collab.hostId),
            hostShare: collab.hostShare,
            partnerShare: 100 - collab.hostShare,
          });
    if (collab.status === "asked")
      return byId.get(collab.partnerId)?.own
        ? t("ui.slurp.ties.collab.waitingForYou")
        : t("ui.slurp.ties.collab.waiting", { partner: name(collab.partnerId) });
    // U: agreed → announced ("drops Friday, 7 pm") → posted, with the fans it brought across.
    if (collab.status === "agreed" && collab.dropAt)
      return `${t("ui.slurp.ties.collab.announced", { when: dropWhen(collab.dropAt) })} · ${split}`;
    if (collab.status === "agreed")
      return `${t("ui.slurp.ties.collab.agreed", { host: name(collab.hostId) })} · ${split}`;
    if (collab.status === "planned") return `${t("ui.slurp.ties.collab.planned")} · ${split}`;
    if (collab.status === "posted") {
      const across = (collab.crossover?.host ?? 0) + (collab.crossover?.partner ?? 0);
      return [
        t("ui.slurp.ties.collab.posted"),
        split,
        across ? t("ui.slurp.ties.collab.across", { count: across }) : "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    if (collab.status === "blocked") return t("ui.slurp.ties.collab.blocked");
    return t(`ui.slurp.ties.decline.${collab.decline ?? "offBrand"}`, { partner: name(collab.partnerId) });
  };
  const rivalryLine = (rivalry: SlurpTiesRivalry) =>
    rivalry.stage === "over"
      ? t(`ui.slurp.ties.rivalry.ended.${rivalry.ending ?? "fizzled"}`, {
          a: name(rivalry.fromId),
          b: name(rivalry.toId),
        })
      : t(`ui.slurp.ties.rivalry.${rivalry.stage}`, { a: name(rivalry.fromId), b: name(rivalry.toId) });
  const dealLine = (deal: SlurpTiesDeal) => {
    const who = name(deal.creatorId);
    if (deal.status === "offered")
      return t(byId.get(deal.creatorId)?.own ? "ui.slurp.ties.deal.offeredYou" : "ui.slurp.ties.deal.offered", {
        brand: deal.brand,
        name: who,
      });
    if (deal.status === "declined")
      return t(`ui.slurp.ties.deal.declined.${deal.decline ?? "offBrand"}`, { brand: deal.brand, name: who });
    const done = deal.postId ? "ui.slurp.ties.deal.done" : "ui.slurp.ties.deal.took";
    return t(deal.status === "done" ? done : "ui.slurp.ties.deal.accepted", {
      brand: deal.brand,
      name: who,
      amount: formatSlpDollars(deal.fee, i18n.language),
    });
  };

  // "Tuesday 7:00 PM": a day this week and the hour the fans were told.
  const dropWhen = (at: string) =>
    new Date(at).toLocaleString(i18n.language, { weekday: "long", hour: "numeric", minute: "2-digit" });
  const suggest = () =>
    picked.length === 2 &&
    actions.suggest.mutate(
      { aId: picked[0]!, bId: picked[1]! },
      {
        onSuccess: () => {
          setPicked([]);
          toast.success(t("ui.slurp.ties.suggested"));
        },
        onError,
      },
    );
  return (
    <div data-slurp-ties className="flex flex-col gap-5">
      <Intro>{t("ui.slurp.ties.business.intro")}</Intro>
      {empty && <p className={cn(SLP_TYPE.body, "text-[var(--slurp-muted)]")}>{t("ui.slurp.ties.empty")}</p>}

      {openCollabs.length > 0 && (
        <section className="space-y-2" aria-label={t("ui.slurp.ties.requests")}>
          <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.ties.requests")}</h4>
          <ul className={listClass}>
            {openCollabs.map((collab) => {
              const toMe = collab.status === "asked" && byId.get(collab.partnerId)?.own;
              return (
                <li key={collab.id} className={rowClass} data-slurp-tie-collab={collab.status}>
                  <Row
                    a={byId.get(collab.hostId)}
                    b={byId.get(collab.partnerId)}
                    title={collabTitle(collab)}
                    detail={collab.idea ? `“${collab.idea}”` : undefined}
                  />
                  <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
                    {/* Planned in their DMs as a spicy shoot together (U). */}
                    {collab.shoot && (
                      <span className={cn(slpTagClass(), "mr-1.5")}>{t("ui.slurp.ties.collab.shoot")}</span>
                    )}
                    {collabStatus(collab)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {collab.status === "asked" &&
                      (toMe ? (
                        <>
                          <SlpPrimaryButton
                            disabled={busy}
                            onClick={() => actions.push.mutate(collab.id, { onError })}
                            className="min-h-11 px-4 text-sm"
                          >
                            <Handshake size={16} aria-hidden="true" />
                            {t("ui.slurp.ties.accept")}
                          </SlpPrimaryButton>
                          <SlpButton
                            variant="quiet"
                            disabled={busy}
                            onClick={() => actions.decline.mutate(collab.id, { onError })}
                            className="min-h-11 px-4 text-sm"
                          >
                            {t("ui.slurp.ties.decline")}
                          </SlpButton>
                        </>
                      ) : (
                        <SlpButton
                          variant="secondary"
                          disabled={busy}
                          onClick={() => actions.push.mutate(collab.id, { onError })}
                          className="min-h-11 px-4 text-sm"
                        >
                          <Handshake size={16} aria-hidden="true" />
                          {t("ui.slurp.ties.push")}
                        </SlpButton>
                      ))}
                    {collab.status === "agreed" && (
                      <>
                        <SlpButton
                          variant="secondary"
                          disabled={busy}
                          onClick={() => actions.postNow.mutate(collab.id, { onError })}
                          className="min-h-11 px-4 text-sm"
                        >
                          {t("ui.slurp.stir.now.postCollab")}
                        </SlpButton>
                        <SlpButton
                          variant="quiet"
                          disabled={busy}
                          onClick={() => actions.drop.mutate(collab.id, { onError })}
                          className="min-h-11 px-4 text-sm"
                        >
                          {t("ui.slurp.stir.now.dropCollab")}
                        </SlpButton>
                      </>
                    )}
                    <SlpButton
                      variant="tertiary"
                      disabled={busy}
                      onClick={() => actions.block.mutate(collab.id, { onError })}
                      aria-label={t("ui.slurp.ties.blockLabel", { a: name(collab.hostId), b: name(collab.partnerId) })}
                      className="min-h-11 text-sm"
                    >
                      <Ban size={15} aria-hidden="true" />
                      {t("ui.slurp.ties.block")}
                    </SlpButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-2" aria-label={t("ui.slurp.ties.suggestTitle")}>
        <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.ties.suggestTitle")}</h4>
        <div className="space-y-3">
          <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.ties.suggestDetail")}</p>
          <SlpPairPicker
            creators={view.creators}
            picked={picked}
            onPick={setPicked}
            label={t("ui.slurp.ties.suggestTitle")}
          />
          <SlpPrimaryButton
            disabled={picked.length !== 2 || busy}
            onClick={suggest}
            className="min-h-11 w-full px-4 text-sm sm:w-auto"
          >
            <SlpSparkleGlyph size={16} aria-hidden="true" />
            {picked.length === 2 ? t("ui.slurp.ties.suggestPair") : t("ui.slurp.ties.suggestPick")}
          </SlpPrimaryButton>
        </div>
      </section>

      {view.rivalries.length > 0 && (
        <section className="space-y-2" aria-label={t("ui.slurp.ties.rivalries")}>
          <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.ties.rivalries")}</h4>
          <ul className={listClass}>
            {view.rivalries.map((rivalry) => (
              <li key={rivalry.id} className={rowClass} data-slurp-tie-rivalry={rivalry.stage}>
                <Row
                  a={byId.get(rivalry.fromId)}
                  b={byId.get(rivalry.toId)}
                  title={rivalryLine(rivalry)}
                  detail={
                    rivalry.stage === "over"
                      ? when(rivalry.stageAt)
                      : t("ui.slurp.ties.rivalry.cause", {
                          b: name(rivalry.toId),
                          // The cause is told to the one who started it ("…after you did").
                          cause: rivalry.cause
                            .replace(/\byours?\b/gu, `${name(rivalry.fromId)}'s`)
                            .replace(/\byou\b/gu, name(rivalry.fromId)),
                        })
                  }
                />
                {(rivalry.stage === "shade" || rivalry.stage === "feud") && (
                  <SlpButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() => actions.cool.mutate(rivalry.id, { onError })}
                    className="min-h-11 self-start px-4 text-sm"
                  >
                    <Zap size={15} aria-hidden="true" />
                    {t("ui.slurp.ties.cool")}
                  </SlpButton>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(pastCollabs.length > 0 || view.deals.length > 0) && (
        <section className="space-y-2" aria-label={t("ui.slurp.ties.lately")}>
          <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.ties.lately")}</h4>
          <ul className={listClass}>
            {view.deals.map((deal) => (
              <li key={deal.id} className={rowClass} data-slurp-tie-deal={deal.status}>
                <Row
                  a={byId.get(deal.creatorId)}
                  title={deal.brand}
                  detail={
                    <SlpCoinText>{`${dealLine(deal)}${deal.status === "done" || deal.status === "declined" ? ` · ${when(deal.answeredAt)}` : ""}`}</SlpCoinText>
                  }
                />
              </li>
            ))}
            {pastCollabs.map((collab) => (
              <li key={collab.id} className={rowClass} data-slurp-tie-collab={collab.status}>
                <Row
                  a={byId.get(collab.hostId)}
                  b={byId.get(collab.partnerId)}
                  title={t("ui.slurp.ties.collab.together", {
                    host: name(collab.hostId),
                    partner: name(collab.partnerId),
                  })}
                  detail={`${collabStatus(collab)} · ${when(collab.answeredAt ?? collab.askedAt)}`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.blocked.length > 0 && (
        <section className="space-y-2" aria-label={t("ui.slurp.ties.blockedTitle")}>
          <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.ties.blockedTitle")}</h4>
          <ul className={listClass}>
            {view.blocked.map((pair) => {
              const [a, b] = pair.split("|");
              return (
                <li key={pair} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <Row
                      a={byId.get(a ?? "")}
                      b={byId.get(b ?? "")}
                      title={t("ui.slurp.ties.blockedPair", { a: name(a ?? ""), b: name(b ?? "") })}
                    />
                  </span>
                  <SlpButton
                    variant="tertiary"
                    disabled={busy}
                    onClick={() => actions.unblock.mutate(pair, { onError })}
                    className="min-h-11 shrink-0 text-sm"
                  >
                    {t("ui.slurp.ties.unblock")}
                  </SlpButton>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Relationships (U: couple = life): set two Creators up, then their crushes, couples and exes with the
 * player's steering (dates, drama, a shared page, getting back together) and a way for a couple to
 * make a real collab too. Studio, right after Business.
 */
export function SlpRelationshipsPanel({ personaId }: { personaId: string }) {
  const { t } = useTranslation();
  const query = useSlurpTies(personaId);
  const actions = useSlurpTiesMutations(personaId);
  const [picked, setPicked] = useState<string[]>([]);
  const view = query.data;
  if (query.isError)
    return <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.ties.loadFailed")}</p>;
  if (!view) return <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.settings.loading")}</p>;
  const byId = new Map(view.creators.map((creator) => [creator.id, creator]));
  // A crush that went nowhere stays a crush; exes are the ones who broke up.
  const crushes = view.couples.filter(
    (couple) => couple.stage === "sparks" || (couple.stage === "split" && couple.ending === "fizzled"),
  );
  const couples = view.couples.filter((couple) => ["dating", "together", "rocky"].includes(couple.stage));
  const exes = view.couples.filter((couple) => couple.stage === "split" && couple.ending !== "fizzled");
  const setUp = () =>
    picked.length === 2 &&
    actions.setUp.mutate(
      { aId: picked[0]!, bId: picked[1]! },
      {
        onSuccess: () => {
          setPicked([]);
          toast.success(t("ui.slurp.ties.setUpDone"));
        },
        onError: (error: unknown) => toast.error(errorMessage(error)),
      },
    );
  const lists = { personaId, byId, Row };
  return (
    <div data-slurp-relationships className="flex flex-col gap-5">
      <Intro>{t("ui.slurp.ties.life.intro")}</Intro>
      {!view.couples.length && (
        <p className={cn(SLP_TYPE.body, "text-[var(--slurp-muted)]")}>{t("ui.slurp.ties.life.empty")}</p>
      )}
      <SlpCouplesSection {...lists} title={t("ui.slurp.ties.couples")} couples={couples} />
      <SlpCouplesSection {...lists} title={t("ui.slurp.ties.crushes")} couples={crushes} />
      <SlpCouplesSection {...lists} title={t("ui.slurp.ties.exes")} couples={exes} />
      <section className="space-y-2" aria-label={t("ui.slurp.ties.setUpTitle")}>
        <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.ties.setUpTitle")}</h4>
        <div className="space-y-3">
          <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.ties.setUpDetail")}</p>
          <SlpPairPicker
            creators={view.creators}
            picked={picked}
            onPick={setPicked}
            label={t("ui.slurp.ties.setUpTitle")}
          />
          <SlpPrimaryButton
            disabled={picked.length !== 2 || actions.setUp.isPending}
            onClick={setUp}
            className="min-h-11 w-full px-4 text-sm sm:w-auto"
          >
            <HeartHandshake size={16} aria-hidden="true" />
            {picked.length === 2 ? t("ui.slurp.ties.setUp") : t("ui.slurp.ties.suggestPick")}
          </SlpPrimaryButton>
        </div>
      </section>
    </div>
  );
}

/**
 * Brand offers to a page the player runs, in that Creator's Studio right after the money: yes pays
 * the fee into their earnings now, no ends it.
 */
export function SlpBrandOffers({ personaId, creatorId }: { personaId: string; creatorId: string }) {
  const { t, i18n } = useTranslation();
  const { data } = useSlurpTies(personaId);
  const { answerDeal, markPosted } = useSlurpTiesMutations(personaId);
  const offers = (data?.deals ?? []).filter((deal) => deal.creatorId === creatorId && deal.status === "offered");
  const owed = (data?.deals ?? []).filter((deal) => deal.creatorId === creatorId && deal.owesPost);
  if (!offers.length && !owed.length) return null;
  const heading = offers.length ? "ui.slurp.ties.offers" : "ui.slurp.ties.owed.heading";
  const answer = (deal: SlurpTiesDeal, accept: boolean) =>
    answerDeal.mutate(
      { id: deal.id, accept },
      {
        onSuccess: () =>
          accept &&
          toast.success(
            t("ui.slurp.ties.deal.paid", { brand: deal.brand, amount: formatSlpDollars(deal.fee, i18n.language) }),
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  return (
    <section className="space-y-2" aria-label={t(heading)} data-slurp-brand-offers>
      <h3 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t(heading)}</h3>
      {/* The owed note and the offers are two cards: the shared card gap between them (T). */}
      <div className={SLP_CARD_STACK_CLASS}>
        {owed.length > 0 && (
          <ul className={SLP_GROUP_CLASS} data-slurp-owed-posts>
            {owed.map((deal) => (
              <li key={deal.id} className="flex items-start gap-3 px-4 py-3" data-slurp-owed-post>
                <span className="mt-0.5 shrink-0 text-[var(--slurp-accent)]">
                  <SlpSparkleGlyph size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className={cn(SLP_TYPE.body, "font-semibold [overflow-wrap:anywhere]")}>
                    {t("ui.slurp.ties.owed.title", { brand: deal.brand })}
                  </p>
                  <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)] [overflow-wrap:anywhere]")}>
                    {t("ui.slurp.ties.owed.detail", { product: deal.product })}
                  </p>
                  {/* U: no dead end when the post went up without #ad or the brand's name. */}
                  <SlpButton
                    variant="secondary"
                    disabled={markPosted.isPending}
                    onClick={() =>
                      markPosted.mutate(deal.id, {
                        onSuccess: () => toast.success(t("ui.slurp.ties.owed.marked", { brand: deal.brand })),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                    className="mt-2 min-h-11 px-4 text-sm"
                    data-slurp-owed-mark
                  >
                    <Check size={15} aria-hidden="true" />
                    {t("ui.slurp.ties.owed.mark")}
                  </SlpButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        {offers.length > 0 && (
          <ul className={SLP_GROUP_CLASS}>
            {offers.map((deal) => (
              <li key={deal.id} className="flex flex-col gap-2 px-4 py-3" data-slurp-brand-offer>
                {deal.bannerUrl && (
                  <div
                    className={cn(
                      "overflow-hidden rounded-xl bg-[var(--slurp-media-stage,#17131a)]",
                      SLP_IMG_FRAME_CLASS,
                    )}
                    style={{ aspectRatio: "1.91 / 1" }}
                  >
                    <SlurpMediaImg
                      src={deal.bannerUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="slp-crop-top h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {/* R: the brand's logo, or its initials (the feed ad's avatar). */}
                    <Avatar
                      account={{
                        displayName: deal.brand.split(/\s+/u).slice(0, 2).join(" "),
                        avatarUrl: deal.logoUrl ?? null,
                      }}
                      size="sm"
                    />
                    <span className={cn(SLP_TYPE.body, "min-w-0 font-semibold [overflow-wrap:anywhere]")}>
                      {t("ui.slurp.ties.offerTitle", { brand: deal.brand, product: deal.product })}
                    </span>
                  </span>
                  <span className={cn(SLP_TYPE.body, "shrink-0 font-bold tabular-nums")}>
                    {t("ui.slurp.ties.fee", { amount: formatSlpDollars(deal.fee, i18n.language) })}
                  </span>
                </div>
                {deal.copy && <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>“{deal.copy}”</p>}
                <div className="flex gap-2">
                  <SlpPrimaryButton
                    disabled={answerDeal.isPending}
                    onClick={() => answer(deal, true)}
                    className="min-h-11 flex-1 px-4 text-sm"
                  >
                    {t("ui.slurp.ties.offerYes")}
                  </SlpPrimaryButton>
                  <SlpButton
                    variant="quiet"
                    disabled={answerDeal.isPending}
                    onClick={() => answer(deal, false)}
                    className="min-h-11 flex-1 px-4 text-sm"
                  >
                    {t("ui.slurp.ties.offerNo")}
                  </SlpButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
