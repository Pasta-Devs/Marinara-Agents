import { api } from "../../../lib/api-client.js";

export type SlurpBackupJob = {
  id: string;
  kind: "export" | "restore";
  state: "queued" | "preparing" | "writing" | "completed" | "error";
  stage: string;
  detail: string;
  creators: number;
  posts: number;
  interactions: number;
  mediaFiles: number;
  mediaCompleted: number;
  mediaBytes: number;
  archiveBytes: number;
  skipped: string[];
  error: string | null;
};
export type SlurpRestoreInspection = {
  id: string;
  expiresAt: string;
  sourcePackage: "slurp" | "slurp2";
  exportedAt: string | null;
  creators: number;
  posts: number;
  interactions: number;
  mediaFiles: number;
  mediaBytes: number;
  hasSlurp2Settings: boolean;
};
const backupError = async (response: Response, fallback: string): Promise<never> => {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? fallback);
};
export async function startSlurpBackup(): Promise<SlurpBackupJob> {
  const response = await api.raw("/slurp2/backup/jobs", { method: "POST" });
  if (!response.ok) return backupError(response, "Could not start the Slurp backup.");
  return response.json() as Promise<SlurpBackupJob>;
}
export async function getSlurpBackupJob(id: string): Promise<SlurpBackupJob> {
  const response = await api.raw(`/slurp2/backup/jobs/${encodeURIComponent(id)}`);
  if (!response.ok) return backupError(response, "Could not read the backup status.");
  return response.json() as Promise<SlurpBackupJob>;
}
export async function downloadSlurpBackup(id: string): Promise<void> {
  const response = await api.raw(`/slurp2/backup/jobs/${encodeURIComponent(id)}/download`);
  if (!response.ok) return backupError(response, "Could not download the Slurp backup.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "slurp2-backup.zip";
  anchor.click();
  URL.revokeObjectURL(url);
}
/** Upload an archive and start the restore. The reply is the job to poll, not the result. */
export async function startSlurpRestore(archive: File | Blob, importSettings = false): Promise<SlurpBackupJob> {
  const response = await api.raw(`/slurp2/restore/jobs${importSettings ? "?importSettings=1" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: archive,
  });
  if (!response.ok) return backupError(response, "Could not start the Slurp restore.");
  return response.json() as Promise<SlurpBackupJob>;
}
export async function inspectSlurpRestore(archive: File | Blob): Promise<SlurpRestoreInspection> {
  const response = await api.raw("/slurp2/restore/inspections", {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: archive,
  });
  if (!response.ok) return backupError(response, "Could not inspect the Slurp restore.");
  return response.json() as Promise<SlurpRestoreInspection>;
}
export async function applySlurpRestoreInspection(
  inspectionId: string,
  importSettings = false,
): Promise<SlurpBackupJob> {
  const response = await api.raw(
    `/slurp2/restore/inspections/${encodeURIComponent(inspectionId)}/apply${importSettings ? "?importSettings=1" : ""}`,
    { method: "POST" },
  );
  if (!response.ok) return backupError(response, "Could not start the inspected Slurp restore.");
  return response.json() as Promise<SlurpBackupJob>;
}
export async function discardSlurpRestoreInspection(inspectionId: string): Promise<void> {
  await api.raw(`/slurp2/restore/inspections/${encodeURIComponent(inspectionId)}`, { method: "DELETE" });
}
