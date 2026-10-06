# One module system for Opening Day and Settings

Status: design proposal, 2026-10-06. Source audit: branch `conduct-your-welcome`,
commit `5f6e5efa` (Slurp 0.3.18). This document proposes future behavior; it does not
describe a shipped module system or authorize a release or deployment.

## Product direction

The player owns their Slurp. Opening Day guides them through building it, and
Settings lets them change the same choices later. Support introduces each module;
the module's name, controls, defaults, explanations and preview stay the same in
both places. New players can take a recommended start; experienced players can
tune it before opening the doors. G's staging screen stays unchanged.

These are optional activities inside the installed Slurp package, not separately
downloaded packages, and not a new source-code layer. Existing feature ownership
and cross-feature contracts remain authoritative.

The preview uses Slurp's actual post, locked-post, navigation and control
presentation with fixed sample data. Onboarding answer cards may be larger for
touch, but use Slurp's button vocabulary. Preserve the stage, pacing, reveal and
opening animation; replace the second, invented social-app design inside it.

## The map players see

The grouping and the Basic/Detailed split below are provisional. A complete
inventory proves coverage, not usability. Messages is the first pilot; validate
its shared controls before reorganizing every page or adding master switches.
Pictures is a generation capability, Coins is a transaction policy, and Support
also serves the product narrative. These cards do not need identical enable or
automation semantics to belong in the same overview.

| Home                    | What belongs here                                                   | First controls                                   | More controls                                                               |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| Your Slurp (foundation) | Creators, feed, posting, short-lived story posts, discovery         | Posting pace, quiet hours, content boundaries    | Post format, story mix, planning, Creator defaults                          |
| Audience                | Fans, comments, reactions and invited character fans                | Crowd size, personality, activity                | Fan types, invited characters, comment limits, reaction banks               |
| Pictures                | Image generation for posts, stories, chats and ads                  | Image connection, style, automatic post pictures | Resolution, prompt enhancement, references, appearance handling             |
| Messages                | Private conversations, rapport and commissions                      | New-conversation defaults, replies while away    | Reply timing, messages per reply, commission templates and picture cooldown |
| Stories & drama         | Storylines, events, calendar, drama and relationship developments   | Selected content, intensity, automatic starts    | Libraries, packs, crossover rules, effects, relationship rules              |
| Coins & earnings        | Wallet, tips, prices, revenue and payouts                           | Charge coins, prices, collect limit              | Rewards, revenue share and dynamic pricing                                  |
| Brands & ads            | Sponsored feed cards and Creator brand deals                        | Frequency, tone, brand deals                     | Interests, era, lorebook, ad pictures                                       |
| Support desk            | Creator tickets, notices, offers, challenges and interventions      | Ticket frequency, notices, fair/shady behavior   | Refusals, trust, leaving, saved replies and applicability to your Creators  |
| Shared settings         | Connections, writing, activity/budget, viewing preferences, storage | Models, usage, global pause, viewing preferences | Prompt editing, integration context, simulation tuning, backup and cleanup  |

Short-lived story posts belong to publishing. They are not the same thing as
storylines and drama. Keep the labels explicit wherever both appear.

Stir remains the place to perform narrative actions. A module page configures
behavior and links to the relevant Stir actions; it does not duplicate that tool.

## Same controls, two ways in

Opening Day: greeting → explicit age confirmation → real Slurp demonstration →
foundation → module selection → review → Open the doors. The age confirmation is
always required on first run. Skip goes only to configuration after confirmation.

Present optional modules together as a selection step, with a short live demo for
the focused card. Do not force seven additional mini-tutorials. Each offers Add,
Tune and Maybe later. Tune opens its ordinary module controls inside the stage.
The recommended shortcut fills a proposed setup and still shows the review.

Settings opens on Your Slurp: foundation summary, enabled modules, available
modules, shared settings, and Pause all. Every module has a stable destination.
Search includes inactive modules and advanced settings. Old links redirect to the
new destination; users can still find a setting by its previous name.

In either entry point, a module page shows a short explanation, its state, the
common controls, a real sample preview and a clearly labelled More controls
section. Avoid a second configuration wizard nested inside the first.

Opening Day edits a draft and writes at its final confirmation. Settings edits
use the existing explicit save contract. Share the actual controls and settings
mapping, not just similarly worded labels. An unsaved preview never makes model
calls, creates content or changes persisted settings.

## State and activity contract (proposed)

Availability and activity are different decisions:

| State           | Meaning                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Off             | No new module work or new module actions. Saved configuration and historical data remain. Reading, export and obligation settlement remain available.  |
| On              | Module actions are available. Show exact operation summaries, such as Replies while you're away: Off; do not imply all replies require a separate tap. |
| Needs setup     | The player chose the module, but a required resource is missing. Explain which capability is unavailable and offer the exact setup action.             |
| Activity paused | Module is still On, but its automatic work is paused. It remains usable when the player asks.                                                          |
| Slurp paused    | Global pause takes precedence over module activity. Do not pretend a missing connection or budget limit is the same as Off.                            |

Activity options are feature-specific, not a universal three-position switch.
Messages has replies when away; Stories has manual/suggest/auto; Audience has
activity pace and template/model behavior; Coins has charging rules, not an AI
autopilot. When a module has both present and away model work, explain both.

