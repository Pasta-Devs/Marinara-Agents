// ──────────────────────────────────────────────
// Otome Hearth: the Album's Dates (#2303). The dates won on Wish's Dates banner, newest first: each with its stars, its
// place and scenes, its premise, and who has been on it; Plan a date opens it in the date screen to choose who's
// coming (C/screens/dates/DateNight.tsx, `{item}`). A date won and not looked at yet has a dot, and opening it lets it
// go (useMarkSeen). Then the earlier evenings, Date Night's from before #2303: one not counted yet goes on (`{key}`),
// a counted one reads again, each with its keepsake when one was painted. A won date shows its place (a 5★'s is its
// banner's art; a 4★'s is painted on its first open), and one with no picture yet offers Paint it, as Wish does.
// ──────────────────────────────────────────────
// Route: GET /runs/:run/dates (S/routes/dates.ts), the same view the date screen reads.
import { useTranslation } from "react-i18next";
import { BookOpen, Heart, MapPin, Paintbrush, RotateCcw, Wine } from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { CostHint, usePaintsByItself } from "../../components/CostHint";
import { imagesOn, needsOpen, paintWaits, useMarkSeen, type ItemActions } from "../../hooks/use-items";
import { accentOf } from "../../lib/accent";
import type { RunView } from "../../shared/api-types";
import { datePlacePaintable, type ItemView } from "../../shared/wish";
import { dateCast, type DateEntry } from "../../shared/dates";
import { OUTCOME_SHORT_KEYS, useDates, useNames, type DateOpen } from "../dates/DateNight";
import { RarityStars } from "../wish/TenPullGrid";

interface DatesProps {
  runKey: string;
  view: RunView;
  /** The Album's item actions: a date's first open (which paints its place) and a tap that paints it again. */
  actions: ItemActions;
  onOpenDate: (open: DateOpen) => void;
}

