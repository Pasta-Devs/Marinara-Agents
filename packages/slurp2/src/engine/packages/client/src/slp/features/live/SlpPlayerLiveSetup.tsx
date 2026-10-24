import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../../lib/api-client.js";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { useStartSlpPlayerLive } from "./slp-live-hooks";

export function SlpPlayerLiveSetup({
  open,
  personaId,
  onClose,
  onStarted,
}: {
  open: boolean;
  personaId: string | null;
  onClose: () => void;
  onStarted: (showId: string) => void;
}) {
  const { t } = useTranslation();
  const start = useStartSlpPlayerLive();
  const [duration, setDuration] = useState<20 | 30 | 40>(20);
  const [goal, setGoal] = useState("");
  const [edits, setEdits] = useState<Record<string, { enabled: boolean; price: number | "" }>>({});
  useEffect(() => {
    if (!open) return;
    setDuration(20);
    setGoal("");
    setEdits({});
  }, [open, personaId]);
  const defaults = useQuery({
    queryKey: ["slurp2", "live", "player-menu", personaId],
    queryFn: () =>
      api.get<{ goal: number; menu: { id: string; label: string; price: number }[] }>(
        `/slurp2/live/player-menu/${encodeURIComponent(personaId!)}`,
      ),
    enabled: open && Boolean(personaId),
  });
  if (!open) return null;
  const menu = (defaults.data?.menu ?? []).map((item) => ({
    ...item,
    ...(edits[item.id] ?? { enabled: true, price: item.price }),
  }));
  const goalValue = goal === "" ? (defaults.data?.goal ?? 0) : Number(goal);
  const goalValid = Number.isInteger(goalValue) && goalValue >= 1 && goalValue <= 9999;
  const menuValid = menu.every(
    (item) => typeof item.price === "number" && Number.isInteger(item.price) && item.price >= 1 && item.price <= 9999,
  );
  const canStart = Boolean(personaId && defaults.data && goalValid && menuValid && !start.isPending);
  const menuRows = menu.map((item) => (
    <div key={item.id} className="flex items-center gap-2 border-b border-[var(--noodle-divider)] py-2">
      <input
        type="checkbox"
        aria-label={item.label}
        checked={item.enabled}
        onChange={(event) =>
          setEdits((current) => ({
            ...current,
            [item.id]: { enabled: event.target.checked, price: item.price },
          }))
        }
      />
      <span className="min-w-0 flex-1 text-sm">{item.label}</span>
      <input
        aria-label={t("ui.slurp.live.setup.price", { item: item.label })}
        type="number"
        min={1}
        max={9999}
        step={1}
        value={item.price}
        onChange={(event) =>
          setEdits((current) => ({
            ...current,
            [item.id]: {
              enabled: item.enabled,
              price: event.target.value === "" ? "" : Number(event.target.value),
            },
          }))
        }
        className="min-h-11 w-24 rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] px-2 text-sm"
      />
    </div>
  ));
  return (
    <SlpSheet
      open
      onClose={onClose}
      closeDisabled={start.isPending}
      title={t("ui.slurp.live.setup.title")}
      width="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <SlpButton variant="tertiary" onClick={onClose} disabled={start.isPending}>
            {t("ui.slurp.live.setup.cancel")}
          </SlpButton>
          <SlpPrimaryButton
            disabled={!canStart || defaults.isLoading || defaults.isError}
            onClick={() =>
              personaId &&
              canStart &&
              start.mutate(
                {
                  personaId,
                  duration,
                  goal: goalValue,
                  menu: menu.map(({ id, enabled, price }) => ({ id, enabled, price: Number(price) })),
                },
                { onSuccess: ({ show }) => onStarted(show.id) },
              )
            }
          >
            {start.isPending ? t("ui.slurp.live.setup.starting") : t("ui.slurp.live.goLive")}
          </SlpPrimaryButton>
        </div>
      }
    >
      <div className="space-y-4 px-4 pb-4">
        {defaults.isLoading && (
          <p role="status" className="text-sm text-[var(--muted-foreground)]">
            {t("ui.slurp.live.setup.loading")}
          </p>
        )}
        {defaults.isError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg bg-[var(--muted)] p-3 text-sm"
          >
            <span>{t("ui.slurp.live.setup.loadError")}</span>
            <SlpButton onClick={() => void defaults.refetch()}>{t("ui.slurp.live.setup.retry")}</SlpButton>
          </div>
        )}
        {start.isError && (
          <p role="alert" className="text-sm text-[var(--destructive)]">
            {t("ui.slurp.live.setup.startError")}
          </p>
        )}
        {defaults.data && (
          <>
            <label className="block text-sm font-semibold">
              {t("ui.slurp.live.setup.duration")}
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] px-3"
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value) as 20 | 30 | 40)}
              >
                {[20, 30, 40].map((value) => (
                  <option key={value} value={value}>
                    {t("ui.slurp.live.setup.minutes", { count: value })}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              {t("ui.slurp.live.setup.goal")}
              <input
                type="number"
                min={1}
                max={9999}
                step={1}
                value={goal === "" ? defaults.data.goal : goal}
                onChange={(event) => setGoal(event.target.value)}
                aria-invalid={goal !== "" && !goalValid}
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] px-3"
              />
            </label>
            {goal !== "" && !goalValid && (
              <p role="alert" className="text-sm text-[var(--destructive)]">
                {t("ui.slurp.live.setup.goalError")}
              </p>
            )}
            <fieldset>
              <legend className="text-sm font-bold">{t("ui.slurp.live.setup.menu")}</legend>
              {menuRows}
            </fieldset>
            {!menuValid && (
              <p role="alert" className="text-sm text-[var(--destructive)]">
                {t("ui.slurp.live.setup.priceError")}
              </p>
            )}
          </>
        )}
      </div>
    </SlpSheet>
  );
}
