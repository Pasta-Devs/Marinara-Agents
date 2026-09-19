import { Check, ChevronRight, Loader2, Search } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { NoodleIdentityDisclosure } from "@marinara-engine/shared";
import { disclosureOptions, WizardFooter } from "../../features/creators/SlpStageProfileForm";
import { fieldClass, SourceAccountAvatar } from "./SlpHomeHelpers";

export function StageProfileSourcePicker({
  accounts,
  search,
  kind,
  selectedId,
  onSearch,
  onKindChange,
  onSelect,
  hasMore,
  isLoadingMore,
  isLoading,
  isError,
  onRetry,
  onLoadMore,
  onBack,
  onContinue,
}: {
  accounts: Array<{
    id: string;
    kind: "character" | "persona" | "random_user";
    displayName: string;
    handle: string;
    bio: string;
    avatarUrl: string | null;
  }>;
  search: string;
  kind: "all" | "character" | "persona";
  selectedId: string | null;
  onSearch: (value: string) => void;
  onKindChange: (value: "all" | "character" | "persona") => void;
  onSelect: (id: string) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <div className="px-4 py-5 sm:px-6 @min-[1024px]:py-6">
        <h2 className="text-xl font-black">
          {localizeUi("ui.noodle.stageprofilesourcepicker.chooseASourceCharacterOrPersona")}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.stageprofilesourcepicker.noodlerWillCreateASeparateStageIdentityFromThis")}
        </p>
        <label className="relative mt-5 block">
          <Search size={16} className="absolute left-3 top-3 !text-[var(--noodle-accent)]" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={localizeUi("ui.noodle.stageprofilesourcepicker.searchCharactersAndPersonas")}
            className={`${fieldClass} pl-9`}
          />
        </label>
        {selectedId && !accounts.some((account) => account.id === selectedId) && (
          <p className="mt-3 rounded-lg border border-[var(--noodle-accent)]/40 bg-[var(--noodle-accent)]/10 p-3 text-xs leading-5 text-[var(--foreground)]">
            {localizeUi("ui.noodle.stageprofilesourcepicker.aSelectedSourceIsHiddenByTheCurrentSearch")}
          </p>
        )}
        {isLoading ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[var(--noodle-divider)] py-12 text-sm text-[var(--muted-foreground)]">
            <Loader2 size={18} className="animate-spin" />{" "}
            {localizeUi("ui.noodle.stageprofilesourcepicker.loadingSources")}
          </div>
        ) : isError ? (
          <div className="mt-4 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-6 text-center">
            <p className="text-sm font-semibold">
              {localizeUi("ui.noodle.stageprofilesourcepicker.sourcesCouldNotBeLoaded")}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 min-h-11 rounded-lg border border-[var(--noodle-divider)] px-4 text-sm font-semibold hover:bg-[var(--accent)]"
            >
              {localizeUi("capabilities.actions.tryAgain")}
            </button>
          </div>
        ) : (
          <div
            className="mt-3 grid grid-cols-3 rounded-lg border border-[var(--noodle-divider)] p-1"
            aria-label={localizeUi("ui.noodle.stageprofilesourcepicker.filterProfileSources")}
          >
            {(["all", "character", "persona"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={kind === option}
                onClick={() => onKindChange(option)}
                className={`min-h-11 rounded-lg px-2 text-xs font-semibold capitalize ${kind === option ? "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"}`}
              >
                {option === "all"
                  ? localizeUi("ui.noodle.stageprofilesourcepicker.all")
                  : option === "character"
                    ? localizeUi("navigation.topbar.characters")
                    : localizeUi("navigation.topbar.personas")}
              </button>
            ))}
          </div>
        )}
        {!isLoading && !isError && (
          <div className="mt-4 max-h-[min(28rem,50vh)] divide-y divide-[var(--noodle-divider)] overflow-y-auto rounded-lg border border-[var(--noodle-divider)]">
            {accounts.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.stageprofilesourcepicker.noEligibleSourceAccountsMatchThatSearch")}
              </p>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => onSelect(account.id)}
                  className={`flex min-h-16 w-full items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] ${selectedId === account.id ? "bg-[var(--noodle-accent)]/10" : "hover:bg-[var(--accent)]"}`}
                >
                  <SourceAccountAvatar account={account} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{account.displayName}</span>
                    <span className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span className="truncate">@{account.handle}</span>
                      <span className="shrink-0 rounded-full border border-[var(--noodle-divider)] px-1.5 py-0.5 text-[0.625rem] font-bold capitalize">
                        {account.kind}
                      </span>
                    </span>
                    {account.bio && (
                      <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">{account.bio}</span>
                    )}
                  </span>
                  {selectedId === account.id ? (
                    <Check size={18} className="text-[var(--noodle-accent)]" />
                  ) : (
                    <ChevronRight size={17} className="text-[var(--muted-foreground)]" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
        {!isLoading && !isError && hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--noodle-divider)] text-sm font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {isLoadingMore && <Loader2 size={15} className="animate-spin" />}
            {isLoadingMore
              ? localizeUi("ui.noodle.stageprofilesourcepicker.loadingMore")
              : localizeUi("ui.noodle.stageprofilesourcepicker.loadMoreCharacters")}
          </button>
        )}
      </div>
      <WizardFooter
        step={0}
        onBack={onBack}
        onNext={onContinue}
        nextDisabled={!selectedId || !accounts.some((account) => account.id === selectedId)}
      />
    </div>
  );
}

export function DisclosureStep({
  source,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  source: { displayName: string; handle: string } | null;
  value: NoodleIdentityDisclosure;
  onChange: (value: NoodleIdentityDisclosure) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const disclosureChoices = disclosureOptions(localizeUi);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <div className="px-4 py-5 sm:px-6 @min-[1024px]:py-6">
        <h2 className="text-xl font-black">{localizeUi("ui.noodle.disclosurestep.howConnectedShouldThisFeel")}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.disclosurestep.chooseTheRelationshipBetweenThisNoodlerStageIdentityAnd")}
        </p>
        {source && (
          <p className="mt-4 rounded-lg bg-[var(--accent)] p-3 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.disclosurestep.source")}{" "}
            <span className="font-bold text-[var(--foreground)]">{source.displayName}</span> (@{source.handle})
          </p>
        )}
        <div className="mt-5 space-y-3">
          {disclosureChoices.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value === option.value}
              onClick={() => onChange(option.value)}
              className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left ${value === option.value ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10" : "border-[var(--noodle-divider)] hover:bg-[var(--accent)]"}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${value === option.value ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]" : "border-[var(--noodle-divider)]"}`}
              >
                {value === option.value && <Check size={13} className="!text-zinc-950" />}
              </span>
              <span>
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{option.detail}</span>
                <span className="mt-2 block text-xs leading-5 text-[var(--muted-foreground)]">{option.guidance}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <WizardFooter step={1} onBack={onBack} onNext={onContinue} />
    </div>
  );
}
