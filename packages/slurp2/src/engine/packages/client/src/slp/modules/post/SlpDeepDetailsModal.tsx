import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/ui/Modal";
import { api } from "../../../lib/api-client";
import type { SlpDeepDetailsResponse } from "../../../../../shared/src/slp/slp-deep-details.js";
import { slpKeys } from "../../base/state/slp-query-keys";
import { buildSlpDeepDetailsFlow } from "./slp-deep-details-flow";
import { SlpDeepDetailsCanvas } from "./SlpDeepDetailsCanvas";
import { SlpDeepDetailsFlow } from "./SlpDeepDetailsFlow";
import { SlpDeepDetailsImageRuns } from "./SlpDeepDetailsImageRuns";
import { Block, Chip, CopyButton, formatTime, Rows, Section, str } from "./SlpDeepDetailsParts";

/**
 * Deep details: everything that flowed into one post, as numbered steps in the order they ran —
 * from the plan and the draws to the literal prompt, the model's raw answer, and every image run.
 * Missing steps say "Not recorded"; nothing is filled in from today's settings.
 */
export function SlpDeepDetailsModal({ postId, open, onClose }: { postId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "deep-details", postId],
    queryFn: () => api.get<SlpDeepDetailsResponse>(`/slurp2/slurp/posts/${encodeURIComponent(postId)}/deep-details`),
    enabled: open,
  });
  const data = query.data;
  const details = data?.details ?? null;
  const imageRuns = details?.imageRuns ?? [];
  const recorded = details ? "done" : "missing";
  const [view, setView] = useState<"flow" | "canvas" | "data">("flow");
  const [runChoice, setRunChoice] = useState<number | null>(null);
  const runIndex = runChoice ?? imageRuns.length - 1;
  const graph = data ? buildSlpDeepDetailsFlow(data, imageRuns[runIndex] ?? null) : null;
  const shownView = graph ? view : "data";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("ui.slurp.deepDetails.title", { defaultValue: "Deep details" })}
      width="max-w-4xl"
      mobileFullscreen
    >
      {query.isLoading ? (
        <div className="flex justify-center py-16" role="status">
          <Loader2 size={22} className="animate-spin text-[var(--noodle-accent)] motion-reduce:animate-none" />
        </div>
      ) : query.isError || !data ? (
        <p role="alert" className="py-10 text-center text-sm text-[var(--destructive)]">
          {t("ui.slurp.deepDetails.loadError", { defaultValue: "Could not load this post's details." })}
        </p>
      ) : (
        <div className="space-y-4 text-sm">
          <header className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                  {data.creator.displayName} · @{data.creator.handle} · {formatTime(data.post.createdAt)}
                </p>
                <h3 className="mt-1 text-lg font-black text-balance">
                  {data.post.title || data.post.content.slice(0, 80)}
                </h3>
              </div>
              <CopyButton
                value={JSON.stringify(data, null, 2)}
                label={t("ui.slurp.deepDetails.copyAll", { defaultValue: "Copy all as JSON" })}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip label="Intent" value={details?.plan.intent ?? str(data.post.metadata.contentIntent)} />
              <Chip label="Delivery" value={details?.plan.delivery ?? str(data.post.metadata.contentDelivery)} />
              <Chip
                label="Format"
                value={
                  details && details.plan.rotatedFormat && details.plan.rotatedFormat !== details.plan.format
                    ? `${details.plan.rotatedFormat} → ${details.plan.format}`
                    : (details?.plan.format ?? str(data.post.metadata.noodlerContentFormat))
                }
              />
              <Chip label="Access" value={data.post.access} />
              <Chip label="Source" value={data.post.source} />
              {details?.plan.teaser && <Chip label="Free teaser" value="yes" />}
              {details?.plan.story && <Chip label="Story" value="yes" />}
              {details && details.attempts > 1 && <Chip label="Attempts" value={String(details.attempts)} />}
              {details && <Chip label="Model" value={details.model.model} />}
            </div>
          </header>

          {!details && (
            <p className="rounded-lg bg-[var(--slurp-surface-raised)] p-3 text-xs leading-5 text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--slurp-outline)]">
              {t("ui.slurp.deepDetails.notRecorded", {
                defaultValue:
                  "This post was written before Slurp recorded deep details, or by hand. Its stored plan, tags, and numbers are below.",
              })}
            </p>
          )}

          {graph && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2" role="group" aria-label="View">
                {(
                  [
                    ["flow", "Flowchart"],
                    ["canvas", "Canvas"],
                    ["data", "All data"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={view === value}
                    onClick={() => setView(value)}
                    className={`min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      view === value
                        ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]"
                        : "border-[var(--border)] hover:bg-[var(--accent)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {imageRuns.length > 1 && view !== "data" && (
                <label className="flex items-center gap-2 text-xs font-semibold">
                  Image run
                  <select
                    value={runIndex}
                    onChange={(event) => setRunChoice(Number(event.target.value))}
                    className="min-h-10 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-2 text-xs"
                  >
                    {imageRuns.map((run, index) => (
                      <option key={`${run.startedAt}-${index}`} value={index}>
                        {index + 1} of {imageRuns.length} · {run.trigger} · {run.result.status}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {graph && shownView === "flow" && <SlpDeepDetailsFlow graph={graph} />}
          {graph && shownView === "canvas" && <SlpDeepDetailsCanvas graph={graph} />}

          {shownView === "data" && (
            <>
              <Section title="Why this post" step={1} status={data.plan || details ? "done" : "missing"}>
                <Rows
                  rows={[
                    ["Plan", data.plan ? `${data.plan.workflow} · ${data.plan.id}` : null],
                    ["Planned", data.plan ? formatTime(data.plan.plannedAt) : null],
                    ["Due", data.plan?.dueAt ? formatTime(data.plan.dueAt) : null],
                    ["Completed", data.plan?.completedAt ? formatTime(data.plan.completedAt) : null],
                    ["Scheduled slot", data.plan?.slotId ?? null],
                    ["Answers request", data.plan?.sourceEventId ?? null],
                    ["Promised subject", data.plan?.topic ?? null],
                    ["Player direction", details?.direction ?? null],
                    ["Campaign", details?.plan.campaignId ?? null],
                    ["Shoot", details?.plan.shootId ?? str(data.post.metadata.shootId)],
                    ["Reused picture from", details?.plan.reusedFromPostId ?? str(data.post.metadata.reusedFromPostId)],
                    ["Subscribers asked for", details?.plan.demandTopic ?? null],
                    [
                      "Project",
                      details?.plan.project
                        ? `${details.plan.project.title}${details.plan.project.chapter ? ` — ${details.plan.project.chapter}` : ""}`
                        : null,
                    ],
                    ["Post number", details ? String(details.sequence + 1) : null],
                    ["Written", details ? formatTime(details.generatedAt) : null],
                    ["Publishes", details?.publicationTime ? formatTime(details.publicationTime) : null],
                  ]}
                />
              </Section>

              {details && (
                <Section title="The angle" step={2} status={details.angle ? "done" : "skipped"}>
                  <Rows
                    rows={[
                      ["Place", details.angle?.place ?? null],
                      ["Moment", details.angle?.moment ?? null],
                      ["Company", details.angle?.company ?? null],
                      ["Framing", details.camera ? null : (details.angle?.framing ?? null)],
                      ["Camera", details.camera],
                      // The drawn composition tag leads the camera phrase the image brief received.
                      ["Shot", details.camera ? (details.visualBrief?.camera ?? null) : null],
                      ["Effort", details.effort],
                      ["Planner", details.planner?.mode ?? null],
                      [
                        "Heat",
                        details.planner?.heat
                          ? `${details.planner.heat.planned} (dial: ${details.planner.heat.dial})`
                          : null,
                      ],
                      [
                        "Beat",
                        details.planner?.beat ? `${details.planner.beat.type}: ${details.planner.beat.line}` : null,
                      ],
                      [
                        "Anchor",
                        details.planner?.beat
                          ? `${details.planner.beat.anchorKind}: ${details.planner.beat.anchor}`
                          : null,
                      ],
                      [
                        "Cast",
                        details.planner?.beat ? details.planner.beat.cast.join(", ") || "no named people" : null,
                      ],
                      ["Beat place", details.planner?.beat?.place ?? null],
                      [
                        "Callback",
                        details.planner?.beat?.reference
                          ? `${details.planner.beat.reference.kind}: ${details.planner.beat.reference.text}`
                          : null,
                      ],
                      [
                        "Claim check",
                        details.planner?.claimCheck
                          ? details.planner.claimCheck.ok
                            ? details.planner.claimCheck.revised
                              ? "passed after one revision"
                              : "passed"
                            : `${details.planner.claimCheck.revised ? "still off after revision" : "mismatch"}: ${details.planner.claimCheck.problems.join("; ")}`
                          : null,
                      ],
                    ]}
                  />
                </Section>
              )}

              {details && (
                <Section title="Creator strategy" step={3} status={recorded}>
                  <Rows
                    rows={[
                      ["Production style", details.strategy.style],
                      ["Quiet slots", `${details.strategy.skipRate}%`],
                      ["Lean on words", `${details.strategy.textOnlyRate} / 100`],
                    ]}
                  />
                  <WeightBars weights={details.strategy.intentWeights} highlight={details.plan.intent} />
                </Section>
              )}

              {details && (
                <Section title="Writing model" step={4} status={details.attempts > 1 ? "retried" : "done"}>
                  <Rows
                    rows={[
                      ["Provider", details.model.provider],
                      ["Model", details.model.model],
                      ["Temperature", details.model.temperature?.toString() ?? null],
                      ["Top P", details.model.topP?.toString() ?? null],
                      ["Max tokens", details.model.maxTokens?.toString() ?? null],
                      ["Attempts", String(details.attempts)],
                      [
                        "Model wrote the image prompt",
                        details.askedModelForImagePrompt ? "yes" : "no, briefed from the situation",
                      ],
                    ]}
                  />
                </Section>
              )}

              {details && (
                <Section
                  title="Writing prompt"
                  step={5}
                  status="done"
                  action={
                    <CopyButton
                      value={details.messages.map((m) => `# ${m.role}\n${m.content}`).join("\n\n")}
                      label="Copy prompt"
                    />
                  }
                >
                  <div className="space-y-3">
                    {details.messages.map((message, index) => (
                      <PromptMessage key={index} role={message.role} content={message.content} />
                    ))}
                  </div>
                </Section>
              )}

              {details && (
                <Section title="The draft" step={6} status="done">
                  <Rows
                    rows={[
                      ["Title", details.modelOutput.title],
                      ["Content", details.modelOutput.content],
                      ["Image prompt", details.modelOutput.imagePrompt],
                      [
                        "Scene plan",
                        details.modelOutput.scene ? JSON.stringify(details.modelOutput.scene, null, 2) : null,
                      ],
                      ["Requested wardrobe", details.wardrobeSelection?.requestedId ?? null],
                      ["Selected wardrobe", details.wardrobeSelection?.selectedId ?? null],
                      ["Wardrobe fallback", details.wardrobeSelection?.fallback ? "yes" : null],
                    ]}
                  />
                  <Block label="Raw response" text={details.rawResponse} collapsed />
                </Section>
              )}

              <Section
                title="Image brief"
                step={details ? 7 : undefined}
                status={details?.imageBrief ? "done" : "missing"}
              >
                <Rows
                  rows={[
                    ["Image brief", details?.imageBrief ?? null],
                    ["Typed visual brief", details?.visualBrief ? JSON.stringify(details.visualBrief, null, 2) : null],
                  ]}
                />
              </Section>

              {imageRuns.length > 0 ? (
                <SlpDeepDetailsImageRuns runs={imageRuns} firstStep={8} imageUrl={data.post.imageUrl} />
              ) : (
                details && (
                  <p className="rounded-lg bg-[var(--slurp-surface-raised)] p-3 text-xs leading-5 text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--slurp-outline)]">
                    {t("ui.slurp.deepDetails.imageRunsNotRecorded", {
                      defaultValue:
                        "Image settings, the prompt rewrite, and provider attempts were not recorded for this post. Posts made after this update record every image run.",
                    })}
                  </p>
                )
              )}

              <Section title="The picture now">
                <Rows
                  rows={[
                    ["Final provider prompt", imageRuns.length > 0 ? null : (details?.providerPrompt ?? null)],
                    ["Stored image prompt", data.post.imagePrompt],
                    ["Provider", str(data.post.metadata.imageProvider)],
                    ["Image model", str(data.post.metadata.imageModel)],
                    ["Style profile", str(data.post.metadata.imageStyleProfileId)],
                    [
                      "Generation failed",
                      data.post.metadata.imageGenerationFailed === true
                        ? (str(data.post.metadata.imageGenerationError) ?? "yes")
                        : null,
                    ],
                    ["Attachments", data.post.images.length > 1 ? String(data.post.images.length) : null],
                  ]}
                />
                {data.post.images.slice(1).map((image) => (
                  <Block
                    key={image.position}
                    label={`Picture ${image.position + 1} prompt`}
                    text={image.imagePrompt ?? "—"}
                  />
                ))}
              </Section>

              <Section title="Since it went up">
                <Rows
                  rows={[
                    ["Likes", String(data.stats.likes)],
                    ["Replies", String(data.stats.replies)],
                    ["Unlocks", String(data.stats.unlocks)],
                    [
                      "Last edited",
                      data.post.updatedAt !== data.post.createdAt ? formatTime(data.post.updatedAt) : null,
                    ],
                  ]}
                />
                {data.links.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-[var(--muted-foreground)]">
                    {data.links.map((link, index) => (
                      <li key={index} className="break-all">
                        {link.fromType} {link.fromId} —{link.relation}→ {link.toType} {link.toId}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Tags and metadata">
                <Rows
                  rows={Object.entries(data.post.metadata).map(([key, value]) => [
                    key,
                    typeof value === "string" ? value : JSON.stringify(value),
                  ])}
                  mono
                />
              </Section>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

/** One chat message, split at its markdown headings so each part of the prompt reads on its own. */
function PromptMessage({ role, content }: { role: string; content: string }) {
  const parts = content.split(/\n(?=#{1,2} )/u);
  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-inset ring-[var(--slurp-outline)]">
      <p className="flex items-center justify-between bg-[var(--slurp-canvas)] px-3 py-2 text-xs font-bold uppercase tracking-wide">
        {role}
        <span className="font-normal normal-case tabular-nums text-[var(--muted-foreground)]">
          {content.length} characters
        </span>
      </p>
      <div className="divide-y divide-[var(--slurp-outline)]">
        {parts.map((part, index) => {
          const heading = /^#{1,2} (.+)$/mu.exec(part.split("\n")[0] ?? "");
          const body = heading ? part.split("\n").slice(1).join("\n") : part;
          return (
            <div key={index} className="px-3 py-2.5">
              {heading && <p className="mb-1 text-xs font-bold text-[var(--noodle-accent)]">{heading[1]}</p>}
              <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-[var(--foreground)]">
                {body.trim()}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeightBars({ weights, highlight }: { weights: Record<string, number>; highlight: string | null }) {
  const entries = Object.entries(weights);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, weight]) => weight), 1);
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-semibold text-[var(--muted-foreground)]">Saved intent weights</p>
      {entries.map(([intent, weight]) => (
        <div key={intent} className="grid grid-cols-[8rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs">
          <span className={intent === highlight ? "font-bold text-[var(--noodle-accent)]" : ""}>{intent}</span>
          <span className="h-2 overflow-hidden rounded-full bg-[var(--slurp-canvas)]">
            <span
              className="block h-full rounded-full bg-[var(--noodle-accent)]"
              style={{ width: `${(weight / max) * 100}%` }}
            />
          </span>
          <span className="text-end tabular-nums text-[var(--muted-foreground)]">{weight}</span>
        </div>
      ))}
    </div>
  );
}
