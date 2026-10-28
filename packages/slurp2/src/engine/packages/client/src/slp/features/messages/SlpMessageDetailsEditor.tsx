import type { z } from "zod";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  slpCreatorDetailsSchema,
  slpConversationDetailsSchema,
  slpMessageDetailsSchema,
  type SlpMessageDetailsPatch,
} from "../../../../../shared/src/slp/slp-message-details.js";
import { useSetSlurpMessageDetails } from "./slp-messages-hooks";
import type { SlurpFanRelationship } from "./slp-messages-contract";

type Detail = {
  value: string | number;
  min?: number;
  max?: number;
  options?: readonly string[];
  text?: boolean;
  multiple?: boolean;
  step?: number;
  patch: (value: string | number) => SlpMessageDetailsPatch;
};
type Editor = {
  fields: Record<string, Detail>;
  save: (patch: SlpMessageDetailsPatch) => Promise<unknown>;
  pending: boolean;
};
const DetailsContext = createContext<Editor | null>(null);

export function SlpMessageDetailsEditor({
  relationship,
  threadId,
  personaId,
  enabled,
  children,
}: {
  relationship: SlurpFanRelationship;
  threadId: string | null;
  personaId: string | null;
  enabled: boolean;
  children: ReactNode;
}) {
  const mutation = useSetSlurpMessageDetails(threadId, personaId);
  const { t } = useTranslation();
  const fields: Record<string, Detail> = {};
  for (const [group, schema, labels] of [
    [
      "creatorState",
      slpCreatorDetailsSchema,
      {
        emotion: "Emotion",
        intent: "Intent",
        energy: "Energy",
        arousal: "Arousal",
        exposure: "Exposure",
        emotionIntensity: "Emotion intensity",
      },
    ],
    [
      "threadState",
      slpConversationDetailsSchema,
      {
        posture: "Posture",
        adultLevel: "Adult level",
        familiarity: "Familiarity",
        sexualComfort: "Sexual comfort",
        emotionalTrust: "Emotional trust",
        respect: "Respect",
        resentment: "Resentment",
        threadDesire: "Conversation desire",
      },
    ],
  ] as const) {
    for (const [key, label] of Object.entries(labels)) {
      const shape = (schema.shape as Record<string, z.ZodOptional<z.ZodTypeAny>>)[key];
      const inner = shape.unwrap();
      fields[label] = {
        value: (relationship[group] as Record<string, string | number>)[key],
        min: 0,
        max: 100,
        options: "options" in inner ? (inner.options as readonly string[]) : undefined,
        patch: (value) => ({ [group]: { [key]: value } }),
      };
    }
  }
  fields["Creator updated at"] = {
    value: relationship.creatorState.updatedAt,
    text: true,
    patch: (value) => ({ creatorState: { updatedAt: String(value) } }),
  };
  fields["Conversation updated at"] = {
    value: relationship.threadState.updatedAt,
    text: true,
    patch: (value) => ({ threadState: { updatedAt: String(value) } }),
  };
  fields["Cool-off until"] = {
    value: relationship.coolUntil ?? "",
    text: true,
    patch: (value) => ({ coolUntil: String(value) || null }),
  };
  fields.Mood = { value: relationship.mood, min: -100, max: 100, patch: (value) => ({ mood: Number(value) }) };
  fields.Rapport = {
    value: relationship.score,
    min: 0,
    max: 100,
    step: 0.1,
    patch: (value) => ({ score: Number(value) }),
  };
  fields.Tier = {
    value: relationship.tier,
    options: slpMessageDetailsSchema.shape.tier.unwrap().options,
    patch: (value) => ({ tier: value as SlpMessageDetailsPatch["tier"] }),
  };
  fields.Strikes = { value: relationship.strikes, min: 0, max: 100, patch: (value) => ({ strikes: Number(value) }) };
  fields.Spent = {
    value: relationship.spentCoins,
    min: 0,
    max: Math.min(1000000000, Math.max(10000, relationship.spentCoins * 2)),
    patch: (value) => ({ spentCoins: Number(value) }),
  };
  fields.Availability = {
    value: relationship.availability.online ? "available" : "away",
    options: ["available", "away"],
    patch: (value) => ({
      availability: { online: value === "available", ...(value === "available" ? { minutesUntilOnline: 0 } : {}) },
    }),
  };
  fields["Back in"] = {
    value: relationship.availability.minutesUntilOnline ?? 0,
    min: 0,
    max: 10080,
    patch: (value) => ({ availability: { minutesUntilOnline: Number(value), online: Number(value) === 0 } }),
  };
  fields.Activity = {
    value: relationship.availability.activity ?? "",
    text: true,
    patch: (value) => ({ availability: { activity: String(value) || null } }),
  };
  fields["Day vibe"] = {
    value: relationship.dayVibe ?? "",
    text: true,
    patch: (value) => ({ dayVibe: String(value) || null }),
  };
  fields["Audience tone"] = {
    value: relationship.audienceTone,
    options: slpMessageDetailsSchema.shape.audienceTone.unwrap().options,
    patch: (value) => ({ audienceTone: value as SlpMessageDetailsPatch["audienceTone"] }),
  };
  fields.Pictures = {
    value: relationship.imageMode,
    options: slpMessageDetailsSchema.shape.imageMode.unwrap().options,
    patch: (value) => ({ imageMode: value as SlpMessageDetailsPatch["imageMode"] }),
  };
  fields["True right now"] = {
    value: relationship.creatorState.modifiers.map((modifier) => modifier.kind).join(","),
    multiple: true,
    options: slpCreatorDetailsSchema.shape.modifiers.unwrap().element.shape.kind.options,
    patch: (value) => ({
      creatorState: {
        modifiers: String(value)
          .split(",")
          .filter(Boolean)
          .slice(0, 4)
          .map((kind) => ({
            kind: kind as NonNullable<NonNullable<SlpMessageDetailsPatch["creatorState"]>["modifiers"]>[number]["kind"],
            until:
              relationship.creatorState.modifiers.find((entry) => entry.kind === kind)?.until ??
              new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            source: relationship.creatorState.modifiers.find((entry) => entry.kind === kind)?.source ?? "Details",
          })),
      },
    }),
  };
  for (const entry of relationship.contributions)
    fields[`contribution:${entry.key}`] = {
      value: entry.points,
      min: -100,
      max: 100,
      step: 0.1,
      patch: (value) => ({ contributionPoints: { [entry.key]: Number(value) } }),
    };
  return (
    <DetailsContext.Provider
      value={enabled ? { fields, save: (patch) => mutation.mutateAsync(patch), pending: mutation.isPending } : null}
    >
      <div className="mx-2 mt-1 flex min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] text-xs shadow-[var(--slurp-highlight)]">
        {children}
        {mutation.isError && (
          <p role="alert" className="px-3 pb-3 text-xs text-[var(--destructive)]">
            {t("ui.slurp.messages.detailsSaveError")}
          </p>
        )}
      </div>
    </DetailsContext.Provider>
  );
}

