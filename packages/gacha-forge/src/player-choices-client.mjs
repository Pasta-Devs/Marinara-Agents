// Maintained package source, inlined after player-choices-en.mjs by the bundle builder.
/* global forgeChoiceEnglish, forgeChoiceLabel */
const forgeChoiceSettingsLayout = `
.st-pane .gf-choice-settings-toggle {
  grid-template-columns: 44px minmax(0, 1fr); gap: 0.75rem; align-items: center; padding: 0.4rem 0.6rem;
}
.st-pane .gf-choice-settings-toggle > .ob-bx {
  width: 44px; height: 44px; min-width: 44px; min-height: 44px; padding: 0;
  display: grid; place-items: center; line-height: 1;
}
.gf-choice-settings-toggle > .ob-bx > svg { display: block; width: 20px; height: 20px; }
.st-pane .gf-choice-settings-copy { display: grid; gap: 0.3rem; min-width: 0; }
.gf-choice-settings-copy > .bd { overflow-wrap: anywhere; }
`;
const forgeChoiceLayout = `
.vn-choices {
  position: relative; z-index: 4; margin: 0 var(--sp-3) var(--sp-2);
  padding: var(--sp-2); min-width: 0; max-height: min(42cqh, 22rem); overflow-y: auto;
  background: var(--ink); border: 1px solid var(--steel-dark); border-top-color: var(--coral);
  --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel); cursor: default;
}
.vn-choice-heading, .vn-choice-status {
  margin: 0 0 0.4rem; color: var(--text); font: 600 max(12px, var(--t-xs))/1.35 var(--body);
}
.vn-choice-status { color: var(--steel-faint); margin: 0.4rem 0 0; }
.vn-choice-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.4rem; }
.vn-choice-option {
  min-width: 0; min-height: 44px; padding: 0.45rem 0.65rem; cursor: pointer;
  background: var(--ink-2); color: var(--text); border: 1px solid var(--steel-dark);
  font: 600 max(12px, var(--t-sm))/1.35 var(--body); text-align: left; overflow-wrap: anywhere;
  --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
}
.vn-choice-option:hover { border-color: var(--coral); background: color-mix(in srgb, var(--coral) 14%, var(--ink-2)); }
.vn-choice-option:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--coral); }
.vn-choice-option:disabled { opacity: 0.65; cursor: wait; }
@container (max-width: 480px) { .vn-choice-options { grid-template-columns: minmax(0, 1fr); } }
`;

