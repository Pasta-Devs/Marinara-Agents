import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import type {
  SaucelingSettings,
  SaucelingStateResponse,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { marinaraRequest, saucelingsRequest } from "./api.js";
import { FriendlyError, useForAMoment } from "./care-ui.js";
import { useSaucelingsTranslation } from "./localization.js";

type ConnectionSummary = { id: string; name: string; provider: string };

/** Providers that cannot write a line of text. */
const NON_TEXT_PROVIDERS = new Set(["image_generation", "video_generation", "audio", "decision"]);

/** A whole-number field that keeps what is being typed and saves it once, when the player leaves it or presses Enter;
 *  an empty or invalid entry, or a save that fails (`onSave` is given `revert` for it), goes back to the saved number. */
function NumberField({
  value,
  min,
  max,
  onSave,
}: {
  value: number;
  min: number;
  max: number;
  onSave: (next: number, revert: () => void) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const typed = draft.trim() === "" ? Number.NaN : Number(draft);
    if (!Number.isFinite(typed)) return setDraft(String(value));
    const next = Math.min(max, Math.max(min, Math.round(typed)));
    setDraft(String(next));
    if (next !== value) onSave(next, () => setDraft(String(value)));
  };
  return (
    <input
      type="number"
      className="sl-input"
      min={min}
      max={max}
      style={{ width: "5rem", flexShrink: 0 }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

/** One setting: its name, a short note and a saved tick on the left, the control on the right; a picker takes the
 *  row's width on a phone. */
function SettingRow({
  title,
  note,
  tick,
  stack,
  children,
}: {
  title: string;
  note: string | null;
  tick: ReactNode;
  stack?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`sl-setting ${stack ? "sl-setting--stack" : ""}`}>
      <span className="sl-setting-text">
        <span className="sl-setting-title">
          {title} {tick}
        </span>
        {note ? <span className="sl-setting-note">{note}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function SaucelingsSettingsView({ state }: { state: SaucelingStateResponse }) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const settings = state.world.settings;
  const budget = state.world.budget;
  const [confirmReset, setConfirmReset] = useState(false);
  const connections = useQuery({
    queryKey: ["saucelings", "connections"],
    queryFn: () => marinaraRequest<ConnectionSummary[]>("/api/connections"),
  });
  const textConnections = (connections.data ?? []).filter((connection) => !NON_TEXT_PROVIDERS.has(connection.provider));
  const imageConnections = connections.data?.filter((connection) => connection.provider === "image_generation");

  const patchMutation = useMutation({
    mutationFn: (patch: Partial<SaucelingSettings>) =>
      saucelingsRequest<SaucelingStateResponse>("/settings", "PATCH", patch),
    onSuccess: (next) => queryClient.setQueryData(["saucelings", "state"], next),
  });
  // Each change saves on its own, so the row that changed says so for a moment.
  const [saved, showSaved] = useForAMoment<keyof SaucelingSettings>(2000);
  const patch = (change: Partial<SaucelingSettings>, onFailed?: () => void) => {
    // Only a finished failure is cleared: reset() would also let go of a reset still in flight.
    if (resetMutation.isError) resetMutation.reset();
    patchMutation.mutate(change, {
      onSuccess: () => showSaved(Object.keys(change)[0] as keyof SaucelingSettings),
      onError: onFailed,
    });
  };
  const savedTick = (key: keyof SaucelingSettings) =>
    saved === key ? (
      <span className="sl-saved" role="status">
        {t("saucelings.settings.saved")}
      </span>
    ) : null;

  const resetMutation = useMutation({
    mutationFn: () => saucelingsRequest<SaucelingStateResponse>("/reset", "POST", {}),
    onSuccess: (next) => {
      setConfirmReset(false);
      queryClient.setQueryData(["saucelings", "state"], next);
    },
  });

  const checkbox = (key: "writeEveryLine" | "portraitEnabled" | "threeDrawingFallback" | "eggHunting") => (
    <input type="checkbox" checked={settings[key]} onChange={(e) => patch({ [key]: e.target.checked })} />
  );

  return (
    <div className="sl-card sl-settings">
      <section className="sl-settings-group">
        <h3>{t("saucelings.settings.visitsGroup")}</h3>
        <SettingRow
          title={t("saucelings.settings.careWindow")}
          note={t("saucelings.settings.careWindowNote")}
          tick={savedTick("careWindowHours")}
        >
          <NumberField
            value={settings.careWindowHours}
            min={1}
            max={24}
            onSave={(careWindowHours, revert) => patch({ careWindowHours }, revert)}
          />
        </SettingRow>
        <SettingRow
          title={t("saucelings.settings.eggHunting")}
          note={t("saucelings.settings.eggHuntingNote")}
          tick={savedTick("eggHunting")}
        >
          {checkbox("eggHunting")}
        </SettingRow>
      </section>

      <section className="sl-settings-group">
        <h3>{t("saucelings.settings.writingGroup")}</h3>
        <SettingRow
          stack
          title={t("saucelings.settings.connection")}
          note={t("saucelings.settings.connectionNote")}
          tick={savedTick("connectionId")}
        >
          <select
            className="sl-input"
            value={settings.connectionId ?? ""}
            onChange={(e) => patch({ connectionId: e.target.value || null })}
          >
            <option value="">{t("saucelings.settings.connectionDefault")}</option>
            {textConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
            {/* A saved connection that has since been deleted stays visible, so the select tells the truth. */}
            {settings.connectionId &&
            connections.data &&
            !textConnections.some((c) => c.id === settings.connectionId) ? (
              <option value={settings.connectionId}>{t("saucelings.settings.connectionMissing")}</option>
            ) : null}
          </select>
        </SettingRow>
        <SettingRow
          title={t("saucelings.settings.dailyBudget")}
          note={`${t("saucelings.settings.budgetUsed", { used: budget.used, limit: settings.dailyGenerationBudget })} — ${t("saucelings.settings.budgetNote")}`}
          tick={savedTick("dailyGenerationBudget")}
        >
          <NumberField
            value={settings.dailyGenerationBudget}
            min={0}
            max={30}
            onSave={(dailyGenerationBudget, revert) => patch({ dailyGenerationBudget }, revert)}
          />
        </SettingRow>
        <SettingRow
          title={t("saucelings.settings.writeEveryLine")}
          note={t("saucelings.settings.writeEveryLineNote")}
          tick={savedTick("writeEveryLine")}
        >
          {checkbox("writeEveryLine")}
        </SettingRow>
      </section>

      <section className="sl-settings-group">
        <h3>{t("saucelings.settings.picturesGroup")}</h3>
        <SettingRow
          title={t("saucelings.settings.images")}
          note={t("saucelings.settings.imagesNote")}
          tick={savedTick("portraitEnabled")}
        >
          {checkbox("portraitEnabled")}
        </SettingRow>
        {settings.portraitEnabled ? (
          <SettingRow
            stack={!imageConnections || imageConnections.length > 0}
            title={t("saucelings.settings.imageConnection")}
            note={
              imageConnections && imageConnections.length === 0 ? t("saucelings.settings.imageConnectionEmpty") : null
            }
            tick={savedTick("portraitConnectionId")}
          >
            {imageConnections && imageConnections.length === 0 ? null : (
              <select
                className="sl-input"
                value={settings.portraitConnectionId ?? ""}
                onChange={(e) => patch({ portraitConnectionId: e.target.value || null })}
              >
                <option value="">{t("saucelings.settings.imageConnectionPick")}</option>
                {(imageConnections ?? []).map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
                {/* A saved connection that has since been deleted stays visible, as in the writing select. */}
                {settings.portraitConnectionId &&
                connections.data &&
                !imageConnections?.some((c) => c.id === settings.portraitConnectionId) ? (
                  <option value={settings.portraitConnectionId}>{t("saucelings.settings.connectionMissing")}</option>
                ) : null}
              </select>
            )}
          </SettingRow>
        ) : null}
        {settings.portraitEnabled ? (
          <SettingRow
            title={t("saucelings.settings.threeDrawingFallback")}
            note={t("saucelings.settings.threeDrawingFallbackNote")}
            tick={savedTick("threeDrawingFallback")}
          >
            {checkbox("threeDrawingFallback")}
          </SettingRow>
        ) : null}
      </section>

      {(patchMutation.error ?? resetMutation.error) ? (
        <span role="alert" className="sl-error">
          <FriendlyError error={patchMutation.error ?? resetMutation.error} />
        </span>
      ) : null}

      <div
        style={{
          borderTop: "1px solid var(--border, rgba(255,255,255,0.1))",
          paddingTop: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>{t("saucelings.settings.resetNote")}</span>
        {confirmReset ? (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="sl-btn sl-btn--danger"
              disabled={resetMutation.isPending}
              onClick={() => {
                if (patchMutation.isError) patchMutation.reset();
                resetMutation.mutate();
              }}
            >
              {t("saucelings.settings.resetConfirm")}
            </button>
            <button type="button" className="sl-btn" onClick={() => setConfirmReset(false)}>
              {t("saucelings.common.cancel")}
            </button>
          </div>
        ) : (
          <button type="button" className="sl-btn" onClick={() => setConfirmReset(true)}>
            {t("saucelings.settings.reset")}
          </button>
        )}
      </div>
    </div>
  );
}
