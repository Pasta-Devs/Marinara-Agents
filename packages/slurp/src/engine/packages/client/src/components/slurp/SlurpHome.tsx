import { useTranslation } from "react-i18next";
import type {
  SlurpNavigationState,
  SlurpSourceKind,
} from "./slurp-navigation.types";
import { useSlurpUIStore } from "../../stores/slurp-package.store";

type SlurpHomeProps = {
  navigation: SlurpNavigationState;
  onNavigate: (navigation: SlurpNavigationState) => void;
};

const SOURCE_KINDS: SlurpSourceKind[] = ["character", "persona"];

export function SlurpHome({ navigation, onNavigate }: SlurpHomeProps) {
  const { t } = useTranslation();
  const sourceKind = useSlurpUIStore((state) => state.sourceKind);
  const sourceEntityId = useSlurpUIStore((state) => state.sourceEntityId);
  const viewerPersonaId = useSlurpUIStore((state) => state.viewerPersonaId);
  const setSourceKind = useSlurpUIStore((state) => state.setSourceKind);
  const setSourceEntityId = useSlurpUIStore(
    (state) => state.setSourceEntityId,
  );

  const chooseSourceKind = (kind: SlurpSourceKind) => {
    setSourceKind(kind);
    onNavigate({ view: "home" });
  };

  return (
    <main
      className="h-full min-h-0 overflow-y-auto"
      data-slurp-view={navigation.view}
    >
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              {t("slurp.home.tabLabel")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--foreground)]">
              {t("slurp.home.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              {t("slurp.home.emptyDescription")}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
            {t("slurp.home.emptyStatus")}
          </span>
        </header>

        <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  {t("slurp.home.sourceHeading")}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  {t("slurp.home.sourceDescription")}
                </p>
              </div>
              <span className="rounded-md bg-[var(--secondary)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                {t("slurp.home.sourceRequired")}
              </span>
            </div>

            <div className="mt-5">
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {t("slurp.home.sourceKindLabel")}
              </span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {SOURCE_KINDS.map((kind) => {
                  const selected = sourceKind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseSourceKind(kind)}
                      className={`min-h-16 rounded-md border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                        selected
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]"
                          : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/60 hover:text-[var(--foreground)]"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {t(`slurp.home.sourceKinds.${kind}`)}
                      </span>
                      <span className="mt-1 block text-xs leading-5 opacity-80">
                        {t(`slurp.home.sourceKinds.${kind}Description`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {t("slurp.home.sourceEntityIdLabel")}
              </span>
              <input
                value={sourceEntityId ?? ""}
                onChange={(event) =>
                  setSourceEntityId(event.target.value.trim() || null)
                }
                disabled={!sourceKind}
                placeholder={t("slurp.home.sourceEntityIdPlaceholder")}
                className="mt-2 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                {t("slurp.home.sourcePlaceholder")}
              </p>
              <button
                type="button"
                disabled
                className="min-h-9 rounded-md bg-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary-foreground)] opacity-50"
              >
                {t("slurp.home.createProfile")}
              </button>
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                {t("slurp.home.previewTitle")}
              </h2>
              <div className="mt-4 rounded-md border border-dashed border-[var(--border)] bg-[var(--background)] p-4">
                {viewerPersonaId ? (
                  <>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {t("slurp.home.previewPersonaAvailable")}
                    </p>
                    <p className="mt-2 break-all text-xs leading-5 text-[var(--muted-foreground)]">
                      {t("slurp.home.previewPersonaId", {
                        id: viewerPersonaId,
                      })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {t("slurp.home.previewReadOnly")}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                      {t("slurp.home.previewReadOnlyDescription")}
                    </p>
                  </>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                {t("slurp.home.profilesTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {t("slurp.home.profilesEmptyDescription")}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
