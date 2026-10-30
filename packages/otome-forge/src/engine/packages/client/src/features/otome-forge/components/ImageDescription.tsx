import { useTranslation } from "react-i18next";

/** Existing visual intent, never a generated description or a request to paint. */
export function ImageDescription({ text }: { text?: string | null }) {
  const { t } = useTranslation();
  if (!text?.trim()) return null;
  return (
    <details
      className="of-image-description of-hint"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if ([" ", "Enter", "ArrowRight", "PageDown"].includes(event.key)) event.stopPropagation();
      }}
    >
      <summary>{t("ui.otomeForge.images.description")}</summary>
      <p
        role="region"
        aria-label={t("ui.otomeForge.images.description")}
        tabIndex={0}
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "min(10rem, 20dvh)", overflowY: "auto" }}
      >
        {text}
      </p>
    </details>
  );
}