For every module, Off preserves the preferences used when it was On. Re-enabling
restores them without reapplying a preset. It does not replay a backlog of
unrequested activity for the time it was disabled. Outstanding committed work is
handled separately from new work, and never silently deleted.

| Module           | Off stops                                                                           | Off preserves / finishes                                                                                            | Current gap                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Audience         | New synthetic fan activity and its model drains                                     | Existing followers, comments, reactions, invited-character configuration; the player's own interactions             | `fanActivityEnabled` is not a full module gate; manual runs bypass it and `worldActivity` affects other domains.       |
| Pictures         | New generated pictures through all module entry points, including ads and DMs       | Existing media, viewing, upload/gallery use and already committed results                                           | `autoPostingImagesEnabled` only controls automatic post images. Do not use it as the master switch.                    |
| Messages         | New ordinary DM sends, replies, unsolicited fan messages, commissions and DM scenes | Thread reading/export; already-written delayed bubbles and accepted commissions must still settle                   | Away-reply switch does not stop delivery or other message paths. Support threads need an explicit exception.           |
| Stories & drama  | New starts, automatic beats and narrative effects from this module                  | Libraries, ties, family/romance restrictions, history; running narrative instances are suspended, not erased        | Several independent switches; clearing `drama.enabled` would discard selection. Resume must shift suspended timelines. |
| Coins & earnings | New coin charges, automatic renewals and new economy rewards                        | Balances and ledgers; previously paid transactions settle without duplicate charges                                 | `walletEnabled` already makes some actions free. Re-enable must not charge for free activity during Off.               |
| Brands & ads     | New feed ads, new sponsorship offers and new campaign work                          | Existing sponsored posts and deals; accepted commitments need an explicit continue/cancel choice                    | Ad flag covers several paths, but this is not proof that all existing campaign work stops.                             |
| Support desk     | New tickets/notices, proactive offers and autonomous trust/intervention activity    | Case history; accepted challenges/contracts continue to settlement; historical effects need an explicit explanation | `tickets: off` stops only ticket creation. No complete master gate exists.                                             |

Historical module content may link to a retained reading view. Do not leave dead
tabs or make saved messages disappear. For Support desk, plain case-thread replies
and settlement may remain available while new offers are disabled. Turning ordinary
Messages off must not silently turn Support off as well.

If disabling a module would affect an accepted contract, commission or deal, show
the concrete consequences before saving. The default preserves accepted work.
Global Pause all can hold delivery as it currently does; a module toggle must not
be misused to abandon a paid obligation.

## Dependencies and scope

| Capability                                    | Requirement                                                     | Behavior without it                                                                   |
| --------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| AI-written posts, replies and pages           | Usable text connection                                          | Historical content works; affected generation says Needs setup.                       |
| Generated pictures                            | Usable image connection                                         | Existing/uploaded pictures work; drawing is unavailable.                              |
| Automatically draw pictures in another module | Pictures On and usable image connection                         | That module continues with text; no silent enable or fallback model spend.            |
| Paid unlocks, memberships and commissions     | Coins charging On                                               | Preserve current supported free behavior; access policy remains independent of money. |
| Fan comments on a storyline                   | Audience On                                                     | Storyline can run without synthetic fan comments.                                     |
| Proactive fan DMs                             | Audience and Messages On                                        | Audience can still react publicly; messages can still work with the player.           |
| Support conversation                          | Support On; ordinary Messages is not a required purchase/toggle | Support uses message transport with its own product policy.                           |

Dependencies are capability checks, not chains of forced module activation. Show
why a feature is unavailable at the control that needs it. Generated pictures in
ads, stories or commissions get one shared image-connection selector with optional
feature-specific overrides; the same choice is not copied into unrelated state.

Every editable control has a visible scope: All Slurp, Default for Creators,
This Creator, or My view. Server-global viewing options currently have global
storage even if their labels feel personal: do not relabel them My view until
their storage is actually per viewer. Creator overrides show the resolved value
and, once live inheritance is implemented, an explicit Use Slurp default action.
Creator defaults are fallback values, not restrictions on every Creator.

Current Creator messaging persistence resolves all fields and saves a complete
object on any change. Editing one price can therefore store sibling default
values too. Per-field live inheritance/reset is a proposed storage contract,
not an existing control we can expose by changing labels. Existing stored values
must not be treated as proven intentional overrides or silently deleted.

Content limits and Creator hard noes stay enforced across modules. Turning a
module on never loosens content boundaries, resets romance exclusions or replaces
a Creator-specific override.

## Recommended start and existing installations

Proposed new-player recommendation: foundation, Audience and Messages On;
explicitly requested model work first, no away model work by default. Offer
Pictures when a usable connection exists. Stories & drama, Coins, Brands and
Support are available additions. This is a proposal for new installations, not
a change to existing players' activity or shipped defaults. The review lists
both enabled modules and the selected automatic activity before confirmation.

Away replies Off does not promise that nobody writes first: Creator
`proactiveMessages` is a separate field whose current default is true, with no
global configurable fallback. An initial send may generate an immediate answer,
while a queued unanswered message can require Get reply now. The recommended
start must specify posting, audience generation, away replies and unsolicited
messages separately before it can promise an on-request-only experience.

Without a text connection, allow browsing/manual content management and offer the
specific connection setup path. Automatic generation remains unavailable. Do not
advertise On request AI as working without a connection.

