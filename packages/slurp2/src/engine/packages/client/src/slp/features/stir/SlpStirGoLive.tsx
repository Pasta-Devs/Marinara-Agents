import { useState } from "react";
import { newRequestId } from "../../base/state/slp-request-id";
import { useTranslation } from "react-i18next";
import { focusRing } from "../../base/chrome/slp-focus";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import type { SlpStirView } from "../../../../../shared/src/slp/slp-stir.js";
import { Choice, CreatorPicker } from "./SlpStirFormParts";
import { useSlurpStirLive } from "./slp-stir-hooks";

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
      <button
        type="button"
        className="min-h-11 rounded-xl bg-[var(--slurp-canvas)] p-3 text-start ring-1 ring-[var(--slurp-outline)]"
        onClick={() => {
          setOpen(true);
          setScheduled(false);
          setError("");
        }}
      >
        {t("ui.slurp.stir.goLive")}
      </button>
      {open && (
        <div className="space-y-3 rounded-xl bg-[var(--slurp-canvas)] p-3 ring-1 ring-[var(--slurp-outline)]">
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
            className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 font-semibold text-[var(--slurp-ink)] disabled:opacity-50"
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
