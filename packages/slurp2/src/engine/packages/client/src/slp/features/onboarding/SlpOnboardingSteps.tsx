import { clampPostsPerDay, DISCLOSURES, disclosureLabel, StepHeading } from "./SlpOnboardingPanel";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Eye,
  Image as ImageIcon,
  Loader2,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import {
  NOODLER_BULK_ACCOUNT_MAX,
  NOODLER_POSTS_PER_DAY_MAX,
  resolveNoodlerOnboardingCompletion,
} from "@marinara-engine/shared";
import { cn, generateClientId } from "../../../lib/utils";
import { Avatar, getNoodleAccentStyle, NOODLE_PINK } from "../../base/chrome/SlpChrome";
import type {
  NoodleIdentityDisclosure,
  NoodlerOnboardingCompletion,
  NoodlerRefreshNowOutcome,
  NoodlerPostView,
  NoodlerStageProfile,
} from "@marinara-engine/shared";
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
    intro,
    nightQuiet,
    onComplete,
    outcomes,
    pending,
    postsPerDay,
    postsPerDayDraft,
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
    setPostsPerDayDraft,
    setSelected,
    setSettingsFailed,
    setSetupLane,
    setStep,
    setupLane,
    step,
    t,
    toggleSelected,
  } = model;

  return (
    <>
    {intro === null && setupLane !== null && step === 1 && (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <StepHeading
            icon={<Users size={18} />}
            title={t("ui.noodle.noodlerwizard.chooseCharacters")}
            help={t("ui.noodle.noodlerwizard.selectionRule")}
          />
          {/* The easy lane skips identity/activity/images; this is the way back to them
            without putting a decision screen in front of the character list. */}
          {selectionOnly && (
            <button
              type="button"
              onClick={() => setSetupLane(setupLane === "easy" ? "customize" : "easy")}
              className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--noodle-accent)]/40 px-3 text-xs font-bold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10"
            >
              <SlidersHorizontal size={13} />
              {t(
                setupLane === "easy"
                  ? "ui.noodle.noodlerwizard.handoff.customize.action"
                  : "ui.noodle.noodlerwizard.handoff.easy.action",
              )}
            </button>
          )}
        </div>
        {accounts.length > 0 && (
          <div className="sticky top-0 z-10 -mt-1 flex items-center justify-between gap-3 rounded-lg border border-[var(--noodle-accent)]/25 bg-[color-mix(in_srgb,var(--noodle-accent)_8%,var(--background))] px-3 py-1.5">
            <span className="text-xs font-bold text-[var(--noodle-accent)]">
              {t("ui.noodle.noodlerwizard.selectedCount", {
                count: selected.size,
              })}
            </span>
            <button
              type="button"
              disabled={hasNextPage}
              onClick={() =>
                setSelected(
                  new Set(
                    selected.size > 0
                      ? []
                      : accounts.slice(0, NOODLER_BULK_ACCOUNT_MAX).map((account) => account.id),
                  ),
                )
              }
              className="min-h-10 shrink-0 px-1 text-xs font-bold text-[var(--noodle-accent)] disabled:opacity-40"
            >
              {selected.size > 0
                ? t("ui.noodle.noodlerwizard.selectNone")
                : t("ui.noodle.noodlerwizard.selectAll")}
            </button>
          </div>
        )}
        {eligible.isError && accounts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--slurp-muted)]">{t("ui.noodle.noodlerwizard.loadFailed")}</p>
            <button
              type="button"
              onClick={() => void eligible.refetch()}
              className="mt-2 min-h-10 px-2 text-sm font-bold text-[var(--noodle-accent)]"
            >
              {t("capabilities.actions.tryAgain")}
            </button>
          </div>
        ) : accounts.length === 0 && !eligible.isLoading && !eligible.hasNextPage ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)]">
              <Users size={22} />
            </span>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--slurp-muted)]">
              {t("ui.noodle.noodlerwizard.zeroEligible")}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                role="checkbox"
                aria-checked={selected.has(account.id)}
                disabled={selectionFull && !selected.has(account.id)}
                onClick={() => toggleSelected(account.id)}
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 motion-reduce:transform-none",
                  selected.has(account.id)
                    ? "border-[var(--noodle-accent)] bg-gradient-to-r from-[var(--noodle-accent)]/20 to-[var(--noodle-accent)]/5 shadow-sm shadow-[var(--noodle-accent)]/20 ring-1 ring-[var(--noodle-accent)]/35"
                    : "border-[var(--slurp-outline)] hover:border-[var(--noodle-accent)]/40 hover:bg-[var(--noodle-accent)]/[0.06]",
                  selectionFull && !selected.has(account.id) && "opacity-40",
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
                  <span className="block truncate text-sm font-semibold">{account.displayName}</span>
                  <span className="block truncate text-xs text-[var(--slurp-muted)]">@{account.handle}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    selected.has(account.id)
                      ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950"
                      : "border-[var(--slurp-outline)]",
                  )}
                >
                  {selected.has(account.id) && <Check size={13} />}
                </span>
              </button>
            ))}
            {(eligible.isLoading || eligible.hasNextPage) &&
              Array.from({ length: 4 }, (_, index) => (
                <span
                  key={`skeleton-${index}`}
                  className="min-h-14 animate-pulse rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-surface-raised)]/40"
                >
                  <span className="sr-only">{t("ui.noodle.noodlerwizard.loadingCharacters")}</span>
                </span>
              ))}
          </div>
        )}
        {selectionFull && (
          <p aria-live="polite" className="text-xs font-semibold text-[var(--slurp-muted)]">
            {t("ui.noodle.noodlerwizard.selectionLimit", {
              count: NOODLER_BULK_ACCOUNT_MAX,
            })}
          </p>
        )}
      </div>
    )}

    {intro === null && setupLane !== null && step === 2 && (
      <div className="space-y-4">
        <StepHeading
          icon={<Eye size={18} />}
          title={t("ui.noodle.noodlerwizard.disclosure.question")}
          help={t("ui.noodle.noodlerwizard.disclosure.help")}
        />
        <div className="space-y-2">
          {DISCLOSURES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDisclosure(value)}
              className={cn(
                "w-full rounded-lg border p-3 text-left",
                disclosure === value
                  ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10"
                  : "border-[var(--slurp-outline)] hover:bg-[var(--slurp-surface-raised)]",
              )}
            >
              <span className="block text-sm font-bold">
                {t(`ui.noodle.noodlerwizard.disclosure.${value}.title`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--slurp-muted)]">
                {t(`ui.noodle.noodlerwizard.disclosure.${value}.detail`)}
              </span>
            </button>
          ))}
        </div>
        {setupLane === "customize" && selected.size > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-bold">{t("ui.noodle.noodlerwizard.exceptions")}</h4>
            <div className="divide-y divide-[var(--noodle-accent)]/20 rounded-lg border border-[var(--noodle-accent)]/30">
              {accounts
                .filter((account) => selected.has(account.id))
                .map((account) => (
                  <label key={account.id} className="flex min-h-11 items-center gap-3 px-3 text-xs">
                    <span className="min-w-0 flex-1 truncate font-semibold">{account.displayName}</span>
                    <select
                      value={exceptions[account.id] ?? disclosure}
                      onChange={(event) =>
                        setExceptions((current) => ({
                          ...current,
                          [account.id]: event.target.value as NoodleIdentityDisclosure,
                        }))
                      }
                      style={{ colorScheme: "dark" }}
                      className="h-8 rounded-lg border border-[var(--noodle-accent)]/45 bg-[var(--slurp-surface)] px-2 text-[var(--slurp-text)]"
                    >
                      {DISCLOSURES.map((value) => (
                        <option key={value} value={value}>
                          {disclosureLabel(value, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
            </div>
          </div>
        )}
      </div>
    )}

    {intro === null && setupLane !== null && step === 3 && (
      <div className="space-y-5">
        <StepHeading
          icon={<Clock size={18} />}
          title={t("ui.noodle.noodlerwizard.activity")}
          help={t("ui.noodle.noodlerwizard.activityHelp")}
        />
        <p className="rounded-lg border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 px-3 py-2 text-xs leading-5 text-[var(--slurp-muted)]">
          {t("ui.noodle.noodlerschedulemanagermodal.limitsTemporary")}
        </p>
        <>
          <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--slurp-outline)] px-3">
            <input
              type="checkbox"
              checked={autoPostingEnabled}
              onChange={(event) => setAutoPostingEnabled(event.target.checked)}
              className="h-4 w-4 accent-[var(--noodle-accent)]"
            />
            <span>
              <span className="block text-sm font-semibold">{t("ui.noodle.noodlerwizard.autoPosting")}</span>
              <span className="block text-xs text-[var(--slurp-muted)]">
                {t("ui.noodle.noodlerwizard.autoPostingHelp")}
              </span>
            </span>
          </label>
          {autoPostingEnabled && (
            <>
              <label className="block text-sm font-semibold">
                {t("ui.noodle.noodlerwizard.postsPerDay")}
                <input
                  type="number"
                  min={1}
                  max={NOODLER_POSTS_PER_DAY_MAX}
                  value={postsPerDayDraft}
                  onChange={(event) => setPostsPerDayDraft(event.target.value)}
                  onBlur={() => {
                    const value = clampPostsPerDay(postsPerDayDraft);
                    setPostsPerDay(value);
                    setPostsPerDayDraft(String(value));
                  }}
                  style={{ colorScheme: "dark" }}
                  className="mt-2 h-11 w-28 rounded-lg border border-[var(--noodle-accent)]/45 bg-[var(--slurp-surface)] px-3 text-[var(--slurp-text)]"
                />
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--slurp-outline)] px-3">
                <input
                  type="checkbox"
                  checked={nightQuiet}
                  onChange={(event) => setNightQuiet(event.target.checked)}
                  className="h-4 w-4 accent-[var(--noodle-accent)]"
                />
                <span>
                  <span className="block text-sm font-semibold">{t("ui.noodle.noodlerwizard.nightQuiet")}</span>
                  <span className="block text-xs text-[var(--slurp-muted)]">
                    {t("ui.noodle.noodlerwizard.nightQuietHelp")}
                  </span>
                </span>
              </label>
            </>
          )}
        </>
      </div>
    )}

    {intro === null && setupLane !== null && step === 4 && (
      <div className="space-y-5">
        <StepHeading
          icon={<ImageIcon size={18} />}
          title={
            setupLane === "easy"
              ? t("ui.noodle.noodlerwizard.reviewTitle")
              : t("ui.noodle.noodlerwizard.images")
          }
          help={
            setupLane === "easy"
              ? t("ui.noodle.noodlerwizard.reviewHelp")
              : t("ui.noodle.noodlerwizard.imagesHelp")
          }
        />
        {setupLane === "customize" && (
          <label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-[var(--slurp-outline)] px-3">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t("ui.noodle.noodlerwizard.images")}</span>
              <span className="block text-xs leading-5 text-[var(--slurp-muted)]">
                {t("ui.noodle.noodlerwizard.imagesHelp")}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={imagesEnabled}
              onChange={(event) => setImagesEnabled(event.target.checked)}
              className="h-5 w-5 shrink-0 accent-[var(--noodle-accent)]"
            />
          </label>
        )}
        <label className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-[var(--slurp-outline)] px-3 py-2">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t("ui.slurp.onboarding.generationConnection")}</span>
            <span className="block text-xs leading-5 text-[var(--slurp-muted)]">
              {t("ui.slurp.onboarding.generationConnectionHelp")}
            </span>
          </span>
          <select
            value={generationConnectionId}
            onChange={(event) => setGenerationConnectionId(event.target.value)}
            className="h-9 max-w-[55%] rounded-lg border border-[var(--noodle-accent)]/45 bg-[var(--slurp-surface)] px-2 text-sm text-[var(--slurp-text)]"
            disabled={connectionsQuery.isLoading}
          >
            <option value="">{t("ui.slurp.onboarding.generationConnectionPlaceholder")}</option>
            {(connectionsQuery.data ?? [])
              .filter((connection) => connection.provider !== "image_generation")
              .map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name ?? connection.model ?? connection.id}
                </option>
              ))}
          </select>
        </label>
        {imagesEnabled && (
          <label className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-[var(--slurp-outline)] px-3 py-2">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t("ui.slurp.onboarding.imageConnection")}</span>
              <span className="block text-xs leading-5 text-[var(--slurp-muted)]">
                {t("ui.slurp.onboarding.imageConnectionHelp")}
              </span>
            </span>
            <select
              value={imageConnectionId}
              onChange={(event) => setImageConnectionId(event.target.value)}
              className="h-9 max-w-[55%] rounded-lg border border-[var(--noodle-accent)]/45 bg-[var(--slurp-surface)] px-2 text-sm text-[var(--slurp-text)]"
              disabled={connectionsQuery.isLoading}
            >
              <option value="">{t("ui.slurp.onboarding.imageConnectionDefault")}</option>
              {(connectionsQuery.data ?? [])
                .filter((connection) => connection.provider === "image_generation")
                .map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name ?? connection.model ?? connection.id}
                  </option>
                ))}
            </select>
          </label>
        )}
        {setupLane === "easy" ? (
          <div className="divide-y divide-[var(--noodle-accent)]/20 rounded-lg border border-[var(--noodle-accent)]/30 bg-[var(--noodle-accent)]/[0.06]">
            <div className="flex min-h-14 items-center justify-between gap-4 px-3 py-2.5">
              <span>
                <span className="block text-sm font-semibold">{t("ui.noodle.noodlerwizard.characters")}</span>
                <span className="block text-xs text-[var(--slurp-muted)]">
                  {t("ui.noodle.noodlerwizard.selectedCount", {
                    count: selected.size,
                  })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-9 shrink-0 px-2 text-xs font-bold text-[var(--noodle-accent)]"
              >
                {t("ui.noodle.noodlerwizard.change")}
              </button>
            </div>
            <label className="flex min-h-14 items-center justify-between gap-4 px-3 py-2.5">
              <span className="text-sm font-semibold">{t("ui.noodle.noodlerwizard.identity")}</span>
              <select
                value={disclosure}
                onChange={(event) => setDisclosure(event.target.value as NoodleIdentityDisclosure)}
                style={{ colorScheme: "dark" }}
                className="h-9 min-w-0 max-w-[65%] rounded-lg border border-[var(--noodle-accent)]/45 bg-[var(--slurp-surface)] px-2 text-sm text-[var(--slurp-text)]"
              >
                {DISCLOSURES.map((value) => (
                  <option key={value} value={value}>
                    {disclosureLabel(value, t)}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-3 px-3 py-3">
              <label className="flex min-h-9 items-center justify-between gap-4">
                <span className="text-sm font-semibold">{t("ui.noodle.noodlerwizard.activity")}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={autoPostingEnabled}
                  onChange={(event) => setAutoPostingEnabled(event.target.checked)}
                  className="h-5 w-5 shrink-0 accent-[var(--noodle-accent)]"
                />
              </label>
              {autoPostingEnabled && (
                <label className="flex items-center justify-between gap-4 text-xs text-[var(--slurp-muted)]">
                  <span>{t("ui.noodle.noodlerwizard.easyPostingPace")}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={NOODLER_POSTS_PER_DAY_MAX}
                      value={postsPerDayDraft}
                      onChange={(event) => setPostsPerDayDraft(event.target.value)}
                      onBlur={() => {
                        const value = clampPostsPerDay(postsPerDayDraft);
                        setPostsPerDay(value);
                        setPostsPerDayDraft(String(value));
                      }}
                      aria-label={t("ui.noodle.noodlerwizard.postsPerDay")}
                      className="h-9 w-16 rounded-lg border border-[var(--slurp-outline)] bg-[var(--background)] px-2 text-center text-sm text-[var(--slurp-text)]"
                    />
                    {t("ui.noodle.noodlerwizard.postsPerDayShort")}
                  </span>
                </label>
              )}
            </div>
            <label className="flex min-h-14 items-center justify-between gap-4 px-3 py-2.5">
              <span className="text-sm font-semibold">{t("ui.noodle.noodlerwizard.nightQuiet")}</span>
              <input
                type="checkbox"
                role="switch"
                checked={nightQuiet}
                onChange={(event) => setNightQuiet(event.target.checked)}
                className="h-5 w-5 shrink-0 accent-[var(--noodle-accent)]"
              />
            </label>
            <label className="flex min-h-14 items-center justify-between gap-4 px-3 py-2.5">
              <span className="text-sm font-semibold">{t("ui.noodle.noodlerwizard.images")}</span>
              <input
                type="checkbox"
                role="switch"
                checked={imagesEnabled}
                onChange={(event) => setImagesEnabled(event.target.checked)}
                className="h-5 w-5 shrink-0 accent-[var(--noodle-accent)]"
              />
            </label>
          </div>
        ) : (
          <div className="divide-y divide-[var(--noodle-accent)]/20 rounded-lg border border-[var(--noodle-accent)]/30 bg-[var(--noodle-accent)]/[0.06]">
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
              [
                t("ui.noodle.noodlerwizard.images"),
                imagesEnabled ? t("ui.noodle.noodlerwizard.on") : t("ui.noodle.noodlerwizard.off"),
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm">
                <span className="font-semibold">{label}</span>
                <span className="max-w-[65%] text-right text-[var(--slurp-muted)]">{value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-lg bg-[var(--slurp-surface-raised)]/30 p-4 ring-1 ring-inset ring-[var(--slurp-outline)]">
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={generateNow}
              onChange={(event) => setGenerateNow(event.target.checked)}
              className="h-5 w-5 accent-[var(--noodle-accent)]"
            />
            <span>
              <span className="block text-sm font-semibold">{t("ui.noodle.noodlerwizard.generateNow")}</span>
              <span className="block text-xs leading-5 text-[var(--slurp-muted)]">
                {t("ui.noodle.noodlerwizard.generateNowHelp")}
              </span>
            </span>
          </label>
        </div>
      </div>
    )}

    {step === 5 && completion && (
      <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--noodle-accent)] to-[var(--noodle-accent)]/70 text-zinc-950 shadow-lg shadow-[var(--noodle-accent)]/25",
            completion === "generated" &&
              "ring-4 ring-[var(--noodle-accent)]/20 transition-shadow duration-500 motion-reduce:transition-none",
          )}
        >
          {completion === "generated" ? (
            <Check size={26} />
          ) : completion === "partial" ||
            completion === "failed" ||
            completion === "creationFailed" ||
            completion === "settingsFailed" ? (
            <RefreshCw size={24} />
          ) : (
            <Users size={24} />
          )}
        </div>
        <h3 ref={completionHeadingRef} tabIndex={-1} className="mt-4 text-xl font-bold outline-none">
          {t(`ui.noodle.noodlerwizard.completion.${completion}.title`)}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--slurp-muted)]">
          {t(`ui.noodle.noodlerwizard.completion.${completion}.detail`, {
            created: createdIds.length,
            generated: generatedCount,
            // A lost request reports no per-creator failures, so fall back to what the
            // user selected: "0 creators could not be set up" helps nobody.
            failed: failedCount || selected.size,
          })}
        </p>
        {creationReasons.length > 0 && (
          <ul className="mt-3 max-w-md list-disc space-y-1 rounded-lg border border-[var(--noodle-accent)]/25 bg-[var(--noodle-accent)]/[0.06] px-5 py-2 text-left text-xs leading-5 text-[var(--slurp-text)]">
            {creationReasons.map((entry) => {
              // The eligible list is the same source the selection came from, so the name
              // is normally known. An unnamed creator still shows its reason.
              const name = accounts.find((account) => account.id === entry.accountId)?.displayName;
              return (
                <li key={`${entry.accountId}:${entry.reason}`}>
                  {name ? (
                    <>
                      <span className="font-semibold">{name}</span>
                      {" — "}
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
                className="min-w-24 rounded-lg bg-[var(--slurp-surface-raised)]/30 px-3 py-2 ring-1 ring-inset ring-[var(--slurp-outline)]"
              >
                <dt className="text-[0.7rem] font-semibold text-[var(--slurp-muted)]">
                  {t(`ui.noodle.noodlerwizard.stat.${cell.key}`)}
                </dt>
                <dd className="text-lg font-bold">{cell.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {completion === "settingsFailed" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              void (async () => {
                if (!(await saveSettings(createdIds.length === 0 ? "zero" : "completed"))) return;
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
            className="mt-5 flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-accent)]/40 px-4 text-sm font-bold text-[var(--noodle-accent)] disabled:opacity-50"
          >
            <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
            {t("ui.noodle.noodlerwizard.retrySettings")}
          </button>
        )}
        {(creationFailed || completion === "creationFailed") && (
          <>
            {creationError && (
              <p className="mt-4 rounded-lg border border-[var(--noodle-accent)]/25 bg-[var(--noodle-accent)]/[0.06] px-3 py-2 text-left text-xs leading-5 text-[var(--slurp-text)]">
                {creationError}
              </p>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => void finish()}
              className="mt-5 flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-accent)]/40 px-4 text-sm font-bold text-[var(--noodle-accent)] disabled:opacity-50"
            >
              <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
              {t("capabilities.actions.tryAgain")}
            </button>
          </>
        )}
        {failedIds.length > 0 && (
          <button
            type="button"
            disabled={refreshTargeted.isPending}
            onClick={() => void runGeneration(failedIds)}
            className="mt-5 flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-accent)]/40 px-4 text-sm font-bold text-[var(--noodle-accent)] disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshTargeted.isPending ? "animate-spin" : ""} />
            {t("ui.noodle.noodlerwizard.retryFailed")}
          </button>
        )}
      </div>
    )}
    </>
  );
}
