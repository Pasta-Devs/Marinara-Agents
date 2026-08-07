export interface PhoneStoreBackend {
  get(phoneId: string, appId: string, key: string): Promise<unknown>;
  set(phoneId: string, appId: string, key: string, value: unknown): Promise<void>;
  list(phoneId: string, appId: string, prefix: string): Promise<Array<{ key: string; value: unknown }>>;
  remove(phoneId: string, appId: string, key: string): Promise<void>;
}

function validateKey(key: string, allowEmpty = false) {
  if ((!allowEmpty && !key.trim()) || key.includes("\0") || key.length > 200) {
    throw new Error("Invalid phone store key");
  }
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

  /**
   * One round trip. The 256KB quota is enforced server-side in `writeAppStorage`, which is the
   * authoritative copy — doing the arithmetic here as well meant downloading all of this app's
   * storage before every write, so Notes cost two requests per keystroke.
   */
  set(key: string, value: unknown) {
    validateKey(key);
    return this.backend.set(this.phoneId, this.appId, key, value);
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