export function useSlpDetailEditing(fieldKey: string) {
  return Boolean(useContext(DetailsContext)?.fields[fieldKey]);
}

export function SlpEditableDetail({
  label,
  fieldKey = label,
  children,
}: {
  label: string;
  fieldKey?: string;
  children: ReactNode;
}) {
  const editor = useContext(DetailsContext);
  const field = editor?.fields[fieldKey];
  if (!editor || !field) return <>{children}</>;
  return <DetailControl key={`${label}:${field.value}`} label={label} field={field} editor={editor} />;
}

function DetailControl({ label, field, editor }: { label: string; field: Detail; editor: Editor }) {
  const [value, setValue] = useState(field.value);
  const submitted = useRef(field.value);
  const save = () => {
    if (value !== submitted.current) {
      submitted.current = value;
      void editor.save(field.patch(value)).catch(() => {
        submitted.current = field.value;
      });
    }
  };
  const style = {
    accentColor: "var(--noodle-accent)",
    maxWidth: "100%",
    color: "var(--foreground)",
    backgroundColor: "var(--slurp-surface-raised)",
  };
  if (field.text)
    return (
      <input
        type="text"
        name={label}
        autoComplete="off"
        style={{ fontSize: 16 }}
        aria-label={label}
        value={value}
        maxLength={label === "Day vibe" ? 2000 : 500}
        disabled={editor.pending}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="min-h-11 w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--slurp-surface-raised)] text-xs"
      />
    );
  if (field.options)
    return (
      <select
        aria-label={label}
        name={label}
        disabled={editor.pending}
        multiple={field.multiple}
        value={field.multiple ? String(value).split(",") : value}
        onChange={(event) =>
          void editor
            .save(
              field.patch(
                field.multiple
                  ? Array.from(event.target.selectedOptions)
                      .map((option) => option.value)
                      .join(",")
                  : event.target.value,
              ),
            )
            .catch(() => {})
        }
        className="min-h-11 w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--slurp-surface-raised)] text-xs"
        style={style}
      >
        {field.options.map((option) => (
          <option
            key={option}
            value={option}
            disabled={
              field.multiple &&
              String(value).split(",").filter(Boolean).length >= 4 &&
              !String(value).split(",").includes(option)
            }
          >
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    );
  return (
    <span className="flex w-full items-center gap-2">
      <input
        type="range"
        aria-label={label}
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        value={value}
        disabled={editor.pending}
        onChange={(event) => setValue(Number(event.target.value))}
        onPointerUp={save}
        onKeyUp={save}
        onBlur={save}
        className="min-h-11 min-w-0 flex-1"
        style={style}
      />
      <output className="text-xs font-bold tabular-nums">{value}</output>
    </span>
  );
}
