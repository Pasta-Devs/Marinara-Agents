# Big Cheese: content catalog

Status: draft, branch `big-cheese-agent`. Companion to [README.md](README.md). That file holds the concept. This file holds the content.

The generator, the normalizer and the storyteller draw on this catalog. The six built-in kits are written here by hand. Each one is a normal Place Kit that the player can copy and edit.

Notation used below:

- Meter types: **M** Money, **O** Output, **P** People, **S** Standing. Meters run 0-100.
- Authority: **Manager**, **Strong leader**, **Absolute ruler**. Absolute kits use Fear, Love and Legitimacy.
- Stance tags: `invest`, `cheap_fix`, `delay`, `delegate`, `refuse`, `ask_others`, and for absolute rulers `decree`, `punish`, `pardon`, `reward`, `banish`, `appoint`.
- Placeholders: `{person}`, `{room}`, `{place}`, `{boss}`, `{deputy}`, `{tradition}`, `{item}`, `{group}`.
- Traits are from section 5. Ambitions, secrets and culture tags are from sections 6 and 7.

---

## 1. Stance table

The code picks a stance tag for each answer (section 1.6) and reads this table. A kit may override any row. All numbers are meter points on the 0-100 scale.

The numbers are tuned with the balance sim in [sim/stance-sim.mjs](sim/stance-sim.mjs). Change a number here, then change it there and run the sim again.

### 1.1 Meter deltas

Every card threatens one meter: its **need**. A roof leak threatens Standing, a strike threatens People, a lost contract threatens Money. The code picks the need when it seeds the card. An answer changes the need. It can also cost another meter. Each stance has its own **cost meter**. If the cost meter is the need itself, People pays instead.

The size **k** comes from the severity: 3 / 6 / 10. Half k is 2 / 3 / 5. A quarter of k is 1 / 2 / 3.

