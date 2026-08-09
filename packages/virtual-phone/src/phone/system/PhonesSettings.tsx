import { useEffect, useState } from "react";
import { phoneRequest } from "../platform/api";
import { SettingsShell } from "../apps/settings/shell";
import { phoneStylesheet } from "../device/styles";
import { phoneThemeTokens } from "../device/theme";
import type { DeviceSettings } from "../device/settings";

/** The device switcher gate is a client-global flag PhoneOverlay reads live; agent settings just toggles it. */
const FREE_SWITCH_KEY = "marinara_vp_dev_switcher";
const readFreeSwitch = () => { try { return localStorage.getItem(FREE_SWITCH_KEY) === "1"; } catch { return false; } };

/** The full in-device editor, reused inline. It assumes the phone's vp-* styles and theme tokens, so scope both here. */
function InlinePhoneEditor({ phone, onChange, onClose }: { phone: Phone; onChange(phone: Phone): void; onClose(): void }) {
  return (
    <div
      className="vp-root"
      style={{ position: "relative", inset: "auto", zIndex: "auto", height: "min(70vh, 32rem)", marginTop: "0.75rem", borderRadius: "0.75rem", overflow: "hidden", ...phoneThemeTokens(phone.settings?.theme ?? phone.baselineTheme) }}
    >
      <style data-virtual-phone-styles>{phoneStylesheet}</style>
      <SettingsShell phone={phone} onPhoneChange={onChange} onBack={onClose} onClose={onClose} />
    </div>
  );
}

type BaselineTheme = "system" | "light" | "dark";
export type Phone = {
  phoneId: string;
  ownerId: string;
  ownerType?: "persona" | "character";
  ownerName: string;
  enabled: boolean;
  baselineTheme: BaselineTheme;
  /** The real settings type. This was a hand-copied structural duplicate and had already drifted. */
  settings?: DeviceSettings;
};
export type ProvisioningResponse = {
  persona: Phone | null;
  characters: Array<{ ownerId: string; ownerName: string; phone: Phone | null }>;
};

const themes: Array<{ value: BaselineTheme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function ThemeSelect({ phone, chatId, ownerType, onChange }: {
  phone: Phone;
  chatId: string;
  ownerType: "persona" | "character";
  onChange(phone: Phone): void;
}) {
  const id = `virtual-phone-theme-${ownerType}-${phone.ownerId}`;
  const [pending, setPending] = useState(false);
  return (
    <label htmlFor={id} className="flex min-w-32 flex-col gap-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
      Baseline theme
      <select
        id={id}
        value={phone.baselineTheme}
        disabled={pending}
        className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60"
        onChange={async (event) => {
          setPending(true);
          try {
            const response = await phoneRequest<{ phone: Phone }>(
              `/chats/${encodeURIComponent(chatId)}/phones/${ownerType}/${encodeURIComponent(phone.ownerId)}`,
              { method: "PUT", body: JSON.stringify({ baselineTheme: event.target.value }) },
            );
            onChange(response.phone);
          } finally {
            setPending(false);
          }
        }}
      >
        {themes.map((theme) => <option key={theme.value} value={theme.value}>{theme.label}</option>)}
      </select>
    </label>
  );
}

function EditPhoneButton({ phoneId, editingId, setEditingId }: { phoneId: string; editingId: string | null; setEditingId(id: string | null): void }) {
  const open = editingId === phoneId;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setEditingId(open ? null : phoneId)}
      className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-4 text-xs font-semibold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {open ? "Done" : "Edit phone"}
    </button>
  );
}

function RegenButton({ phoneId, regenId, onRegen }: { phoneId: string; regenId: string | null; onRegen(id: string): void }) {
  const busy = regenId === phoneId;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onRegen(phoneId)}
      className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-4 text-xs font-semibold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60"
    >
      {busy ? "Starting…" : "Regenerate"}
    </button>
  );
}

