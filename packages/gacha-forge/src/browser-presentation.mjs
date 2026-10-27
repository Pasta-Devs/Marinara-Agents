// Maintained package source, inlined by the builder into the contributed bundle.
// The Engine owns Home chrome; the package only controls its own shadow root.
const forgeBrowserLayout = `
.gf-arena { padding: 0; align-items: stretch; }
.gf-stage { width: 100%; height: 100%; aspect-ratio: auto; justify-self: stretch; }
.ob-intake, .node-list, .sel-list, .vn-dock { width: 100%; max-width: none; }
/* Keep reward cards out of the Claim footer when the welcome artwork leaves little height. */
.ev-pane.nw { overflow-y: auto; }
.ev-pane.nw .nw-track { flex-shrink: 0; min-height: min-content; }
.ev-pane.nw .ev-week { flex-shrink: 0; grid-auto-rows: minmax(min-content, 1fr); }
.ev-pane > .ev-week { flex-shrink: 0; min-height: min-content; }
.ev-foot { flex-wrap: wrap; padding-top: var(--sp-2); }
.ev-foot .ev-claim { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.forge-material { appearance: none; background: none; border: 0; color: inherit; font: inherit; text-align: left; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: .15em; }
.forge-material:focus-visible { outline: 2px solid var(--coral); outline-offset: 2px; }
.gw-acts { flex-wrap: wrap; }
.gf-arena .gf-stage .ob-labelrow:has(.ob-help[aria-expanded="true"]):has(.ob-tip:not([popover])) { flex-wrap: wrap; }
.gf-arena .gf-stage .ob-labelrow:has(.ob-help[aria-expanded="true"]) .ob-tip:not([popover]) {
  position: static; flex-basis: 100%; order: 1; opacity: 1; visibility: visible;
  max-height: 40cqh; overflow-y: auto; pointer-events: auto;
  font-size: max(12px, var(--t-xs)); line-height: 1.5;
}
.gf-arena .gf-stage .ob-tip[popover] {
  position: fixed; inset: auto; margin: 0; box-sizing: border-box;
  width: min(42rem, calc(100dvw - 24px)); max-height: calc(100dvh - 24px);
  overflow: auto; overscroll-behavior: contain; overflow-wrap: anywhere;
  font-size: max(12px, var(--t-xs)); line-height: 1.5;
}
.gf-arena .gf-stage .ob-tip[popover]:popover-open { opacity: 1; visibility: visible; pointer-events: auto; }
@media (any-pointer: coarse), (pointer: coarse) {
  .ev-pane.nw .ev-claim { min-height: 44px; }
  /* Touch disclosures follow their click state, rather than Safari's sticky hover. */
  .gf-arena .gf-stage .ob-labelrow:has(.ob-help[aria-expanded="false"]) .ob-tip:not([popover]) { opacity: 0; visibility: hidden; pointer-events: none; }
}
/* Portrait artwork leaves the same accent stroke at the foot as at its top. */
/* Home and chapter sheets are loaded lazily, so keep this ahead of their inset shorthand. */
.gf-stage .hm-plate, .gf-stage .vn-plate[data-side] { padding-bottom: var(--edge-w); }
.gf-stage .hm-art, .gf-stage .vn-plate[data-side] .vn-art { bottom: var(--edge-w); }
/* SVG fallbacks and author-styled images must both honor the portrait's hidden state. */
.vn-art > [hidden] { display: none !important; }
.gf-mute { display: inline-grid; place-items: center; padding: 0; cursor: pointer; }
.gf-mute svg { display: block; width: 1em; height: 1em; }
.gf-mute:focus-visible { outline: 2px solid var(--coral); outline-offset: -3px; }
.gf-mute.gf-mute-chapter {
  position: absolute; top: 50%; right: 44px; transform: translateY(-50%);
  width: 44px; height: 44px; border: 0; background: transparent; color: var(--text);
  font-size: 0.9rem; box-shadow: none; clip-path: none;
}
.vn-top:has(.gf-mute-chapter) { padding-right: 88px; }
/* Matches the fullscreen button beside it. */
.gf-stage > .gf-mute, .gf-rot > .gf-mute {
  position: absolute; z-index: 9; top: 0.55rem; right: 3rem;
  width: 1.9rem; height: 1.9rem; background: color-mix(in srgb, var(--ink) 66%, transparent); color: var(--text);
  border: 1px solid var(--steel-dark); clip-path: none;
}
.gf-stage > .gf-mute:hover, .gf-rot > .gf-mute:hover {
  border-color: var(--coral); color: color-mix(in srgb, var(--coral) 78%, #FFFFFF);
}
.gf-audio-status {
  position: absolute; z-index: 8; inset: 3.5rem 0.75rem auto auto; max-width: min(36ch, calc(100% - 1.5rem)); padding: 0.5rem 0.75rem;
  background: var(--ink); color: var(--text); border: 1px solid var(--steel-dark);
  font: max(12px, var(--t-xs))/1.4 var(--body); overflow-wrap: anywhere;
  max-height: calc(100% - 4.25rem); overflow: auto; pointer-events: none;
}
/* Chapter artwork keeps a small icon in its header fade, with a full touch target. */
.vn-top:has(> .gf-fs-chapter) { min-height: 44px; }
.gf-fs-exit.gf-fs-chapter {
  top: 50%; right: 0; transform: translateY(-50%);
  width: 44px; height: 44px; padding: 0;
  background: transparent; border: 0; box-shadow: none; clip-path: none;
}
.gf-fs-chapter svg { width: 0.9rem; height: 0.9rem; }
.gf-fs-chapter:focus-visible { outline: 2px solid var(--coral); outline-offset: -4px; }
.cp-id-top .cp-fav, .cp-tabs > .sv-q {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; padding: 0; line-height: 1;
}
.u-fav { display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
.cp-fav svg, .cp-tabs > .sv-q svg, .u-fav svg { display: block; flex: none; margin: 0; }
/* Help marks sit on their title's centre line; an icon-only button's baseline is its bottom edge. */
.gf-arena .gf-guide-q.sv-q {
  appearance: none; align-self: center; align-items: center; justify-content: center; padding: 0; line-height: 1;
}
.gf-arena .gf-guide-q.sv-q svg { display: block; flex: none; margin: 0; }
/* Letters use the whole screen below the stats bar. */
.hm-pk.chat { width: 100%; height: 100%; clip-path: none; border-radius: 0; border-width: 2px 0 0; }
.u-type {
  position: absolute; top: calc(var(--f) * 0.3); right: calc(var(--f) * 0.4); z-index: 1;
  display: grid; place-items: center; width: 1em; height: 1em;
  font-size: calc(var(--f) * 1.65); color: var(--text); pointer-events: none;
  filter: drop-shadow(0 1px 2px var(--ink));
}
.u-type svg { display: block; width: 1em; height: 1em; }
/* Rotating upright must not cover the only way out of in-app fullscreen. */
.gf-rot .gf-fs-portrait {
  position: absolute; top: 0.55rem; right: 0.55rem;
  display: inline-flex; padding: 0; width: 1.9rem; height: 1.9rem;
  background: var(--ink); color: var(--text); border: 1px solid var(--steel-dark);
  clip-path: none; border-radius: 0;
}
/* Scene artwork starts below the story controls, including both crossfade layers. */
.gf-stage > .gf-view .vn-scene { top: var(--forge-scene-top, 0px); }
.gf-stage > .gf-view .vn-bg { background-position: center top; }
.gf-stage > .gf-view .vn-scene::before { display: none; }
/* A phone keyboard can leave less room than the picker header and composer.
   Query the package's actual height, which already follows the Engine viewport.
   Keep this stable when Send takes focus; Safari may blur the textarea before its tap. */
@container gfarena (max-height: 280px) {
  .gf-stage[data-forge-editing] > .gf-bar,
  .gf-stage:has(.ob-xv) > .gf-bar,
  .gf-arena:has(.gf-stage[data-forge-editing], .ob-xv) > .gf-rot { display: none; }
  .gf-stage[data-forge-editing] .screen .body { padding: 4px; gap: 8px; }
  .gf-stage[data-forge-editing] .st-plate { padding: 4px; }
  .gf-stage[data-forge-editing] textarea.ob-control:focus {
    min-height: 44px; height: min(105px, var(--forge-editor-height)); max-height: var(--forge-editor-height);
  }
  /* Put Close beside the text, rather than spending the keyboard's last line on a title row. */
  .ob-xv { padding: 0 4px; }
  .ob-xm:has(> .ob-xta) {
    height: 100%; padding: 4px; gap: 4px; display: grid;
    grid-template-columns: minmax(0, 1fr) 44px; grid-template-rows: minmax(0, 1fr);
  }
  /* Safari restores host chrome on blur: keep Close on the unchanged bottom edge until click. */
  .ob-xm:has(> .ob-xta) .ob-xh { grid-column: 2; grid-row: 1; flex-direction: column; justify-content: flex-end; gap: 4px; }
  .ob-xm:has(> .ob-xta) .ob-xh h2 {
    position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
  .ob-xm:has(> .ob-xta) .ob-count { order: -1; margin: 0; font-size: 10px; }
  .ob-xm:has(> .ob-xta) .ob-xclose { width: 44px; height: 44px; margin: 0; }
  .ob-xm > .ob-xta { grid-column: 1; grid-row: 1; height: 100%; padding: 4px; }

  .gf-stage:has(.hm-pk.chat .ch-box) > .gf-bar,
  .gf-arena:has(.hm-pk.chat .ch-box) > .gf-rot { display: none; }
  .hm-pk.chat:has(.ch-box) { width: 100%; height: 100%; clip-path: none; border-radius: 0; }
  .hm-pk.chat:has(.ch-box) .hm-pk-head { padding: 4px 8px; gap: 8px; }
  .hm-pk.chat:has(.ch-box) .hm-pk-head .ttl { font-size: var(--t-sm); }
  .hm-pk.chat:has(.ch-box) :is(.hm-pk-head .cur, .ch-list, .ch-who) { display: none; }
  .hm-pk.chat:has(.ch-box) .hm-pk-body { grid-template-columns: minmax(0, 1fr); }
  .hm-pk.chat:has(.ch-box) .ch-col { grid-template-rows: minmax(0, 1fr) auto auto; overflow-y: auto; }
  .hm-pk.chat:has(.ch-box) .ch-log { padding: 4px 8px; }
  .hm-pk.chat:has(.ch-box) .ch-foot {
    grid-template-columns: minmax(0, 1fr) auto; align-items: start; padding: 4px 8px; gap: 8px;
  }
  .hm-pk.chat:has(.ch-box) .ch-box { height: 44px; min-height: 44px; font-size: max(16px, var(--t-sm)); }
  .hm-pk.chat:has(.ch-box) .ch-acts { align-items: stretch; }
  .hm-pk.chat:has(.ch-box) .ch-btn:not(.go) { display: none; }
  .hm-pk.chat:has(.ch-box) .ch-btn.go { min-height: 44px; margin: 0; white-space: nowrap; }
}
@container gfarena (max-height: 80px) {
  .ob-xm:has(> .ob-xta) .ob-count { display: none; }
}
`;

