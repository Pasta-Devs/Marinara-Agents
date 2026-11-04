# Big Cheese: UI and UX plan

Companion to [README.md](README.md) (the concept), [design.md](design.md) (systems),
[cheese-board.md](cheese-board.md) (the cheat menu) and [cast.md](cast.md) (Engine characters).
This file says how the game looks and moves on a phone first, then on a tablet and a desktop.
Where a system rule is needed, this file links to design.md and does not repeat it.

The patterns in §6 come from three Marinara-Agents packages: Otome Forge, Modern Life Sim and
Gacha Forge. We use them as ideas only. Big Cheese does not copy their names, CSS, art or layouts
one to one, and it has its own class prefix (`bc-`), its own components and its own words.

## 1. Principles

1. **Phone first.** The main target is a phone in portrait, 360-430 px wide. Tablet and desktop
   get more columns, never smaller text.
2. **Engine theme tokens only.** Surfaces, text and borders use `var(--background)`,
   `--foreground`, `--card`, `--primary`, `--muted`, `--muted-foreground`, `--accent`,
   `--destructive`, `--border` and `--ring`. Big Cheese has no private palette. Person colours
   are 8 hues mixed into `var(--card)` with `color-mix(in oklch, ...)`, so they follow the theme
   and dark or light mode. Text on them stays `var(--foreground)`.
3. **Container queries, not window width.** The package root is a container
   (`container: bc-frame / size`). The Home tab can be a side panel on a wide screen, so the
   window width says nothing about the space we have.
4. **Safe areas.** The top bar pads with `env(safe-area-inset-top)`, the dock and every bottom
   slot with `env(safe-area-inset-bottom)`. Heights use container units (`cqh`) or `dvh`, never
   `100vh`.
5. **Readable text.** Body text is 16 px. Nothing is smaller than 14 px, including labels, chips
   and the dock. Line height 1.45 for body, 1.2 for headings.
6. **Big targets.** Every control is at least 44 x 44 px. Answer rows are at least 56 px high.
7. **No hover-only controls.** Every hover hint also shows on touch, on focus and with a
   keyboard. Long-press is never the only way: every long-press has a menu entry too.
8. **Calm motion.** All motion follows `prefers-reduced-motion` and the Engine's "Reduce Ambient
   Animations & Effects" setting (`html[data-marinara-reduced-effects="true"]`). §6 gives the
   reduced version of each pattern.
9. **Focus follows the screen.** When a new screen or sheet opens, focus moves to its heading
   (`tabindex="-1"`). When it closes, focus goes back to the control that opened it.
10. **Contrast.** Text and icons that carry meaning reach 4.5:1 against their surface in both
    default themes (`default`, `sillytavern`) and both modes.
11. **Words in locale files.** Every string is a key in `locale/en.json` (`bigCheese.*`).
    Package classes are our own scoped stylesheet; Tailwind classes only from the Engine safelist.

## 2. Frame and sizes

| Frame width (container) | Layout                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| under 480 px (phone)    | One column. Top bar, content, dock at the bottom. Sheets come up from the bottom.                |
| 480-899 px (tablet)     | One column, content up to 640 px wide and centred. Sheets are centred dialogs up to 560 px.      |
| 900 px and wider        | Dock becomes a left rail. Office shows the inbox beside the threads. The Board is a right panel. |

| Frame height | Change                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------- |
| under 520 px | Landscape phone. Dock drops its labels (icons keep `aria-label`). Scene faces shrink to 96 px. |
| any          | The dialogue slot grows with its text up to 45% of the frame height, then scrolls inside.      |

There is no fixed stage size, no 16:9 box, no minimum width above 320 px and no "turn your
phone" overlay. A scene fills the frame. On a wide frame it sits in a centred column up to 720 px
wide, with the room picture across the full width behind it.

## 3. Navigation

### 3.1 Screen classes

| Class        | Chrome                     | Screens                                                                             |
| ------------ | -------------------------- | ----------------------------------------------------------------------------------- |
| Tab screen   | top bar and dock           | Office, Inbox, People, Place                                                        |
| Focus screen | top bar with Back, no dock | a card, a person's file, a room, a thread, the week, the chronicle, settings        |
| Stage        | none (full frame)          | title screen, new place, Preview, scene, big scene, meeting, hearing, Friday report |
| Sheet        | over the current screen    | Do something, Cheese Board, cast picker, casting sheet, More menu, confirms         |