Migration is conservative: existing installations keep all currently available
capabilities and their settings. Existing flags seed activity summaries, not
module absence. For example, away replies Off does not mean Messages Off, picture
autoposting Off does not mean Pictures Off, and no enabled drama packs does not
mean storyline tools are absent. Do not invent a module configuration by treating
every false flag as an opt-out. Run setup again starts from effective current
values and preserves custom settings unless the player changes them.

## Settings outside the main document

The inventory below covers every top-level `SlurpSettings` field. These additional
stores and controls must also be in the design and save/migration proof:

| Store / controls                                                                              | Canonical home                                                                | Scope / handling                                                           |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `SlpSpiceState`: max, language, tastes, never, learned, dismissed                             | Foundation → Content boundaries; linked from affected modules                 | Platform limit/taste state; learned data is not an enable flag.            |
| Post guidance defaults and `creators` overrides: public, locked, menu, level                  | Foundation → Creator defaults / This Creator → Content                        | Defaults, resolved inheritance and hard constraints must be distinguished. |
| Image connection collection and its default                                                   | Shared → Connections; selector linked from Pictures and other image consumers | Connection management stays shared; feature overrides remain explicit.     |
| Creator profile, scheduler and messaging policy                                               | This Creator, with links from the relevant module                             | Per-Creator posting schedule and admission override global defaults.       |
| Creator steering: focus, lifePhase, mood, pace, romance, push/avoid, nudges, turnOns/hardNoes | This Creator → Content and relationships                                      | Family/never-pair restrictions survive Stories Off.                        |
| Creator pages, appearance and image style profiles                                            | Creator tools / Pictures                                                      | Existing records remain; do not use deletion as a disable mechanism.       |
| Viewer identity, notification/display preferences and browser state                           | My view / Shared preferences                                                  | Distinguish persisted viewer state from local browser resume state.        |
| Economy ledgers, DM rapport/memories, reply queues, active arcs/deals and desk records        | Owning feature's retained data                                                | Data and obligations, not module configuration.                            |

`modelBudget` and `simulationTuning` are shared structured documents, not Audience
property. Budget includes DMs, rewrites, fan threads, briefs, banks, arcs,
schedules, fan voice, continuity, writing help, image prompts, Stir plans and
Creator pages. Tuning spans clock/rhythm, reach, reactions, world, funnel,
economy and prompts. Module pages link to the relevant part; a single shared
editor owns each value. No toggle rewrites the whole structured object to defaults.

### Nested settings placement

| Fields                                                            | Home / level                                                | Meaning                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `supportDesk.tickets`                                             | Support / Basic                                             | New ticket frequency, not whole-desk availability                            |
| `supportDesk.noticeMilestones`, `noticeTrending`, `noticeResults` | Support / Basic                                             | Select notices independently                                                 |
| `supportDesk.refusals`, `shadyMoves`                              | Support / Basic                                             | Creator agency and platform behavior; display each separately                |
| `supportDesk.leaving`, `toYourCreators`, `gamesWithYourCreators`  | Support / Detailed                                          | Consequences and which Creators autonomous Support affects                   |
| `supportDesk.trustRate`, `suspicionRate`, `winBackDays`           | Support / Detailed                                          | Simulation rates and recovery                                                |
| `supportDesk.quickReplies`                                        | Support / Detailed                                          | Editable saved replies; also accessible beside the composer                  |
| `drama.level`, `enabled`                                          | Stories / Basic                                             | Intensity and selected situations; independent of module availability        |
| `drama.dials`                                                     | Stories / Detailed                                          | Per-situation options                                                        |
| `modelBudget.mode`                                                | Shared activity / Basic                                     | Off, present or background model-work policy; not a universal feature switch |
| `modelBudget.connectionId`, `callsPerHour`, `callsPerDay`         | Shared activity / Detailed                                  | Shared model connection and caps                                             |
| `modelBudget.jobs.*.enabled`, `priority`, `maxPerDay`             | Shared activity / Detailed                                  | Per-job admission and scheduling; module pages link to these values          |
| `modelBudget.customLimits`, `raisedNotice`                        | Internal                                                    | Track explicit overrides and migration notices                               |
| `simulationTuning.preset`                                         | Shared tuning / Detailed                                    | Whole-simulation preset; state which modules it affects before applying      |
| `simulationTuning.clock.*`, `rhythm.*`                            | Shared tuning / Detailed                                    | Tick cadence, away clock, catch-up caps and daily rhythm                     |
| `simulationTuning.reach.*`, `pulse.*`, `funnel.*`                 | Shared tuning / Detailed; linked from Audience              | Reach, reactions, conversion and churn                                       |
| `simulationTuning.world.*`                                        | Shared tuning / Detailed; linked from Audience and Messages | World action rates, commission/DM/question curves and synthetic unlocks      |
| `simulationTuning.economy.*`                                      | Shared tuning / Detailed; linked from Coins                 | Audience commission price, tip share and crowd weight                        |
| `simulationTuning.prompts.*`                                      | Shared tuning / Detailed; linked from Writing               | Tone text, fan/schedule instructions and reply length                        |
| `storyJobs.*`                                                     | Foundation publishing / Detailed                            | Countdown, newPost, comment, poll, earlier and plain weights                 |
| `audienceReactionBank.shared`, `byType`                           | Audience / Detailed                                         | Saved replies and per-fan-type variants                                      |
| `fanTypes`, `fanArchetypeWeights`, invited-character maps         | Audience / Detailed                                         | User-authored personas and their activity, not new modules                   |
| `arcLibrary`, `platformEvents`, `contentPacks`                    | Stories / Detailed                                          | Editable content and selected packs; preserve records and IDs                |
| `promptPresets`, `promptInstructions`, `promptBlocks`             | Shared writing / Detailed                                   | Existing reusable editing tools; preserve links from module controls         |

