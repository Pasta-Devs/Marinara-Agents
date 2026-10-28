import { create } from "zustand";
import { toast } from "sonner";
import { slpPutTask, slpStoredTasks } from "./slp-task-list";

/**
 * Long actions never lock the player (task B). A long action starts here instead of behind a busy
 * sheet: the caller closes its sheet at once, the task runs on, Pulse lists it (running, done or
 * failed with why and Try again) and a toast says how it went with "See in Pulse" or "Open".
 *
 * Finished tasks survive a reload (the last 50 of the last day, in this browser's storage); the
 * server's own jobs and Stir plays come from the tasks route as before.
 */

/** What a tap on a task opens: a Creator's page (and one post on it), or that Creator's chat with you. */
export type SlpPulseTarget = { accountId: string; postId?: string | null } | { chatCreatorId: string };

export type SlpTask = {
  id: string;
  kind: string;
  /** The player's words for it ("Mira's next post"), already translated. */
  label: string;
  accountIds: string[];
  status: "running" | "done" | "failed";
  startedAt: number;
  finishedAt?: number;
  /** Why it failed, in plain words. */
  error?: string;
  /** What came out ("Posted", "3 changes made"), already translated. */
  result?: string;
  target?: SlpPulseTarget;
  /** A result only its screen can show (a finished plan): opens it again. */
  open?: { label: string; run: () => void };
  retry?: () => void;
  /**
   * The server keeps its own Pulse row for this work (a Stir play's `play:<id>`), which lasts past a
   * reload: the client's copy goes once it is finished, so Pulse shows it once (0.3.1).
   */
  serverId?: string;
};

type SlpTaskState = {
  tasks: SlpTask[];
  /** Whether Pulse is open. Here, not in the shell, so a toast's "See in Pulse" can open it from anywhere. */
  pulseOpen: boolean;
};

const TASKS_KEY = "slurp2:pulse-tasks";

function readStoredTasks(): SlpTask[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TASKS_KEY) ?? "[]") as unknown;
    const rows = Array.isArray(parsed)
      ? parsed.filter(
          (row): row is SlpTask =>
            !!row &&
            typeof row === "object" &&
            typeof (row as SlpTask).id === "string" &&
            typeof (row as SlpTask).label === "string" &&
            ((row as SlpTask).status === "done" || (row as SlpTask).status === "failed") &&
            typeof (row as SlpTask).finishedAt === "number",
        )
      : [];
    return slpStoredTasks(rows, Date.now()).map((row) => ({ ...row, accountIds: row.accountIds ?? [] }));
  } catch {
    return [];
  }
}

export const useSlpTasks = create<SlpTaskState>(() => ({ tasks: readStoredTasks(), pulseOpen: false }));

useSlpTasks.subscribe((state, previous) => {
  if (state.tasks === previous.tasks) return;
  try {
    window.localStorage.setItem(TASKS_KEY, JSON.stringify(slpStoredTasks(state.tasks, Date.now())));
  } catch {
    // Private browsing can refuse storage; Pulse still works for this tab.
  }
});

export const openSlpPulse = () => useSlpTasks.setState({ pulseOpen: true });
export const closeSlpPulse = () => useSlpTasks.setState({ pulseOpen: false });

function put(task: SlpTask) {
  useSlpTasks.setState((state) => ({ tasks: slpPutTask(state.tasks, task, Date.now()) }));
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

const seeInPulse = (t: Translate) => ({
  label: t("ui.slurp.pulse.seeInPulse", { defaultValue: "See in Pulse" }),
  onClick: openSlpPulse,
});

function taskErrorText(error: unknown, t: Translate): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return t("ui.slurp.pulse.failedUnknown", { defaultValue: "Slurp could not finish it. Try again." });
}

export type SlpTaskStart<T> = {
  /**
   * The caller's translate function. The package bundles its own i18next copy that is never
   * initialised, so only the one from `useTranslation` knows Slurp's words.
   */
  t: Translate;
  kind: string;
  label: string;
  accountIds?: string[];
  run: () => Promise<T>;
  /** The result line and where a tap goes once it worked. */
  done?: (value: T) => Pick<SlpTask, "result" | "target" | "open" | "serverId"> | void;
  /** The started toast, or false for none (the caller already shows the start). */
  startedToast?: string | false;
  /** The done toast; default "<label> is done". False: the caller shows its own (an Undo toast). */
  doneToast?: string | false;
};

/**
 * Start a long action as a Pulse task. Resolves with the value, or undefined when it failed (the
 * failure is in Pulse and a toast; nothing throws at the caller, whose sheet may be gone).
 */
export function startSlpTask<T>(input: SlpTaskStart<T>, retryOf?: string): Promise<T | undefined> {
  const id = retryOf ?? `task:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  const base: SlpTask = {
    id,
    kind: input.kind,
    label: input.label,
    accountIds: input.accountIds ?? [],
    status: "running",
    startedAt: Date.now(),
  };
  const retry = () => void startSlpTask({ ...input, startedToast: false }, id);
  put(base);
  if (input.startedToast !== false)
    toast(input.startedToast ?? input.t("ui.slurp.pulse.started", { defaultValue: "Started. You can keep going." }), {
      description: input.label,
      action: seeInPulse(input.t),
    });
  return input.run().then(
    (value) => {
      const outcome = input.done?.(value) ?? {};
      if (outcome.serverId) dismissSlpTask(id);
      else put({ ...base, ...outcome, status: "done", finishedAt: Date.now() });
      if (input.doneToast !== false) {
        const open = outcome.open;
        toast.success(
          input.doneToast ??
            input.t("ui.slurp.pulse.doneToast", { defaultValue: "{{label}}: done", label: input.label }),
          {
            description: outcome.result,
            action: open ? { label: open.label, onClick: open.run } : seeInPulse(input.t),
          },
        );
      }
      return value;
    },
    (error: unknown) => {
      put({ ...base, status: "failed", finishedAt: Date.now(), error: taskErrorText(error, input.t), retry });
      toast.error(
        input.t("ui.slurp.pulse.failedToast", { defaultValue: "{{label}}: it did not work", label: input.label }),
        {
          description: taskErrorText(error, input.t),
          action: seeInPulse(input.t),
        },
      );
      return undefined;
    },
  );
}

/** Forget a finished task (Pulse's ✕ on a failed one the player has seen). */
export function dismissSlpTask(id: string) {
  useSlpTasks.setState((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) }));
}
