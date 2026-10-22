// Maintained package source, inlined by the builder into the contributed bundle.
// The Engine owns Home chrome; the package only controls its own shadow root.
const forgeBrowserLayout = `
.gf-arena { padding: 0; align-items: stretch; }
.gf-stage { width: 100%; height: 100%; aspect-ratio: auto; justify-self: stretch; }
.ob-intake, .node-list, .sel-list, .vn-dock { width: 100%; max-width: none; }
/* Rotating upright must not cover the only way out of in-app fullscreen. */
.gf-rot .gf-fs-portrait {
  position: absolute; top: 0.55rem; right: 0.55rem;
  display: inline-flex; padding: 0; width: 1.9rem; height: 1.9rem;
  background: var(--ink); color: var(--text); border: 1px solid var(--steel-dark);
  clip-path: none; border-radius: 0;
}
`;
const forgeFullscreenIcons = {
  enter:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 3h6v6m0-6-7 7M9 21H3v-6m0 6 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  exit: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 14h6v6m0-6-7 7M20 10h-6V4m0 6 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const forgeFullscreenButtons = ".gf-fs, .gf-fs-exit, .gf-fs-bar";

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

export function wireForgeBrowserFullscreen(host) {
  const root = host._root;
  if (!root.querySelector("[data-forge-browser-layout]")) {
    const sheet = document.createElement("style");
    sheet.setAttribute("data-forge-browser-layout", "");
    sheet.textContent = forgeBrowserLayout;
    root.append(sheet);
  }
  const rotationNotice = root.querySelector(".gf-rot");
  if (rotationNotice && !rotationNotice.querySelector(".gf-fs-portrait")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gf-fs-exit gf-fs-portrait";
    rotationNotice.append(button);
  }
  for (const button of root.querySelectorAll(forgeFullscreenButtons)) {
    button.onclick = () => {
      const control = host.capabilityProps?.browserFullscreen;
      control?.setActive(!control.active);
    };
  }
  syncForgeBrowserPresentation(host);
}
