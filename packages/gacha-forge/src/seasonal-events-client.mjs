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
const forgeEventBoundary = (blocked) =>
  blocked?.kind === "chapter" && Number.isInteger(blocked.chapter)
    ? forgeEventT("events.boundary.chapter").replace("{chapter}", String(blocked.chapter))
    : blocked?.kind === "character-story" && blocked.name
      ? forgeEventT("events.boundary.story").replace("{name}", blocked.name)
      : forgeEventT("events.boundary");
const forgeEventChapter = (value) => typeof value === "string" && /^event-[1-9]\d{0,8}$/u.test(value);
const forgeEventWindow = (event) => `${event.seq}:${event.endsAt}`;
const forgeSeasonalNow = (host) => {
  const sample = host._forgeSeasonalServerTime;
  return sample ? sample.now + Math.max(0, Date.now() - sample.loadedAt) : Date.now();
};
// A finished event's fights can be fought on Hard and Very Hard while it runs and Seasonal events is on, until every
// fight is won on Very Hard. Each list row carries it, so the cards that only see the rows can read it.
const forgeSeasonalFights = (event) => Number(event.combats) || 3;
const forgeSeasonalRow = (host, event) => ({
  ...event,
  hardOpen:
    host._run?.story?.seasonalEvents === true &&
    !!event.live &&
    forgeSeasonalNow(host) < event.endsAt &&
    (Number(event.played) || 0) >= 10 &&
    (Number(event.veryhard) || 0) < forgeSeasonalFights(event),
});
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
  // A refresh stopped by opening the event (stopForgeStoryRequests) or dropped keeps the list it was refreshing, each
  // row's Hard checked again against the clock and the toggle: the refresh at an event's end may be the one dropped.
  if (!result && host._forgeSeasonalState?.ok) {
    host._forgeSeasonalState.events = host._forgeSeasonalState.events.map((event) => forgeSeasonalRow(host, event));
    host._eventsRev = (host._eventsRev || 0) + 1;
    host._renderBrowser();
    if (host._hudView === "chapters") host._fillChapters?.();
    return;
  }
  host._forgeSeasonalLoadedAt = Date.now();
  host._forgeSeasonalServerTime =
    Number.isFinite(result?.serverNow) && result.serverNow > 0
      ? { now: result.serverNow, loadedAt: host._forgeSeasonalLoadedAt }
      : null;
  host._forgeSeasonalState = result?.ok
    ? { ...result, events: (result.events || []).map((event) => forgeSeasonalRow(host, event)) }
    : { events: [], error: true };
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
// The event the next-story choice offers beside the next chapter: one that can start now (the 1.24.10 rule), or
// one already started and unfinished, which holds the main story as an open Character Story does.
export function forgeSeasonalNextStory(host) {
  if (host._run?.story?.seasonalEvents !== true) return null;
  const now = forgeSeasonalNow(host);
  return (
    (host._forgeSeasonalState?.events || []).find(
      (event) =>
        event.live &&
        now < event.endsAt &&
        event.state === "ready" &&
        (event.opened ? (event.played || 0) < 10 : event.canStart),
    ) || null
  );
}
const forgeSeasonalFace = (event, fallback) =>
  `<span class="ch-opt-face">${event.art ? `<img src="${forgeEventEscape(event.art)}" alt="" loading="lazy" />` : fallback}</span>`;
// One more row in the "What happens next" card, after the Character Story rows.
export function forgeSeasonalChoiceRow(event, chapter, arrow) {
  return `<div class="ch-opt" data-story-event-open="${forgeEventEscape(event.chapter)}"><span class="ch-opt-m">${forgeSeasonalFace(event, "&#9733;")}</span><span class="ch-opt-b"><b>${forgeEventEscape(event.title || forgeEventT("events.title"))}</b><span>${forgeEventEscape(forgeEventT("events.choice.body").replace("{chapter}", chapter))}</span></span><button class="btn btn-go" type="button">${forgeEventT("events.play")}${arrow}</button></div>`;
}
const forgeSeasonalStoryCard = (event, arrow, state, eyebrow, premise, action, foot = "") => {
  const played = Math.max(0, Math.min(10, Number(event.played) || 0));
  return `<article class="ch-card bond ${state}" data-story-event-open="${forgeEventEscape(event.chapter)}"><div class="ch-index ch-face">${forgeSeasonalFace(event, "&#9733;")}</div><div class="ch-body"><div class="ch-eyebrow">${forgeEventEscape(forgeEventT(eyebrow))}</div><h3 class="ch-title">${forgeEventEscape(event.title || forgeEventT("events.title"))}</h3><p class="ch-premise">${forgeEventEscape(forgeEventT(premise))}</p><div class="ch-foot">${foot || `<div class="ch-bar"><div class="fig">${forgeEventEscape(forgeEventT("events.progress"))} ${played} / 10</div><div class="track"><i style="width:${played * 10}%"></i></div></div>`}</div></div><div class="ch-action"><button class="btn btn-go" type="button">${forgeEventT(action(played))}${arrow}</button></div></article>`;
};
// A cleared chapter's marks: N, then H and V lit once every fight is won on Hard and on Very Hard.
const forgeSeasonalMarks = (event) =>
  `<span class="diffs">${["normal", "hard", "veryhard"]
    .map(
      (difficulty) =>
        `<span class="${difficulty === "normal" || (Number(event[difficulty]) || 0) >= forgeSeasonalFights(event) ? "on" : ""}">${forgeEventEscape(forgeEventT(`events.diff.${difficulty}`))}</span>`,
    )
    .join("")}</span>`;
