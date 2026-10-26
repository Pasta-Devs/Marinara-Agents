const forgeBackgroundUnlockEnglish = { "home.background.unlocked": "New background unlocked" };

export function disposeForgeBackgroundWitness(host) {
  const state = host._forgeBackgroundWitness;
  if (state) {
    state.active = false;
    state.observer.disconnect();
    document.removeEventListener("visibilitychange", state.visibility);
    if (state.image) state.image.onload = null;
    clearTimeout(state.timer);
    state.notice?.remove();
  }
  host._forgeBackgroundWitness = null;
}

export function witnessForgeBackground(host, { segment, index, url }) {
  const node = host._activeStoryNode,
    runId = host._run?.runId;
  if (!node || !runId || !url || !host._root?.querySelector("[data-vn]")) return;
  let state = host._forgeBackgroundWitness;
  if (state?.node !== node || state?.runId !== runId) {
    disposeForgeBackgroundWitness(host);
    state = host._forgeBackgroundWitness = {
      node,
      runId,
      active: true,
      sent: new Set(),
      current: null,
      timer: null,
      notice: null,
      target: null,
      intersecting: false,
      retry: null,
      image: null,
    };
    state.visibility = () => state.retry?.();
    state.observer = new IntersectionObserver((entries) => {
      const entry = entries.find((row) => row.target === state.target);
      if (entry)
        state.intersecting =
          entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0;
      state.retry?.();
    });
    document.addEventListener("visibilitychange", state.visibility);
  }
  const target = host._root.querySelector("[data-vn]");
  if (state.target !== target) {
    state.observer.disconnect();
    state.target = target;
    state.intersecting = false;
    state.observer.observe(target);
  }
  const at = host._choicePlayback ? host._choicePlayback.mainIndex(index) : index;
  const identity = JSON.stringify([at, segment.place || "", url]);
  state.current = identity;
  if (state.sent.has(identity)) return;
  const current = () =>
    state.active &&
    host._forgeBackgroundWitness === state &&
    host._activeStoryNode === node &&
    host._run?.runId === runId &&
    state.current === identity &&
    host._root?.querySelector("[data-vn]") === state.target;
  const visible = () => {
    if (document.hidden || !state.intersecting || !current() || !state.target.isConnected || host.isConnected === false)
      return false;
    const bounds = state.target.getBoundingClientRect();
    if (
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      bounds.bottom <= 0 ||
      bounds.right <= 0 ||
      bounds.top >= innerHeight ||
      bounds.left >= innerWidth
    )
      return false;
    for (let element = state.target; element; element = element.parentElement || element.getRootNode()?.host) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  // CSS background images have no load event. Decode this exact displayed URL before
  // recording it, and reject late loads after a line, chapter or run has changed.
  const image = new Image();
  if (state.image) state.image.onload = null;
  state.image = image;
  const dispatch = async () => {
    if (!visible() || state.sent.has(identity)) return;
    state.sent.add(identity);
    const storyRevision =
      host._forgeChapterPlanVersions?.get(host._plan) ?? host._forgeChapterVersions?.get(runId) ?? 0;
    let result;
    try {
      result = await host._postJson("/artwork/witness", {
        runId,
        chapter: node.chapter,
        storyIndex: node.storyIndex,
        at,
        place: segment.place || "",
        url,
        storyRevision,
        replay: node.replay === true,
        ...(host._choicePlayback?.artworkChoice?.(index) || {}),
      });
    } catch {
      state.sent.delete(identity);
      return;
    }
    if (!result?.ok) {
      state.sent.delete(identity);
      return;
    }
    if (!visible() || !result.unlocked) return;
    // Invalidate the picker cache; reopening it must see this new earned image.
    host._pickOptions = null;
    state.notice?.remove();
    clearTimeout(state.timer);
    const notice = document.createElement("div");
    notice.className = "gf-background-unlocked";
    notice.setAttribute("role", "status");
    notice.style.cssText =
      "position:absolute;inset-block-start:var(--sp-3);inset-inline-start:50%;transform:translateX(-50%);z-index:8;max-width:calc(100% - 2rem);padding:.5rem .8rem;border:1px solid var(--steel-dark);border-radius:var(--radius-sm);background:var(--ink-2);color:var(--text);font:600 max(12px,var(--t-sm))/1.35 var(--body);text-align:center;pointer-events:none";
    notice.textContent = forgeBackgroundUnlockEnglish["home.background.unlocked"];
    host._root.querySelector("[data-vn]").append(notice);
    state.notice = notice;
    state.timer = setTimeout(() => {
      notice.remove();
      if (state.notice === notice) state.notice = null;
    }, 1000);
  };
  state.retry = null;
  image.onload = () => {
    if (!current()) return;
    state.retry = dispatch;
    void dispatch();
  };
  image.src = url;
}
