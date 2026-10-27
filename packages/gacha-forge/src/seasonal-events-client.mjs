/* global forgeSeasonalEnglish, stopForgeStoryRequests, wireForgeBannerAnimation, syncForgeAudio */
const forgeSeasonalLayout = `
.gf-story-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-column:1/-1; gap:var(--sp-2); }
.gf-story-options .st-plate { min-width:0; margin:0; display:grid; grid-template-rows:subgrid; grid-row:span 2; row-gap:0; }
.gf-story-options .ob-toggle { display:grid; grid-template-columns:44px minmax(0,1fr); gap:.35rem; align-items:start; padding:.2rem; }
.gf-story-options .ob-toggle > .ob-bx { position:relative; width:44px; height:44px; min-width:44px; min-height:44px; padding:0; border:0; background:transparent; clip-path:none; }
.gf-story-options .ob-bx::before { content:""; position:absolute; width:24px; height:24px; left:10px; top:10px; border:1px solid var(--steel); border-radius:var(--radius-sm); background:var(--ink-2); }
.gf-story-options .ob-bx[aria-checked="true"]::before { background:var(--coral); border-color:var(--coral); }
.gf-story-options .ob-bx > svg, .gf-story-options .ob-bx > span { position:relative; width:16px; height:16px; z-index:1; }
.gf-story-options .ob-bx[aria-checked="true"] > svg { color:var(--ink); }
.gf-story-options .bt { display:grid; min-width:0; gap:.3rem; padding-top:.6rem; }
.gf-story-options .bd { overflow-wrap:anywhere; }
.gf-event-pane { padding:var(--sp-3); overflow:auto; min-height:0; min-width:0; }
.gf-event-list { display:grid; gap:var(--sp-3); }
.gf-event-card { position:relative; min-width:0; padding:var(--sp-3); background:var(--ink-2); border:1px solid var(--steel-dark); border-radius:var(--radius); }
.gf-event-card h3 { margin:.7rem 0 .4rem; color:var(--text); font:600 var(--t-lg)/1.25 var(--display); }
.gf-event-card p { margin:.5rem 0; color:var(--steel-faint); font:400 max(12px,var(--t-sm))/1.5 var(--body); overflow-wrap:anywhere; }
.gf-event-art { position:relative; width:100%; aspect-ratio:16/9; max-height:35cqh; overflow:hidden; border-radius:var(--radius-sm); background:var(--ink); }
.gf-event-art img { width:100%; height:100%; object-fit:cover; display:block; }
.gf-event-rewards { display:flex; flex-wrap:wrap; gap:.5rem; padding:0; list-style:none; color:var(--text); }
.gf-event-rewards li { padding:.35rem .6rem; border:1px solid var(--steel-dark); border-radius:var(--radius-sm); }
.gf-event-action { min-height:44px; padding:.5rem .9rem; background:var(--coral); color:var(--ink); border:1px solid var(--coral); border-radius:var(--radius-sm); font:600 max(12px,var(--t-sm))/1.3 var(--body); cursor:pointer; }
.gf-event-action:disabled { opacity:.55; cursor:default; }
.gf-event-action:focus-visible { outline:2px solid var(--text); outline-offset:3px; }
.gf-event-card .chips { display:flex; flex-wrap:wrap; gap:.4rem; margin:.4rem 0; }
.gf-event-archive { margin-top:var(--sp-3); padding:var(--sp-3); border-top:1px solid var(--steel-dark); }
@container (max-width:300px) { .gf-story-options { grid-template-columns:minmax(0,1fr); } }
`;
const forgeEventEscape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/gu,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
const forgeEventT = (key) => forgeSeasonalEnglish[key] || key;
const forgeEventChapter = (value) => typeof value === "string" && /^event-[1-9]\d{0,8}$/u.test(value);
const forgeEventWindow = (event) => `${event.seq}:${event.endsAt}`;
const forgeSeasonalNow = (host) => {
  const sample = host._forgeSeasonalServerTime;
  return sample ? sample.now + Math.max(0, Date.now() - sample.loadedAt) : Date.now();
};
const forgeSeasonalRouteMap = {
  "/chapter-plan": "/story-event/plan",
  "/beat": "/story-event/beat",
  "/story/start": "/story-event/start",
  "/complete": "/story-event/complete",
  "/battle": "/story-event/battle",
  "/battle/start": "/story-event/battle/start",
  "/combat-guide": "/story-event/combat-guide",
  "/choice": "/story-event/choice",
  "/cg-art": "/story-event/cg-art",
  "/beat/mark": "/story-event/beat/mark",
  "/preforge": "/story-event/preforge",
  "/preforge/start": "/story-event/preforge",
  "/preforge/retry": "/story-event/preforge",
  "/preforge/cancel": "/story-event/preforge",
};
export function forgeSeasonalRequest(path, body) {
  return forgeEventChapter(body?.chapter) ? forgeSeasonalRouteMap[path] || path : path;
}
export function prepareForgeSeasonalEvents(host) {
  const runId = host._run?.runId;
  const enabled = host._run?.story?.seasonalEvents === true;
  if (host._forgeSeasonalRunId !== runId || host._forgeSeasonalEnabled !== enabled) {
    host._forgeSeasonalRunId = runId;
    host._forgeSeasonalEnabled = enabled;
    host._forgeSeasonalRevision = (host._forgeSeasonalRevision || 0) + 1;
    host._forgeSeasonalState = null;
    host._forgeSeasonalLoading = false;
    host._forgeSeasonalExpired = new Set();
    host._forgeSeasonalServerTime = null;
    if (host._forgeEvent?.runId !== runId) host._forgeEvent = null;
  }
  const available =
    host._run?.story?.seasonalEvents === true || host._forgeSeasonalState?.events?.some((event) => event.played > 0);
  if (available && Array.isArray(host._eventSlots) && !host._eventSlots.some((slot) => slot.id === "story-events"))
    host._eventSlots = [
      ...host._eventSlots,
      { id: "story-events", kind: "story-event", label: forgeEventT("events.title"), live: true },
    ];
  if (host._hudView !== "events" || host._eventId !== "story-events") host._forgeSeasonalBanner = null;
}
async function loadForgeSeasonalEvents(host, retry = false) {
  const runId = host._run?.runId;
  if (!runId || host._forgeSeasonalLoading) return;
  host._forgeSeasonalLoading = true;
  const revision = host._forgeSeasonalRevision;
  let result;
  try {
    result = await host._postJson("/story-events", { runId, retry });
  } catch {
    result = { ok: false, error: "story-event-load-failed" };
  }
  if (host._run?.runId !== runId || host._forgeSeasonalRevision !== revision) return;
  host._forgeSeasonalLoading = false;
  host._forgeSeasonalLoadedAt = Date.now();
  host._forgeSeasonalServerTime =
    Number.isFinite(result?.serverNow) && result.serverNow > 0
      ? { now: result.serverNow, loadedAt: host._forgeSeasonalLoadedAt }
      : null;
  host._forgeSeasonalState = result?.ok ? result : { events: [], error: true };
  // A reconciled live window may refresh once again when the server's actual deadline arrives.
  if (host._forgeSeasonalServerTime)
    for (const event of result?.events || [])
      if (event.live && result.serverNow < event.endsAt) host._forgeSeasonalExpired?.delete(forgeEventWindow(event));
  host._eventsRev = (host._eventsRev || 0) + 1;
  prepareForgeSeasonalEvents(host);
  host._renderBrowser();
  if (host._hudView === "chapters") host._fillChapters?.();
}
export function openForgeSeasonalEvent(host, event) {
  // A chapter left forging keeps forging on the server; entering the event only stops tracking it, quietly.
  for (const key of host._forgeAway?.keys() ?? [])
    if (key.startsWith(`${host._run?.runId}|`)) host._forgeAway.delete(key);
  stopForgeStoryRequests(host);
  host._clearBeat?.();
  host._stopCombat?.();
  host._forgeEvent = { ...event, runId: host._run.runId };
  host._bondUnit = "";
  host._bondPart = 1;
  host._planChapter = event.chapter;
  host._plan = null;
  host._planState = "idle";
  host._planEscaped = false;
  host._difficulty = "normal";
  host._chapterProgress = { normal: event.played || 0, hard: 0, veryhard: 0 };
  host._storyNotice = "";
  host._hudView = "chapter";
  host._renderBrowser();
}
export function adoptForgeSeasonalResponse(host, path, body, result) {
  if (!result?.ok || host._run?.runId !== body?.runId) return;
  if (path === "/story-event/plan" && result.event && host._planChapter === body.chapter)
    host._forgeEvent = { ...host._forgeEvent, ...result.event, runId: body.runId };
  const played = result.progress?.[body.chapter]?.normal;
  if (typeof played !== "number" || !forgeEventChapter(body.chapter)) return;
  if (host._forgeEvent?.chapter === body.chapter) host._forgeEvent.played = played;
  if (host._forgeSeasonalState?.events)
    host._forgeSeasonalState.events = host._forgeSeasonalState.events.map((event) =>
      event.chapter === body.chapter ? { ...event, played } : event,
    );
  host._eventsRev = (host._eventsRev || 0) + 1;
}
function forgeSeasonalCards(events, { archive = false } = {}) {
  return events
    .map((event) => {
      const expired = !event.live,
        failed = event.state === "error" || event.state === "preparing";
      const action = expired ? "events.revisit" : event.played ? "events.continue" : "events.play";
      const date = new Date(event.endsAt).toLocaleString();
      const rewards = (event.rewards || [])
        .map(
          (reward) =>
            `<li>${forgeEventEscape(reward.qty)} ${forgeEventEscape(reward.name || forgeEventT(`events.reward.${reward.kind}`))}</li>`,
        )
        .join("");
      return `<article class="gf-event-card" data-story-event-card="${forgeEventEscape(event.chapter)}">${!archive && event.art ? `<div class="gf-event-art" data-story-event-banner><img src="${forgeEventEscape(event.art)}" alt="" /></div>` : ""}<h3>${forgeEventEscape(event.title || forgeEventT("events.title"))}</h3><p>${forgeEventEscape(event.theme || "")}</p><p>${forgeEventEscape(expired ? forgeEventT("events.expired") : `${forgeEventT("events.ends")} ${date}`)}</p>${failed ? `<p>${forgeEventEscape(forgeEventT("events.failed"))}</p><button type="button" class="gf-event-action" data-story-event-retry>${forgeEventT("events.retry")}</button>` : `<p>${forgeEventEscape(forgeEventT("events.progress"))} ${event.played || 0}/10</p>${!archive ? `<h4>${forgeEventT("events.rewards")}</h4><ul class="gf-event-rewards">${rewards}</ul>` : ""}<button type="button" class="gf-event-action" data-story-event-open="${forgeEventEscape(event.chapter)}"${(!expired && !event.canStart && !event.opened) || (expired && !event.played) ? " disabled" : ""}>${forgeEventT(action)}</button>${!event.canStart && !event.opened && !expired ? `<p>${forgeEventT("events.boundary")}</p>` : ""}${event.mediaError ? `<p>${forgeEventT("events.mediaFailed")}</p>` : ""}`}</article>`;
    })
    .join("");
}
export function wireForgeSeasonalEvents(host) {
  prepareForgeSeasonalEvents(host);
  const root = host._root;
  if (!root.querySelector("[data-forge-seasonal-layout]")) {
    const style = document.createElement("style");
    style.dataset.forgeSeasonalLayout = "";
    style.textContent = forgeSeasonalLayout;
    root.append(style);
  }
  const choiceField = root.querySelector('[data-field="story.choices"]'),
    seasonalField = root.querySelector('[data-field="story.seasonalEvents"]');
  if (
    choiceField &&
    seasonalField &&
    choiceField.parentElement === seasonalField.parentElement &&
    !choiceField.closest(".gf-story-options")
  ) {
    const group = document.createElement("div");
    group.className = "gf-story-options";
    choiceField.before(group);
    group.append(choiceField, seasonalField);
  }
  if (!host._run?.runId) return;
  if (
    !host._forgeSeasonalState &&
    !host._forgeSeasonalLoading &&
    (host._run.story?.seasonalEvents === true || ["chapters", "events"].includes(host._hudView))
  )
    void loadForgeSeasonalEvents(host);
  const state = host._forgeSeasonalState,
    events = state?.events || [];
  const expired = (host._forgeSeasonalExpired ||= new Set());
  const due = events.filter(
    (event) => event.live && forgeSeasonalNow(host) >= event.endsAt && !expired.has(forgeEventWindow(event)),
  );
  if (!host._forgeSeasonalLoading && host._run.story?.seasonalEvents === true && due.length) {
    // Consume this window's edge before loading; a stale live response cannot start a render loop.
    for (const event of due) expired.add(forgeEventWindow(event));
    void loadForgeSeasonalEvents(host);
  }
  if (host._hudView === "events" && host._eventId === "story-events") {
    const pane = root.querySelector('[data-screen="events"] .ev-pane');
    if (pane && !pane.dataset.forgeStoryEvents) {
      pane.dataset.forgeStoryEvents = "";
      pane.classList.add("gf-event-pane");
      pane.innerHTML = `<div class="gf-event-list">${host._forgeSeasonalLoading ? `<p role="status">${forgeEventT("events.loading")}</p>` : state?.error ? `<p role="status">${forgeEventT("events.failed")}</p><button class="gf-event-action" data-story-event-retry>${forgeEventT("events.retry")}</button>` : events.length ? forgeSeasonalCards(events) : `<p>${forgeEventT("events.empty")}</p>`}</div>`;
      for (const banner of pane.querySelectorAll("[data-story-event-banner]")) {
        const controls = document.createElement("div");
        controls.className = "chips";
        banner.after(controls);
      }
      const event = events.find((entry) => entry.live && entry.art);
      host._forgeSeasonalBanner = event
        ? { id: `story-event-${event.seq}`, art: event.art, music: event.music, title: event.title }
        : null;
    }
  }
  const chapters = root.querySelector("[data-chapters-list]");
  if (host._hudView === "chapters" && chapters && !chapters.querySelector("[data-story-event-archive]")) {
    const archive = events.filter((event) => event.played || (event.live && event.canStart));
    if (archive.length) {
      const section = document.createElement("section");
      section.className = "gf-event-archive";
      section.dataset.storyEventArchive = "";
      section.innerHTML = `<h3>${forgeEventT("events.archive")}</h3><div class="gf-event-list">${forgeSeasonalCards(archive, { archive: true })}</div>`;
      chapters.append(section);
    }
  }
  for (const button of root.querySelectorAll("[data-story-event-open]")) {
    if (button.dataset.forgeEventWired) continue;
    button.dataset.forgeEventWired = "true";
    button.addEventListener("click", () => {
      const event = events.find((entry) => entry.chapter === button.dataset.storyEventOpen);
      if (event) openForgeSeasonalEvent(host, event);
    });
  }
  for (const button of root.querySelectorAll("[data-story-event-retry]")) {
    if (button.dataset.forgeEventWired) continue;
    button.dataset.forgeEventWired = "true";
    button.addEventListener("click", () => {
      void loadForgeSeasonalEvents(host, true);
    });
  }
  if (host._forgeEvent && forgeEventChapter(host._planChapter)) {
    for (const button of root.querySelectorAll("[data-diff]")) button.hidden = true;
    if (forgeSeasonalNow(host) >= host._forgeEvent.endsAt || host._run.story?.seasonalEvents !== true) {
      for (const button of root.querySelectorAll("[data-play], [data-start]")) button.disabled = true;
      const notice = root.querySelector(".cap-scroll .notice");
      if (notice) {
        notice.hidden = false;
        notice.textContent = forgeEventT(
          host._run.story?.seasonalEvents === true ? "events.expired" : "events.disabled",
        );
      }
    }
  }
  wireForgeBannerAnimation(host);
  syncForgeAudio(host);
}
