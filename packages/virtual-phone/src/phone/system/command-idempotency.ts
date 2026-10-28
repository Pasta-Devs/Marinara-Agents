export interface CommandClaim {
  storage: Record<string, Record<string, unknown>>;
  result: boolean;
}

const MAX_COMMAND_KEYS = 200;

/** Atomically claims a generated phone command before it can produce an external side effect. */
export function claimPhoneCommand(storage: Record<string, Record<string, unknown>>, key: string): CommandClaim {
  const system = storage.system ?? {};
  const held = Array.isArray(system.processedCommands)
    ? system.processedCommands.filter((value): value is string => typeof value === "string")
    : [];
  if (held.includes(key)) return { storage, result: false };
  return {
    storage: {
      ...storage,
      system: { ...system, processedCommands: [...held, key].slice(-MAX_COMMAND_KEYS) },
    },
    result: true,
  };
}
