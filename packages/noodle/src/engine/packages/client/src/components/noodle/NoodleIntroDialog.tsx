// ──────────────────────────────────────────────
// Noodle: first-run explainer
// Noodle looks like a social app, so people open it expecting one and wonder why the
// timeline stays quiet. Three lines on the first visit, then never again.
// ──────────────────────────────────────────────
import { RefreshCw, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { markNoodleIntroSeen, noodleIntroSeen } from "./noodle-intro-storage";
import { getNoodleAccentStyle, NOODLE_BLUE, NOODLE_ICON_SCOPE_CLASS, NOODLE_LOGO_SRC } from "./NoodleShell";
import { useTranslation as useUiTranslation } from "react-i18next";

/** Opens the explainer once per browser. Returns the open flag and the dismissal. */
export function useNoodleIntro(): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!noodleIntroSeen()) setOpen(true);
  }, []);
  const dismiss = () => {
    setOpen(false);
    markNoodleIntroSeen();
  };
  return [open, dismiss];
}

export function NoodleIntroDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const points = [
    { icon: <Users size={18} />, key: "cast" },
    { icon: <RefreshCw size={18} />, key: "refresh" },
    { icon: <Sparkles size={18} />, key: "local" },
  ] as const;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.noodle.noodleintro.title")}
      width="max-w-md"
      panelClassName={NOODLE_ICON_SCOPE_CLASS}
      panelStyle={getNoodleAccentStyle(NOODLE_BLUE)}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-xl border border-[var(--noodle-accent)]/25 bg-[var(--noodle-accent)]/10 p-4">
          <img src={NOODLE_LOGO_SRC} alt="" className="h-16 w-auto shrink-0 object-contain" />
          <p className="text-sm font-semibold leading-6">{localizeUi("ui.noodle.noodleintro.lead")}</p>
        </div>
        <ul className="space-y-3">
          {points.map((point) => (
            <li key={point.key} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-[var(--noodle-accent)]">{point.icon}</span>
              <div>
                <p className="text-sm font-bold">{localizeUi(`ui.noodle.noodleintro.${point.key}.title`)}</p>
                <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                  {localizeUi(`ui.noodle.noodleintro.${point.key}.detail`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 w-full rounded-full bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
        >
          {localizeUi("ui.noodle.noodleintro.start")}
        </button>
      </div>
    </Modal>
  );
}
