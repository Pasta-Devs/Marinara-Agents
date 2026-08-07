import React from "react";
import { phoneRequest } from "./api";
import { PhoneStore, type PhoneStoreBackend } from "./phone-store";

function storagePath(phoneId: string, appId: string, key?: string) {
  const base = `/phones/${encodeURIComponent(phoneId)}/apps/${encodeURIComponent(appId)}/storage`;
  return key === undefined ? base : `${base}/${encodeURIComponent(key)}`;
}

const httpBackend: PhoneStoreBackend = {
  async get(phoneId, appId, key) {
    const response = await phoneRequest<{ value: unknown }>(storagePath(phoneId, appId, key));
    return response.value ?? undefined;
  },
  async set(phoneId, appId, key, value) {
    await phoneRequest(storagePath(phoneId, appId, key), { method: "PUT", body: JSON.stringify({ value }) });
  },
  async list(phoneId, appId, prefix) {
    const response = await phoneRequest<{ entries: Array<{ key: string; value: unknown }> }>(storagePath(phoneId, appId));
    return response.entries.filter((entry) => entry.key.startsWith(prefix));
  },
  async remove(phoneId, appId, key) {
    await phoneRequest(storagePath(phoneId, appId, key), { method: "DELETE" });
  },
};

export function usePhoneStore(phoneId: string, appId: string) {
  return React.useMemo(() => new PhoneStore(httpBackend, phoneId, appId), [phoneId, appId]);
}

/**
 * Coalesces writes while the user is typing — a sentence becomes one save, not forty. Structural
 * edits (add, delete) pass `immediate` so they are never sitting in the timer when the app closes.
 * Anything still pending is flushed on unmount, so closing the app cannot lose the last keystrokes.
 */
export function useDebouncedSave(
  store: PhoneStore,
  key: string,
  onError: (message: string) => void,
  delayMs = 500,
) {
  const pending = React.useRef<{ value: unknown } | null>(null);
  const timer = React.useRef<number | null>(null);

  const write = React.useCallback((value: unknown) => {
    pending.current = null;
    void store.set(key, value).catch((cause: unknown) => {
      onError(cause instanceof Error ? cause.message : "Could not save.");
    });
  }, [store, key, onError]);

  const flush = React.useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (pending.current) write(pending.current.value);
  }, [write]);

  const save = React.useCallback((value: unknown, immediate = false) => {
    pending.current = { value };
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (immediate) {
      timer.current = null;
      write(value);
      return;
    }
    timer.current = window.setTimeout(() => { timer.current = null; write(value); }, delayMs);
  }, [write, delayMs]);

  React.useEffect(() => flush, [flush]);
  return { save, flush };
}
