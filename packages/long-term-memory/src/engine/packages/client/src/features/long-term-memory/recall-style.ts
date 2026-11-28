import { LTM_RECALL_STYLE_WEIGHTS } from "../../../../shared/src/features/agents/long-term-memory/constants.js";

const descriptionKeys = {
  balanced: "ui.longTermMemory.chatsettings.recallStyleBalancedDescription",
  exact: "ui.longTermMemory.chatsettings.recallStyleExactDescription",
  broad: "ui.longTermMemory.chatsettings.recallStyleBroadDescription",
  story: "ui.longTermMemory.chatsettings.recallStyleStoryDescription",
  custom: "ui.longTermMemory.chatsettings.recallStyleCustomDescription",
} as const;

export const recallStyles = Object.keys(descriptionKeys) as Array<keyof typeof descriptionKeys>;

export function recallStyleDescriptionKey(style: string) {
  return descriptionKeys[style as keyof typeof descriptionKeys] ?? descriptionKeys.balanced;
}

const labelKeys = {
  balanced: "ui.longTermMemory.chatsettings.balanced",
  exact: "ui.longTermMemory.chatsettings.exact",
  broad: "ui.longTermMemory.chatsettings.broad",
  story: "ui.longTermMemory.chatsettings.story",
  custom: "ui.longTermMemory.chatsettings.custom",
} as const;

export function recallStyleLabelKey(style: string) {
  return labelKeys[style as keyof typeof labelKeys] ?? labelKeys.balanced;
}

type RecallPreset = keyof typeof LTM_RECALL_STYLE_WEIGHTS;
type RecallWeights = {
  longTermMemorySemanticWeight: number;
  longTermMemoryLexicalWeight: number;
  longTermMemoryGraphWeight: number;
  longTermMemoryKeywordWeight: number;
};

// The preset a Custom form was edited from is not stored, so it is read back from the weights: the preset
// they are closest to. Save and reload therefore agree, and tweaking a Story weight still returns to Story.
// ponytail: a large edit can land nearer another preset; the upgrade path is to store the preset a form was edited from.
// Ties keep the earlier preset, so untouched Balanced weights stay Balanced.
export function nearestRecallPreset(form: RecallWeights): RecallPreset {
  const distance = (preset: RecallPreset) => {
    const weights = LTM_RECALL_STYLE_WEIGHTS[preset];
    return (
      Math.abs(form.longTermMemorySemanticWeight - weights.semanticWeight) +
      Math.abs(form.longTermMemoryLexicalWeight - weights.lexicalWeight) +
      // Linked memories switched off is one edit to any preset, so it does not count against it.
      (form.longTermMemoryGraphWeight === 0 ? 0 : Math.abs(form.longTermMemoryGraphWeight - weights.graphWeight)) +
      Math.abs(form.longTermMemoryKeywordWeight - weights.keywordWeight)
    );
  };
  return (Object.keys(LTM_RECALL_STYLE_WEIGHTS) as RecallPreset[]).reduce((best, preset) =>
    distance(preset) < distance(best) ? preset : best,
  );
}
