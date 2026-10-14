// The splash screen needs the shipped version and its public notes inside the client bundle.
export const SLURP2_VERSION = "0.3.40";

export interface Slurp2ReleaseEntry {
  version: string;
  date: string;
  notes: string[];
}

/**
 * The public release history shown in the "What's new" sheet. Newest first; at most 3 player-facing,
 * in-universe bullets per release (technical detail lives in CHANGELOG.md).
 */
export const SLURP2_RELEASES: Slurp2ReleaseEntry[] = [
  {
    version: "0.3.40",
    date: "2026-10-14",
    notes: [
      "Creators are he, she or they from their gender, in dramas, chats and scenes.",
      "A new clothing style decides whether a spicy shoot is lingerie or briefs. Auto follows gender.",
    ],
  },
  {
    version: "0.3.39",
    date: "2026-10-14",
    notes: ["On Android, picking a post picture opens the full file browser, so every folder is reachable."],
  },
  {
    version: "0.3.38",
    date: "2026-10-13",
    notes: ["A creator whose card has image tags gets a button that uses them as her picture appearance."],
  },
  {
    version: "0.3.37",
    date: "2026-10-13",
    notes: [
      "With Claude (Subscription) on Marinara newer than 2.5.0, Slurp no longer sends your account email or computer details to the model.",
    ],
  },
  {
    version: "0.3.36",
    date: "2026-10-13",
    notes: [
      "A creator's bio and stage voice now steer what she posts about, so a hobby in her bio shows up in her feed.",
    ],
  },
  {
    version: "0.3.35",
    date: "2026-10-13",
    notes: ["Adding a creator now lets you decide, up front, whether the picture model already knows the character."],
  },
  {
    version: "0.3.34",
    date: "2026-10-13",
    notes: [
      "In chat, a creator now remembers what is inside her own locked posts, and your lorebook entries reach her replies.",
    ],
  },
  {
    version: "0.3.33",
    date: "2026-10-13",
    notes: [
      "Pictures and helpers now respect the max tokens you set on your connection, so thinking models no longer run dry before they answer.",
    ],
  },
  {
    version: "0.3.32",
    date: "2026-10-13",
    notes: [
      "A long look on a page no longer pushes the scene out of its picture, and a look's own words no longer get a picture's wording thrown away.",
    ],
  },
  {
    version: "0.3.31",
    date: "2026-10-13",
    notes: [
      "New post has one switch: “Write it myself” or “Guided”. Guided writes a real post for the page: title, text and a picture of its own, in the page's voice.",
      "Add your own photo on top and Guided writes the text to go with it. You can also add a storyline, a saved idea or a wardrobe look from Slurp.",
      "The draft lands straight in the post, where you can change anything before you post.",
    ],
  },
  {
    version: "0.3.30",
    date: "2026-10-12",
    notes: [
      "Write, Improve and the guided post now sound like the Creator even when their identity is hidden or hinted. Their real name still stays out.",
      "They also read the page's bio and stage voice, the way a normal post does.",
    ],
  },
  {
    version: "0.3.29",
    date: "2026-10-12",
    notes: [
      "When a picture's description can't be polished, the server log now names the reason, so connection trouble is easier to spot.",
    ],
  },
  {
    version: "0.3.28",
    date: "2026-10-12",
    notes: [
      "Hold a Creator's chat message and pick “Deep details” to see what went into that reply: where the two of you stand, what they remembered, and everything they were told.",
      "Slurp keeps this for the newest 50 replies of each chat.",
    ],
  },
  {
    version: "0.3.27",
    date: "2026-10-12",
    notes: [
      "Each Creator's Posting settings now show their Page style in plain words. Not sure it fits? “Suggest from card” proposes one; nothing changes until you choose Use.",
    ],
  },
  {
    version: "0.3.26",
    date: "2026-10-12",
    notes: [
      "Creators stay themselves: what is always true about them (how they talk, what they can and cannot do, their firm limits) is now in every post, Story and chat, not just some.",
      "Your fixes to a Creator's Life details now stay when their card changes. There is a new “Always true” list there too.",
    ],
  },
  {
    version: "0.3.25",
    date: "2026-10-12",
    notes: [
      "Enhance image prompts now understands more of the answers it gets, so fewer pictures fall back to the plain draft.",
      "With the AI budget off or used up for the day, pictures go out with their full draft and the log stays quiet.",
    ],
  },
  {
    version: "0.3.24",
    date: "2026-10-11",
    notes: [
      "In a picture with two Creators, each one is now described on their own, by name, so the second person stops borrowing the first one's features.",
    ],
  },
  {
    version: "0.3.23",
    date: "2026-10-11",
    notes: [
      "A known character's name now sits after your style tags and in front of their look in picture prompts, so pictures with two people mix them up less.",
    ],
  },
  {
    version: "0.3.22",
    date: "2026-10-11",
    notes: [
      "Backups now include reports.",
      "Create posts now says which Creators it skipped or could not post for, not just how many.",
      "The settings search box now stays reachable on a phone inside a settings section.",
    ],
  },
  {
    version: "0.3.21",
    date: "2026-10-11",
    notes: [
      "Stir follows a collab you start: Recent plays shows whether they are still talking it over, agreed, said no, or posted, and opens the joint post once it is up.",
    ],
  },
  {
    version: "0.3.20",
    date: "2026-10-10",
    notes: [
      "Choose what a breakup leaves behind: the usual history, Move on while remembering, or Forget the relationship. Stir can also help existing exes move on or forget. Old posts and messages stay.",
    ],
  },
  {
    version: "0.3.19",
    date: "2026-10-10",
    notes: [
      "New in Settings › Messaging: Stop after one unanswered text. A Creator writes first once, then waits for you to actually reply before writing first again.",
    ],
  },
  {
    version: "0.3.18",
    date: "2026-10-08",
    notes: [
      "Wardrobe looks and character cards understand Marinara macros: write {{random::red::green::blue}} dress and each post picks one.",
      "Creators recycle a photo at most once now. Settings › Publishing › Picture reuse turns it down or off.",
    ],
  },
  {
    version: "0.3.17",
    date: "2026-10-06",
    notes: [
      "Spice lives in one place now: one level from Clean to Explicit for words and pictures, and a new Language choice for how they say it. Set it for everyone in Settings › Spice, or per Creator.",
      "Decide who may fall for whom: switch romance off for a Creator, or pick who they could end up with. Collab partners finally know who they are working with.",
      "Slurp is quicker on phones and desktop, Stir's End it and collab buttons work, and opening a profile no longer marks your chat as read.",
    ],
  },
  {
    version: "0.3.16",
    date: "2026-10-05",
    notes: [
      "Stir on your page, or Draft post for a Creator, uses one idea to draft a post. Review its words and picture together, then Post; Edit opens the full editor.",
    ],
  },
  {
    version: "0.3.15",
    date: "2026-10-05",
    notes: [
      "Take a Creator chat into a scene. Choose whether she stays reachable, then bring the memory back to your messages when you finish.",
      "Give New post an idea and review the drafted caption and picture before posting, on your own page or a Creator page.",
    ],
  },
  {
    version: "0.3.12",
    date: "2026-10-01",
    notes: ["Slurp no longer fills your Engine log with warnings when no text connection is set."],
  },
  {
    version: "0.3.11",
    date: "2026-10-01",
    notes: [
      "A Creator can fall for you in your chats: a crush, dating, official, fights and making up. She calls you her boyfriend or girlfriend, sends you pictures for free, invites you on dates and keeps it secret if you want.",
      "Stir is rebuilt around stories: your relationship on top, everything running in one list, and drama packs you can start, lead and end.",
      "Fans leave notes on your own page instead of chats, and Settings › Overview can pause all of Slurp.",
    ],
  },
  {
    version: "0.3.10",
    date: "2026-09-30",
    notes: [
      "If Slurp cannot open on another device because Marinara is missing its Admin Secret, Slurp now tells you how to set one.",
    ],
  },
  {
    version: "0.3.8",
    date: "2026-09-30",
    notes: [
      "Drama, if you switch it on: your partner as a Creator, rivals, love triangles, a top fan, sugar both ways and more, played out on the feed, in DMs and in the comments.",
      "Creators make friends on their own now, and the friends, roommates, coworkers and exes on their cards are real on Slurp.",
      "Stir has a living People map: open several people at once to see partners, friends, exes, rivals and roommates, and why each tie exists.",
    ],
  },
  {
    version: "0.3.7",
    date: "2026-09-30",
    notes: [
      "Creator earnings are now shown in dollars and more fans subscribe. Collect turns earnings into SlurpCoins, with one daily limit.",
      "Couple and collab posts can show the partner too, and fan messages get their rewrite sooner.",
      "Choose how long fans think about a quote, write your own first lines, and blur every picture until you tap it.",
    ],
  },
  {
    version: "0.3.6",
    date: "2026-09-30",
    notes: [
      "Slurp opens, scrolls and switches tabs faster, and a fast scroll on a phone no longer shows black gaps.",
      "What you ask for never uses the AI budget. Only what the world writes on its own counts, with one switch and one slider.",
      "Slurp Support gets real staff tools: attach or order an image, link a post or Story, or ask for photo verification.",
    ],
  },
  {
    version: "0.3.5",
    date: "2026-09-29",
    notes: [
      "Slurp Support has a desk in Stir: every Creator's trust and suspicion, perks, challenges, contracts, favours, and the shady moves that can get you caught.",
      "In a Support chat you can make offers they answer, give perks, warn, plant rumours and keep notes only you see. With Settings › Stir, Creators can even write in on their own.",
      "Polyamory, if you turn it on: couples of three or four, and polyamorous Creators in more than one couple. Each Creator is monogamous or polyamorous.",
    ],
  },
  {
    version: "0.3.4",
    date: "2026-09-29",
    notes: [
      "Creators have Pages now: a collage of their best pictures, lists, a quote, prices and their people, in a look of their own, right above their posts.",
      "New Creators design their own Page. For the others, tap “Let them design it”, or build it yourself with six looks and ten kinds of blocks.",
      "Stir can do more: start a storyline, give someone a new look, set a tip goal or make up an event, and undo anything from Recent plays.",
    ],
  },
  {
    version: "0.3.3",
    date: "2026-09-29",
    notes: ["Slurp is just Slurp now: the old version is retired and this one carries the name."],
  },
  {
    version: "0.3.2",
    date: "2026-09-29",
    notes: [
      "Home, profiles and the feed load again when fans from your cast are in the audience.",
      "Start over and Stir work again.",
    ],
  },
  {
    version: "0.3.1",
    date: "2026-09-29",
    notes: [
      "An empty feed now says why, and turns on automatic posting in one tap when that is the reason.",
      "Slurp stuck or empty after an update? Backstage › Start over clears posts and messages and keeps your Creators and settings.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-09-29",
    notes: [
      "Small changes. Stir is new: make crushes, collabs, rivalries and events happen between your Creators, and see what happens before you say Do it.",
      "Slurp got a whole new look, chats feel real (fans sometimes get answers, and promises arrive), and Pulse shows what runs, what failed and what comes next.",
      "The AI budget now grows with your Creators. Lower it any time under Fans & money › AI budget.",
    ],
  },
  {
    version: "0.2.78",
    date: "2026-09-27",
    notes: ["A fresh look for G’s introduction and a clearer reminder about background generation costs."],
  },
  {
    version: "0.2.77",
    date: "2026-09-27",
    notes: [
      "G is back on the update screen, animated face and all.",
      "Details edit mode remembers your choice; switching it off keeps your saved edits.",
    ],
  },
  {
    version: "0.2.76",
    date: "2026-09-27",
    notes: ["Edit conversation details inline, including numbers, options and context."],
  },
  {
    version: "0.2.75",
    date: "2026-09-26",
    notes: [
      "Fewer selfies and mirror shots, more candid photos taken by a friend.",
      "The phone stays out of the picture, and Creators no longer show up twice.",
      "Creators copy each other's outfits and rooms less, with more places and moments.",
    ],
  },
  {
    version: "0.2.74",
    date: "2026-09-26",
    notes: [
      "Settings are easier to scan: one row per setting, with its control on the right.",
      "New page names: Connections, Storylines and Writing.",
      "On a phone, Settings open on a list of sections.",
    ],
  },
  {
    version: "0.2.73",
    date: "2026-09-26",
    notes: [
      "Creators reply right away when you message or tip them.",
      "Your own messages and tips no longer count against your AI connection's budget.",
    ],
  },
  {
    version: "0.2.72",
    date: "2026-09-26",
    notes: [
      "Settings pages show their current values as chips under the title.",
      "Tap a chip to jump straight to that setting.",
      "Creator settings tabs with several parts start with a Jump to row.",
    ],
  },
  {
    version: "0.2.71",
    date: "2026-09-25",
    notes: [
      "Number settings are sliders that save when you let go.",
      "Posts per day and similar counts have plus and minus buttons.",
      "Reply delays in Messaging are simple min and max rows.",
    ],
  },
  {
    version: "0.2.70",
    date: "2026-09-25",
    notes: [
      "Settings sections follow the order you use them, from Overview to Maintenance.",
      "Related pages sit together, like Fans & money and World.",
      "Old links still open the right page.",
    ],
  },
  {
    version: "0.2.69",
    date: "2026-09-25",
    notes: [
      "A Creator's posting schedule is a day list: change a post's time right where it is.",
      "Another day moves a post to a new day, and the Save buttons are gone.",
    ],
  },
  {
    version: "0.2.68",
    date: "2026-09-25",
    notes: [
      "Creator settings open on an Overview: what needs review, the next post and more.",
      "Turn Auto-post on or off right from the Overview.",
    ],
  },
  {
    version: "0.2.67",
    date: "2026-09-25",
    notes: [
      "Creator settings have 7 tabs instead of 14, grouped by task.",
      "Old links open the new tab at the right spot.",
    ],
  },
  {
    version: "0.2.66",
    date: "2026-09-25",
    notes: [
      "Many settings are tap-to-pick buttons instead of dropdowns.",
      "Folded blocks in Settings all look the same and show how many settings they hold.",
      "The Set Slurp's pace wizard is gone; the preset cards do the same job.",
    ],
  },
  {
    version: "0.2.65",
    date: "2026-09-25",
    notes: [
      "Life details in a Creator's Memory tab are chips: type to add, tap the cross to remove.",
      "Note filters fold away behind the search box and show how many are on.",
    ],
  },
  {
    version: "0.2.64",
    date: "2026-09-25",
    notes: [
      "A Creator's Storylines tab follows Slurp's settings unless you turn on Own value.",
      "Pick storyline types for one Creator with tappable chips.",
    ],
  },
  {
    version: "0.2.63",
    date: "2026-09-25",
    notes: [
      "Storylines settings show every choice at once, with preset cards and button rows.",
      "Audience settings use the same button rows.",
    ],
  },
  {
    version: "0.2.62",
    date: "2026-09-25",
    notes: [
      "The Identity tab in Creator settings uses the full width again.",
      "Memory shows readable names instead of raw codes.",
    ],
  },
  {
    version: "0.2.61",
    date: "2026-09-25",
    notes: ["The Creator settings window no longer shows a placeholder title while it loads."],
  },
  {
    version: "0.2.60",
    date: "2026-09-25",
    notes: ["Storyline buttons in Posting and the Calendar open the new Storylines page."],
  },
  {
    version: "0.2.59",
    date: "2026-09-25",
    notes: [
      "New Story activity presets: Calm, Lively or Hands-off, set in one tap.",
      "Creator settings have a Storylines tab for that Creator's own storyline rules.",
    ],
  },
  {
    version: "0.2.58",
    date: "2026-09-25",
    notes: [
      "Settings are easier to find, with a new Storylines page and a What gets posted group.",
      "Settings that do nothing right now stay visible and say why.",
    ],
  },
  {
    version: "0.2.57",
    date: "2026-09-25",
    notes: [
      "Clearer names in Settings: arcs are now storylines, and occasions are now events.",
      "Several help texts are fixed and now say what the setting really does.",
    ],
  },
  {
    version: "0.2.56",
    date: "2026-09-25",
    notes: [
      "Creators keep their limits and saved notes in mind, even after weeks of posting.",
      "Fewer posts get redone, and a redone post still keeps its promise.",
      "Every chat moment you save is kept, and your edits to a Creator's details stay put.",
    ],
  },
  {
    version: "0.2.55",
    date: "2026-09-25",
    notes: [
      "Posts now come from each Creator's own life: their people, places, work and day.",
      "Prefer the old style? Switch back in Settings.",
    ],
  },
  {
    version: "0.2.54",
    date: "2026-09-25",
    notes: ["Hinted and Secret Creators without artwork get their avatar and banner again."],
  },
  {
    version: "0.2.53",
    date: "2026-09-25",
    notes: [
      "A Creator's Continuity tab shows everything around them in the last two weeks.",
      "Private messages stay private there: only the kind of event shows.",
    ],
  },
  {
    version: "0.2.52",
    date: "2026-09-25",
    notes: ["Posts planned ahead get updated when a Creator's character or schedule changes."],
  },
  {
    version: "0.2.51",
    date: "2026-09-25",
    notes: [
      "A Creator's Continuity tab shows the people, places and habits Slurp knows about them.",
      "Correct anything there, and their posts use your version.",
    ],
  },
  {
    version: "0.2.50",
    date: "2026-09-25",
    notes: ["About one post in three looks back on something real, like an old post or a chat moment."],
  },
  {
    version: "0.2.49",
    date: "2026-09-25",
    notes: [
      "Posts vary in heat: most go as far as the Creator's level allows, some stay softer.",
      "Caption and picture always match in how far they go.",
    ],
  },
  {
    version: "0.2.48",
    date: "2026-09-25",
    notes: [
      "Creators post from where they are right now: work, home or the gym.",
      "A post due while a Creator sleeps or drives reads like it went out just before.",
      "On a storyline's big day, like moving day, the Creator's posts follow the story.",
    ],
  },
  {
    version: "0.2.47",
    date: "2026-09-25",
    notes: [
      "Slurp can keep a moment from a chat as a private note for that Creator.",
      "The button in chats arrives with a later Engine update.",
    ],
  },
  {
    version: "0.2.46",
    date: "2026-09-25",
    notes: [
      "Big life events like moving house or a breakup happen at most once per Creator.",
      "Posts that continue a storyline stay on its current chapter.",
    ],
  },
  {
    version: "0.2.45",
    date: "2026-09-25",
    notes: [
      "New, off by default: Shared ideas, seasonal moments each Creator makes their own.",
      "New, off by default: short themed events that every Creator joins.",
    ],
  },
  {
    version: "0.2.44",
    date: "2026-09-25",
    notes: ["Posts fit the Creator's day: the time for them and what they just did."],
  },
  {
    version: "0.2.43",
    date: "2026-09-25",
    notes: [
      "Creators remember what they posted about for a week and can follow up on it.",
      "Captions repeat old posts less.",
    ],
  },
  {
    version: "0.2.42",
    date: "2026-09-25",
    notes: [
      "New option: Beats posts, built from each Creator's own people, places and jokes.",
      "Posts mix wins, mishaps, opinions and moments with friends, so no one kind takes over.",
      "Creators stop making up people or big life changes that never happened.",
    ],
  },
  {
    version: "0.2.41",
    date: "2026-09-25",
    notes: [
      "Casual posts share one real thing from the Creator's day instead of being dull.",
      "Pictures vary their angle and crop, and the phone stays out of frame.",
      "The feed repeats one topic less, and promised posts deliver what you asked for.",
    ],
  },
  {
    version: "0.2.40",
    date: "2026-09-25",
    notes: ["Moments load in pages and show up in search, just like the feed."],
  },
  {
    version: "0.2.39",
    date: "2026-09-25",
    notes: [
      "Moments stay for their full time, even when new posts push them down the feed.",
      "Follow-up messages no longer get stuck when a Creator's return time is unknown.",
    ],
  },
  {
    version: "0.2.38",
    date: "2026-09-24",
    notes: [
      "Fan names are far more varied, with over 180,000 possible names.",
      "Fan names read as one word, like MothHour, so they are easy to tell apart.",
    ],
  },
  {
    version: "0.2.37",
    date: "2026-09-24",
    notes: [
      "Creator pictures match their avatar again on NanoGPT, xAI and more connections.",
      "Persona Creators can set Messages & Pricing again.",
      "Photo dumps and shoots have pictures that each make sense on their own.",
    ],
  },
  {
    version: "0.2.36",
    date: "2026-09-24",
    notes: [
      "Deep details opens as a flowchart of how a post came together.",
      "A Canvas view lets you drag and zoom the whole chart.",
    ],
  },
  {
    version: "0.2.35",
    date: "2026-09-24",
    notes: [
      "Deep details shows each post as numbered steps.",
      "The Connections panel shows the writing connection for replies and messages.",
    ],
  },
  {
    version: "0.2.34",
    date: "2026-09-23",
    notes: [
      "Manage text and image connections in one place.",
      "Missing connections stay visible until you pick a replacement.",
      "Scheduled posts survive restarts, and pictures follow each Creator's style.",
    ],
  },
  {
    version: "0.2.29",
    date: "2026-09-23",
    notes: [
      "The daily feed refresh uses your saved setting again.",
      "Delayed chat replies arrive even during a cool-off.",
      "Pulse shows more detail when a first post or fan activity fails.",
    ],
  },
  {
    version: "0.2.28",
    date: "2026-09-23",
    notes: [
      "Creator settings have a status overview and a section picker that works on phones.",
      "Profile edits use one Save bar.",
    ],
  },
  {
    version: "0.2.27",
    date: "2026-09-23",
    notes: [
      "Creator settings keep your unsaved profile edits when you switch sections.",
      "The Creator list shows what needs your attention and previews bulk changes.",
    ],
  },
  {
    version: "0.2.26",
    date: "2026-09-23",
    notes: [
      "Creators look like themselves in every picture.",
      "Pick a picture style for each Creator, or use the shared one.",
      "Settings sections have shorter names: Content and World.",
    ],
  },
  {
    version: "0.2.24",
    date: "2026-09-22",
    notes: [
      "Tips and unlocks in progress are never refunded by mistake.",
      "Promised follow-ups arrive again, and chat drafts stay in their own chat.",
      "Enter no longer sends a half-typed word when you use an input method.",
    ],
  },
  {
    version: "0.2.23",
    date: "2026-09-22",
    notes: [
      "Restore a deleted post while the countdown runs.",
      "Share asks which chat to send a post to, with search and New chat.",
      "Creators look like themselves in pictures by default.",
    ],
  },
  {
    version: "0.2.22",
    date: "2026-09-22",
    notes: [
      "Slurp screens open faster and load only what they show.",
      "Follows, subscriptions and unlocks show up at once.",
    ],
  },
  {
    version: "0.2.20",
    date: "2026-09-22",
    notes: [
      "Creators have a wardrobe of full looks and rarely wear the same outfit twice.",
      "Picture posts match their captions better.",
      "Random posts no longer make Creators sad or broke for no reason.",
    ],
  },
  {
    version: "0.2.19",
    date: "2026-09-22",
    notes: [
      "Each Creator has their own look, wardrobe and regular places on their profile.",
      "Creators look like the same person in every post.",
    ],
  },
  {
    version: "0.2.18",
    date: "2026-09-22",
    notes: [
      "New setting for how far a Creator's pictures go; locked posts show the most.",
      "Pictures are no longer muddy or badly lit.",
      "Fewer arm's-length selfies, and far fewer posts without a picture.",
    ],
  },
  {
    version: "0.2.17",
    date: "2026-09-22",
    notes: [
      "Posts with several pictures have arrows and previews, and the feed shows the count.",
      "Every writing block in Settings can be turned off or rewritten in your words.",
    ],
  },
  {
    version: "0.2.16",
    date: "2026-09-21",
    notes: [
      "Restoring a deleted post brings it back at once.",
      "Share cards show the Creator's name, title and caption again.",
      "Opening a post no longer shows its picture twice.",
    ],
  },
  {
    version: "0.2.15",
    date: "2026-09-21",
    notes: [
      "Deleted posts leave a sparkly Restore slot for 60 seconds.",
      "Pictures stick closer to the planned scene.",
    ],
  },
  {
    version: "0.2.8",
    date: "2026-09-21",
    notes: ["The feed has a softer loading animation, and deleted posts fade out gently."],
  },
  {
    version: "0.2.7",
    date: "2026-09-21",
    notes: [
      "The feed opens faster and loads older posts as you scroll.",
      "Edits and deletes show at once, with no reload.",
    ],
  },
  {
    version: "0.2.5",
    date: "2026-09-21",
    notes: [
      "Locked posts no longer tease what you already own.",
      "The composer offers only the post purposes that fit the audience.",
    ],
  },
  {
    version: "0.2.4",
    date: "2026-09-21",
    notes: [
      "Selfies fit the moment: planned shoots are rarely selfies, ordinary days often are.",
      "New conversations start as strangers, not friends.",
      "Creators reply to new messages within the hour.",
    ],
  },
];

/** Everything newer than the acknowledged version. */
export function getSlurp2UnseenReleases(seenVersion: string | null): Slurp2ReleaseEntry[] {
  const seenIndex = seenVersion === null ? -1 : SLURP2_RELEASES.findIndex((release) => release.version === seenVersion);
  return seenIndex === -1 ? SLURP2_RELEASES : SLURP2_RELEASES.slice(0, seenIndex);
}

/** Which splash is due: consent on a fresh install, "What's new" after an update, none when up to date. */
export function slurp2SplashKind(seenVersion: string | null): "welcome" | "whats-new" | null {
  if (seenVersion === SLURP2_VERSION) return null;
  return seenVersion === null ? "welcome" : "whats-new";
}
