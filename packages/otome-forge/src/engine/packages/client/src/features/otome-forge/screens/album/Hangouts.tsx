// ──────────────────────────────────────────────
// Otome Hearth: Album → Hangouts (#2458), the hangouts with her friends, and a new one
// ──────────────────────────────────────────────
// GET /runs/:run/hangouts lists them, newest first: each opens in the reader (to finish or read again), and a finished
// one offers its memento (POST .../memento, one image, on the tap; the prompt review first when the Engine reviews
// prompts). Plan a hangout asks, as Date Night did, where (one of Date Night's places, a place the story has painted,
// or "they choose"), who comes (any of her friends whose grievance does not stand) and what she wears, then plans it
// (POST /runs/:run/hangouts: one text call) and opens it. A friend's invitation in Messages opens the same dialog with
// them chosen and "they choose" picked; accepting it there is the plan (`invite`).
import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Image as ImageIcon, PartyPopper } from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { CostHint } from "../../components/CostHint";
import { Dialog } from "../../components/Dialog";
import { PaintButton, usePaintOnTap } from "../../components/PaintOnTap";
import { runPath, storyQueryKey } from "../../hooks/use-reader";
import { runQueryKey } from "../../hooks/use-run";
import { accentOf } from "../../lib/accent";
import type { ChapterView, LiId, Paint, RunView } from "../../shared/api-types";
import { BASE_LOOK, PARTNER_CHOICE } from "../../shared/dates";
import { LookPicker, wornDateLook } from "../dates/LookPicker";
import { PlacePicker, paintedPlaces, type PlacePick } from "../dates/PlacePicker";
import { useWardrobe } from "../wardrobe/Wardrobe";

/** A hangout as the tab lists it (GET /runs/:run/hangouts). */
type HangoutEntry = ChapterView & { state: "done" | "in-progress"; memento: boolean };

/** A friend's invitation to hang out, accepted from Messages: who asked, and their message. */
export interface HangoutInvite {
  friend: LiId;
  message: string;
}

const hangoutsKey = (runKey: string) => [...runQueryKey(runKey), "hangouts"] as const;

function useHangouts(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: hangoutsKey(runKey),
    queryFn: () => otome.get<{ hangouts: HangoutEntry[]; free: LiId[] }>(`${runPath(runKey)}/hangouts`),
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.hangouts.some((entry) => entry.friendStory?.memento?.art.state === "pending") ? 4000 : false,
  });
}

export function Hangouts({
  runKey,
  view,
  onOpenStory,
  invite,
  onInviteDone,
}: {
  runKey: string;
  view: RunView;
  onOpenStory: (key: string) => void;
  invite?: HangoutInvite | null;
  onInviteDone?: () => void;
}) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const hangouts = useHangouts(runKey);
  // #2459: an ended story plans nothing, so an invitation is not opened.
  const [planning, setPlanning] = useState<HangoutInvite | "new" | null>(view.ended ? null : (invite ?? null));
  useEffect(() => {
    if (invite && !view.ended) setPlanning(invite);
  }, [invite, view.ended]);
  const friends = view.friends ?? [];
  const nameOf = (id: LiId) => friends.find((friend) => friend.id === id)?.name ?? "";

  if (!friends.length) {
    return (
      <p className="of-empty of-glass">
        <PartyPopper size={20} strokeWidth={1.8} aria-hidden="true" />
        {t("ui.otomeForge.hangouts.noFriends")}
      </p>
    );
  }
  return (
    <div className="of-hangouts">
      {view.ended ? null : (
        <button type="button" className="of-button of-button--primary" onClick={() => setPlanning("new")}>
          <PartyPopper size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.hangouts.plan")}
        </button>
      )}
      {hangouts.isError ? (
        <p className="of-error" role="alert">
          {otome.errorMessage(hangouts.error)}
        </p>
      ) : !hangouts.data ? (
        <p className="of-hint" role="status">
          {t("ui.otomeForge.hangouts.loading")}
        </p>
      ) : hangouts.data.hangouts.length ? (
        <ul className="of-hangout-list">
          {hangouts.data.hangouts.map((entry) => (
            <HangoutRow
              key={entry.key}
              runKey={runKey}
              view={view}
              entry={entry}
              names={(entry.friendStory?.friends ?? []).map(nameOf).filter(Boolean)}
              onOpen={() => onOpenStory(entry.key)}
            />
          ))}
        </ul>
      ) : (
        <p className="of-empty of-glass">{t("ui.otomeForge.hangouts.none")}</p>
      )}
      {planning ? (
        <PlanHangout
          runKey={runKey}
          view={view}
          free={hangouts.data?.free ?? friends.map((friend) => friend.id)}
          invite={planning === "new" ? null : planning}
          onClose={() => {
            setPlanning(null);
            onInviteDone?.();
          }}
          onPlanned={(key) => {
            setPlanning(null);
            onInviteDone?.();
            onOpenStory(key);
          }}
        />
      ) : null}
    </div>
  );
}