export function forgeUserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
const forgeFullscreenIcons = {
  enter:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 3h6v6m0-6-7 7M9 21H3v-6m0 6 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  exit: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 14h6v6m0-6-7 7M20 10h-6V4m0 6 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const forgeFullscreenButtons = ".gf-fs, .gf-fs-exit, .gf-fs-bar";

function wireForgeFieldHelp(host) {
  const root = host._root;
  const scope = JSON.stringify([host._run?.runId, host._hudView, host._settingsCategory]);
  if (host._forgeFieldHelp?.scope !== scope) {
    host._forgeFieldHelp?.close?.();
    host._forgeFieldHelp = { scope, open: "" };
  }
  const state = host._forgeFieldHelp;
  const isPopoverOpen = (tip) => typeof tip?.showPopover === "function" && tip.matches(":popover-open");
  const cancel = () => clearTimeout(state.timer);
  const close = (restoreFocus = false) => {
    cancel();
    const { tip, button } = state;
    state.open = "";
    state.pinned = false;
    state.tip = null;
    button?.setAttribute("aria-expanded", "false");
    if (isPopoverOpen(tip)) tip.hidePopover();
    if (restoreFocus && button?.isConnected) {
      state.suppressFocus = button;
      button.focus({ preventScroll: true });
      state.suppressFocus = null;
    }
  };
  state.close = close;
  state.position = () => {
    const { tip, button } = state;
    if (!isPopoverOpen(tip)) return;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    tip.style.width = `${Math.min(672, Math.max(0, width - 24))}px`;
    tip.style.maxHeight = `${Math.max(0, Math.min(height - 24, height * 0.7))}px`;
    const anchor = button.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const clamp = (value, start, end) => Math.max(start, Math.min(value, Math.max(start, end)));
    const below = anchor.bottom + 6;
    const y = below + box.height <= top + height - 12 ? below : anchor.top - box.height - 6;
    tip.style.left = `${clamp(anchor.left, left + 12, left + width - box.width - 12)}px`;
    tip.style.top = `${clamp(y, top + 12, top + height - box.height - 12)}px`;
  };
  const open = (button, tip, field, pinned) => {
    cancel();
    if (state.tip !== tip) close();
    Object.assign(state, { tip, button, open: field, pinned });
    button.setAttribute("aria-expanded", "true");
    if (typeof tip.showPopover === "function" && !isPopoverOpen(tip)) tip.showPopover();
    state.position();
  };
  let restored = false;
  for (const [index, button] of [...root.querySelectorAll(".ob-help")].entries()) {
    const row = button.closest(".ob-labelrow");
    const tip = row?.querySelector(".ob-tip");
    if (!tip) continue;
    const field = row.querySelector("label")?.getAttribute("for") || button.getAttribute("aria-label");
    tip.id ||= `forge-field-help-${index}`;
    if (typeof tip.showPopover === "function") {
      tip.setAttribute("popover", "auto");
      button.setAttribute("popovertarget", tip.id);
    }
    tip.tabIndex = 0;
    button.setAttribute("aria-controls", tip.id);
    button.setAttribute("aria-describedby", tip.id);
    button.setAttribute("aria-expanded", String(state.open === field));
    const leaveFocus = (event) => {
      if (event.relatedTarget === button || tip.contains(event.relatedTarget)) return;
      queueMicrotask(() => {
        const active = root.activeElement;
        if (state.tip === tip && active !== button && !tip.contains(active)) close();
      });
    };
    const leavePointer = () => {
      cancel();
      if (!state.pinned)
        state.timer = setTimeout(() => {
          if (root.activeElement !== button && !tip.contains(root.activeElement) && !tip.matches(":hover")) close();
        }, 120);
    };
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.tip === tip && state.pinned) close();
      else open(button, tip, field, true);
    };
    button.onfocus = () => {
      if (state.suppressFocus !== button) open(button, tip, field, state.tip === tip && state.pinned);
    };
    button.onblur = tip.onfocusout = leaveFocus;
    button.onmouseenter = () => {
      if (!state.pinned && window.matchMedia("(hover: hover) and (pointer: fine)").matches)
        open(button, tip, field, false);
    };
    button.onmouseleave = tip.onmouseleave = leavePointer;
    tip.onmouseenter = cancel;
    button.onkeydown = tip.onkeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      } else if (event.key === "ArrowDown" && event.currentTarget === button && state.tip === tip) {
        event.preventDefault();
        tip.focus({ preventScroll: true });
      }
    };
    tip.ontoggle = () => {
      if (state.tip === tip && !isPopoverOpen(tip)) close();
    };
    tip.onbeforetoggle = (event) => {
      // Light dismissal precedes the outside control's click, which may synchronously rebind the view.
      if (event.newState === "closed" && state.tip === tip) {
        cancel();
        state.open = "";
        state.pinned = false;
        state.tip = null;
        button.setAttribute("aria-expanded", "false");
      }
    };
    if (state.open === field) {
      restored = true;
      open(button, tip, field, state.pinned);
    }
  }
  if (state.open && !restored) close();
}

