// ──────────────────────────────────────────────
// Otome Hearth Settings → Audio → Haptics (0.34.0): the toys, in an explicit story only
// ──────────────────────────────────────────────
// The switch and the Intiface Central address are the story's (saved with the rest of Audio). Connect, the toys
// connected now and Test all act at once, through the story's haptics routes (S/routes/haptics.ts), so the player can set
// the toys up before turning haptics on. Several toys can be connected at once: Intiface Central finds them, and Test
// all pulses each one, saying which moved.
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, RefreshCw, Vibrate } from "lucide-react";
import { useOtomeApi } from "../../api";
import { HAPTIC_ACTIONS, isHapticsUrl } from "../../shared/haptics";
import { Section, Switch } from "../setup/parts";

/** The Lovense affiliate link (the maintainer's, as on the Haptic agent). */
const LOVENSE_URL = "https://www.lovense.com/r/dupchb";

interface HapticsView {
  available: boolean;
  connected: boolean;
  devices: Array<{ index: number; name: string; capabilities: string[] }>;
  playing: boolean;
  error?: string;
}

interface TestResult {
  index: number;
  name: string;
  ok: boolean;
  error?: string;
}

const OUTPUT_KEYS: Record<(typeof HAPTIC_ACTIONS)[number], string> = {
  vibrate: "ui.otomeForge.haptics.output.vibrate",
  rotate: "ui.otomeForge.haptics.output.rotate",
  oscillate: "ui.otomeForge.haptics.output.oscillate",
  constrict: "ui.otomeForge.haptics.output.constrict",
  inflate: "ui.otomeForge.haptics.output.inflate",
  position: "ui.otomeForge.haptics.output.position",
  stop: "ui.otomeForge.haptics.output.stop",
};

const isOutput = (value: string): value is (typeof HAPTIC_ACTIONS)[number] =>
  (HAPTIC_ACTIONS as readonly string[]).includes(value);

interface Props {
  runKey: string;
  enabled: boolean;
  url: string;
  onChange: (change: { haptics?: boolean; hapticsUrl?: string }) => void;
}

export function HapticsSection({ runKey, enabled, url, onChange }: Props) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const id = useId();
  const path = `/runs/${encodeURIComponent(runKey)}/haptics`;
  const queryKey = ["otome-forge", "haptics", runKey];
  const status = useQuery({
    queryKey,
    queryFn: () => otome.get<{ haptics: HapticsView }>(path).then((result) => result.haptics),
    refetchInterval: 10_000,
  });
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const view = status.data;
  const typed = url.trim();
  const urlOk = !typed || isHapticsUrl(typed);

  const connect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const result = await otome.post<{ haptics: HapticsView }>(`${path}/connect`, typed ? { url: typed } : {});
      queryClient.setQueryData(queryKey, result.haptics);
      if (result.haptics.error) setConnectError(result.haptics.error);
    } catch (failure) {
      setConnectError(otome.errorMessage(failure));
    } finally {
      setConnecting(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestError(null);
    setResults(null);
    try {
      const result = await otome.post<{ results: TestResult[] }>(`${path}/test`, {});
      setResults(result.results);
    } catch (failure) {
      setTestError(otome.errorMessage(failure));
    } finally {
      setTesting(false);
    }
  };

  const outputs = (capabilities: string[]) =>
    capabilities
      .filter(isOutput)
      .map((output) => t(OUTPUT_KEYS[output]))
      .join(", ");

  return (
    <Section title={t("ui.otomeForge.haptics.title")} hint={t("ui.otomeForge.haptics.hint")}>
      <Switch
        label={t("ui.otomeForge.haptics.enable")}
        hint={t("ui.otomeForge.haptics.enableHint")}
        checked={enabled}
        onChange={(haptics) => onChange({ haptics })}
      />
      <div className="of-field">
        <label className="of-label" htmlFor={id}>
          {t("ui.otomeForge.haptics.url")}
        </label>
        <input
          id={id}
          className="of-input"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="ws://127.0.0.1:12345"
          value={url}
          aria-invalid={!urlOk}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange({ hapticsUrl: event.target.value })}
        />
        <p id={`${id}-hint`} className="of-hint">
          {t(urlOk ? "ui.otomeForge.haptics.urlHint" : "ui.otomeForge.haptics.urlInvalid")}
        </p>
      </div>
      {view && !view.available ? (
        <p className="of-hint" role="status">
          {t("ui.otomeForge.haptics.unavailable")}
        </p>
      ) : null}
      <div className="of-haptics-actions">
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-button--small"
          disabled={connecting || !urlOk || view?.available === false}
          onClick={() => void connect()}
        >
          <Plug size={15} strokeWidth={2} aria-hidden="true" />
          {t(connecting ? "ui.otomeForge.haptics.connecting" : "ui.otomeForge.haptics.connect")}
        </button>
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-button--small"
          disabled={status.isFetching}
          onClick={() => void status.refetch()}
        >
          <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.haptics.refresh")}
        </button>
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-button--small"
          disabled={testing || !view?.devices.length}
          onClick={() => void test()}
        >
          <Vibrate size={15} strokeWidth={2} aria-hidden="true" />
          {t(testing ? "ui.otomeForge.haptics.testing" : "ui.otomeForge.haptics.test")}
        </button>
      </div>
      {connectError ? (
        <p className="of-notice of-notice--error" role="alert">
          {t("ui.otomeForge.haptics.connectFailed", { error: connectError })}
        </p>
      ) : null}
      <div className="of-haptics-devices" role="status">
        <p className="of-label">
          {view?.connected ? t("ui.otomeForge.haptics.connected") : t("ui.otomeForge.haptics.notConnected")}
        </p>
        {view?.connected ? (
          view.devices.length ? (
            <ul className="of-haptics-list">
              {view.devices.map((device) => {
                const result = results?.find((entry) => entry.index === device.index);
                return (
                  <li key={device.index}>
                    <span className="of-haptics-name">{device.name}</span>
                    <span className="of-hint"> · {outputs(device.capabilities)}</span>
                    {result ? (
                      <span className="of-hint">
                        {" "}
                        ·{" "}
                        {result.ok
                          ? t("ui.otomeForge.haptics.testOk")
                          : t("ui.otomeForge.haptics.testFailed", { error: result.error ?? "" })}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="of-hint">{t("ui.otomeForge.haptics.noDevices")}</p>
          )
        ) : null}
      </div>
      {testError ? (
        <p className="of-notice of-notice--error" role="alert">
          {testError}
        </p>
      ) : null}
      <p className="of-hint">
        {t("ui.otomeForge.haptics.lovense")}{" "}
        <a href={LOVENSE_URL} target="_blank" rel="noreferrer">
          {LOVENSE_URL}
        </a>
      </p>
    </Section>
  );
}