Budget job links: `dm_reply` and `continuity` → Messages; `thread`, `bank_grow`,
`fan_type_voice` → Audience; `arc` → Stories; `schedule` → Foundation;
`image_prompt` → Pictures; `page` → Creator pages; `assist` → shared writing;
`plan` → Stir. `rewrite` and `brief` are cross-feature jobs, so show their usage
sources rather than pretending one module owns them. Per-job limits still share
the same ledger and do not promise a provider-billing hard cap.

## Messages pilot: one experience before the full system

This pilot is the next design/implementation unit. It covers only a sample
Opening Day introduction, a Messages Settings destination, and Mari's Creator
override view. These use the same control presentation and actual Slurp bubbles,
buttons and selection styling. Selected options use tint/ring; solid primary
styling means Continue or Save, not both selection and submission.

Use sample content and draft values, without network mutations or model calls.
Do not add runtime module switches, migrate Creator records, redesign G or
rebuild all module pages in this unit. Add/Maybe later and a module Off scenario
can be illustrated as proposed behavior; they must not appear to be operational
controls for the installed Slurp. The distinction must be visible in the prototype.

### Opening Day and Settings

Support introduces Messages through a short sample conversation. Add keeps the
recommended draft, Tune opens the shared controls, and Maybe later leaves the
draft module selection unchanged. Review shows exact chosen behaviors and their
scope. In Settings, the same card opens those controls directly:

> **Messages**
>
> Talk privately with Creators, build relationships and request commissions.
>
> Replies while you're away: Off
>
> Configure

Common controls:

| Control                    | Copy / consequence                                                                             | Scope                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Replies while you're away  | Creators can finish answering pending messages without another tap. Uses your text connection. | All Slurp; not an unsolicited-message switch     |
| New conversations          | Creator default. Controls how new conversations enter; ongoing chats stay open.                | Fallback for Creators without a configured value |
| Fee to open a conversation | Show only for paid admission; state when Coins charging is Off.                                | Creator default linked to admission              |
| AI reply readiness         | AI replies need a text connection · Choose connection                                          | Shared capability; retain history/export         |
| Set rules for a Creator    | Opens that Creator's Messages controls                                                         | This Creator                                     |

Away replies Off does not mean all replies require a separate tap. Sending can
still produce an immediate answer. Already-written delayed bubbles and finished
paid commissions still arrive. Unprompted messages and follow-ups use other
policies. The summary describes each operation instead of one vague Manual mode.

Observed admission behavior, from `admitSlurpThread`:

| Stored policy | Proposed label                 | Current consequence                                                                    |
| ------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| `open`        | Open                           | New conversations open immediately.                                                    |
| `subscribers` | Requests                       | Subscribers open immediately; other people enter requests.                             |
| `paid`        | Paid entry                     | Subscribers open immediately; others pay the opening fee when coin charging is active. |
| `closed`      | Subscribers and existing chats | Subscribers may open new conversations; existing active conversations stay open.       |

Existing declined conversations remain declined even for subscribers. Do not
label these policies Subscribers only or Nobody can message. If we want a true
closed-to-all-new-chats policy, that is an explicit future behavior change.

More controls groups existing settings into Reply timing and availability,
Messages per reply (bubble count, not text length), Pictures in chats, Cool-off,
and Commissions/templates. Keep exact timing bounds and editable templates
accessible rather than hiding them behind a preset that overwrites custom values.
Subscription, post unlock and paid-picture prices have one canonical home in
Coins & earnings, with contextual links from Messages and Creator tools.

Remove the separate Set up messages mini-wizard when these shared controls cover
its job. Do not merge away replies with Writes first, or module Off with Pause
all. If a timing preset is added later, preserve Custom and show its actual patch.

### This Creator and inheritance

> **Mari · Messages**
>
> These rules apply to Mari. Reply automation still follows your Slurp-wide setting.

Common controls are New conversations and Writes first. Writes first says
"Allow unprompted messages and follow-ups from Mari"; it is independent of the
Slurp-wide away-reply setting. Prices and commission rules are linked nearby.

Proposed inheritance presentation:

> New conversations: Requests · Using Slurp default → Change
>
> New conversations: Open · Custom for Mari → Use Slurp default

Show the effective value, its source and whether the edit is draft or saved.
This future per-field inheritance must be visibly labelled as proposed in the
prototype: the current full-object writer does not implement it. Do not offer
Creator-specific away replies when that setting is currently only global.

### Six acceptance tasks

1. A beginner adds Messages with away replies Off, reviews the setup, then finds
   the same control in Settings and changes it without repeating onboarding.
2. An experienced player enables away replies and correctly explains whether
   Mari may write first; they find that separate Creator control.
3. The player changes Mari's admission while another Creator follows the default,
   restores Mari to inheritance, and identifies draft versus saved values.
4. With Requests selected, the player correctly predicts admission for a
   subscriber, a non-subscriber and an existing active conversation.
5. In the proposed Off scenario, the player sees a paid commission and an
   already-written delayed reply, predicts what still arrives, and finds retained
   history/export. They distinguish this from global Pause.
