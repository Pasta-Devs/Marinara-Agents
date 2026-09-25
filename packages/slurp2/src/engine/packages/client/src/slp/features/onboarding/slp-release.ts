// The splash screen needs the shipped version and its public notes inside the client bundle.
export const SLURP2_VERSION = "0.2.74";

export interface Slurp2ReleaseEntry {
  version: string;
  date: string;
  notes: string[];
}

/** The public release history shown in the Engine splash screen. */
export const SLURP2_RELEASES: Slurp2ReleaseEntry[] = [
  {
    version: "0.2.74",
    date: "2026-09-26",
    notes: [
      "Settings are rows: what a setting does on the left, its control on the right. Each page says its name once; Reset is at the bottom and resets only that page.",
      "Overview is the only summary page, with fan and schedule buttons and more tiles. New names: Connections, Storylines (a Story is the short image post) and Writing. Maintenance is one page.",
      "On a phone, settings open on a list of sections.",
      "Connections has one row per job and the chat carryover. Creator pictures now sets the connection Creator pictures really use.",
      "Images uses picture shapes instead of number fields. Story images moved to Publishing. Storyline types, ads and events are compact lists; long explanations fold under How this works.",
      "Writing starts with Spice level and How far pictures go.",
    ],
  },
  {
    version: "0.2.73",
    date: "2026-09-26",
    notes: [
      "Your own messages no longer use the AI budget: a Creator answers a message you send or a tip you give at once, even when the hourly or daily limit is reached. Only answers that arrive while you are away count against it. The mode and the DM replies switch still apply.",
    ],
  },
  {
    version: "0.2.72",
    date: "2026-09-26",
    notes: [
      "Storylines, Publishing, Images, Audience, Messaging and Prompts show their current settings as a row of chips under the page title. Tap a chip to jump to that setting, even inside a folded block.",
      'Creator settings tabs with several parts start with a "Jump to" row.',
    ],
  },
  {
    version: "0.2.71",
    date: "2026-09-25",
    notes: [
      "Bounded numbers are sliders with a value chip: weeks between storylines, storylines at once, wallet day start, weekly price change and creator revenue share. A slider saves when you let go.",
      "Posts per day, storyline check interval and carryover limits have − and + buttons.",
      "Messaging reply and away delays are four min–max rows instead of eight separate fields; the lower value can never pass the upper one.",
    ],
  },
  {
    version: "0.2.70",
    date: "2026-09-25",
    notes: [
      "Settings have new sections in order of use: Overview, Models & connections, Creators, Posting, Stories, World, Fans & money, Writing & content level, Maintenance.",
      "Models & connections holds Connections and Image generation, right under Overview. World holds Events and Calendar; Fans & money holds Audience, Messaging rules, Coins and access, Ads and Discovery; Stories holds Storylines, Storyline types and Packs.",
      "Old links and saved places open the page in its new section.",
    ],
  },
  {
    version: "0.2.69",
    date: "2026-09-25",
    notes: [
      'A Creator\'s posting schedule is a day list: each upcoming post shows its time, which you change in place and which saves when you leave the field. "Another day" moves a post to a new day at the same time. The 8 Save buttons are gone.',
    ],
  },
  {
    version: "0.2.68",
    date: "2026-09-25",
    notes: [
      "Creator settings open on an Overview status page: what needs review, whether the Creator posts (with a live Auto-post switch), the next post, running storylines, notes waiting in Memory, and a way into each part.",
    ],
  },
  {
    version: "0.2.67",
    date: "2026-09-25",
    notes: [
      "Creator settings have 7 tabs instead of 14: Overview, Profile (identity, appearance, wardrobe), Posting (automation, production, storylines, collaborations), Content rules, Fans & messages, Memory and Tools. Each merged tab shows its parts under their own headings.",
      "Links and search results that named an old tab open the new tab and scroll to the right part.",
    ],
  },
  {
    version: "0.2.66",
    date: "2026-09-25",
    notes: [
      "Publishing, Images, Ads and Messaging show fixed choices as button rows instead of dropdowns: story rate, post ideas, free teasers, generation mode, image context, appearance updates, ad frequency, steering, content ceiling, era, tone and the default DM policy.",
      "Every folded block in settings looks and works the same, and shows how many settings it holds.",
      'The "Set Slurp\'s pace" wizard is gone from Publishing; the preset cards on the same page do the same job.',
    ],
  },
  {
    version: "0.2.65",
    date: "2026-09-25",
    notes: [
      'Life details sit right after "Waiting for you" in a Creator\'s Memory tab. People, places, work, things, habits and running jokes are chips: type and press Enter to add, tap the cross to remove.',
      "The heat range of a card is picked with button rows, and the note filters fold away behind the search box, with the number of active filters shown.",
    ],
  },
  {
    version: "0.2.64",
    date: "2026-09-25",
    notes: [
      'A Creator\'s Storylines tab follows the Slurp settings by default and shows their values. Turn on "Own value" on a row to set it for this Creator; turn it off to follow Slurp again.',
      "Storyline types for one Creator are picked with tappable chips, and all controls in the tab have full-size touch targets.",
    ],
  },
  {
    version: "0.2.63",
    date: "2026-09-25",
    notes: [
      "Storylines settings show every choice at once: story activity presets are cards with a short description, and the start, pace and source settings are button rows instead of dropdowns.",
      "Audience presets, scale, tone and world activity use the same button rows.",
    ],
  },
  {
    version: "0.2.62",
    date: "2026-09-25",
    notes: [
      "The Identity tab in Creator settings uses the full width again; the Save bar sits at the bottom of the tab.",
      "Memory shows readable names instead of raw ids such as multi_image_set, in Recent plans, filters, proposals and signals.",
    ],
  },
  {
    version: "0.2.61",
    date: "2026-09-25",
    notes: ['The Creator settings window no longer shows "{{name}}\'s settings" while it loads.'],
  },
  {
    version: "0.2.60",
    date: "2026-09-25",
    notes: [
      "The Storylines card in Posting and the storyline button in the Calendar now open the new Storylines page, and the Advanced block shows an arrow.",
    ],
  },
  {
    version: "0.2.59",
    date: "2026-09-25",
    notes: [
      "New Story activity preset on the Storylines page: Calm, Lively, or Hands-off sets events, storylines, and shared ideas in one step; your own mix shows as Custom.",
      "Creator settings have a Storylines tab for that Creator's storyline overrides. The daily routine now says it sets where the Creator is and when they reply, not post times. Life details show only when post ideas come from the Creator's life, and the old audience mix appears only while it differs from the defaults.",
    ],
  },
  {
    version: "0.2.58",
    date: "2026-09-25",
    notes: [
      'Settings are easier to find: Stories & events has a new Storylines page with one "Start things by themselves" card for events and storylines, the storyline rules, and Shared ideas; Posting has a new "What gets posted" group with post ideas and free teaser posts.',
      'Settings that have no effect right now stay visible and say why, for example "Only for automatic posting", instead of disappearing. Rarely needed storyline settings sit under Advanced.',
    ],
  },
  {
    version: "0.2.57",
    date: "2026-09-25",
    notes: [
      'Clearer names in Settings: arcs, plans, and projects are now called storylines, occasions are events, and the post planner is "Post ideas come from". Several help texts were corrected, among them the event automation text, which wrongly said it also starts storylines.',
    ],
  },
  {
    version: "0.2.56",
    date: "2026-09-25",
    notes: [
      "A Creator's limits and saved notes no longer drop out of post and message prompts after a week of Beats posts; only the newest few post notes stay active.",
      "Beats no longer rejects correct short names such as Mia or Kai, or people an arc chapter or a callback names, so fewer posts are rewritten.",
      "Posts that answer a promise or a campaign step keep it when they are retried or rewritten, and prepared posts are only rewritten when the character card or schedule really changed.",
      "Several moments saved from one chat without a message id are all kept, and Canon anchors you edited are not replaced by a background read.",
      "Smaller Beats fixes: the heat floor matches the card, a named person is never told to be alone, an arc teaser gets no second subject, and a locked post's moment is never a callback in a public post.",
    ],
  },
  {
    version: "0.2.55",
    date: "2026-09-25",
    notes: [
      "Beats is now the default post planner. Ordinary posts are built from each Creator's own card, day, and history instead of letting the model choose the subject. Classic stays available under Prompts.",
    ],
  },
  {
    version: "0.2.54",
    date: "2026-09-25",
    notes: [
      'Hinted and Secret Creators without an avatar or banner get their artwork drawn again. The automatic backfill failed for them every minute with a "creatorDetails" error in the log.',
    ],
  },
  {
    version: "0.2.53",
    date: "2026-09-25",
    notes: [
      "Each Creator's Continuity tab now lists their recent signals: everything around them in the last two weeks from every source (posts, notes, messages, promises, their schedule, platform events, and other Creators' posts) in one place. Private messages show only what kind of thing happened.",
    ],
  },
  {
    version: "0.2.52",
    date: "2026-09-25",
    notes: [
      "Posts prepared ahead of time are written again when the Creator's character card, Conversation Schedule, disclosure, or stage voice changes before they go out, instead of publishing what was true when they were prepared.",
    ],
  },
  {
    version: "0.2.51",
    date: "2026-09-25",
    notes: [
      "Each Creator's Continuity tab now shows what the Beats planner read from their card: people, places, work, things, habits, running jokes, their typical day, and their heat range. You can correct it, and your version is used until the card changes; Read card again starts over.",
    ],
  },
  {
    version: "0.2.50",
    date: "2026-09-25",
    notes: [
      "With Beats on, about one post in three may refer back to something real: an earlier post, an earlier set, a moment saved from a chat, or a request the Creator delivered. Slurp passes the fact itself, never an old caption, and Deep details show it.",
    ],
  },
  {
    version: "0.2.49",
    date: "2026-09-25",
    notes: [
      "With Beats on, each post plans how far it goes: most posts go as far as the Creator's explicit-level dial allows, some are softer, and none go below what the character's card is like. Caption and picture use the same level, and Deep details show it.",
    ],
  },
  {
    version: "0.2.48",
    date: "2026-09-25",
    notes: [
      "With Beats on, a Creator's schedule decides where they are: moments at the place or work they are at right now come first, and a moment about somewhere else is posted as a plan, a memory, or a wish.",
      "A post due while the Creator sleeps or drives is written as if posted just before, and never mentions being awake or on the road. Gym, set, class, and similar blocks stay good post material.",
      "On an arc's big day, such as moving day, the arc chapter decides what the Creator does, not the usual weekly schedule.",
    ],
  },
  {
    version: "0.2.47",
    date: "2026-09-25",
    notes: [
      "Slurp can now take a moment saved from an Engine chat and keep it as a private note for that character's Creator pages. The button in chats comes with a later Engine update.",
    ],
  },
  {
    version: "0.2.46",
    date: "2026-09-25",
    notes: [
      "Life-event arcs such as moving house, a new job, or a breakup now happen at most once per Creator when Slurp starts arcs by itself.",
      "With Beats on, a post that continues an arc is about the arc's current chapter, instead of an unrelated moment beside it.",
    ],
  },
  {
    version: "0.2.45",
    date: "2026-09-25",
    notes: [
      "New with Beats: Shared ideas (off by default). Once a day Slurp collects a few seasonal and platform moments, and once a week typical moments per topic tag. Beats fill them in with each Creator's own places and work, and each idea is used by at most two Creators a day.",
      "New with Shared ideas: Slurp-wide events (off by default). The daily idea call may start one short themed event for all Creators; it shows under Platform events and ends by itself.",
    ],
  },
  {
    version: "0.2.44",
    date: "2026-09-25",
    notes: [
      "With Beats on, each post knows where the Creator's day stands when it goes out and what they did just before, from their Conversation Schedule or, without one, from a typical day read once from their card.",
      "Beats reads each card one more time after this update, to add that typical day.",
    ],
  },
  {
    version: "0.2.43",
    date: "2026-09-25",
    notes: [
      "With Beats on, what a published post was about becomes a note Slurp remembers for a week, so the next post can follow on from it without copying its caption.",
      "With Beats on, no earlier caption is quoted to the writer any more; recent posts appear only as subjects.",
    ],
  },
  {
    version: "0.2.42",
    date: "2026-09-25",
    notes: [
      "New experimental post planner in Prompts: Beats. It picks what an ordinary post is about from the Creator's own card (a person, a place, their work, a running joke) instead of letting every Creator drift to the same subjects. Classic stays the default.",
      "With Beats on, Slurp reads each Creator's card once in the background and reads it again only after the card changes. Until then, and whenever something goes wrong, posts use the classic planner.",
      "Beats vary the kind of moment (a win, a showcase, a moment with someone, an opinion, a small mishap, and more) per Creator and across the whole feed, so no single kind takes over.",
      "Beats tell the writer who is there, where, and when, and that it must not invent other people, past events, or life changes. If a post does anyway, it gets one rewrite; Deep details show the result.",
      "Deep details now show the planner, the beat with its anchor and cast, the claim check, the picture's shot, and the subject a kept promise delivers.",
    ],
  },
  {
    version: "0.2.41",
    date: "2026-09-25",
    notes: [
      "Casual posts are no longer told to be dull; they share one thing from the Creator's day in their own way.",
      "Camera choices describe framing instead of equipment, so pictures stop showing a phone unless it is a mirror shot.",
      "The label you type on a fulfilled, teased, or delayed request now tells the promised post what to deliver.",
      "Posts no longer see their own older captions word for word: only the last post is quoted, older ones appear as subjects, and other Creators' recent subjects are listed so the feed stops repeating one topic.",
      "Pictures now vary their angle and crop with composition tags image models know (upper body, cowboy shot, from side, and more), chosen to fit who could have taken the shot.",
      "The post prompt's timing, repetition, and scene rules are shorter, and the last texts that put a phone into scenes are gone.",
    ],
  },
  {
    version: "0.2.40",
    date: "2026-09-25",
    notes: ["Retained Moments use bounded Story reads and follow feed search and pagination rules."],
  },
  {
    version: "0.2.39",
    date: "2026-09-25",
    notes: [
      "Moments now remain available for the configured retention period even when newer feed posts fill the first page.",
      "Follow-ups no longer retry forever when a Creator has no known return time.",
    ],
  },
  {
    version: "0.2.38",
    date: "2026-09-24",
    notes: [
      "Generated audience names now draw from one merged, much larger word bank (184,512 combinations, up from ~18,800) instead of a single fixed set of moody handles.",
      "Generated names are CamelCase with no digits, spaces, or underscores (for example `MothHour` instead of `moth_hour_77`), so they read as a single word and two people never blur together in a dense list.",
    ],
  },
  {
    version: "0.2.37",
    date: "2026-09-24",
    notes: [
      "NanoGPT, xAI, and connections recognised only by their base URL now receive avatar reference images again.",
      "Persona Creators can set Messages & Pricing again; the tab now uses the same viewer persona as the rest of Slurp.",
      "Post cards, the picture viewer, and the redraw box show the exact prompt the picture was drawn from. A prompt you edit or keep in the redraw box is sent as written, not rewritten again.",
      "Multi-picture posts plan every picture as its own complete scene, so a photo dump, a shoot, or a day out each gets pictures that make sense on their own.",
    ],
  },
  {
    version: "0.2.36",
    date: "2026-09-24",
    notes: [
      "Deep details opens as a flowchart of the whole generation: each step shows what happens, why, which connection and model ran it, and the exact text that went in and came out. A Canvas view shows the same diagram to drag and zoom in every direction.",
      "Image runs now also record the prompt-rewrite model and its full chat, the fallback image connection, and which connection actually drew the picture.",
    ],
  },
  {
    version: "0.2.35",
    date: "2026-09-24",
    notes: [
      "Deep details shows each post as numbered steps. Every image run records its settings, style profile, prompt rewrite, final prompt, and provider attempts in order.",
      "The Connections panel includes the AI writing connection used for replies, messages, and audience activity.",
    ],
  },
  {
    version: "0.2.34",
    date: "2026-09-23",
    notes: [
      "Manage text and image connections in one place. Missing saved connections stay visible until you choose a replacement, and connection load errors can be retried.",
      "Image briefs now follow the Creator's production style, and future automatic posts survive Engine restarts and source snapshot changes.",
      "Prompt Studio describes its output clearly, image appearance settings apply consistently, and valid model responses can include extra fields.",
    ],
  },
  {
    version: "0.2.29",
    date: "2026-09-23",
    notes: [
      "Scheduled timeline refresh uses the saved daily setting again.",
      "Delayed chat replies finish during a cool-off, and strict model output supports comment threads and invited posts.",
      "Pulse shows failed first posts and audience failure details. Arc edits keep imported story fields.",
    ],
  },
  {
    version: "0.2.28",
    date: "2026-09-23",
    notes: [
      "Creator settings have a status overview and a section picker that works on phones.",
      "Profile edits use one save bar, and settings use one scroll area.",
    ],
  },
  {
    version: "0.2.27",
    date: "2026-09-23",
    notes: [
      "Creator settings keep profile drafts when you change sections and confirm before discarding them.",
      "Creator settings are grouped by task, and the roster shows attention reasons and bulk-change previews.",
    ],
  },
  {
    version: "0.2.26",
    date: "2026-09-23",
    notes: [
      "Image prompts preserve each Creator's appearance and follow the selected image guidance.",
      "Choose an image style for each Creator, or let them use the global style.",
      "Settings sections now use the shorter names Content and World.",
      "Posts, messages, audience activity, story events, and image generation use clearer state and feedback handling.",
    ],
  },
  {
    version: "0.2.24",
    date: "2026-09-22",
    notes: [
      "Payments are safer: a tip or unlock that is still going through is no longer refunded by mistake, and cancelling a commission never creates coins.",
      "Promised follow-ups arrive again with default settings.",
      "Switching chats on desktop no longer carries a draft, a pending message or an open tool into the next conversation.",
      "Enter no longer sends a half-written word while you type with an input method, and in-chat search scrolls to its match.",
      'Locked content stays hidden in fresh replies, and "Let them answer" works for a Creator you play.',
    ],
  },
  {
    version: "0.2.23",
    date: "2026-09-22",
    notes: [
      "Restore now works after you delete a post: the row waits for you instead of disappearing while the countdown runs.",
      "Share asks which chat to send a post to, with a search and a New chat button, and the chat card says who wrote the post.",
      "Reporting a post offers the reasons a real social network offers, plus Slurp's own three.",
      "Playing a Creator, you can ask a fan to write back, the same way a fan can ask you.",
      "Creators look like themselves in pictures: avatar references and source appearance are used by default. Both remain switches in Backstage → Images.",
    ],
  },
  {
    version: "0.2.22",
    date: "2026-09-22",
    notes: [
      "Everyday Slurp screens now load only the data they use, so opening the Hub does not also load profile sources, model connections, full notifications, or the full inbox.",
      "Shell badges use lightweight notification and message counts, and feed seen, follow, subscription, and unlock actions update the visible surface before background reconciliation.",
    ],
  },
  {
    version: "0.2.20",
    date: "2026-09-22",
    notes: [
      "Creators can keep a wardrobe of complete looks, review AI imports from their character, lorebooks, pasted text, or old wardrobe note, and let automatic posts choose without repeating the same outfit.",
      "Automatic picture posts now connect the caption to a small scene plan while Slurp still enforces identity, clothing, camera reach, company, quality, and public or locked limits.",
      "Random post variation no longer invents loneliness, low spirits, or a bad-money day. Real events and the source character can still make a serious post serious.",
    ],
  },
  {
    version: "0.2.19",
    date: "2026-09-22",
    notes: [
      "A Creator now has her own appearance, wardrobe, and regular places, on her profile. The appearance goes with every picture, so she stops looking like somebody different in each post.",
    ],
  },
  {
    version: "0.2.18",
    date: "2026-09-22",
    notes: [
      "How far a Creator's pictures go is now a setting. Locked posts deliver it, public posts stay one step below, and housekeeping posts stay clean.",
      "Pictures stop coming out muddy and badly lit: the prompt asked the image model for a plain photograph and it was reading that as a bad one.",
      "Creators post fewer arm's-length selfies and far fewer posts with no picture at all.",
    ],
  },
  {
    version: "0.2.17",
    date: "2026-09-22",
    notes: [
      "A post with several pictures now opens with arrows and mini previews, and the feed card shows how many there are.",
      "Prompt Studio: every prompt block can be switched off, and required blocks can be rewritten in your own words.",
    ],
  },
  {
    version: "0.2.16",
    date: "2026-09-21",
    notes: [
      "Restoring a deleted post now brings it back at once, and a Restore near the end of the countdown no longer fails.",
      "Share cards are drawn in the browser, so they carry the creator name, title, and caption again instead of the bare picture.",
      "Opening a post no longer shows its picture twice.",
    ],
  },
  {
    version: "0.2.15",
    date: "2026-09-21",
    notes: [
      "Deleted posts now leave a sparkling restore slot for 60 seconds before permanent cleanup.",
      "Post image prompts now use a typed visual brief and preserve the planned scene through image interpretation.",
    ],
  },
  {
    version: "0.2.8",
    date: "2026-09-21",
    notes: [
      "Feed loading has a softer status animation, older drops show a progress state, and deleted posts leave the timeline with a short gentle exit.",
    ],
  },
  {
    version: "0.2.7",
    date: "2026-09-21",
    notes: [
      "The feed loads its first page first, older posts load on demand, and post edits and deletes update the visible feed without a full reload.",
    ],
  },
  {
    version: "0.2.5",
    date: "2026-09-21",
    notes: [
      "Locked posts no longer tease what the reader already owns, and housekeeping posts stay public. The composer offers only the purposes that fit the post's audience.",
    ],
  },
  {
    version: "0.2.4",
    date: "2026-09-21",
    notes: [
      "Who holds the camera now follows what the post is for: a planned shoot is rarely a selfie, an ordinary day usually is.",
      "Two Creators who shoot the same way no longer have identical effort on the same day.",
      "Conversations start between strangers instead of as friends.",
      "Creators answer a new message within the hour instead of after two, so the inbox no longer needs Reply now.",
    ],
  },
  {
    version: "0.2.3",
    date: "2026-09-21",
    notes: [
      "Every post's menu has Deep details: the plan, the draws, the full prompt, the model's raw answer, the picture brief, and every tag behind that post.",
    ],
  },
  {
    version: "0.2.2",
    date: "2026-09-21",
    notes: [
      "Removed viewer access. Every persona now sees every Creator; the per-Creator hide list is no longer used.",
    ],
  },
  {
    version: "0.2.1",
    date: "2026-09-21",
    notes: [
      "Posts no longer read private notes from direct messages.",
      "Teasers, callbacks, and ordinary days stay short; only behind-the-scenes posts run long.",
      "Stories can now be thank-yous and requests too, and a callback with nothing to continue becomes an ordinary post.",
      "Prompt Studio shows every block in full and lets you edit it in place, with live text for the preview Creator and the compiled prompt kept current.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-09-21",
    notes: [
      "Creators now plan posts: teasers, photo sets of up to three images, Stories, cropped previews, reused pictures, text on purpose, and quiet slots. Classic mode became a prompt preset.",
      "Shoots keep a set consistent, and a set can open a teaser-and-callback campaign.",
      "Each Creator has a Posting strategy; the composer picks a one-off purpose and delivery.",
      "Fan requests can be answered from the conversation, and the planner keeps promises.",
      "Creators remember what they said and did; fan-private details never leak. Review it in the new Continuity tab or the Backstage queue.",
      "Prompt Studio was redesigned, and Pulse shows background work.",
    ],
  },
  {
    version: "0.1.3",
    date: "2026-09-20",
    notes: [
      "Slurp HTTP routes now use Slurp naming. Existing avatars, banners, ad images, post images and backups keep working.",
    ],
  },
  {
    version: "0.1.2",
    date: "2026-09-19",
    notes: ["Fixed Creator filters, profile expansion, and settings tabs not responding after the 0.1.1 update."],
  },
  {
    version: "0.1.1",
    date: "2026-09-19",
    notes: [
      "Slurp now carries its own vocabulary instead of borrowing names from the Engine.",
      "Cleaned up a leftover wording slip in the setup wizard intro.",
      "Fixed SwarmUI image generation: prompt images and LoRAs are now sent when you do not use a custom workflow.",
      "Nothing else changes. Your creators, posts and settings are untouched.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-19",
    notes: [
      "Completed the backend file split and modularisation.",
      "You should not feel any difference. If you do, tell me in Discord.",
    ],
  },
  {
    version: "0.0.22",
    date: "2026-09-17",
    notes: [
      "Invite Engine characters to the Slurp audience from character groups or per-character controls.",
      "Audience characters are now available as a first expansion step. The current setup is still limited and needs clearer guidance and simpler controls.",
      "Invited characters use their own card voice and tags in comments, audience activity, and messages.",
      "Invited characters can follow, subscribe, spend, hold ties, and appear in fan cards.",
      "Added a New Chat picker for owned Creators and invited characters.",
      "Added prompt-cost limits and deterministic character rotation.",
      "Fixed feed ads, image prompt display, and the configured subscription price.",
      "Added configurable image Stories and platform-style message actions.",
      "Added backend groundwork for the next expansion and bug-fix updates, with clearer service boundaries for safer iteration.",
    ],
  },
];

/** Everything newer than the acknowledged version. */
export function getSlurp2UnseenReleases(seenVersion: string | null): Slurp2ReleaseEntry[] {
  const seenIndex = seenVersion === null ? -1 : SLURP2_RELEASES.findIndex((release) => release.version === seenVersion);
  return seenIndex === -1 ? SLURP2_RELEASES : SLURP2_RELEASES.slice(0, seenIndex);
}