A stage hides the top bar and the dock. Each stage has its own exit in the top corner ("Leave
for now" in scenes, "Back" in the title flow) and its own heading for focus.

### 3.2 The dock

Four tabs: **Office · Inbox · People · Place.**

- Office is home base: day, hours, meters, the week strip, open threads and the Do something
  field.
- Inbox shows a count badge with today's unanswered cards.
- People is the staff list and groups.
- Place is the rooms, who is where, and the grapevine (M2).

The week, the chronicle, kit, settings and "Save to your library" live in the **More** menu (top bar).
The Cheese Board has its own button in the top bar (cheese-board.md §2). In a Sandbox run the
Board is pinned as a fifth dock tab, as cheese-board.md §7 says. In an Ironman run the cheese
button is hidden.

### 3.3 Top bar

The Office wireframe (§5.4) shows it. Day and week (tap: the week view), the hours as 5 pips (filled = left), the Board button `[B]`
and the More menu `[...]`. In viewer mode the pips become pause and speed controls. The bar is
44 px high plus the top safe area.

### 3.4 Screen map

```
Title --> New place --> Preview --> arrival (big scene) --> Office
  |                                                          |
  +--> Continue a run ---------------------------------------+

Office  --> thread --> person / card
        --> week view --> big scene invitation
        --> Do something (sheet)
Inbox   --> card --> Talk it through (scene) / Say something else
People  --> person file --> Talk to (scene) / Do something
Place   --> room --> Visit (scene) / Do something
Any     --> Cheese Board (sheet; long-press fills the target)
Friday  --> report --> next Monday (Office)
```

### 3.5 Back map

| From                      | Back goes to                                    | Notes                                               |
| ------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Focus screen              | the screen that opened it                       | animates back into the opener (§6)                  |
| Card after an answer      | Inbox, with the stamp on the answered card      | automatic after the stamp                           |
| Scene, meeting, big scene | "Leave for now" goes to Office; the scene waits | system back asks "Leave the scene for now?"         |
| Friday report             | cannot go back; "Start week 4" goes forward     | the report stays in the chronicle                   |
| Sheet                     | closes the sheet                                | Esc, the system back, swipe down on the grab handle |
| Tab screen                | Office; from Office, the title screen           | system back on Office asks before leaving the run   |
| Title flow (new place)    | the step before; Preview back keeps the draft   |                                                     |

## 4. States every screen has

| State   | Rule                                                                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading | Chrome first, then skeleton rows in the content area (no spinner over the whole frame). After 8 s a plain line: "Still writing. This depends on your AI connection."              |
| Empty   | One in-world line and one button that does something useful. No empty boxes.                                                                                                      |
| Error   | What went wrong in plain words, what was kept, and a way back: "Try again", and a second exit ("Use plain text", "Back to the office").                                           |
| Busy    | A model call or a save that the next step needs. The content area gets `aria-busy="true"`, input is blocked by a veil, and a short line says what is being done. Back stays live. |
| Lite    | Template text, no wait. A small "Plain text" tag in the corner of the text box, so the player knows why it reads simpler. Numbers do not change.                                  |

A screen that fails to load shows its own error panel. The dock and the top bar stay, so the
player can always go somewhere else.

## 5. Screens

The wireframes are 38 characters wide, a 390 px phone. `[ ]` is a button, `( )` a chip, `###..`
the hour pips, `(YK)` a face fallback with initials.

### 5.1 Title screen (M1)

```
+------------------------------------+
| Big Cheese                   [...] |
|                                    |
| +--------------------------------+ |
| | (pic) Hollowmere University    | |
| |       Provost Wren Calloway    | |
| |       Year 1 . Week 3 . Tue    | |
| |       Playing          (18+)   | |
| +--------------------------------+ |
| +--------------------------------+ |
| | (pic) Hafenkai Logistics       | |
| |       Site manager J. Brandt   | |
| |       Fired in week 14         | |
| +--------------------------------+ |
|                                    |
| [ Start a new place              ] |
+------------------------------------+
```

- Runs are title cards, newest first. Tap continues. A long-press or the card's `[...]` opens
  Rename, Copy as a new run, Save to your library, Delete.
- An ended run shows its ending ("Fired in week 14", "Won the year"). Tap opens its chronicle.
- Adult runs show "18+". "Hide 18+ runs" in settings removes them; blur is on by default.
- Honest runs that used the Board show the small cheese mark (cheese-board.md §7).
- **Empty:** "No places yet. Pick a kit to start your first job." with `[ Start a new place ]`.
- **Loading:** 2 skeleton cards. **Error:** "Your saved places did not load." `[ Try again ]`.

### 5.2 New place: kit or wish (kit M1, wish M3)

```
+------------------------------------+
| < Back       New place             |
|                                    |
| Start from a kit                   |
| +--------------------------------+ |
| | Hafenkai Logistics             | |
| | A Hamburg warehouse with too   | |
| | many orders. You are the site  | |
| | manager.                       | |
| +--------------------------------+ |
| | Hollowmere University     ...  | |
| +--------------------------------+ |
|                                    |
| Or describe a place                |
| [ A lighthouse school on a cliff ] |
| Size     (Small) [Medium] (Large)  |
| Pace     [Classic] (Calm) (Chaos)  |
| Boss     [ Pick a persona      > ] |
| Staff    [ Add up to 3 people  > ] |
|                                    |
| [ Show me the place              ] |
+------------------------------------+
```

- Kit cards show name, one-line premise and the boss title. Tap selects; the big button reads
  "Show me Hafenkai".
- Dials (Tone, Realism, Era, Pace) and modules sit under "More choices", closed by default.
- Boss and Staff open the cast picker (§5.14).
- **Busy** (wish): "Drawing up the place..." with the wish text shown. **Error:** "The place
  did not come out right. Your wish is kept." `[ Try again ]` `[ Start from a kit ]`.

### 5.3 Preview (M1 for kits, reroll M3)

```
+------------------------------------+
| < Back   Hollowmere University     |
|                                    |
| An old harbour-town university     |
| with a famous rowing club and a    |
| leaky library.                     |
| You are the Provost. Strong leader.|
|                                    |
| Endowment 50      Grades 55        |
| Campus mood 60    Reputation 50    |
|                                    |
| People                             |
| (IH) Dr. Imogen Hale    deputy     |
| (YK) Yusuf Karim        head porter|
| (RS) Rhea Sand   From your library |
| [ See all 12 people ]              |
| Rooms   The Stacks . Boathouse +7  |
| Systems (The Regatta) (New wing)   |
|                                    |
| [ Reroll ]       [ Take the job ]  |
+------------------------------------+
```

- Every part is tappable: a person opens a short file, a system chip opens rename, reroll or
  remove (M2), and "Edit the kit" is in the `[...]` menu (M3).
- "Take the job" plays the arrival as a big scene (§5.7), then opens the Office.
- **Busy** on reroll: the rerolled part shows skeleton rows, the rest stays.

### 5.4 Office and week view (M1; week marks for big scenes M2)

```
+------------------------------------+
| Tue . Week 3    ###..   [B]  [...] |
|------------------------------------|
| Endowment 51       Grades 53       |
| Campus mood 54     Reputation 53   |
|                                    |
|  M  [T]  W   T   F*                |
|  * Fri evening: The Boat Race      |
|                                    |
| Yusuf is oiling the lodge door.    |
|                                    |
| Open threads                       |
| +--------------------------------+ |
| | The Stacks roof                | |
| | Yusuf . patched                | |
| +--------------------------------+ |
| | A boat for the eight           | |
| | Cormac . promise . Boat Race   | |
| +--------------------------------+ |
| | Letters from the last boss     | |
| | Imogen . 3 of 5 read           | |
| +--------------------------------+ |
| [ Do something...                ] |
|------------------------------------|
|  Office   Inbox 2   People   Place |
+------------------------------------+
```

- **Hours** show as 5 pips in the top bar, with the label "3 of 5 hours left" for screen
  readers. A short day shows 3 pips. Booked hours for a big scene show as outlined pips.
- **Meters** are a 2 x 2 grid with the kit's labels. A meter below 20 gets a warning border and
  the word "low". Long-press a meter opens the Board on it.
- **Week strip:** 5 (or 7) day buttons. A star marks a day with a big scene; a dot marks a
  meeting. The line under it names the next big scene. Tap opens the week view.
- **Ambient line** changes each slot (README "Something always moves").
- **Story cards** are the open threads, most urgent first (design.md §3.5). Tap opens the thread
  (beats so far, people, stakes line).
- **End of day:** when the hours are 0, the Do something field becomes `[ End the day ]`. On
  Friday it reads `[ End the week ]`.
- **Resume banner:** a big scene left open shows "Resume: The Boat Race, part 3 of 4" above the
  threads.
- **Empty** threads: "Nothing open right now." This is rare, because M1 always has the guided
  thread.

**Week view** (focus screen):

```
+------------------------------------+
| < Office    Week 3 of 8            |
|------------------------------------|
| Mon  Union talks, midday           |
| Tue  today                         |
| Wed  -                             |
| Thu  Inspection walk               |
| Fri  The Boat Race                 |
|      Big scene . evening . 2 hours |
|      Friday report                 |
|------------------------------------|
| Big scenes this week: 1 of 2       |
+------------------------------------+
```

The budget line ("Big scenes this week") and the stars come in M2 with the weekly budget. A row
with an invitation (a date, a party) has `[ Send apologies ]`. A secret climax reads
"Something at the Boathouse, Friday evening".

### 5.5 Inbox and the card (M1)

The Inbox lists today's cards: face, asker, one line, need chip, "Waited 2 days". Answered cards
stay in the list with their stamp until the next morning.

```
+------------------------------------+
| < Inbox   1 of 3              [B]  |
|------------------------------------|
|  (face)  Yusuf Karim               |
|          Head porter               |
|  (Reputation at risk) Waited 1 day |
|                                    |
|  "Provost, the roof of The Stacks  |
|   is leaking onto the rare books   |
|   again."                          |
|                                    |
| +--------------------------------+ |
| | [$] Get a roofer in this week. | |
| |     Reputation . Endowment     | |
| +--------------------------------+ |
| | [T] Buckets and a tarp for now.| |
| |     Reputation . Grades        | |
| +--------------------------------+ |
| | [X] The roof has lasted a      | |
| |     century.                   | |
| |     Reputation                 | |
| +--------------------------------+ |
| [ Talk it through . 1 hour       ] |
| [ Say something else             ] |
+------------------------------------+
```

- The face is the card avatar, then a labelled chip (role colour and name), then initials.
- The need chip names the meter type at risk. Answer rows show the meters they touch, never
  numbers (README "Cards"). Each row has a stance icon (money for `invest`, a tool for
  `cheap_fix`, a hand-off for `delegate`, a clock for `delay`, a raised hand for `refuse`,
  people for `ask_others`). The icon is 24 px inside a 56 px row.
- Rows are stacked full width, in tier order strong, middle, weak. Keyboard 1, 2, 3.
- Swipe left or right moves to the next card; arrows do the same with a keyboard.
- **After an answer:** the card slides back into its list row and a stamp lands on it
  ("Answered"), with the note "Yusuf will remember that." under the stamp. An hour pip empties.
- **Say something else** opens a text box in the bottom slot with `[ Say it ]`. Busy: "Yusuf
  is listening..." Not possible: Yusuf's answer appears as his line, "No hour spent." under it,
  and the box keeps the text.
- **No hours left:** rows are disabled with the line "No hours left today. This waits until
  tomorrow." `[ End the day ]`.
- **Empty inbox:** "Nothing on your desk this morning." `[ Walk the floor ]` (opens Place).
- **Error** writing a card: the card shows template text with the "Plain text" tag; it is never
  blocked.

### 5.6 Scene: a short talk (M1)

```
+------------------------------------+
| Porters' lodge . Midday   [Leave]  |
|                                    |
|                                    |
|              (Yusuf)               |
|               face                 |
|                                    |
| +--------------------------------+ |
| | Yusuf Karim                    | |
| | I told you a bucket won't do   | |
| | it. Come up and see the stain. | |
| |                            [>] | |
| +--------------------------------+ |
| [ Log ]   [ Say a line ]   [ ... ] |
+------------------------------------+
```

- One stage: the room picture (or a tinted gradient from the room kind) fills the frame. The
  bottom third is one slot. The line box, the choices and the result take turns in it.
- The name plate uses the person's colour as a 4 px stripe and the name in `--foreground`.
- Lines type out at the text speed (settings). The first tap completes the line, the second
  goes on. The screen reader gets each full line once through a polite live region; the typing
  text is `aria-hidden`.
- **Choices** replace the line box: 2-4 rows like the card answers. A fourth answer for the card
  shows a small "New answer for the card" label.
- After a pick: "Yusuf will remember that." for 1.5 s in the slot, then the next line.
- **Log** opens the backlog: every line of the scene, newest at the bottom. Long-press or the
  star button on a line keeps it as a favourite line in the person's file.
- **Busy:** the line box shows the speaker plate and three dots; input waits.
- **Error:** "The conversation stopped here. Your choices so far are kept." `[ Try again ]`
  `[ End the talk ]`.

### 5.7 Big scene (M1 for the arrival and the hearing; other blueprints and the weekly budget M2)

A big scene is a scene in 3-6 parts (design.md §3.8). It has four views in the same stage. M1
ships this screen and `scene.part` for two scenes only: the arrival and the board hearing. The
Boat Race below is an M2 example.

**Opening.** Letterbox bars, the title, the room and time. Tap or 2 s goes on.

```
+------------------------------------+
|####################################|
|                                    |
|          The Boat Race             |
|      The quay . Friday evening     |
|        4 parts . about 10 min      |
|                                    |
|####################################|
|            Tap to start            |
+------------------------------------+
```

**A part.** Part dots at the top, up to 5 faces on stage, the speaker raised and the others
dimmed. The bottom slot works as in §5.6.

```
+------------------------------------+
| o o * o   On the quay     [ ... ]  |
|                                    |
|   (CD)    (RS)    (MO)             |
|  Cormac   Rhea    Mina             |
|   ^^^^                             |
|                                    |
| +--------------------------------+ |
| | Cormac Dunne                   | |
| | They've painted the old boat.  | |
| | Painted it, Provost.           | |
| |                            [>] | |
| +--------------------------------+ |
| [ Log ]                            |
+------------------------------------+
```

**Choice point.** The slot shows the goal of the choice and the answers. A `pick` part shows
faces or named options instead of stances.

```
+------------------------------------+
| o o * o   On the quay     [ ... ]  |
|   (CD)    (RS)    (MO)             |
|------------------------------------|
| What do you tell Cormac?           |
| +--------------------------------+ |
| | [$] Order the new boat tonight,| |
| |     win or lose.               | |
| |     Campus mood . Endowment    | |
| +--------------------------------+ |
| | [T] Borrow Carrow's spare for  | |
| |     the race.                  | |
| +--------------------------------+ |
| | [C] Row the old one. We talk   | |
| |     after.                     | |
| +--------------------------------+ |
| [ Say something else ]             |
+------------------------------------+
```

**Between parts.** The part's short result line ("Cormac takes the spare boat. He is not
happy.") stays 1.5 s, then the next part's title card (room and time) shows while `scene.part`
writes. The title card is the busy state, so the wait reads as a scene change.

**Receipt.** At the end, a receipt slides up (same look as the Friday report, §5.9):

```
+------------------------------------+
|          THE BOAT RACE             |
|      Week 3 . Friday evening       |
|  - - - - - - - - - - - - - - - -   |
|  Hollowmere won by a length.       |
|  Campus mood         up            |
|  Endowment           down          |
|  A boat for the eight      won     |
|  - - - - - - - - - - - - - - - -   |
|  Who will remember                 |
|  Cormac   You found him a boat.    |
|  Rhea     You let her pick stroke. |
|  Mina     Saw you at the quay.     |
|  - - - - - - - - - - - - - - - -   |
|  [ Back to the office ]            |
+------------------------------------+
```

- The `[ ... ]` menu holds **Log**, **Skip to the result** and **Leave for now**. Skip asks once:
  "Skip to the result? The middle choice is taken for each part that is left." The receipt then
  shows the template summary, one line per part.
- **Leave for now** returns to the Office with the resume banner. Reopening starts at the last
  choice point of the current part.
- With "Show numbers" on, the receipt shows "Campus mood 54 -> 58" instead of "up".
- **Lite:** the lines come from templates at once; the "Plain text" tag shows on the line box.
- **Error** in a part: "This part did not come through. Your choices so far are kept."
  `[ Try again ]` `[ Use plain text ]` `[ Skip to the result ]`.
- **Hearing** uses the same shell with the meeting slot (§5.8) in each part.

### 5.8 Meeting and board hearing (hearing M1, meetings M2)

```
+------------------------------------+
| Union talks . Item 2 of 3  [ ... ] |
| The leaky Stacks                   |
|------------------------------------|
| For 2       Open 1      Against 1  |
| (MO)+  (YK)+  (IH)?  (HB)-         |
|                                    |
| +--------------------------------+ |
| | Mina Okafor                    | |
| | The students revise under      | |
| | buckets. Fix it or we walk.    | |
| |                            [>] | |
| +--------------------------------+ |
| [ Log ]          [ Use a favour ]  |
+------------------------------------+
```

- The support row shows each attendee's face with a mark: `+` for, `?` open, `-` against, and
  the count per side. Marks have text labels for screen readers ("Mina: for"). A face that
  changes side gets a short ring pulse and the line "Hester is now open."
- Support is per item. Items already closed show as rows above the current one: "Food hub:
  passed".
- Choice points look like the card answers. A typed line goes through `answer.tag`.
- **Hearing** adds two rows above the support row: witnesses (faces) and evidence cards (up to
  2, as chips). The last part is the vote.

**The vote** uses the phased reveal (§6). Members' faces flip one by one to for or against. The
tint behind the row builds while they flip and shows the side before the final count. Then the
count and the result show in the bottom slot: "3 for, 2 against. The board backs you. Endowment
goes to 20. This is your last warning." `[ Back to the office ]`. A lost vote goes to the ending screen, a full-frame receipt with the run's chronicle and
`[ Back to the title screen ]`.

### 5.9 Friday report (M1)

The report is a receipt. It deals in line by line after the phased reveal (§6).

```
+------------------------------------+
|       HOLLOWMERE UNIVERSITY        |
|       Week 3 . Friday report       |
|  - - - - - - - - - - - - - - - -   |
|  Endowment          49 -> 51   +2  |
|  Grades             56 -> 53   -3  |
|  Campus mood        57 -> 54   -3  |
|  Reputation         55 -> 53   -2  |
|  - - - - - - - - - - - - - - - -   |
|  Won    The Stacks roof            |
|  New    The clock tower key        |
|  - - - - - - - - - - - - - - - -   |
|  How they feel                     |
|  Yusuf   Thinks you are cheap, but |
|          he liked that you came up |
|          to see the roof.          |
|  Cormac  Holds you to the Boat     |
|          Race. He told everyone.   |
|  [ See all 8 people ]              |
|  - - - - - - - - - - - - - - - -   |
|  Grades fell for the third week.   |
|  Next week: trustees on Tuesday.   |
|  - - - - - - - - - - - - - - - -   |
|  [ Start week 4 ]                  |
+------------------------------------+
```

- Meters are numbers here (they always are; only people's numbers hide). Each feeling line has
  the person's face; tap opens their file.
- The tint of the reveal says the week's direction before the lines show: `--primary` for a
  good week, `--destructive` for a bad one, `--muted` for mixed.
- A hearing notice ("The trustees will hear your case on Tuesday.") is the last block, with a
  warning border.
- **Busy:** the meter block shows at once (code), the feeling lines show skeletons while
  `report.week` writes. **Error:** feeling lines fall back to band templates ("Waits to see what
  you do next.").

### 5.10 People (list M1, relations M2)

The People tab has two chips, Staff and Groups. Each row is a face, the name, the room the
person is in now and their feeling line on a second line. Cast people carry the "From your
library" badge.

**Person file** (focus screen):

```
+------------------------------------+
| < People    Yusuf Karim       [B]  |
|------------------------------------|
|  (face)  Head porter . Lodge now   |
|          Mood: fine                |
|  "Thinks you are cheap, but he     |
|   liked that you came up."         |
|                                    |
|  Remembers                         |
|  Wk 1  You put a bucket under the  |
|        rare books.                 |
|  Wk 2  You paid for the full roof. |
|  Knows  friends with Mina          |
|  Threads  The Stacks roof (won)    |
|  Kept lines  2                     |
|                                    |
| [ Talk to Yusuf . 1 hour ]         |
| [ Do something with Yusuf...     ] |
+------------------------------------+
```

- "Show numbers" adds a line: trust 62, stress 40, ambition 15.
- If the person is in another room, the talk button reads "Go to the lodge and talk . 2 hours"
  only when the kit counts the room as a trip; most rooms cost 1 hour.
- **Empty** memories: "Yusuf has no memories of you yet."

### 5.11 Place and rooms (room list M1, routines and grapevine M2)

```
+------------------------------------+
| Place      (Rooms) (Grapevine)     |
|------------------------------------|
| The Stacks         condition: worn |
|   (MO) (HB)                        |
| Porters' lodge     condition: good |
|   (YK)                             |
| Boathouse          condition: poor |
|   (CD) (RS) +2                     |
| Admin corridor                     |
|   (IH)                             |
|------------------------------------|
|  Office   Inbox 2   People   Place |
+------------------------------------+
```

- Each room row shows its condition in words and the faces there now. Tap opens the room: its
  picture, people present, the ambient line, `[ Visit . 1 hour ]` and the Do something field.
- A visit plays a short scene with overheard lines (design.md §6).
- **Grapevine** (M2) is a list of rumour lines with their source face: "Heard in The Bilge:
  the new Provost actually listens."
- **Empty room:** "Nobody is in the Boathouse this afternoon."

### 5.12 Do something (M2)

A bottom sheet from the Office field, a person file or a room. The target is a chip.

```
+------------------------------------+
| ---                                |
| Do something              [Close]  |
| At: (Drowned Bell)  With: (Porters)|
| [ Buy the porters a round        ] |
| [ tonight.                       ] |
|                                    |
| Try: Talk to Mina . Visit the      |
|      Stacks . Call a union meeting |
|                                    |
| [ See what it takes ]              |
+------------------------------------+
```

- The result shows in the sheet before it closes: "1 hour. Endowment down a little. Each porter
  there will remember the round." `[ Do it . 1 hour ]` `[ Change it ]`. (`action.tag` runs first; the
  code sets the cost.)
- **Not possible:** the person's answer in voice and two near actions as buttons. "No hour
  spent."
- **Busy:** "Working out what that takes..." **Error:** "That did not go through. Nothing
  changed." `[ Try again ]`.

### 5.13 Cheese Board (Set M1, Spin and Coming up M2)

The Board is a bottom sheet on a phone and a right panel at 900 px or more. cheese-board.md §9
has the Set wireframe. The phone versions of the other views:

**Spin preview**

```
+------------------------------------+
| ---                                |
| Spin: "A storm floods the          |
|        boathouse next week"        |
|------------------------------------|
| Mon wk 4 . morning            [x]  |
| Weather: storm                     |
|------------------------------------|
| Tue wk 4 . afternoon          [x]  |
| Boathouse condition 45 -> 14       |
|------------------------------------|
| Wed wk 4 . big scene          [x]  |
| The flood . 3 parts . 2 hours      |
|------------------------------------|
| You can rewind this from the       |
| journal.                           |
| [ Cancel ]            [ Play it ]  |
+------------------------------------+
```

**Journal**

```
+------------------------------------+
| Journal                   [Close]  |
|------------------------------------|
| Tue wk 3  Set   Yusuf trust 70     |
|                           done  >  |
| Mon wk 3  Spin  Storm at the       |
|           boathouse  scheduled  >  |
| Mon wk 3  Set   Hours +2  rewound  |
|                           [ Redo ] |
+------------------------------------+
```

**Coming up**: rows grouped by day; each row has `[ Move ]` `[ Change ]` `[ Cancel ]` `[ Run now ]`
in a row menu, so the row itself stays one line plus its time. A big scene row shows its parts
count and hours.

- The Board always shows numbers.
- **Busy** (Spin): "Planning..." **Error:** "The planner could not make this plan: no person
  named Tobias. Nothing changed." with matching Set actions under it.

### 5.14 Cast picker and casting sheet (M1)

```
+------------------------------------+
| ---                                |
| Your characters   (Characters)     |
|                   (Personas)       |
| [ Search your characters...      ] |
| Recent: (Rhea) (Silas) (June)      |
|------------------------------------|
| (RS) Rhea Sand   rowing, sport [x] |
| (SM) Silas Marr  noble, rival  [ ] |
| (JO) June Okoye  romance       [ ] |
|------------------------------------|
| [ Cast 1 person ]                  |
+------------------------------------+
```

```
+------------------------------------+
| < Back   Rhea Sand                 |
|          From your library         |
|------------------------------------|
| Role    [ Head of rowing     v ]   |
|         suggested                  |
| Traits  (hot-headed) (loyal) [Edit]|
| Wants   Win the national cup [Edit]|
| Secret  Banned one season...       |
|         [ Keep ]  [ Remove ]       |
| Voice   "Again. And this time..."  |
| Age     34 (from the card)         |
|                                    |
| [ Cast Rhea ]                      |
+------------------------------------+
```

- Age unknown: the Age row is a required choice, "18 or older" or "Keep out of romance", and
  `[ Cast Rhea ]` stays disabled with the reason under it.
- **Busy** (`cast.read`): "Reading Rhea's card..." **Error:** "Rhea's card could not be read.
  You can fill the sheet by hand." with the empty sheet.
- **Empty** library: "You have no characters yet. Make one in the Engine, or start without."

### 5.15 Settings (M1)

One focus screen with grouped rows. Each row is 52 px or more.

| Group   | Rows                                                                             |
| ------- | -------------------------------------------------------------------------------- |
| Reading | Text speed (Slow, Normal, Fast, Instant), Show numbers, Ambient lines on screens |
| Motion  | Follows the system and the Engine; one extra switch "Less motion in this game"   |
| Sound   | Sound cues (off by default), volume                                              |
| Board   | Long-press opens the Board, Honest run                                           |
| Content | Hide 18+ runs, blur 18+ title cards                                              |
| AI      | Plain text mode (Lite), show the call log (`/calls`)                             |

## 6. Motion and feedback

The chrome (top bar, dock, frame) never moves. Only content moves.

| Pattern                               | Where                                        | Normal                                                                                     | Reduced motion                            |
| ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Slide to a new screen                 | focus screens                                | slide in from the end side 16 px + fade, 220 ms, ease-out                                  | fade 120 ms                               |
| Back into the opener                  | closing a focus screen or sheet              | shrinks and moves into the row or button that opened it, 240 ms                            | fade 120 ms                               |
| Cross-fade a refresh                  | same screen, new data (tab switch, next day) | 150 ms                                                                                     | none                                      |
| Deal in a list                        | inbox, threads, report lines, people         | each item rises 8 px + fades, 180 ms, 40 ms apart, only the first 6 stagger                | all at once, no stagger                   |
| Take a card back + stamp              | after an answer                              | card slides to its row 200 ms, stamp drops in (scale 1.15 -> 1, -4 deg) 220 ms, note stays | stamp shows without scale or turn         |
| Typewriter                            | scene lines                                  | 40 characters a second (Normal), tap completes                                             | full line at once                         |
| Letterbox                             | big scene opening                            | bars slide in 300 ms, title fades 200 ms, 2 s or tap                                       | bars shown at once, title stays until tap |
| Phased reveal (charge, flash, reveal) | Friday report, the vote, a big-scene receipt | tint builds 600 ms, one soft brighten 120 ms, lines deal in                                | static tint, no brighten, lines at once   |
| Hour pip                              | an hour spent                                | pip empties 200 ms                                                                         | instant                                   |
| Side change                           | meeting support                              | ring pulse 1 time, 300 ms                                                                  | ring shown 1 s, no pulse                  |
| Busy                                  | any wait                                     | three dots, 1.2 s loop                                                                     | the word "Writing..." with no animation   |

- Tap skips any reveal, deal-in or letterbox. Nothing waits longer than 2 s for animation.
- The brighten is one soft step, never a flash series, so it stays far under 3 flashes a second.
- The stamp replaces toasts. Its note ("Yusuf will remember that.") is also sent to a polite
  live region.
- **Sound cues** are optional and off by default: `stamp`, `bell` (a new day), `door` (a scene
  starts), `gavel` (a vote), `page` (the report). No sound loops.
- Decorative motion never loops on a screen the player reads.

## 7. Copy

### 7.1 Rules

- Plain, concrete words, in short sentences and the active voice.
- Game text is in-world. People speak as themselves: the porter says "The roof's leaking again".
- Buttons say what they do, verb first: "Answer", "Talk to Yusuf", "End the week". Add the
  cost when it costs time: "Talk it through . 1 hour".
- Errors say what happened, what was kept, and what the player can do next. They do not blame
  the player and do not joke.
- No taglines, no three-part slogans, no "No X, no Y" or "It's not X, it's Y" lines, no
  dramatic dashes, no one-word headings for effect, no exclamation marks outside people's lines.
- Banned words in our copy: simply, seamless, effortless, unlock, dive in, elevate, journey,
  epic, awaits, adventure. A locale lint rejects them.
- Sentence case everywhere. Numbers as digits. Names over roles ("Yusuf", not "the porter")
  when the person is known.
- People's names, kit words and meter labels come from the kit, so strings use placeholders
  (`{name}`, `{meter}`, `{room}`).

### 7.2 Example strings

| Key                                | Text                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `title.empty`                      | No places yet. Pick a kit to start your first job.                         |
| `title.newPlace`                   | Start a new place                                                          |
| `preview.take`                     | Take the job                                                               |
| `office.endDay` / `office.endWeek` | End the day / End the week                                                 |
| `office.resume`                    | Resume: {scene}, part {n} of {total}                                       |
| `office.noThreads`                 | Nothing open right now.                                                    |
| `inbox.empty`                      | Nothing on your desk this morning.                                         |
| `inbox.walk`                       | Walk the floor                                                             |
| `card.talk`                        | Talk it through . 1 hour                                                   |
| `card.own`                         | Say something else                                                         |
| `card.noHours`                     | No hours left today. This waits until tomorrow.                            |
| `card.remember`                    | {name} will remember that.                                                 |
| `card.notPossible`                 | No hour spent.                                                             |
| `scene.leave`                      | Leave for now                                                              |
| `scene.skip`                       | Skip to the result                                                         |
| `scene.skipConfirm`                | Skip to the result? The middle choice is taken for each part that is left. |
| `scene.error`                      | This part did not come through. Your choices so far are kept.              |
| `week.apologies`                   | Send apologies                                                             |
| `report.next`                      | Start week {n}                                                             |
| `report.hearing`                   | The {body} will hear your case on {day}.                                   |
| `person.noMemories`                | {name} has no memories of you yet.                                         |
| `room.empty`                       | Nobody is in the {room} this {slot}.                                       |
| `act.busy`                         | Working out what that takes...                                             |
| `busy.slow`                        | Still writing. This depends on your AI connection.                         |
| `error.load`                       | Your saved places did not load.                                            |
| `error.conflict`                   | This run changed in another tab. Reload to see the latest.                 |
| `lite.tag`                         | Plain text                                                                 |
| `cast.unreadable`                  | {name}'s card could not be read. You can fill the sheet by hand.           |

In-world lines that the model or a template writes, for the tone:

- Yusuf, card: "Provost, the roof of The Stacks is leaking onto the rare books again."
- Imogen, not possible: "We are a university, Provost, not a castle. The disciplinary board meets
  on Thursday."
- Ambient: "Yusuf is oiling the lodge door." / "Someone left a tray of scones in the staff room."
- Grapevine: "Heard in The Bilge: the new Provost actually listens."

## 8. Components and slices

All components live in `src/client/` and use the `bc-` prefix. Each has one runnable check for
its logic where it has logic (typewriter skip, face fallback order, support marks).

| Component      | What it is                                                         | First slice   |
| -------------- | ------------------------------------------------------------------ | ------------- |
| `Frame`        | package root, container queries, safe areas, theme hooks           | M1            |
| `TopBar`       | day, hours pips, Board button, More                                | M1            |
| `Dock`         | 4 tabs (5 in Sandbox), rail at 900 px                              | M1            |
| `HourPips`     | filled, empty and booked pips with a text label                    | M1            |
| `MeterGrid`    | 2 x 2 meters, low warning, long-press to Board                     | M1            |
| `StoryCard`    | a thread row: title, person, pressure word                         | M1            |
| `Face`         | avatar, then labelled chip, then initials                          | M1            |
| `NamePlate`    | speaker name with the person's colour stripe                       | M1            |
| `LineBox`      | dialogue slot with typewriter, tap to complete, live region        | M1            |
| `AnswerRow`    | 56 px row: stance icon, text, touched meters                       | M1            |
| `OwnAnswer`    | text box with send, for "Say something else" and typed lines       | M1            |
| `Stamp`        | stamp and "will remember" note, replaces toasts                    | M1            |
| `Receipt`      | receipt layout for the report, big-scene end and endings           | M1            |
| `PhasedReveal` | charge, brighten, reveal, with tap to skip                         | M1            |
| `Sheet`        | bottom sheet on a phone, dialog on a tablet, right panel at 900 px | M1            |
| `BusyVeil`     | blocks input, `aria-busy`, slow-connection line                    | M1            |
| `ErrorPanel`   | what happened, what was kept, two ways on                          | M1            |
| `EmptyState`   | one line and one button                                            | M1            |
| `Letterbox`    | big-scene opening and title cards                                  | M1            |
| `PartDots`     | big-scene progress, with "part 2 of 4" for screen readers          | M1            |
| `SupportRow`   | faces with for, open, against marks and counts                     | M1 (hearing)  |
| `WeekStrip`    | day buttons with big-scene stars and meeting dots                  | M1 (stars M2) |
| `RunCard`      | title card for a saved run                                         | M1            |
| `Backlog`      | scene log with kept lines                                          | M2            |
| `Ticker`       | ambient and grapevine line                                         | M2            |

| Slice (README) | Screens                                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 Playable    | title, kit picker, Preview, Office, week view, Inbox and card, short scene, big-scene screen and `scene.part` for the arrival and the hearing only, Friday report, People list and file, room list, cast picker and casting sheet, Cheese Board Set and journal, settings |
| M2 Alive       | the other big-scene blueprints, the storyteller's weekly big-scene budget and its week marks, meetings, Do something, rooms with routines, grapevine, backlog, viewer mode controls, Spin preview, Coming up                                                              |
| M3 Yours       | wish fields on New place, Preview reroll and system chips, kit editor, Adult module screens, Sandbox dock tab, Honest run sheet, Save to your library                                                                                                                     |
| M4 Lasting     | mini-game screens, relationship map, yearbook, Call someone                                                                                                                                                                                                               |

## 9. Proof

Each slice's PR follows the marinara-design screenshot rule.

1. Screenshots on a live Engine at **390 px, 768 px and 1440 px**, plus a 360 px check that
   nothing scrolls sideways.
2. Both Engine visual themes (`default`, `sillytavern`) and dark and light mode for the shared
   chrome (top bar, dock, sheets, receipt).
3. The states the slice touches: populated, empty, loading, busy, error, Lite, long names and
   long lines, no hours left.
4. Reduced motion on (system setting and the Engine flag): no slide, no typewriter, no brighten.
5. Keyboard only: tab order, focus on each new heading, Esc closes sheets, 1-3 picks answers.
6. A screen reader pass on the card, a scene line, the support row and the report.
7. Console errors and failed requests recorded. An audit pass with `web-design-guidelines` on the
   changed files, and the findings fixed.

The PR lists the viewports, states and anything not checked. DOM assertions alone do not count.

## 10. Open questions

1. Text speed default: Normal (40 characters a second) or Fast?
2. Should the receipt for a big scene show "up" and "down" words, or small arrows with labels?
3. Should a declined invitation cost trust with the host on top of the weak stance?