// A started event takes the next chapter's place, like an open Character Story, until it is finished.
export function forgeSeasonalOpenCard(event, arrow) {
  return forgeSeasonalStoryCard(event, arrow, "open", "events.choice.open", "events.choice.waits", (played) =>
    played ? "events.continue" : "events.play",
  );
}
// The side stories that follow the chapters placed(after) picks: each finished Character Story (stories, drawn by
// drawStory) and each played event, right after the chapter it followed. Several after one chapter are drawn by when
// each was opened, then by seq; a Character Story from before 1.8.12 has no opening time (0) and comes first. The
// event the next-story choice draws (options.event) keeps its own card.
export function forgeSeasonalTimelineCards(options, placed, arrow, stories = [], drawStory = () => "") {
  const after = (entry) => Math.max(0, Number(entry.after) || 0),
    opened = (entry) => Math.max(0, Number(entry.opened) || 0),
    seq = (entry) => Number(entry.seq) || 0;
  const eventCard = (event) =>
    forgeSeasonalStoryCard(
      event,
      arrow,
      "cleared",
      // Unfinished and not offered: its run ended, or (still live) Seasonal events is off.
      event.played >= 10 ? "events.timeline.done" : event.live ? "events.timeline.paused" : "events.timeline.ended",
      event.hardOpen ? "events.timeline.hard" : "events.timeline.body",
      () => (event.hardOpen ? "events.enter" : "events.revisit"),
      event.played >= 10 ? forgeSeasonalMarks(event) : "",
    );
  const events = (options?.played || []).filter(
    (event) => event.played > 0 && event.chapter !== options.event?.chapter && placed(after(event)),
  );
  return [
    ...stories.filter((story) => placed(after(story))).map((story) => ({ entry: story, draw: drawStory })),
    ...events.map((event) => ({ entry: event, draw: eventCard })),
  ]
    .sort(
      (left, right) =>
        after(left.entry) - after(right.entry) ||
        opened(left.entry) - opened(right.entry) ||
        seq(left.entry) - seq(right.entry),
    )
    .map(({ entry, draw }) => draw(entry))
    .join("");
}
// The started event's title for the forge loader and the chapter map, which otherwise say "Chapter event-1".
export function forgeSeasonalLabel(host) {
  return forgeEventChapter(host._planChapter) && host._forgeEvent?.chapter === host._planChapter
    ? host._forgeEvent.title || forgeEventT("events.title")
    : "";
}
// The chapter map's per-node pay. On Normal an event pays its own rewards (Events → Story events), never a chapter's
// Funds, Aether and rank, so its nodes show their Vigor cost only. Its Hard and Very Hard fights pay a chapter's.
export function forgeSeasonalNodePay(host, pay) {
  return pay && forgeSeasonalLabel(host) && host._difficulty === "normal"
    ? { combat: { vigor: pay.combat?.vigor }, story: { vigor: pay.story?.vigor } }
    : pay;
}
export function forgeSeasonalForging(title, status) {
  return {
    label: title,
    status,
    eyebrow: forgeEventT("events.forge.eyebrow"),
    brandNote: `&middot; ${forgeEventEscape(forgeEventT("events.forge.note"))}`,
    foot: forgeEventEscape(forgeEventT("events.forge.foot").replace("{title}", title)),
    errorStatus: forgeEventT("events.forge.error"),
    errorBody: forgeEventT("events.forge.errorBody"),
  };
}
// A chapter or Character Story that the open event holds opens the event instead, as a held Character Story does.
export function forgeSeasonalHeld(host, reply) {
  if (!forgeEventChapter(reply?.eventChapter) || !host._run) return false;
  const event = host._forgeSeasonalState?.events?.find((entry) => entry.chapter === reply.eventChapter);
  openForgeSeasonalEvent(host, event || { chapter: reply.eventChapter, title: reply.title || "", played: 0 });
  return true;
}
export function adoptForgeSeasonalResponse(host, path, body, result) {
  if (!result?.ok || host._run?.runId !== body?.runId) return;
  if (path === "/story-event/plan" && result.event) {
    if (host._planChapter === body.chapter)
      host._forgeEvent = { ...host._forgeEvent, ...result.event, runId: body.runId };
    // Chapters shows a started event as its open card; the list read before the start does not know it opened.
    if (host._forgeSeasonalState?.events)
      host._forgeSeasonalState.events = host._forgeSeasonalState.events.map((event) =>
        event.chapter === body.chapter
          ? {
              ...event,
              opened: result.event.opened,
              after: result.event.after,
              // A list read before the event opened has no plan to count its fights from.
              combats: (result.plan?.nodes || []).filter((node) => node?.type === "combat").length || event.combats,
            }
          : event,
      );
  }
  const progress = result.progress?.[body.chapter];
  if (typeof progress?.normal !== "number" || !forgeEventChapter(body.chapter)) return;
  const counts = {
    played: progress.normal,
    hard: Number(progress.hard) || 0,
    veryhard: Number(progress.veryhard) || 0,
  };
  if (host._forgeEvent?.chapter === body.chapter) Object.assign(host._forgeEvent, counts);
  // Finishing the event, or its last Very Hard fight, changes what its cards offer without a reload of the list.
  if (host._forgeSeasonalState?.events)
    host._forgeSeasonalState.events = host._forgeSeasonalState.events.map((event) =>
      event.chapter === body.chapter ? forgeSeasonalRow(host, { ...event, ...counts }) : event,
    );
  host._eventsRev = (host._eventsRev || 0) + 1;
}
function forgeSeasonalCards(events, { archive = false } = {}) {
  return events
    .map((event) => {
      const expired = !event.live,
        failed = event.state === "error" || event.state === "preparing";
      const action = event.hardOpen
        ? "events.enter"
        : expired || event.played >= 10
          ? "events.revisit"
          : event.played
            ? "events.continue"
            : "events.play";
      // A finished event also counts its fights won on Hard and Very Hard.
      const tiers =
        event.played >= 10
          ? ["hard", "veryhard"]
              .map(
                (difficulty) =>
                  ` \u00b7 ${forgeEventT(`events.progress.${difficulty}`)} ${Number(event[difficulty]) || 0}/${forgeSeasonalFights(event)}`,
              )
              .join("")
          : "";
      const date = new Date(event.endsAt).toLocaleString();
      const rewards = (event.rewards || [])
        .map(
          (reward) =>
            `<li>${forgeEventEscape(reward.qty)} ${forgeEventEscape(reward.name || forgeEventT(`events.reward.${reward.kind}`))}</li>`,
        )
        .join("");
      return `<article class="gf-event-card" data-story-event-card="${forgeEventEscape(event.chapter)}">${!archive && event.art ? `<div class="gf-event-art" data-story-event-banner><img src="${forgeEventEscape(event.art)}" alt="" /></div>` : ""}<h3>${forgeEventEscape(event.title || forgeEventT("events.title"))}</h3><p>${forgeEventEscape(event.theme || "")}</p><p>${forgeEventEscape(expired ? forgeEventT("events.expired") : `${forgeEventT("events.ends")} ${date}`)}</p>${failed ? `<p>${forgeEventEscape(forgeEventT("events.failed"))}</p><button type="button" class="gf-event-action" data-story-event-retry>${forgeEventT("events.retry")}</button>` : `<p>${forgeEventEscape(`${forgeEventT("events.progress")} ${event.played || 0}/10${tiers}`)}</p>${!archive ? `<h4>${forgeEventT("events.rewards")}</h4><ul class="gf-event-rewards">${rewards}</ul>` : ""}<button type="button" class="gf-event-action" data-story-event-open="${forgeEventEscape(event.chapter)}"${(!expired && !event.canStart && !event.opened) || (expired && !event.played) ? " disabled" : ""}>${forgeEventT(action)}</button>${!event.canStart && !event.opened && !expired ? `<p>${forgeEventEscape(forgeEventBoundary(event.blockedBy))}</p>` : ""}${event.mediaError ? `<p>${forgeEventT("events.mediaFailed")}</p>` : ""}`}</article>`;
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
  // The chapter list redraws whenever background work changes; only new progress in it reads the events again.
  const chapterList = host._hudView === "chapters" && host._chaptersData ? JSON.stringify(host._chaptersData) : null;
  if (
    !host._forgeSeasonalLoading &&
    (!host._forgeSeasonalState
      ? host._run.story?.seasonalEvents === true || ["chapters", "events"].includes(host._hudView)
      : // So finishing a chapter or Character Story offers the event without a reload.
        chapterList && host._forgeSeasonalChapters !== chapterList && host._run.story?.seasonalEvents === true)
  ) {
    host._forgeSeasonalChapters = chapterList;
    void loadForgeSeasonalEvents(host);
  }
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
    // The next-story choice already offers the event it shows; the archive keeps the rest.
    const archive = events.filter(
      (event) =>
        !chapters.querySelector(`[data-story-event-open="${forgeEventEscape(event.chapter)}"]`) &&
        (event.played || (event.live && event.canStart)),
    );
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
