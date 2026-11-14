import { useId, useState, type KeyboardEvent } from "react";
import { Button, ModalDialog } from "../shared-controls";
import { useLtmTranslation } from "../localization";
import { nextTabIndex } from "../tab-keys";

/**
 * "What model to use?" beside the extraction connection: a dialog with two tabs, hosted models and models you run
 * yourself. Each ranks extraction models in a table (about 800px tall, so it fits a 900px-high desktop) that says why
 * the model holds its place (display name over the id to pick in the connection); the first row is tinted, and the
 * other tested models follow as a labelled group. Hosted scores are 1-10 (10 = best; for price, 10 = cheapest), shown
 * as five stars with half steps; the number is the accessible text. Self-hosted models are scored on quality only: their speed and cost depend on the person's setup.
 * They come from the 2026-11-06/07 extraction benchmark (hosted APIs plus open-weight models on ArliAI and NanoGPT,
 * 15 chat summaries each, graded by Opus against a reference run).
 * ponytail: the ranking is a fixed table; re-run the benchmark and edit RANKED/SELF_HOST/OTHERS when models or
 * defaults change.
 */
type RankedModel = {
  name: string;
  model: string;
  quality: number;
  speed?: number;
  price?: number;
  why: string;
};

const RANKED: RankedModel[] = [
  {
    name: "GPT-6 Luna",
    model: "gpt-6-luna",
    quality: 8,
    speed: 8,
    price: 10,
    why: "ui.longTermMemory.memorysettings.whatModelWhyLuna",
  },
  {
    name: "Claude Opus 5.5",
    model: "claude-opus-5-5",
    quality: 10,
    speed: 7,
    price: 2,
    why: "ui.longTermMemory.memorysettings.whatModelWhyOpus",
  },
  {
    name: "GPT-6.1 Sol",
    model: "gpt-6.1-sol",
    quality: 8,
    speed: 4,
    price: 3,
    why: "ui.longTermMemory.memorysettings.whatModelWhySol",
  },
  {
    name: "MiMo V2.6 Pro",
    model: "mimo-v2.6-pro",
    quality: 7,
    speed: 3,
    price: 9,
    why: "ui.longTermMemory.memorysettings.whatModelWhyMimo",
  },
  {
    name: "Claude Haiku 5.5",
    model: "claude-haiku-5-5",
    quality: 7,
    speed: 7,
    price: 9,
    why: "ui.longTermMemory.memorysettings.whatModelWhyHaiku",
  },
  {
    name: "Kimi K3.1 Pro",
    model: "kimi-k3.1-pro",
    quality: 6,
    speed: 9,
    price: 4,
    why: "ui.longTermMemory.memorysettings.whatModelWhyKimi",
  },
  {
    name: "DeepSeek V4.1 Flash",
    model: "deepseek-v4.1-flash",
    quality: 5,
    speed: 10,
    price: 10,
    why: "ui.longTermMemory.memorysettings.whatModelWhyDeepseek",
  },
  {
    name: "GLM-5.3",
    model: "glm-5.3",
    quality: 6,
    speed: 5,
    price: 9,
    why: "ui.longTermMemory.memorysettings.whatModelWhyGlm",
  },
  {
    name: "Claude Sonnet 5.5",
    model: "claude-sonnet-5-5",
    quality: 5,
    speed: 7,
    price: 3,
    why: "ui.longTermMemory.memorysettings.whatModelWhySonnet",
  },
  {
    name: "GPT-6 Astra",
    model: "gpt-6-astra",
    quality: 8,
    speed: 2,
    price: 1,
    why: "ui.longTermMemory.memorysettings.whatModelWhyAstra",
  },
];

const SELF_HOST: RankedModel[] = [
  {
    name: "Qwen3.8 27B",
    model: "Qwen3.8-27B",
    quality: 5,
    why: "ui.longTermMemory.memorysettings.whatModelWhyQwen38",
  },
  {
    name: "Qwen3.6 35B A3B",
    model: "qwen/qwen3.6-35b-a3b",
    quality: 4,
    why: "ui.longTermMemory.memorysettings.whatModelWhyQwen36",
  },
  {
    name: "Mistral Small 3.2 24B",
    model: "mistralai/mistral-small-3.2-24b-instruct",
    quality: 3,
    why: "ui.longTermMemory.memorysettings.whatModelWhyMistral",
  },
  {
    name: "gpt-oss-20b",
    model: "openai/gpt-oss-20b",
    quality: 2,
    why: "ui.longTermMemory.memorysettings.whatModelWhyOss20",
  },
];

