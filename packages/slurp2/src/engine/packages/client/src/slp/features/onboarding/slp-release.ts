// The splash screen needs the shipped version and its public notes inside the client bundle.
export const SLURP2_VERSION = "0.2.49";

export interface Slurp2ReleaseEntry {
  version: string;
  date: string;
  notes: string[];
}

/** The public release history shown in the Engine splash screen. */
export const SLURP2_RELEASES: Slurp2ReleaseEntry[] = [
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