export function bindForgeExpandedEditor(root, popup, targetId, field, rebind) {
  const host = root.host;
  if (host._lastScreen !== "settings") return;
  // List/book popups move their source DOM and have a different lifetime; retain only text editors.
  popup._forgeEditor = {
    runId: host._run?.runId,
    screen: host._lastScreen,
    category: host._settingsCategory,
    targetId,
    field,
    rebind,
  };
}

export function captureForgeExpandedEditor(host, screen) {
  const popup = host._root.querySelector(".ob-xv");
  const editor = popup?._forgeEditor;
  if (
    !editor ||
    editor.screen !== "settings" ||
    editor.runId !== host._run?.runId ||
    editor.screen !== screen ||
    editor.category !== host._settingsCategory
  )
    return null;
  const field = editor.field;
  return {
    popup,
    active: popup.contains(host._root.activeElement) ? host._root.activeElement : null,
    start: field.selectionStart,
    end: field.selectionEnd,
    direction: field.selectionDirection,
    scrollTop: field.scrollTop,
  };
}

export function restoreForgeExpandedEditor(host, saved) {
  if (!saved) return;
  const root = host._root;
  const editor = saved.popup._forgeEditor;
  const stage = root.querySelector(".gf-stage");
  const source = root.getElementById(editor.targetId);
  const trigger = [...root.querySelectorAll("[data-expand]")].find(
    (button) => button.getAttribute("data-expand") === editor.targetId,
  );
  if (!stage || source?.tagName !== "TEXTAREA" || !trigger) return;
  editor.rebind(source, trigger);
  source.value = editor.field.value;
  source.dispatchEvent(new Event("input", { bubbles: true }));
  stage.appendChild(saved.popup);
  saved.active?.focus({ preventScroll: true });
  editor.field.setSelectionRange(saved.start, saved.end, saved.direction);
  editor.field.scrollTop = saved.scrollTop;
}

