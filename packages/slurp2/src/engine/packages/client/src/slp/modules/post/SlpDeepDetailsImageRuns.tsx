import type { SlpDeepDetailsImageRun } from "../../../../../shared/src/slp/slp-deep-details.js";
import { Block, CopyButton, formatTime, Rows, Section, type SlpStepStatus } from "./SlpDeepDetailsParts";

const TRIGGER_LABEL: Record<SlpDeepDetailsImageRun["trigger"], string> = {
  generation: "Drawn with the post",
  review: "Prepared for prompt review",
  reviewed: "Drawn from the reviewed prompt",
  retry: "Automatic redraw",
  reserve: "Drawn for the post reserve",
};

const APPEARANCE_LABEL: Record<SlpDeepDetailsImageRun["appearance"]["source"], string> = {
  stage: "Creator stage appearance",
  "source-card": "Linked card appearance",
  reference: "Reference appearance block",
  none: "No appearance",
};

const REWRITE_STATUS: Record<SlpDeepDetailsImageRun["rewrite"]["status"], SlpStepStatus> = {
  skipped: "skipped",
  accepted: "done",
  rejected: "rejected",
  failed: "failed",
};

const LOW_LIGHT =
  /\b(?:dim(?:ly)?|dark(?:ness)?|low[- ]light|shadows?|grainy?|noise|night|moody|motion blur|soft focus)\b/giu;

/**
 * Plain facts about the final prompt, so a reader can scan what it asked for. They say what the
 * text contains, never what it did to the picture.
 */
function promptNotes(run: SlpDeepDetailsImageRun): string[] {
  const prompt = run.finalPrompt?.toLowerCase() ?? "";
  if (!prompt) return [];
  const notes: string[] = [];
  const styleTags = run.styleProfile.positiveTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag && prompt.includes(tag.toLowerCase()));
  if (styleTags.length > 0)
    notes.push(`Includes ${run.styleProfile.name || "style profile"} tags: ${styleTags.join(", ")}`);
  const lowLight = [...new Set(prompt.match(LOW_LIGHT) ?? [])];
  if (lowLight.length > 0) notes.push(`Includes low-light wording: ${lowLight.join(", ")}`);
  const look = run.appearance.text.trim().slice(0, 60).toLowerCase();
  if (look.length >= 20 && prompt.split(look).length > 2) notes.push("Repeats the appearance description");
  return notes;
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Every recorded pass through the image pipeline, newest open, each step in the order it ran. */
export function SlpDeepDetailsImageRuns({
  runs,
  firstStep,
  imageUrl,
}: {
  runs: SlpDeepDetailsImageRun[];
  firstStep: number;
  imageUrl: string | null;
}) {
  const latestSaved = runs.map((run) => run.result.status).lastIndexOf("saved");
  return (
    <div className="space-y-3">
      {runs.map((run, index) => (
        <details
          key={`${run.startedAt}-${index}`}
          open={index === runs.length - 1}
          className="rounded-xl ring-1 ring-inset ring-[var(--slurp-outline)]"
        >
          <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]">
            <span className="font-black uppercase tracking-[0.12em] text-[var(--noodle-accent)]">
              Image run {index + 1} of {runs.length}
            </span>
            <span>{TRIGGER_LABEL[run.trigger]}</span>
            <span className="tabular-nums text-[var(--muted-foreground)]">{formatTime(run.startedAt)}</span>
            <span
              className={`font-bold ${run.result.status === "failed" ? "text-[var(--destructive)]" : "text-[var(--slurp-success)]"}`}
            >
              {run.result.status === "saved" ? "Saved" : run.result.status === "preview" ? "Prompt only" : "Failed"}
            </span>
          </summary>
          <div className="space-y-3 p-3 pt-0">
            <ImageRunSteps run={run} firstStep={firstStep} imageUrl={index === latestSaved ? imageUrl : null} />
          </div>
        </details>
      ))}
    </div>
  );
}

