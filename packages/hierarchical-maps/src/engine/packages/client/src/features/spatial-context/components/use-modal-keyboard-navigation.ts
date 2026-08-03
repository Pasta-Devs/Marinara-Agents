import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalKeyboardNavigation<
  TDialog extends HTMLElement,
  TInitialFocus extends HTMLElement,
>(options: {
  dialogRef: RefObject<TDialog | null>;
  initialFocusRef: RefObject<TInitialFocus | null>;
  open: boolean;
  disabled?: boolean;
  onEscape: () => void;
}) {
  const onEscapeRef = useRef(options.onEscape);
  const disabledRef = useRef(options.disabled);

  useEffect(() => {
    onEscapeRef.current = options.onEscape;
  }, [options.onEscape]);

  useLayoutEffect(() => {
    disabledRef.current = options.disabled;
  }, [options.disabled]);

  useEffect(() => {
    if (!options.open) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusFrame = window.requestAnimationFrame(() =>
      options.initialFocusRef.current?.focus(),
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disabledRef.current) {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        options.dialogRef.current?.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR,
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !options.dialogRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !options.dialogRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [
    options.dialogRef,
    options.initialFocusRef,
    options.open,
  ]);
}
