/* global forgeChapterResetEnglish, stopForgeStoryRequests */
const forgeChapterVersionPaths = new Set([
  "/chapter-plan",
  "/bond-chapter/plan",
  "/beat",
  "/bond-chapter/beat",
  "/choice",
  "/complete",
  "/bond-chapter/complete",
  "/beat/mark",
  "/story/start",
  "/bond-chapter/start",
  "/battle/start",
  "/combat-guide",
  "/background",
  "/cg-art",
  "/preforge",
  "/preforge/start",
  "/preforge/retry",
  "/preforge/cancel",
  "/compress",
  "/compress/merge",
  "/chapters",
  "/continuity",
  "/chapter/regenerate",
]);

export function forgeChapterOriginCurrent(host, path, body) {
  return !forgeChapterVersionPaths.has(path) || !body?.runId || host._run?.runId === body.runId;
}

export function forgeChapterRequest(host, path, body) {
  if (!forgeChapterVersionPaths.has(path) || !body?.runId) return body;
  const versions = (host._forgeChapterPlanVersions ??= new WeakMap());
  const plan = host._plan;
  const known = host._forgeChapterVersions?.get(body.runId) || 0;
  if (plan && !versions.has(plan)) versions.set(plan, known);
  const read = ["/chapter-plan", "/bond-chapter/plan", "/chapters", "/continuity"].includes(path);
  return {
    ...body,
    storyRevision: Number.isSafeInteger(body.storyRevision)
      ? body.storyRevision
      : read
        ? known
        : ((plan && versions.get(plan)) ?? known),
  };
}

export function adoptForgeChapterVersion(host, path, body, result) {
  if (!forgeChapterVersionPaths.has(path) || !body?.runId || !Number.isSafeInteger(result?.storyRevision)) return true;
  const versions = (host._forgeChapterVersions ??= new Map());
  if (result.storyRevision < (versions.get(body.runId) || 0)) return false;
  versions.set(body.runId, result.storyRevision);
  if (["/chapter-plan", "/bond-chapter/plan"].includes(path) && result.ok && result.plan) {
    (host._forgeChapterPlanVersions ??= new WeakMap()).set(result.plan, result.storyRevision);
  }
  if (result.error === "story-changed") {
    host._storyNotice = forgeChapterResetEnglish["chapter.reset.changed"];
    host._renderBrowser?.();
  }
  return true;
}

export function forgeChapterCurrent(host) {
  const runId = host._run?.runId,
    chapter = host._planChapter,
    unitId = host._bondUnit || "",
    part = host._bondPart,
    revision = host._forgeStoryRevision || 0,
    serverVersion = host._forgeChapterVersions?.get(runId) || 0,
    plan = host._plan;
  return () =>
    host._run?.runId === runId &&
    host._planChapter === chapter &&
    (host._bondUnit || "") === unitId &&
    host._bondPart === part &&
    host._plan === plan &&
    (host._forgeChapterVersions?.get(runId) || 0) === serverVersion &&
    (host._forgeStoryRevision || 0) === revision;
}

function forgeChapterResetTarget(host) {
  if (!host._run?.runId || !host._plan || host._planState === "loading" || host._hudView !== "chapter") return null;
  const total = Array.isArray(host._plan.nodes)
    ? host._bondUnit
      ? host._plan.nodes.filter((node) => node.type === "story").length
      : host._plan.nodes.length
    : (host._plan.storyNodes?.length || 0) * (host._bondUnit ? 1 : 2);
  if (!total || Number(host._chapterProgress?.normal || 0) >= total) return null;
  return {
    runId: host._run.runId,
    chapter: host._planChapter,
    ...(host._bondUnit ? { unitId: host._bondUnit, part: host._bondPart } : {}),
  };
}

function forgeResetSameTarget(left, right) {
  return (
    left?.runId === right?.runId &&
    left?.chapter === right?.chapter &&
    left?.unitId === right?.unitId &&
    left?.part === right?.part
  );
}

