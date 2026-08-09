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
export function resetTurnGameRegistry() {
    activeEngines.clear();
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
//# sourceMappingURL=registry.js.map