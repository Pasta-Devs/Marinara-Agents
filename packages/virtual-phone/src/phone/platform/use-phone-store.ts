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
