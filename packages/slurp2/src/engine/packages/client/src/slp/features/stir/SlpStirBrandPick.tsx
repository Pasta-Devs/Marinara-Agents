import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { Toggle } from "../../modules/settings/SlpSettingsControls";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { useSlurpStirBrands } from "./slp-stir-hooks";

/** The brand's logo, or the initials of its first two words (the feed ad's avatar). */
export function SlpStirBrandLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return <Avatar account={{ displayName: name.split(/\s+/u).slice(0, 2).join(" "), avatarUrl: logoUrl }} size="sm" />;
}

/**
 * The brand deal card's product list (R decision): only products that fit the Creator (spice and
 * brand words), "Show all" reveals the rest, each with why it does not fit.
 */
export function SlpStirBrandPick({
  accountId,
  value,
  onChange,
}: {
  accountId: string;
  value: string | null;
  onChange: (productId: string) => void;
}) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const brands = useSlurpStirBrands(accountId);
  const rows = (brands.data?.brands ?? []).flatMap((brand) =>
    brand.products.map((product) => ({ brand, product, fits: product.fit === "fits" })),
  );
  const shown = rows.filter((row) => all || row.fits || row.product.id === value);
  const hidden = rows.length - rows.filter((row) => row.fits).length;
  return (
    <fieldset className="min-w-0 space-y-2" data-slp-stir-brands>
      <legend className={cn(SLP_TYPE.meta, "font-semibold")}>{t("ui.slurp.stir.form.product")}</legend>
      {brands.isLoading ? (
        <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.stir.looking")}</p>
      ) : brands.isError ? (
        <p role="alert" className={cn(SLP_TYPE.meta, "text-[var(--slurp-danger)]")}>
          {errorMessage(brands.error)}
        </p>
      ) : brands.data && !brands.data.adsOn ? (
        <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.stir.cant.adsOff")}</p>
      ) : (
        <>
          {shown.length === 0 && (
            <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
              {t(rows.length ? "ui.slurp.stir.form.noFitting" : "ui.slurp.stir.form.noProducts")}
            </p>
          )}
          <div className="space-y-1.5" role="radiogroup">
            {shown.map(({ brand, product, fits }) => {
              const on = value === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(product.id)}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-start ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
                    on
                      ? "bg-[image:var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45"
                      : "bg-[var(--slurp-canvas)] ring-[var(--slurp-outline)] hover:bg-[var(--accent)]",
                  )}
                >
                  <SlpStirBrandLogo name={brand.name} logoUrl={brand.logoUrl} />
                  <span className="min-w-0 flex-1">
                    <span className={cn(SLP_TYPE.body, "block truncate font-semibold")}>
                      {t("ui.slurp.stir.form.productRow", { brand: brand.name, product: product.name })}
                    </span>
                    <span className={cn(SLP_TYPE.meta, "block truncate text-[var(--slurp-muted)]")}>
                      {fits ? product.pitch : t(`ui.slurp.stir.fit.${product.fit ?? "offBrand"}`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {hidden > 0 && (
            <Toggle compact label={t("ui.slurp.stir.form.showAll", { count: hidden })} value={all} onChange={setAll} />
          )}
        </>
      )}
    </fieldset>
  );
}
