import { useState } from "react";
import { newRequestId } from "../../base/state/slp-request-id";
import { useTranslation } from "react-i18next";
import { focusRing } from "../../base/chrome/slp-focus";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import type { SlpStirView } from "../../../../../shared/src/slp/slp-stir.js";
import { Choice, CreatorPicker } from "./SlpStirFormParts";
import { useSlurpStirLive } from "./slp-stir-hooks";
import { SLP_LIVE_STYLES } from "../../modules/live/slp-live-styles";

const inputClass = `min-h-11 w-full rounded-xl bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm ${focusRing}`;

export function SlpStirGoLive({
  creators,
  onOpenLive,
}: {
  creators: SlpStirView["creators"];
  onOpenLive?: (showId: string) => void;
}) {
  const { t } = useTranslation();
  const goLive = useSlurpStirLive();
  const [open, setOpen] = useState(false);
  const [creator, setCreator] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [minutes, setMinutes] = useState<20 | 30 | 40>(20);
  const [mode, setMode] = useState<"text" | "pictures">("text");
  const [error, setError] = useState("");
  const [scheduled, setScheduled] = useState(false);
  const [requestId, setRequestId] = useState(() => newRequestId());
  const submit = () => {
    const later = when === "later" ? new Date(at) : null;
    if (later && (!Number.isFinite(later.getTime()) || later.getTime() <= Date.now())) {
      setError(t("ui.slurp.stir.goLiveTimeError"));
      return;
    }
    setError("");
    goLive.mutate(
      {
        creatorAccountId: creator,
        when: later ? later.toISOString() : "now",
        minutes,
        mode,
        requestId,
      },
      {
        onSuccess: ({ show, started }) => {
          setRequestId(newRequestId());
          setOpen(false);
          if (started) onOpenLive?.(show.id);
          else setScheduled(true);
        },
        onError: (failure) => setError(errorMessage(failure)),
      },
    );
  };
  return (
    <>
      <style>{SLP_LIVE_STYLES}</style>
      <button
        type="button"
        aria-expanded={open}
        className="relative isolate flex min-h-16 w-full items-center gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--noodle-accent)_85%,black),color-mix(in_srgb,var(--slurp-violet)_80%,black))] p-3.5 text-start text-white shadow-[0_8px_28px_color-mix(in_srgb,var(--noodle-accent)_35%,transparent)] transition-transform active:scale-[0.98]"
        onClick={() => {
          setOpen((value) => !value);
          setScheduled(false);
          setError("");
        }}
      >
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-black tracking-wide shadow-[0_0_16px_rgb(220_38_38/0.6)]">
          <span className="slp-live-dot h-2 w-2 rounded-full bg-white" />
          {t("ui.slurp.live.badge")}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-base">{t("ui.slurp.stir.goLive")}</b>
          <span className="block text-xs text-white/80">{t("ui.slurp.stir.goLiveHint")}</span>
        </span>
        <span aria-hidden="true" className={`text-xl transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
      </button>
      {open && (
        <div className="space-y-3 rounded-2xl bg-[var(--slurp-canvas)] p-3.5 ring-1 ring-[color-mix(in_srgb,var(--noodle-accent)_40%,transparent)]">
          <CreatorPicker
            creators={creators.filter((item) => !item.couplePage && item.automatic)}
            picked={creator ? [creator] : []}
            onPick={(ids) => setCreator(ids[0] ?? "")}
            max={1}
            label={t("ui.slurp.stir.goLiveCreator")}
          />
          <Choice
            label={t("ui.slurp.stir.goLiveWhen")}
            value={when}
            onChange={(value) => setWhen(value as "now" | "later")}
            options={[
              { value: "now", label: t("ui.slurp.stir.now") },
              { value: "later", label: t("ui.slurp.stir.later") },
            ]}
          />
          {when === "later" && (
            <input
              type="datetime-local"
              aria-label={t("ui.slurp.stir.goLiveWhen")}
              value={at}
              onChange={(event) => setAt(event.target.value)}
              className={inputClass}
            />
          )}
          <Choice
            label={t("ui.slurp.stir.goLiveLength")}
            value={String(minutes)}
            onChange={(value) => setMinutes(Number(value) as 20 | 30 | 40)}
            options={[20, 30, 40].map((value) => ({ value: String(value), label: `${value} min` }))}
          />
          <Choice
            label={t("ui.slurp.stir.goLiveMode")}
            value={mode}
            onChange={(value) => setMode(value as "text" | "pictures")}
            options={[
              { value: "text", label: t("ui.slurp.live.text") },
              { value: "pictures", label: t("ui.slurp.live.pictures") },
            ]}
          />
          <button
            type="button"
            disabled={!creator || goLive.isPending || (when === "later" && !at)}
            onClick={submit}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--noodle-accent),var(--slurp-violet))] px-5 font-bold text-white shadow-[0_6px_20px_color-mix(in_srgb,var(--noodle-accent)_40%,transparent)] disabled:opacity-50"
          >
            {t("ui.slurp.stir.goLiveConfirm")}
          </button>
          {error && (
            <p role="alert" className="text-sm text-[var(--slurp-danger)]">
              {error}
            </p>
          )}
        </div>
      )}
      {scheduled && <p role="status">{t("ui.slurp.stir.goLiveScheduled")}</p>}
    </>
  );
}
