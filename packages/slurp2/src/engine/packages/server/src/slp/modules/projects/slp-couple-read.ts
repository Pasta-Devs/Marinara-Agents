/**
 * The stored shape of couples (`slp-creator-couples.ts`), read back tolerantly: a broken entry is
 * dropped, an unknown stage reads as over, and nothing else is guessed.
 */
import { clampText } from "./slp-project.js";
import type {
  SlurpCouple,
  SlurpCoupleForced,
  SlurpCoupleMoment,
  SlurpCoupleMomentKind,
  SlurpCoupleStage,
} from "./slp-creator-couples.js";

const STAGES: readonly SlurpCoupleStage[] = ["sparks", "dating", "together", "rocky", "split"];
const AFTERMATHS = ["moveOn", "forget"] as const;
const FORCED: readonly SlurpCoupleForced["misfit"][] = ["taken", "notInto", "noDating", "orientation"];
const KINDS: readonly SlurpCoupleMomentKind[] = [
  "flirt",
  "date",
  "launch",
  "anniversary",
  "jealous",
  "fight",
  "makeup",
  "breakup",
  "reunion",
  "pageOpen",
  "pageClose",
  "movingOn",
  "joined",
];
const record = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const date = (value: unknown) => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null);
/** Joined partners (polyamory): up to two more, never the pair themselves. */
const slurpReadMoreIds = (value: unknown, aId: string, bId: string) => {
  const more = [...new Set(strings(value, 2).filter((id) => id !== aId && id !== bId))];
  return more.length ? { moreIds: more } : {};
};
const strings = (value: unknown, max: number) =>
  (Array.isArray(value) ? value : []).filter((entry): entry is string => typeof entry === "string").slice(-max);

export function readSlurpCouples(raw: unknown): SlurpCouple[] {
  return (Array.isArray(raw) ? raw : []).flatMap((entry): SlurpCouple[] => {
    const item = record(entry);
    const id = clampText(item?.id, 64);
    const aId = clampText(item?.aId, 128);
    const bId = clampText(item?.bId, 128);
    const startedAt = date(item?.startedAt);
    if (!item || !id || !aId || !bId || aId === bId || !startedAt) return [];
    const page = record(item.page);
    const pageAccount = clampText(page?.accountId, 128);
    const stage = STAGES.includes(item.stage as SlurpCoupleStage) ? (item.stage as SlurpCoupleStage) : "split";
    return [
      {
        id,
        aId,
        bId,
        origin: (["card", "world", "player", "storyline"] as const).find((origin) => origin === item.origin) ?? "world",
        stage,
        ending: (["breakup", "fizzled"] as const).find((ending) => ending === item.ending) ?? null,
        startedAt,
        stageAt: date(item.stageAt) ?? startedAt,
        togetherAt: date(item.togetherAt),
        troubles: typeof item.troubles === "number" ? Math.max(0, Math.floor(item.troubles)) : 0,
        reunions: typeof item.reunions === "number" ? Math.max(0, Math.floor(item.reunions)) : 0,
        moments: (Array.isArray(item.moments) ? item.moments : []).flatMap((raw): SlurpCoupleMoment[] => {
          const moment = record(raw);
          const at = date(moment?.at);
          const kind = KINDS.find((entry) => entry === moment?.kind);
          const momentId = clampText(moment?.id, 64);
          if (!moment || !at || !kind || !momentId) return [];
          return [
            {
              id: momentId,
              kind,
              at,
              detail: clampText(moment.detail, 200),
              ...(typeof moment.withId === "string" ? { withId: moment.withId } : {}),
              ...(typeof moment.fromId === "string" ? { fromId: moment.fromId } : {}),
            },
          ];
        }),
        ...slurpReadMoreIds(item.moreIds, aId, bId),
        told: strings(item.told, 40),
        postIds: strings(item.postIds, 40),
        page:
          page && pageAccount && date(page.openedAt)
            ? { accountId: pageAccount, openedAt: date(page.openedAt)!, closedAt: date(page.closedAt) }
            : null,
        ...(() => {
          const forced = record(item.forced);
          const misfit = FORCED.find((entry) => entry === forced?.misfit);
          const byId = clampText(forced?.byId, 128);
          return misfit && (byId === aId || byId === bId) ? { forced: { misfit, byId } } : {};
        })(),
        ...(item.secret === true ? { secret: true } : {}),
        // #1293: an aftermath only ever means anything for an ex; drop it for any other stage.
        ...(stage === "split" && AFTERMATHS.includes(item.aftermath as (typeof AFTERMATHS)[number])
          ? { aftermath: item.aftermath as (typeof AFTERMATHS)[number] }
          : {}),
      },
    ];
  });
}
