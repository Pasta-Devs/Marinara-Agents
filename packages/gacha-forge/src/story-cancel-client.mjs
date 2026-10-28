/* global forgeStoryCancelEnglish */
const forgeStoryRequestPaths = new Set([
  "/story-events",
  "/story-event/plan",
  "/story-event/beat",
  "/story-event/start",
  "/story-event/complete",
  "/story-event/combat-guide",
  "/story-event/battle",
  "/story-event/battle/start",
  "/story-event/choice",
  "/story-event/cg-art",
  "/story-event/beat/mark",
  "/chapter-plan",
  "/bond-chapter/plan",
  "/beat",
  "/bond-chapter/beat",
  "/combat-guide",
  "/background",
  "/cg-art",
  "/preforge/start",
  "/preforge/retry",
  "/preforge/cancel",
  "/preforge",
  "/choice",
  "/complete",
  "/bond-chapter/complete",
  "/beat/mark",
  "/story/start",
  "/bond-chapter/start",
  "/battle/start",
  "/compress",
  "/compress/merge",
  "/chapters",
  "/continuity",
]);

export function forgeStoryRequest(host, path) {
  if (!forgeStoryRequestPaths.has(path)) return { signal: undefined, current: () => true };
  const runId = host._run?.runId,
    revision = host._forgeStoryRevision || 0,
    controller = new AbortController();
  const requests = (host._forgeStoryRequests ??= new Set());
  requests.add(controller);
  return {
    signal: controller.signal,
    current() {
      requests.delete(controller);
      return !controller.signal.aborted && host._run?.runId === runId && (host._forgeStoryRevision || 0) === revision;
    },
  };
}

export function stopForgeStoryRequests(host) {
  host._forgeStoryRevision = (host._forgeStoryRevision || 0) + 1;
  for (const controller of host._forgeStoryRequests || []) controller.abort();
  host._forgeStoryRequests?.clear();
  host._preforgeEpoch = (host._preforgeEpoch || 0) + 1;
  host._stopPreforgeWatch?.();
  host._clearBeat?.();
  host._storyStarting = false;
  host._combatStarting = false;
  host._autoStarting = false;
  host._merging = false;
  host._compressing = null;
}

const forgeChapterAwayKey = (runId, chapter, revision) => `${runId}|${chapter}|${revision}`;

// Only a main-story chapter that is still forging can be left running. The prologue and the postponed
// first scene open a scene when the plan lands; Character Stories and seasonal chapters keep their flows.
export function forgeChapterCanStepAway(host) {
  return (
    host._planState === "loading" &&
    Number.isInteger(host._planChapter) &&
    !host._bondUnit &&
    !host._prologue &&
    !host._storyWriteAsked &&
    !host._chapterWritten?.()
  );
}

// Keep playing leaves the loader without cancelling: the server keeps forging the chapter and saves its
// plan, and forgeChapterSettled reports it to the player when the request lands.
// ponytail: the chapter is tracked in this page only. A reload mid-forge brings its loader back (rejoining
// the same generation), Cancel on any story loader still stops the world's story generation, and the
// chapter list shows no forging state. Upgrade: report background chapter keys in generatingBackground
// and give the chapter card a forging state.
export function stepAwayFromForgeChapter(host) {
  // Counts the loads the player left, since each Keep playing and reopen waits on the same request.
  const away = (host._forgeAway ??= new Map()),
    key = forgeChapterAwayKey(host._run.runId, host._planChapter, host._forgeStoryRevision || 0);
  away.set(key, (away.get(key) || 0) + 1);
  host._planEscaped = true;
  host._planState = "idle";
  host._forgeCancelAsking = false;
  host._forgeFailure = null;
  host._hudView = "home";
  host._renderBrowser();
  host._root?.querySelector?.("[data-open-modes]")?.focus?.({ preventScroll: true });
}

