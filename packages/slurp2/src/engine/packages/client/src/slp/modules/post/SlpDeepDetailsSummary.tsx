import i18next from "i18next";
import {
  Camera,
  ChevronRight,
  Clapperboard,
  Coins,
  Compass,
  Flag,
  Flame,
  Heart,
  PenLine,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { SlpDeepDetailsResponse } from "../../../../../shared/src/slp/slp-deep-details.js";
import { SLP_GROUP_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { Block, StepStatus } from "./SlpDeepDetailsParts";
import {
  buildSlpDeepDetailsStory,
  type SlpDeepChainStep,
  type SlpDeepRow,
  type SlpDeepRowId,
} from "./slp-deep-details-story";

const ROW_ICON: Record<SlpDeepRowId, LucideIcon> = {
  why: Flag,
  happens: Clapperboard,
  voice: UserRound,
  steering: Compass,
  spice: Flame,
  together: UsersRound,
  picture: Camera,
  writing: PenLine,
  cost: Coins,
  since: Heart,
};

/**
 * The phone view of Deep details (04 §9, M): the post's story in a few rows (why it went up, what
 * happens, who the Creator was that day, your steering, spice, who it was made with, the picture,
 * the writing, the cost, how it did). Each row is one line that opens to plain words; the full
 * record stays in "All data".
 */
export function SlpDeepDetailsSummary({ data }: { data: SlpDeepDetailsResponse }) {
  const rows = buildSlpDeepDetailsStory(data, i18next.language);
  return (
    <div className={SLP_GROUP_CLASS}>
      {rows.map((row) => (
        <SummaryRow key={row.id} row={row} />
      ))}
    </div>
  );
}

/** One 56 px row: icon, title, one line of what happened, and the story behind it when opened. */
function SummaryRow({ row }: { row: SlpDeepRow }) {
  const Icon = ROW_ICON[row.id];
  const body = rowBody(row);
  const head = (
    <>
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--slurp-canvas)] text-[var(--slurp-muted)]"
        aria-hidden="true"
      >
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`${SLP_TYPE.body} block font-semibold`}>{row.title}</span>
        <span className={`${SLP_TYPE.meta} block truncate text-[var(--slurp-muted)]`}>
          {row.line ?? "Not recorded"}
        </span>
      </span>
      {row.status && <StepStatus status={row.status} />}
    </>
  );
  if (!body || row.line === null) return <div className="flex min-h-14 items-center gap-3 px-4 py-2">{head}</div>;
  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
        {head}
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="shrink-0 text-[var(--slurp-muted)] transition-transform duration-[var(--slurp-motion-base)] group-open:rotate-90 motion-reduce:transition-none"
        />
      </summary>
      <div className="space-y-3 px-4 pb-4 ps-15">{body}</div>
    </details>
  );
}

function rowBody(row: SlpDeepRow): ReactNode {
  const parts: ReactNode[] = [];
  if (row.chain?.length) parts.push(<Chain key="chain" steps={row.chain} />);
  if (row.quote) {
    parts.push(
      <figure key="quote" className="rounded-xl bg-[var(--slurp-canvas)] px-3 py-2">
        <figcaption className={`${SLP_TYPE.meta} text-[var(--slurp-muted)]`}>{row.quote.label}</figcaption>
        <blockquote className={`${SLP_TYPE.body} mt-1 whitespace-pre-wrap break-words italic`}>
          “{row.quote.text}”
        </blockquote>
      </figure>,
    );
  }
  if (row.items?.length) {
    parts.push(
      <ul key="items" className="space-y-1.5">
        {row.items.map((item) => (
          <li key={item.text} className={`${SLP_TYPE.body} flex gap-2 break-words`}>
            <SlpSparkleGlyph
              size={12}
              aria-hidden="true"
              className="mt-1 shrink-0 text-[var(--noodle-accent-foreground)]"
            />
            <span className="min-w-0">
              {item.text}
              {item.note && <span className="text-[var(--slurp-muted)]"> · {item.note}</span>}
            </span>
          </li>
        ))}
      </ul>,
    );
  }
  if (row.sentences?.length) {
    parts.push(
      <div key="sentences" className="space-y-1.5">
        {row.sentences.map((sentence) => (
          <p key={sentence} className={`${SLP_TYPE.body} break-words`}>
            {sentence}
          </p>
        ))}
      </div>,
    );
  }
  if (row.changes && (row.changes.added.length || row.changes.dropped.length)) {
    parts.push(<Changes key="changes" added={row.changes.added} dropped={row.changes.dropped} />);
  }
  const facts = (row.facts ?? []).filter((fact): fact is [string, string] => Boolean(fact[1]));
  if (facts.length) {
    // Label over value: the phone is too narrow for two columns once the row is indented.
    parts.push(
      <dl key="facts" className="grid grid-cols-2 gap-x-4 gap-y-2">
        {facts.map(([label, value]) => (
          <div key={label} className={value.length > 24 ? "col-span-2 min-w-0" : "min-w-0"}>
            <dt className={`${SLP_TYPE.meta} text-[var(--slurp-muted)]`}>{label}</dt>
            <dd className={`${SLP_TYPE.body} break-words`}>{value}</dd>
          </div>
        ))}
      </dl>,
    );
  }
  for (const block of row.blocks ?? []) {
    if (block.text) parts.push(<Block key={block.label} label={block.label} text={block.text} collapsed />);
  }
  return parts.length ? parts : null;
}

const STEP_DOT: Record<SlpDeepChainStep["state"], string> = {
  done: "bg-[var(--slurp-muted)]",
  this: "bg-[var(--noodle-accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--noodle-accent)_25%,transparent)]",
  next: "bg-transparent ring-2 ring-inset ring-[var(--slurp-muted)]",
};

/** The purpose chain as a small vertical timeline: tease → drop, poll → answer, a pack's moment. */
function Chain({ steps }: { steps: SlpDeepChainStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => (
        <li key={`${step.label}${index}`} className="flex gap-3">
          <span className="flex w-3 flex-col items-center" aria-hidden="true">
            <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${STEP_DOT[step.state]}`} />
            {index < steps.length - 1 && <span className="w-px flex-1 bg-[var(--slurp-muted)] opacity-40" />}
          </span>
          <span className="min-w-0 flex-1 pb-3">
            <span className={`${SLP_TYPE.meta} block text-[var(--slurp-muted)]`}>
              {step.label}
              {step.state === "next" ? " · still to come" : ""}
            </span>
            <span
              className={`${SLP_TYPE.body} block break-words ${step.state === "this" ? "font-semibold text-[var(--noodle-accent-foreground)]" : ""}`}
            >
              {step.text}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** What the enhance step changed in the picture prompt, as two chip lists. */
function Changes({ added, dropped }: { added: string[]; dropped: string[] }) {
  const chips = (label: string, list: string[], sign: string) =>
    list.length > 0 && (
      <div>
        <p className={`${SLP_TYPE.meta} mb-1 text-[var(--slurp-muted)]`}>{label}</p>
        <ul className="flex flex-wrap gap-1.5">
          {list.map((part) => (
            <li
              key={part}
              className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-full bg-[var(--slurp-canvas)] px-2.5 text-xs"
            >
              <span aria-hidden="true" className="text-[var(--slurp-muted)]">
                {sign}
              </span>
              <span className="min-w-0 truncate">{part}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="space-y-2">
      {chips("The enhance step added", added, "+")}
      {chips("and left out", dropped, "−")}
    </div>
  );
}