function forgeClearSelectedStoryCache(host, target) {
  host._planCache?.delete(`${target.runId}|${target.chapter}`);
  host._preforgeAsked?.delete(`${target.runId}:${target.chapter}`);
  try {
    const chapter = target.unitId ? `${target.unitId}:${target.part}` : target.chapter;
    const prefix = `gf-beat-line:${target.runId}:${chapter}:`;
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch {
    // The server reading position remains authoritative when browser storage is unavailable.
  }
  host._plan = null;
  host._planState = "idle";
  host._chapterProgress = { ...host._chapterProgress, normal: 0 };
  host._difficulty = "normal";
  host._preforge = null;
  host._chaptersData = null;
  host._chaptersState = "idle";
  host._continuity = null;
  host._continuityState = "idle";
  host._storyNotice = "";
  host._storyStarting = false;
  host._combatStarting = false;
  host._prologue = false;
  host._storyWriteAsked = false;
  host._forgeFailure = null;
}

export async function confirmForgeChapterReset(host, request) {
  if (
    host._forgeChapterReset !== request ||
    !request.asking ||
    request.pending ||
    !forgeResetSameTarget(request, forgeChapterResetTarget(host))
  )
    return;
  request.pending = true;
  request.asking = false;
  request.error = "";
  const displayedPlan = host._plan;
  stopForgeStoryRequests(host);
  const revision = host._forgeStoryRevision;
  wireForgeChapterRegeneration(host);
  let result;
  try {
    result = await host._postJson("/chapter/regenerate", {
      runId: request.runId,
      chapter: request.chapter,
      ...(request.unitId ? { unitId: request.unitId, part: request.part } : {}),
      storyRevision: request.storyRevision,
    });
  } catch {
    result = null;
  }
  request.pending = false;
  // The user may have switched worlds/chapters while an uncooperative provider drained.
  if (
    host._forgeChapterReset !== request ||
    !forgeResetSameTarget(request, forgeChapterResetTarget(host)) ||
    host._plan !== displayedPlan ||
    host._forgeStoryRevision !== revision
  ) {
    if (host._forgeChapterReset === request) {
      host._forgeChapterReset = null;
      wireForgeChapterRegeneration(host);
    }
    return;
  }
  if (!result?.ok) {
    request.error =
      forgeChapterResetEnglish[
        result?.error === "chapter-completed"
          ? "chapter.reset.completed"
          : result?.error === "story-changed"
            ? "chapter.reset.changed"
            : result?.error === "reset-drain-timeout"
              ? "chapter.reset.drainTimeout"
              : result?.error === "reset-in-progress"
                ? "chapter.reset.busy"
                : result?.error === "bond-chapter-open"
                  ? "chapter.reset.bondOpen"
                  : "chapter.reset.failed"
      ];
    request.heldById = result?.error === "bond-chapter-open" ? result.heldById : "";
    request.heldPart = result?.heldPart;
    wireForgeChapterRegeneration(host);
    return;
  }
  if (!adoptForgeChapterVersion(host, "/chapter/regenerate", request, result)) {
    request.error = forgeChapterResetEnglish["chapter.reset.changed"];
    wireForgeChapterRegeneration(host);
    return;
  }
  forgeClearSelectedStoryCache(host, request);
  host._forgeChapterReset = null;
  host._loadChapterPlan();
}

export function wireForgeChapterRegeneration(host) {
  const root = host._root,
    target = forgeChapterResetTarget(host);
  const old = root?.querySelector("[data-forge-chapter-reset]");
  const stale =
    host._hudView === "chapter" &&
    host._plan &&
    host._forgeChapterPlanVersions?.has(host._plan) &&
    host._forgeChapterPlanVersions.get(host._plan) !== (host._forgeChapterVersions?.get(host._run?.runId) || 0);
  if (!target && !stale) {
    old?.remove();
    return;
  }
  const scroll = root.querySelector(".cap-scroll .node-list");
  if (!scroll) return;
  let section = old;
  if (!section) {
    section = document.createElement("section");
    section.dataset.forgeChapterReset = "";
    section.className = "forge-chapter-reset";
    section.addEventListener("click", (event) => event.stopPropagation());
    scroll.append(section);
  }
  if (!root.querySelector("[data-forge-chapter-reset-style]")) {
    const style = document.createElement("style");
    style.dataset.forgeChapterResetStyle = "";
    style.textContent =
      ".forge-chapter-reset{margin-block:24px 8px;padding-block-start:16px;border-block-start:1px solid var(--line);color:var(--text);font:var(--t-sm)/1.5 var(--body)}.forge-chapter-reset p{max-inline-size:70ch;overflow-wrap:anywhere;margin-block:8px}.forge-chapter-reset h3{font-size:var(--t-md);margin:0}.forge-chapter-reset-actions{display:flex;flex-wrap:wrap;gap:8px;margin-block-start:12px}.forge-chapter-reset button{min-block-size:44px;white-space:normal}";
    root.append(style);
  }
  section.replaceChildren();
  const copy = (tag, key) => {
    const item = document.createElement(tag);
    item.textContent = forgeChapterResetEnglish[key];
    section.append(item);
    return item;
  };
  const actions = document.createElement("div");
  actions.className = "forge-chapter-reset-actions";
  const button = (key, action) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "diff-pill";
    item.textContent = forgeChapterResetEnglish[key];
    item.addEventListener("click", action);
    actions.append(item);
    return item;
  };
  if (stale) {
    copy("p", "chapter.reset.changed").setAttribute("role", "alert");
    button("chapter.reset.reopen", () => {
      stopForgeStoryRequests(host);
      host._planCache?.delete(`${host._run.runId}|${host._planChapter}`);
      host._plan = null;
      host._planState = "idle";
      host._forgeChapterReset = null;
      host._loadChapterPlan();
    });
    section.append(actions);
    return;
  }
  let request = host._forgeChapterReset;
  if (!forgeResetSameTarget(request, target) || (!request.pending && request.plan !== host._plan))
    request = host._forgeChapterReset = {
      ...target,
      plan: host._plan,
      title: String(host._plan.title || forgeChapterResetEnglish["chapter.reset.untitled"]),
      storyRevision: host._forgeChapterVersions?.get(target.runId) || 0,
      asking: false,
      pending: false,
      error: "",
    };
  if (request.pending) {
    copy("p", "chapter.reset.pending").setAttribute("role", "status");
  } else if (request.asking) {
    const title = copy("h3", "chapter.reset.confirmTitle");
    title.id = "forge-chapter-reset-title";
    section.setAttribute("role", "group");
    section.setAttribute("aria-labelledby", title.id);
    copy("p", "chapter.reset.selected").textContent = forgeChapterResetEnglish["chapter.reset.selected"].replace(
      "{title}",
      () => request.title,
    );
    copy("p", "chapter.reset.warning");
    copy("p", "chapter.reset.preserved");
    button("chapter.reset.cancel", () => {
      request.asking = false;
      wireForgeChapterRegeneration(host);
      root.querySelector("[data-forge-reset-ask]")?.focus();
    }).dataset.forgeResetCancel = "";
    button("chapter.reset.action", () => {
      void confirmForgeChapterReset(host, request);
    }).dataset.forgeResetConfirm = "";
    section.append(actions);
  } else {
    section.removeAttribute("role");
    section.removeAttribute("aria-labelledby");
    if (request.error) {
      const message = document.createElement("p");
      message.textContent = request.error;
      message.setAttribute("role", "alert");
      section.append(message);
    }
    const ask = button("chapter.reset.action", () => {
      request.asking = true;
      request.error = "";
      wireForgeChapterRegeneration(host);
      root.querySelector("[data-forge-reset-cancel]")?.focus();
    });
    ask.dataset.forgeResetAsk = "";
    if (request.heldById) {
      button("chapter.reset.openBond", () => host._openBondChapter(request.heldById, request.heldPart));
    }
    section.append(actions);
  }
}