export function Dates({ runKey, view, actions, onOpenDate }: DatesProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const names = useNames();
  const dates = useDates(runKey);
  const markSeen = useMarkSeen(runKey);
  const namesOf = (entry: Pick<DateEntry, "li" | "second" | "cast">) =>
    names(dateCast(entry).flatMap((li) => view.lis.filter((item) => item.id === li).map((item) => item.name)));

  if (!dates.data) {
    return dates.isError ? (
      <div className="of-panel of-panel--center of-card of-glass" role="alert">
        <p className="of-error">{otome.errorMessage(dates.error)}</p>
        <button type="button" className="of-button of-button--quiet of-glass" onClick={() => void dates.refetch()}>
          <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.common.retry")}
        </button>
      </div>
    ) : (
      <p className="of-hint" role="status">
        {t("ui.otomeForge.common.loading")}
      </p>
    );
  }

  const { pulled } = dates.data;
  // Date Night's evenings (no item behind them): those not counted yet, then the counted ones, newest first.
  const earlier = [...dates.data.open, ...dates.data.dates].filter((entry) => !entry.item);
  if (!pulled.length && !earlier.length) {
    return (
      <p className="of-empty of-glass">
        <Wine size={20} strokeWidth={1.8} aria-hidden="true" />
        {t("ui.otomeForge.album.datesEmpty")}
      </p>
    );
  }
  return (
    <div className="of-album-dates">
      {pulled.length ? (
        <section aria-labelledby="of-album-dates-won">
          <h2 id="of-album-dates-won" className="of-album-stickers-title">
            {t("ui.otomeForge.album.datesWon")}
          </h2>
          <ul className="of-date-history">
            {pulled.map(({ item, playedBy, new: fresh }) => (
              <li key={item.id} className="of-album-date">
                {/* #2303: its place, painted when the date is first opened (a 5★'s is its banner's art). */}
                {item.art?.state === "ready" && item.art.url ? (
                  <img className="of-album-date-art" src={item.art.url} alt="" loading="lazy" />
                ) : null}
                <span className="of-date-memory-text">
                  <span className="of-date-memory-title">
                    <RarityStars rarity={item.rarity} /> {item.title}
                    {fresh ? (
                      <span className="of-tab-dot of-new-dot">
                        <span className="of-visually-hidden">{t("ui.otomeForge.common.hasNew")}</span>
                      </span>
                    ) : null}
                  </span>
                  <span className="of-hint of-album-date-place">
                    <MapPin size={12} strokeWidth={2} aria-hidden="true" />
                    <span>
                      {t("ui.otomeForge.wish.datePlace", { place: item.place?.name ?? "", count: item.scenes ?? 1 })}
                    </span>
                  </span>
                  {item.premise ? <span className="of-body">{item.premise}</span> : null}
                  <span className="of-album-date-who">
                    {playedBy.length ? (
                      <>
                        {playedBy.flatMap((li) =>
                          view.lis
                            .filter((entry) => entry.id === li)
                            .map((entry) => (
                              <Avatar
                                key={li}
                                name={entry.name}
                                url={entry.portrait}
                                accent={accentOf(entry)}
                                size={22}
                              />
                            )),
                        )}
                        <span className="of-hint">
                          {t("ui.otomeForge.album.datesBeen", { names: namesOf({ li: "", cast: playedBy }) })}
                        </span>
                      </>
                    ) : (
                      <span className="of-hint">{t("ui.otomeForge.album.datesNotYet")}</span>
                    )}
                  </span>
                </span>
                <span className="of-album-date-actions">
                  <DatePlacePaint item={item} view={view} actions={actions} />
                  <button
                    type="button"
                    className="of-button of-button--primary of-button--small"
                    aria-label={t("ui.otomeForge.album.datesPlanLabel", { title: item.title })}
                    onClick={() => {
                      if (fresh) markSeen(item.id);
                      onOpenDate({ item: item.id });
                    }}
                  >
                    <Heart size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                    {t("ui.otomeForge.album.datesPlan")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="of-hint">{t("ui.otomeForge.album.datesEmpty")}</p>
      )}
      {earlier.length ? (
        <section aria-labelledby="of-album-dates-earlier">
          <h2 id="of-album-dates-earlier" className="of-album-stickers-title">
            {t("ui.otomeForge.album.datesEarlier")}
          </h2>
          <p className="of-hint">{t("ui.otomeForge.album.datesEarlierHint")}</p>
          <ul className="of-date-history">
            {earlier.map((entry) => {
              const keepsake = entry.keepsake?.state === "ready" ? entry.keepsake.url : undefined;
              const first = view.lis.find((li) => li.id === entry.li);
              const counted = entry.state === "finished";
              return (
                <li key={entry.key} className="of-album-date">
                  {keepsake ? (
                    <img className="of-album-date-art" src={keepsake} alt="" loading="lazy" />
                  ) : first ? (
                    <Avatar name={first.name} url={first.portrait} accent={accentOf(first)} size={48} />
                  ) : null}
                  <span className="of-date-memory-text">
                    <span className="of-date-memory-title">{entry.title}</span>
                    <span className="of-hint">
                      {[t("ui.otomeForge.dateNight.playWith", { names: namesOf(entry) }), entry.placeName]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="of-album-date-actions">
                    {entry.outcome ? (
                      <span className="of-badge of-badge--soft">{t(OUTCOME_SHORT_KEYS[entry.outcome])}</span>
                    ) : null}
                    <button
                      type="button"
                      className="of-button of-button--quiet of-glass of-button--small"
                      aria-label={t("ui.otomeForge.dateNight.playOpenLabel", {
                        action: counted
                          ? t("ui.otomeForge.dateNight.playReadAgain")
                          : t("ui.otomeForge.dateNight.playContinue"),
                        names: entry.title,
                      })}
                      onClick={() => onOpenDate({ key: entry.key })}
                    >
                      <BookOpen size={14} strokeWidth={2} aria-hidden="true" />
                      {counted ? t("ui.otomeForge.dateNight.playReadAgain") : t("ui.otomeForge.dateNight.playContinue")}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * A won date's place picture, while it has none: Paint it (its first open, which paints it, or a tap that paints a
 * failed or held one again), with its cost and why it failed, or that it is painting. Only a 4★'s: a 5★'s picture is
 * its banner's art, painted on Wish. Nothing without an image connection.
 */
function DatePlacePaint({ item, view, actions }: { item: ItemView; view: RunView; actions: ItemActions }) {
  const { t } = useTranslation();
  const images = imagesOn(view);
  const first = needsOpen(item, images);
  const again = images && datePlacePaintable(item) && paintWaits(item.art);
  const error = actions.errors[item.id];
  // A first open paints at once only without Ask before painting or prompt review; with either it only holds the
  // paint for the next tap, so nothing is painting yet (Dottore, #2349). A tap on a held or failed one always paints.
  const paintsByItself = usePaintsByItself(view.world.images);
  if (item.art?.state === "pending")
    return (
      <span className="of-hint" role="status">
        {t("ui.otomeForge.wish.painting")}
      </span>
    );
  if (!first && !again) return null;
  const busy = actions.busy.has(item.id);
  return (
    <>
      <CostHint images={1} />
      <button
        type="button"
        className="of-button of-button--quiet of-glass of-button--small"
        aria-label={t("ui.otomeForge.album.datesPaintLabel", { title: item.title })}
        aria-disabled={busy}
        onClick={() => {
          if (!busy) void (first ? actions.open(item) : actions.paintItem(item));
        }}
      >
        <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
        {t("ui.otomeForge.wish.paint")}
      </button>
      {/* 0.34.8: painting from the tap on, not only once the dates are read again. */}
      {busy && (!first || paintsByItself) ? (
        <span className="of-hint" role="status">
          {t("ui.otomeForge.wish.painting")}
        </span>
      ) : null}
      {error ? (
        <span className="of-notice of-notice--error of-album-date-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
