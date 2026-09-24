import { ChevronDown, ChevronUp, CornerDownRight, Cpu, Database, Lightbulb, Link2 } from "lucide-react";
import { useState } from "react";
import type { SlpFlowGraph, SlpFlowNode, SlpFlowRow } from "./slp-deep-details-flow";
import { Block, CopyButton, StepStatus } from "./SlpDeepDetailsParts";

const LANE_TITLE: Record<SlpFlowNode["lane"], string> = {
  text: "Writing the post",
  image: "Drawing the picture",
};

const PREVIEW_CHARS = 360;
const PREVIEW_LINES = 6;

/**
 * Exact recorded text, readable in place. Short text shows whole; long text shows its first lines
 * under a fade and opens fully on request, so a prompt is never more than one click away.
 */
export function SlpTextPreview({
  label,
  text,
  note,
  from,
}: {
  label: string;
  text: string;
  note?: string | null;
  from?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const long = text.length > PREVIEW_CHARS || text.split("\n").length > PREVIEW_LINES;
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl bg-[var(--slurp-canvas)] ring-1 ring-inset ring-[var(--slurp-outline)]">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--slurp-outline)] px-3 py-1.5">
        <span className="text-xs font-semibold">
          {label}
          <span className="ms-2 font-normal tabular-nums text-[var(--muted-foreground)]">
            {text.length.toLocaleString()} characters
          </span>
        </span>
        <CopyButton value={text} label="Copy" />
      </figcaption>
      <pre
        className={`whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-xs leading-5 ${
          open ? "max-h-[70vh] overflow-auto" : long ? "max-h-32 overflow-hidden" : ""
        }`}
        style={
          long && !open
            ? {
                maskImage: "linear-gradient(to bottom, black 55%, transparent)",
                WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)",
              }
            : undefined
        }
      >
        {text}
      </pre>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-10 w-full items-center justify-center gap-1.5 border-t border-[var(--slurp-outline)] text-xs font-semibold hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
        >
          {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {open ? "Show less" : "Show all"}
        </button>
      )}
      {(note || from) && (
        <div className="space-y-0.5 border-t border-[var(--slurp-outline)] px-3 py-1.5">
          {from && <From text={from} />}
          {note && <Note text={note} />}
        </div>
      )}
    </figure>
  );
}

function From({ text }: { text: string }) {
  return (
    <p className="flex gap-1.5 text-xs leading-5 text-[var(--muted-foreground)]">
      <Link2 size={13} aria-hidden="true" className="mt-1 shrink-0" />
      <span>
        <span className="font-semibold">From </span>
        {text}
      </span>
    </p>
  );
}

function Note({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`flex gap-1.5 text-xs leading-5 text-[var(--muted-foreground)] ${className}`}>
      <CornerDownRight size={13} aria-hidden="true" className="mt-1 shrink-0" />
      {text}
    </p>
  );
}

/** Short facts as a label/value grid; anything with exact text becomes a preview underneath. */
function RowGroup({ title, rows }: { title: string; rows: SlpFlowRow[] }) {
  const shown = rows.filter((row) => row.value || row.text);
  if (shown.length === 0) return null;
  const facts = shown.filter((row) => !row.text);
  const texts = shown.filter((row) => row.text);
  return (
    <section className="space-y-2">
      <h5 className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">{title}</h5>
      {facts.length > 0 && (
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)]">
          {facts.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-xs text-[var(--muted-foreground)]">{row.label}</dt>
              <dd className="min-w-0 text-sm leading-5">
                <span className="break-words">{row.value}</span>
                {row.from && <From text={row.from} />}
                {row.note && <Note text={row.note} />}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {texts.map((row) => (
        <SlpTextPreview key={row.label} label={row.label} text={row.text!} note={row.note} from={row.from} />
      ))}
    </section>
  );
}

function Why({ text }: { text: string }) {
  return (
    <p className="flex gap-2 text-xs leading-5 text-[var(--muted-foreground)]">
      <Lightbulb size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>
        <span className="font-semibold text-[var(--foreground)]">Why: </span>
        {text}
      </span>
    </p>
  );
}

export function ModelChip({ model }: { model: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[var(--slurp-canvas)] px-2 py-1 font-mono text-xs ring-1 ring-inset ring-[var(--slurp-outline)]">
      <Cpu size={13} aria-hidden="true" className="shrink-0 text-[var(--muted-foreground)]" />
      <span className="truncate">{model}</span>
    </span>
  );
}

/** Everything about one node: what happens, what went in, what came out, and why. */
export function SlpFlowNodeBody({ node }: { node: SlpFlowNode }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6">{node.what}</p>
      <RowGroup title="Input" rows={node.inputs} />
      <RowGroup title="Output" rows={node.outputs} />
      {node.details.length > 0 && (
        <section className="space-y-1">
          <h5 className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">Log</h5>
          {node.details.map((detail) => (
            <Block key={detail.label} label={detail.label} text={detail.text} />
          ))}
        </section>
      )}
      <Why text={node.why} />
    </div>
  );
}