function HangoutRow({
  runKey,
  view,
  entry,
  names,
  onOpen,
}: {
  runKey: string;
  view: RunView;
  entry: HangoutEntry;
  names: string[];
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const first = (view.friends ?? []).find((friend) => friend.id === entry.friendStory?.friends[0]);
  const art: Paint | undefined = entry.friendStory?.memento?.art;
  // As a date's keepsake: Ask before painting confirms first, and the Engine's prompt review shows the prompt.
  const { painting, error, tap, dialogs } = usePaintOnTap({
    path: `${runPath(runKey)}/hangouts/${encodeURIComponent(entry.key)}/memento`,
    art,
    ask: view.world.images.ask,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: hangoutsKey(runKey) }),
    askTitle: t("ui.otomeForge.hangouts.mementoAskTitle"),
    askText: t("ui.otomeForge.hangouts.mementoAskText", { names: names.join(", ") }),
    subject: t("ui.otomeForge.hangouts.mementoSubject", { names: names.join(", ") }),
  });
  return (
    <li
      className="of-hangout of-glass"
      style={first ? ({ "--of-li-accent": accentOf(first) } as CSSProperties) : undefined}
    >
      <div className="of-chapter-head">
        {first ? <Avatar name={first.name} url={first.portrait} accent={accentOf(first)} size={34} /> : null}
        <div className="of-chapter-heading">
          <p className="of-chapter-eyebrow">{t("ui.otomeForge.hangouts.with", { names: names.join(", ") })}</p>
          <h3 className="of-chapter-title">{entry.title || t("ui.otomeForge.story.untitled")}</h3>
        </div>
        <span className="of-badge of-badge--soft">
          {t(entry.state === "done" ? "ui.otomeForge.story.stateDone" : "ui.otomeForge.story.stateInProgress")}
        </span>
      </div>
      {art?.state === "ready" && art.url ? (
        <img
          className="of-hangout-memento"
          src={art.url}
          alt={t("ui.otomeForge.hangouts.mementoAlt", { title: entry.title })}
        />
      ) : null}
      <div className="of-inline-actions">
        <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={onOpen}>
          <BookOpen size={14} strokeWidth={2} aria-hidden="true" />
          {t(entry.state === "done" ? "ui.otomeForge.hangouts.readAgain" : "ui.otomeForge.hangouts.continue")}
        </button>
        {entry.state === "done" &&
        entry.memento &&
        view.world.images.connectionId &&
        art?.state !== "ready" &&
        !view.ended ? (
          <PaintButton
            art={art}
            painting={painting}
            onTap={tap}
            labels={{
              paint: t("ui.otomeForge.hangouts.mementoPaint"),
              retry: t("ui.otomeForge.hangouts.mementoRetry"),
              painting: t("ui.otomeForge.hangouts.mementoPainting"),
            }}
          />
        ) : null}
        {entry.state === "done" && entry.memento && !art && view.world.images.connectionId ? (
          <CostHint images={1} />
        ) : null}
      </div>
      {error ? (
        <p className="of-error" role="alert">
          {otome.errorMessage(error)}
        </p>
      ) : null}
      {art?.state === "failed" && art.error ? <p className="of-hint">{art.error}</p> : null}
      {dialogs}
    </li>
  );
}

