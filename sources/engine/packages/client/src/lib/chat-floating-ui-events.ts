export const CHAT_FLOATING_UI_DISMISS_EVENT = "marinara:chat-floating-ui-dismiss";

export function announceChatFloatingUiDismiss() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHAT_FLOATING_UI_DISMISS_EVENT));
}

export function isDesktopShellNavigationTarget(target: EventTarget | null) {
  if (typeof window === "undefined" || window.matchMedia("(max-width: 767px)").matches) return false;
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return Boolean(element?.closest('[data-component="TopBar"]'));
}
