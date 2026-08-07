export interface AppRouteStack {
  appId: string;
  routes: string[];
}

export class AppRouteStackManager {
  private readonly stacks = new Map<string, AppRouteStack>();

  open(appId: string, rootRoute: string) {
    const stack = this.stacks.get(appId) ?? { appId, routes: [rootRoute] };
    this.stacks.set(appId, stack);
    return stack.routes[stack.routes.length - 1]!;
  }

  push(appId: string, route: string) {
    const stack = this.stacks.get(appId);
    if (!stack) throw new Error(`App ${appId} is not open`);
    stack.routes.push(route);
    return route;
  }

  back(appId: string): string | "home" {
    const stack = this.stacks.get(appId);
    if (!stack) return "home";
    if (stack.routes.length > 1) {
      stack.routes.pop();
      return stack.routes[stack.routes.length - 1]!;
    }
    this.stacks.delete(appId);
    return "home";
  }

  snapshot(appId: string) {
    return [...(this.stacks.get(appId)?.routes ?? [])];
  }
}
