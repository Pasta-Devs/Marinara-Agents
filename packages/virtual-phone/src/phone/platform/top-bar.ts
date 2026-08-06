export type TopBarActionKind = "button" | "menu";

export interface TopBarAction {
  id: string;
  icon: string;
  label: string;
  kind: TopBarActionKind;
  disabled?: boolean;
  reason?: string;
}

export function normalizeTopBarActions(actions: TopBarAction[]) {
  const ids = new Set<string>();
  const buttons: TopBarAction[] = [];
  let menu: TopBarAction | null = null;
  for (const action of actions) {
    if (!action.id.trim() || !action.icon.trim() || !action.label.trim() || ids.has(action.id)) continue;
    ids.add(action.id);
    const normalized = {
      ...action,
      disabled: action.disabled === true,
      ...(action.disabled && action.reason?.trim() ? { reason: action.reason.trim() } : {}),
    };
    if (action.kind === "menu") menu ??= normalized;
    else if (buttons.length < 2) buttons.push(normalized);
  }
  return [...buttons, ...(menu ? [menu] : [])];
}