type OtherModel = { name: string; model: string; why: string };

const OTHERS: OtherModel[] = [
  { name: "GLM-5.3 Flash", model: "glm-5.3-flash", why: "ui.longTermMemory.memorysettings.whatModelWhyGlmFlash" },
  {
    name: "Gemini 3.8 Flash",
    model: "gemini-3.8-flash",
    why: "ui.longTermMemory.memorysettings.whatModelWhyGeminiFlash",
  },
  { name: "Gemini 4 Argon", model: "gemini-4-argon", why: "ui.longTermMemory.memorysettings.whatModelWhyArgon" },
];

const SELF_HOST_OTHERS: OtherModel[] = [
  {
    name: "gpt-oss-120b",
    model: "openai/gpt-oss-120b",
    why: "ui.longTermMemory.memorysettings.whatModelWhyOss120",
  },
  {
    name: "Gemma 4",
    model: "google/gemma-4-26b-a4b-it",
    why: "ui.longTermMemory.memorysettings.whatModelWhyGemma4",
  },
  {
    name: "Llama 3.3 70B",
    model: "meta-llama/llama-3.3-70b-instruct",
    why: "ui.longTermMemory.memorysettings.whatModelWhyLlama",
  },
  {
    name: "GLM-4.5-Air",
    model: "z-ai/GLM-4.5-Air",
    why: "ui.longTermMemory.memorysettings.whatModelWhyGlm45Air",
  },
  { name: "GLM-4.7", model: "GLM-4.7", why: "ui.longTermMemory.memorysettings.whatModelWhyGlm47" },
];

const SCORES = [
  ["quality", "ui.longTermMemory.memorysettings.whatModelColumnQuality"],
  ["speed", "ui.longTermMemory.memorysettings.whatModelColumnSpeed"],
  ["price", "ui.longTermMemory.memorysettings.whatModelColumnPrice"],
] as const;

/** Five stars in half steps: 7 → ★★★½. */
export function scoreStars(score: number) {
  return "★".repeat(Math.floor(score / 2)) + (score % 2 ? "½" : "");
}

/**
 * `label` is the column name. From 640px up the table's header carries it and the label is `display: none`; below that
 * the header is hidden and each score names itself ("Quality ★★★★"), read before the spoken "N out of 10".
 */
function Score({ score, label }: { score: number; label: string }) {
  const { t: localizeUi } = useLtmTranslation();
  return (
    <td className="whitespace-nowrap px-2 py-1" data-ltm-what-model-score={score}>
      <span data-ltm-what-model-score-label>{label} </span>
      <span aria-hidden="true" className="text-[var(--marinara-editor-accent)]">
        {scoreStars(score)}
      </span>
      <span className="sr-only">{localizeUi("ui.longTermMemory.memorysettings.whatModelScore", { score })}</span>
    </td>
  );
}

/**
 * One tab's ranking as a table: rank, model (name over the id to pick), the stars, and why. The models tested but not
 * recommended follow as a labelled group in the same table, so both lists share one set of columns.
 */
