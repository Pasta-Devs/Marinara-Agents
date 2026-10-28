type Teardown = () => void | Promise<void>;

export function createSlurpActivationLifecycle() {
  let active = false;

  return {
    async activate(start: (addTeardown: (teardown: Teardown) => void) => void | Promise<void>) {
      if (active) throw new Error("Slurp is already active");
      active = true;
      const teardowns: Teardown[] = [];
      let tornDown = false;
      const teardown = async () => {
        if (tornDown) return;
        tornDown = true;
        let firstError: unknown = null;
        let failed = false;
        for (const run of teardowns.reverse()) {
          try {
            await run();
          } catch (error) {
            if (!failed) firstError = error;
            failed = true;
          }
        }
        active = false;
        if (failed) throw firstError;
      };
      try {
        await start((run) => teardowns.push(run));
        return teardown;
      } catch (error) {
        try {
          await teardown();
        } catch {
          // Preserve the activation error after best-effort rollback.
        }
        throw error;
      }
    },
    selfCheck() {
      if (!active) throw new Error("Slurp routes and schedulers did not activate");
    },
  };
}