// A chapter plan request settled. Returns true when that load must not adopt the plan.
export function forgeChapterSettled(
  host,
  response,
  origin,
  current,
  toast = globalThis.__MARINARA_HOST__?.modules?.sonner?.toast,
) {
  const key = forgeChapterAwayKey(origin.runId, origin.chapter, origin.revision),
    left = host._forgeAway?.get(key) || 0;
  if (!left) return !current;
  // The player reopened the chapter, so several loads wait on the same request: each one the player left
  // steps aside, and the last one adopts the plan, once.
  if (current) {
    if (left > 1) host._forgeAway.set(key, left - 1);
    else host._forgeAway.delete(key);
    return true;
  }
  host._forgeAway.delete(key);
  if (host._run?.runId !== origin.runId) return true;
  const say = (kind, text) => {
    try {
      toast?.[kind]?.(text.replace("{chapter}", origin.label ?? `Chapter ${origin.chapter}`));
    } catch {
      // The game never depends on the host's toaster.
    }
  };
  if (!response?.ok || !response.plan) {
    if (response?.error === "bond-chapter-open") return true;
    // Only a Cancel or a chapter reset stops the server. A plain null (a dropped request, or a page that
    // stopped waiting) says nothing: the server may still finish, and opening the chapter shows it.
    // ponytail: no notice follows such a null. Upgrade: read the chapter plan again once.
    if (response && response.error !== "cancelled") say("error", forgeStoryCancelEnglish.chapterFailed);
    else if (response || (host._forgeStoryStoppedAt ?? -1) > origin.revision)
      say("info", forgeStoryCancelEnglish.chapterStopped);
    return true;
  }
  const version = host._forgeChapterPlanVersions?.get(response.plan);
  // Fights are designed with the scenes written ahead, so the chapter is ready as soon as its plan is.
  void Promise.resolve().then(() => {
    if (host._run?.runId !== origin.runId) return;
    const asked = `${origin.runId}:${origin.chapter}`;
    if ((host._forgeStoryRevision || 0) === origin.revision && !host._preforgeAsked?.has(asked)) {
      host._preforgeAsked?.add(asked);
      const body = { runId: origin.runId, chapter: origin.chapter };
      if (Number.isSafeInteger(version)) body.storyRevision = version;
      // Opening the chapter later asks again when this start did not go through.
      void Promise.resolve(host._postJson("/preforge/start", body)).then(
        (started) => started?.ok || host._preforgeAsked?.delete(asked),
        () => host._preforgeAsked?.delete(asked),
      );
    }
    if (host._planChapter === origin.chapter && host._plan && !host._bondUnit) return; // already open
    say("success", forgeStoryCancelEnglish.chapterReady);
  });
  return true;
}

function wireForgeKeepPlaying(host, state, center) {
  let button = center?.querySelector("[data-forge-keep-playing]");
  if (!host._run || host._creatingNew || !host._bannerReady || state !== "forge" || !forgeChapterCanStepAway(host)) {
    button?.remove();
    center?.querySelector("[data-forge-keep-playing-hint]")?.remove();
    return;
  }
  if (!center || button) return;
  const root = host._root;
  if (!root.querySelector("[data-forge-keep-playing-style]")) {
    const style = document.createElement("style");
    style.dataset.forgeKeepPlayingStyle = "";
    style.textContent =
      ".forge-keep-hint{margin:0;font-size:var(--t-sm);color:var(--steel-faint);line-height:1.5;max-width:48ch}";
    root.append(style);
  }
  button = document.createElement("button");
  button.type = "button";
  button.className = "forge-leave";
  button.dataset.forgeKeepPlaying = "";
  button.textContent = forgeStoryCancelEnglish.keepPlaying;
  button.setAttribute("aria-describedby", "forge-keep-playing-hint");
  button.addEventListener("click", () => stepAwayFromForgeChapter(host));
  const hint = document.createElement("p");
  hint.id = "forge-keep-playing-hint";
  hint.className = "forge-keep-hint";
  hint.dataset.forgeKeepPlayingHint = "";
  hint.textContent = forgeStoryCancelEnglish.keepPlayingHint;
  const cancel = center.querySelector("[data-forge-story-cancel]");
  if (cancel) cancel.before(button);
  else center.append(button);
  button.after(hint);
}

export function cancelForgeStoryGeneration(host) {
  const runId = host._run?.runId,
    chapter = host._preforgeKey?.() ?? host._planChapter;
  if (!runId) return;
  // Cancel on this chapter's own loader stops it quietly; Cancel elsewhere still stops it, and says so.
  for (const key of host._forgeAway?.keys() ?? [])
    if (key.startsWith(`${runId}|${chapter}|`)) host._forgeAway.delete(key);
  stopForgeStoryRequests(host);
  host._forgeStoryStoppedAt = host._forgeStoryRevision; // the server stops too, unlike a page that stops waiting
  if (host._bondUnit) {
    host._plan = null;
    host._leaveBond?.();
  }
  host._planState = "idle";
  host._planEscaped = true;
  host._prologue = false;
  host._storyWriteAsked = false;
  host._forgeCancelAsking = false;
  host._forgeFailure = null;
  host._hudView = "home";
  host._renderBrowser();
  try {
    void Promise.resolve(host._postJson("/story/cancel", { runId, chapter })).catch(() => {});
  } catch {
    // Returning Home must remain available when the connection itself is stuck.
  }
}

export function wireForgeStoryCancel(host) {
  const state = host._state?.(),
    center = host._root?.querySelector(".gf-stage > .gf-view .forge-center"),
    existing = center?.querySelector("[data-forge-story-cancel]");
  wireForgeKeepPlaying(host, state, center);
  if (
    !host._run ||
    host._creatingNew ||
    !host._bannerReady ||
    (state !== "forge" && !(state === "beat" && host._beatState === "loading"))
  ) {
    existing?.remove();
    return;
  }
  if (!center || existing) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "forge-leave";
  button.setAttribute("data-forge-story-cancel", "");
  button.textContent = forgeStoryCancelEnglish.cancel;
  button.title = forgeStoryCancelEnglish.cancelHint;
  button.addEventListener("click", () => cancelForgeStoryGeneration(host));
  center.append(button);
}
