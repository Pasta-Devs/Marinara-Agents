/** The base Engine intentionally ships no games. Installed packages populate the runtime registry. */
export const BUNDLED_TURN_GAME_ENGINES = [];
const activeEngines = new Map();
export function registerTurnGameEngine(engine) {
    if (activeEngines.has(engine.gameType))
        throw new Error(`Turn-game engine ${engine.gameType} is already registered`);
    activeEngines.set(engine.gameType, engine);
    return () => {
        if (activeEngines.get(engine.gameType) === engine)
            activeEngines.delete(engine.gameType);
    };
}
export function resetTurnGameRegistry(includeBundled = false) {
    activeEngines.clear();
    if (includeBundled) {
        for (const engine of BUNDLED_TURN_GAME_ENGINES)
            activeEngines.set(engine.gameType, engine);
    }
}
export function getTurnGameEngine(gameType) {
    return activeEngines.get(gameType) ?? null;
}
export function listTurnGames() {
    return [...activeEngines.values()].map((engine) => ({
        gameType: engine.gameType,
        label: engine.label,
        minPlayers: engine.minPlayers,
        maxPlayers: engine.maxPlayers,
    }));
}
export function listTurnGameTypes() {
    return [...activeEngines.keys()];
}
//# sourceMappingURL=registry.js.map