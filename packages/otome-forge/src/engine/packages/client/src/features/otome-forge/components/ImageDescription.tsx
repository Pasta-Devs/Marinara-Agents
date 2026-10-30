import { useTranslation } from "react-i18next";

/** Existing visual intent, never a generated description or a request to paint. */
export function ImageDescription({ text }: { text?: string | null }) {
  const { t } = useTranslation();
  if (!text?.trim()) return null;
  return (
    <details className="of-image-description of-hint" onClick={(event) => event.stopPropagation()}>
      <summary>{t("ui.otomeForge.images.description")}</summary>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text}</p>
    </details>
  );
}
