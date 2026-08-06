export interface NotificationRecord {
  id: string;
  appId: string;
  title: string;
  body: string;
  createdAt: number;
  acknowledged: boolean;
}

export class NotificationStore {
  private readonly records: NotificationRecord[] = [];

  add(record: Omit<NotificationRecord, "acknowledged">) {
    if (this.records.some((existing) => existing.id === record.id)) return;
    this.records.unshift({ ...record, acknowledged: false });
  }

  list(appId?: string) {
    return this.records.filter((record) => !appId || record.appId === appId).map((record) => ({ ...record }));
  }

  acknowledge(id: string) {
    const record = this.records.find((candidate) => candidate.id === id);
    if (record) record.acknowledged = true;
  }

  get unreadCount() {
    return this.records.filter((record) => !record.acknowledged).length;
  }
}
