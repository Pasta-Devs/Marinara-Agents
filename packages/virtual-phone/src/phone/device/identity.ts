import { randomUUID } from "node:crypto";
import { defaultDeviceSettings, normalizeDeviceSettings, type DeviceSettings } from "./settings";

export type PhoneOwnerType = "persona" | "character";
export type PhoneBaselineTheme = "system" | "light" | "dark";

export interface PhoneIdentity {
  phoneId: string;
  ownerId: string;
  ownerType: PhoneOwnerType;
  ownerName: string;
  chatScope: string[];
  deviceName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhoneDocument {
  schemaVersion: 1;
  identity: PhoneIdentity;
  provisioning: {
    enabled: boolean;
    baselineTheme: PhoneBaselineTheme;
  };
  namespaces: {
    phone: Record<string, unknown>;
  };
}

export interface PhoneDocumentRecord {
  id: string;
  packageId: string;
  kind: string;
  name: string;
  description: string;
  revision: number;
  data: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface PhoneDocumentStore {
  list(packageId: string, kind: string): Promise<PhoneDocumentRecord[]>;
  create(input: {
    id: string;
    packageId: string;
    kind: string;
    name: string;
    description: string;
    data: PhoneDocument;
    createdAt: string;
    updatedAt: string;
  }): Promise<PhoneDocumentRecord>;
  update(input: {
    id: string;
    packageId: string;
    expectedRevision: number;
    name: string;
    description: string;
    data: PhoneDocument;
    updatedAt: string;
  }): Promise<PhoneDocumentRecord | null>;
  remove(packageId: string, id: string, expectedRevision: number): Promise<boolean>;
}

export interface EnsurePhoneInput {
  ownerId: string;
  ownerType: PhoneOwnerType;
  ownerName: string;
  chatId: string;
  deviceName?: string | null;
  enabled?: boolean;
  baselineTheme?: PhoneBaselineTheme;
}

const PACKAGE_ID = "virtual-phone";
const LEGACY_PACKAGE_ID = "virtual-phone-2";
const PHONE_KIND = "phone";

function ownerKey(ownerType: PhoneOwnerType, ownerId: string) {
  return `${ownerType}:${ownerId}`;
}

function normalizeRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function isPhoneDocument(value: unknown): value is PhoneDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Partial<PhoneDocument>;
  const identity = document.identity;
  return (
    document.schemaVersion === 1 &&
    !!identity &&
    typeof identity.phoneId === "string" &&
    typeof identity.ownerId === "string" &&
    (identity.ownerType === "persona" || identity.ownerType === "character") &&
    typeof identity.ownerName === "string" &&
    Array.isArray(identity.chatScope) &&
    identity.chatScope.every((chatId) => typeof chatId === "string") &&
    !!document.provisioning &&
    typeof document.provisioning.enabled === "boolean" &&
    ["system", "light", "dark"].includes(document.provisioning.baselineTheme ?? "") &&
    !!document.namespaces &&
    typeof document.namespaces.phone === "object" &&
    !Array.isArray(document.namespaces.phone)
  );
}

function parsePhoneRecord(record: PhoneDocumentRecord) {
  if (!isPhoneDocument(record.data)) throw new Error(`Phone record ${record.id} is invalid`);
  return { record, document: record.data };
}

export class PhoneIdentityService {
  private readonly ownerLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly documents: PhoneDocumentStore,
    private readonly now = () => new Date().toISOString(),
    private readonly createId = () => randomUUID(),
  ) {}

  async list() {
    return (await this.documents.list(PACKAGE_ID, PHONE_KIND)).map(parsePhoneRecord);
  }

  async migrateLegacyDocuments() {
    const current = await this.list();
    const currentOwners = new Set(current.map(({ document }) => ownerKey(document.identity.ownerType, document.identity.ownerId)));
    for (const legacyRecord of await this.documents.list(LEGACY_PACKAGE_ID, PHONE_KIND)) {
      const legacy = parsePhoneRecord(legacyRecord);
      const key = ownerKey(legacy.document.identity.ownerType, legacy.document.identity.ownerId);
      if (!currentOwners.has(key)) {
        await this.documents.create({
          id: `${PACKAGE_ID}:${legacyRecord.id}`,
          packageId: PACKAGE_ID,
          kind: PHONE_KIND,
          name: legacyRecord.name,
          description: legacyRecord.description,
          data: legacy.document,
          createdAt: legacyRecord.createdAt,
          updatedAt: legacyRecord.updatedAt,
        });
        currentOwners.add(key);
      }
      await this.documents.remove(LEGACY_PACKAGE_ID, legacyRecord.id, legacyRecord.revision);
    }
  }

  async get(ownerType: PhoneOwnerType, ownerId: string) {
    const key = ownerKey(ownerType, normalizeRequiredString(ownerId, "ownerId"));
    return (await this.list()).find(({ document }) => ownerKey(document.identity.ownerType, document.identity.ownerId) === key) ?? null;
  }

