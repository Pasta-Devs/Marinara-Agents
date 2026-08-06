import { ArrowLeft, X } from "lucide-react";

export function PhoneAppHeader({ title, titleId, closeLabel, onBack, onClose }: {
  title: string;
  titleId: string;
  closeLabel: string;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <header className="vp-app-header">
      <button type="button" aria-label="Back" onClick={onBack} className="vp-icon-btn"><ArrowLeft size="1rem" aria-hidden="true" /></button>
      <h2 id={titleId}>{title}</h2>
      <button type="button" aria-label={closeLabel} onClick={onClose} className="vp-icon-btn"><X size="1rem" aria-hidden="true" /></button>
    </header>
  );
}