export function forgeUnitTypeBadge(unit, icons) {
  const key = String(unit.affinity ?? "")
    .trim()
    .toLowerCase();
  if (!Object.hasOwn(icons, key)) return "";
  const name = key[0].toUpperCase() + key.slice(1);
  return `<span class="u-type" role="img" aria-label="${name}" title="${name}">${icons[key]}</span>`;
}

export function syncForgeBrowserPresentation(host) {
  const control = host.capabilityProps?.browserFullscreen;
  if (!control) return;
  const active = control.active === true;
  for (const button of host._root.querySelectorAll(forgeFullscreenButtons)) {
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? control.exitLabel : control.enterLabel);
    button.title = active ? control.exitLabel : control.enterLabel;
    button.innerHTML = forgeFullscreenIcons[active ? "exit" : "enter"];
  }
}

// Background work starting or ending updates only its chip. Redrawing the screen for it would restart a story
// scene with Auto off, restart a fight, and drop a half-made Formation move.
export function syncForgeBusyChip(host, key, html) {
  if (host._busyChipKey === key) return;
  const view = host._root.querySelector(".gf-stage")?.querySelector(":scope > .gf-view");
  if (!view) return;
  host._busyChipKey = key;
  const chip = view.querySelector(":scope > [data-busy]");
  const markup = key ? html() : "";
  if (!markup) return void chip?.remove();
  if (!chip) return void view.insertAdjacentHTML("beforeend", markup);
  const next = document.createElement("div");
  next.innerHTML = markup;
  chip.replaceChildren(...next.firstElementChild.childNodes);
}

