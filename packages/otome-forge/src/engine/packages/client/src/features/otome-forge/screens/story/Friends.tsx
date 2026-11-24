// ──────────────────────────────────────────────
// Otome Hearth: her friends on the Story screen (#2458), under the love interests' affection
// ──────────────────────────────────────────────
// Each friend shows their portrait, name, five stars (their level) and progress to the next. Add a friend opens a
// dialog: someone she has met (GET /runs/:run/friends/met, the side characters who have spoken), one of the player's
// cards, or someone new from a name and notes, each with the pronouns the player picks. Adding writes their bible (one
// text call) and, with an image connection, paints their portrait (Your cast), so the dialog says what it costs. The
// server refuses a friend when the story has as many friends as love interests, or one joined in this arc already
// (StoryView.friendBlock); the button then explains why it waits.
import { useId, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookHeart, Check, Handshake, HeartHandshake, Star, UserPlus } from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { CostHint, usePaintsByItself } from "../../components/CostHint";
import { Dialog } from "../../components/Dialog";
import { RetryNotice } from "../../components/RetryNotice";
import { useCharacterOptions } from "../../hooks/use-engine-resources";
import { runPath, storyQueryKey } from "../../hooks/use-reader";
import { runQueryKey } from "../../hooks/use-run";
import { accentOf, nameAccent } from "../../lib/accent";
import type { FriendStoryEntry, RunFriendView, RunLiView, RunView, StoryView } from "../../shared/api-types";
import { FRIEND_MAX_LEVEL } from "../../shared/friends";
import { emptyPronouns, resolvePronouns, type PronounChoice } from "../setup/draft";
import { PronounPicker } from "../setup/parts";
import { UpsetToggle } from "./StoryHome";

type Block = NonNullable<StoryView["friendBlock"]>;
interface Met {
  key: string;
  name: string;
  cardId?: string;
}

const BLOCK_KEYS: Record<Block, string> = {
  full: "ui.otomeForge.friends.blockFull",
  arc: "ui.otomeForge.friends.blockArc",
  ending: "ui.otomeForge.friends.blockEnding",
};

