import type { ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  slpCreatorPageBlockLive,
  type SlpCreatorPage as SlpCreatorPageSpec,
  type SlpCreatorPageBlock,
} from "../../../../../shared/src/slp/slp-creator-page.js";
import { Avatar, SlurpMediaImg } from "../../base/chrome/SlpChrome";
import type { SlpPagePerson, SlpPageTile } from "./slp-creator-page-data";

export type SlpCreatorPageFact = { id: string; label: string; value: string };
export type SlpCreatorPageMenuRow = { id: string; label: string; value: ReactNode; onClick?: () => void };
export type SlpCreatorPagePoll = { question: string; options: string[] };

type CollageBlock = Extract<SlpCreatorPageBlock, { kind: "collage" }>;

/**
 * A Creator's Page: the themed stack of blocks under the profile header (see `slp-creator-page.ts`).
 *
 * Renders from props only. The words come from the stored page; pictures, facts, prices, people and
 * the poll come from the caller, already looked up, and a block with nothing to show is left out.
 */
export function SlpCreatorPage({
  page,
  ownerName,
  tilesFor,
  facts,
  menu,
  people,
  poll,
  onOpenPost,
  onOpenProfile,
  onOpenPoll,
  onEdit,
  now,
}: {
  page: SlpCreatorPageSpec;
  ownerName: string;
  tilesFor: (block: CollageBlock) => SlpPageTile[];
  facts: SlpCreatorPageFact[];
  menu: SlpCreatorPageMenuRow[];
  people: SlpPagePerson[];
  poll: SlpCreatorPagePoll | null;
  onOpenPost: (postId: string) => void;
  onOpenProfile: (accountId: string) => void;
  onOpenPoll: () => void;
  /** Shown to whoever may edit this Page. */
  onEdit?: () => void;
  now: number;
}) {
  const { t: localizeUi } = useUiTranslation();
  const heading = (block: SlpCreatorPageBlock, fallback: string) => {
    const title = "title" in block && block.title ? block.title : fallback;
    return title ? <h3 className="slp-page-title">{title}</h3> : null;
  };
  const render = (block: SlpCreatorPageBlock): ReactNode => {
    switch (block.kind) {
      case "quote":
        return <p className="slp-page-quote">{block.text}</p>;
      case "now":
        return (
          <p className="slp-page-now">
            <span className="slp-page-now-dot" aria-hidden="true" />
            <span>
              <span className="sr-only">{localizeUi("ui.slurp.page.now", { defaultValue: "Now" })}: </span>
              {block.text}
            </span>
          </p>
        );
      case "collage": {
        const tiles = tilesFor(block);
        if (!tiles.length) return null;
        return (
          <>
            {heading(block, "")}
            <div className="slp-page-collage" data-layout={block.layout}>
              {tiles.map((tile) => (
                <button
                  key={tile.postId}
                  type="button"
                  className="slp-page-tile"
                  data-locked={tile.locked ? "" : undefined}
                  onClick={() => onOpenPost(tile.postId)}
                  aria-label={
                    tile.locked
                      ? localizeUi("ui.slurp.page.openLockedPost", { defaultValue: "Subscribers-only post" })
                      : localizeUi("ui.slurp.page.openPost", { defaultValue: "Open post" })
                  }
                >
                  <SlurpMediaImg src={tile.imageUrl} alt="" className="slp-crop-top" loading="lazy" draggable={false} />
                  {tile.locked && (
                    <span className="slp-page-tile-lock" aria-hidden="true">
                      🔒 {localizeUi("ui.slurp.page.subscribersOnly", { defaultValue: "Subscribers" })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        );
      }
      case "list":
        return (
          <>
            {heading(block, "")}
            <ul className="slp-page-list" data-style={block.style}>
              {block.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </>
        );
      case "thisOrThat":
        return (
          <>
            {heading(block, localizeUi("ui.slurp.page.thisOrThat", { defaultValue: "This or that" }))}
            <div className="slp-page-tot">
              {block.pairs.map((pair, index) => (
                <PairRow
                  key={index}
                  pair={pair}
                  or={localizeUi("ui.slurp.page.or", { defaultValue: "or" })}
                  picked={localizeUi("ui.slurp.page.picked", { defaultValue: "picked" })}
                />
              ))}
            </div>
          </>
        );
      case "qa":
        return (
          <>
            {heading(block, localizeUi("ui.slurp.page.qa", { defaultValue: "You asked" }))}
            <dl className="slp-page-qa">
              {block.items.map((item, index) => (
                <div key={index}>
                  <dt>{item.question}</dt>
                  <dd>{item.answer}</dd>
                </div>
              ))}
            </dl>
          </>
        );
      case "facts":
        if (!facts.length) return null;
        return (
          <>
            {heading(block, localizeUi("ui.slurp.page.facts", { defaultValue: "About" }))}
            <dl className="slp-page-facts">
              {facts.map((fact) => (
                <div key={fact.id}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </>
        );
      case "menu":
        if (!menu.length) return null;
        return (
          <>
            {heading(block, localizeUi("ui.slurp.page.menu", { defaultValue: "Prices" }))}
            <div className="slp-page-menu">
              {menu.map((row) =>
                row.onClick ? (
                  <button key={row.id} type="button" className="slp-page-menu-row" onClick={row.onClick}>
                    <span>{row.label}</span>
                    <b>
                      {row.value} <span aria-hidden="true">›</span>
                    </b>
                  </button>
                ) : (
                  <div key={row.id} className="slp-page-menu-row">
                    <span>{row.label}</span>
                    <b>{row.value}</b>
                  </div>
                ),
              )}
            </div>
          </>
        );
      case "people":
        if (!people.length) return null;
        return (
          <>
            {heading(block, localizeUi("ui.slurp.page.people", { defaultValue: "My people" }))}
            <div className="slp-page-people">
              {people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="slp-page-person"
                  data-relation={person.relation}
                  onClick={() => onOpenProfile(person.id)}
                >
                  <Avatar
                    account={{ displayName: person.name, avatarUrl: person.avatarUrl }}
                    size="md"
                    className="slp-page-avatar"
                  />
                  <b>{person.name}</b>
                  {localizeUi(`ui.slurp.page.relation.${person.relation}`, { defaultValue: person.relation })}
                </button>
              ))}
            </div>
          </>
        );
      case "poll":
        if (!poll) return null;
        return (
          <>
            {heading(block, localizeUi("ui.slurp.page.poll", { defaultValue: "Vote" }))}
            <p className="slp-page-poll-q">{poll.question}</p>
            {poll.options.map((option, index) => (
              <button key={index} type="button" className="slp-page-poll-option" onClick={onOpenPoll}>
                {option}
              </button>
            ))}
          </>
        );
    }
  };
  const blocks = page.blocks
    .filter((block) => slpCreatorPageBlockLive(block, now))
    .map((block) => ({ block, body: render(block) }))
    .filter(({ body }) => body !== null);
  if (!blocks.length && !onEdit) return null;
  const label = localizeUi("ui.slurp.page.label", { defaultValue: "{{name}}'s page", name: ownerName });
  return (
    <section className="slp-page" data-theme={page.theme} aria-label={label}>
      <div className="slp-page-head">
        <span className="slp-page-label">{label}</span>
        {onEdit && (
          <button type="button" className="slp-page-button" onClick={onEdit}>
            {localizeUi("ui.slurp.page.edit", { defaultValue: "Edit page" })}
          </button>
        )}
      </div>
      <div className="slp-page-blocks">
        {blocks.map(({ block, body }) => (
          <div
            key={block.id}
            className={
              block.kind === "quote" || block.kind === "now" ? "slp-page-block slp-page-bare" : "slp-page-block"
            }
          >
            {body}
          </div>
        ))}
      </div>
    </section>
  );
}

function PairRow({
  pair,
  or,
  picked,
}: {
  pair: { left: string; right: string; pick: "left" | "right" };
  or: string;
  picked: string;
}) {
  const side = (which: "left" | "right") => (
    <span data-pick={pair.pick === which ? "" : undefined}>
      {pair[which]}
      {pair.pick === which && <span className="sr-only"> ({picked})</span>}
    </span>
  );
  return (
    <>
      {side("left")}
      <span className="slp-page-tot-or">{or}</span>
      {side("right")}
    </>
  );
}

/** No Page yet: the operator can let the Creator design one, or build it themselves. */
export function SlpCreatorPageInvite({
  name,
  canCompose,
  composing,
  onCompose,
  onBuild,
}: {
  name: string;
  /** False for a persona's own page: the player builds it. */
  canCompose: boolean;
  composing: boolean;
  onCompose: () => void;
  onBuild: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <section className="slp-page" data-theme="slurp">
      <div className="slp-page-invite">
        <p>
          <strong>{localizeUi("ui.slurp.page.inviteTitle", { defaultValue: "Give {{name}} a page", name })}</strong>
          {localizeUi("ui.slurp.page.inviteBody", {
            defaultValue: "Pictures, lists and a look of their own, above the posts.",
          })}
        </p>
        <div className="slp-page-invite-actions">
          {canCompose && (
            <button type="button" className="slp-page-button" data-primary="" disabled={composing} onClick={onCompose}>
              {composing
                ? localizeUi("ui.slurp.page.composing", { defaultValue: "{{name}} is designing…", name })
                : localizeUi("ui.slurp.page.compose", { defaultValue: "Let {{name}} design it", name })}
            </button>
          )}
          <button type="button" className="slp-page-button" onClick={onBuild}>
            {localizeUi("ui.slurp.page.build", { defaultValue: "Build it yourself" })}
          </button>
        </div>
      </div>
    </section>
  );
}
