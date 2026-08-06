export interface BottomNavigationTab {
  id: string;
  route: string;
  label: string;
  icon: string;
}

interface TabState {
  routes: string[];
  scrollTop: number;
}

export class BottomNavigationState {
  private activeTabId: string;
  private readonly states = new Map<string, TabState>();

  constructor(readonly tabs: BottomNavigationTab[]) {
    if (tabs.length < 2 || tabs.length > 5) throw new Error("Bottom navigation requires 2-5 tabs");
    if (new Set(tabs.map((tab) => tab.id)).size !== tabs.length) throw new Error("Bottom navigation tab ids must be unique");
    for (const tab of tabs) {
      if (!tab.id.trim() || !tab.route.startsWith("/") || !tab.label.trim() || !tab.icon.trim()) {
        throw new Error("Bottom navigation tabs require id, route, label, and icon");
      }
      this.states.set(tab.id, { routes: [tab.route], scrollTop: 0 });
    }
    this.activeTabId = tabs[0]!.id;
  }

  select(tabId: string) {
    const state = this.require(tabId);
    if (this.activeTabId === tabId) state.routes = [this.tabs.find((tab) => tab.id === tabId)!.route];
    this.activeTabId = tabId;
    return state.routes[state.routes.length - 1]!;
  }

  push(route: string) {
    this.require(this.activeTabId).routes.push(route);
  }

  setScroll(scrollTop: number) {
    this.require(this.activeTabId).scrollTop = Math.max(0, scrollTop);
  }

  snapshot() {
    const state = this.require(this.activeTabId);
    return { activeTabId: this.activeTabId, route: state.routes[state.routes.length - 1]!, scrollTop: state.scrollTop };
  }

  private require(tabId: string) {
    const state = this.states.get(tabId);
    if (!state) throw new Error(`Unknown bottom navigation tab ${tabId}`);
    return state;
  }
}