export function Friends({
  runKey,
  view,
  block,
  entries,
  ended,
  onOpenArc,
  onOpenChapter,
}: {
  runKey: string;
  view: RunView;
  /** Why no friend may join now; null when one may, undefined from an older server (no friends there). */
  block: StoryView["friendBlock"];
  /** What Story offers with each friend (rank and make-up stories, a scene to clear the air, the Wingman). */
  entries: FriendStoryEntry[];
  /** #2459: the story has ended: the list stays, its actions go. */
  ended: boolean;
  onOpenArc: (target: { kind: "rank" | "mend"; li: string; key: string }) => void;
  onOpenChapter: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const friends = view.friends ?? [];
  if (block === undefined) return null;
  return (
    <section className="of-section of-glass" aria-labelledby="of-story-friends">
      <h2 id="of-story-friends" className="of-section-title">
        {t("ui.otomeForge.friends.title")}
      </h2>
      {friends.length ? (
        <ul className="of-affection-list">
          {friends.map((friend) => (
            <FriendRow
              key={friend.id}
              runKey={runKey}
              friend={friend}
              entry={ended ? undefined : entries.find((entry) => entry.id === friend.id)}
              lis={view.lis}
              onOpenArc={onOpenArc}
              onOpenChapter={onOpenChapter}
            />
          ))}
        </ul>
      ) : (
        <p className="of-hint">{t("ui.otomeForge.friends.none")}</p>
      )}
      {ended ? null : (
        <>
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            disabled={!!block}
            onClick={() => setAdding(true)}
          >
            <UserPlus size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.friends.add")}
          </button>
          <p className="of-hint">{t(block ? BLOCK_KEYS[block] : "ui.otomeForge.friends.hint")}</p>
        </>
      )}
      {adding ? <AddFriendDialog runKey={runKey} view={view} onClose={() => setAdding(false)} /> : null}
    </section>
  );
}

function FriendRow({
  runKey,
  friend,
  entry,
  lis,
  onOpenArc,
  onOpenChapter,
}: {
  runKey: string;
  friend: RunFriendView;
  entry: FriendStoryEntry | undefined;
  lis: readonly RunLiView[];
  onOpenArc: (target: { kind: "rank" | "mend"; li: string; key: string }) => void;
  onOpenChapter: (key: string) => void;
}) {
  const { t } = useTranslation();
  const accent = accentOf(friend);
  const level = Math.max(1, Math.min(FRIEND_MAX_LEVEL, friend.level));
  const { current, required } = friend.affectionProgress;
  return (
    <li className="of-affection" style={{ "--of-li-accent": accent } as CSSProperties}>
      <Avatar name={friend.name} url={friend.portrait} accent={accent} size={38} />
      <span className="of-affection-head">
        <span className="of-affection-name">{friend.name}</span>
        <span className="of-affection-level" aria-hidden="true">
          {t("ui.otomeForge.friends.rank", { level, max: FRIEND_MAX_LEVEL })}
        </span>
      </span>
      <span
        className="of-hearts"
        role="img"
        aria-label={t("ui.otomeForge.friends.rankOf", { name: friend.name, level, max: FRIEND_MAX_LEVEL })}
      >
        {Array.from({ length: FRIEND_MAX_LEVEL }, (_, index) => (
          <span key={index} className="of-heart" data-on={index < level} aria-hidden="true">
            <Star size={16} strokeWidth={1.8} fill={index < level ? "currentColor" : "none"} />
          </span>
        ))}
      </span>
      <span
        className="of-affection-progress"
        role="meter"
        aria-label={t("ui.otomeForge.friends.progress", { name: friend.name })}
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={current}
        aria-valuetext={
          level === FRIEND_MAX_LEVEL
            ? t("ui.otomeForge.story.affectionProgressMax")
            : t("ui.otomeForge.story.affectionProgressValue", { current, required })
        }
      >
        {t("ui.otomeForge.story.affectionProgressCount", { current, required })}
      </span>
      {friend.about ? <p className="of-hint of-friend-about">{friend.about}</p> : null}
      {entry ? (
        <FriendActions
          runKey={runKey}
          friend={friend}
          entry={entry}
          lis={lis}
          onOpenArc={onOpenArc}
          onOpenChapter={onOpenChapter}
        />
      ) : null}
    </li>
  );
}

/** What Story offers with one friend now: their story, making it right, clearing the air, the Wingman, telling them. */
function FriendActions({
  runKey,
  friend,
  entry,
  lis,
  onOpenArc,
  onOpenChapter,
}: {
  runKey: string;
  friend: RunFriendView;
  entry: FriendStoryEntry;
  lis: readonly RunLiView[];
  onOpenArc: (target: { kind: "rank" | "mend"; li: string; key: string }) => void;
  onOpenChapter: (key: string) => void;
}) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [helped, setHelped] = useState("");
  const name = friend.name;
  const wingman = async (li: RunLiView) => {
    setError(null);
    try {
      await otome.post(`${runPath(runKey)}/friends/${encodeURIComponent(friend.id)}/wingman`, { li: li.id });
      setHelped(t("ui.otomeForge.friends.wingmanDone", { name, li: li.name }));
      void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
    } catch (failure) {
      setError(failure);
    }
  };
  return (
    <div className="of-friend-actions">
      {entry.rank ? (
        <button
          type="button"
          className="of-button of-button--primary of-button--small"
          onClick={() => onOpenArc({ kind: "rank", li: friend.id, key: entry.rank!.key })}
        >
          <BookHeart size={14} strokeWidth={2} aria-hidden="true" />
          {t(
            entry.rank.level === FRIEND_MAX_LEVEL
              ? "ui.otomeForge.friends.finaleOpen"
              : "ui.otomeForge.friends.rankOpen",
            {
              name,
              level: entry.rank.level,
            },
          )}
        </button>
      ) : null}
      {entry.held ? (
        entry.held.space >= entry.held.need ? (
          <button
            type="button"
            className="of-button of-button--primary of-button--small"
            onClick={() => onOpenArc({ kind: "mend", li: friend.id, key: entry.held!.key ?? "" })}
          >
            <HeartHandshake size={14} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.friends.mendOpen", { name })}
          </button>
        ) : (
          <p className="of-hint">{t("ui.otomeForge.friends.needsSpace", { name, text: entry.held.text })}</p>
        )
      ) : null}
      {entry.air ? (
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-button--small"
          onClick={() => onOpenChapter(entry.air!)}
        >
          {t("ui.otomeForge.friends.airOpen", { name })}
        </button>
      ) : null}
      {entry.wingman.flatMap((id) => {
        const li = lis.find((candidate) => candidate.id === id);
        return li
          ? [
              <button
                key={id}
                type="button"
                className="of-button of-button--quiet of-glass of-button--small"
                onClick={() => void wingman(li)}
              >
                <Handshake size={14} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.friends.wingmanAsk", { name, li: li.name })}
              </button>,
            ]
          : [];
      })}
      {entry.finale ? <p className="of-hint">{t("ui.otomeForge.friends.finaleDone", { name })}</p> : null}
      {entry.held ? null : <UpsetToggle runKey={runKey} li={friend} upset={entry.upset} />}
      <p className="of-visually-hidden" role="status">
        {helped}
      </p>
      {error ? (
        <p className="of-error" role="alert">
          {otome.errorMessage(error)}
        </p>
      ) : null}
    </div>
  );
}

