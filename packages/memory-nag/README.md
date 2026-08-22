# Memory Nag

Memory Nag is a Roleplay-only post-processing tracker. It keeps a short editable vault for each chat, deterministically shortlists relevant active memories, and asks the configured agent whether the current turn actually calls for a reminder.

Use **Chat Settings → Agents → Tracker Agents → Memory Nag** to choose the vault scan connection, adjust batch and recall limits, scan the chat, or open the vault. The scan connection affects vault batches only; ordinary tracker turns keep using the agent connection.

The vault separates active and resolved memories. Memories may belong to multiple current or past chat characters and can include a short verbatim dialogue line when exact wording matters. Users can add, edit, resolve, restore, search, filter, and delete entries. Deletion asks for confirmation.

By default, recalled memories are placed inside `<context><memory_nags>…</memory_nags></context>`. Add the Memory Nag Agent section to a Roleplay prompt preset to place the same content manually.
