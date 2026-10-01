import { DISCLOSURES, disclosureLabel, DisclosureChoice, StepHeading } from "./SlpOnboardingPanel";
import { useId, useState } from "react";
import { Check, ChevronRight, RefreshCw, SlidersHorizontal, Users } from "lucide-react";
import {
  SLP_CREATOR_BULK_ACCOUNT_MAX,
  SLP_CREATOR_POSTS_PER_DAY_MAX,
} from "../../../../../shared/src/slp/slp-social.schema.js";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_GROUP_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpButton, SlpSegment, SlpSquareCheck } from "../../modules/chrome/SlpButton";
import { SlpRadioRow, SlpSheet } from "../../modules/chrome/SlpSheet";
import { NumberSetting, Toggle } from "../../modules/settings/SlpSettingsControls";
import type { SlurpOnboardingWizardModel } from "./slp-onboarding-wizard-model";

/** The wizard body: pick the creators, tune them, run the setup, and read what came back. */
export function SlpOnboardingSteps({ model }: { model: SlurpOnboardingWizardModel }) {
  const {
    accounts,
    autoPostingEnabled,
    completion,
    completionHeadingRef,
    connectionsQuery,
    createdIds,
    creationError,
    creationFailed,
    creationFailures,
    creationReasons,
    creationRetryIds,
    retryFailedCreations,
    disclosure,
    eligible,
    exceptions,
    failedCount,
    failedIds,
    finish,
    generateNow,
    generatedCount,
    generationConnectionId,
    hasNextPage,
    imageConnectionId,
    imagesEnabled,
    nightQuiet,
    onComplete,
    outcomes,
    pending,
    postsPerDay,
    refreshTargeted,
    resolveCompletion,
    runGeneration,
    saveSettings,
    selected,
    selectionFull,
    selectionOnly,
    setAutoPostingEnabled,
    setCompletion,
    setDisclosure,
    setExceptions,
    setGenerateNow,
    setGenerationConnectionId,
    setImageConnectionId,
    setImagesEnabled,
    setNightQuiet,
    setPostsPerDay,
    setSelected,
    setSettingsFailed,
    setSetupLane,
    setStep,
    setupLane,
    step,
    t,
    toggleSelected,
  } = model;
  const identityOptions = DISCLOSURES.map((value) => ({ value, label: disclosureLabel(value, t) }));
  const connections = connectionsQuery.data ?? [];
  const connectionOption = (connection: (typeof connections)[number]) => ({
    id: connection.id,
    label: connection.name ?? connection.model ?? connection.id,
  });
  const postsPerDayStepper = (
    <NumberSetting
      stepper
      label={t("ui.noodle.noodlerwizard.postsPerDay")}
      value={postsPerDay}
      min={1}
      max={SLP_CREATOR_POSTS_PER_DAY_MAX}
      onSave={setPostsPerDay}
    />
  );
  const connectionPickers = (
    <>
      <ConnectionPicker
        label={t("ui.slurp.onboarding.generationConnection")}
        help={t("ui.slurp.onboarding.generationConnectionHelp")}
        placeholder={t("ui.slurp.onboarding.generationConnectionPlaceholder")}
        value={generationConnectionId}
        onChange={setGenerationConnectionId}
        loading={connectionsQuery.isLoading}
        options={connections.filter((connection) => connection.provider !== "image_generation").map(connectionOption)}
      />
      {imagesEnabled && (
        <ConnectionPicker
          label={t("ui.slurp.onboarding.imageConnection")}
          help={t("ui.slurp.onboarding.imageConnectionHelp")}
          placeholder={t("ui.slurp.onboarding.imageConnectionDefault")}
          // Empty is a real choice here: the Slurp-wide default image connection.
          emptyOption
          value={imageConnectionId}
          onChange={setImageConnectionId}
          loading={connectionsQuery.isLoading}
          options={connections.filter((connection) => connection.provider === "image_generation").map(connectionOption)}
        />
      )}
    </>
  );

  return (
    <>
      {setupLane !== null && step === 1 && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <StepHeading
              title={t("ui.noodle.noodlerwizard.chooseCharacters")}
              help={t("ui.noodle.noodlerwizard.selectionRule")}
            />
            {/* The easy lane skips identity/activity/images; this is the way back to them
            without putting a decision screen in front of the character list. */}
            {selectionOnly && (
              <SlpButton
                className="shrink-0 px-3.5"
                onClick={() => setSetupLane(setupLane === "easy" ? "customize" : "easy")}
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                {t(
                  setupLane === "easy"
                    ? "ui.noodle.noodlerwizard.handoff.customize.action"
                    : "ui.noodle.noodlerwizard.handoff.easy.action",
                )}
              </SlpButton>
            )}
          </div>
          {accounts.length > 0 && (
            <div className="sticky top-0 z-10 flex min-h-11 items-center justify-between gap-3 rounded-full bg-[var(--slurp-glass)] ps-4 pe-1 shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] backdrop-blur-xl">
              <span className={cn(SLP_TYPE.meta, "font-semibold")}>
                {t("ui.noodle.noodlerwizard.selectedCount", {
                  count: selected.size,
                })}
              </span>
              <SlpButton
                variant="tertiary"
                disabled={hasNextPage}
                onClick={() =>
                  setSelected(
                    new Set(
                      selected.size > 0
                        ? []
                        : accounts.slice(0, SLP_CREATOR_BULK_ACCOUNT_MAX).map((account) => account.id),
                    ),
                  )
                }
              >
                {selected.size > 0 ? t("ui.noodle.noodlerwizard.selectNone") : t("ui.noodle.noodlerwizard.selectAll")}
              </SlpButton>
            </div>
          )}
          {eligible.isError && accounts.length === 0 ? (
            <div className="py-8 text-center">
              <p className={cn(SLP_TYPE.body, "text-[var(--slurp-muted)]")}>
                {t("ui.noodle.noodlerwizard.loadFailed")}
              </p>
              <SlpButton variant="tertiary" className="mt-2" onClick={() => void eligible.refetch()}>
                {t("capabilities.actions.tryAgain")}
              </SlpButton>
            </div>
          ) : accounts.length === 0 && !eligible.isLoading && !eligible.hasNextPage ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-[var(--slurp-tint)] text-[var(--noodle-accent-foreground)]">
                <Users size={22} aria-hidden="true" />
              </span>
              <p className={cn(SLP_TYPE.body, "mt-3 max-w-md text-pretty text-[var(--slurp-muted)]")}>
                {t("ui.noodle.noodlerwizard.zeroEligible")}
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {accounts.map((account) => {
                const checked = selected.has(account.id);
                return (
                  <button
                    key={account.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={selectionFull && !checked}
                    onClick={() => toggleSelected(account.id)}
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-2xl px-3 py-2 text-start transition-[transform,background-color] duration-[var(--slurp-motion-fast)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transform-none",
                      checked
                        ? "bg-[image:var(--slurp-nav-active)] ring-1 ring-inset ring-[var(--noodle-accent)]/45"
                        : "bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] hover:bg-[var(--accent)]",
                      selectionFull && !checked && "opacity-40",
                    )}
                  >
                    <Avatar
                      account={{
                        displayName: account.displayName,
                        avatarUrl: account.avatarUrl,
                        avatarCrop: account.avatarCrop,
                      }}
                      size="md"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn(SLP_TYPE.body, "block truncate font-semibold")}>{account.displayName}</span>
                      <span className={cn(SLP_TYPE.meta, "block truncate text-[var(--slurp-muted)]")}>
                        @{account.handle}
                      </span>
                    </span>
                    <SlpSquareCheck checked={checked} />
                  </button>
                );
              })}
              {(eligible.isLoading || eligible.hasNextPage) &&
                Array.from({ length: 4 }, (_, index) => (
                  <span
                    key={`skeleton-${index}`}
                    className="min-h-16 animate-pulse rounded-2xl bg-[var(--slurp-surface-raised)] motion-reduce:animate-none"
                  >
                    <span className="sr-only">{t("ui.noodle.noodlerwizard.loadingCharacters")}</span>
                  </span>
                ))}
            </div>
          )}
          {selectionFull && (
            <p aria-live="polite" className={cn(SLP_TYPE.meta, "font-semibold text-[var(--slurp-muted)]")}>
              {t("ui.noodle.noodlerwizard.selectionLimit", {
                count: SLP_CREATOR_BULK_ACCOUNT_MAX,
              })}
            </p>
          )}
        </div>
      )}

      {setupLane !== null && step === 2 && (
        <div className="space-y-4">
          <StepHeading
            title={t("ui.noodle.noodlerwizard.disclosure.question")}
            help={t("ui.noodle.noodlerwizard.disclosure.help")}
          />
          <DisclosureChoice value={disclosure} onChange={setDisclosure} t={t} />
          {setupLane === "customize" && selected.size > 0 && (
            <section aria-label={t("ui.noodle.noodlerwizard.exceptions")} className="space-y-2">
              <h4 className={cn(SLP_TYPE.body, "font-semibold")}>{t("ui.noodle.noodlerwizard.exceptions")}</h4>
              <div className={SLP_GROUP_CLASS}>
                {accounts
                  .filter((account) => selected.has(account.id))
                  .map((account) => (
                    <div key={account.id} className="flex min-h-14 items-center gap-3 px-4 py-1.5">
                      <span className={cn(SLP_TYPE.body, "min-w-0 flex-1 truncate font-semibold")}>
                        {account.displayName}
                      </span>
                      <SlpSegment
                        label={account.displayName}
                        options={identityOptions}
                        value={exceptions[account.id] ?? disclosure}
                        onChange={(value) =>
                          setExceptions((current) => ({
                            ...current,
                            [account.id]: value,
                          }))
                        }
                      />
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      {setupLane !== null && step === 3 && (
        <div className="space-y-4">
          <StepHeading title={t("ui.noodle.noodlerwizard.activity")} help={t("ui.noodle.noodlerwizard.activityHelp")} />
          <p className={cn(SLP_TYPE.meta, "text-pretty text-[var(--slurp-muted)]")}>
            {t("ui.noodle.noodlerschedulemanagermodal.limitsTemporary")}
          </p>
          <div className={SLP_GROUP_CLASS}>
            <div className="px-4 py-1">
              <Toggle
                label={t("ui.noodle.noodlerwizard.autoPosting")}
                detail={t("ui.noodle.noodlerwizard.autoPostingHelp")}
                value={autoPostingEnabled}
                onChange={setAutoPostingEnabled}
              />
            </div>
            {autoPostingEnabled && (
              <>
                <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
                  <span className={cn(SLP_TYPE.body, "font-semibold")}>{t("ui.noodle.noodlerwizard.postsPerDay")}</span>
                  {postsPerDayStepper}
                </div>
                <div className="px-4 py-1">
                  <Toggle
                    label={t("ui.noodle.noodlerwizard.nightQuiet")}
                    detail={t("ui.noodle.noodlerwizard.nightQuietHelp")}
                    value={nightQuiet}
                    onChange={setNightQuiet}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {setupLane !== null && step === 4 && (
        <div className="space-y-4">
          <StepHeading
            title={
              setupLane === "easy" ? t("ui.noodle.noodlerwizard.reviewTitle") : t("ui.noodle.noodlerwizard.images")
            }
            help={
              setupLane === "easy" ? t("ui.noodle.noodlerwizard.reviewHelp") : t("ui.noodle.noodlerwizard.imagesHelp")
            }
          />
          {setupLane === "easy" ? (
            <div className={SLP_GROUP_CLASS}>
              <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-2">
                <span className="min-w-0">
                  <span className={cn(SLP_TYPE.body, "block font-semibold")}>
                    {t("ui.noodle.noodlerwizard.characters")}
                  </span>
                  <span className={cn(SLP_TYPE.meta, "block text-[var(--slurp-muted)]")}>
                    {t("ui.noodle.noodlerwizard.selectedCount", {
                      count: selected.size,
                    })}
                  </span>
                </span>
                <SlpButton variant="tertiary" className="shrink-0" onClick={() => setStep(1)}>
                  {t("ui.noodle.noodlerwizard.change")}
                </SlpButton>
              </div>
              <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-2">
                <span className={cn(SLP_TYPE.body, "font-semibold")}>{t("ui.noodle.noodlerwizard.identity")}</span>
                <SlpSegment
                  label={t("ui.noodle.noodlerwizard.identity")}
                  options={identityOptions}
                  value={disclosure}
                  onChange={setDisclosure}
                />
              </div>
              <div className="px-4 py-1">
                <Toggle
                  label={t("ui.noodle.noodlerwizard.activity")}
                  value={autoPostingEnabled}
                  onChange={setAutoPostingEnabled}
                />
              </div>
              {autoPostingEnabled && (
                <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
                  <span className={cn(SLP_TYPE.body, "text-[var(--slurp-muted)]")}>
                    {t("ui.noodle.noodlerwizard.easyPostingPace")}
                  </span>
                  {postsPerDayStepper}
                </div>
              )}
              <div className="px-4 py-1">
                <Toggle label={t("ui.noodle.noodlerwizard.nightQuiet")} value={nightQuiet} onChange={setNightQuiet} />
              </div>
              <div className="px-4 py-1">
                <Toggle label={t("ui.noodle.noodlerwizard.images")} value={imagesEnabled} onChange={setImagesEnabled} />
              </div>
            </div>
          ) : (
            <>
              <div className={SLP_GROUP_CLASS}>
                <div className="px-4 py-1">
                  <Toggle
                    label={t("ui.noodle.noodlerwizard.imagesShort")}
                    value={imagesEnabled}
                    onChange={setImagesEnabled}
                  />
                </div>
              </div>
              <div className={SLP_GROUP_CLASS}>
                {[
                  [
                    t("ui.noodle.noodlerwizard.characters"),
                    t("ui.noodle.noodlerwizard.selectedCount", {
                      count: selected.size,
                    }),
                  ],
                  [t("ui.noodle.noodlerwizard.identity"), disclosureLabel(disclosure, t)],
                  [
                    t("ui.noodle.noodlerwizard.activity"),
                    autoPostingEnabled
                      ? t("ui.noodle.noodlerwizard.automaticActivityDetail", {
                          count: postsPerDay,
                        })
                      : t("ui.noodle.noodlerwizard.manualOnly"),
                  ],
                  [
                    t("ui.noodle.noodlerwizard.nightQuiet"),
                    nightQuiet ? t("ui.noodle.noodlerwizard.on") : t("ui.noodle.noodlerwizard.off"),
                  ],
                ].map(([label, value]) => (
                  <div key={label} className={cn(SLP_TYPE.body, "flex items-start justify-between gap-4 px-4 py-3")}>
                    <span className="font-semibold">{label}</span>
                    <span className="max-w-[65%] text-end text-pretty text-[var(--slurp-muted)]">{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className={SLP_GROUP_CLASS}>{connectionPickers}</div>
          <div className={SLP_GROUP_CLASS}>
            <div className="px-4 py-1">
              <Toggle
                label={t("ui.noodle.noodlerwizard.generateNow")}
                detail={t("ui.noodle.noodlerwizard.generateNowHelp")}
                value={generateNow}
                onChange={setGenerateNow}
              />
            </div>
          </div>
        </div>
      )}

      {step === 5 && completion && (
        <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
          <div
            className={cn(
              "grid size-14 place-items-center rounded-full bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] shadow-[var(--slurp-glow)] [&_svg]:!text-[var(--slurp-on-accent)]",
              completion === "generated" &&
                "ring-4 ring-[var(--noodle-accent)]/20 transition-shadow duration-500 motion-reduce:transition-none",
            )}
          >
            {completion === "generated" ? (
              <Check size={26} aria-hidden="true" />
            ) : completion === "writing" ? (
              <RefreshCw size={24} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : completion === "partial" ||
              completion === "failed" ||
              completion === "creationFailed" ||
              completion === "settingsFailed" ? (
              <RefreshCw size={24} aria-hidden="true" />
            ) : (
              <Users size={24} aria-hidden="true" />
            )}
          </div>
          <h3
            ref={completionHeadingRef}
            tabIndex={-1}
            className={cn(SLP_TYPE.screen, "mt-4 text-balance outline-none")}
          >
            {t(`ui.noodle.noodlerwizard.completion.${completion}.title`)}
          </h3>
          <p className={cn(SLP_TYPE.body, "mt-2 max-w-md text-pretty text-[var(--slurp-muted)]")}>
            {t(`ui.noodle.noodlerwizard.completion.${completion}.detail`, {
              created: createdIds.length,
              generated: generatedCount,
              // A lost request reports no per-creator failures, so fall back to what the
              // user selected: "0 creators could not be set up" helps nobody.
              failed: failedCount || selected.size,
            })}
          </p>
          {creationReasons.length > 0 && (
            <ul
              className={cn(
                SLP_TYPE.meta,
                "mt-3 max-w-md list-disc space-y-1 rounded-2xl bg-[var(--slurp-tint)] px-5 py-2.5 text-start text-[var(--slurp-text)]",
              )}
            >
              {creationReasons.map((entry) => {
                // The eligible list is the same source the selection came from, so the name
                // is normally known. An unnamed creator still shows its reason.
                const name = accounts.find((account) => account.id === entry.accountId)?.displayName;
                return (
                  <li key={`${entry.accountId}:${entry.reason}`}>
                    {name ? (
                      <>
                        <span className="font-semibold">{name}</span>
                        {" · "}
                      </>
                    ) : null}
                    {entry.reason}
                  </li>
                );
              })}
            </ul>
          )}
          {createdIds.length > 0 && (
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                { key: "created", value: createdIds.length },
                { key: "posted", value: generatedCount },
                { key: "failed", value: failedCount },
              ].map((cell) => (
                <div
                  key={cell.key}
                  className="min-w-24 rounded-2xl bg-[var(--slurp-surface-raised)] px-3 py-2 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]"
                >
                  <dt className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
                    {t(`ui.noodle.noodlerwizard.stat.${cell.key}`)}
                  </dt>
                  <dd className="text-xl font-extrabold tabular-nums">{cell.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {completion === "settingsFailed" && (
            <SlpButton
              className="mt-5"
              disabled={pending}
              onClick={() => {
                void (async () => {
                  if (!(await saveSettings())) return;
                  setSettingsFailed(false);
                  onComplete?.();
                  setCompletion(
                    resolveCompletion({
                      selectedCount: selected.size,
                      createdCount: createdIds.length,
                      createFailures: creationFailures,
                      outcomes: generateNow && createdIds.length > 0 ? outcomes : null,
                    }),
                  );
                })();
              }}
            >
              <RefreshCw size={16} aria-hidden="true" className={pending ? "animate-spin" : ""} />
              {t("ui.noodle.noodlerwizard.retrySettings")}
            </SlpButton>
          )}
          {(creationFailed || completion === "creationFailed") && (
            <>
              {creationError && (
                <p
                  className={cn(
                    SLP_TYPE.meta,
                    "mt-4 rounded-2xl bg-[var(--slurp-tint)] px-4 py-2.5 text-start text-[var(--slurp-text)]",
                  )}
                >
                  {creationError}
                </p>
              )}
              <SlpButton className="mt-5" disabled={pending} onClick={() => void finish()}>
                <RefreshCw size={16} aria-hidden="true" className={pending ? "animate-spin" : ""} />
                {t("capabilities.actions.tryAgain")}
              </SlpButton>
            </>
          )}
          {creationRetryIds.length > 0 && completion !== "creationFailed" && (
            <SlpButton className="mt-5" disabled={pending} onClick={retryFailedCreations}>
              <RefreshCw size={16} aria-hidden="true" className={pending ? "animate-spin" : ""} />
              {t("ui.noodle.noodlerwizard.retryFailedCreations", { count: creationRetryIds.length })}
            </SlpButton>
          )}
          {failedIds.length > 0 && (
            <SlpButton
              className="mt-5"
              disabled={refreshTargeted.isPending}
              onClick={() => void runGeneration(failedIds)}
            >
              <RefreshCw size={16} aria-hidden="true" className={refreshTargeted.isPending ? "animate-spin" : ""} />
              {t("ui.noodle.noodlerwizard.retryFailed")}
            </SlpButton>
          )}
        </div>
      )}
    </>
  );
}

/**
 * A connection choice as a row that opens a sheet of radio rows (the model picker), instead of a
 * native select. `emptyOption` adds the placeholder as a real choice (the Slurp default).
 */
function ConnectionPicker({
  label,
  help,
  placeholder,
  value,
  onChange,
  options,
  loading,
  emptyOption = false,
}: {
  label: string;
  help: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  loading: boolean;
  emptyOption?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const name = useId();
  const current = options.find((option) => option.id === value)?.label ?? placeholder;
  const rows = emptyOption ? [{ id: "", label: placeholder }, ...options] : options;
  return (
    <>
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-start transition-colors duration-[var(--slurp-motion-fast)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] disabled:opacity-60"
      >
        {/* Stacked, so a long connection name never squeezes the label. */}
        <span className="min-w-0 flex-1">
          <span className={cn(SLP_TYPE.body, "block font-semibold")}>{label}</span>
          <span className={cn(SLP_TYPE.body, "block truncate font-semibold text-[var(--noodle-accent-foreground)]")}>
            {current}
          </span>
          <span className={cn(SLP_TYPE.meta, "mt-0.5 block text-pretty text-[var(--slurp-muted)]")}>{help}</span>
        </span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--slurp-muted)] rtl:rotate-180" />
      </button>
      <SlpSheet open={open} onClose={() => setOpen(false)} title={label}>
        <div role="radiogroup" aria-label={label} className="space-y-1 px-1 pb-1">
          {rows.map((option) => (
            <SlpRadioRow
              key={option.id || "default"}
              name={name}
              checked={value === option.id}
              onChange={() => {
                onChange(option.id);
                setOpen(false);
              }}
            >
              <span className="block truncate">{option.label}</span>
            </SlpRadioRow>
          ))}
        </div>
      </SlpSheet>
    </>
  );
}
