import { useState } from "react";
import { ChevronDown, RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_EYEBROW_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpButton, SlpChip, SlpPrimaryButton, SlpSegment, slpTagClass } from "../../modules/chrome/SlpButton";
import { SlpPeopleGraph } from "../../modules/creator/SlpPeopleGraph";
import { SlpPersonSearch } from "../../modules/creator/SlpPersonSearch";
import { formatRelativeTime } from "../../base/ui/slp-date-time";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { useSlurpTies, useSlurpTiesMutations, type SlurpTiesBondKind } from "./slp-ties-hooks";
import {
  SLP_PEOPLE_EDGE_KINDS,
  slpBusiestCreator,
  slpEgoTies,
  slpPeopleEdges,
  slpPeopleGraph,
  type SlpPeopleEdge,
  type SlpPeopleEdgeKind,
} from "./slp-people-map";

/** One theme color per kind of tie, for the line, the ring and the legend. */
const KIND_COLOR: Record<SlpPeopleEdgeKind, string> = {
  couple: "var(--noodle-accent)",
  crush: "var(--slurp-coral)",
  ex: "var(--slurp-muted)",
  rival: "var(--slurp-danger)",
  roommate: "var(--slurp-violet)",
  family: "var(--slurp-text)",
  friend: "var(--slurp-success)",
  // Collab is already warm yellow: a teal from two theme colors keeps the two apart.
  coworker: "color-mix(in srgb, var(--slurp-violet) 45%, var(--slurp-success))",
  collab: "var(--slurp-warning)",
};
/** What the player can make two people: a couple ("partner", through the couple rules) or a bond. */
const TIE_CHOICES: readonly (SlurpTiesBondKind | "partner")[] = [
  "partner",
  "friend",
  "family",
  "roommate",
  "coworker",
  "ex",
];

/**
 * Who is what to whom (Drama, People map): one living network. Tap someone to open their people on
 * the map (several at once), tap again to close them; the selected person's ties are listed below,
 * each with why it exists. Friends, roommates, coworkers and exes can be set or ended here; couples,
 * rivalries and collabs are steered in their own panels.
 */