function forgeChoiceEscape(value) {
  return String(value).replace(
    /[&<>"']/gu,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

export function forgeChoiceSettings(run) {
  return `<style data-forge-choice-settings-layout>${forgeChoiceSettingsLayout}</style><div class="st-plate" data-player-choice-settings><div class="hd"><h3>${forgeChoiceEnglish["settings.playerChoices.title"]}</h3></div><label class="ob-toggle gf-choice-settings-toggle"><button class="ob-bx" type="button" role="checkbox" aria-checked="${run?.story?.choices !== false}" data-forge-allow-choices aria-label="${forgeChoiceEnglish["settings.playerChoices.allow"]}"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8.4 3.1 3.1 5.9-7.3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="bt gf-choice-settings-copy"><b>${forgeChoiceEnglish["settings.playerChoices.allow"]}</b><span class="bd">${forgeChoiceEnglish["settings.playerChoices.hint"]}</span></span></label></div>`;
}

export function wireForgeChoiceSettings(root, _run, onSources) {
  const toggle = root.querySelector("[data-forge-allow-choices]");
  if (!toggle || typeof onSources !== "function") return;
  toggle.addEventListener("click", async () => {
    if (toggle.disabled) return;
    const choices = toggle.getAttribute("aria-checked") !== "true";
    toggle.disabled = true;
    toggle.setAttribute("aria-checked", String(choices));
    try {
      await onSources({ story: { choices } });
    } catch {
      toggle.setAttribute("aria-checked", String(!choices));
    } finally {
      toggle.disabled = false;
    }
  });
}

export function clearForgeChoices(host) {
  host._choicePlayback?.dispose();
  host._choicePlayback = null;
}

export function prepareForgeChoices(host, response) {
  clearForgeChoices(host);
  const mainline = Array.isArray(response?.segments) ? response.segments : [];
  const choices = (Array.isArray(response?.choices) ? response.choices : []).filter(
    (choice) =>
      choice &&
      typeof choice.id === "string" &&
      (choice.kind === "small" || choice.kind === "big") &&
      Number.isInteger(choice.at) &&
      choice.at >= 0 &&
      choice.at < mainline.length &&
      Array.isArray(choice.options) &&
      choice.options.length >= 2 &&
      choice.options.length <= 4 &&
      choice.options.every((option) => option && typeof option.id === "string" && typeof option.text === "string"),
  );
  if (!choices.length) return;
  const node = host._activeStoryNode;
  const runId = host._run?.runId;
  const plan = host._plan;
  const storyRevision = host._forgeChapterPlanVersions?.get(plan) ?? host._forgeChapterVersions?.get(runId) ?? 0;
  const bondUnit = host._bondUnit;
  const bondPart = host._bondPart;
  const canon = { ...(response.choiceCanon || {}) };
  const selected = new Map();
  for (const choice of choices) {
    if ((!node?.replay || choice.kind === "big") && choice.options.some((option) => option.id === canon[choice.id]))
      selected.set(choice.id, canon[choice.id]);
  }
  const timeline = [];
  const mainIndexes = [];
  const pendingIndexes = new Map();
  const lockedIndexes = new Map();
  let panel = null;
  let active = true;
  let busy = false;
  let resumePlayback = null;
  const isCurrent = () => active && host._activeStoryNode === node && host._run?.runId === runId && host._plan === plan;
  const rebuild = () => {
    timeline.length = 0;
    mainIndexes.length = 0;
    pendingIndexes.clear();
    lockedIndexes.clear();
    for (const [index, segment] of mainline.entries()) {
      timeline.push(segment);
      mainIndexes.push(index);
      for (const choice of choices.filter((item) => item.at === index)) {
        const option = choice.options.find((item) => item.id === selected.get(choice.id));
        if (!option) {
          pendingIndexes.set(timeline.length - 1, choice);
          continue;
        }
        timeline.push({
          // Legacy options did not distinguish actions from dialogue. Keep their saved
          // text readable as narration rather than inventing spoken words.
          speaker:
            option.selection?.kind === "dialogue"
              ? host._run?.protagonist?.name || forgeChoiceEnglish["story.choices.protagonist"]
              : "",
          text: option.selection?.text || option.text,
          ...(segment.place ? { place: segment.place } : {}),
        });
        mainIndexes.push(index);
        if (choice.kind === "big") {
          lockedIndexes.set(timeline.length - 2, option);
          lockedIndexes.set(timeline.length - 1, option);
        }
        if (choice.kind === "small") {
          for (const branch of Array.isArray(option.segments) ? option.segments : []) {
            timeline.push(branch);
            mainIndexes.push(index);
          }
        }
      }
    }
  };
  rebuild();

  const removePanel = () => {
    panel?.remove();
    panel = null;
  };
  const blocked = (index) => pendingIndexes.has(index);
  const show = (index) => {
    const root = host._root;
    if (!root.querySelector("[data-forge-choice-layout]")) {
      const style = document.createElement("style");
      style.dataset.forgeChoiceLayout = "";
      style.textContent = forgeChoiceLayout;
      root.append(style);
    }
    const choice = pendingIndexes.get(index);
    if (!choice || !isCurrent()) {
      removePanel();
      const saved = isCurrent() && lockedIndexes.get(index);
      if (saved) {
        panel = document.createElement("section");
        panel.className = "vn-choices";
        panel.dataset.forgeChoiceCanon = "";
        panel.textContent = `${forgeChoiceEnglish["story.choices.savedFate"]} ${saved.text}`;
        host._root.querySelector(".vn-dock")?.prepend(panel);
      }
      return false;
    }
    if (panel?.dataset.choiceId === choice.id) return true;
    removePanel();
    panel = document.createElement("section");
    panel.className = "vn-choices";
    panel.dataset.forgeChoices = "";
    panel.dataset.choiceId = choice.id;
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", forgeChoiceEnglish["story.choices.prompt"]);
    panel.innerHTML = `<p class="vn-choice-heading">${forgeChoiceEnglish["story.choices.prompt"]}</p>${choice.kind === "big" ? `<p class="vn-choice-heading">${forgeChoiceEnglish["story.choices.majorWarning"]}</p>` : ""}<div class="vn-choice-options">${choice.options.map((option) => `<button class="vn-choice-option" type="button" data-forge-choice-option="${forgeChoiceEscape(option.id)}">${forgeChoiceEscape(forgeChoiceLabel(option.text))}</button>`).join("")}</div><p class="vn-choice-status" data-forge-choice-error role="status" aria-live="polite" hidden></p>`;
    root.querySelector(".vn-dock")?.prepend(panel);
    const currentPanel = panel;
    const status = currentPanel.querySelector(".vn-choice-status");
    currentPanel.addEventListener("click", async (event) => {
      event.stopPropagation();
      const button = event.target.closest("[data-forge-choice-option]");
      if (!button || busy || !isCurrent()) return;
      busy = true;
      for (const item of currentPanel.querySelectorAll("button")) item.disabled = true;
      status.hidden = false;
      status.textContent = forgeChoiceEnglish["story.choices.saving"];
      let result;
      try {
        result = await host._postJson("/choice", {
          runId,
          chapter: node.chapter,
          storyIndex: node.storyIndex,
          ...(bondUnit ? { unitId: bondUnit, part: bondPart } : {}),
          ...(node.replay ? { replay: true } : {}),
          choiceId: choice.id,
          optionId: button.dataset.forgeChoiceOption,
          storyRevision,
        });
      } catch {
        result = null;
      }
      if (!isCurrent()) return;
      busy = false;
      if (result?.error === "story-changed") {
        status.textContent = forgeChoiceEnglish["story.choices.changed"];
        return;
      }
      const optionId = result?.ok
        ? result.optionId
        : result?.error === "choice-locked"
          ? result.choiceCanon?.[choice.id]
          : null;
      const option = choice.options.find((item) => item.id === optionId);
      if (!option) {
        status.textContent = forgeChoiceEnglish["story.choices.saveFailed"];
        for (const item of currentPanel.querySelectorAll("button")) item.disabled = false;
        return;
      }
      Object.assign(canon, result.choiceCanon || {});
      for (const item of choices) {
        if ((!node.replay || item.kind === "big") && item.options.some((entry) => entry.id === canon[item.id]))
          selected.set(item.id, canon[item.id]);
      }
      selected.set(choice.id, optionId);
      rebuild();
      removePanel();
      resumePlayback?.();
    });
    return true;
  };
  host._choicePlayback = {
    timeline,
    mainIndex: (index) => mainIndexes[index] ?? 0,
    startAt(mainIndex) {
      const wanted = Math.max(0, mainIndexes.indexOf(mainIndex));
      const pending = [...pendingIndexes.keys()].find((index) => index <= wanted);
      return pending ?? wanted;
    },
    blocked,
    hasPending: () => pendingIndexes.size > 0,
    show,
    skipTo(index, last) {
      return [...pendingIndexes.keys()].find((pending) => pending >= index) ?? last;
    },
    attach(callback) {
      resumePlayback = callback;
      if (!callback) removePanel();
    },
    dispose() {
      active = false;
      resumePlayback = null;
      removePanel();
    },
  };
}

export function forgeChoicePlayback(host, options) {
  const playback = host._choicePlayback;
  if (!playback) return options;
  return {
    ...options,
    segments: playback.timeline,
    startAt: playback.startAt(options.startAt),
    onAt: (index) => options.onAt?.(playback.mainIndex(index)),
    choicePlayback: playback,
  };
}
