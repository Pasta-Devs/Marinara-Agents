# Memory Nag

Memory Nag is a Roleplay-only post-processing tracker. It keeps a short editable vault for each chat, deterministically shortlists relevant active memories, and asks the configured agent whether the current turn actually calls for a reminder.

Restart Marinara Engine after installing the package, then add it from **Chat Settings → Agents → Tracker Agents**. Once active, use the standalone **Memory Nag** section to choose the vault scan connection, edit the memory-creation prompt, adjust batch and recall limits, create memories, or open the vault. Settings save automatically after a short pause. The scan connection affects vault batches only; ordinary tracker turns keep using the connection specified in the agent editor.

Memory Nag defaults to a 4096-token agent output limit. Vault creation also reserves up to 4096 output tokens per batch.

The vault separates active and resolved memories. Memories may belong to multiple current or past chat characters and can include a short verbatim dialogue line when exact wording matters. Users can add, edit, resolve, restore, search, filter, and delete entries. Deletion asks for confirmation.

Vault scans request plain JSON output without function calling or a response schema. The Engine's tolerant JSON reader accepts fenced output and repairs common truncation such as a missing final closing brace.

By default, recalled memories are placed inside `<context><memory_nags>…</memory_nags></context>`. Add the Memory Nag Agent section to a Roleplay prompt preset to place the same content manually.