export function SlpPeoplePanel({ personaId }: { personaId: string }) {
  const { t, i18n } = useTranslation();
  const query = useSlurpTies(personaId);
  const actions = useSlurpTiesMutations(personaId);
  const [opened, setOpened] = useState<string[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ otherId: string | null; kind: SlurpTiesBondKind | "partner"; level: number }>({
    otherId: null,
    kind: "friend",
    level: 1,
  });
  const view = query.data;
  if (query.isError)
    return <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.ties.loadFailed")}</p>;
  if (!view) return <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.settings.loading")}</p>;

  const people = view.creators.filter((creator) => !creator.couplePage);
  const byId = new Map(people.map((creator) => [creator.id, creator]));
  const edges = slpPeopleEdges(view).filter((edge) => byId.has(edge.aId) && byId.has(edge.bId));
  const busiest = slpBusiestCreator(
    edges,
    people.map((creator) => creator.id),
  );
  // Nobody opened yet: the Creator with the most ties. People who left drop out on their own.
  const openIds = (opened ?? (busiest ? [busiest] : [])).filter((id) => byId.has(id));
  const center = byId.get(selectedId ?? "") ?? byId.get(openIds.at(-1) ?? "") ?? null;
  if (!center)
    return <p className={cn(SLP_TYPE.body, "text-[var(--slurp-muted)]")}>{t("ui.slurp.people.noCreators")}</p>;
  const graph = slpPeopleGraph(edges, openIds.includes(center.id) ? openIds : [...openIds, center.id]);
  const ties = slpEgoTies(edges, center.id).filter((tie) => byId.has(tie.otherId));
  const open = ties.find((tie) => tie.otherId === openId) ?? null;
  const onError = (error: unknown) => toast.error(errorMessage(error));
  const when = (at: string) => formatRelativeTime(at, i18n.language);
  const kindLabel = (edge: SlpPeopleEdge) =>
    edge.kind === "friend" ? t(`ui.slurp.people.friendLevel.${edge.level}`) : t(`ui.slurp.people.kind.${edge.kind}`);

  const openPerson = (id: string) => {
    setOpened([...openIds.filter((entry) => entry !== id), id]);
    setSelectedId(id);
    setOpenId(null);
  };
  // Tap: open someone (and select them); tap the selected one again to close their people.
  const tap = (id: string) => {
    if (!openIds.includes(id)) return openPerson(id);
    if (center.id !== id) return setSelectedId(id);
    const rest = openIds.filter((entry) => entry !== id);
    if (!rest.length) return;
    setOpened(rest);
    setSelectedId(rest.at(-1)!);
  };

  const added = {
    onSuccess: () => {
      setAdding((current) => ({ ...current, otherId: null }));
      toast.success(t("ui.slurp.people.added"));
    },
    onError,
  };
  // A partner is a couple: with one of the player's own pages it starts together and stays as set.
  const add = () =>
    adding.otherId &&
    (adding.kind === "partner"
      ? actions.setUp.mutate({ aId: center.id, bId: adding.otherId }, added)
      : actions.setBond.mutate(
          {
            aId: center.id,
            bId: adding.otherId,
            kind: adding.kind,
            level: adding.kind === "friend" ? adding.level : undefined,
          },
          added,
        ));

  return (
    <div data-slurp-people className="flex flex-col gap-5">
      <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.people.intro")}</p>
      <SlpPeopleGraph
        people={graph.ids.flatMap((id) => {
          const person = byId.get(id);
          return person
            ? [
                {
                  id,
                  name: person.name,
                  avatarUrl: person.avatarUrl,
                  open: openIds.includes(id),
                  selected: id === center.id,
                },
              ]
            : [];
        })}
        ties={graph.ties.map((edge) => ({
          a: edge.aId,
          b: edge.bId,
          color: KIND_COLOR[edge.kind],
          closeness: edge.level,
          dash: edge.temperature === "warm" ? undefined : edge.temperature,
        }))}
        onTap={tap}
        label={t("ui.slurp.people.mapLabel", { name: center.name })}
      />
      <p className={cn(SLP_TYPE.meta, "text-center text-[var(--slurp-muted)]")}>{t("ui.slurp.people.howTo")}</p>
      <Legend />
      <div className="flex flex-col gap-2">
        <SlpPersonSearch people={people} picked={openIds} onPick={openPerson} label={t("ui.slurp.people.find")} />
        {openIds.length > 1 && (
          <SlpButton
            variant="tertiary"
            onClick={() => {
              setOpened([center.id]);
              setSelectedId(center.id);
            }}
            className="min-h-11 self-start"
          >
            <RotateCcw size={16} aria-hidden="true" />
            {t("ui.slurp.people.onlyThis", { name: center.name })}
          </SlpButton>
        )}
      </div>
      {!ties.length && (
        <p className={cn(SLP_TYPE.body, "text-center text-[var(--slurp-muted)]")}>
          {t("ui.slurp.people.empty", { name: center.name })}
        </p>
      )}

      {ties.length > 0 && (
        <section className="space-y-2" aria-label={t("ui.slurp.people.listTitle", { name: center.name })}>
          <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.people.listTitle", { name: center.name })}</h4>
          <ul className="divide-y divide-[var(--noodle-divider)]">
            {ties.map(({ otherId, edges: list }) => {
              const other = byId.get(otherId)!;
              return (
                <li key={otherId}>
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === otherId ? null : otherId)}
                    aria-expanded={openId === otherId}
                    className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                  >
                    <Avatar account={{ displayName: other.name, avatarUrl: other.avatarUrl }} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={cn(SLP_TYPE.body, "block font-semibold [overflow-wrap:anywhere]")}>
                        {other.name}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {list.map((edge) => (
                          <span key={edge.id} className={slpTagClass()}>
                            <Dot color={KIND_COLOR[edge.kind]} />
                            {kindLabel(edge)}
                            {edge.temperature !== "warm" &&
                              ` · ${t(`ui.slurp.people.temperature.${edge.temperature}`)}`}
                          </span>
                        ))}
                      </span>
                    </span>
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className={cn("shrink-0 text-[var(--slurp-muted)]", openId === otherId && "rotate-180")}
                    />
                  </button>
                  {open?.otherId === otherId && (
                    <div className="flex flex-col gap-4 pb-3 ps-11" data-slurp-people-tie>
                      {open.edges.map((edge) => (
                        <TieDetail
                          key={edge.id}
                          edge={edge}
                          title={kindLabel(edge)}
                          name={(id) => byId.get(id)?.name ?? t("ui.slurp.ties.someone")}
                          when={when}
                          busy={actions.setBond.isPending || actions.endBond.isPending}
                          onLevel={(level) =>
                            edge.source.type === "bond" &&
                            actions.setBond.mutate(
                              { aId: edge.aId, bId: edge.bId, kind: edge.source.bond.kind, level },
                              { onError },
                            )
                          }
                          onEnd={() =>
                            edge.source.type === "bond" &&
                            actions.endBond.mutate(edge.source.bond.id, {
                              onSuccess: () => toast.success(t("ui.slurp.people.ended")),
                              onError,
                            })
                          }
                        />
                      ))}
                      <SlpButton
                        variant="quiet"
                        onClick={() => openPerson(otherId)}
                        className="min-h-11 w-full sm:w-auto"
                      >
                        {t("ui.slurp.people.center", { name: other.name })}
                      </SlpButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-label={t("ui.slurp.people.addTitle", { name: center.name })}>
        <h4 className={cn(SLP_EYEBROW_CLASS, "px-1")}>{t("ui.slurp.people.addTitle", { name: center.name })}</h4>
        <SlpPersonSearch
          people={people.filter((creator) => creator.id !== center.id)}
          picked={adding.otherId ? [adding.otherId] : []}
          onPick={(id) => setAdding((current) => ({ ...current, otherId: current.otherId === id ? null : id }))}
          label={t("ui.slurp.people.addWho")}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("ui.slurp.people.addKind")}>
          {TIE_CHOICES.map((kind) => (
            <SlpChip
              key={kind}
              selected={adding.kind === kind}
              onClick={() => setAdding((current) => ({ ...current, kind }))}
            >
              {t(`ui.slurp.people.kind.${kind === "partner" ? "couple" : kind}`)}
            </SlpChip>
          ))}
        </div>
        {adding.kind === "friend" && (
          <LevelPick value={adding.level} onChange={(level) => setAdding((current) => ({ ...current, level }))} />
        )}
        <SlpPrimaryButton
          disabled={!adding.otherId || actions.setBond.isPending || actions.setUp.isPending}
          onClick={add}
          className="min-h-11 w-full px-4 text-sm sm:w-auto"
        >
          <UserPlus size={16} aria-hidden="true" />
          {adding.otherId ? t("ui.slurp.people.add") : t("ui.slurp.people.addPick")}
        </SlpPrimaryButton>
      </section>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
  );
}

function Legend() {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1" aria-label={t("ui.slurp.people.legend")}>
      {SLP_PEOPLE_EDGE_KINDS.map((kind) => (
        <li key={kind} className={cn(SLP_TYPE.meta, "flex items-center gap-1.5 text-[var(--slurp-muted)]")}>
          <Dot color={KIND_COLOR[kind]} />
          {t(`ui.slurp.people.kind.${kind}`)}
        </li>
      ))}
    </ul>
  );
}

function LevelPick({ value, onChange }: { value: number; onChange: (level: number) => void }) {
  const { t } = useTranslation();
  return (
    <SlpSegment
      label={t("ui.slurp.people.level")}
      options={[0, 1, 2, 3].map((level) => ({
        value: String(level),
        label: t(`ui.slurp.people.friendLevel.${level}`),
      }))}
      value={String(value)}
      onChange={(level) => onChange(Number(level))}
      className="flex-wrap"
    />
  );
}

/** One tie between the two: what it is, since when, and its history in plain lines. */
function TieDetail({
  edge,
  title,
  name,
  when,
  busy,
  onLevel,
  onEnd,
}: {
  edge: SlpPeopleEdge;
  title: string;
  name: (id: string) => string;
  when: (at: string) => string;
  busy: boolean;
  onLevel: (level: number) => void;
  onEnd: () => void;
}) {
  const { t } = useTranslation();
  const lines = historyLines(edge, t, name);
  return (
    <section className="space-y-2">
      <h5 className={cn(SLP_TYPE.body, "flex items-center gap-2 font-semibold")}>
        <Dot color={KIND_COLOR[edge.kind]} />
        {title}
        <span className={cn(SLP_TYPE.meta, "font-normal text-[var(--slurp-muted)]")}>
          {t(`ui.slurp.people.temperature.${edge.temperature}`)} ·{" "}
          {t("ui.slurp.people.since", { when: when(edge.since) })}
        </span>
      </h5>
      {lines.length > 0 && (
        <ol className="space-y-1 border-s border-[var(--noodle-divider)] ps-3">
          {lines.map((line, index) => (
            <li key={index} className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)] [overflow-wrap:anywhere]")}>
              <span className="text-[var(--slurp-text)]">{line.text}</span>
              {line.at && ` · ${when(line.at)}`}
            </li>
          ))}
        </ol>
      )}
      {edge.source.type === "bond" ? (
        <div className="flex flex-col gap-2">
          {edge.source.bond.kind === "friend" && <LevelPick value={edge.level} onChange={onLevel} />}
          {edge.source.bond.locked && (
            <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.people.locked")}</p>
          )}
          <SlpButton variant="danger" disabled={busy} onClick={onEnd} className="min-h-11 w-full sm:w-auto">
            {t(`ui.slurp.people.end.${edge.source.bond.kind}`)}
          </SlpButton>
        </div>
      ) : (
        <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
          {t(`ui.slurp.people.steerElsewhere.${edge.source.type}`)}
        </p>
      )}
    </section>
  );
}

type T = ReturnType<typeof useTranslation>["t"];

/** Why the tie exists, oldest first, in the world's words. */
function historyLines(edge: SlpPeopleEdge, t: T, name: (id: string) => string): { text: string; at?: string }[] {
  const source = edge.source;
  if (source.type === "bond")
    return source.bond.notes.map((entry) => ({
      text: t(`ui.slurp.people.note.${entry.code}`, { detail: entry.detail ?? "" }),
      at: entry.at,
    }));
  if (source.type === "couple")
    return source.couple.moments.slice(-6).map((moment) => ({
      text:
        moment.kind === "jealous" && moment.withId
          ? t("ui.slurp.ties.moment.jealousCollab", { name: name(moment.withId) })
          : moment.kind === "joined" && moment.withId
            ? t("ui.slurp.ties.moment.joined", { name: name(moment.withId) })
            : t(`ui.slurp.ties.moment.${moment.kind}`, { detail: moment.detail }),
      at: moment.at,
    }));
  if (source.type === "rival")
    return [
      {
        text: t("ui.slurp.ties.rivalry.cause", {
          b: name(source.rivalry.toId),
          cause: source.rivalry.cause,
        }),
      },
      {
        text: t(`ui.slurp.ties.rivalry.${source.rivalry.stage}`, {
          a: name(source.rivalry.fromId),
          b: name(source.rivalry.toId),
        }),
        at: source.rivalry.stageAt,
      },
    ];
  return [{ text: source.collab.idea, at: source.collab.askedAt }];
}
