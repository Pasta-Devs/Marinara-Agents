export interface PhoneStoreBackend {
  get(phoneId: string, appId: string, key: string): Promise<unknown>;
  set(phoneId: string, appId: string, key: string, value: unknown): Promise<void>;
  list(phoneId: string, appId: string, prefix: string): Promise<Array<{ key: string; value: unknown }>>;
  remove(phoneId: string, appId: string, key: string): Promise<void>;
}

const MAX_BYTES = 256 * 1024;
const encoder = new TextEncoder();

function validateKey(key: string, allowEmpty = false) {
  if ((!allowEmpty && !key.trim()) || key.includes("\0") || key.length > 200) {
    throw new Error("Invalid phone store key");
  }
}

function jsonBytes(value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Phone store values must be JSON");
  return encoder.encode(serialized).byteLength;
}

export class PhoneStore {
  constructor(
    private readonly backend: PhoneStoreBackend,
    private readonly phoneId: string,
    private readonly appId: string,
  ) {}

  get(key: string) {
    validateKey(key);
    return this.backend.get(this.phoneId, this.appId, key);
  }

  async set(key: string, value: unknown) {
    validateKey(key);
    const entries = await this.backend.list(this.phoneId, this.appId, "");
    const bytes = entries
      .filter((entry) => entry.key !== key)
      .reduce((total, entry) => total + jsonBytes(entry.key) + jsonBytes(entry.value), 0);
    if (bytes + jsonBytes(key) + jsonBytes(value) > MAX_BYTES) {
      throw new Error("Phone app storage exceeds 256KB");
    }
    await this.backend.set(this.phoneId, this.appId, key, value);
  }

  list(prefix = "") {
    validateKey(prefix, true);
    return this.backend.list(this.phoneId, this.appId, prefix);
  }

  remove(key: string) {
    validateKey(key);
    return this.backend.remove(this.phoneId, this.appId, key);
  }
}