  async ensure(input: EnsurePhoneInput) {
    const key = ownerKey(input.ownerType, normalizeRequiredString(input.ownerId, "ownerId"));
    const previous = this.ownerLocks.get(key) ?? Promise.resolve();
    const pending = previous.then(() => this.ensureUnlocked(input));
    this.ownerLocks.set(key, pending);
    try {
      return await pending;
    } finally {
      if (this.ownerLocks.get(key) === pending) this.ownerLocks.delete(key);
    }
  }

  private async ensureUnlocked(input: EnsurePhoneInput) {
    const ownerId = normalizeRequiredString(input.ownerId, "ownerId");
    const ownerName = normalizeRequiredString(input.ownerName, "ownerName");
    const chatId = normalizeRequiredString(input.chatId, "chatId");
    const existing = await this.get(input.ownerType, ownerId);
    if (!existing) {
      const timestamp = this.now();
      const phoneId = this.createId();
      const document: PhoneDocument = {
        schemaVersion: 1,
        identity: {
          phoneId,
          ownerId,
          ownerType: input.ownerType,
          ownerName,
          chatScope: [chatId],
          deviceName: input.deviceName?.trim() || null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        provisioning: {
          enabled: input.ownerType === "persona" ? true : input.enabled !== false,
          baselineTheme: input.baselineTheme ?? "system",
        },
        namespaces: { phone: { settings: defaultDeviceSettings(input.baselineTheme ?? "system") } },
      };
      const record = await this.documents.create({
        id: `phone:${phoneId}`,
        packageId: PACKAGE_ID,
        kind: PHONE_KIND,
        name: ownerKey(input.ownerType, ownerId),
        description: ownerName,
        data: document,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return parsePhoneRecord(record);
    }

    const nextScope = existing.document.identity.chatScope.includes(chatId)
      ? existing.document.identity.chatScope
      : [...existing.document.identity.chatScope, chatId];
    const nextDeviceName = input.deviceName === undefined
      ? existing.document.identity.deviceName
      : input.deviceName?.trim() || null;
    const nextEnabled = input.ownerType === "persona" ? true : input.enabled ?? existing.document.provisioning.enabled;
    const nextTheme = input.baselineTheme ?? existing.document.provisioning.baselineTheme;
    const scopeUnchanged = nextScope.length === existing.document.identity.chatScope.length &&
      nextScope.every((chatId, index) => chatId === existing.document.identity.chatScope[index]);
    if (
      existing.document.identity.ownerName === ownerName &&
      scopeUnchanged &&
      nextDeviceName === existing.document.identity.deviceName &&
      nextEnabled === existing.document.provisioning.enabled &&
      nextTheme === existing.document.provisioning.baselineTheme
    ) {
      return existing;
    }

    const updatedAt = this.now();
    const document: PhoneDocument = {
      ...existing.document,
      identity: {
        ...existing.document.identity,
        ownerName,
        chatScope: nextScope,
        deviceName: nextDeviceName,
        updatedAt,
      },
      provisioning: {
        enabled: nextEnabled,
        baselineTheme: nextTheme,
      },
      namespaces: {
        phone: {
          ...existing.document.namespaces.phone,
          settings: normalizeDeviceSettings(
            { ...existing.document.namespaces.phone.settings, theme: nextTheme },
            nextTheme,
          ),
        },
      },
    };
    const updated = await this.documents.update({
      id: existing.record.id,
      packageId: PACKAGE_ID,
      expectedRevision: existing.record.revision,
      name: ownerKey(input.ownerType, ownerId),
      description: ownerName,
      data: document,
      updatedAt,
    });
    if (!updated) return this.ensureUnlocked(input);
    return parsePhoneRecord(updated);
  }

  async updateSettings(phoneId: string, patch: Partial<DeviceSettings>) {
    const phone = (await this.list()).find(({ document }) => document.identity.phoneId === phoneId);
    if (!phone) throw new Error("Phone not found");
    const current = normalizeDeviceSettings(phone.document.namespaces.phone.settings, phone.document.provisioning.baselineTheme);
    const settings = normalizeDeviceSettings({ ...current, ...patch }, phone.document.provisioning.baselineTheme);
    const updatedAt = this.now();
    const document: PhoneDocument = {
      ...phone.document,
      identity: { ...phone.document.identity, deviceName: settings.deviceName || null, updatedAt },
      provisioning: { ...phone.document.provisioning, baselineTheme: settings.theme },
      namespaces: { phone: { ...phone.document.namespaces.phone, settings } },
    };
    const updated = await this.documents.update({
      id: phone.record.id,
      packageId: PACKAGE_ID,
      expectedRevision: phone.record.revision,
      name: ownerKey(document.identity.ownerType, document.identity.ownerId),
      description: document.identity.ownerName,
      data: document,
      updatedAt,
    });
    if (!updated) return this.updateSettings(phoneId, patch);
    return parsePhoneRecord(updated);
  }

  async resetSettings(phoneId: string) {
    const phone = (await this.list()).find(({ document }) => document.identity.phoneId === phoneId);
    if (!phone) throw new Error("Phone not found");
    return this.updateSettings(phoneId, defaultDeviceSettings(phone.document.provisioning.baselineTheme));
  }
}
