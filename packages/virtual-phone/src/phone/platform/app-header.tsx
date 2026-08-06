import { ArrowLeft, X } from "lucide-react";

export function PhoneAppHeader({ title, titleId, closeLabel, onClose }: {
  title: string;
  titleId: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <header className="mb-5 flex min-h-11 items-center justify-between gap-3">
      <button type="button" aria-label="Back to Home" onClick={onClose} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]"><ArrowLeft size="1rem" aria-hidden="true" /></button>
      <h2 id={titleId} className="min-w-0 flex-1 text-center text-sm font-semibold">{title}</h2>
      <button type="button" aria-label={closeLabel} onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]"><X size="1rem" aria-hidden="true" /></button>
    </header>
  );
}