/** A source that feeds a step, shown inside that step so the reader sees it where it was used. */
function SourceCard({ node, label }: { node: SlpFlowNode; label: string | null }) {
  return (
    <details className="group rounded-xl bg-[var(--slurp-canvas)] ring-1 ring-inset ring-[var(--slurp-outline)]" open>
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]">
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="-rotate-90 transition-transform group-open:rotate-0 motion-reduce:transition-none"
        />
        <span className="text-sm font-semibold">{node.title}</span>
        {label && <span className="text-xs text-[var(--muted-foreground)]">used as {label}</span>}
        <span className="ms-auto">
          <StepStatus status={node.status} />
        </span>
      </summary>
      <div className="border-t border-[var(--slurp-outline)] p-3">
        <SlpFlowNodeBody node={node} />
      </div>
    </details>
  );
}

/**
 * The generation read top to bottom as a stepper: a numbered rail on the left, each step's full
 * record on the right, and every source shown inside the step that used it.
 */
export function SlpDeepDetailsFlow({ graph }: { graph: SlpFlowGraph }) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const main = graph.nodes.filter((node) => node.kind === "step" || node.kind === "model");
  const sources = graph.nodes.filter((node) => node.kind === "source");
  return (
    <div className="space-y-6">
      {sources.length > 0 && <DataSources sources={sources} />}
      <ol aria-label="Generation steps" className="relative">
        {main.map((node, index) => {
          const sources = graph.edges
            .filter((edge) => edge.to === node.id && byId.get(edge.from)?.kind === "input")
            .map((edge) => ({ node: byId.get(edge.from)!, label: edge.label }));
          const laneStarts = index === 0 || main[index - 1]!.lane !== node.lane;
          const last = index === main.length - 1;
          return (
            <li key={node.id} className="relative">
              {laneStarts && (
                <h4 className={`mb-3 text-xs font-black uppercase tracking-[0.14em] ${index > 0 ? "mt-2" : ""}`}>
                  {LANE_TITLE[node.lane]}
                </h4>
              )}
              <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
                <div className="relative flex justify-center" aria-hidden="true">
                  {!last && <span className="absolute inset-y-0 top-8 w-px bg-[var(--slurp-outline)]" />}
                  <span className="relative z-10 grid size-8 place-items-center rounded-full bg-[var(--slurp-surface-raised)] text-xs font-bold tabular-nums ring-1 ring-inset ring-[var(--slurp-outline)]">
                    {index + 1}
                  </span>
                </div>
                <article className="mb-5 min-w-0 rounded-2xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
                  <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--slurp-outline)] px-4 py-3">
                    <h4 className="text-base font-bold">{node.title}</h4>
                    <StepStatus status={node.status} />
                    {node.model && (
                      <span className="ms-auto min-w-0">
                        <ModelChip model={node.model} />
                      </span>
                    )}
                  </header>
                  <div className="space-y-4 p-4">
                    {sources.length > 0 && (
                      <section className="space-y-2">
                        <h5 className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                          Sources used here
                        </h5>
                        {sources.map((source) => (
                          <SourceCard key={source.node.id} node={source.node} label={source.label} />
                        ))}
                      </section>
                    )}
                    <SlpFlowNodeBody node={node} />
                  </div>
                </article>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The places this post's data came from, before the steps that used it. Each field names the steps
 * that read it; each row in the steps names its source, so the map reads in both directions.
 */
function DataSources({ sources }: { sources: SlpFlowNode[] }) {
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
        <Database size={14} aria-hidden="true" />
        Where the data comes from
      </h4>
      <div className="grid gap-2 md:grid-cols-2">
        {sources.map((source) => (
          <details
            key={source.id}
            className="group min-w-0 rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]">
              <ChevronDown
                size={14}
                aria-hidden="true"
                className="mt-1 shrink-0 -rotate-90 transition-transform group-open:rotate-0 motion-reduce:transition-none"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{source.title}</span>
                <span className="block text-xs text-[var(--muted-foreground)]">
                  {source.outputs.length} {source.outputs.length === 1 ? "value" : "values"} used in this post
                </span>
              </span>
            </summary>
            <div className="space-y-3 border-t border-[var(--slurp-outline)] p-3">
              <p className="text-xs leading-5">{source.what}</p>
              <dl className="space-y-2">
                {source.outputs.map((row) => (
                  <div key={row.label} className="text-xs leading-5">
                    <dt className="font-semibold">{row.label}</dt>
                    <dd className="text-[var(--muted-foreground)]">Used in: {row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
