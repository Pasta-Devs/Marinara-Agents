# Mail — app brief

In-world email: newsletters, spam, official notices, and personal mail from the story's world. Ambient roleplay flavor, read-only like Noodler but personal to the phone's owner.

- **Routes:** `/` inbox, `/message` read view.
- **Data:** record `mail-cache`, ownership `phone-local`. The generated inbox is cached per phone under `inbox` as `[{ text, read }]`, so reopening never needs a model. `modelUse: "heavy"`, removable, **not preinstalled** — installed from the App Store like Noodler.
- **Generation:** server route asks for 4–6 emails as `{"emails":["Sender Name | Subject | short body", ...]}`, seeded with recent story messages, parsed with `parseBoundedContent`. No model or a failed call → the cached inbox or an empty-inbox state.
- **Read state:** opening an email marks it read locally (bold → regular, unread dot clears). Refresh replaces the batch, so read state resets with new mail — new batch means new mail.
- **Actions:** top-bar `refresh` regenerates the inbox.
- **Boundaries:** display-only; never writes to the story or other phones.