6. Without a text connection, the player understands that new AI replies cannot
   start, finds connection setup, and recognizes that completed deliveries do not
   need another generation call.

For this pilot to pass, each task needs a discoverable destination and a correct
explanation of the resulting behavior. Record misinterpretations and revise in
one bounded pass. Code checks and screenshots prove mechanics and visual quality;
they do not substitute for a player trying these tasks. No user validation has
been performed yet.

### Product decisions to resolve before runtime work

- Should closed admission eventually reject all new chats, including subscribers?
- Does Writes first stay per Creator, gain a global default, or gain a platform
  prohibition? Those are different policies, not alternative labels.
- Which Creator fields support live inheritance, and how do legacy snapshots
  preserve existing effective values without guessing their authors' intent?
- Does Pictures mean generated pictures only? The current proposal keeps
  uploads/gallery use and historical images; the final name must communicate it.
- Which posting/audience activity is recommended, and which may run while away?
  Spell out each source of activity and model work in the final review.

## Implementation slices after design review

| Slice                     | Deliverable                                                                        | Required proof                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1 Messages concept        | Evidence-backed common/detailed controls and explicit proposed-state labels        | Truthful admission, reply, scope and inheritance descriptions                                             |
| 2 Shared sample prototype | Opening Day, Settings and Mari views using the same controls and real presentation | No mutations/model calls; 390/768/1440; reduced motion; both visual themes                                |
| 3 Task validation         | Run the six acceptance tasks and revise the concept                                | Predictions and destinations recorded; unresolved decisions explicit                                      |
| 4 Narrow production slice | Shared Messages controls; minimum selected persistence/runtime work                | Preserve legacy values; partial edits; committed deliveries; no connection; no false master switch        |
| 5 Broader modules         | Apply the proven pattern, then implement independently audited availability gates  | Key/search coverage; routes, actions, schedulers, catch-up and drains; obligations; no catch-up burst     |
| 6 Migration and release   | Shared guided setup and Settings across modules, locales and package release       | Age check; recommended/custom paths; reload; failure/restart; existing installations; package/live checks |

Existing layer rules still apply: reusable presentation in client `modules/`,
feature-specific controls with their owner, Backstage as composition/navigation,
shared policies only where both sides use them. Prefer existing schemas and
helpers over a second settings document. Add the minimum persisted enable state
only where it represents new independent intent; derive readiness and summaries
from actual capabilities and settings.

Before claiming a final save succeeded, all existing separate writes (settings,
spice/guidance, image default and eventual module state) need coordinated failure
handling. Onboarding must not be marked completed after a partial save. Current
Settings patches merge at the top level; nested edits must preserve sibling fields
and protect against concurrent edits rather than blindly sending stale objects.

## Evidence and limits

Read-only code audit plus a clone-agent UX review; no module behavior or UI is
implemented by this document. The review identified admission exceptions, separate
unsolicited-message policy and the lack of live per-field Creator inheritance.
No build, version change, release, production edit or user-data migration occurred.

Primary local evidence, relative to `../src/engine/packages/`:

- `client/src/slp/features/backstage/slp-backstage-placement.ts`: 152 top-level
  settings, canonical homes, current scope and internal markers. Creator defaults
  have globally stored fallback values, not platform-wide admission restrictions.
- `client/src/slp/features/settings/slp-settings-contract.ts` and
  `server/src/slp/modules/settings/slp-settings.ts`: current keys/types/defaults.
- `shared/src/slp/slp-tuning.ts`: audience Off patch changes both
  `fanActivityEnabled` and `worldActivity`; this is a shared-world coupling.
- `server/src/slp/features/world/slp-drama-service.ts`: drama reads `worldActivity`.
- `server/src/slp/modules/messages/slp-messaging.ts`: admission preserves active
  threads and admits subscribers before evaluating a new-thread policy.
- `server/src/slp/data/messages/slp-messages-storage-base.ts`: Creator edits
  persist full resolved objects; field-level live reset is not implemented.
- `server/src/slp/features/messages/slp-message-scheduler-service.ts`: automatic
  reply generation is separate from committed bubble/commission delivery.
- `server/src/slp/workflows/slp-world-tick-workflow.ts`: catch-up and model drains
  coordinate several features; gating a visible page alone is insufficient.
- `server/src/slp/features/messages/desk/slp-desk-tick-operation.ts` and
  `shared/src/slp/slp-support-desk.ts`: tickets, notices, contracts and autonomous
  effects are separate; no master desk switch.
- `server/src/slp/data/economy/slp-economy-storage-1.ts` and `-2.ts`: wallet Off
  changes charges/renewals while keeping subscription/unlock records.
- `shared/src/slp/slp-drama.ts`: enabled pack IDs and dials are preferences to keep.
- `client/src/slp/modules/post/SlpPostCard.tsx`, `SlpLockedPostCard.tsx` and
  `modules/chrome/SlpButton.tsx`: actual presentation exists, but some components
  include live behavior that must be isolated from a sample preview.

