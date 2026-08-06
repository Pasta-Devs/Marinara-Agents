export interface ContextValue {
  value: string;
  source: "device" | "persona" | "conversation" | "app";
  updatedAt: number;
}

const precedence = ["app", "conversation", "persona", "device"] as const;

export class ContextProjection {
  private readonly values = new Map<string, ContextValue[]>();

  set(key: string, entry: ContextValue) {
    const entries = this.values.get(key) ?? [];
    this.values.set(key, [...entries.filter((candidate) => candidate.source !== entry.source), entry]);
  }

  get(key: string) {
    const entries = this.values.get(key) ?? [];
    return [...entries].sort((a, b) => precedence.indexOf(a.source) - precedence.indexOf(b.source))[0] ?? null;
  }

  provenance(key: string) {
    return [...(this.values.get(key) ?? [])].sort((a, b) => precedence.indexOf(a.source) - precedence.indexOf(b.source));
  }
}