function ModelTable({ selfHost }: { selfHost: boolean }) {
  const { t: localizeUi } = useLtmTranslation();
  const rows = selfHost ? SELF_HOST : RANKED;
  const others = selfHost ? SELF_HOST_OTHERS : OTHERS;
  const scores = selfHost ? SCORES.slice(0, 1) : SCORES;
  const columns = scores.length + 3;
  const head = "px-2 py-1 font-medium";
  return (
    <div className="overflow-x-auto">
      <table data-ltm-what-model-table className="w-full text-xs">
        <caption className="sr-only">
          {localizeUi(
            selfHost
              ? "ui.longTermMemory.memorysettings.whatModelSelfHostRanked"
              : "ui.longTermMemory.memorysettings.whatModelRanked",
          )}
        </caption>
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
            <th scope="col" className={`w-8 ${head}`}>
              <span className="sr-only">{localizeUi("ui.longTermMemory.memorysettings.whatModelColumnRank")}</span>
            </th>
            <th scope="col" className={head}>
              {localizeUi("ui.longTermMemory.memorysettings.whatModelColumnModel")}
            </th>
            {scores.map(([field, label]) => (
              <th key={field} scope="col" className={`whitespace-nowrap ${head}`}>
                {localizeUi(label)}
              </th>
            ))}
            <th scope="col" className={head}>
              {localizeUi("ui.longTermMemory.memorysettings.whatModelColumnWhy")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.model}
              data-ltm-what-model-row={row.model}
              className={`border-b border-[var(--border)] ${index === 0 ? "bg-[var(--secondary)]" : ""}`}
            >
              <td className="px-2 py-1 font-semibold tabular-nums text-[var(--marinara-editor-accent)]">{index + 1}</td>
              <th scope="row" className="px-2 py-1 text-left font-normal">
                <span className="block whitespace-nowrap text-sm font-semibold text-[var(--foreground)]">
                  {row.name}
                </span>
                <span className="block break-words text-[var(--muted-foreground)]">{row.model}</span>
              </th>
              {scores.map(([field, label]) => {
                const score = row[field];
                return score === undefined ? (
                  <td key={field} />
                ) : (
                  <Score key={field} score={score} label={localizeUi(label)} />
                );
              })}
              <td className="px-2 py-1 text-[var(--muted-foreground)]">{localizeUi(row.why)}</td>
            </tr>
          ))}
        </tbody>
        <tbody>
          <tr>
            <th colSpan={columns} scope="colgroup" className="px-2 pb-1 pt-3 text-left font-semibold">
              {localizeUi("ui.longTermMemory.memorysettings.whatModelOthers")}
            </th>
          </tr>
          {others.map((row) => (
            <tr key={row.model} data-ltm-what-model-other={row.model}>
              <td />
              <th scope="row" className="whitespace-nowrap px-2 py-1 text-left font-semibold text-[var(--foreground)]">
                {row.name}
              </th>
              <td colSpan={columns - 2} className="px-2 py-1 text-[var(--muted-foreground)]">
                {localizeUi(row.why)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  ["hosted", "ui.longTermMemory.memorysettings.whatModelTabHosted"],
  ["selfHost", "ui.longTermMemory.memorysettings.whatModelTabSelfHost"],
] as const;
type Tab = (typeof TABS)[number][0];

/**
 * One tab's table. Both panels stay mounted in one grid cell and the hidden one is `invisible`, so the dialog keeps
 * the taller panel's height and the tab rail does not jump when the tab changes.
 */
function ModelPanel({ tab, active, tablistId }: { tab: Tab; active: boolean; tablistId: string }) {
  const { t: localizeUi } = useLtmTranslation();
  const selfHost = tab === "selfHost";
  return (
    <div
      id={`${tablistId}-${tab}-panel`}
      role="tabpanel"
      aria-labelledby={`${tablistId}-${tab}`}
      data-ltm-what-model-panel={tab}
      className={`col-start-1 row-start-1 min-w-0 ${active ? "" : "invisible"}`}
    >
      {selfHost ? (
        <p className="pb-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.memorysettings.whatModelSelfHostHint")}
        </p>
      ) : null}
      <ModelTable selfHost={selfHost} />
    </div>
  );
}

export function WhatModelButton() {
  const { t: localizeUi } = useLtmTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("hosted");
  const titleId = useId();
  const descriptionId = useId();
  const tablistId = useId();
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextTabIndex(event.key, index, TABS.length);
    if (next === null) return;
    event.preventDefault();
    setTab(TABS[next]![0]);
    document.getElementById(`${tablistId}-${TABS[next]![0]}`)?.focus();
  };
  return (
    <>
      <Button chip data-ltm-what-model-button aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {localizeUi("ui.longTermMemory.memorysettings.whatModelButton")}
      </Button>
      {open ? (
        <ModalDialog
          titleId={titleId}
          descriptionId={descriptionId}
          initialFocus="[data-ltm-what-model-close]"
          onCancel={() => setOpen(false)}
          panelClassName="max-w-3xl max-h-full overflow-y-auto"
          data-ltm-what-model-dialog
        >
          <h3 id={titleId} className="text-sm font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.whatModelButton")}
          </h3>
          <p id={descriptionId} className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.memorysettings.whatModelIntro")}
          </p>
          <style>{`
            [data-ltm-what-model-tab]:not([data-active="true"]):not(:hover) {
              background: var(--marinara-editor-control-bg);
            }
            [data-ltm-what-model-tab]:focus-visible {
              outline: 2px solid var(--marinara-editor-focus-ring);
            }
            [data-ltm-what-model-score-label] {
              display: none;
            }
            [data-ltm-what-model-table] :is(th, td) {
              vertical-align: top;
              word-break: keep-all;
            }
            @media (min-width: 640px) {
              [data-ltm-what-model-table] {
                min-width: 40rem;
              }
            }
            /* Below 640px each model is a stacked entry instead of a six-column row: rank + name, the id, the labelled
               scores side by side, then why. The header is hidden because every score names itself. */
            @media (max-width: 639px) {
              [data-ltm-what-model-table],
              [data-ltm-what-model-table] tbody {
                display: block;
              }
              [data-ltm-what-model-table] thead {
                display: none;
              }
              [data-ltm-what-model-table] tbody > tr {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                column-gap: 0.375rem;
                row-gap: 0.125rem;
              }
              [data-ltm-what-model-row],
              [data-ltm-what-model-other] {
                padding: 0.5rem 0.375rem;
              }
              :is([data-ltm-what-model-row], [data-ltm-what-model-other]) > :is(th, td) {
                padding: 0;
                white-space: normal;
              }
              [data-ltm-what-model-row] > :first-child {
                flex: 0 0 1.5rem;
              }
              /* Nearly the full line, so the scores always wrap to the next one. */
              [data-ltm-what-model-row] > th {
                flex: 1 1 calc(100% - 2.5rem);
                min-width: 0;
              }
              [data-ltm-what-model-row] > th span {
                white-space: normal;
              }
              /* Smaller stars keep Quality, Speed and Low cost on one line at 390px. */
              [data-ltm-what-model-row] > [data-ltm-what-model-score] {
                white-space: nowrap;
              }
              [data-ltm-what-model-score] > [aria-hidden="true"] {
                font-size: 0.6875rem;
              }
              [data-ltm-what-model-score-label] {
                display: inline;
                color: var(--muted-foreground);
              }
              [data-ltm-what-model-row] > td:last-child {
                flex: 1 1 calc(100% - 2rem);
                margin-left: 2rem;
              }
              [data-ltm-what-model-other] > :first-child {
                display: none;
              }
              [data-ltm-what-model-other] > :is(th, td) {
                flex: 1 1 100%;
              }
              [data-ltm-what-model-table] th[scope="colgroup"] {
                flex: 1 1 100%;
              }
            }
          `}</style>
          <div
            role="tablist"
            aria-label={localizeUi("ui.longTermMemory.memorysettings.whatModelTabs")}
            className="mari-editor-tab-rail grid w-full grid-cols-2 gap-1 border-b border-[var(--marinara-editor-divider)] p-1"
          >
            {TABS.map(([key, label], index) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`${tablistId}-${key}`}
                aria-controls={`${tablistId}-${key}-panel`}
                aria-selected={tab === key}
                tabIndex={tab === key ? 0 : -1}
                data-ltm-what-model-tab={key}
                data-active={tab === key}
                className="mari-editor-tab min-h-11 min-w-0 rounded-md px-1 text-xs font-semibold"
                onClick={() => setTab(key)}
                onKeyDown={(event) => handleTabKey(event, index)}
              >
                <span className="block truncate">{localizeUi(label)}</span>
              </button>
            ))}
          </div>
          <div className="grid">
            {TABS.map(([key]) => (
              <ModelPanel key={key} tab={key} active={tab === key} tablistId={tablistId} />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-xs text-[var(--muted-foreground)]">
              {tab === "selfHost" ? null : localizeUi("ui.longTermMemory.memorysettings.whatModelSettingsTip")}
            </p>
            <Button data-ltm-what-model-close onClick={() => setOpen(false)}>
              {localizeUi("ui.longTermMemory.memoryvault.close")}
            </Button>
          </div>
        </ModalDialog>
      ) : null}
    </>
  );
}
