import { useState } from "react";
import { toast } from "sonner";
import { readSlpPollFromMetadata } from "../../../../../shared/src/slp/slp-polls.js";
import { useComposeSlurpCreatorPage } from "../../features/creators/slp-creator-page-hooks";
import { SlpCreatorPageEditor } from "../../features/creators/SlpCreatorPageEditor";
import { useSlurpTies } from "../../features/projects/slp-ties-hooks";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";
import {
  SlpCreatorPage,
  SlpCreatorPageInvite,
  type SlpCreatorPageFact,
  type SlpCreatorPageMenuRow,
} from "../../modules/creator/SlpCreatorPage";
import {
  pickSlpCollageTiles,
  slpPagePeople,
  slpPagePostsPerWeek,
  type SlpPagePicture,
} from "../../modules/creator/slp-creator-page-data";
import { formatSlpNumber } from "../../base/ui/slp-number-format";
import { isSlurpStory, slurpSubscriptionPriceOf } from "./SlpHomeHelpers";
import type { StageProfileViewModel } from "./slp-profile-view-model";

/**
 * The Creator's Page on their profile, between the header and the tabs: the page itself, the invite
 * to make one, and the editor. Everything a block looks up is gathered here from what the profile
 * already loaded, so the Page costs no extra request except the ties behind "People".
 */
