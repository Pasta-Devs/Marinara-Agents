import { SLURP2_LEGACY_RELEASES } from "./slp-release-archive";

// The splash screen needs the shipped version and its public notes inside the client bundle.
export const SLURP2_VERSION = "0.4.3";

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
    version: "0.4.3",
    date: "2026-10-26",
    notes: ["Slurp starts on the latest Marinara again; 0.4.2 still stopped at load on some installs."],
  },
  {
    version: "0.4.2",
    date: "2026-10-26",
    notes: ["Slurp opens again after the latest Marinara update instead of failing to start."],
  },
  {
    version: "0.4.1",
    date: "2026-10-24",
    notes: ["Stories respond to taps again: close, Creator profiles, menus and navigation all work."],
  },
  {
    version: "0.4.0",
    date: "2026-10-23",
    notes: [
      "Spicy packs: Lingerie, Cosplay, Feet, Dom/sub, Exhibition and a Family pack, each off until you switch it on, and every fan you grow closer to opens more in your chats.",
      "Sexting sessions: buy 20 minutes in a Creator's chat; it heats up from warm-up to a finish, with a picture of the moment, and ends with a tip ask.",
      "Storylines run on one engine and Story Packs import the new format, Stir slides up over the page you are on, and a long list of fixes.",
    ],
  },
  {
    version: "0.3.53",
    date: "2026-10-21",
    notes: [
      "A failed picture waits for your retry when the image service says repeating it could create another paid task.",
    ],
  },
  {
    version: "0.3.52",
    date: "2026-10-20",
    notes: [
      "Slurp's automatic posts no longer talk to your AI while your own chat is replying, and no longer hold up your other automatic work afterwards.",
      "Write, Improve, voice drafts, schedules and page designs you ask for now take their turn on your connection like your chats do.",
    ],
  },
  {
    version: "0.3.51",
    date: "2026-10-20",
    notes: [
      "Slurp now runs on Marinara's own settings, dialogs and notifications, so it no longer resets your other settings.",
      "Its notifications show where you put Marinara's, and the download is smaller.",
    ],
  },
  {
    version: "0.3.50",
    date: "2026-10-19",
    notes: [
      "Tap an ad and its own page opens: the picture, the brand, the product and the price feel.",
      "Collect has a switch for its daily limit. Off, it moves all your Creator earnings at once.",
      "You write what fans ask for in commission requests, next to their first words.",
    ],
  },
  {
    version: "0.3.49",
    date: "2026-10-19",
    notes: ["Restoring a backup brings back its pictures, AVIF ones too, and skips any file that is not one."],
  },
  {
    version: "0.3.48",
    date: "2026-10-19",
    notes: [
      "A Creator whose character has a Conversation Schedule now lives by it: around when it says online, away when it says busy or offline.",
      "A message a Creator promised you no longer waits forever. Half a day late, being away no longer holds it back.",
    ],
  },
  {
    version: "0.3.47",
    date: "2026-10-16",
    notes: [
      "Known characters keep their name and series at the front of their pictures, written once.",
      "A friend in the picture is recognised by their tag name too, so they get their own look and picture.",
    ],
  },
  {
    version: "0.3.46",
    date: "2026-10-15",
    notes: [
      "Creators notice each other now: a like or a quick comment on another Creator's post, your persona's posts too.",
      "Your phone, your PC and any other browser open Slurp as the same persona, so the Inbox matches everywhere.",
      "Custom tags tell you when all eight slots are full, and a save that a tag blocks names that tag.",
    ],
  },
  {
    version: "0.3.45",
    date: "2026-10-15",
    notes: [
      "Pictures carry their style once, a fallback gallery photo changes from post to post, and outfits are no longer worn out.",
      "You choose whether Slurp draws missing avatars and banners on its own. Each Creator can have words that always go into their pictures.",
      "You can write how pictures are described to the writer. By default, the description leaves out the art style.",
    ],
  },
  {
    version: "0.3.44",
    date: "2026-10-15",
    notes: [
      "Trends: a post takes off, the right Creators join in their own way, it peaks, then it fades. Not everyone joins.",
      "Discover has a Trending on Slurp row, and trend posts carry a chip. Start or steer your own trend in Stir, or pick a ready-made one.",
      "A Creator who starts a trend picks up followers as others join.",
    ],
  },
  {
    version: "0.3.43",
    date: "2026-10-15",
    notes: [
      "Long DMs no longer stop mid-word, and Creators quote commission prices that match their price list.",
      "Posts stay varied: no more whole-feed shower evenings, and no Creator slides into one kind of post.",
      "Family is never paired up on its own, but you can still do it in Stir. Each feed slot posts once.",
    ],
  },
  {
    version: "0.3.42",
    date: "2026-10-15",
    notes: [
      "Chats with your Creators can now hear about their storylines, love life and how well they know you on Slurp.",
      "Lorebook entries set to At Depth now reach Slurp DMs, and a message's Deep details lists the lore it used.",
      "Scenes started from a DM begin on the first try more often.",
    ],
  },
  {
    version: "0.3.41",
    date: "2026-10-14",
    notes: ["Slurp opens faster: avatars load as small pictures instead of full-size cards."],
  },
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
  ...SLURP2_LEGACY_RELEASES,
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
