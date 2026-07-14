export const TURN_GAME_BOT_REQUEST_EVENT = "marinara-turn-game-bot-request";

export function requestTurnGameBotGeneration(chatId: string) {
  window.dispatchEvent(
    new CustomEvent(TURN_GAME_BOT_REQUEST_EVENT, {
      detail: { chatId },
    }),
  );
}
