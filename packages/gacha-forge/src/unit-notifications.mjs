// Explain the existing Home next-step dot; this is not a new unread/seen system.
export const forgeUnitNotificationEnglish = Object.freeze({
  "units.nextStep.title": "Next step: {action}",
  "units.nextStep.level": "Open a character → Stats → Level up.",
  "units.nextStep.signature": "Open the matching character → Gear → Weapon.",
  "units.nextStep.ascend": "Open the capped character → Stats → Ascend.",
  "units.nextStep.home": "Next-step recommendation: {action}. {detail}",
});

export function forgeUnitRecommendation(step) {
  if (step?.go !== "roster" || !["level", "signature", "ascend"].includes(step.id)) return null;
  return {
    title: forgeUnitNotificationEnglish["units.nextStep.title"].replace("{action}", () => step.action),
    detail: step.detail,
    hint: forgeUnitNotificationEnglish[`units.nextStep.${step.id}`],
    home: forgeUnitNotificationEnglish["units.nextStep.home"].replace(/\{(action|detail)\}/gu, (_, key) => step[key]),
  };
}

const forgeUnitNotificationStyle = `
.gf-unit-next { flex: none; margin: 0; font: var(--t-sm)/1.4 var(--body); overflow-wrap: anywhere; }
.gf-unit-next strong { color: var(--coral); }
`;

export function wireForgeUnitNotifications(host, step) {
  const root = host._root;
  const view = root.querySelector(".gf-stage > .gf-view");
  if (!view) return;
  const recommendation = forgeUnitRecommendation(step);
  const home = view.querySelector('.hm-screen [data-go="roster"]');
  if (home) {
    let dot = home.querySelector(".hm-dot");
    if (recommendation && !dot) {
      dot = document.createElement("span");
      dot.className = "hm-dot";
      dot.setAttribute("aria-hidden", "true");
      home.append(dot);
    } else if (!recommendation) dot?.remove();
    if (recommendation) {
      home.setAttribute("title", recommendation.home);
      home.dataset.forgeUnitRecommendation = "";
    } else if (Object.hasOwn(home.dataset, "forgeUnitRecommendation")) {
      home.removeAttribute("title");
      delete home.dataset.forgeUnitRecommendation;
    }
  }
  const body = view.querySelector('[data-screen="roster"] .roster-body');
  if (!body) return;
  let note = body.querySelector("[data-forge-unit-next]");
  if (!recommendation) {
    note?.remove();
    return;
  }
  if (!root.querySelector("[data-forge-unit-notification-style]")) {
    const style = document.createElement("style");
    style.dataset.forgeUnitNotificationStyle = "";
    style.textContent = forgeUnitNotificationStyle;
    root.append(style);
  }
  if (!note) {
    note = document.createElement("p");
    note.className = "gf-unit-next";
    note.dataset.forgeUnitNext = "";
    note.setAttribute("role", "note");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    note.append(title, detail);
    body.prepend(note);
  }
  note.querySelector("strong").textContent = recommendation.title;
  note.querySelector("span").textContent = ` · ${recommendation.detail}. ${recommendation.hint}`;
}

export function forgeUnitStepIsCurrent(host, runId, response) {
  return Boolean(host.isConnected && runId && host._run?.runId === runId && response?.activeRun?.runId === runId);
}

export function refreshForgeUnitStep(host, path, body, response) {
  if (
    response?.ok &&
    ["/level-up", "/ascend", "/equip"].includes(path) &&
    host.isConnected &&
    body?.runId &&
    host._run?.runId === body.runId
  ) {
    // A mutation can finish during the Home refresh. Read again after that older request settles.
    if (host._stepRefreshing) host._forgeUnitStepRefresh = body.runId;
    else host._refreshStepData();
  }
}
