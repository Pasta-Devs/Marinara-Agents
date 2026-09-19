import { AlertCircle, CheckCircle2, Loader2, Pause, Play, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { NoodlerManagedStageProfile } from "@marinara-engine/shared";
import {
  useApplySlurpImprovementProposals,
  useCreateSlurpImprovementJob,
  useDismissSlurpImprovementProposals,
  useSetSlurpImprovementJobState,
  useSlurpImprovementJobs,
} from "../../slp/features/maintenance/slp-improvement-hooks";
import type { SlurpImprovementProposal } from "../../slp/features/maintenance/slp-improvement-hooks";
import type { SlurpSettings } from "../../slp/features/settings/slp-settings-contract";
import { toast } from "sonner";
import { Avatar } from "./SlurpShell";
import { SlpSettingScopeBadge } from "../../slp/modules/settings/SlpSettingsKit";

// Lanes with a server generator. The server rejects the rest until they exist.
const LANES = [
  {
    id: "profile",
    label: "Profile polish",
    detail: "Bio and stage personality. Name and handle only in rebrand mode.",
  },
  { id: "tags", label: "Tag curator", detail: "Discovery tags. New tags are created when you apply." },
  { id: "publishing", label: "Publishing setup", detail: "Turns on auto-posting. No model call." },
] as const;
const DEFERRED_LANES = ["Art direction", "Fan types and reactions", "Arc starters", "Messaging", "Ads"];

type Checkup = {
  creator: NoodlerManagedStageProfile;
  needs: string[];
};

function proposalValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(" · ");
  if (value === null || value === undefined || value === "") return "Not set";
  return String(value);
}