export function wireForgeBrowserFullscreen(host) {
  const root = host._root;
  if (!root.querySelector("[data-forge-browser-layout]")) {
    const sheet = document.createElement("style");
    sheet.setAttribute("data-forge-browser-layout", "");
    sheet.textContent = forgeBrowserLayout;
    root.append(sheet);
  }
  // Only the visible roster page loads immediately; offscreen cards keep native lazy loading.
  const roster = root.querySelector('[data-screen="roster"] .grid-scroll');
  if (roster) {
    const viewport = roster.getBoundingClientRect();
    for (const image of roster.querySelectorAll(".u-photo")) {
      const box = image.getBoundingClientRect();
      if (
        box.bottom > viewport.top &&
        box.top < viewport.bottom &&
        box.right > viewport.left &&
        box.left < viewport.right
      ) {
        image.loading = "eager";
        image.decoding = "sync";
      }
    }
  }
  const rotationNotice = root.querySelector(".gf-rot");
  if (rotationNotice && !rotationNotice.querySelector(".gf-fs-portrait")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gf-fs-exit gf-fs-portrait";
    rotationNotice.append(button);
  }
  const chapterHeader = root.querySelector(".vn-top");
  const chapterToggle = root.querySelector(".gf-stage > .gf-fs-exit, .vn-top > .gf-fs-chapter");
  if (chapterHeader && chapterToggle) {
    chapterToggle.classList.add("gf-fs-chapter");
    if (chapterToggle.parentElement !== chapterHeader) chapterHeader.append(chapterToggle);
  }
  for (const button of root.querySelectorAll(forgeFullscreenButtons)) {
    button.onclick = (event) => {
      event.stopPropagation();
      const control = host.capabilityProps?.browserFullscreen;
      control?.setActive(!control.active);
    };
  }
  wireForgeFieldHelp(host);
  syncForgeBrowserPresentation(host);
  wireForgeViewportPresentation(host);
}

