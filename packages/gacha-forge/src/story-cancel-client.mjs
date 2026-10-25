/* global forgeStoryCancelEnglish */
const forgeStoryRequestPaths = new Set([
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

export function cancelForgeStoryGeneration(host) {
  const runId = host._run?.runId,
    chapter = host._preforgeKey?.() ?? host._planChapter;
  if (!runId) return;
  stopForgeStoryRequests(host);
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
