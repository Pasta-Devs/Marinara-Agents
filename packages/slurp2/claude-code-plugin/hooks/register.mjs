// Claude Code puts messages of its own for a coding agent between Marinara's
// system prompt and the chat: the account email, an empty CLAUDE.md section,
// the server's environment (working directory, OS, shell), the model name, a
// token budget and the date. A chat needs none of them, and they can change how
// the model plays the character, so drop every one, including kinds a future
// Claude Code adds.
export function register(on) {
  on("prompt.attachment", async () => ({ text: null }));
}