// A frame must never roll back in with a previous speaker still in either image buffer.
export function setForgeStoryPortrait(plate, character) {
  if (!plate) return;
  const url = typeof character?.art === "string" ? character.art : "";
  const neutral = typeof character?.neutral === "string" ? character.neutral : "";
  plate.forgeStoryArt = url;
  for (const layer of plate.querySelectorAll("[data-art]")) {
    if (!layer) continue;
    const image = layer.querySelector("[data-img]");
    const figure = layer.querySelector("[data-figure]");
    if (image) {
      // Clearing first prevents an undecoded replacement from exposing the previous bitmap.
      image.hidden = true;
      image.removeAttribute("src");
      if (url) {
        image.onload = () => {
          if (image.getAttribute("src") === url) image.hidden = false;
        };
        image.onerror = () => {
          if (image.getAttribute("src") !== url) return;
          // A missing expression image falls back to the neutral portrait before the silhouette.
          if (neutral && neutral !== url && plate.forgeStoryArt === url)
            return setForgeStoryPortrait(plate, { ...character, art: neutral, neutral: "" });
          if (figure) figure.removeAttribute("hidden");
        };
        image.setAttribute("src", url);
        if (image.complete && image.naturalWidth > 0) image.hidden = false;
      }
    }
    // SVGElement does not reflect the HTML-only hidden property into an attribute.
    if (figure) figure.toggleAttribute("hidden", !!url);
  }
  plate.setAttribute("data-front", "a");
}

