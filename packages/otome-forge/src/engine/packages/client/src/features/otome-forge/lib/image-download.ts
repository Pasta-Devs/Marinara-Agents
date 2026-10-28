// ──────────────────────────────────────────────
// Otome Forge: saving an Album image to the device through the Engine's own gallery service
// (`host.services.imageDownloads`, capability API 1.385): the browser's download, the Android shell, or on an iPhone
// the share sheet, which needs the file fetched before the tap (ImageDownloadButton's and Gacha Forge's pattern).
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { host } from "marinara:host";

interface PreparedImageSave {
  blob: Blob;
  file: File;
  filename: string;
  url: string;
}

interface ImageDownloads {
  downloadUrlToDevice(url: string, filename: string): Promise<void>;
  prepareImageSave(url: string, filename: string): Promise<PreparedImageSave>;
  savePreparedImageToDevice(prepared: PreparedImageSave): Promise<void>;
  shouldUseIosImageShare(): boolean;
}

const METHODS = ["downloadUrlToDevice", "prepareImageSave", "savePreparedImageToDevice", "shouldUseIosImageShare"];

/** The Engine's image saving, or null on an Engine without it (the Album then offers no Save). */
export function imageDownloads(): ImageDownloads | null {
  const services = (host as Record<string, unknown>).services as Record<string, unknown> | undefined;
  const service = services?.imageDownloads as Record<string, unknown> | undefined;
  return service && METHODS.every((name) => typeof service[name] === "function")
    ? (service as unknown as ImageDownloads)
    : null;
}

/** The gallery file's own name when the URL has a usable one, else `fallback` with the URL's image extension. */
export function imageFilename(url: string, fallback: string): string {
  let last = "";
  try {
    last = decodeURIComponent(new URL(url, window.location.href).pathname.split("/").at(-1) ?? "");
  } catch {
    last = "";
  }
  if (/^[\w.-]{1,180}\.(?:png|jpe?g|webp|gif|avif)$/iu.test(last)) return last;
  const extension = /\.(png|jpe?g|webp|gif|avif)$/iu.exec(last)?.[1]?.toLowerCase() ?? "png";
  const base =
    fallback
      .replace(/[^\w.-]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 80) || "otome-forge";
  return `${base}.${extension}`;
}

export type DownloadState = "unavailable" | "preparing" | "ready" | "saving" | "failed";

/**
 * Save for one image. On an iPhone the file is fetched as soon as the image shows, so the tap itself can open the
 * share sheet (iOS needs the gesture), and a tap after that fetch failed fetches it again; elsewhere the tap fetches
 * and saves. `save` resolves to false when it failed (or only started the fetch again).
 */
export function useImageDownload(url: string | null, filename: string) {
  const service = imageDownloads();
  const ios = service?.shouldUseIosImageShare() ?? false;
  const [prepared, setPrepared] = useState<PreparedImageSave | null>(null);
  const [state, setState] = useState<DownloadState>("ready");
  // Bumped by a tap after the fetch failed, so it runs again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setPrepared(null);
    if (!url || !service || !ios) {
      setState("ready");
      return;
    }
    let live = true;
    setState("preparing");
    service.prepareImageSave(url, filename).then(
      (value) => {
        if (!live) return;
        setPrepared(value);
        setState("ready");
      },
      () => {
        if (live) setState("failed");
      },
    );
    return () => {
      live = false;
    };
    // The service is the Engine's frozen namespace: the same object on every render.
  }, [attempt, filename, ios, url]);

  const current = prepared && prepared.url === url && prepared.filename === filename ? prepared : null;

  const save = async (): Promise<boolean> => {
    if (!url || !service || state === "saving") return false;
    if (ios && !current) {
      if (state === "failed") setAttempt((count) => count + 1);
      return false;
    }
    setState("saving");
    try {
      // The prepared share stays inside this tap's stack, as the Engine's ImageDownloadButton keeps it.
      await (ios && current ? service.savePreparedImageToDevice(current) : service.downloadUrlToDevice(url, filename));
      setState("ready");
      return true;
    } catch (error) {
      console.warn("Otome Forge could not save an image", error);
      setState("failed");
      return false;
    }
  };

  return {
    save,
    state: !service || !url ? ("unavailable" as const) : state,
  };
}
