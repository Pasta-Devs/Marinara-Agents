// Canonical English UI copy for expression portraits.
export const forgeStoryExpressionEnglish = {
  "expressions.settings.toggle": "Expression portraits",
  "expressions.settings.hint":
    "Story portraits follow each line's emotion: anger, fear, sadness or joy. Each look of a character who speaks gets four extra images, painted in the background with your image connection; the normal portrait shows until they are ready. If a set fails, turn this off and on again to retry it.",
  "expressions.busy": "Painting expressions",
};

// Sits with the other image toggles in World → Sources → Images, after Battle backgrounds; it needs an
// image connection. Like them it is also on the world-creation wizard's look step.
export function forgeStoryExpressionFields(fields) {
  const at = fields.findIndex((field) => field.id === "images.battleBackgrounds") + 1;
  return [
    ...fields.slice(0, at),
    {
      id: "images.expressions",
      step: "look",
      settings: "sources",
      group: "images",
      type: "toggle",
      label: forgeStoryExpressionEnglish["expressions.settings.toggle"],
      hint: forgeStoryExpressionEnglish["expressions.settings.hint"],
      default: false,
      showIf: (values) => !!values["images.connectionId"],
    },
    ...fields.slice(at),
  ];
}