export function PhonesSettings({ chatId }: { chatId: string | null }) {
  const [data, setData] = useState<ProvisioningResponse | null>(null);
  const [error, setError] = useState("");
  const [pendingOwnerId, setPendingOwnerId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [freeSwitch, setFreeSwitch] = useState(readFreeSwitch);
  const regenerate = async (phoneId: string) => {
    if (!chatId || !window.confirm("Reset and regenerate this phone? It rebuilds the app loadout, look and content to fit the character.")) return;
    setRegenId(phoneId);
    setNotice("");
    try {
      await phoneRequest(`/phones/${encodeURIComponent(phoneId)}/pregenerate?chatId=${encodeURIComponent(chatId)}`, { method: "POST" });
      setNotice("Regenerating in the background — reopen the phone in a moment.");
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : "The phone could not be regenerated.");
    } finally {
      setRegenId(null);
    }
  };
  const setFreeSwitchFlag = (on: boolean) => {
    setFreeSwitch(on);
    try { on ? localStorage.setItem(FREE_SWITCH_KEY, "1") : localStorage.removeItem(FREE_SWITCH_KEY); } catch { /* storage blocked — toggle is best-effort */ }
  };

  async function load() {
    if (!chatId) return;
    setError("");
    try {
      setData(await phoneRequest<ProvisioningResponse>(`/chats/${encodeURIComponent(chatId)}/phones`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Phones could not be loaded");
    }
  }

  useEffect(() => {
    setData(null);
    void load();
  }, [chatId]);

  if (!chatId) {
    return <p className="p-4 text-sm text-[var(--muted-foreground)]">Open a supported chat to configure phones.</p>;
  }
  if (error) {
    return (
      <div role="alert" className="m-4 space-y-3 rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-4 text-sm">
        <p>{error}</p>
        <button type="button" onClick={() => void load()} className="min-h-11 rounded-md bg-[var(--secondary)] px-4 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">Retry</button>
      </div>
    );
  }
  if (!data) return <p role="status" className="p-4 text-sm text-[var(--muted-foreground)]">Loading phones…</p>;

  const updatePhone = (next: Phone) => setData((current) => current ? {
    persona: current.persona?.ownerId === next.ownerId ? next : current.persona,
    characters: current.characters.map((character) => character.ownerId === next.ownerId ? { ...character, phone: next } : character),
  } : current);

  return (
    <section aria-labelledby="virtual-phone-settings-title" className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--background)] p-4 text-[var(--foreground)] sm:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 id="virtual-phone-settings-title" className="text-base font-semibold">Phones</h1>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">Choose which story participants have a phone in this chat.</p>
        </header>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <input type="checkbox" checked={freeSwitch} className="mt-0.5 h-5 w-5 accent-[var(--primary)]" onChange={(event) => setFreeSwitchFlag(event.target.checked)} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Switch between phones freely</span>
            <span className="block text-xs text-[var(--muted-foreground)]">Skip the in-story access check so you can open any enabled phone from the device switcher. Off by default: picking up someone else&apos;s phone asks whether your character could plausibly reach it.</span>
          </span>
        </label>

        {notice ? <p role="status" className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--muted-foreground)]">{notice}</p> : null}

        {data.persona ? (
          <article className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold">{data.persona.ownerName}</h2>
                <p className="text-xs text-[var(--muted-foreground)]">Your phone · Always enabled</p>
              </div>
              <ThemeSelect phone={data.persona} chatId={chatId} ownerType="persona" onChange={updatePhone} />
              <EditPhoneButton phoneId={data.persona.phoneId} editingId={editingId} setEditingId={setEditingId} />
              <RegenButton phoneId={data.persona.phoneId} regenId={regenId} onRegen={regenerate} />
            </div>
            {editingId === data.persona.phoneId ? <InlinePhoneEditor phone={data.persona} onChange={updatePhone} onClose={() => setEditingId(null)} /> : null}
          </article>
        ) : (
          <p className="rounded-md border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">This chat has no persona.</p>
        )}

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Character phones</h2>
          {data.characters.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">This chat has no characters.</p>
          ) : data.characters.map((character) => {
            const enabled = character.phone?.enabled === true;
            const inputId = `virtual-phone-enabled-${character.ownerId}`;
            return (
              <article key={character.ownerId} className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex flex-wrap items-center gap-4">
                <label htmlFor={inputId} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={enabled}
                    disabled={pendingOwnerId === character.ownerId}
                    className="h-5 w-5 accent-[var(--primary)]"
                    onChange={async (event) => {
                      setPendingOwnerId(character.ownerId);
                      setError("");
                      try {
                        const response = await phoneRequest<{ phone: Phone }>(
                          `/chats/${encodeURIComponent(chatId)}/phones/character/${encodeURIComponent(character.ownerId)}`,
                          { method: "PUT", body: JSON.stringify({ enabled: event.target.checked }) },
                        );
                        updatePhone(response.phone);
                      } catch (requestError) {
                        setError(requestError instanceof Error ? requestError.message : "Phone could not be updated");
                      } finally {
                        setPendingOwnerId(null);
                      }
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{character.ownerName}</span>
                    <span className="block text-xs text-[var(--muted-foreground)]">{enabled ? "Phone enabled" : "Phone disabled"}</span>
                  </span>
                </label>
                {character.phone ? <ThemeSelect phone={character.phone} chatId={chatId} ownerType="character" onChange={updatePhone} /> : null}
                {enabled && character.phone ? <EditPhoneButton phoneId={character.phone.phoneId} editingId={editingId} setEditingId={setEditingId} /> : null}
                {enabled && character.phone ? <RegenButton phoneId={character.phone.phoneId} regenId={regenId} onRegen={regenerate} /> : null}
                </div>
                {enabled && character.phone && editingId === character.phone.phoneId ? <InlinePhoneEditor phone={character.phone} onChange={updatePhone} onClose={() => setEditingId(null)} /> : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
