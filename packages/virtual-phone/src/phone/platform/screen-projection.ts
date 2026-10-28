export interface VisibleScreenProjection {
  summary: string;
  lines: string[];
}

const clean = (value: string) => value.replace(/\s+/gu, " ").trim();

/**
 * Projects what is actually visible inside the handset viewport. It deliberately ignores DOM
 * state behind overlays, clipped accessibility copy, and content outside the current scroll view.
 */
export function projectVisibleScreen(screen: HTMLElement, summary: string): VisibleScreenProjection {
  const surface = screen.querySelector<HTMLElement>(".vp-notification-center")
    ?? screen.querySelector<HTMLElement>(".vp-appview")
    ?? screen.querySelector<HTMLElement>(".vp-lock")
    ?? screen.querySelector<HTMLElement>(".vp-home")
    ?? screen;
  const viewport = screen.getBoundingClientRect();
  const visible = (element: HTMLElement) => {
    if (element.closest('[aria-hidden="true"], .vp-sr-only, style, script')) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0
      && rect.bottom > viewport.top && rect.top < viewport.bottom
      && rect.right > viewport.left && rect.left < viewport.right;
  };
  const lines: string[] = [];
  const add = (value: string) => {
    const line = clean(value);
    if (line && lines.at(-1) !== line) lines.push(line);
  };
  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && lines.length < 80; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent && visible(parent)) add(node.textContent ?? "");
  }
  for (const control of surface.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")) {
    if (!visible(control) || !control.value.trim()) continue;
    add(control.type === "password" ? "••••••" : control.value);
  }
  for (const image of surface.querySelectorAll<HTMLImageElement>("img[alt]")) {
    if (visible(image)) add(image.alt);
  }
  return { summary: clean(summary).slice(0, 180), lines: lines.slice(0, 40) };
}