function AddFriendDialog({ runKey, view, onClose }: { runKey: string; view: RunView; onClose: () => void }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const cards = useCharacterOptions();
  const met = useQuery({
    queryKey: [...runQueryKey(runKey), "friends-met"],
    queryFn: () => otome.get<{ met: Met[] }>(`${runPath(runKey)}/friends/met`),
  });
  const people = met.data?.met ?? [];
  // One native radio group for the source, apart from the pronoun radios, so the arrow keys move within it.
  const source = useId();
  const [mode, setMode] = useState<"met" | "card" | "new">("met");
  const [metKey, setMetKey] = useState("");
  const [cardId, setCardId] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [pronouns, setPronouns] = useState<PronounChoice>(emptyPronouns());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolved = resolvePronouns(pronouns);
  const byItself = usePaintsByItself(view.world.images);
  const ready = !!resolved && (mode === "met" ? !!metKey : mode === "card" ? !!cardId : !!name.trim());

  const add = async () => {
    if (!resolved || busy) return;
    setBusy(true);
    setError(null);
    const person = people.find((entry) => entry.key === metKey);
    const body =
      mode === "met"
        ? { source: "met", key: metKey, pronouns: resolved, ...(person?.cardId ? { cardId: person.cardId } : {}) }
        : mode === "card"
          ? { source: "card", cardId, pronouns: resolved }
          : { source: "new", name: name.trim(), pronouns: resolved, ...(notes.trim() ? { notes: notes.trim() } : {}) };
    try {
      await otome.post(`${runPath(runKey)}/friends`, body);
      void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      void queryClient.invalidateQueries({ queryKey: storyQueryKey(runKey) });
      onClose();
    } catch (failure) {
      setError(otome.errorMessage(failure));
      setBusy(false);
    }
  };

  const tile = (id: string, label: string, picked: boolean, onPick: () => void, url?: string) => (
    <li key={id}>
      <button
        type="button"
        className="of-tile of-glass"
        data-checked={picked}
        aria-pressed={picked}
        title={label}
        onClick={onPick}
      >
        <Avatar name={label} url={url} accent={nameAccent(label)} />
        <span className="of-tile-name">{label}</span>
        {picked ? (
          <span className="of-tile-check" aria-hidden="true">
            <Check size={12} strokeWidth={3} />
          </span>
        ) : null}
      </button>
    </li>
  );

  return (
    <Dialog
      title={t("ui.otomeForge.friends.addTitle")}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          <button type="button" className="of-button of-button--quiet of-glass" onClick={onClose} disabled={busy}>
            {t("ui.otomeForge.home.close")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary"
            disabled={busy || !ready}
            onClick={() => void add()}
          >
            {t("ui.otomeForge.friends.addConfirm")}
          </button>
        </>
      }
    >
      {busy ? (
        <p className="of-hint of-planning" role="status">
          {t("ui.otomeForge.friends.adding")}
        </p>
      ) : (
        <>
          <p className="of-hint">{t("ui.otomeForge.friends.addCost")}</p>
          {view.world.images.connectionId ? (
            <CostHint
              images={1}
              note={t(byItself ? "ui.otomeForge.story.newcomerLookAutoNote" : "ui.otomeForge.story.newcomerLookNote")}
            />
          ) : null}
          {error ? (
            <p className="of-error" role="alert">
              {error}
            </p>
          ) : null}
          <fieldset className="of-field">
            <label>
              <input type="radio" name={source} checked={mode === "met"} onChange={() => setMode("met")} />{" "}
              {t("ui.otomeForge.friends.fromMet")}
            </label>
            <label>
              <input type="radio" name={source} checked={mode === "card"} onChange={() => setMode("card")} />{" "}
              {t("ui.otomeForge.story.newcomerCard")}
            </label>
            <label>
              <input type="radio" name={source} checked={mode === "new"} onChange={() => setMode("new")} />{" "}
              {t("ui.otomeForge.friends.fromNew")}
            </label>
          </fieldset>
          <PronounPicker legend={t("ui.otomeForge.story.newcomerPronouns")} value={pronouns} onChange={setPronouns} />
          {mode === "met" ? (
            met.isError ? (
              <RetryNotice
                message={t("ui.otomeForge.friends.metFailed")}
                onRetry={() => void met.refetch()}
                retrying={met.isFetching}
              />
            ) : people.length ? (
              <ul className="of-tiles of-tiles--scroll" aria-label={t("ui.otomeForge.friends.fromMet")}>
                {people.map((person) =>
                  tile(person.key, person.name, metKey === person.key, () => setMetKey(person.key)),
                )}
              </ul>
            ) : (
              <p className="of-hint" role={met.isLoading ? "status" : undefined}>
                {t(met.isLoading ? "ui.otomeForge.friends.metLoading" : "ui.otomeForge.friends.metNone")}
              </p>
            )
          ) : mode === "card" ? (
            <ul className="of-tiles of-tiles--scroll" aria-label={t("ui.otomeForge.story.newcomerCard")}>
              {cards.items.map((card) =>
                tile(card.id, card.name, cardId === card.id, () => setCardId(card.id), card.avatarUrl ?? undefined),
              )}
            </ul>
          ) : (
            <>
              <label className="of-field">
                <span>{t("ui.otomeForge.story.newcomerName")}</span>
                <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="of-field">
                <span>{t("ui.otomeForge.friends.notes")}</span>
                <textarea value={notes} maxLength={500} rows={3} onChange={(event) => setNotes(event.target.value)} />
                <span className="of-hint">{t("ui.otomeForge.friends.notesHint")}</span>
              </label>
            </>
          )}
        </>
      )}
    </Dialog>
  );
}