The simple/detailed control split follows
[progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
The module grouping itself is a Slurp-specific proposal to validate with a shared
setup/Settings prototype, not a claim that every boundary is already implemented.

## Complete top-level inventory

Each key has one canonical proposed home. Modules may provide contextual links
to a shared control without owning a second copy. Basic is initially visible;
Detailed lives under More controls; Internal is retained without a normal editor.
Scope in this table is current storage/placement, not a promise of per-viewer storage.
Structured records are expanded in the sections above.

### Foundation (18 keys)

| Key                           | Current scope | Level    | Note                               |
| ----------------------------- | ------------- | -------- | ---------------------------------- |
| `storyRate`                   | All Slurp     | Basic    | —                                  |
| `storyLifetimeHours`          | All Slurp     | Detailed | —                                  |
| `teaserRate`                  | All Slurp     | Detailed | —                                  |
| `discoveryTags`               | All Slurp     | Detailed | —                                  |
| `refreshesPerDay`             | All Slurp     | Internal | —                                  |
| `postsPerDay`                 | All Slurp     | Basic    | —                                  |
| `autoPostingScheduleEnabled`  | All Slurp     | Basic    | —                                  |
| `autoPostGenerationMode`      | All Slurp     | Detailed | —                                  |
| `allowProfessorMari`          | All Slurp     | Internal | —                                  |
| `postMaxLength`               | All Slurp     | Detailed | —                                  |
| `postShowMoreLength`          | All Slurp     | Detailed | —                                  |
| `professorMariCreatorSource`  | All Slurp     | Detailed | —                                  |
| `postPlanner`                 | All Slurp     | Detailed | —                                  |
| `lifeMomentRate`              | All Slurp     | Detailed | —                                  |
| `storyJobs`                   | All Slurp     | Detailed | —                                  |
| `maxGeneratedPostsPerRefresh` | All Slurp     | Internal | —                                  |
| `nightQuiet`                  | All Slurp     | Basic    | —                                  |
| `postsPerDayCustom`           | All Slurp     | Internal | Custom pace versus sized defaults. |

### Audience (16 keys)

| Key                         | Current scope | Level    | Note                                            |
| --------------------------- | ------------- | -------- | ----------------------------------------------- |
| `audienceTone`              | All Slurp     | Basic    | —                                               |
| `platformScale`             | All Slurp     | Basic    | —                                               |
| `fanActivityEnabled`        | All Slurp     | Basic    | Automatic fan flag; manual calls can bypass it. |
| `allowRandomUsers`          | All Slurp     | Detailed | —                                               |
| `audienceCharacters`        | All Slurp     | Detailed | —                                               |
| `audienceCharacterGroupIds` | All Slurp     | Detailed | —                                               |
| `audienceCharacterLimit`    | All Slurp     | Detailed | —                                               |
| `maxLikesPerRefresh`        | All Slurp     | Internal | —                                               |
| `maxRepliesPerRefresh`      | All Slurp     | Internal | —                                               |
| `fanActivityRunsPerDay`     | All Slurp     | Basic    | —                                               |
| `audienceReactionBank`      | All Slurp     | Detailed | —                                               |
| `fanLikesPerRefresh`        | All Slurp     | Detailed | —                                               |
| `fanRepliesPerRefresh`      | All Slurp     | Detailed | —                                               |
| `creatorRepliesPerDay`      | All Slurp     | Detailed | —                                               |
| `fanArchetypeWeights`       | All Slurp     | Detailed | —                                               |
| `fanTypes`                  | All Slurp     | Detailed | —                                               |

### Pictures (22 keys)

| Key                                  | Current scope          | Level    | Note                                                  |
| ------------------------------------ | ---------------------- | -------- | ----------------------------------------------------- |
| `imageWidth`                         | All Slurp              | Detailed | —                                                     |
| `imageHeight`                        | All Slurp              | Detailed | —                                                     |
| `storyImagesEnabled`                 | All Slurp              | Detailed | Publishing preference in Pictures; needs story posts. |
| `storyImageWidth`                    | All Slurp              | Detailed | —                                                     |
| `storyImageHeight`                   | All Slurp              | Detailed | —                                                     |
| `imageContextMode`                   | All Slurp              | Detailed | —                                                     |
| `imageContextConnectionId`           | All Slurp              | Detailed | —                                                     |
| `imageStyleProfileId`                | All Slurp              | Basic    | —                                                     |
| `imageGenerationPrompt`              | All Slurp              | Detailed | —                                                     |
| `imagePromptInterpretation`          | All Slurp              | Detailed | —                                                     |
| `enableImageInterpretation`          | All Slurp              | Detailed | —                                                     |
| `imagePromptConnectionId`            | All Slurp              | Detailed | —                                                     |
| `imageGenerationUseAvatarReferences` | All Slurp              | Detailed | —                                                     |
| `appearanceProfileMode`              | All Slurp              | Detailed | —                                                     |
| `imageGenerationIncludeDescriptions` | All Slurp              | Detailed | —                                                     |
| `imageAppearanceMode`                | All Slurp              | Detailed | —                                                     |
| `autoPostingImagesEnabled`           | All Slurp              | Basic    | Automatic post pictures only.                         |
| `characterImageInstructions`         | Creator / pair records | Detailed | Per-Creator map.                                      |
| `creatorImageNames`                  | Creator / pair records | Detailed | Per-Creator map.                                      |
| `enableImagePrompts`                 | All Slurp              | Internal | —                                                     |
| `maxImagesPerRefresh`                | All Slurp              | Internal | —                                                     |
| `allowGalleryImageAttachments`       | All Slurp              | Detailed | —                                                     |

### Messages (21 keys)

| Key                                    | Current scope                    | Level    | Note                                                   |
| -------------------------------------- | -------------------------------- | -------- | ------------------------------------------------------ |
| `messagesAwayRepliesEnabled`           | All Slurp                        | Basic    | New away replies only; committed delivery is separate. |
| `messagesReplyBubbleLimit`             | All Slurp                        | Detailed | —                                                      |
| `messagesDefaultDmPolicy`              | Creator default (global storage) | Basic    | Creator default; retain explicit Creator overrides.    |
| `messagesDefaultRequestFee`            | Creator default (global storage) | Basic    | Creator default; charging also depends on Coins.       |
| `messagesUnscheduledAlwaysReachable`   | All Slurp                        | Detailed | —                                                      |
| `messagesHighRapportDelayMinMinutes`   | All Slurp                        | Detailed | —                                                      |
| `messagesHighRapportDelayMaxMinutes`   | All Slurp                        | Detailed | —                                                      |
| `messagesMediumRapportDelayMinMinutes` | All Slurp                        | Detailed | —                                                      |
| `messagesMediumRapportDelayMaxMinutes` | All Slurp                        | Detailed | —                                                      |
| `messagesUnknownReturnDelayMinutes`    | All Slurp                        | Detailed | —                                                      |
| `messagesMaxReplyDelayMinutes`         | All Slurp                        | Detailed | —                                                      |
| `messagesRecentPostAwayMinMinutes`     | All Slurp                        | Detailed | —                                                      |
| `messagesRecentPostAwayMaxMinutes`     | All Slurp                        | Detailed | —                                                      |
| `messagesStalePostAwayMinMinutes`      | All Slurp                        | Detailed | —                                                      |
| `messagesStalePostAwayMaxMinutes`      | All Slurp                        | Detailed | —                                                      |
| `messagesViewerImageCooldownMinutes`   | All Slurp                        | Detailed | —                                                      |
| `messagesCoolOffMinutes`               | All Slurp                        | Detailed | —                                                      |
| `messagesQuoteAnswerMinutes`           | All Slurp                        | Detailed | —                                                      |
| `messagesFanOpeners`                   | All Slurp                        | Detailed | —                                                      |
| `messagesCommissionOpeners`            | All Slurp                        | Detailed | —                                                      |
| `messagesCommissionAsks`               | All Slurp                        | Detailed | —                                                      |

### Stories & drama (21 keys)

| Key                    | Current scope          | Level    | Note                                              |
| ---------------------- | ---------------------- | -------- | ------------------------------------------------- |
| `projectRate`          | All Slurp              | Detailed | —                                                 |
| `arcPace`              | All Slurp              | Detailed | —                                                 |
| `arcAffectsMood`       | All Slurp              | Detailed | —                                                 |
| `arcFanReactions`      | All Slurp              | Detailed | —                                                 |
| `arcAutoMode`          | All Slurp              | Basic    | —                                                 |
| `arcCooldownWeeks`     | All Slurp              | Detailed | —                                                 |
| `arcSource`            | All Slurp              | Detailed | —                                                 |
| `arcMaxConcurrentAuto` | All Slurp              | Detailed | —                                                 |
| `arcDirectorMode`      | All Slurp              | Detailed | —                                                 |
| `arcPollHours`         | All Slurp              | Detailed | —                                                 |
| `arcStatEffects`       | All Slurp              | Detailed | —                                                 |
| `arcCrossovers`        | All Slurp              | Detailed | —                                                 |
| `arcLibrary`           | All Slurp              | Detailed | —                                                 |
| `contentPacks`         | All Slurp              | Detailed | Selected content; module Off preserves choices.   |
| `creatorCollabs`       | Creator / pair records | Detailed | Pair rules; link from Creator tools and Stories.  |
| `sharedPreseed`        | All Slurp              | Detailed | —                                                 |
| `sharedWorldEvents`    | All Slurp              | Detailed | —                                                 |
| `platformEvents`       | All Slurp              | Detailed | —                                                 |
| `storyAutomation`      | All Slurp              | Basic    | —                                                 |
| `polyamory`            | All Slurp              | Detailed | —                                                 |
| `drama`                | All Slurp              | Basic    | Nested level, IDs and dials; preserve selections. |

### Coins & earnings (14 keys)

| Key                                | Current scope                    | Level    | Note                                                 |
| ---------------------------------- | -------------------------------- | -------- | ---------------------------------------------------- |
| `walletEnabled`                    | All Slurp                        | Basic    | Charge/reward policy; access remains when false.     |
| `walletUnlockCost`                 | All Slurp                        | Basic    | —                                                    |
| `walletSubscriptionCost`           | All Slurp                        | Basic    | —                                                    |
| `messagesDefaultPpvPrice`          | Creator default (global storage) | Detailed | Creator default; charging also depends on Coins.     |
| `pricingDynamicCharacters`         | All Slurp                        | Detailed | —                                                    |
| `pricingMaxWeeklyChangePercent`    | All Slurp                        | Detailed | —                                                    |
| `walletStipendFloor`               | All Slurp                        | Detailed | —                                                    |
| `walletDayStartHour`               | All Slurp                        | Detailed | —                                                    |
| `walletPayoutDailyLimit`           | All Slurp                        | Basic    | —                                                    |
| `walletAdReward`                   | All Slurp                        | Detailed | Coins owns rewards; depends on eligible ad activity. |
| `walletAdDailyCap`                 | All Slurp                        | Detailed | Coins owns reward cap; contextual link from Ads.     |
| `walletEngagementReward`           | All Slurp                        | Detailed | —                                                    |
| `walletEngagementDailyCap`         | All Slurp                        | Detailed | —                                                    |
| `walletCreatorRevenueSharePercent` | All Slurp                        | Detailed | —                                                    |

### Brands & ads (13 keys)

| Key                          | Current scope | Level    | Note                                                      |
| ---------------------------- | ------------- | -------- | --------------------------------------------------------- |
| `inlineAdsEnabled`           | All Slurp     | Basic    | —                                                         |
| `inlineAdsFrequency`         | All Slurp     | Basic    | —                                                         |
| `brandDealsPace`             | All Slurp     | Basic    | —                                                         |
| `inlineAdsSteering`          | All Slurp     | Detailed | —                                                         |
| `inlineAdsPreferredTags`     | All Slurp     | Detailed | —                                                         |
| `inlineAdsContentCeiling`    | All Slurp     | Detailed | —                                                         |
| `inlineAdsTone`              | All Slurp     | Basic    | —                                                         |
| `inlineAdsEra`               | All Slurp     | Detailed | —                                                         |
| `inlineAdsWorldContext`      | All Slurp     | Detailed | —                                                         |
| `inlineAdsImagesEnabled`     | All Slurp     | Detailed | Ads preference; drawing also requires Pictures readiness. |
| `inlineAdsImageConnectionId` | All Slurp     | Detailed | Ads image override; connection management stays shared.   |
| `inlineAdsLorebookId`        | All Slurp     | Detailed | —                                                         |
| `inlineAdsLorebookRevision`  | All Slurp     | Internal | —                                                         |

### Support desk (1 keys)

| Key           | Current scope | Level | Note                                          |
| ------------- | ------------- | ----- | --------------------------------------------- |
| `supportDesk` | All Slurp     | Basic | Nested editor; tickets Off is not module Off. |

### Shared / Connections (5 keys)

| Key                      | Current scope | Level    | Note |
| ------------------------ | ------------- | -------- | ---- |
| `generationConnectionId` | All Slurp     | Basic    | —    |
| `pageConnectionId`       | All Slurp     | Basic    | —    |
| `carryoverModes`         | All Slurp     | Detailed | —    |
| `carryoverHours`         | All Slurp     | Detailed | —    |
| `carryoverMaxItems`      | All Slurp     | Detailed | —    |

### Shared / Writing (7 keys)

| Key                     | Current scope | Level    | Note                                      |
| ----------------------- | ------------- | -------- | ----------------------------------------- |
| `generationGuidance`    | All Slurp     | Detailed | Writing voice; spice has separate stores. |
| `promptPresets`         | All Slurp     | Detailed | —                                         |
| `promptInstructions`    | All Slurp     | Detailed | —                                         |
| `classicPromptBlocks`   | All Slurp     | Internal | —                                         |
| `promptBlocks`          | All Slurp     | Detailed | —                                         |
| `enableLorebookContext` | All Slurp     | Detailed | —                                         |
| `flavourFromAgents`     | All Slurp     | Detailed | —                                         |

### Shared / Activity & budget (4 keys)

| Key                | Current scope | Level    | Note                                                         |
| ------------------ | ------------- | -------- | ------------------------------------------------------------ |
| `worldActivity`    | All Slurp     | Detailed | Shared-world multiplier; Audience Off must not mute Drama.   |
| `simulationTuning` | All Slurp     | Detailed | Shared record with clock, economy and other domain sections. |
| `modelBudget`      | All Slurp     | Basic    | Shared ledger/policy; module sections link to their jobs.    |
| `paused`           | All Slurp     | Basic    | Global pause; not a module enable bit.                       |

### Shared / Viewing preferences (3 keys)

| Key                    | Current scope | Level    | Note                                               |
| ---------------------- | ------------- | -------- | -------------------------------------------------- |
| `previewOpensPost`     | All Slurp     | Detailed | Currently global viewing preference.               |
| `previewWholePictures` | All Slurp     | Basic    | Currently global viewing preference.               |
| `blurPictures`         | All Slurp     | Basic    | Currently global; My view requires storage change. |

### Shared / Storage & backup (6 keys)

| Key                            | Current scope | Level    | Note                                |
| ------------------------------ | ------------- | -------- | ----------------------------------- |
| `autopurgeEnabled`             | All Slurp     | Basic    | —                                   |
| `autopurgeRetentionValue`      | All Slurp     | Detailed | —                                   |
| `autopurgeRetentionUnit`       | All Slurp     | Detailed | —                                   |
| `autopurgeKeepPosts`           | All Slurp     | Detailed | —                                   |
| `autopurgeIncludeMessageMedia` | All Slurp     | Detailed | —                                   |
| `autopurgeNextRunAt`           | All Slurp     | Internal | Runtime schedule; no normal editor. |

### Internal setup state (1 keys)

| Key          | Current scope              | Level    | Note                               |
| ------------ | -------------------------- | -------- | ---------------------------------- |
| `onboarding` | New Creators / setup state | Internal | Completion protocol; not a module. |

Inventory check: 152 unique keys; exact set equality with both the current
`SlurpSettings` type and `SLP_BACKSTAGE_SETTING_PLACEMENT`. This is a snapshot of
the audited commit; implementation must rerun coverage against the then-current
schema. No existing persisted key is renamed by this proposal.
