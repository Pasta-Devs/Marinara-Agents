import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type {
  SaucelingSettings,
  SaucelingStateResponse,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { marinaraRequest, saucelingsRequest } from "./api.js";
import { useSaucelingsTranslation } from "./localization.js";

type ConnectionSummary = { id: string; name: string; provider: string };

/** Providers that cannot write a line of text. */
const NON_TEXT_PROVIDERS = new Set(["image_generation", "video_generation", "audio", "decision"]);

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

  const resetMutation = useMutation({
    mutationFn: () => saucelingsRequest<SaucelingStateResponse>("/reset", "POST", {}),
    onSuccess: (next) => {
      setConfirmReset(false);
      queryClient.setQueryData(["saucelings", "state"], next);
    },
  });

  return (
    <div className="sl-card" style={{ display: "grid", gap: "1.15rem" }}>
      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t("saucelings.settings.careWindow")}</div>
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{t("saucelings.settings.careWindowNote")}</div>
        </div>
        <input
          type="number"
          className="sl-input"
          min={1}
          max={24}
          style={{ width: "5rem" }}
          value={settings.careWindowHours}
          onChange={(e) => patchMutation.mutate({ careWindowHours: Number(e.target.value) || 6 })}
        />
      </label>

      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t("saucelings.settings.dailyBudget")}</div>
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
            {t("saucelings.settings.budgetUsed", {
              used: budget.used,
              limit: settings.dailyGenerationBudget,
            })}{" "}
            — {t("saucelings.settings.budgetNote")}
          </div>
        </div>
        <input
          type="number"
          className="sl-input"
          min={0}
          max={30}
          style={{ width: "5rem" }}
          value={settings.dailyGenerationBudget}
          onChange={(e) => patchMutation.mutate({ dailyGenerationBudget: Number(e.target.value) })}
        />
      </label>

      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t("saucelings.settings.connection")}</div>
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{t("saucelings.settings.connectionNote")}</div>
        </div>
        <select
          className="sl-input"
          value={settings.connectionId ?? ""}
          onChange={(e) => patchMutation.mutate({ connectionId: e.target.value || null })}
        >
          <option value="">{t("saucelings.settings.connectionDefault")}</option>
          {textConnections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.name}
            </option>
          ))}
          {/* A saved connection that has since been deleted stays visible, so the select tells the truth. */}
          {settings.connectionId && connections.data && !textConnections.some((c) => c.id === settings.connectionId) ? (
            <option value={settings.connectionId}>{t("saucelings.settings.connectionMissing")}</option>
          ) : null}
        </select>
      </label>

      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t("saucelings.settings.writeEveryLine")}</div>
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{t("saucelings.settings.writeEveryLineNote")}</div>
        </div>
        <input
          type="checkbox"
          checked={settings.writeEveryLine}
          onChange={(e) => patchMutation.mutate({ writeEveryLine: e.target.checked })}
        />
      </label>

      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t("saucelings.settings.images")}</div>
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{t("saucelings.settings.imagesNote")}</div>
        </div>
        <input
          type="checkbox"
          checked={settings.portraitEnabled}
          onChange={(e) => patchMutation.mutate({ portraitEnabled: e.target.checked })}
        />
      </label>

      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t("saucelings.settings.eggHunting")}</div>
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{t("saucelings.settings.eggHuntingNote")}</div>
        </div>
        <input
          type="checkbox"
          checked={settings.eggHunting}
          onChange={(e) => patchMutation.mutate({ eggHunting: e.target.checked })}
        />
      </label>

      {settings.portraitEnabled ? (
        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t("saucelings.settings.imageConnection")}</div>
          {imageConnections && imageConnections.length === 0 ? (
            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{t("saucelings.settings.imageConnectionEmpty")}</span>
          ) : (
            <select
              className="sl-input"
              value={settings.portraitConnectionId ?? ""}
              onChange={(e) => patchMutation.mutate({ portraitConnectionId: e.target.value || null })}
            >
              <option value="">{t("saucelings.settings.imageConnectionPick")}</option>
              {(imageConnections ?? []).map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name}
                </option>
              ))}
            </select>
          )}
        </label>
      ) : null}

      {settings.portraitEnabled ? (
        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t("saucelings.settings.threeDrawingFallback")}</div>
            <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{t("saucelings.settings.threeDrawingFallbackNote")}</div>
          </div>
          <input
            type="checkbox"
            checked={settings.threeDrawingFallback}
            onChange={(e) => patchMutation.mutate({ threeDrawingFallback: e.target.checked })}
          />
        </label>
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
              className="sl-btn"
              style={{ background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
              disabled={resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
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
