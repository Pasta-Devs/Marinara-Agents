// ──────────────────────────────────────────────
// Pasta Phone — bottom-sheet shell
// The enter/exit state machine is lifted from the
// Engine's ui/Modal.tsx (plain CSS transitions, no
// framer-motion, so React.StrictMode does not double
// -animate), re-anchored to the bottom of the viewport
// instead of centered. Keep the transitionend + timeout
// pair: background tabs skip transitions, and without
// the timeout fallback the overlay never unmounts.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { PASTA_PHONE_STYLES } from "./styles";
import { PhoneStatusBar } from "./PhoneStatusBar";
import { PhoneLauncher, type PastaPhoneAppId } from "./PhoneLauncher";
import { AppStoreAppScreen, ChatsAppScreen, NoodleAppScreen, NoodleRAppScreen } from "./apps";

interface PastaPhoneSheetProps {
  open: boolean;
  onClose: () => void;
}

const SCREENS: Record<PastaPhoneAppId, ComponentType<{ onBack: () => void }>> = {
  noodle: NoodleAppScreen,
  noodler: NoodleRAppScreen,
  chats: ChatsAppScreen,
  "app-store": AppStoreAppScreen,
};

export function PastaPhoneSheet({ open, onClose }: PastaPhoneSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState<"enter" | "exit" | null>(null);
  const enterRafRef = useRef<number | null>(null);
  const [screen, setScreen] = useState<"home" | PastaPhoneAppId>("home");

  useEffect(() => {
    if (enterRafRef.current !== null) {
      cancelAnimationFrame(enterRafRef.current);
      enterRafRef.current = null;
    }

    if (open) {
      setMounted(true);
      // Start the enter transition a frame later so the DOM is present.
      enterRafRef.current = requestAnimationFrame(() => setAnimating("enter"));
    } else if (mounted) {
      setAnimating("exit");
    }

    return () => {
      if (enterRafRef.current !== null) {
        cancelAnimationFrame(enterRafRef.current);
        enterRafRef.current = null;
      }
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const finishExit = () => {
    setMounted(false);
    setAnimating(null);
    setScreen("home");
  };

  // Browsers skip CSS transitions in hidden tabs, so transitionend may never
  // fire. Without this fallback the overlay stays mounted and blocks clicks.
  useEffect(() => {
    if (animating !== "exit") return;
    const timer = setTimeout(finishExit, 400);
    return () => clearTimeout(timer);
  }, [animating]);

  if (!mounted) return null;

  const isEntering = animating === "enter";
  const Screen = screen === "home" ? null : SCREENS[screen];

  // ponytail: escape + backdrop close only, no focus trap. The Engine's
  // useDialogFocusScope is not in the captured source set yet; add it when this
  // stops being a preview shell.
  return createPortal(
    <div
      ref={overlayRef}
      data-pasta-phone-overlay
      data-chat-floating-panel
      data-component="PastaPhoneSheet"
      role="dialog"
      aria-modal="true"
      aria-label="Pasta Phone"
      style={{ opacity: isEntering ? 1 : 0, transition: "opacity 150ms ease-out" }}
      onTransitionEnd={() => {
        if (animating === "exit") finishExit();
      }}
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <style data-pasta-phone-styles>{PASTA_PHONE_STYLES}</style>

      <div
        data-pasta-phone-backdrop
        style={{ opacity: isEntering ? 1 : 0, transition: "opacity 150ms ease-out" }}
      />

      <div
        data-pasta-phone-sheet
        style={{
          transform: isEntering ? "translateY(0)" : "translateY(100%)",
          transition: "transform 220ms ease-out",
        }}
      >
        <PhoneStatusBar />
        <div data-pasta-phone-screen>
          {Screen ? <Screen onBack={() => setScreen("home")} /> : <PhoneLauncher onOpenApp={setScreen} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