// The same speaker changed expression: decode the new face in the hidden layer, then bring it to the
// front, so the plate never blanks between two faces. A face that fails to load leaves the neutral one.
export function showForgeStoryExpression(plate, character) {
  if (!plate) return;
  const url = typeof character?.art === "string" ? character.art : "";
  const front = plate.getAttribute("data-front") === "b" ? "b" : "a";
  const shown = plate.querySelector(`[data-art="${front}"] [data-img]`);
  if (url && shown && !shown.hidden && shown.getAttribute("src") === url) {
    plate.forgeStoryArt = url; // also drops a swap still decoding
    return;
  }
  const layer = plate.querySelector(`[data-art="${front === "a" ? "b" : "a"}"]`);
  const image = layer?.querySelector("[data-img]");
  if (!url || !image) return setForgeStoryPortrait(plate, character);
  plate.forgeStoryArt = url;
  image.onload = () => {
    if (plate.forgeStoryArt !== url || image.getAttribute("src") !== url) return;
    image.hidden = false;
    layer.querySelector("[data-figure]")?.toggleAttribute("hidden", true);
    plate.setAttribute("data-front", layer.getAttribute("data-art"));
  };
  image.onerror = () => {
    if (plate.forgeStoryArt !== url || image.getAttribute("src") !== url) return;
    const neutral = typeof character.neutral === "string" ? character.neutral : "";
    if (neutral && neutral !== url) showForgeStoryExpression(plate, { ...character, art: neutral, neutral: "" });
  };
  image.setAttribute("src", url);
  if (image.complete && image.naturalWidth > 0) image.onload();
}

function wireForgeViewportPresentation(host) {
  host._stopForgeBrowserPresentation?.();
  const root = host._root;
  const arena = root.querySelector(".gf-arena");
  const stage = root.querySelector(".gf-stage");
  const view = root.querySelector(".gf-stage > .gf-view");
  const header = view?.querySelector(".vn-top");
  if (!arena || !stage) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    host._forgeFieldHelp?.position?.();
    if (header) view.style.setProperty("--forge-scene-top", `${header.offsetHeight}px`);
    const field = root.activeElement;
    const editing = field?.matches(
      'textarea, input:not([type="range"], [type="checkbox"], [type="radio"], [type="file"], [type="color"], [type="button"], [type="submit"]), [contenteditable="true"]',
    );
    stage.toggleAttribute("data-forge-editing", !!editing);
    stage.style.setProperty("--forge-editor-height", `${Math.max(44, stage.clientHeight - 16)}px`);
    if (!editing) return;
    // Scroll only package-owned panels. The Engine cannot see the field through this shadow root.
    // ponytail: reveal the field; native textarea scrolling keeps its caret inside the resized field.
    // A future rich-text editor would need its own selection/caret measurement.
    for (let area = field.parentElement; area && area !== root; area = area.parentElement) {
      if (area.scrollHeight <= area.clientHeight || !/auto|scroll/.test(getComputedStyle(area).overflowY)) continue;
      const panel = area.getBoundingClientRect();
      const visible = stage.getBoundingClientRect();
      const top = Math.max(panel.top + area.clientTop, visible.top) + 4;
      const bottom = Math.min(panel.top + area.clientTop + area.clientHeight, visible.bottom) - 4;
      const box = field.getBoundingClientRect();
      if (box.top < top) area.scrollTop += box.top - top;
      else if (box.bottom > bottom) area.scrollTop += box.bottom - bottom;
    }
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(arena);
  resize.observe(stage);
  if (header) resize.observe(header);
  root.addEventListener("focusin", schedule);
  root.addEventListener("focusout", schedule);
  root.addEventListener("scroll", schedule, true);
  host._stopForgeBrowserPresentation = () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    root.removeEventListener("focusin", schedule);
    root.removeEventListener("focusout", schedule);
    root.removeEventListener("scroll", schedule, true);
    host._stopForgeBrowserPresentation = null;
  };
  update();
}