function PlanHangout({
  runKey,
  view,
  free,
  invite,
  onClose,
  onPlanned,
}: {
  runKey: string;
  view: RunView;
  free: readonly LiId[];
  invite: HangoutInvite | null;
  onClose: () => void;
  onPlanned: (key: string) => void;
}) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const wardrobe = useWardrobe(runKey);
  const friends = (view.friends ?? []).filter((friend) => free.includes(friend.id));
  const [chosen, setChosen] = useState<LiId[]>(invite ? [invite.friend] : []);
  const [place, setPlace] = useState<PlacePick | null>(invite ? { place: PARTNER_CHOICE } : null);
  const [herLook, setHerLook] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const look = herLook ?? wornDateLook(wardrobe.data?.me);
  const firstName = (view.friends ?? []).find((friend) => friend.id === chosen[0])?.name ?? "";
  const ready = chosen.length > 0 && !!place;
  const toggle = (id: LiId) => {
    if (invite && id === invite.friend) return;
    setChosen((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  };
  const plan = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const where =
      place!.place === "story" && place!.storyPlace ? `story:${place!.storyPlace.name}` : String(place!.place);
    try {
      const { chapter } = await otome.post<{ chapter: ChapterView }>(`${runPath(runKey)}/hangouts`, {
        friends: chosen,
        place: where,
        herLook: look || BASE_LOOK,
        ...(invite ? { invite: { message: invite.message } } : {}),
      });
      void queryClient.invalidateQueries({ queryKey: hangoutsKey(runKey) });
      void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
      void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      onPlanned(chapter.key);
    } catch (failure) {
      setError(failure);
      setBusy(false);
    }
  };
  return (
    <Dialog
      wide
      title={t("ui.otomeForge.hangouts.planTitle")}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          <button type="button" className="of-button of-button--quiet of-glass" onClick={onClose} disabled={busy}>
            {t("ui.otomeForge.home.close")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary"
            disabled={!ready || busy}
            onClick={() => void plan()}
          >
            {t("ui.otomeForge.hangouts.go")}
          </button>
        </>
      }
    >
      {busy ? (
        <p className="of-hint of-planning" role="status">
          {t("ui.otomeForge.hangouts.planning")}
        </p>
      ) : (
        <>
          <p className="of-hint">{t("ui.otomeForge.hangouts.planCost")}</p>
          {error ? (
            <p className="of-error" role="alert">
              {otome.errorMessage(error)}
            </p>
          ) : null}
          <fieldset className="of-field">
            <legend>{t("ui.otomeForge.hangouts.who")}</legend>
            <ul className="of-tiles" aria-label={t("ui.otomeForge.hangouts.who")}>
              {friends.map((friend) => {
                const picked = chosen.includes(friend.id);
                return (
                  <li key={friend.id}>
                    <button
                      type="button"
                      className="of-tile of-glass"
                      data-checked={picked}
                      aria-pressed={picked}
                      title={friend.name}
                      onClick={() => toggle(friend.id)}
                    >
                      <Avatar name={friend.name} url={friend.portrait} accent={accentOf(friend)} />
                      <span className="of-tile-name">{friend.name}</span>
                      {picked ? (
                        <span className="of-tile-check" aria-hidden="true">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <PlacePicker
            partnerName={firstName || t("ui.otomeForge.hangouts.them")}
            storyPlaces={paintedPlaces(view.world)}
            value={place}
            onChange={setPlace}
            legend={t("ui.otomeForge.hangouts.where")}
          />
          <LookPicker
            partner={null}
            player={view.player}
            herLooks={wardrobe.data?.me}
            hisLook={BASE_LOOK}
            herLook={look}
            onChange={(next) => setHerLook(next.herLook)}
          />
          <p className="of-hint">
            <ImageIcon size={14} strokeWidth={2} aria-hidden="true" /> {t("ui.otomeForge.hangouts.mementoNote")}
          </p>
        </>
      )}
    </Dialog>
  );
}
