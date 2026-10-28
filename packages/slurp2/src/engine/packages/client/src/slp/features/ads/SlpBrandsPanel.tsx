// Brands and their products in Backstage › Ads (R): who sponsors your Creators and what the feed
// advertises. A brand holds products; switch a brand off and none of its products show or sponsor
// anyone. Logos and product pictures come from an upload or the AI picture assist (3c).
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, Image, Pencil, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SlurpMediaImg } from "../../base/chrome/SlpChrome";
import type { SlurpContentRating } from "../../base/state/slp-state-types";
import { SlpButton, SlpPrimaryButton, SlpSegment, slpTagClass } from "../../modules/chrome/SlpButton";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { runSlpAction, SlpPictureAssist } from "../assist/slp-assist-contract";
import type { SlurpPromotion } from "./slp-ads-contract";
import { useDeleteSlurpAd, useGenerateSlurpAdImage } from "./slp-ads-hooks";
import {
  readSlurpPictureFile,
  slurpPictureAsDataUrl,
  useCreateSlurpBrand,
  useCreateSlurpProduct,
  useDeleteSlurpBrand,
  useSetSlurpProductPicture,
  useSlurpBrands,
  useUpdateSlurpBrand,
  useUpdateSlurpProduct,
  type SlurpBrand,
  type SlurpBrandInput,
  type SlurpProductInput,
} from "./slp-brands-hooks";

const INPUT =
  "min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm";