| Stance       | Need     | Cost meter                               | Other                                             |
| ------------ | -------- | ---------------------------------------- | ------------------------------------------------- |
| `invest`     | +k       | Money -k                                 |                                                   |
| `cheap_fix`  | +half    | Output -quarter (the crew's time)        |                                                   |
| `delay`      | 0        | 0                                        |                                                   |
| `delegate`   | +half    | 0                                        | Standing -1 at severity 2-3. Deputy ambition +15. |
| `refuse`     | -half    | Money +quarter                           |                                                   |
| `ask_others` | 0        | Output -1 at severity 2-3 (meeting time) |                                                   |
| `decree`     | +half    | People -quarter                          |                                                   |
| `punish`     | +quarter | People -quarter                          |                                                   |
| `pardon`     | -quarter | People +quarter                          |                                                   |
| `reward`     | +half    | Money -half                              |                                                   |
| `banish`     | +half    | People -half                             | Standing -1                                       |
| `appoint`    | +half    | Output -quarter                          |                                                   |

The six stances for absolute rulers are first values. The sim does not test them yet.

Example: the library roof leaks (need Standing, severity 2). `invest` gives Standing +6 and Money -6. `cheap_fix` gives Standing +3 and Output -2. `delegate` gives Standing +3 and -1, and the deputy gains 15 ambition. `ask_others` gives Standing 0 and Output -1. `refuse` gives Standing -3 and Money +2.

### 1.2 Change for the asker (severity 2)

Manager and Strong leader kits use **Trust**. Absolute kits use **Fear** and **Love**. Severity 1 is half of these numbers. Severity 3 is one and a half times. Round to whole numbers.

| Stance       | Trust | Fear | Love | Legitimacy (absolute) |
| ------------ | ----- | ---- | ---- | --------------------- |
| `invest`     | +8    | 0    | +5   | +1                    |
| `cheap_fix`  | -2    | 0    | -1   | 0                     |
| `delay`      | -3    | +1   | -2   | 0                     |
| `delegate`   | -2    | 0    | -1   | 0                     |
| `refuse`     | -7    | +3   | -4   | -1                    |
| `ask_others` | +2    | 0    | +1   | 0                     |
| `decree`     | -2    | +6   | -3   | -1                    |
| `punish`     | -5    | +8   | -6   | -1                    |
| `pardon`     | +5    | -4   | +8   | +1                    |
| `reward`     | +6    | -1   | +7   | 0                     |
| `banish`     | -9    | +10  | -8   | -3                    |
| `appoint`    | +8    | 0    | +6   | +1                    |

Side effects:

- `delegate` also gives the deputy +3 Trust and +15 ambition progress (rule 8).
- `appoint` gives the person who wanted the post -4 Trust.
- `punish`, `banish` and `decree` give every witness half the Fear change and half the Love change (rounded down).
- `pardon` and `reward` give witnesses with a feud against the asker -2 Trust.

### 1.3 Follow-up chance and what it becomes

The chance is for severity 1 / 2 / 3. The code rolls it when the answer is chosen. The follow-up is the next beat of the card's thread (design.md §3.2) and arrives 1-3 weeks later.

| Stance       | Chance         | Becomes                                                                          |
| ------------ | -------------- | -------------------------------------------------------------------------------- |
| `invest`     | 10 / 10 / 15 % | A thank-you small moment. No meter change.                                       |
| `cheap_fix`  | 30 / 45 / 60 % | The patch fails: same topic, severity +1.                                        |
| `delay`      | 50 / 65 / 80 % | The same card returns, severity +1, marked "Waited".                             |
| `delegate`   | 30 / 40 / 50 % | The deputy overreaches or does it badly: same topic, same severity.              |
| `refuse`     | 25 / 35 / 45 % | The asker goes to their group. A faction card or a resignation threat.           |
| `ask_others` | 40 / 40 / 40 % | An agenda item for the next meeting. If no meeting decides it, the card returns. |
| `decree`     | 20 / 30 / 40 % | Grumbling. At Fear 60+ and Love below 40 it seeds a plot.                        |
| `punish`     | 30 / 40 / 55 % | A grudge: a revenge card, or a martyr story.                                     |
| `pardon`     | 25 / 25 / 25 % | At Love 60+ a loyalty vow. Otherwise a repeat offence.                           |
| `reward`     | 15 / 20 / 25 % | Envy: a rival claims the same reward.                                            |
| `banish`     | 35 / 45 / 55 % | The exile returns with an ally, or an enemy at the gate.                         |
| `appoint`    | 30 / 30 / 30 % | A first test for the appointee, 3 weeks later.                                   |

### 1.4 Rules for the table

1. Each answer shows the meter types it changes ("Reputation · Endowment"), never the numbers.
2. **Place family scale:** care and industrial kits scale `invest` by 1.25. Court kits scale `decree` and `punish` Fear by 1.25. Creative kits scale `reward` by 1.25. Round down.
3. **Difficulty:** Easy x0.75, Normal x1, Brutal x1.25 on all negative deltas.
4. **Perks** add flat numbers after scaling (see section 8).
5. Every meter is clamped to 0-100.
6. A stance not in the kit's allowed list is turned into the nearest one: `punish` becomes `refuse` in a Manager kit, `decree` becomes `delegate`, `pardon` becomes `ask_others`, `reward` becomes `invest`, `banish` becomes `refuse`, `appoint` becomes `delegate`.
7. **Ignored cards:** a card that waits 5 days happens. Its need takes the full -k. It has no follow-up.
8. **Deputy ambition:** each `delegate` gives the deputy +15 ambition progress. At 100 the deputy challenges you at the board: Standing -10, People -5, and the progress goes back to 0. In absolute kits the challenge is a plot.

### 1.5 Friday settle

The code runs these steps after the last answer on Friday, in this order:

1. **Income:** Money + 2 + (Output - 50) / 5, rounded. A busy place earns money; a slow place loses it.
2. **Drift:** every meter moves 10% of the way to 50, rounded. Old wins and old damage fade.
3. **Wear:** every meter -2. A place needs care every week.
4. **Extra meters:** an extra meter below 20 gives its main meter -2.
5. **Loss check:** a meter below 10 on a second Friday starts a **board hearing** (see [design.md](design.md)). The boss argues, allies speak, evidence counts. Win: the meter goes to 20 and the boss gets a "last warning". Lose: the ending (Fired, Voted out or Marooned). Absolute kits use the Legitimacy rules in design.md §9.
6. **Next week's mix:** Classic and Chaos use the severity mix 25 / 45 / 30 (severity 1 / 2 / 3) while tension is below 20. Tension is the average gap below 50 across the four meters. At 20 or more the mix is 45 / 40 / 15. This is the calm-place rule: a calm place gets harder cards.

Sim result for these rules (Hafenkai, 24 weeks, strong / middle / weak offers on each card, 500 runs): a careful player is never fired and ends near 70 on every meter. A random player is fired in 45% of runs. A player who always picks one stance is fired in 45% (`invest`) to 95% (`refuse`, `ask_others`) of runs. The sim is also a CI gate: it fails if a careful bot is fired, or if a random bot is fired in fewer than 20% or more than 60% of runs.

### 1.6 Answer tiers

The code picks the three answers for each card. The model only writes the words for the asker and for the three answers. The three answers are one **strong**, one **middle** and one **weak** stance, each from the kit's allowed list.

| Kit authority  | Strong             | Middle                                                 | Weak                                                |
| -------------- | ------------------ | ------------------------------------------------------ | --------------------------------------------------- |
| Manager        | `invest`           | `cheap_fix`, `delegate`                                | `delay`, `refuse`, `ask_others`                     |
| Strong leader  | `invest`, `reward` | `cheap_fix`, `delegate`                                | `delay`, `refuse`, `ask_others`, `punish`           |
| Absolute ruler | `reward`, `invest` | `decree`, `appoint`, `banish`, `cheap_fix`, `delegate` | `delay`, `refuse`, `ask_others`, `punish`, `pardon` |

Absolute values are first values. The sim does not test them yet. It tests only the Manager row.

How the code weights the pick inside a tier. These are weights, not rules. Every stance in the tier stays possible.

| Input        | Pushes toward                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Asker traits | strict: `decree`, `punish`, `refuse`. generous: `reward`, `invest`. sly: `delegate`. cautious: `delay`. honest: `ask_others`. proud: `reward`, `appoint`.                |
| Culture tags | Family: `invest`, `reward`, `pardon`. Cutthroat: `punish`, `refuse`. Chaotic: `delay`, `cheap_fix`. Strict: `decree`, `punish`. Frugal: `cheap_fix`. Free: `ask_others`. |
| Perks        | a perk that improves a stance raises its weight (for example Penny-pincher and `cheap_fix`)                                                                              |

A card whose strong answer does not fit its need (a pure personal talk, for example) still gets a strong answer: the model words it as time or a gift, and the code still applies the stance numbers. If the model text does not fit its stance, the code retries once, then uses the template text.

---

## 2. Built-in kits

Every kit has the same parts. The model may reword the text. The code keeps the numbers, the stances and the structure.

### 2.1 Warehouse: Hafenkai Logistics, Hamburg

**Premise.** A mid-size freight warehouse on the Elbe quay. Pallets in, pallets out, a ferry horn every hour. The old owner family wants results by the end of the year or they will sell the site.

**Authority:** Manager. The owner family and the board can remove you.

| Type     | Label         | Start |
| -------- | ------------- | ----- |
| Money    | Budget        | 55    |
| Output   | Throughput    | 50    |
| People   | Crew morale   | 60    |
| Standing | Safety record | 65    |

**Rooms**

| Room                  | Kind    | Condition | Feeds |
| --------------------- | ------- | --------- | ----- |
| Dock A                | work    | 70        | O     |
| Dock B                | work    | 45        | O     |
| High-bay racking hall | work    | 60        | O     |
| Pack line             | work    | 65        | O     |
| Cold store            | work    | 55        | S     |
| Forklift garage       | work    | 50        | O     |
| Dispatch office       | work    | 75        | M     |
| Kantine               | social  | 50        | P     |
| Smokers' fence        | outside | 40        | P     |
| Manager's office      | private | 80        | none  |
| Customs archive       | hidden  | 35        | S     |
| Roof                  | hidden  | 30        | P     |

**People**

| Name             | Role                   | Traits                  | Ambition                   | Secret                                            | Voice line                                 |
| ---------------- | ---------------------- | ----------------------- | -------------------------- | ------------------------------------------------- | ------------------------------------------ |
| Henrike Voss     | Deputy, day shift lead | ambitious, strict       | Get your job               | Changed a safety log once                         | "Rules are cheaper than accidents, boss."  |
| Tomasz Kowal     | Forklift lead          | loyal, joker            | Run his own crew           | His truck licence ran out in March                | "The pallet fell on the floor, not on me!" |
| Dilek Arslan     | Dispatch clerk         | curious, honest         | Become a planner           | Keeps a notebook of every delay and who caused it | "I have it in writing. Page twelve."       |
| Gunnar Lindqvist | Works council chair    | stubborn, honest        | A better contract          | Talks to a rival firm about a job                 | "We talk first. Then we work."             |
| Mira Petersen    | Night shift lead       | anxious, nurturing      | A quiet life               | Her mother is ill and she hides it                | "Go home, I have the night."               |
| Jonas Ruff       | Picker                 | flirty, rebel           | Leave and play in a band   | Sold damaged stock on the side                    | "Boss, it's Friday. Spiritually."          |
| Sven Kruse       | Safety officer         | cautious, perfectionist | A year with zero accidents | Hid a near miss to protect the record             | "Count the fingers. Then count again."     |
| Olga Marek       | Kantine cook           | generous, gossip        | Open her own cafe          | Knows her nephew steals from the pantry           | "Eat first. Trouble keeps."                |
| Bernd Haack      | Racker, 31 years       | proud, easygoing        | Retire with honour         | Holds the only key to the customs archive         | "In '94 we did this with a rope."          |
| Leila Hosseini   | Customer manager       | charming, sly           | Win the Rotterdam contract | Passes your price list to a rival                 | "Leave the client to me. Smile, boss."     |
| Finn Albers      | Apprentice             | shy, dreamy             | Pass the final exam        | Fears heights, hides it from the roof crew        | "I can do it. I think. Maybe."             |
| Marlene Teichert | Owner's representative | proud, vengeful         | Sell the site              | Already talks to a buyer                          | "The family is patient. Not forever."      |

**Stakeholder groups:** Works council (Gunnar), Drivers' pool (subcontract truckers), Owner family (Marlene), Key customers (Leila), Night crew (Mira).

**Outside places**

| Place                                     | Role                                           |
| ----------------------------------------- | ---------------------------------------------- |
| Nordtor Spedition                         | Rival: bigger, cheaper, poaches drivers        |
| Kiefer & Sohn Pallets                     | Supplier: pallets and wrap, delivery days      |
| Port Authority and Workplace Inspectorate | Authority: inspections, permits, fines         |
| Elbbank                                   | Money: credit line with strings                |
| Hafenkurier                               | Press: harbour paper, reads the accident book  |
| Zum Rostigen Anker                        | After-work spot: pub with a sea-shanty jukebox |

**Meetings and rituals:** Monday shift briefing (all-hands). Works council talk (monthly). Safety audit (quarterly). Owner call (monthly). Friday Feierabend beer on the quay (ritual).

**House rules**

| Rule                | Options                            | Touches |
| ------------------- | ---------------------------------- | ------- |
| Night-shift bonus   | none / small / large               | M P O   |
| Phones on the floor | banned / breaks only / free        | O P S   |
| Overtime            | voluntary / paid double / expected | M O P   |

**Culture seeds:** Family (Friday Fischbrotchen for everyone). Strict (the safety walk at 06:00). Chaotic (the dock radio plays whatever Tomasz likes).

**Signature cards**

Each card names its need. The three answers are one strong, one middle and one weak stance (section 1.6).

| Who    | Need          | Text                                                                        | Answers (strong / middle / weak)                                                      |
| ------ | ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Tomasz | Safety record | "The old truck's brakes squeal. He says it will last until Christmas."      | New truck `invest`; Grease and tape `cheap_fix`; Ask Sven to inspect `ask_others`     |
| Gunnar | Crew morale   | "The crew wants a heated break hut on the quay. Winter is near."            | Build one `invest`; Space heaters `cheap_fix`; Not this year `refuse`                 |
| Leila  | Throughput    | "Rotterdam wants 20% more pallets at the same price. She said yes already." | Accept and hire `invest`; Let Leila counter `delegate`; Decline `refuse`              |
| Olga   | Crew morale   | "Someone steals from the pantry. She knows who. She will not say."          | Lockers for everyone `invest`; Lock the pantry `cheap_fix`; Ask the crew `ask_others` |
| Sven   | Safety record | "A near miss on Dock B. He wants a full stop for one day."                  | Stop the dock `invest`; A safety talk only `cheap_fix`; Log it and move on `delay`    |
| Jonas  | Crew morale   | "Third Friday off request this month. Band gig again."                      | Yes, and pay a stand-in `invest`; Swap with Finn `delegate`; No `refuse`              |

**Opening threads (week 1).** (1) _Letters from the last boss_ (guided, see below). (2) The pantry thief: a **mystery**, need Crew morale, Olga knows and will not say. (3) Finn's final exam and his fear of heights: a personal **arc**, need Crew morale, with a hidden roof job that could go wrong.

**Guided thread: Letters from the last boss** (design.md §3.6). The old manager left five letters in the Manager's office, one for each day in the plan of design.md §3.6. The thread teaches the main screens and introduces three people in week 1.

| Beat | When      | What happens                                                                                        | Introduces                        |
| ---- | --------- | --------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1    | Sunday    | Letter 1: "Tomasz is loyal and his brakes are not." Opens the truck card. First card, first answer. | Inbox and answer cards. Tomasz.   |
| 2    | Monday    | Letter 2: "Gunnar talks first, then works. Never skip his talks." Points at the works council talk. | Calendar and meetings. Gunnar.    |
| 3    | Wednesday | Letter 3: "Henrike wants my job. She is right to. Watch her."                                       | Staff file. Henrike.              |
| 4    | Thursday  | Letter 4: "Hear what the Kantine says about you. Then hear it again."                               | Grapevine.                        |
| 5    | Friday    | Letter 5: "Ask Olga who eats at night." Points at the pantry thief mystery.                         | Friday report and Office threads. |

The wish generator unlocks after beat 5.

**Crises** (stances all allowed for a Manager kit)

1. **Storm tide on the quay** (O, S): water in Dock A, goods at risk. Stances: `invest`, `cheap_fix`, `ask_others`.
2. **Customs raid on a container** (S, M): a box with a wrong paper. Stances: `ask_others`, `refuse`, `delegate`.
3. **Wildcat strike** (P, O): the night crew stops work after a bad roster. Stances: `invest`, `ask_others`, `refuse`.

**Term goals:** (1) Throughput 65 or more and Safety record 60 or more at the end of the term. (2) No strike and Crew morale 55 or more for the whole term.

### 2.2 University: Hollowmere University, harbour town

**Premise.** An old university on a grey harbour. Seagulls, a clock tower that is always four minutes wrong, and a trust fund that is smaller than it looks. You are the Provost. Everyone has an opinion about the next ten years.

**Authority:** Strong leader. The board of trustees can vote you out.

| Type     | Label       | Start |
| -------- | ----------- | ----- |
| Money    | Endowment   | 50    |
| Output   | Grades      | 55    |
| People   | Campus mood | 60    |
| Standing | Reputation  | 50    |

**Rooms**

| Room                      | Kind    | Condition | Feeds |
| ------------------------- | ------- | --------- | ----- |
| Great Hall                | social  | 70        | S     |
| The Stacks (library)      | work    | 55        | O     |
| Tern Hall (lecture block) | work    | 60        | O     |
| Marine lab on the quay    | work    | 40        | O     |
| The Bilge (student bar)   | social  | 50        | P     |
| Boathouse                 | work    | 45        | P     |
| Gull House (halls)        | private | 45        | P     |
| Cafeteria                 | social  | 55        | P     |
| Admin corridor            | work    | 65        | M     |
| Provost's office          | private | 80        | none  |
| Clock tower               | hidden  | 25        | S     |
| Observatory dome          | hidden  | 35        | O     |

**People**

| Name                   | Role                 | Traits             | Ambition              | Secret                                              | Voice line                              |
| ---------------------- | -------------------- | ------------------ | --------------------- | --------------------------------------------------- | --------------------------------------- |
| Dr. Imogen Hale        | Deputy Provost       | strict, ambitious  | Be Provost            | Wrote the reform plan under your name               | "The plan is sound. Your delay is not." |
| Prof. Anselm Baptiste  | Dean of Sciences     | bookish, proud     | A new science wing    | Published a result he cannot repeat                 | "Data, not feelings, Provost."          |
| Prof. Odalys Ferreira  | Dean of Arts         | charming, sly      | Merge Arts with Media | Takes fees from a private tutoring firm             | "Darling, every budget is a story."     |
| Cormac Dunne           | Head of rowing       | hot-headed, flirty | Win the national cup  | Bets on his own races                               | "Eight people, one rhythm, no excuses." |
| Mina Okafor            | Union president      | brave, rebel       | Free food for all     | Is failing a course and hides it                    | "Students are not customers."           |
| Teodor Vance           | Bursar               | frugal, anxious    | Balance the books     | Covered a hole in the budget with a trust fund      | "Every pound has a name."               |
| Hester Lindgren        | Head librarian       | loner, bookish     | Save the rare books   | Hides a banned manuscript                           | "Silence is a service."                 |
| Dr. Pascal Oduya       | Marine lab director  | curious, dreamy    | A deep-sea expedition | Lost a sample set and told nobody                   | "The sea has not finished talking."     |
| Lady Cordelia Ashgrove | Chair of trustees    | proud, generous    | Her name on a hall    | Her family fortune is nearly gone                   | "I give. I also remember."              |
| Yusuf Karim            | Head porter          | loyal, gossip      | Keep the old ways     | Knows the clock tower key is missing                | "Nothing happens here that I miss."     |
| Nell Whitcombe         | Teaching assistant   | shy, honest        | A permanent post      | Grades papers for a professor who steals the credit | "Sorry. Can I say one thing?"           |
| Barnaby Quill          | Student paper editor | curious, joker     | A national byline     | Invents one quote per issue                         | "Source: a very reliable pigeon."       |

**Stakeholder groups:** Board of trustees (Cordelia), Student union (Mina), Faculty senate (Anselm and Odalys), Alumni association, Town council.

**Outside places**

| Place                    | Role                                                  |
| ------------------------ | ----------------------------------------------------- |
| Carrow College           | Rival: across the estuary, poaches professors         |
| Tidewell Instruments     | Supplier: lab equipment, delivery days                |
| Education Quality Agency | Authority: accreditation and audit                    |
| Ashgrove Trust           | Money: donations with strings                         |
| Hollowmere Gazette       | Press: town paper and the student paper               |
| The Drowned Bell         | After-work spot: pub with a bell that rings by itself |

**Meetings and rituals:** Senate meeting (monthly). Board of trustees (quarterly). Union talks (monthly). Matriculation in the Great Hall. The Boat Race. Open Day in spring.

**House rules**

| Rule                     | Options                                        | Touches |
| ------------------------ | ---------------------------------------------- | ------- |
| Tuition level            | low / standard / high                          | M P S   |
| Library hours            | 9 to 5 / 9 to 9 / open all night in exam weeks | O P M   |
| Bar licence at The Bilge | until 22:00 / until 01:00 / free               | P S     |

**Culture seeds:** Scholarly (the Latin motto stays). Competitive (the league table on the wall). Family (the first-year welcome walk).

**Signature cards**

Each card names its need. The three answers are one strong, one middle and one weak stance (section 1.6).

| Who           | Need        | Text                                                                   | Answers (strong / middle / weak)                                                                    |
| ------------- | ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Mina          | Campus mood | "300 students skipped meals last week. The union asks for a food hub." | Fund it `invest`; Use cafeteria leftovers `cheap_fix`; Form a working group `ask_others`            |
| Dr. Oduya     | Grades      | "The lab pump failed. The samples are dying."                          | Emergency purchase `invest`; Patch it with spare parts `cheap_fix`; Borrow from Carrow `ask_others` |
| Lady Cordelia | Endowment   | "A million for a new hall with her name, instead of Gull House."       | Accept `invest`; Take half and keep Gull House `cheap_fix`; Decline `refuse`                        |
| Cormac        | Campus mood | "The eight won the regatta. He wants a boathouse upgrade."             | Upgrade `invest`; A day off only `cheap_fix`; Thanks, no `refuse`                                   |
| Barnaby       | Reputation  | "The Gazette will print a grade-inflation story unless you comment."   | Publish the grade audit yourself `invest`; Let admissions handle it `delegate`; No comment `refuse` |
| Teodor        | Endowment   | "A 4% budget gap this quarter. He proposes to cut library hours."      | Dip into the endowment `invest`; Cut hours `cheap_fix`; Ask trustees for a loan `ask_others`        |

**Opening threads (week 1).** (1) _Letters from the last boss_ (guided, see below). (2) The failing lab pump: a **crisis** that ticks, need Grades, Dr. Oduya wants an answer by Friday. (3) Nell's permanent post: a personal **arc**, need Campus mood, with the professor who takes her credit.

**Guided thread: Letters from the last boss** (design.md §3.6). The last Provost left five letters in the Provost's office, one for each day in the plan of design.md §3.6. The sample week in design.md §1 plays them. The thread teaches the main screens and introduces three people in week 1.

| Beat | When      | What happens                                                                                             | Introduces                        |
| ---- | --------- | -------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1    | Sunday    | Letter 1: "Yusuf knows every door. Ask him first." First card, first answer.                             | Inbox and answer cards. Yusuf.    |
| 2    | Monday    | Letter 2: "The union eats you alive if you skip their talks." Points at Wednesday's union talks.         | Calendar and meetings. Mina.      |
| 3    | Wednesday | Letter 3: "Your deputy smiles a lot. Count the smiles."                                                  | Staff file. Dr. Imogen Hale.      |
| 4    | Thursday  | Letter 4: "Read what they say about you. Then read it again."                                            | Grapevine.                        |
| 5    | Friday    | Letter 5: "Don't trust the clock." Closes the guided thread and opens the mystery "The clock tower key". | Friday report and Office threads. |

The wish generator unlocks after beat 5.

**Crises** (stances all allowed for a Strong leader kit)

1. **Tuition protest** (P, S): students block the Great Hall. Stances: `ask_others`, `invest`, `refuse`.
2. **Accreditation audit** (S, O): the agency arrives early. Stances: `invest`, `delegate`, `cheap_fix`.
3. **Storm floods the Stacks** (M, O): rare books in water. Stances: `invest`, `ask_others`, `cheap_fix`.

**Term goals:** (1) Reputation 65 or more by the end of the term. (2) No cancelled exam and Campus mood 50 or more for the whole term.

### 2.3 Absolute Authority Headmaster: St. Corvin's Academy

**Premise.** A stone academy on a cold moor, with a bell tower and a long list of rules. You are the Headmaster and your word is law. Prefects carry your orders. A secret society wants to change that.

**Kit fact:** St. Corvin's is a residential college-age academy. Every student is 18 or older (ages 18 to 23).

**Authority:** Absolute ruler. Nobody can remove you except a revolt, a Ministry takeover or ruin. Fear 50, Love 40, Legitimacy 60.

| Type     | Label           | Start |
| -------- | --------------- | ----- |
| Money    | School funds    | 50    |
| Output   | Exam results    | 55    |
| People   | School spirit   | 60    |
| Standing | Ministry favour | 45    |

**Rooms**

| Room                         | Kind    | Condition | Feeds |
| ---------------------------- | ------- | --------- | ----- |
| Assembly hall                | social  | 70        | S     |
| Headmaster's study           | private | 85        | none  |
| Founders' Library            | work    | 60        | O     |
| Ravenscar House (north dorm) | private | 45        | P     |
| Thorne House (south dorm)    | private | 55        | P     |
| Refectory                    | social  | 60        | P     |
| The Quiet Room (detention)   | work    | 50        | P     |
| Chapel of Lamps              | social  | 65        | S     |
| Playing fields               | outside | 60        | P     |
| Staff room                   | work    | 55        | O     |
| Bell tower                   | hidden  | 30        | S     |
| Cellar archive               | hidden  | 35        | S     |

**People**

| Name                  | Role                            | Traits             | Ambition                   | Secret                                     | Voice line                                      |
| --------------------- | ------------------------------- | ------------------ | -------------------------- | ------------------------------------------ | ----------------------------------------------- |
| Miss Philippa Rooke   | Deputy Head                     | strict, ambitious  | Be Head                    | Wrote to the Ministry about you            | "The rules are fine. Your mood is the problem." |
| Cedric Ashby-Lowe     | Head Prefect (enforcer)         | proud, ambitious   | Rule the academy after you | Takes favours for "lost" demerits          | "Order, Headmaster. I bring order."             |
| Imelda Grist          | Warden of Thorne (enforcer)     | honest, brave      | Fair rules for all         | Helps a student hide a debt                | "Rules for me, rules for him."                  |
| Dr. Lucan Fairweather | Senior Tutor                    | bookish, sly       | Lead the teachers' faction | Leaks staff talk to the Lantern Society    | "One must read between the bells."              |
| Mrs. Odette Marsh     | Matron                          | nurturing, gossip  | Keep her students safe     | Keeps a ledger of every night-time visitor | "I see all the boots, dear."                    |
| Tobias Crane          | Groundskeeper                   | loner, loyal       | Quiet moor life            | Knows a secret door under the chapel       | "Nobody asks the man with the spade."           |
| Hilary Penhallow      | Bursar                          | frugal, anxious    | A balanced budget          | Embezzled a small sum long ago             | "We cannot afford ink, sir."                    |
| Prof. Ines Valcourt   | Head of Sciences                | curious, stubborn  | A lab of her own           | Her last paper was a student's work        | "Evidence, Headmaster. Not opinions."           |
| Thaddeus Brook        | Student, Lantern Society leader | charming, rebel    | Open the school to change  | The society hides stolen exam papers       | "We only want the lights on."                   |
| Wren Aldous           | Student, Thorne captain         | joker, brave       | Win the House Cup          | Runs a hidden card game                    | "Detention is just a long lunch."               |
| Marguerite Daubney    | Student, scholarship            | perfectionist, shy | Top of the year            | Cheated once, out of fear                  | "I will not fail. I cannot fail."               |
| Dorian Sable          | Student, Ravenscar captain      | vengeful, proud    | Break Thorne               | Pays a prefect to look away                | "Some houses are born to win."                  |
| Inspector Gideon Pike | Ministry inspector (visitor)    | cautious, honest   | Report the truth           | Is owed a favour by the Ministry           | "I only count what I can see."                  |

**Stakeholder groups:** Prefects (Cedric), Teachers' faction (Lucan), Lantern Society (Thaddeus), House Ravenscar and House Thorne, Ministry (Pike), Old Corvinians (alumni).

**Outside places**

| Place                     | Role                                   |
| ------------------------- | -------------------------------------- |
| Wexmoor College           | Rival: poaches top students            |
| Brightwater Provisions    | Supplier: food and coal                |
| Ministry of Education     | Authority: inspections, funding        |
| Old Corvinians Foundation | Money: scholarships and gifts          |
| The County Courier        | Press: loves a scandal                 |
| The Raven and Lamp        | After-work spot: village pub for staff |

**Meetings and rituals:** Monday assembly (your speech). Prefects' report (weekly). Staff meeting (weekly). House Cup (termly). Sports day. Matriculation and entrance exams. Founders' Night lantern walk.

**Decrees**

| Decree           | Options                                       | Touches | Fear / Love / Legitimacy                    |
| ---------------- | --------------------------------------------- | ------- | ------------------------------------------- |
| Curfew           | none / 23:00 / 21:00 with bell patrols        | P O S   | 21:00 gives Fear +4, Love -3                |
| Phones           | allowed / lectures only / locked in boxes     | O P     | boxes give Fear +3, Love -4, Legitimacy -1  |
| Dorm inspections | monthly, announced / weekly, surprise / daily | P S     | daily gives Fear +5, Love -5, Legitimacy -2 |

**Culture seeds:** Strict (the morning bell at 05:30). Competitive (the House Cup banner). Scholarly (silent hour in the Library every evening).

**Signature cards**

Each card names its need. The three answers are one strong, one middle and one weak stance (section 1.6). Absolute values are not simulated yet.

| Who            | Need            | Text                                                                       | Answers (strong / middle / weak)                                                                                  |
| -------------- | --------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Cedric         | School spirit   | "Three Thorne students were out after curfew. Wren says it was a bet."     | Pardon them and share a feast to end the bet `reward`; Let Cedric decide `delegate`; A week of detention `punish` |
| Mrs. Marsh     | School spirit   | "The north boiler died. Students sleep in their coats."                    | Replace it `invest`; Move everyone to the hall `decree`; Wait for spring `delay`                                  |
| Thaddeus       | School spirit   | "A letter asks you to open the cellar archive to all students."            | Open it `reward`; Forbid it `decree`; Meet him in person `ask_others`                                             |
| Marguerite     | Exam results    | "She topped the exams. Her family cannot pay next term."                   | Full scholarship `reward`; Work in the library for it `cheap_fix`; No `refuse`                                    |
| Inspector Pike | Ministry favour | "He asks to see the punishment book."                                      | Dinner on Founders' Night `reward`; A cleaned copy `cheap_fix`; Make him wait a week `delay`                      |
| Imelda         | Ministry favour | "Prefects take 'fines' in sweets and favours. Cedric says she is jealous." | Honour Imelda and end the fines `reward`; Imelda leads the fines `appoint`; Do nothing `delay`                    |

**Opening threads (week 1).** (1) Pike's visit: a **promise** with a clock, the dinner on Founders' Night in week 4. (2) Marguerite's fees: a **request** with a deadline at term start, need Exam results. (3) Imelda and Cedric's fines: a personal **arc**, need Ministry favour.

**Crises**

1. **Lantern Society sit-in** (P, S): they hold the Assembly hall. Stances: `ask_others`, `punish`, `pardon`.
2. **Ministry snap inspection** (S, M): Pike arrives at dawn. Stances: `invest`, `delegate`, `refuse`.
3. **Exam paper leak** (O, S): the paper is found in a dorm. Stances: `punish`, `ask_others`, `decree`.

**Term goals:** (1) Exam results 65 or more with School spirit 50 or more. (2) Love 50 or more and Fear below 60 at term end, which keeps Legitimacy above 50.

### 2.4 Medieval King: Kingdom of Valmora, King Aldric II

**Premise.** A small green kingdom between hills and a salt coast. Your father left a thin treasury, a proud council and a border you cannot afford. You are King Aldric II, crowned last spring. Every morning the petitioners queue in the throne room.

**Authority:** Absolute ruler. Only a revolt, a coup, a conquest or ruin can end your reign. Fear 40, Love 50, Legitimacy 65.

| Type     | Label    | Start |
| -------- | -------- | ----- |
| Money    | Treasury | 50    |
| Output   | Harvest  | 55    |
| People   | Commons  | 55    |
| Standing | Nobles   | 50    |

**Rooms**

| Room                 | Kind    | Condition | Feeds |
| -------------------- | ------- | --------- | ----- |
| Throne room          | social  | 75        | S     |
| Council chamber      | work    | 70        | O     |
| Great kitchen        | work    | 55        | P     |
| Granary              | work    | 45        | O     |
| Armoury and barracks | work    | 50        | S     |
| Chapel               | social  | 65        | P     |
| Royal chambers       | private | 80        | none  |
| Treasury vault       | work    | 60        | M     |
| Scriptorium          | work    | 55        | O     |
| Stables              | outside | 50        | S     |
| The dungeon          | work    | 35        | S     |
| Postern stair        | hidden  | 30        | S     |

**People**

| Name                        | Role                            | Traits            | Ambition                   | Secret                                  | Voice line                                  |
| --------------------------- | ------------------------------- | ----------------- | -------------------------- | --------------------------------------- | ------------------------------------------- |
| Osric Thane                 | Chancellor (deputy)             | sly, ambitious    | Be regent                  | Drafts a second will for you            | "A king needs a quiet pen, Majesty."        |
| Sir Hadwin Rook             | Marshal                         | brave, hot-headed | A war that he wins         | Hides a lost battle report              | "Give me a hill and a hundred men."         |
| Cuthbert Aurelian           | Bishop                          | proud, strict     | Church tax freedom         | Doubts his own faith                    | "Even kings kneel, Majesty."                |
| Isolde Vane                 | Spymaster (enforcer)            | sly, loner        | Know everything            | Has a spy in your bedchamber            | "Whispers are cheaper than armies."         |
| Queen Aveline               | Queen consort                   | charming, proud   | A strong court for her kin | Writes to her brother in Teshmar        | "I married a crown. Be worthy of it."       |
| Prince Edric                | Heir                            | dreamy, rebel     | Marry for love             | Plans to flee the court                 | "I want a life, not a throne."              |
| Pip Hollin                  | Court jester                    | joker, honest     | Be taken seriously         | Is the only man who tells you the truth | "The king is naked. Shall I say it louder?" |
| Bartholomew Finch           | Master of Coin                  | frugal, anxious   | A full treasury            | Lent money to a duke                    | "Majesty, the vault echoes."                |
| Dame Gerta                  | Head cook                       | nurturing, gossip | Feed the whole court       | Poisoned a rival soup once, by accident | "No one plots on an empty stomach."         |
| Duke Rainald of the Marches | Noble leader                    | proud, vengeful   | The throne's ear           | Hoards weapons                          | "My line held the border before yours."     |
| Tamsin Bright               | Guildmaster                     | honest, ambitious | A seat on the council      | Smuggles salt                           | "Trade does not kneel. It counts."          |
| Walt Ashdown                | Village reeve                   | loyal, stubborn   | Lower taxes                | Hides a runaway serf                    | "We feed you, Majesty. Remember it."        |
| Cael Dunmore                | Captain of the Guard (enforcer) | loyal, strict     | A just kingdom             | Disobeyed one order in secret           | "My sword is the crown's. Not the duke's."  |

**Stakeholder groups:** Royal council, Nobles (Rainald), Commons (Walt), Merchants' guild (Tamsin), The Church (Cuthbert), The army (Rook), The queen's kin.

**Outside places**

| Place                      | Role                                                   |
| -------------------------- | ------------------------------------------------------ |
| Kingdom of Teshmar         | Rival: border claims, marriage offers                  |
| Free city of Brenholt      | Supplier and trade partner: salt, iron, cloth          |
| The Church                 | Authority: tithes, blessings, excommunication          |
| House Corvalle             | Money: lenders to kings                                |
| Wandering bards and criers | Press: songs that shape the crown's name               |
| The Gilded Boar            | After-work spot: tavern where nobles drink in disguise |
| Greywood Wolves            | Danger: bandits on the north road                      |

**Meetings and rituals:** Petition day (every morning, one card each). Royal council (weekly). Harvest Festival. Tournament in spring. Coronation anniversary feast. Midwinter vigil.

**Decrees**

| Decree         | Options                                    | Touches | Fear / Love / Legitimacy           |
| -------------- | ------------------------------------------ | ------- | ---------------------------------- |
| Grain tax      | light / standard / heavy                   | M P O   | heavy gives Fear +3, Love -4       |
| Hunting rights | commons may hunt / nobles only / king only | P S     | king only gives Love -5, Nobles +3 |
| Petition day   | daily / weekly / never                     | P S     | never gives Love -6, Legitimacy -3 |

**Culture seeds:** Traditional (the throne room torches never go out). Honour-bound (a knight's oath at every feast). Festival-loving (the lantern boats on the river).

**Signature cards**

Each card names its need. The three answers are one strong, one middle and one weak stance (section 1.6). Absolute values are not simulated yet.

| Who             | Need     | Text                                                          | Answers (strong / middle / weak)                                                                                                                  |
| --------------- | -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Walt Ashdown    | Commons  | "The mill tax is too high. Folk grind by hand."               | Lower it `invest`; Send a tax counter `delegate`; Keep it `refuse`                                                                                |
| Duke Rainald    | Nobles   | "He asks the right to raise his own levy."                    | Grant it `reward`; Summon him to court `decree`; Refuse `refuse`                                                                                  |
| Isolde Vane     | Nobles   | "A poisoner serves in the kitchen. She has a name."           | Pay the scullion who named her, the poisoner leaves at dawn `reward`; Turn the poisoner into your informant `appoint`; Hang the poisoner `punish` |
| Bishop Cuthbert | Commons  | "He wants the old festival of lights banned as pagan."        | Bless it and pay for a chapel feast `reward`; Ban it `decree`; Ask the villages `ask_others`                                                      |
| Prince Edric    | Nobles   | "He will not wed for the Teshmar treaty. He loves a harper."  | Allow it `reward`; Forbid it `decree`; Let the council vote on the match `ask_others`                                                             |
| Tamsin Bright   | Treasury | "The guild offers a loan at 12% to rebuild the river bridge." | Take it `invest`; Raise the bridge toll `cheap_fix`; Ask the council `ask_others`                                                                 |

**Opening threads (week 1).** (1) The mill tax: a **request** from Walt, need Commons, and the harvest feast is the clock. (2) The poisoner in the kitchen: a **mystery**, need Nobles, Isolde knows a name. (3) Prince Edric and the harper: a personal **arc**, need Nobles, with the Teshmar treaty as the stakes.

**Crises**

1. **Winter famine** (O, P): the granary runs low. Stances: `invest`, `decree`, `ask_others`.
2. **Teshmar border raid** (S, M): riders burn a farm. Stances: `invest`, `punish`, `ask_others`.
3. **Court plot** (S, P): the duke and the chancellor meet at night. Stances: `punish`, `pardon`, `banish`.

**Term goals:** (1) Harvest 65 or more and Commons 55 or more at the next Harvest Festival. (2) Name an heir and keep Legitimacy at 60 or more.

### 2.5 Pirate ship: the _Salt Magpie_

**Premise.** A fast brigantine with a patched sail and a famous parrot. The crew voted you captain after the last captain left in a hurry. You have the ship, the Article that every sailor signed, and a sea full of rich ships and angry navies.

**Authority:** Strong leader. The Article gives the quartermaster the right to call a crew vote. A lost vote means you are marooned.

| Type           | Label        | Start |
| -------------- | ------------ | ----- |
| Money          | Plunder      | 40    |
| Output         | Prize haul   | 35    |
| People         | Crew loyalty | 60    |
| Standing       | Infamy       | 35    |
| Extra (People) | Rum supply   | 70    |

The extra meter maps to People. Like every extra meter, a Rum supply below 20 lowers its main meter (Crew loyalty) by 2 each week.

**Rooms**

| Room                       | Kind    | Condition | Feeds |
| -------------------------- | ------- | --------- | ----- |
| Quarterdeck                | work    | 65        | O     |
| Main deck                  | work    | 55        | O     |
| Captain's cabin            | private | 70        | none  |
| Gun deck                   | work    | 50        | O     |
| Galley                     | social  | 45        | P     |
| Hold                       | work    | 60        | M     |
| Crew quarters              | private | 40        | P     |
| Crow's nest                | outside | 60        | O     |
| Brig                       | work    | 35        | P     |
| Rum store                  | hidden  | 70        | P     |
| Powder magazine            | hidden  | 55        | S     |
| Hold under the false floor | hidden  | 80        | M     |

**People**

| Name                  | Role                   | Traits              | Ambition               | Secret                                       | Voice line                                 |
| --------------------- | ---------------------- | ------------------- | ---------------------- | -------------------------------------------- | ------------------------------------------ |
| Dagny Holt            | Quartermaster (deputy) | strict, honest      | Keep the Article fair  | Counts the shares twice, on purpose          | "The Article binds you too, Captain."      |
| Jory Fell             | Bosun                  | loyal, hot-headed   | A ship of his own      | Skims a little powder                        | "Hands to the rope, or hands to the sea!"  |
| Mabs Tully            | Cook                   | generous, gossip    | A tavern on shore      | Waters the rum                               | "A fed crew is a loyal crew."              |
| Zephyr Okonkwo        | Navigator              | curious, dreamy     | Chart the Sunless Sea  | Sells maps to the Crown                      | "The stars never lie. The wind does."      |
| Rafferty "Boom" Quinn | Gunner                 | brave, joker        | The perfect broadside  | Is deaf in one ear and hides it              | "Say it again, Captain? Louder!"           |
| Philomena Vale        | Surgeon                | cautious, nurturing | A hospital on land     | Was a navy doctor                            | "Bleed on the deck, not on my sheets."     |
| Old Hob               | Carpenter              | stubborn, proud     | Retire to a hut        | The hull has a slow leak he patches at night | "She floats. Do not ask how."              |
| Lysa Brandt           | Sailmaker              | shy, perfectionist  | Sew a legendary flag   | Stitched a spy's sign into the sail          | "One more stitch and it is right."         |
| Ezra Penn             | Stowaway scholar       | bookish, anxious    | Write the ship's story | Is a runaway bank clerk                      | "I can read your charts. Please."          |
| Cutter Vance          | First mate             | ambitious, charming | Be captain             | Speaks to the crew at night                  | "Fortune favours the bold. And the early." |
| Sparrow Dane          | Lookout                | rebel, dreamy       | See a far island       | Hides a stolen compass                       | "Sail! Or a cloud. Probably a sail."       |
| Admiral (the parrot)  | Ship's mascot          | joker, loner        | More crackers          | Repeats secrets he hears                     | "Mutiny! Squawk! Just kidding!"            |

**Stakeholder groups:** The crew (the Article), Officers, Gunners, Port Mercy fences, The Crown Navy (against you).

**Outside places**

| Place                              | Role                                            |
| ---------------------------------- | ----------------------------------------------- |
| Red Kestrel (Captain Orlaith Bane) | Rival: chases the same prizes                   |
| Port Mercy black market            | Supplier: powder, rum, repairs                  |
| Crown Navy (Admiral Hartwell)      | Authority: hunts you, offers pardons            |
| Madame Quill's counting house      | Money: fence and banker                         |
| Tavern ballad singers              | Press: songs make or break your name            |
| The Soused Gull                    | After-work spot: shore tavern with no questions |

**Meetings and rituals:** The Article vote (crew council). Share-out day. Captain's table dinner. Sunday shanty night. A toast to every sunk friend. The burial of a lost mate.

**House rules**

| Rule       | Options                                     | Touches |
| ---------- | ------------------------------------------- | ------- |
| Share-out  | equal / officers double / captain's cut     | M P S   |
| Rum ration | free pour / ration / dry ship               | P O     |
| Prize rule | take all / spare the crew / spare the cargo | M S P   |

**Culture seeds:** Free (every voice counts). Feared (the black flag at dawn). Merry (songs at every watch).

**Signature cards**

Each card names its need. The three answers are one strong, one middle and one weak stance (section 1.6).

| Who        | Need         | Text                                                                    | Answers (strong / middle / weak)                                                                                      |
| ---------- | ------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Dagny      | Crew loyalty | "Share-out day. The crew wants equal shares. The officers want double." | Equal shares `reward`; Equal shares, officers get a small bonus later `cheap_fix`; Put it to a vote `ask_others`      |
| Boom Quinn | Infamy       | "He spotted a heavy navy ship. He itches to try his guns."              | Chase it `invest`; One warning shot `cheap_fix`; Shadow it for a day `delay`                                          |
| Mabs       | Rum supply   | "The rum goes down faster than planned."                                | Buy more at Port Mercy `invest`; Check the store at night `cheap_fix`; Ration it `refuse`                             |
| Zephyr     | Prize haul   | "A storm ahead. The short route to Port Mercy goes through it."         | Go around `invest`; Go through `cheap_fix`; Wait it out `delay`                                                       |
| Ezra Penn  | Prize haul   | "He offers to read the captured charts for a free place aboard."        | Welcome him `invest`; Let Dagny decide `delegate`; Put him ashore `refuse`                                            |
| Jory Fell  | Crew loyalty | "Two sailors fought over a card game. One has a cut hand."              | Pay the cut hand a share and end the game `reward`; Jory deals with it `delegate`; Scrub the deck for a week `punish` |

**Opening threads (week 1).** (1) The share-out: a **request** from Dagny, need Crew loyalty, due on share-out day. (2) The watered rum: a **cover-up**, need Rum supply, Mabs hides it. (3) Ezra Penn the runaway clerk: a personal **arc**, need Prize haul, he hides who he is.

**Crises**

1. **Navy sloop on the horizon** (S, M): the Crown hunts you. Stances: `invest`, `delay`, `ask_others`.
2. **Mutiny whispers** (P, S): Cutter speaks at night. Stances: `punish`, `reward`, `ask_others`.
3. **Becalmed with water low** (O, P): no wind for six days. Stances: `cheap_fix`, `invest`, `ask_others`.

**Term goals:** (1) Plunder 65 or more and Infamy 60 or more by the end of the season. (2) Prize haul 60 or more with Crew loyalty above 40.

### 2.6 Hospital ward: Ward 7, Linden General

**Premise.** A busy medical ward of 24 beds in an old city hospital. Short staff, long corridors, a tea trolley that never arrives on time. You are the Ward Manager. The hospital director wants an inspection score above 70 by spring.

**Authority:** Manager. The hospital director can remove you.

| Type     | Label            | Start |
| -------- | ---------------- | ----- |
| Money    | Ward budget      | 50    |
| Output   | Patients treated | 55    |
| People   | Staff morale     | 55    |
| Standing | Inspection score | 60    |

**Rooms**

| Room                 | Kind    | Condition | Feeds |
| -------------------- | ------- | --------- | ----- |
| Nurses' station      | work    | 65        | O     |
| Bay A (6 beds)       | work    | 55        | O     |
| Bay B (6 beds)       | work    | 45        | O     |
| Side rooms           | work    | 60        | S     |
| Treatment room       | work    | 65        | O     |
| Medicine store       | work    | 70        | S     |
| Staff room           | social  | 40        | P     |
| Family room          | social  | 50        | S     |
| Sluice and linen     | work    | 35        | S     |
| Night duty bunk room | private | 30        | P     |
| Roof terrace         | hidden  | 40        | P     |
| Closed Ward 2 wing   | hidden  | 20        | O     |

**People**

| Name                  | Role                        | Traits                  | Ambition                    | Secret                                     | Voice line                                |
| --------------------- | --------------------------- | ----------------------- | --------------------------- | ------------------------------------------ | ----------------------------------------- |
| Gwen Halloran         | Ward sister (deputy)        | strict, loyal           | Run a bigger ward           | Covers for a colleague's mistakes          | "I run the shift. You run the building."  |
| Dr. Anil Chandrasekar | Consultant                  | proud, ambitious        | Lead the department         | Publishes with borrowed data               | "My rounds are not a suggestion."         |
| Dr. Esme Walsh        | Junior doctor               | anxious, brave          | Qualify without a breakdown | Made a near-miss error                     | "I'm fine. I'm fine. Who needs a coffee?" |
| Rowan Ellis           | Senior nurse                | easygoing, honest       | A teaching post             | Plans to leave in spring                   | "Give me five minutes and a biscuit."     |
| Bridget Nolan         | Healthcare assistant        | nurturing, gossip       | Be listened to              | Keeps patients' stories in a notebook      | "Mr Pell is lonely, he's not difficult."  |
| Hamza Qureshi         | Pharmacist                  | cautious, perfectionist | A flawless audit            | Found a gap in the medicine log            | "Initial here. And here. And here."       |
| Des Flynn             | Porter                      | joker, loyal            | Win the staff quiz          | Moves patients faster than the rule allows | "Wheelchair taxi, going your way?"        |
| Katya Novak           | Physiotherapist             | easygoing, curious      | Start a recovery gym        | Is job-hunting                             | "One more step. You are doing it."        |
| Precious Adeyemi      | Head of cleaning            | honest, proud           | A fair wage                 | Reports the dirtiest corner no one fixes   | "A clean ward is a safe ward."            |
| Lorcan Beck           | Ward clerk                  | shy, bookish            | Move to planning            | Lost a file once and rebuilt it            | "It is in the system. Probably."          |
| Margit Sorensen       | Union rep                   | stubborn, brave         | Safe staffing numbers       | Has a leaked staffing memo                 | "Safe staffing is not negotiable."        |
| Delphine Harker       | Families' council           | stubborn, proud         | Better visiting hours       | Her husband died on a ward like yours      | "We are not visitors. We are family."     |
| Alistair Penrose      | Hospital director (visitor) | cautious, strict        | Cut costs without noise     | Is up for a promotion                      | "Metrics, Ward Manager. Always metrics."  |

**Stakeholder groups:** Nurses, Doctors, Cleaning and portering staff, Union (Margit), Patients' families (Delphine), Hospital board (Alistair).

**Outside places**

| Place                                    | Role                                           |
| ---------------------------------------- | ---------------------------------------------- |
| St. Brendan's Hospital                   | Rival: competes for patients and nurses        |
| Linden Medical Supply                    | Supplier: dressings, drugs, delivery days      |
| Care Quality Inspectorate                | Authority: inspections, ratings                |
| Hospital board and the League of Friends | Money: grants and charity gifts                |
| Linden Echo                              | Press: local paper, loves a waiting-time story |
| The Stethoscope pub                      | After-work spot: pub where shifts end          |

**Meetings and rituals:** Morning handover (daily). Ward round (weekly). Budget review with the director (monthly). Families' forum (quarterly). Annual inspection. Tea trolley at 15:00. A bell for each long-stay patient who goes home.

**House rules**

| Rule             | Options                       | Touches |
| ---------------- | ----------------------------- | ------- |
| Visiting hours   | open / limited / strict       | P S O   |
| Agency staff     | none / limited / unlimited    | M P     |
| Discharge target | gentle / standard / push hard | O S P   |

**Culture seeds:** Caring (the thank-you board). Disciplined (the handover checklist). Humorous (the tea trolley song).

**Signature cards**

Each card names its need. The three answers are one strong, one middle and one weak stance (section 1.6).

| Who              | Need             | Text                                                     | Answers (strong / middle / weak)                                                                  |
| ---------------- | ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Gwen             | Patients treated | "Two nurses called in sick. Night shift is short again." | Hire agency staff `invest`; Ask day staff to stay `cheap_fix`; Close two beds `refuse`            |
| Dr. Chandrasekar | Patients treated | "A new discharge plan could free 4 beds a week."         | Pilot it `invest`; Let Gwen run a two-week trial `delegate`; Ask the nurses `ask_others`          |
| Delphine Harker  | Inspection score | "Families complain about the visiting hours."            | Open the hours `invest`; A tea trolley in the family room `cheap_fix`; Keep them `refuse`         |
| Hamza            | Inspection score | "The medicine fridge log has a gap."                     | Stop and audit `invest`; Fix the paperwork `cheap_fix`; Ask Gwen and the night staff `ask_others` |
| Esme             | Staff morale     | "She made a near-miss error and asks to talk."           | Talk, no blame `invest`; Pair her with Rowan for a month `delegate`; Report it formally `refuse`  |
| Precious         | Inspection score | "The cleaning contract was cut. The sluice is a mess."   | Restore it `invest`; A rota among nurses `cheap_fix`; Complain to the director `ask_others`       |

**Opening threads (week 1).** (1) Short night shift: a **request** from Gwen, need Patients treated, returns every few days if not fixed. (2) Esme's near miss: a **cover-up**, need Staff morale, she asks to talk and the inspection is the clock. (3) Delphine Harker and the visiting hours: a personal **arc**, need Inspection score, her husband died on a ward like this.

**Crises**

1. **Winter flu surge** (O, P): every bed full, staff sick. Stances: `invest`, `cheap_fix`, `ask_others`.
2. **Inspection announced for tomorrow** (S, O): the sluice is not ready. Stances: `invest`, `delegate`, `cheap_fix`.
3. **Power cut at night** (O, S): the backup generator coughs. Stances: `invest`, `ask_others`, `delay`.

**Term goals:** (1) Inspection score 70 or more at the spring inspection. (2) No staff walkout and Staff morale 50 or more for the whole term.

---

## 3. Small-moments deck

About 70% of moments are small life. These lines carry no stakes. The storyteller draws them to fill quiet slots. The code fills `{person}`, `{room}`, `{place}` and `{item}` from the kit. A line may become an ambient line, a grapevine line or a tiny card with one answer.

**People**

- {person} brings cake for their birthday and nobody knows whose it is.
- {person} has a cold and tells everyone it is "just allergies".
- {person} arrives early for the first time in a year.
- {person} learns a new word and uses it all day.
- {person} gets a letter from home and reads it twice.
- {person} wears a new coat and waits to be noticed.
- {person} and {person} swap lunch by mistake.
- {person} hums the same song for three days.
- {person} asks for advice and then does the opposite.
- {person} is promoted in a rumour. They are not.

**Rooms**

- The lights in {room} flicker when someone laughs.
- Someone has put a plant in {room}. It is thriving.
- The door of {room} squeaks, and everyone says it is on purpose.
- {room} smells of fresh paint. Nobody ordered paint.
- A chair in {room} is now "reserved" by a handwritten note.
- {room} is very quiet today.
- The clock in {room} is four minutes late again.
- The radiator in {room} knocks in a rhythm.
- Someone left a scarf in {room}. Three people claim it.
- {room} has a new draught that nobody can find.

**Weather and seasons**

- First frost. {person} slides across the yard like a king.
- A warm spring day. Everyone eats lunch outside.
- Rain drums on the roof of {room} all afternoon.
- Autumn leaves blow into {room} through the open door.
- A thick fog. {person} is late and proud of it.
- Snow on the windowsill. Work slows for a minute.
- A heatwave. {person} brings a fan, then a second fan.
- A rainbow over {place}. Someone takes a photo.
- A strong wind steals a hat from {person}.

**Objects**

- The kettle breaks and a small silence follows.
- A lost glove sits on a hook for a week.
- The coffee machine makes a new noise.
- A stapler goes missing and a feud begins.
- The old radio finds a song from 1987.
- A mug with {person}'s name appears on the shelf.
- The whiteboard has a drawing that nobody admits to.
- A key turns up in the wrong drawer.
- {item} is repaired with tape and hope.

**Animals**

- A stray cat sleeps in {room} and has a name by lunch.
- A bird builds a nest above the door of {room}.
- {person} feeds the gulls and regrets it.
- A dog follows {person} in and will not leave.
- A mouse is spotted. Opinions are divided.
- A spider in {room} is declared staff.
- A fox crosses the yard at dawn.
- The cat is gone for two days. {person} makes posters.

**Romance-lite**

- {person} and {person} share an umbrella. Nobody says anything.
- {person} leaves a note on {person}'s desk. It says only "thanks".
- Two people stand a bit too long at the coffee machine.
- {person} wears their best shirt and does not say why.
- {person} laughs at every joke by {person}.
- A small bunch of flowers appears on a desk.
- {person} walks {person} to the door in the rain.
- A shy hello turns into a long talk in {room}.

**Funny**

- Someone prints 400 copies of the wrong memo.
- {person} is locked out and talks through the window.
- A meeting runs so long that lunch comes to it.
- {person} wins the raffle and loses the ticket.
- The sign says "Wet Floor". {person} checks. It is.
- {person} calls the boss "mum" by mistake.
- A sandwich is stolen. The suspect list has nine names.
- {person} gives a speech to the wrong room.
- Two people wear the same jumper and pretend they do not.
- The fire drill starts during the cake.

---

## 4. Crisis catalog by place family

Each crisis names one main meter type and a list of stances. The storyteller picks a crisis from the family of the kit. The model may rename it. The code keeps the meter type and the stance list. A stance not allowed for the kit follows rule 6 in section 1.4. Severity of a crisis starts at 3.

**Workplace** (office, warehouse, startup, newsroom)

- Power outage at peak time (O); Lost client file or data leak (S); Key client walks away (M); Mass sick leave (P); Surprise audit (S).
- _Sequence: Fire alarm in the main hall._ (1) Alarm: clear the building `invest`, check first `delay`, send the safety lead `delegate`. (2) Smoke in a corridor: shut it off `cheap_fix`, fight it `invest`, call the brigade `ask_others`. (3) The press arrives: give a statement `ask_others`, no comment `refuse`, offer a tour `invest`.

**School** (school, university, academy, magic school)

- Exam paper leak (O); Student protest (P); Flu outbreak (P); Scandal in the paper (S); Funding cut (M).
- _Sequence: Fire in the lab._ (1) Smoke: evacuate `invest`, send a teacher `delegate`, look first `delay`. (2) A student is missing: search the building `invest`, call the roll `cheap_fix`, ask the prefects `ask_others`. (3) Parents at the gate: meet them `ask_others`, a letter `cheap_fix`, close the gate `refuse`.

**Care** (hospital, ward, care home, clinic)

- Winter flu surge (O); Medication mix-up (S); Staff walkout (P); Power cut at night (O); Closure rumour (M).
- _Sequence: Many arrivals after a bus crash._ (1) Beds: clear a bay `invest`, use corridors `cheap_fix`, divert some `refuse`. (2) Staff: call in off-duty nurses `invest`, split the shift `delegate`, ask volunteers `ask_others`. (3) Families crowd the lobby: a family room `invest`, a notice board `cheap_fix`, keep them out `refuse`.

**Hospitality** (hotel, restaurant, inn, cafe)

- Food poisoning claim (S); Health inspector at the door (S); Burst pipe in the dining room (M); Chef quits mid-service (P); Bad review wave (S).
- _Sequence: A wedding with no chef._ (1) The kitchen: cook yourself `invest`, call a rival chef `ask_others`, cut the menu `cheap_fix`. (2) The guests wait: free drinks `invest`, a speech `cheap_fix`, delay the meal `delay`. (3) The bride is upset: a refund `invest`, a free dessert `cheap_fix`, a firm no `refuse`.

**Industrial** (factory, mine, dock, space station)

- Machine breakdown (O); Chemical spill (S); Supplier fails (O); Strike (P); Serious accident (S).
- _Sequence: Boiler alarm._ (1) Pressure rises: shut down the line `invest`, vent it `cheap_fix`, wait and watch `delay`. (2) Workers scared: send them home `invest`, a briefing `ask_others`, keep working `refuse`. (3) The inspector calls: be open `ask_others`, delay the report `delay`, send your lawyer `delegate`.

**Court and kingdom** (king, queen, council, noble house)

- Famine (O); Border raid (S); Noble plot (S); Plague in the city (P); Empty treasury (M).
- _Sequence: The castle gate falls._ (1) Raiders inside: call the guard `decree`, open the armoury `invest`, parley `ask_others`. (2) Panic in the courtyard: martial law `decree`, guide people to the keep `delegate`, a speech `reward`. (3) After the fight: hang the traitors `punish`, pardon the rest `pardon`, banish the leader `banish`.

**Ship and crew** (pirate, merchant, expedition, space crew)

- Navy chase (S); Mutiny whispers (P); Becalmed with water low (O); Storm damage (M); Sickness outbreak (P).
- _Sequence: A storm during a boarding._ (1) Waves rise: cut the lines `cheap_fix`, finish the boarding `invest`, put it to the officers `ask_others`. (2) The mast cracks: all hands and double rum `invest`, the carpenter leads `delegate`, drop sail `cheap_fix`. (3) The prize sinks: save the crew `invest`, save the cargo `cheap_fix`, let it go `refuse`.

**Creative** (film set, studio, esports team, band)

- Star walks off set (P); Leak of the new work (S); Budget overrun (M); Equipment fails during a live show (O); Viral scandal (S).
- _Sequence: The live broadcast breaks._ (1) The feed drops: switch to backup `invest`, stall with a host `cheap_fix`, go off air `refuse`. (2) The star panics: calm them `delegate`, send in the understudy `cheap_fix`, push on `refuse`. (3) Fans angry online: an apology `ask_others`, a joke post `cheap_fix`, silence `delay`.

---

## 5. Traits catalog

Traits are knobs in the Modern Life Sim archetype shape. Each person has 1-2 traits. Speeds are multipliers on a base value (0.5 slow, 1.0 normal, 1.5 fast). Jealousy and drifting are 0-100 scores. `drifting` is the weekly chance that a bond cools if the boss and the person do not meet. `romanceSpeed`, `jealousy` and the love-life events only matter when the Romance story layer is on. Likes are three tags that match gift tastes and scene suggestions. Tone sets the voice sheet style.

| Trait         | friendshipSpeed | romanceSpeed | trustSpeed | jealousy | drifting | Likes                               | Tone            |
| ------------- | --------------- | ------------ | ---------- | -------- | -------- | ----------------------------------- | --------------- |
| faithful      | 1.0             | 0.8          | 1.2        | 30       | 5        | routine, loyalty, sentimental gifts | warm, steady    |
| curious       | 1.3             | 1.1          | 1.0        | 20       | 40       | books, gossip, new places           | quick, asking   |
| jealous       | 1.0             | 1.2          | 0.8        | 80       | 15       | attention, praise, being first      | sharp, hurt     |
| loyal         | 1.1             | 0.9          | 1.3        | 25       | 5        | teamwork, thanks, shared meals      | steady, plain   |
| ambitious     | 0.9             | 0.9          | 0.8        | 50       | 30       | promotion, status, big projects     | crisp, driven   |
| cautious      | 0.8             | 0.7          | 0.9        | 30       | 10       | rules, safety, checklists           | careful, slow   |
| hot-headed    | 1.1             | 1.2          | 0.8        | 55       | 35       | action, honesty, sport              | loud, fast      |
| gossip        | 1.4             | 1.0          | 0.7        | 40       | 50       | news, food, company                 | chatty, warm    |
| perfectionist | 0.8             | 0.8          | 0.9        | 45       | 20       | order, detail, tidy desks           | precise, tense  |
| easygoing     | 1.3             | 1.0          | 1.1        | 15       | 30       | snacks, naps, jokes                 | relaxed, lazy   |
| shy           | 0.6             | 0.7          | 1.0        | 35       | 25       | quiet, notes, small gifts           | soft, short     |
| charming      | 1.4             | 1.4          | 0.9        | 40       | 45       | parties, compliments, style         | smooth, playful |
| stubborn      | 0.8             | 0.8          | 0.8        | 40       | 10       | tradition, being asked first        | blunt, flat     |
| generous      | 1.2             | 1.0          | 1.2        | 20       | 15       | sharing, feasts, giving             | warm, round     |
| frugal        | 0.9             | 0.8          | 1.0        | 35       | 10       | bargains, ledgers, second-hand      | dry, thin       |
| honest        | 1.0             | 0.9          | 1.4        | 30       | 10       | truth, plain talk, fairness         | direct, calm    |
| sly           | 1.1             | 1.2          | 0.6        | 50       | 55       | secrets, leverage, silk             | silky, light    |
| proud         | 0.8             | 0.9          | 0.8        | 60       | 20       | titles, respect, medals             | formal, high    |
| anxious       | 0.9             | 0.8          | 0.8        | 55       | 30       | reassurance, lists, tea             | fretful, fast   |
| romantic      | 1.1             | 1.5          | 1.0        | 50       | 25       | letters, flowers, long walks        | dreamy, soft    |
| loner         | 0.6             | 0.6          | 0.9        | 20       | 60       | solitude, quiet corners, books      | terse, dry      |
| joker         | 1.4             | 1.1          | 0.9        | 20       | 35       | pranks, laughter, nicknames         | playful, quick  |
| strict        | 0.7             | 0.6          | 1.0        | 30       | 10       | order, punctuality, rules           | clipped, firm   |
| dreamy        | 1.0             | 1.2          | 0.9        | 30       | 55       | stars, music, stories               | floaty, soft    |
| brave         | 1.1             | 1.1          | 1.1        | 35       | 25       | challenges, defending friends       | bold, plain     |
| bookish       | 0.8             | 0.8          | 1.1        | 25       | 30       | libraries, quiet talk, tea          | measured, wry   |
| flirty        | 1.3             | 1.5          | 0.7        | 55       | 50       | compliments, dancing, new faces     | teasing, light  |
| vengeful      | 0.8             | 0.8          | 0.6        | 75       | 15       | justice, kept promises, old scores  | cold, slow      |
| nurturing     | 1.3             | 1.0          | 1.3        | 25       | 10       | caring, tea, small kindnesses       | gentle, soft    |
| rebel         | 1.0             | 1.2          | 0.7        | 40       | 55       | freedom, music, breaking rules      | cheeky, loud    |

---

## 6. Ambitions and secrets

### 6.1 Ambitions (20)

Each ambition has a progress bar (0-100). The code moves it with events and decisions. At 100 the person acts: a card, a resignation, a challenge at the board or a quiet thank-you.

1. Take the boss's job (a challenge at the board). 2. Get a raise (asks every month). 3. A quiet life (avoids extra tasks). 4. Leave and start fresh (resignation clock). 5. Run their own team (asks for a department). 6. Win an award (asks for a project). 7. Be listened to (asks for a meeting). 8. Earn a title or a degree (asks for study leave). 9. Open their own business (leaves with a friend). 10. Protect a friend (steps in for a card). 11. Find love (romance cards, if the Romance layer is on). 12. Be famous (asks for press). 13. Keep the old ways (blocks reforms). 14. Change everything (backs reforms, forms a group). 15. See the world (asks for travel or a posting). 16. Pay off a debt (asks for overtime, may steal). 17. Be a mentor (adopts a junior). 18. Hold the power behind the throne (builds a faction). 19. Restore their honour (asks for a hearing). 20. Save the place (works extra, burns out).

### 6.2 Secrets (25)

A secret is learned at trust 60 (or Love 60 for absolute kits), from the grapevine, or in a crisis. It becomes evidence in the drawer. Text uses placeholders for the person, the group and the room.

1. {person} has a debt to {group}. 2. {person} is looking for a job elsewhere. 3. {person} copied a result from a friend. 4. {person} lied on their first form. 5. {person} is secretly writing a book about {place}. 6. {person} has a private bet on every decision you make. 7. {person} is the author of the anonymous notes. 8. {person} takes small gifts from {group}. 9. {person} sleeps in {room} on bad nights. 10. {person} covers for a friend who is not at work. 11. {person} is afraid of the dark and keeps a light in {room}. 12. {person} once took the blame for another. 13. {person} has a twin or a double who sometimes takes their shift. 14. {person} knows where the old key to {room} is. 15. {person} leaks news to the paper. 16. {person} is learning another trade at night. 17. {person} met the rival's boss in private. 18. {person} hid a mistake in the last report. 19. {person} lent money to a colleague and wants it back. 20. {person} keeps a list of everyone's birthdays and gives gifts in secret. 21. {person} is not who they say they are (an old name, an old job). 22. {person} wants to quit the group they lead. 23. {person} took credit for another's idea. 24. {person} is quietly in love with someone at {place}. 25. {person} has saved far more money than they admit.

---

## 7. Culture tags and tradition seeds

### 7.1 Culture tags (10)

The code adds a point to a tag when a type of decision repeats (3 in a row, or 5 in 8 weeks). A tag at 3 points is **active**. Only 3 tags can be active. Two opposite tags cancel.

| Tag          | Grows from                             | Changes                                                                        |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------------ |
| Family       | `invest`, `reward`, `pardon` for staff | More small moments about care. Newcomers join faster. Firing costs more Trust. |
| Cutthroat    | `punish`, `refuse`, `banish`           | Output +2 a week. People -1 a week. More rival and backstab cards.             |
| Chaotic      | `delay`, `cheap_fix`, `delegate`       | More surprises. Crisis chance +10%. Fewer meetings finish on time.             |
| Strict       | `decree`, `punish`                     | Fewer small moments. Rule cards drop. Fear rises in absolute kits.             |
| Scholarly    | `invest` in Output rooms, `ask_others` | Output cards give a bonus. Library and lab rooms wear slower.                  |
| Festive      | many traditions and events             | Standing +1 a week. Money -1 a week. More party moments.                       |
| Frugal       | `cheap_fix`, `refuse` on money         | Money +1 a week. Room wear +10% faster.                                        |
| Secretive    | covered-up scandals, `delay` on press  | More grapevine lies. Press cards hit harder.                                   |
| Honour-bound | `pardon`, `reward`, kept promises      | Evidence loses power. Vows come more often.                                    |
| Free         | `ask_others`, no house rules           | People +1 a week. Fewer decree options. More rebel cards.                      |

### 7.2 Tradition seeds (15)

A tradition begins as an event that repeats 3 times. The generator may also give a kit these seeds. Stopping a tradition costs People -6 and a card of protest.

1. A Friday treat for everyone. 2. A name for every new machine or room. 3. The "Thing of the Month" trophy. 4. A first-day tour led by the newest person. 5. A song or toast before every big event. 6. A winter lantern walk. 7. A yearly photo of everyone on the steps. 8. A shared meal on the last day of the month. 9. A "thank-you wall" of notes. 10. A mascot dressed for each season. 11. Speeches at the start of the week. 12. A farewell gift for everyone who leaves. 13. A secret handshake for the old hands. 14. A yearly prank on the boss. 15. A quiet minute for those who are gone.

---

## 8. Perks (20)

The player picks one perk after each term. Each perk gives a flat effect and unlocks or improves a stance.

| Perk               | Effect                                           | Stance                           |
| ------------------ | ------------------------------------------------ | -------------------------------- |
| Negotiator         | Meetings start with +1 support                   | improves `ask_others`            |
| Penny-pincher      | `cheap_fix` costs 25% less Output                | improves `cheap_fix`             |
| Good listener      | "Talk it through" always unlocks a better answer | improves `ask_others`            |
| Iron hand          | `decree` has half the Love loss                  | improves `decree`                |
| Silver tongue      | `refuse` costs half the Trust                    | improves `refuse`                |
| Builder            | `invest` in rooms is 15% cheaper                 | improves `invest`                |
| Trusted deputy     | `delegate` always works at severity 1            | improves `delegate`              |
| Fair judge         | `punish` gives no Legitimacy loss                | improves `punish`                |
| Open heart         | `pardon` Love gain +4                            | improves `pardon`                |
| Generous host      | `reward` costs 20% less                          | improves `reward`                |
| Eye for talent     | `appoint` first test is always passed once       | improves `appoint`               |
| Long breath        | `delay` follow-up chance -15%                    | improves `delay`                 |
| Early bird         | +1 hour on Monday                                | unlocks extra answers            |
| Thick skin         | Boss Stress rises 30% slower                     | none                             |
| Press friend       | Press cards hit 25% softer                       | improves `refuse` on press cards |
| Lucky streak       | One crisis per term starts at severity 2         | none                             |
| Master of ceremony | Rituals give +2 People                           | unlocks ritual answers           |
| Spy network        | One free secret reveal per term                  | unlocks evidence play            |
| Peacemaker         | Feuds fade 2x faster                             | improves `ask_others`            |
| Steady hand        | Meters wear 15% slower in the Friday report      | none                             |

---

## 9. Term goals (25)

The player gets 5 offers per term and picks 3. Goals use meter types, so any label fits. "Any" means all authority levels.

| Goal                                           | Type | Authority        |
| ---------------------------------------------- | ---- | ---------------- |
| Money at 60 or more at term end                | M    | Any              |
| Never let Money drop below 20                  | M    | Manager, Strong  |
| Repay a loan on time                           | M    | Any              |
| Raise Money by 15 over the term                | M    | Any              |
| Stay in the black for 6 weeks in a row         | M    | Manager, Strong  |
| Fill the treasury before the festival          | M    | Absolute         |
| Output at 65 or more at term end               | O    | Any              |
| Raise Output by 15 over the term               | O    | Any              |
| Finish a big project (the flagship card chain) | O    | Any              |
| No missed deadline for 6 weeks                 | O    | Manager, Strong  |
| Win the yearly contest or tournament           | O    | Strong, Absolute |
| People at 60 or more at term end               | P    | Any              |
| No strike, walkout or revolt                   | P    | Any              |
| Keep all key people for the whole term         | P    | Manager, Strong  |
| Hold 3 traditions alive                        | P    | Any              |
| Hold 5 meetings that end in agreement          | P    | Manager, Strong  |
| Keep Love at 50 and Fear below 60              | P    | Absolute         |
| Standing at 65 or more at term end             | S    | Any              |
| Pass the next inspection with a high score     | S    | Manager, Strong  |
| Get good press three weeks in a row            | S    | Any              |
| Beat the rival in a head-to-head event         | S    | Any              |
| Keep Legitimacy at 60 or more                  | S    | Absolute         |
| Finish without a cover-up coming back          | S    | Any              |
| Raise one person to a leading role (mentoring) | P    | Any              |
| Name an heir or a successor                    | S    | Strong, Absolute |

---

## 10. Endings and achievements

### 10.1 Endings (15)

Each ending is a title card with an epilogue. The model fills the template with real names and memories.

| Ending         | Trigger                                                                                | Epilogue template                                                                             |
| -------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Win the year   | 3 term goals met                                                                       | "{boss} led {place} for a full year. {deputy} gave a speech. {tradition} grew into a custom." |
| Fired          | Lost a board hearing (a meter under 10 on a second Friday, see [design.md](design.md)) | "The board thanked {boss} and sent a box for the desk. {deputy} took the keys."               |
| Voted out      | Lost a board hearing, or a crew vote                                                   | "{deputy} won by {n} votes. {boss} left by the side door."                                    |
| Quit           | The player leaves                                                                      | "{boss} walked out at noon. {person} still keeps their mug."                                  |
| Sold the place | The player sells                                                                       | "{place} got a new name. {person} cried, then asked for a raise."                             |
| Overthrown     | Legitimacy at 0 and a revolt                                                           | "The gates opened from inside. {person} read the new decree."                                 |
| Coup           | Enforcer plot wins                                                                     | "{enforcer} held the keys at dawn. {boss} left with one bag."                                 |
| Marooned       | Lost a crew hearing on a ship                                                          | "They left {boss} on a small island with a flag and a bottle."                                |
| School closed  | Ministry or board shuts it                                                             | "{place} closed in spring. {person} kept the bell."                                           |
| Abdication     | The player steps down                                                                  | "{boss} handed the crown to {heir}. The feast lasted three days."                             |
| Promoted away  | Top-level success                                                                      | "{boss} moved up. {deputy} inherited a good place and a bad habit."                           |
| Merger         | A rival buys the place                                                                 | "{place} became part of {rival}. {person} liked the new coffee."                              |
| Burnout        | Boss Stress at 100 for 2 weeks                                                         | "{boss} took a long rest. The place ran on without them."                                     |
| Scandal        | A cover-up comes back and Standing falls                                               | "The paper ran the story on page one. {boss} said nothing for a week."                        |
| Legend         | All meters above 70 for 8 weeks                                                        | "People still talk about {boss}. A plaque hangs in {room}."                                   |

### 10.2 Achievements (46)

1. Fired in week 2. 2. Everyone came to your farewell. 3. The first coffee machine you broke. 4. Said "let me think about it" 20 times. 5. Refused every card in a week. 6. Answered every card the same day. 7. Won the Friday raffle as the boss. 8. Gave a speech that ended early. 9. Pardoned the same person three times. 10. Learned a secret and kept it. 11. Learned a secret and told the room. 12. Survived a crisis with no meter below 40. 13. Lost a vote by one voice. 14. Won a vote by one voice. 15. Hired a person nobody liked. 16. Fired a person everybody liked. 17. Built a room that nobody uses. 18. Visited every room in one day. 19. Got a gift from a rival. 20. Gave a gift to a rival. 21. Had a plant named after you. 22. Cancelled a tradition and stayed alive. 23. Created a tradition by accident. 24. Delegated everything and went home early. 25. Spent your whole budget on cake. 26. Cleaned a room yourself. 27. Told a joke and the room laughed. 28. Told a joke and the room did not laugh. 29. Heard a rumour about yourself that was true. 30. Beat the rival in a week. 31. Avoided a strike by one phone call. 32. Held a meeting that ended on time. 33. Let a cat run the place for a day. 34. Used three wishes in one term. 35. Made a deputy cry in a good way. 36. Had a perfect Friday report. 37. Had a terrible Friday report and a good Monday. 38. Wore the wrong hat to a ceremony. 39. Was late to your own party. 40. Closed the place and opened it again. 41. Won a board hearing. 42. Won a hearing with one vote. 43. Typed an answer that nobody offered. 44. Kept a promise that was due on Friday. 45. Closed a cover-up thread before the paper found it. 46. Read every _Letters from the last boss_ letter on its day.

---

## 11. House rules library (25)

Each rule has options. The code sets the weekly meter effect from the option. Changing a rule costs 1 hour. Own-words rules are mapped to a type from this list.

| Rule                | Family                | Options                                 | Touches |
| ------------------- | --------------------- | --------------------------------------- | ------- |
| Night-shift bonus   | workplace, industrial | none / small / large                    | M P O   |
| Phones on the floor | workplace, school     | banned / breaks only / free             | O P     |
| Overtime            | workplace, industrial | voluntary / paid / expected             | M O P   |
| Dress code          | workplace, school     | casual / smart / uniform                | P S     |
| Open-door hours     | workplace             | none / weekly / daily                   | P S     |
| Friday early finish | workplace             | no / once a month / every week          | O P     |
| Quarterly bonus     | workplace             | none / team / top few                   | M P     |
| Tuition level       | school                | low / standard / high                   | M P S   |
| Library hours       | school                | short / long / all night in exams       | O P M   |
| Attendance rule     | school                | relaxed / checked / strict              | O P     |
| Grading style       | school                | gentle / fair / hard                    | O S P   |
| Curfew              | school, court         | none / early night / lock-in            | P O     |
| Visiting hours      | care                  | open / limited / strict                 | P S O   |
| Agency staff        | care                  | none / limited / unlimited              | M P     |
| Discharge target    | care                  | gentle / standard / push hard           | O S P   |
| Menu size           | hospitality           | short / usual / grand                   | M O     |
| Tipping rule        | hospitality           | pooled / split / own                    | P M     |
| Guest complaints    | hospitality           | refund / apology / defend               | M S     |
| Safety walk         | industrial            | monthly / weekly / daily                | S O P   |
| Machine rest days   | industrial            | rare / planned / often                  | O M     |
| Grain tax           | court                 | light / standard / heavy                | M P O   |
| Hunting rights      | court                 | commons / nobles / king only            | P S     |
| Petition day        | court                 | daily / weekly / never                  | P S     |
| Share-out           | ship                  | equal / officers double / captain's cut | M P S   |
| Rum ration          | ship                  | free pour / ration / dry                | P O     |

---

## 12. Wish examples (30)

Wishes ask the storyteller for something. They arrive in their own way within 1-2 weeks. A wish never sets a number. Romance wishes need the Romance story layer.

| Type        | Wish                                                | Arrives as                                |
| ----------- | --------------------------------------------------- | ----------------------------------------- |
| New person  | "A famous chef who wants to hide in a small place"  | A visitor card, then a hire offer         |
| New person  | "A retired boss who knew the old days"              | A mentor visit with a secret              |
| New person  | "A sharp young apprentice with a bad attitude"      | A hire card and a feud with the veteran   |
| New person  | "A wandering healer"                                | A visitor who fixes one stress case       |
| New person  | "A rival's spy who wants to quit"                   | A late-night meeting and an offer         |
| Crisis      | "A flood on the lowest floor"                       | A room-condition crisis with 3 answers    |
| Crisis      | "A sudden strike"                                   | A union card and a short sequence         |
| Crisis      | "A loud inspector with a bad temper"                | An authority visit with a checklist       |
| Crisis      | "A bad rumour about the kitchen"                    | A grapevine card and a press story        |
| Crisis      | "A broken machine in the busiest week"              | An equipment crisis                       |
| Romance     | "Two quiet people finally talk"                     | A romance-lite moment, then a small card  |
| Romance     | "A love letter that goes to the wrong desk"         | A comic card with two answers             |
| Romance     | "A jealous partner visits"                          | A visitor scene and a trust choice        |
| Romance     | "A shy person asks the boss for advice about love"  | A scene with three suggestions            |
| Romance     | "A wedding at the place"                            | A calendar event and a mini-scene         |
| Lucky break | "A rich old graduate wants to donate, with strings" | A money card with a condition             |
| Lucky break | "A good review in the paper"                        | A press card and a Standing gain          |
| Lucky break | "A free shipment turns up"                          | A stock card with a catch                 |
| Lucky break | "A star talent asks to join"                        | A hire card with a high price             |
| Lucky break | "A sunny week with no problems"                     | Three quiet days and one kind surprise    |
| Rival move  | "The rival opens a bigger place nearby"             | A rival card and a poaching threat        |
| Rival move  | "The rival offers a merger"                         | A negotiation scene                       |
| Rival move  | "The rival tells a lie about us"                    | A press card and an evidence chance       |
| Rival move  | "The rival steals our best person"                  | A resignation card with a counter offer   |
| Rival move  | "The rival asks for a truce"                        | A meeting at the neutral spot             |
| Room        | "A rooftop garden"                                  | A Building card with a cost and an effect |
| Room        | "A quiet reading room"                              | A new social room that helps People       |
| Room        | "A secret cellar bar"                               | A hidden room with a key and a risk       |
| Room        | "A bigger kitchen"                                  | A work room that helps Output             |
| Room        | "A lookout tower"                                   | A hidden room that helps Standing         |

---

## 13. Meeting types (12)

Support in the room is counted by code. For each attendee: **score** = (Trust or Love - 50) / 5 + stance fit (-3 to +3, from their traits and ambition) + faction bonus (-2 to +2). The agreement passes at a total of 0 or more. A vote passes at more than half of attendees with a score above 0. Evidence cards add +3 to one side. The player picks a suggested line or types one, and the model tags it with a stance.

| Meeting                      | Attendees                                         | Agenda sources                                | Outcomes                                       |
| ---------------------------- | ------------------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| Board meeting                | 4-6 board members, deputy                         | Open term goals, money cards, deputy's agenda | Vote: backed, warned, or removed               |
| All-hands                    | 5-6 staff leads                                   | Open cards, small moments, rule changes       | Agreement: new rule, praise, or tension        |
| Union talks                  | Union rep, 2 staff, deputy                        | Pay, hours, safety cards                      | Agreement, strike notice, or a deal            |
| Safety audit                 | Safety lead, inspector, 2 leads                   | Room condition, equipment                     | Pass, warning, or a fine                       |
| Investor pitch               | 3 investors, deputy                               | Money cards, term goals                       | Vote: funded, loan, or refused                 |
| Parent or family forum       | 3-5 family reps, a lead                           | Complaint cards, press                        | Agreement: promises or a protest               |
| Senate or faculty meeting    | 4-6 senior staff                                  | Policy cards, rival moves                     | Vote: reform passes, delays, or splits         |
| Royal council                | Chancellor, marshal, bishop, spymaster, treasurer | Petition cards, rival kingdoms                | Decree advice: accept, split, or plot          |
| Crew vote (the Article)      | Quartermaster, officers, crew reps                | Share-out, route, discipline                  | Vote: captain backed, changed, or marooned     |
| Prefects' report             | Head prefect, wardens, deputy                     | Rule breakers, secret societies               | Verdicts and orders for punishments or pardons |
| Handover or morning briefing | Shift leads                                       | Overnight cards, ambient news                 | Agreement: plans for the day, small mood boost |
| Negotiation with outsiders   | Outside rep, deputy, 1-2 staff                    | Supplier, rival, authority cards              | Agreement with hidden limits, or walk-away     |

---

## 14. Thread seeds

A thread seed is a small plan the storyteller can open (design.md §3). Each seed has a kind, a need meter, the stakes and the usual beats. The code fills the people and rooms from the kit. A thread has 3-5 beats. The storyteller keeps 5-8 threads open. A romance seed needs the Romance layer.

Kinds: **request**, **arc**, **crisis**, **mystery**, **promise**, **cover-up**, **project**, **wish**. In code they are the design.md §3.2 kinds: a request is `follow_up`, an arc is `personal_arc`, a cover-up is `cover_up`, and the others keep their names. The kit opening threads in section 2 use the same words.

| #   | Seed                                             | Kind     | Need | Stakes                                   | Typical beats                                                               |
| --- | ------------------------------------------------ | -------- | ---- | ---------------------------------------- | --------------------------------------------------------------------------- |
| 1   | {person} asks for a small thing "just this once" | request  | P    | A refusal makes {person} ask their group | Ask; reminder; the group hears; a thank-you or a quiet grudge               |
| 2   | The missing key to {room}                        | mystery  | S    | A hidden room opens to the wrong hands   | Door found open; two people blame each other; the key turns up; who used it |
| 3   | Someone takes from the pantry or the stores      | mystery  | P    | Trust between friends                    | A gap; a suspect; a witness who will not talk; the real reason              |
| 4   | The near miss that nobody logged                 | cover-up | S    | Press and inspector                      | A rumour; a witness; the inspector asks; admit or hide                      |
| 5   | "I will look at it after the audit"              | promise  | P    | A broken promise costs Trust and spreads | The promise; a reminder; the due week; kept, late or broken                 |
| 6   | The shy one asks for a chance                    | arc      | P    | A person grows or leaves                 | A small ask; a test; a setback; a post, a thanks or a goodbye               |
| 7   | {person} and {person} stop talking               | arc      | P    | A feud splits two groups                 | A cold lunch; a side is taken; a meeting; peace or a split                  |
| 8   | A rival offers {person} a better job             | crisis   | O    | The best person may leave                | An offer; a rumour; a counter-offer card; stay or go                        |
| 9   | Storm, flood or power cut                        | crisis   | O    | A room is lost for weeks                 | The warning; the hit; the choice of what to save; the repair bill           |
| 10  | A rich visitor with strings                      | request  | M    | Money now, a promise later               | The offer; the condition; a meeting; take it or not                         |
| 11  | The inspector's list                             | project  | S    | A score and a fine                       | The notice; the checklist; fix three things; the visit                      |
| 12  | A new room for {place}                           | project  | O    | A cost now, an effect for months         | The plan; the bill; a delay; the opening and a small party                  |
| 13  | A rumour about the boss                          | mystery  | S    | Standing and the deputy's chance         | A whisper; the source; evidence in the drawer; a speech or silence          |
| 14  | The old tradition is in danger                   | request  | P    | People -6 if stopped                     | A complaint; a vote; a rescue plan; a party or a farewell                   |
| 15  | {person} has a hidden debt                       | cover-up | M    | Theft or a quiet resignation             | A sign; a loan offer; the truth; help or exposure                           |
| 16  | A wish: "a rooftop garden"                       | wish     | P    | A new place that helps People            | The wish; a planner; a cost card; the garden or a flop                      |
| 17  | The anonymous notes                              | mystery  | P    | The author may be a friend               | First note; second note; a guess; the author named or protected             |
| 18  | Two adults share an umbrella                     | arc      | P    | A romance-lite moment (Romance layer)    | A look; a note; a shy talk; a small choice for the boss                     |