function ImageRunSteps({
  run,
  firstStep,
  imageUrl,
}: {
  run: SlpDeepDetailsImageRun;
  firstStep: number;
  imageUrl: string | null;
}) {
  const notes = promptNotes(run);
  const failedAttempts = run.attempts.filter((attempt) => !attempt.ok).length;
  return (
    <>
      <Section title="Image settings" step={firstStep} status="done">
        <Rows
          rows={[
            ["Connection", run.connection.name ?? run.connection.id],
            ["Provider", run.connection.provider],
            ["Model", run.connection.model],
            ["Service", [run.connection.source, run.connection.service].filter(Boolean).join(" · ") || null],
            ["Fallback connection", run.connection.hasFallback ? "configured" : "none"],
            ["Size", run.size.width && run.size.height ? `${run.size.width} × ${run.size.height}` : null],
            ["Include descriptions", run.settings.includeDescriptions ? "on" : "off"],
            ["Avatar references", run.settings.avatarReferences ? `on · ${run.referenceImages} sent` : "off"],
            ["Prompt rewrite", run.settings.interpretation ? "on" : "off"],
          ]}
        />
      </Section>

      <Section title="Appearance" step={firstStep + 1} status={run.appearance.source === "none" ? "skipped" : "done"}>
        <Rows rows={[["Source", APPEARANCE_LABEL[run.appearance.source]]]} />
        {run.appearance.text && <Block label="Appearance text" text={run.appearance.text} collapsed />}
      </Section>

      <Section title="Template and style" step={firstStep + 2} status={run.templatePrompt ? "done" : "missing"}>
        <Rows
          rows={[
            [
              "Style profile",
              run.styleProfile.name
                ? `${run.styleProfile.name}${run.styleProfile.chosenBy === "creator" ? " · Creator setting" : run.styleProfile.chosenBy === "slurp" ? " · Slurp setting" : " · default"}`
                : null,
            ],
            ["Style text", run.styleProfile.styleText || null],
            ["Style tags", run.styleProfile.positiveTags || null],
            ["Style negative tags", run.styleProfile.negativeTags || null],
          ]}
        />
        {run.templatePrompt && <Block label="Rendered template" text={run.templatePrompt} collapsed />}
        {run.styledPrompt && <Block label="Template with style applied" text={run.styledPrompt} collapsed />}
      </Section>

      <Section title="Prompt rewrite" step={firstStep + 3} status={REWRITE_STATUS[run.rewrite.status]}>
        <Rows
          rows={[
            [
              "Result",
              run.rewrite.status === "skipped"
                ? "Not run"
                : run.rewrite.status === "accepted"
                  ? "Rewrite used, style applied again"
                  : run.rewrite.status === "rejected"
                    ? "Rewrite discarded; the styled template was sent"
                    : "No rewrite came back; the styled template was sent",
            ],
            ["Reason", run.rewrite.reason],
          ]}
        />
        {run.rewrite.input && <Block label="Sent to the rewrite model" text={run.rewrite.input} collapsed />}
        {run.rewrite.output && <Block label="Rewrite model answer" text={run.rewrite.output} collapsed />}
      </Section>

      <Section
        title="Final prompt"
        step={firstStep + 4}
        status={run.finalPrompt ? "done" : "missing"}
        action={run.finalPrompt ? <CopyButton value={run.finalPrompt} label="Copy prompt" /> : undefined}
      >
        <div className={imageUrl ? "grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]" : ""}>
          <div className="min-w-0">
            {notes.length > 0 && (
              <ul className="mb-2 space-y-1 text-xs">
                {notes.map((note) => (
                  <li key={note} className="rounded-md bg-[var(--slurp-canvas)] px-2 py-1">
                    {note}
                  </li>
                ))}
              </ul>
            )}
            {run.finalPrompt && <Block label="Sent to the image provider" text={run.finalPrompt} />}
            {run.negativePrompt && <Block label="Negative prompt" text={run.negativePrompt} collapsed />}
          </div>
          {imageUrl && (
            <img
              src={imageUrl}
              alt="The picture this run saved"
              className="w-full rounded-lg object-cover ring-1 ring-inset ring-[var(--slurp-outline)]"
            />
          )}
        </div>
      </Section>

      <Section
        title="Provider attempts"
        step={firstStep + 5}
        status={
          run.attempts.length === 0
            ? run.result.status === "preview"
              ? "skipped"
              : "missing"
            : run.attempts.at(-1)?.ok
              ? failedAttempts > 0
                ? "retried"
                : "done"
              : "failed"
        }
      >
        {run.attempts.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            {run.result.status === "preview" ? "Nothing was sent; the prompt waited for review." : "—"}
          </p>
        ) : (
          <ol className="space-y-1.5 text-xs">
            {run.attempts.map((attempt) => (
              <li
                key={attempt.attempt}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md bg-[var(--slurp-canvas)] px-2 py-1.5"
              >
                <span className="font-bold tabular-nums">#{attempt.attempt}</span>
                <span className="tabular-nums text-[var(--muted-foreground)]">{formatTime(attempt.startedAt)}</span>
                <span className="tabular-nums">{seconds(attempt.durationMs)}</span>
                <span>{attempt.route === "host" ? "Engine image service" : "Bundled image service"}</span>
                <span
                  className={`font-bold ${attempt.ok ? "text-[var(--slurp-success)]" : "text-[var(--destructive)]"}`}
                >
                  {attempt.ok ? "Succeeded" : "Failed"}
                </span>
                {attempt.error && <span className="basis-full break-words">{attempt.error}</span>}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section
        title="Result"
        step={firstStep + 6}
        status={run.result.status === "failed" ? "failed" : run.result.status === "preview" ? "skipped" : "done"}
      >
        <Rows
          rows={[
            [
              "Outcome",
              run.result.status === "saved"
                ? "Picture saved"
                : run.result.status === "preview"
                  ? "Prompt prepared for review"
                  : "No picture",
            ],
            ["Saved file", run.result.mediaPath],
            ["Error", run.result.error],
          ]}
          mono
        />
      </Section>
    </>
  );
}
