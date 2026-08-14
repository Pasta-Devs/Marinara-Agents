const descriptionKeys = {
  balanced: "ui.longTermMemory.chatsettings.recallStyleBalancedDescription",
  exact: "ui.longTermMemory.chatsettings.recallStyleExactDescription",
  broad: "ui.longTermMemory.chatsettings.recallStyleBroadDescription",
  story: "ui.longTermMemory.chatsettings.recallStyleStoryDescription",
  custom: "ui.longTermMemory.chatsettings.recallStyleCustomDescription",
} as const;

export function recallStyleDescriptionKey(style: string) {
  return descriptionKeys[style as keyof typeof descriptionKeys] ?? descriptionKeys.balanced;
}