function proposalLabel(proposal: SlurpImprovementProposal): string {
  return proposal.field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

export function SlurpCreatorImprover({
  creators,
  settings,
}: {
  creators: NoodlerManagedStageProfile[];
  settings: SlurpSettings;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"missing" | "refresh" | "prefill">("missing");
  const [rebrand, setRebrand] = useState(false);
  const [lanes, setLanes] = useState<Set<string>>(new Set(["profile", "tags"]));
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set());
  const jobsQuery = useSlurpImprovementJobs(true);
  const createJob = useCreateSlurpImprovementJob();
  const applyProposals = useApplySlurpImprovementProposals();
  const setJobState = useSetSlurpImprovementJobState();
  const dismissProposals = useDismissSlurpImprovementProposals();
  const checkups = useMemo<Checkup[]>(
    () =>
      creators.map((creator) => {
        const needs: string[] = [];
        if (!creator.bio?.trim() || creator.bio.trim().length < 40) needs.push("Stronger public bio");
        if (!creator.stagePersonality?.trim() || creator.stagePersonality.trim().length < 80)
          needs.push("Clearer stage personality");
        if (!creator.tags?.length || creator.tags.length < 3) needs.push("Discovery tags");
        if (!creator.avatarUrl) needs.push("Visual direction");
        if (!creator.autoPosting.enabled) needs.push("Publishing setup");
        if (!settings.generationConnectionId) needs.push("Text model connection");
        return { creator, needs };
      }),
    [creators, settings.generationConnectionId],
  );
  const selectedCheckups = checkups.filter(({ creator }) => selected.has(creator.id));
  const needsModel = lanes.has("profile") || lanes.has("tags");
  const estimatedCalls = needsModel ? selectedCheckups.length : 0;
  const latestJob = jobsQuery.data?.items[0] ?? null;
  const pendingProposals = latestJob?.proposals.filter((proposal) => proposal.status === "pending") ?? [];

  return (
    <div className="space-y-5">
      <section className="relative isolate overflow-hidden rounded-2xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--noodle-accent)_20%,var(--slurp-surface-raised)),color-mix(in_srgb,var(--slurp-violet)_16%,var(--slurp-surface-raised)))] p-5 shadow-[var(--slurp-shadow)] ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 shadow-sm">
            <WandSparkles size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-balance">Creator workshop</h2>
              <SlpSettingScopeBadge scope="creator" />
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--slurp-muted)] text-pretty">
              Check what is missing for free, then ask AI for proposals only where you want help. Nothing is saved until
              you review it field by field.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">1. Free checkup</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
              This scan is local and never calls a model.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["Needs attention", () => checkups.filter((item) => item.needs.length).map((item) => item.creator.id)],
                ["All", () => creators.map((creator) => creator.id)],
                ["None", () => []],
              ] as const
            ).map(([label, pick]) => (
              <button
                key={label}
                type="button"
                onClick={() => setSelected(new Set(pick()))}
                className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {checkups.map(({ creator, needs }) => {
            const active = selected.has(creator.id);
            return (
              <label
                key={creator.id}
                className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-inset transition-colors ${active ? "bg-[var(--noodle-accent)]/10 ring-[var(--noodle-accent)]/40" : "bg-[var(--slurp-canvas)] ring-[var(--slurp-outline)] hover:ring-[var(--noodle-accent)]/30"}`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(creator.id);
                      else next.delete(creator.id);
                      return next;
                    })
                  }
                  className="mt-3 size-4 accent-[var(--noodle-accent)]"
                />
                <Avatar account={creator} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{creator.displayName}</span>
                  <span className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-[var(--slurp-muted)]">
                    {needs.length ? (
                      <>
                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-[var(--slurp-warning)]" />
                        {needs.join(" · ")}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--slurp-success)]" /> Ready
                      </>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5">
        <h3 className="text-base font-bold">2. Choose the kind of help</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(
            [
              ["missing", "Fill missing", "Only propose fields and setup that are absent."],
              ["refresh", "Refresh stale", "Reconsider weak or outdated Slurp material."],
              ["prefill", "Prefill new", "Prepare a safe starting profile and content reserve."],
            ] as const
          ).map(([value, label, detail]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`min-h-24 rounded-xl p-3 text-start ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${mode === value ? "bg-[var(--noodle-accent)]/10 ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-canvas)] ring-[var(--slurp-outline)]"}`}
            >
              <span className="block text-sm font-bold">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--slurp-muted)]">{detail}</span>
            </button>
          ))}
        </div>
        <fieldset className="mt-3">
          <legend className="text-sm font-bold">Proposal lanes</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {LANES.map((lane) => (
              <label
                key={lane.id}
                className="flex min-h-14 items-start gap-3 rounded-xl bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
              >
                <input
                  type="checkbox"
                  checked={lanes.has(lane.id)}
                  onChange={(event) =>
                    setLanes((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(lane.id);
                      else next.delete(lane.id);
                      return next;
                    })
                  }
                  className="mt-1 size-4 accent-[var(--noodle-accent)]"
                />
                <span>
                  <span className="block text-sm font-bold">{lane.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[var(--slurp-muted)]">{lane.detail}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--slurp-muted)]">
            Not available yet: {DEFERRED_LANES.join(", ")}.
          </p>
        </fieldset>
        <label className="mt-3 flex min-h-14 items-start gap-3 rounded-xl bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]">
          <input
            type="checkbox"
            checked={rebrand}
            onChange={(event) => setRebrand(event.target.checked)}
            className="mt-1 size-4 accent-[var(--noodle-accent)]"
          />
          <span>
            <span className="block text-sm font-bold">Rebrand mode</span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--slurp-muted)]">
              May also suggest a display name and handle. Disclosure, prices, ownership, and Engine source identity
              remain protected.
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="me-auto">
            <h3 className="text-base font-bold">3. Generate proposals</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
              {selectedCheckups.length} {selectedCheckups.length === 1 ? "Creator" : "Creators"} selected.{" "}
              {estimatedCalls} expected text {estimatedCalls === 1 ? "call" : "calls"}. Every result stays a reviewable
              draft.
            </p>
          </div>
          <button
            type="button"
            disabled={
              selectedCheckups.length === 0 ||
              lanes.size === 0 ||
              (needsModel && !settings.generationConnectionId) ||
              createJob.isPending
            }
            onClick={() =>
              createJob.mutate(
                {
                  accountIds: selectedCheckups.map(({ creator }) => creator.id),
                  mode,
                  rebrand,
                  modules: [...lanes],
                },
                {
                  onSuccess: () => {
                    setSelected(new Set());
                    setSelectedProposals(new Set());
                    toast.success("Proposal job queued. Nothing will be applied automatically.");
                  },
                  onError: (error) =>
                    toast.error(error instanceof Error ? error.message : "Could not queue proposals."),
                },
              )
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--noodle-accent)] px-4 text-sm font-black text-zinc-950 [&_svg]:!text-zinc-950 shadow-sm hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {createJob.isPending ? (
              <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Sparkles size={16} aria-hidden="true" />
            )}
            Generate proposals
          </button>
        </div>
        {needsModel && !settings.generationConnectionId && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--slurp-warning)]/10 p-3 text-xs text-[var(--slurp-warning)]">
            <AlertCircle size={15} aria-hidden="true" /> Choose a text generation connection in Automation first.
          </p>
        )}
      </section>

      {latestJob && (
        <section
          className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5"
          aria-labelledby="slurp-improvement-review-title"
        >
          <div className="flex flex-wrap items-start gap-3" aria-live="polite">
            <div className="me-auto">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--noodle-accent)]">
                Latest proposal job
              </p>
              <h3 id="slurp-improvement-review-title" className="mt-1 text-base font-black text-balance">
                {latestJob.status === "running" || latestJob.status === "queued"
                  ? `Working on ${latestJob.completed} of ${latestJob.total} Creators`
                  : latestJob.status === "completed"
                    ? "Ready for your review"
                    : latestJob.status === "cancelled"
                      ? "Proposal job paused"
                      : "Proposal job needs attention"}
              </h3>
              {latestJob.error && <p className="mt-1 text-xs text-[var(--slurp-warning)]">{latestJob.error}</p>}
            </div>
            {(latestJob.status === "running" || latestJob.status === "queued") && (
              <button
                type="button"
                disabled={setJobState.isPending}
                onClick={() => setJobState.mutate({ jobId: latestJob.id, action: "cancel" })}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-bold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
              >
                <Pause size={15} aria-hidden="true" /> Pause
              </button>
            )}
            {latestJob.status !== "running" &&
              latestJob.status !== "queued" &&
              latestJob.proposals.some((proposal) => proposal.status === "error" && proposal.field === "_creator") && (
                <button
                  type="button"
                  disabled={setJobState.isPending}
                  onClick={() => setJobState.mutate({ jobId: latestJob.id, action: "retry" })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-bold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                >
                  <Play size={15} aria-hidden="true" /> Retry failed
                </button>
              )}
            {(latestJob.status === "failed" || latestJob.status === "cancelled") && (
              <button
                type="button"
                disabled={setJobState.isPending}
                onClick={() => setJobState.mutate({ jobId: latestJob.id, action: "resume" })}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
              >
                <Play size={15} aria-hidden="true" /> Resume
              </button>
            )}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--slurp-canvas)]" aria-hidden="true">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--noodle-accent),var(--slurp-violet))] transition-[width] motion-reduce:transition-none"
              style={{ width: `${latestJob.total ? Math.round((latestJob.completed / latestJob.total) * 100) : 0}%` }}
            />
          </div>

          {latestJob.proposals.length > 0 && (
            <div className="mt-5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="me-auto text-sm font-bold">Before and after</h4>
                <button
                  type="button"
                  disabled={!pendingProposals.length}
                  onClick={() => setSelectedProposals(new Set(pendingProposals.map((proposal) => proposal.id)))}
                  className="min-h-10 rounded-lg px-3 text-xs font-bold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
                >
                  Select all pending
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {latestJob.proposals.map((proposal) => {
                  const creator = creators.find((item) => item.id === proposal.accountId);
                  const selectable = proposal.status === "pending";
                  const active = selectedProposals.has(proposal.id);
                  return (
                    <label
                      key={proposal.id}
                      className={`block rounded-xl p-3 ring-1 ring-inset ${active ? "bg-[var(--noodle-accent)]/8 ring-[var(--noodle-accent)]/35" : "bg-[var(--slurp-canvas)] ring-[var(--slurp-outline)]"}`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={!selectable}
                          checked={active && selectable}
                          onChange={(event) =>
                            setSelectedProposals((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(proposal.id);
                              else next.delete(proposal.id);
                              return next;
                            })
                          }
                          className="size-4 accent-[var(--noodle-accent)]"
                        />
                        <span className="min-w-0 flex-1 text-sm font-bold">
                          {creator?.displayName ?? "Removed Creator"} · {proposalLabel(proposal)}
                        </span>
                        <span className="rounded-full bg-[var(--slurp-surface-raised)] px-2 py-1 text-[0.68rem] font-bold text-[var(--slurp-muted)]">
                          {proposal.status}
                        </span>
                      </span>
                      {proposal.error ? (
                        <span className="mt-2 block text-xs leading-5 text-[var(--slurp-danger)]">
                          {proposal.error}
                        </span>
                      ) : (
                        <span className="mt-3 grid gap-2 sm:grid-cols-2">
                          <span className="rounded-lg bg-[var(--slurp-surface-raised)] p-3">
                            <span className="block text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--slurp-muted)]">
                              Current
                            </span>
                            <span className="mt-1 block whitespace-pre-wrap text-xs leading-5 text-[var(--slurp-muted)]">
                              {proposalValue(proposal.before)}
                            </span>
                          </span>
                          <span className="rounded-lg bg-[color-mix(in_srgb,var(--noodle-accent)_8%,var(--slurp-surface-raised))] p-3">
                            <span className="block text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--noodle-accent)]">
                              Proposed
                            </span>
                            <span className="mt-1 block whitespace-pre-wrap text-xs leading-5">
                              {proposalValue(proposal.after)}
                            </span>
                          </span>
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--slurp-text)] p-3 text-[var(--slurp-canvas)] shadow-[var(--slurp-shadow-floating)] sm:bottom-3">
                <p className="me-auto text-xs font-semibold">{selectedProposals.size} field changes selected</p>
                <button
                  type="button"
                  disabled={!selectedProposals.size || dismissProposals.isPending}
                  onClick={() =>
                    dismissProposals.mutate(
                      { jobId: latestJob.id, proposalIds: [...selectedProposals] },
                      { onSuccess: () => setSelectedProposals(new Set()) },
                    )
                  }
                  className="inline-flex min-h-11 items-center rounded-lg px-4 text-xs font-bold ring-1 ring-inset ring-current/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-45"
                >
                  Dismiss selected
                </button>
                <button
                  type="button"
                  disabled={!selectedProposals.size || applyProposals.isPending}
                  onClick={() =>
                    applyProposals.mutate(
                      { jobId: latestJob.id, proposalIds: [...selectedProposals] },
                      {
                        onSuccess: (result) => {
                          setSelectedProposals(new Set());
                          toast.success(`Applied ${result.applied} approved changes to ${result.creators} Creators.`);
                          if (result.rejected) toast.warning(`${result.rejected} protected changes were skipped.`);
                        },
                        onError: (error) =>
                          toast.error(error instanceof Error ? error.message : "Could not apply proposals."),
                      },
                    )
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-black text-zinc-950 [&_svg]:!text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-45"
                >
                  {applyProposals.isPending && (
                    <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
                  )}
                  Apply selected
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
