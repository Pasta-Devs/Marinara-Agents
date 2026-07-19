// ──────────────────────────────────────────────
// Pasta Phone — bottom-sheet shell
// Forked from Modal.tsx's enter/exit animation state
// machine (plain CSS transitions, no framer-motion),
// anchored to the bottom of the viewport instead of centered.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PhoneStatusBar } from "./PhoneStatusBar";
import { PhoneLauncher, type PastaPhoneAppId } from "./PhoneLauncher";
import { NoodleAppScreen } from "./apps/NoodleAppScreen";
import { NoodleRAppScreen } from "./apps/NoodleRAppScreen";
import { ChatsAppScreen } from "./apps/ChatsAppScreen";
import { AppStoreAppScreen } from "./apps/AppStoreAppScreen";

interface PastaPhoneSheetProps {
  open: boolean;
  onClose: () => void;
}

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
      enterRafRef.current = requestAnimationFrame(() => {
        setAnimating("enter");
      });
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleAnimationEnd = () => {
    if (animating === "exit") {
      setMounted(false);
      setAnimating(null);
      setScreen("home");
    }
  };

  useEffect(() => {
    if (animating !== "exit") return;
    const timer = setTimeout(() => {
      setMounted(false);
      setAnimating(null);
      setScreen("home");
    }, 400);
    return () => clearTimeout(timer);
  }, [animating]);

  if (!mounted) return null;

  const isEntering = animating === "enter";

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pasta Phone"
      data-chat-floating-panel
      data-component="PastaPhoneSheet"
      className="fixed inset-0 z-[10000] flex items-end justify-center p-0 sm:p-4"
      style={{ opacity: isEntering ? 1 : 0, transition: "opacity 150ms ease-out" }}
      onTransitionEnd={handleAnimationEnd}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        style={{ opacity: isEntering ? 1 : 0, transition: "opacity 150ms ease-out" }}
      />

      <div
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl shadow-black/40 sm:rounded-3xl"
        style={{
          height: "min(38rem, 88dvh)",
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: isEntering ? "translateY(0)" : "translateY(100%)",
          transition: "transform 220ms ease-out",
        }}
      >
        <PhoneStatusBar />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {screen === "home" ? (
            <PhoneLauncher onOpenApp={setScreen} />
          ) : screen === "noodle" ? (
            <NoodleAppScreen onBack={() => setScreen("home")} />
          ) : screen === "noodler" ? (
            <NoodleRAppScreen onBack={() => setScreen("home")} />
          ) : screen === "chats" ? (
            <ChatsAppScreen onBack={() => setScreen("home")} />
          ) : (
            <AppStoreAppScreen onBack={() => setScreen("home")} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
