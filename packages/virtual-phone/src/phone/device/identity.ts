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

export interface ContactDocument {
  schemaVersion: 1;
  contactId: string;
  chatId: string;
  name: string;
  handle: string;
  bio: string;
  phoneLabel: string;
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
const CONTACT_KIND = "contact";

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

const APP_STORAGE_LIMIT = 256 * 1024;

function validateAppStorageId(value: string, field: string) {
  if (!value.trim() || value.includes("\0") || value.length > 200) throw new Error(`Invalid phone storage ${field}`);
}

function readAppStorage(document: PhoneDocument) {
  const storage = document.namespaces.phone.appStorage;
  return storage && typeof storage === "object" && !Array.isArray(storage)
    ? storage as Record<string, Record<string, unknown>>
    : {};
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

  async listContacts(chatId: string) {
    const normalizedChatId = normalizeRequiredString(chatId, "chatId");
    return (await this.documents.list(PACKAGE_ID, CONTACT_KIND))
      .filter((record) => {
        const data = record.data as Partial<ContactDocument>;
        return data.schemaVersion === 1 && data.chatId === normalizedChatId && typeof data.contactId === "string";
      })
      .map((record) => ({ record, document: record.data as ContactDocument }));
  }

  async createContact(input: { chatId: string; name: string; handle?: string; bio?: string; phoneLabel?: string }) {
    const chatId = normalizeRequiredString(input.chatId, "chatId");
    const name = normalizeRequiredString(input.name, "name").slice(0, 120);
    const timestamp = this.now();
    const document: ContactDocument = {
      schemaVersion: 1,
      contactId: this.createId(),
      chatId,
      name,
      handle: String(input.handle ?? "").trim().slice(0, 80),
      bio: String(input.bio ?? "").trim().slice(0, 500),
      phoneLabel: String(input.phoneLabel ?? "").trim().slice(0, 80),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const record = await this.documents.create({
      id: `contact:${document.contactId}`,
      packageId: PACKAGE_ID,
      kind: CONTACT_KIND,
      name: document.name,
      description: "Virtual Phone contact",
      data: document,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return { record, document };
  }

  async removeContact(contactId: string, chatId: string) {
    const contact = (await this.listContacts(chatId)).find(({ document }) => document.contactId === contactId);
    if (!contact) throw new Error("Contact not found");
    if (!await this.documents.remove(PACKAGE_ID, contact.record.id, contact.record.revision)) throw new Error("Contact changed; try again");
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
          baselineTheme: input.baselineTheme ?? "dark",
        },
        namespaces: { phone: { settings: defaultDeviceSettings(input.baselineTheme ?? "dark") } },
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

  /**
   * A one-line-ish read on the owner's relationship with technology, inferred from their card at
   * activation and reused on every generation afterwards. Generated once, not per request — this is
   * the fallback for the majority who will not write a lorebook entry, not a system in its own
   * right (see docs/app-plans/IMPLEMENTATION.md Step 7.3).
   */
  async setOwnerProfile(phoneId: string, profile: string) {
    const phone = await this.requirePhone(phoneId);
    const updatedAt = this.now();
    const document: PhoneDocument = {
      ...phone.document,
      namespaces: { phone: { ...phone.document.namespaces.phone, ownerProfile: profile.slice(0, 1200) } },
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
    if (!updated) return this.setOwnerProfile(phoneId, profile);
    return parsePhoneRecord(updated);
  }

  /**
   * What the owner did on the phone that the story has not been told about yet.
   *
   * The phone is part of the roleplay, not a side panel: if you photograph something, look
   * something up or send a letter, the scene should be able to react. Entries accumulate here and
   * are flushed as ONE quiet line when the phone is put down — a message per action would flood
   * the chat, and nothing in the Engine renders `extra.virtualPhone` specially, so every write is
   * visible to the reader.
   */
  async appendActivity(phoneId: string, chatId: string, text: string) {
    const phone = await this.requirePhone(phoneId);
    const existing = Array.isArray(phone.document.namespaces.phone.activity)
      ? phone.document.namespaces.phone.activity as Array<{ at: string; chatId: string; text: string }>
      : [];
    const entry = { at: this.now(), chatId, text: text.slice(0, 240) };
    const document: PhoneDocument = {
      ...phone.document,
      namespaces: { phone: { ...phone.document.namespaces.phone, activity: [...existing, entry].slice(-40) } },
    };
    const updated = await this.documents.update({
      id: phone.record.id,
      packageId: PACKAGE_ID,
      expectedRevision: phone.record.revision,
      name: ownerKey(document.identity.ownerType, document.identity.ownerId),
      description: document.identity.ownerName,
      data: document,
      updatedAt: entry.at,
    });
    if (!updated) return this.appendActivity(phoneId, chatId, text);
    return parsePhoneRecord(updated);
  }

  /** Reads and clears the pending activity for one chat. Clearing is what makes the flush once-only. */
  async takeActivity(phoneId: string, chatId: string) {
    const phone = await this.requirePhone(phoneId);
    const existing = Array.isArray(phone.document.namespaces.phone.activity)
      ? phone.document.namespaces.phone.activity as Array<{ at: string; chatId: string; text: string }>
      : [];
    const mine = existing.filter((entry) => entry.chatId === chatId);
    if (mine.length === 0) return [];
    const document: PhoneDocument = {
      ...phone.document,
      namespaces: {
        phone: { ...phone.document.namespaces.phone, activity: existing.filter((entry) => entry.chatId !== chatId) },
      },
    };
    const updated = await this.documents.update({
      id: phone.record.id,
      packageId: PACKAGE_ID,
      expectedRevision: phone.record.revision,
      name: ownerKey(document.identity.ownerType, document.identity.ownerId),
      description: document.identity.ownerName,
      data: document,
      updatedAt: this.now(),
    });
    if (!updated) return this.takeActivity(phoneId, chatId);
    return mine;
  }

  private async requirePhone(phoneId: string) {
    const phone = (await this.list()).find(({ document }) => document.identity.phoneId === phoneId);
    if (!phone) throw new Error("Phone not found");
    return phone;
  }

  private async writeAppStorage(phoneId: string, appId: string, mutate: (app: Record<string, unknown>) => Record<string, unknown>) {
    validateAppStorageId(appId, "appId");
    const phone = await this.requirePhone(phoneId);
    const all = readAppStorage(phone.document);
    const app = mutate({ ...(all[appId] ?? {}) });
    if (new TextEncoder().encode(JSON.stringify(app)).byteLength > APP_STORAGE_LIMIT) {
      throw new Error("Phone app storage exceeds 256KB");
    }
    const document: PhoneDocument = {
      ...phone.document,
      namespaces: { phone: { ...phone.document.namespaces.phone, appStorage: { ...all, [appId]: app } } },
    };
    const updated = await this.documents.update({
      id: phone.record.id,
      packageId: PACKAGE_ID,
      expectedRevision: phone.record.revision,
      name: ownerKey(document.identity.ownerType, document.identity.ownerId),
      description: document.identity.ownerName,
      data: document,
      updatedAt: this.now(),
    });
    if (!updated) return this.writeAppStorage(phoneId, appId, mutate);
    return parsePhoneRecord(updated);
  }

  async listAppStorage(phoneId: string, appId: string) {
    validateAppStorageId(appId, "appId");
    const phone = await this.requirePhone(phoneId);
    return Object.entries(readAppStorage(phone.document)[appId] ?? {}).map(([key, value]) => ({ key, value }));
  }

  async getAppStorageKey(phoneId: string, appId: string, key: string) {
    validateAppStorageId(appId, "appId");
    validateAppStorageId(key, "key");
    const phone = await this.requirePhone(phoneId);
    return readAppStorage(phone.document)[appId]?.[key] ?? null;
  }

  async setAppStorageKey(phoneId: string, appId: string, key: string, value: unknown) {
    validateAppStorageId(key, "key");
    if (JSON.stringify(value) === undefined) throw new Error("Phone store values must be JSON");
    return this.writeAppStorage(phoneId, appId, (app) => ({ ...app, [key]: value }));
  }

  async removeAppStorageKey(phoneId: string, appId: string, key: string) {
    validateAppStorageId(key, "key");
    return this.writeAppStorage(phoneId, appId, ({ [key]: _removed, ...rest }) => rest);
  }

  async resetSettings(phoneId: string) {
    const phone = (await this.list()).find(({ document }) => document.identity.phoneId === phoneId);
    if (!phone) throw new Error("Phone not found");
    return this.updateSettings(phoneId, defaultDeviceSettings(phone.document.provisioning.baselineTheme));
  }
}
