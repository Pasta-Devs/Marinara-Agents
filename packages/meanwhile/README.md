# Meanwhile

Meanwhile is a package for Marinara Engine. It lives in **Home -> Meanwhile**.

A Circle is a group of characters who share a setting. Each Circle has its own clock, so their lives can go on while you are away.

## What this version does

- Make Circles. Pick the cast, write the setting, link chats and choose a pace.
- Run the clock at x1, x24 or a custom speed. Pause it, or set the date and time.
- Choose a model for each Circle. A Circle cannot run without one.
- A background timer lets a Circle catch up when you open the tab or a linked chat has new messages. A switch adds a run every 6 hours.

Each finished day gets one model call that writes the events, a diary line per character and hooks. A character brings a hook up in a linked chat once, and "Pick up this thread" makes the next reply bring it up now. A daily call limit keeps the cost down.

Fast forward moves a Circle clock by 1 to 7 days or up to 168 hours and writes each day. It shows the model calls first and asks before it passes the daily limit. Big events wait in "Waiting for you" until you accept or veto them. Plans that characters state in a linked chat become promises. Meanwhile checks them again when a chat message is edited or deleted.

A Circle can also write the status of its characters (switch "Character status", off by default). Only at real time (x1), it sets what each person does now as their Engine status in the first linked Conversation chat that has them. A notable event that is accepted and visible to the whole Circle gives the text. Otherwise the schedule block does. Only one Circle writes a character's status: the one that turned the switch on last. The Engine keeps a status that you set by hand. Proposed, vetoed and stale events are never written. This needs the chat write permission, because the Engine only lets a package change a status with it. Meanwhile uses it for nothing else. A status can stay up to 2 hours after you turn this off.

## Install

Meanwhile is offered to Engine `staging` testers. Install it, restart Marinara Engine when prompted, then open Home -> Meanwhile.

The Home screen has a Meanwhile card. It lists up to 3 hooks that no chat has used yet, or says how far each Circle is caught up. Tap it to open the tab.

A nudge ("this week Lily gets a job offer") becomes one planned event for a Circle day inside its window.

The same model call that writes a day can also write up to 3 short texts between characters who are in that day's events. Each text is checked and kept on the event. The "Phone" button on a Circle card shows them as threads, one per pair of characters. A text follows its event: it is not shown if the event is proposed, vetoed, stale, spicy or only for one chat.

Once a week, after a Monday to Monday week has passed in a Circle's time zone, one more model call can write a short paper for it, in the voice of the Circle's setting (a town paper, a notice board, a newsletter). It uses only accepted, Circle-wide, non-spicy notable and major events, and only the newest finished week gets one. A week with fewer than 2 such events gets no paper and no call. If the daily call limit is used up, the paper waits for the next run. The Circle card has a "Paper" button, and a paper is hidden if one of its events is later vetoed or goes stale.