const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] disabled:opacity-50";
const PRICE_FEELS = ["budget", "everyday", "premium"] as const;
const SPICE_FITS: readonly SlurpContentRating[] = ["tame", "suggestive", "explicit"];
/** Pictures are sent as data URLs; a phone photo stays well under this. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function SlpBrandsPanel({ actions }: { actions?: ReactNode }) {
  const { t } = useTranslation();
  const brands = useSlurpBrands();
  const createBrand = useCreateSlurpBrand();
  const [adding, setAdding] = useState(false);
  const items = brands.data?.items ?? [];
  const on = items.filter((brand) => !brand.disabledAt).length;
  return (
    <section aria-labelledby="slp-brands-title" className="rounded-xl border border-[var(--slurp-outline)] p-4">
      <h2 id="slp-brands-title" className="text-sm font-bold">
        {t("ui.slurp.settings.brands.title")}
      </h2>
      <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
        {t("ui.slurp.settings.brands.detail", { count: items.length, on })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <SlpButton onClick={() => setAdding((open) => !open)} aria-expanded={adding} className="min-h-10 px-4 text-xs">
          <Plus size={14} aria-hidden="true" />
          {t("ui.slurp.settings.brands.add")}
        </SlpButton>
        {actions}
      </div>
      {adding && (
        <BrandForm
          initial={{ name: "", category: "", tone: "", logoPrompt: "" }}
          pending={createBrand.isPending}
          submitLabel={t("ui.slurp.settings.brands.addSubmit")}
          onCancel={() => setAdding(false)}
          onSubmit={(input) =>
            createBrand.mutate(input, {
              onSuccess: () => {
                toast.success(t("ui.slurp.settings.brands.added", { brand: input.name }));
                setAdding(false);
              },
              onError: (error) => toast.error(errorMessage(error)),
            })
          }
        />
      )}
      {brands.isLoading ? (
        <p role="status" className="mt-4 text-xs text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.brands.loading")}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.brands.empty")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BrandLogo({ brand, size = "size-11" }: { brand: Pick<SlurpBrand, "name" | "logoUrl">; size?: string }) {
  return brand.logoUrl ? (
    <SlurpMediaImg src={brand.logoUrl} alt="" className={cn(size, "slp-crop-top shrink-0 rounded-xl object-cover")} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        size,
        "flex shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(120deg,color-mix(in_srgb,var(--noodle-accent)_22%,var(--slurp-canvas)),color-mix(in_srgb,var(--slurp-violet)_18%,var(--slurp-canvas)))] text-lg font-black text-[var(--slurp-text)]",
      )}
    >
      {brand.name.charAt(0).toUpperCase()}
    </span>
  );
}

function BrandCard({ brand }: { brand: SlurpBrand }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [picture, setPicture] = useState(false);
  const [adding, setAdding] = useState(false);
  const update = useUpdateSlurpBrand();
  const remove = useDeleteSlurpBrand();
  const createProduct = useCreateSlurpProduct();
  const enabled = !brand.disabledAt;
  const live = brand.products.filter((product) => !product.retiredAt).length;
  const toggle = (next: boolean) =>
    update.mutate(
      { id: brand.id, enabled: next },
      {
        onSuccess: () =>
          toast.success(
            t(next ? "ui.slurp.settings.brands.turnedOn" : "ui.slurp.settings.brands.turnedOff", { brand: brand.name }),
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  return (
    <li
      className={cn(
        "rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]",
        !enabled && "opacity-70",
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <BrandLogo brand={brand} />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{brand.name}</span>
            <span className="block truncate text-xs text-[var(--slurp-muted)]">
              {[brand.category, t("ui.slurp.settings.brands.products", { count: live })].filter(Boolean).join(" · ")}
            </span>
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn("shrink-0 text-[var(--slurp-muted)] transition-transform", open && "rotate-180")}
          />
        </button>
        <label className="relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
          <span className="sr-only">{t("ui.slurp.settings.brands.switch", { brand: brand.name })}</span>
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            disabled={update.isPending}
            onChange={(event) => toggle(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-7 w-12 shrink-0 rounded-full bg-[var(--muted-foreground)]/25 shadow-inner transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[var(--noodle-accent)] peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:after:transition-none"
          />
        </label>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--slurp-outline)] p-3">
          {!enabled && (
            <p className="text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.brands.offNote")}</p>
          )}
          {brand.tone && !editing && (
            <p className="text-xs italic leading-5 text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.brands.toneLine", { tone: brand.tone })}
            </p>
          )}
          {editing ? (
            <BrandForm
              initial={brand}
              pending={update.isPending}
              submitLabel={t("ui.slurp.settings.ads.editSubmit")}
              onCancel={() => setEditing(false)}
              onSubmit={(input) =>
                update.mutate(
                  { id: brand.id, ...input },
                  {
                    onSuccess: () => {
                      toast.success(t("ui.slurp.settings.ads.edited", { brand: input.name }));
                      setEditing(false);
                    },
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <SlpButton variant="quiet" onClick={() => setEditing(true)} className="min-h-10 px-4 text-xs">
                <Pencil size={14} aria-hidden="true" />
                {t("ui.slurp.settings.brands.edit")}
              </SlpButton>
              <SlpButton
                variant="quiet"
                aria-expanded={picture}
                onClick={() => setPicture((value) => !value)}
                className="min-h-10 px-4 text-xs"
              >
                <Image size={14} aria-hidden="true" />
                {t(brand.logoUrl ? "ui.slurp.settings.brands.changeLogo" : "ui.slurp.settings.brands.addLogo")}
              </SlpButton>
              {brand.origin !== "builtin" && (
                <SlpButton
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(brand.id, {
                      onSuccess: () => toast.success(t("ui.slurp.settings.brands.deleted", { brand: brand.name })),
                      onError: (error) => toast.error(errorMessage(error)),
                    })
                  }
                  className="min-h-10 px-4 text-xs"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {t("ui.slurp.settings.brands.delete")}
                </SlpButton>
              )}
            </div>
          )}
          {picture && (
            <PicturePanel
              kind="logo"
              brandId={brand.id}
              currentUrl={brand.logoUrl}
              onSave={(image) => update.mutateAsync({ id: brand.id, logo: image })}
              onClose={() => setPicture(false)}
            />
          )}
          <ul className="space-y-2">
            {brand.products.map((product) => (
              <ProductRow key={product.id} brandId={brand.id} product={product} />
            ))}
          </ul>
          {adding ? (
            <ProductForm
              initial={{ product: "", copy: "", priceFeel: "everyday", contentRating: "tame", look: "" }}
              pending={createProduct.isPending}
              submitLabel={t("ui.slurp.settings.brands.addProductSubmit")}
              onCancel={() => setAdding(false)}
              onSubmit={(input) =>
                createProduct.mutate(
                  { brandId: brand.id, ...input },
                  {
                    onSuccess: () => {
                      toast.success(t("ui.slurp.settings.brands.productAdded", { product: input.product }));
                      setAdding(false);
                    },
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }
            />
          ) : (
            <SlpButton onClick={() => setAdding(true)} className="min-h-10 px-4 text-xs">
              <Plus size={14} aria-hidden="true" />
              {t("ui.slurp.settings.brands.addProduct")}
            </SlpButton>
          )}
        </div>
      )}
    </li>
  );
}

function ProductRow({ brandId, product }: { brandId: string; product: SlurpPromotion }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [picture, setPicture] = useState(false);
  const update = useUpdateSlurpProduct();
  const setImage = useSetSlurpProductPicture();
  const rating = product.contentRating ?? "tame";
  const restore = () =>
    update.mutate(
      { id: product.id, retiredAt: null },
      {
        onSuccess: () => toast.success(t("ui.slurp.settings.ads.restored", { brand: product.product })),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  return (
    <li className="rounded-lg bg-[var(--slurp-canvas)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      <div className="flex gap-3 p-2.5">
        {product.imageUrl ? (
          <SlurpMediaImg
            src={product.imageUrl}
            alt=""
            loading="lazy"
            className="slp-crop-top h-20 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--slurp-surface-raised)] text-[var(--slurp-muted)]"
          >
            <Image size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{product.product}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--slurp-muted)]">{product.copy}</p>
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={slpTagClass()}>
              {t(`ui.slurp.settings.brands.price.${product.priceFeel ?? "everyday"}`)}
            </span>
            <span className={slpTagClass(rating !== "tame")}>{t(`ui.slurp.settings.brands.spice.${rating}`)}</span>
            {product.retiredAt && <span className={slpTagClass()}>{t("ui.slurp.settings.ads.retired")}</span>}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-0.5 border-t border-[var(--noodle-divider)] px-1.5 py-1">
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          aria-label={t("ui.slurp.settings.ads.editAd", { brand: product.product })}
          title={t("ui.slurp.settings.ads.editAd", { brand: product.product })}
          className={ICON_BUTTON}
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-expanded={picture}
          onClick={() => setPicture((value) => !value)}
          aria-label={t("ui.slurp.settings.brands.productPicture", { product: product.product })}
          title={t("ui.slurp.settings.brands.productPicture", { product: product.product })}
          className={ICON_BUTTON}
        >
          <Image size={15} aria-hidden="true" />
        </button>
        {product.retiredAt ? (
          <button
            type="button"
            disabled={update.isPending}
            onClick={restore}
            aria-label={t("ui.slurp.settings.ads.restoreAd", { brand: product.product })}
            title={t("ui.slurp.settings.ads.restoreAd", { brand: product.product })}
            className={ICON_BUTTON}
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        ) : (
          <RemoveProduct product={product} />
        )}
      </div>
      {editing && (
        <div className="border-t border-[var(--noodle-divider)] p-2.5">
          <ProductForm
            initial={{
              product: product.product,
              copy: product.copy,
              priceFeel: product.priceFeel ?? "everyday",
              contentRating: rating,
              look: product.look ?? "",
            }}
            pending={update.isPending}
            submitLabel={t("ui.slurp.settings.ads.editSubmit")}
            onCancel={() => setEditing(false)}
            onSubmit={(input) =>
              update.mutate(
                { id: product.id, ...input },
                {
                  onSuccess: () => {
                    toast.success(t("ui.slurp.settings.ads.edited", { brand: input.product }));
                    setEditing(false);
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          />
        </div>
      )}
      {picture && (
        <div className="border-t border-[var(--noodle-divider)] p-2.5">
          <PicturePanel
            kind="product"
            brandId={brandId}
            productId={product.id}
            currentUrl={product.imageUrl}
            onSave={(image) => setImage.mutateAsync({ id: product.id, image })}
            onClose={() => setPicture(false)}
          />
        </div>
      )}
    </li>
  );
}

/** Hide a shipped product (it can come back) or delete one of your own. */
function RemoveProduct({ product }: { product: SlurpPromotion }) {
  const { t } = useTranslation();
  const remove = useDeleteSlurpAd();
  const builtin = product.origin === "builtin";
  const label = t(`ui.slurp.settings.ads.${builtin ? "hideAd" : "deleteAd"}`, { brand: product.product });
  return (
    <button
      type="button"
      disabled={remove.isPending}
      onClick={() =>
        remove.mutate(product.id, {
          onSuccess: () =>
            toast.success(
              t(`ui.slurp.settings.ads.${builtin ? "hiddenBuiltin" : "deleted"}`, { brand: product.product }),
            ),
          onError: (error) => toast.error(errorMessage(error)),
        })
      }
      aria-label={label}
      title={label}
      className={cn(ICON_BUTTON, "hover:text-[var(--slurp-danger)]")}
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  max,
  required = false,
  multiline = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-semibold">{label}</span>
      {multiline ? (
        <textarea
          rows={2}
          required={required}
          maxLength={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(INPUT, "py-2")}
        />
      ) : (
        <input
          required={required}
          maxLength={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={INPUT}
        />
      )}
      {hint && <span className="block text-xs leading-5 text-[var(--slurp-muted)]">{hint}</span>}
    </label>
  );
}

function FormButtons({
  pending,
  submitLabel,
  onCancel,
}: {
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <SlpButton variant="tertiary" onClick={onCancel} className="min-h-10 text-xs">
        {t("ui.slurp.settings.ads.editCancel")}
      </SlpButton>
      <SlpPrimaryButton type="submit" disabled={pending} className="min-h-10 px-5 text-xs">
        {submitLabel}
      </SlpPrimaryButton>
    </div>
  );
}

function BrandForm({
  initial,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: SlurpBrandInput;
  pending: boolean;
  submitLabel: string;
  onSubmit: (input: SlurpBrandInput) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SlurpBrandInput>({
    name: initial.name,
    category: initial.category,
    tone: initial.tone,
    logoPrompt: initial.logoPrompt,
  });
  const set = (key: keyof SlurpBrandInput) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <form
      className="mt-3 space-y-3 rounded-lg border border-[var(--slurp-outline)] p-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t("ui.slurp.settings.brands.name")}
          value={draft.name}
          onChange={set("name")}
          max={80}
          required
        />
        <TextField
          label={t("ui.slurp.settings.brands.category")}
          hint={t("ui.slurp.settings.brands.categoryHint")}
          value={draft.category}
          onChange={set("category")}
          max={40}
        />
      </div>
      <TextField
        label={t("ui.slurp.settings.brands.tone")}
        hint={t("ui.slurp.settings.brands.toneHint")}
        value={draft.tone}
        onChange={set("tone")}
        max={300}
        multiline
      />
      <TextField
        label={t("ui.slurp.settings.brands.logoPrompt")}
        hint={t("ui.slurp.settings.brands.logoPromptHint")}
        value={draft.logoPrompt}
        onChange={set("logoPrompt")}
        max={400}
      />
      <FormButtons pending={pending} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}

function ProductForm({
  initial,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: SlurpProductInput;
  pending: boolean;
  submitLabel: string;
  onSubmit: (input: SlurpProductInput) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const set = (key: "product" | "copy" | "look") => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return (
    <form
      className="space-y-3 rounded-lg border border-[var(--slurp-outline)] p-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <TextField
        label={t("ui.slurp.settings.brands.productName")}
        value={draft.product}
        onChange={set("product")}
        max={120}
        required
      />
      <TextField
        label={t("ui.slurp.settings.brands.pitch")}
        hint={t("ui.slurp.settings.brands.pitchHint")}
        value={draft.copy}
        onChange={set("copy")}
        max={600}
        required
        multiline
      />
      <div className="space-y-1">
        <span className="block text-xs font-semibold">{t("ui.slurp.settings.brands.priceFeel")}</span>
        <SlpSegment
          label={t("ui.slurp.settings.brands.priceFeel")}
          options={PRICE_FEELS.map((value) => ({ value, label: t(`ui.slurp.settings.brands.price.${value}`) }))}
          value={draft.priceFeel}
          onChange={(priceFeel) => setDraft((current) => ({ ...current, priceFeel }))}
        />
      </div>
      <div className="space-y-1">
        <span className="block text-xs font-semibold">{t("ui.slurp.settings.brands.spiceFit")}</span>
        <SlpSegment
          label={t("ui.slurp.settings.brands.spiceFit")}
          options={SPICE_FITS.map((value) => ({ value, label: t(`ui.slurp.settings.brands.spice.${value}`) }))}
          value={draft.contentRating}
          onChange={(contentRating) => setDraft((current) => ({ ...current, contentRating }))}
        />
        <span className="block text-xs leading-5 text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.brands.spiceFitHint")}
        </span>
      </div>
      <TextField
        label={t("ui.slurp.settings.brands.look")}
        hint={t("ui.slurp.settings.brands.lookHint")}
        value={draft.look}
        onChange={set("look")}
        max={400}
      />
      <FormButtons pending={pending} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}

/**
 * A logo or product picture: upload one, or describe it and let Slurp draw it (the 3c picture assist).
 * Every save can be undone once: the picture from before is read back and put in again.
 */
function PicturePanel({
  kind,
  brandId,
  productId,
  currentUrl,
  onSave,
  onClose,
}: {
  kind: "logo" | "product";
  brandId: string;
  productId?: string;
  currentUrl?: string | null;
  onSave: (image: string | null) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const before = useRef<string | null | undefined>(undefined);
  const generate = useGenerateSlurpAdImage();
  const [busy, setBusy] = useState(false);
  /** Keeps the first "before" picture, so Undo after a Retry still goes back to where it started. */
  const save = async (image: string) => {
    if (before.current === undefined) before.current = await slurpPictureAsDataUrl(currentUrl);
    await onSave(image);
  };
  const undo = async () => {
    await onSave(before.current ?? null);
    before.current = undefined;
  };
  const upload = async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) return toast.error(t("ui.slurp.settings.brands.tooBig"));
    setBusy(true);
    try {
      await save(await readSlurpPictureFile(file));
      toast.success(t("ui.slurp.settings.brands.pictureSaved"), {
        action: {
          label: t("ui.slurp.assist.undo"),
          onClick: () => void undo().catch((error) => toast.error(errorMessage(error))),
        },
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-xl bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--noodle-accent)]/35">
      <p className="text-sm font-bold">
        {t(kind === "logo" ? "ui.slurp.settings.brands.logoTitle" : "ui.slurp.settings.brands.productPictureTitle")}
      </p>
      <div className="flex flex-wrap gap-2">
        <SlpButton disabled={busy} onClick={() => fileRef.current?.click()} className="min-h-10 px-4 text-xs">
          <Upload size={14} aria-hidden="true" />
          {t("ui.slurp.settings.brands.upload")}
        </SlpButton>
        {kind === "product" && productId && (
          <SlpButton
            variant="quiet"
            disabled={generate.isPending}
            onClick={() =>
              generate.mutate(productId, {
                onSuccess: () => toast.success(t("ui.slurp.settings.ads.imageGenerated")),
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
            className="min-h-10 px-4 text-xs"
          >
            <Image size={14} aria-hidden="true" />
            {generate.isPending ? t("ui.slurp.settings.brands.drawingBoth") : t("ui.slurp.settings.brands.drawBoth")}
          </SlpButton>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      {kind === "product" && (
        <p className="text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.brands.drawBothDetail")}</p>
      )}
      <SlpPictureAssist
        accountId={brandId}
        target={kind === "logo" ? "avatar" : "post"}
        placeholder={t(kind === "logo" ? "ui.slurp.settings.brands.logoAsk" : "ui.slurp.settings.brands.productAsk")}
        drawWith={(request) => runSlpAction("draw-brand-picture", { brandId, productId, request })}
        onUse={(image) => void save(image).catch((error) => toast.error(errorMessage(error)))}
        onUndo={() => void undo().catch((error) => toast.error(errorMessage(error)))}
        onDone={onClose}
        onCancel={onClose}
      />
    </div>
  );
}