export function SlpProfilePage({ model }: { model: StageProfileViewModel }) {
  const {
    profile,
    localizeUi,
    i18n,
    projectedPosts,
    lockedTeasers,
    viewerCreator,
    viewerAccount,
    offerMessaging,
    goalForViewer,
    viewingOwnCreator,
    personaBackedCreator,
    profileLocation,
    subscriberTotal,
    subscribersQuery,
    showProfilePost,
    postCardCtx,
    setTipOpen,
    onOpenMessages,
    editing,
  } = model;
  const [editorOpen, setEditorOpen] = useState(false);
  const compose = useComposeSlurpCreatorPage();
  const page = profile.page ?? null;
  const wantsPeople = Boolean(page?.blocks.some((block) => block.kind === "people"));
  const ties = useSlurpTies(wantsPeople ? (viewerAccount?.entityId ?? null) : null);
  // A couple's shared page belongs to the couple story, not to one Creator.
  if (editing || profile.sourceAccountId?.startsWith("slurp-couple:")) return null;
  const canCompose = !personaBackedCreator;
  const name = profile.displayName;

  // Only what this viewer may see whole: their own open cards. A revealed locked post (operator view)
  // is not a picture fans see, so it never reaches the Page; locked posts appear as server teasers.
  const cards = projectedPosts.flatMap((item) =>
    item.kind === "card" && item.model.authorAccountId === profile.id && !isSlurpStory(item.model) ? [item.model] : [],
  );
  const pictures: SlpPagePicture[] = cards.flatMap((post) =>
    typeof post.imageUrl === "string"
      ? [
          {
            postId: post.id,
            imageUrl: post.imageUrl,
            likeCount: post.likeCount ?? 0,
            createdAt: post.createdAt,
            shootId: typeof post.metadata?.shootId === "string" ? post.metadata.shootId : null,
          },
        ]
      : [],
  );
  const teasers = lockedTeasers.map((teaser) => ({ postId: teaser.id, imageUrl: teaser.imageUrl }));

  const now = Date.now();
  const facts: SlpCreatorPageFact[] = [];
  if (profileLocation)
    facts.push({
      id: "location",
      label: localizeUi("ui.slurp.page.fact.location", { defaultValue: "Based in" }),
      value: profileLocation,
    });
  const perWeek = slpPagePostsPerWeek({
    postDates: projectedPosts.map((item) =>
      item.kind === "card" || item.kind === "managed-reveal" ? item.model.createdAt : item.post.createdAt,
    ),
    createdAt: profile.createdAt,
    now,
  });
  if (perWeek !== null)
    facts.push({
      id: "rhythm",
      label: localizeUi("ui.slurp.page.fact.posts", { defaultValue: "Posts" }),
      value:
        perWeek < 1
          ? localizeUi("ui.slurp.page.fact.postsRarely", { defaultValue: "now and then" })
          : localizeUi("ui.slurp.page.fact.postsPerWeek", {
              defaultValue: "~{{count}}× a week",
              count: Math.round(perWeek),
            }),
    });
  if (subscribersQuery.data)
    facts.push({
      id: "subscribers",
      label: localizeUi("ui.slurp.page.fact.subscribers", { defaultValue: "Subscribers" }),
      value: formatSlpNumber(subscriberTotal, i18n.language),
    });
  const since = Date.parse(profile.createdAt);
  if (!Number.isNaN(since))
    facts.push({
      id: "since",
      label: localizeUi("ui.slurp.page.fact.since", { defaultValue: "On Slurp since" }),
      value: new Intl.DateTimeFormat(i18n.language, { month: "short", year: "numeric" }).format(since),
    });

  const coins = (amount: number, suffix?: string) => <SlurpCoinAmount amount={amount} suffix={suffix} />;
  const menu: SlpCreatorPageMenuRow[] = [
    {
      id: "subscription",
      label: localizeUi("ui.slurp.page.menu.subscription", { defaultValue: "Subscription" }),
      value: coins(
        slurpSubscriptionPriceOf(viewerCreator),
        localizeUi("ui.slurp.page.menu.perWeek", { defaultValue: " / week" }),
      ),
    },
  ];
  if (offerMessaging && offerMessaging.dmPolicy === "paid" && offerMessaging.requestFee > 0)
    menu.push({
      id: "message",
      label: localizeUi("ui.slurp.page.menu.message", { defaultValue: "Message request" }),
      value: coins(offerMessaging.requestFee),
    });
  if (offerMessaging && offerMessaging.commissionMin > 0)
    menu.push({
      id: "commission",
      label: localizeUi("ui.slurp.page.menu.commission", { defaultValue: "Commissions" }),
      value: (
        <>
          {localizeUi("ui.slurp.page.menu.from", { defaultValue: "from" })} {coins(offerMessaging.commissionMin)}
        </>
      ),
      onClick: viewingOwnCreator || offerMessaging.dmPolicy === "closed" ? undefined : () => onOpenMessages(profile.id),
    });
  if (goalForViewer)
    menu.push({
      id: "goal",
      label: goalForViewer.label,
      value: goalForViewer.met
        ? localizeUi("ui.slurp.profile.goalMet", { defaultValue: "Goal met" })
        : `${formatSlpNumber(goalForViewer.raised, i18n.language)} / ${formatSlpNumber(goalForViewer.target, i18n.language)}`,
      onClick: !viewingOwnCreator && viewerCreator && !goalForViewer.met ? () => setTipOpen(true) : undefined,
    });

  const pollPost = cards
    .filter((post) => readSlpPollFromMetadata(post.metadata))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const pollSpec = pollPost ? readSlpPollFromMetadata(pollPost.metadata) : null;

  const onCompose = () =>
    compose.mutate(profile.id, {
      onError: (error) =>
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : localizeUi("ui.slurp.page.composeError", { defaultValue: "The page could not be designed. Try again." }),
        ),
    });

  return (
    <>
      {page ? (
        <SlpCreatorPage
          page={page}
          ownerName={name}
          tilesFor={(block) => pickSlpCollageTiles({ postIds: block.postIds, layout: block.layout, pictures, teasers })}
          facts={facts}
          menu={menu}
          people={slpPagePeople(profile.id, ties.data)}
          poll={
            pollSpec ? { question: pollSpec.question, options: pollSpec.options.map((option) => option.label) } : null
          }
          onOpenPost={showProfilePost}
          onOpenProfile={(accountId) => postCardCtx.openAuthorProfile?.(accountId)}
          onOpenPoll={() => pollPost && showProfilePost(pollPost.id)}
          onEdit={() => setEditorOpen(true)}
          now={now}
        />
      ) : (
        <SlpCreatorPageInvite
          name={name}
          canCompose={canCompose}
          composing={compose.isPending}
          onCompose={onCompose}
          onBuild={() => setEditorOpen(true)}
        />
      )}
      <SlpCreatorPageEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        accountId={profile.id}
        name={name}
        page={page}
        pictures={pictures}
        canCompose={canCompose}
      />
    </>
  );
}
