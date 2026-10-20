import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api-client";
import {
  SLP_SCENE_MOMENTS,
  type SlpSceneAction,
  type SlpSceneDraft,
  type SlpSceneField,
  type SlpSceneMoment,
  type SlpScenePatch,
  type SlpScenePreset,
} from "../../../../../shared/src/slp/slp-scene.js";
import type { SlpAccount, SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { generateClientId } from "../../../lib/utils";
import {
  useCreateCreatorStageProfile,
  useGenerateCreatorArtwork,
  useGenerateCreatorStageProfileDraft,
  useSlpViewerPersonaId,
  useUpdateCreatorStageProfile,
} from "../creators/slp-creators-contract";
import {
  applySlpScenePatch,
  editSlpSceneField,
  SLP_SCENE_MOMENT_CHAPTER,
  slpSceneChapters,
  slpSceneInitialState,
  slpSceneMomentFilled,
  slpSceneNextMoment,
  slpSceneSpicePatch,
  slpSceneMissing,
  slpSceneRedraftPatch,
  slpSceneShootGuidance,
  slpSceneStageProfile,
  toggleSlpSceneLock,
  undoSlpSceneChip,
  slpSceneGuidance,
  slpSceneTranscript,
  type SlpSceneChapter,
  type SlpSceneDraftState,
  type SlpSceneItem,
} from "./slp-scene-draft";
import { useEnqueueCreatorFirstPosts } from "./slp-first-post-hooks";
import { useSlpSceneKeep, useSlpSceneTurn } from "./slp-scene-hooks";

export type SlpSceneSetup = {
  preset: SlpScenePreset;
  source: Pick<SlpAccount, "id" | "displayName" | "handle" | "avatarUrl">;
  /** The creator seat: the existing Creator who helps. */
  helper?: Pick<SlpAccount, "id" | "displayName" | "handle" | "avatarUrl"> | null;
  disclosureMode: SlpIdentityDisclosure;
  /** false: "The image model knows this character" is off for the new Creator. */
  imageNameKnown?: boolean;
  connectionId?: string;
};

/**
 * The role-play sign-up's whole working state: the chat, the live page draft with its locks and
 * chips, the current moment, and the actions (say, update page, finish).
 */
export function useSlpSceneModel(setup: SlpSceneSetup, hostLabel: string) {
  const moments = SLP_SCENE_MOMENTS[setup.preset] as readonly SlpSceneMoment[];
  const open = setup.disclosureMode === "open";
  const [items, setItems] = useState<SlpSceneItem[]>([]);
  const [draftState, setDraftState] = useState<SlpSceneDraftState>(() =>
    slpSceneInitialState(
      open ? { displayName: setup.source.displayName, handle: setup.source.handle } : {},
      // An open page keeps its public name: nothing may patch it.
      open ? ["displayName", "handle"] : [],
    ),
  );
  const draftRef = useRef(draftState);
  const [moment, setMoment] = useState<SlpSceneMoment>(moments[0]);
  const [doneMoments, setDoneMoments] = useState<SlpSceneMoment[]>([]);
  /** Exchanges spent in the current moment; after two, "Next" is offered even if it is not done. */
  const [momentTurns, setMomentTurns] = useState(0);
  const [direction, setDirection] = useState("");
  /** The player has done something themselves (the "your turn" hint goes away). */
  const [acted, setActed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    displayName: string;
    handle: string;
    /** The chat became their first DM thread. */
    kept: boolean;
  } | null>(null);
  const turn = useSlpSceneTurn();
  const redraft = useGenerateCreatorStageProfileDraft();
  const create = useCreateCreatorStageProfile();
  const update = useUpdateCreatorStageProfile();
  const artwork = useGenerateCreatorArtwork();
  const firstPost = useEnqueueCreatorFirstPosts();
  const keep = useSlpSceneKeep();
  const viewerPersonaId = useSlpViewerPersonaId();
  // The chat is read back by the next turn before React renders (autopilot), so writes go through the ref.
  const itemsRef = useRef(items);
  const append = useCallback((added: SlpSceneItem[]) => {
    itemsRef.current = [...itemsRef.current, ...added];
    setItems(itemsRef.current);
  }, []);
  // Autopilot runs several turns from one press; each turn must see the moment and direction of now.
  const momentRef = useRef(moment);
  momentRef.current = moment;
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const [autoLeft, setAutoLeft] = useState(0);
  // The shoot's profile photo, read by the turn that decides whether the scene moves on.
  const photoRef = useRef(false);
  /** Move to another moment: skip ahead, go back, or linger by not moving at all. */
  const goTo = useCallback((next: SlpSceneMoment) => {
    if (momentRef.current !== next) setMomentTurns(0);
    momentRef.current = next;
    setMoment(next);
  }, []);
  const autoStop = useRef(false);

  const commit = useCallback((next: SlpSceneDraftState) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);
  const applyPatch = useCallback(
    (patch: SlpScenePatch, redrafted: boolean): SlpSceneItem | null => {
      const chipId = generateClientId();
      const { state, chip } = applySlpScenePatch(draftRef.current, patch, chipId);
      if (!chip) return null;
      commit(state);
      return { id: generateClientId(), kind: "patch", chipId, fields: chip.fields, redraft: redrafted };
    },
    [commit],
  );

  const lastAction = useRef<SlpSceneAction | null>(null);
  const send = useCallback(
    async (action: SlpSceneAction, retry = false) => {
      if (turn.isPending) return false;
      setError(null);
      if (action.kind !== "open") setActed(true);
      lastAction.current = action;
      // The player's own words are a host line, except in the seat, where they are a whisper. A
      // retry sends the same words again without writing them twice.
      const own: SlpSceneItem[] =
        !retry && action.kind === "say"
          ? [
              setup.preset === "seat"
                ? { id: generateClientId(), kind: "whisper", text: action.text }
                : { id: generateClientId(), kind: "line", speaker: "host", text: action.text },
            ]
          : [];
      if (own.length) append(own);
      const before = itemsRef.current;
      const moment = momentRef.current;
      try {
        const result = await turn.mutateAsync({
          preset: setup.preset,
          sourceAccountId: setup.source.id,
          ...(setup.helper ? { helperCreatorId: setup.helper.id } : {}),
          disclosureMode: setup.disclosureMode,
          moment,
          action,
          transcript: slpSceneTranscript(before),
          draft: draftRef.current.draft,
          locked: draftRef.current.locked,
          direction: directionRef.current,
          ...(setup.connectionId ? { connectionId: setup.connectionId } : {}),
        });
        const lines: SlpSceneItem[] = result.lines.map((line) => ({
          id: generateClientId(),
          kind: "line",
          speaker: line.speaker,
          text: line.text,
        }));
        const chip = applyPatch(result.patch, false);
        append([...lines, ...(chip ? [chip] : [])]);
        if (action.kind !== "open") setMomentTurns((count) => count + 1);
        // The character leads: once a moment has what it needs (the model says so, or the page
        // already has it), the scene moves to the next moment that still needs something. The
        // photo shoot waits for its photos.
        const draft = draftRef.current.draft;
        const photo = photoRef.current;
        const finished = moment === "shoot" ? photo : result.momentDone || slpSceneMomentFilled(moment, draft, photo);
        if (finished) setDoneMoments((current) => (current.includes(moment) ? current : [...current, moment]));
        const next = slpSceneNextMoment(setup.preset, moment, { modelDone: result.momentDone, draft, photo });
        if (next && momentRef.current === moment) goTo(next);
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
        return false;
      }
    },
    [append, applyPatch, goTo, setup, turn],
  );

  /** Let the scene run by itself for a few exchanges; stops on the first failure or on Stop. */
  const autopilot = useCallback(
    async (turns = 3) => {
      autoStop.current = false;
      for (let left = turns; left > 0 && !autoStop.current; left--) {
        setAutoLeft(left);
        if (!(await send({ kind: "continue" }))) break;
      }
      setAutoLeft(0);
    },
    [send],
  );

  // The newcomer speaks first.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void send({ kind: "open" });
  }, [send]);

  /** A full redraft from the whole chat through the stage draft service. Locked fields stay. */
  const updatePage = useCallback(async () => {
    setError(null);
    try {
      const result = await redraft.mutateAsync({
        noodleAccountId: setup.source.id,
        disclosureMode: setup.disclosureMode,
        guidance: slpSceneGuidance(itemsRef.current, hostLabel, direction),
        // Empty fields are left out: the draft schema refuses an empty name.
        currentDraft: Object.fromEntries(
          Object.entries(slpSceneStageProfile(draftRef.current.draft, setup.disclosureMode)).filter(
            ([key, value]) => typeof value === "string" && value !== "" && key !== "gender",
          ),
        ),
        ...(setup.connectionId ? { connectionId: setup.connectionId } : {}),
      });
      const chip = applyPatch(slpSceneRedraftPatch(result), true);
      if (chip) append([chip]);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    }
  }, [append, applyPatch, direction, hostLabel, redraft, setup]);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [firstPostRun, setFirstPostRun] = useState<string | null>(null);
  const accountRef = useRef<string | null>(null);
  /**
   * Save the page as it is now: create it the first time, update it after that (the photo shoot
   * needs a real page to hang the pictures on). A page that still misses its basics gets one
   * redraft first; what is still missing after that comes back for the player to fill in.
   */
  const savePage = useCallback(async (): Promise<{ id: string } | { missing: string[] } | null> => {
    setError(null);
    if (slpSceneMissing(draftRef.current.draft).length && !(await updatePage())) return null;
    const missing = slpSceneMissing(draftRef.current.draft);
    if (missing.length) return { missing };
    const stageProfile = slpSceneStageProfile(draftRef.current.draft, setup.disclosureMode);
    try {
      if (accountRef.current) {
        await update.mutateAsync({ accountId: accountRef.current, ...stageProfile });
        return { id: accountRef.current };
      }
      const profile = await create.mutateAsync({
        sourceAccountId: setup.source.id,
        stageProfile,
        imageNameKnown: setup.imageNameKnown,
      });
      accountRef.current = profile.id;
      setAccountId(profile.id);
      return { id: profile.id };
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return null;
    }
  }, [create, setup, update, updatePage]);

  /** What finishing adds to a saved page: its limits line, the first post and the kept chat. */
  const completeSignUp = useCallback(
    async (id: string, draft: SlpSceneDraft) => {
      const spice = slpSceneSpicePatch(draft);
      // The limits are the Creator's spice now. The page exists; a missed save is not worth failing
      // the sign-up over.
      if (spice)
        await api.patch(`/slurp2/slurp/accounts/${encodeURIComponent(id)}/steering`, spice).catch(() => undefined);
      // The first post is written in the background, like "first posts now" in Quick setup. The
      // finale follows it by its run id.
      const executionId = generateClientId();
      firstPost.mutate({ executionId, accountIds: [id] });
      setFirstPostRun(executionId);
      // The chat stays as their first DM thread with the player's persona (never with the page
      // itself). Nothing to keep, or no persona: the page is still live.
      const lines = slpSceneTranscript(itemsRef.current, 120);
      return viewerPersonaId && lines.length
        ? await keep
            .mutateAsync({ preset: setup.preset, creatorAccountId: id, viewerPersonaId, hostName: hostLabel, lines })
            .then((result) => result.status === "kept")
            .catch(() => false)
        : false;
    },
    [firstPost, hostLabel, keep, setup.preset, viewerPersonaId],
  );

  /** "Finish registration": save the page, then its limits line and the first post. */
  const finish = useCallback(async () => {
    const saved = await savePage();
    if (!saved || "missing" in saved) return saved ? saved.missing : null;
    const draft: SlpSceneDraft = draftRef.current.draft;
    const kept = await completeSignUp(saved.id, draft);
    setCreated({ id: saved.id, displayName: draft.displayName, handle: draft.handle, kept });
    return [];
  }, [completeSignUp, savePage]);

  /**
   * The dialog closed after the photo shoot saved the page (step 10 answer): the page is live, so it
   * is finished quietly with what the chat has so far, never left half-registered. A save that
   * still misses a field keeps the page as the shoot saved it.
   */
  const finishOnClose = useCallback(async () => {
    const id = accountRef.current;
    if (!id) return false;
    const saved = await savePage().catch(() => null);
    await completeSignUp(saved && !("missing" in saved) ? saved.id : id, draftRef.current.draft);
    return true;
  }, [completeSignUp, savePage]);

  /**
   * The first photo shoot: the real image pipeline draws the profile photo, then the cover, from
   * the chosen outfit and place. The page is saved first so the pictures have somewhere to live.
   */
  const [shooting, setShooting] = useState<"avatar" | "banner" | null>(null);
  const [photos, setPhotos] = useState<{ avatarUrl: string | null; bannerUrl: string | null }>({
    avatarUrl: null,
    bannerUrl: null,
  });
  const shoot = useCallback(
    async (outfit: string, place: string) => {
      const saved = await savePage();
      if (!saved || "missing" in saved) return saved ? saved.missing : null;
      let tookPhoto = false;
      for (const kind of ["avatar", "banner"] as const) {
        setShooting(kind);
        try {
          const profile = (await artwork.mutateAsync({
            accountId: saved.id,
            kind,
            guidance: slpSceneShootGuidance(kind, outfit, place),
          })) as { avatarUrl: string | null; bannerUrl?: string | null };
          const imageUrl = kind === "avatar" ? profile.avatarUrl : (profile.bannerUrl ?? null);
          setPhotos((current) => ({ ...current, [kind === "avatar" ? "avatarUrl" : "bannerUrl"]: imageUrl }));
          if (imageUrl) append([{ id: generateClientId(), kind: "photo", photo: kind, imageUrl }]);
          if (imageUrl && kind === "avatar") tookPhoto = true;
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
          break;
        }
      }
      setShooting(null);
      if (tookPhoto) {
        photoRef.current = true;
        setDoneMoments((current) => (current.includes("shoot") ? current : [...current, "shoot"]));
        // The photo chapter is done: the scene moves on by itself.
        const next = slpSceneNextMoment(setup.preset, "shoot", {
          modelDone: false,
          draft: draftRef.current.draft,
          photo: true,
        });
        if (next && momentRef.current === "shoot") goTo(next);
      }
      return [];
    },
    [append, artwork, goTo, savePage, setup.preset],
  );

  // Every chapter that gets done is celebrated once in the chat (a sparkle and what comes next).
  // "live" has the finale for that; chapters done from the start (an open page's name) are not news.
  const chapters = slpSceneChapters(setup.preset, draftState.draft, {
    photo: Boolean(photos.avatarUrl),
    live: Boolean(created),
  });
  const celebrated = useRef<Set<SlpSceneChapter> | null>(null);
  celebrated.current ??= new Set(chapters.chapters.filter((chapter) => chapter.done).map((chapter) => chapter.id));
  const doneKey = chapters.chapters.map((chapter) => (chapter.done ? chapter.id : "")).join(",");
  useEffect(() => {
    const seen = celebrated.current!;
    const fresh = chapters.chapters
      .filter((chapter) => chapter.done && !seen.has(chapter.id) && chapter.id !== "live")
      .map((chapter) => chapter.id);
    if (!fresh.length) return;
    for (const id of fresh) seen.add(id);
    // Next is the chapter the scene is on now (Support asks the bio before the photo), else the first open one.
    const now = SLP_SCENE_MOMENT_CHAPTER[momentRef.current];
    const next =
      chapters.chapters.find((chapter) => chapter.id === now && !chapter.done)?.id ??
      chapters.chapters.find((chapter) => !chapter.done)?.id ??
      null;
    append([{ id: generateClientId(), kind: "chapter", chapters: fresh, next }]);
    // Only a change in which chapters are done is news (doneKey stands for `chapters`).
  }, [doneKey]);

  return {
    setup,
    moments,
    moment,
    doneMoments,
    /** Two exchanges in this moment and still not done: "Next" is offered anyway, so no dead end. */
    lingering: momentTurns >= 2,
    chapters,
    firstPostRun,
    items,
    draft: draftState.draft,
    locked: draftState.locked,
    chips: draftState.chips,
    direction,
    setDirection,
    acted,
    error,
    created,
    busy:
      keep.isPending ||
      turn.isPending ||
      redraft.isPending ||
      create.isPending ||
      update.isPending ||
      autoLeft > 0 ||
      shooting !== null,
    talking: turn.isPending,
    updating: redraft.isPending,
    registering: create.isPending || update.isPending || keep.isPending,
    accountId,
    shooting,
    photos,
    shoot,
    send,
    autopilot,
    autoLeft,
    stopAutopilot: () => {
      autoStop.current = true;
    },
    goTo,
    retry: () => (lastAction.current ? send(lastAction.current, true) : Promise.resolve(false)),
    updatePage,
    finish,
    finishOnClose,
    undo: (chipId: string) => commit(undoSlpSceneChip(draftRef.current, chipId)),
    edit: <F extends SlpSceneField>(field: F, value: SlpSceneDraft[F]) =>
      commit(editSlpSceneField(draftRef.current, field, value)),
    toggleLock: (field: SlpSceneField) => commit(toggleSlpSceneLock(draftRef.current, field)),
  };
}

export type SlpSceneModel = ReturnType<typeof useSlpSceneModel>;
