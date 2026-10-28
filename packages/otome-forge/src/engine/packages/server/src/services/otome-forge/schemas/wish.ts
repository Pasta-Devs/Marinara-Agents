// ──────────────────────────────────────────────
// Otome Forge: the `${R}:banner:${key}` and `${R}:item:${itemId}` documents (M4, SH/wish.ts holds their shapes)
// ──────────────────────────────────────────────
// Read field by field like every other document, so one damaged field keeps its default. A banner or item that does not
// exist reads with an empty `key` or `id`; callers treat that as missing.
import { z, type ZodType } from "zod";
import {
  BANNER_KINDS,
  ITEM_KINDS,
  isItemId,
  type Banner,
  type Item,
  type ItemLook,
} from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { PaintSchema, field, isRecord, readFields, text, validItems } from "./common.js";

const TITLE_MAX = 200;
const PREMISE_MAX = 1200;
const SNAPSHOT_MAX = 600;
const LINE_MAX = 600;

const LookSchema: ZodType<ItemLook> = z.object({ name: text(TITLE_MAX), outfitLine: text(LINE_MAX) });
const CgSchema = z.object({ brief: text(LINE_MAX), cast: z.array(z.string().max(120)).max(3) });

const defaultBanner = (): Banner => ({
  key: "",
  kind: "memories",
  rotation: 0,
  startsDay: "",
  endsDay: "",
  featuredLi: "",
  items: { five: [], four: [], three: [] },
  art: null,
  createdAt: "",
  connectionId: "",
  model: "",
});

const itemIds = (value: unknown) => validItems(z.string(), value).filter(isItemId);

export function normalizeBanner(data: unknown): Banner {
  return readFields<Banner>(
    {
      key: z.string().max(80),
      kind: z.enum(BANNER_KINDS),
      rotation: z.number().int().min(0),
      startsDay: z.string().max(10),
      endsDay: z.string().max(10),
      featuredLi: z.string().max(80),
      items: (value) => ({
        five: itemIds(field(value, "five")),
        four: itemIds(field(value, "four")),
        three: itemIds(field(value, "three")),
      }),
      art: PaintSchema.nullable(),
      createdAt: z.string(),
      connectionId: z.string(),
      model: z.string(),
    },
    defaultBanner,
    isRecord(data) ? data : undefined,
  );
}

const defaultItem = (): Item => ({
  id: "",
  kind: "snapshot3",
  banner: "",
  li: null,
  title: "",
  art: null,
  story: null,
  createdAt: "",
});

export function normalizeItem(data: unknown): Item {
  return readFields<Item>(
    {
      id: z.string().max(80),
      kind: z.enum(ITEM_KINDS),
      banner: z.string().max(80),
      li: z.string().max(80).nullable(),
      title: text(TITLE_MAX),
      premise: text(PREMISE_MAX).optional(),
      text: text(SNAPSHOT_MAX).optional(),
      look: LookSchema.optional(),
      coupleWith: z.string().max(80).optional(),
      cg: CgSchema.optional(),
      art: PaintSchema.nullable(),
      story: z.object({ key: z.string().max(120) }).nullable(),
      voicedLine: text(LINE_MAX).optional(),
      createdAt: z.string(),
    },
    defaultItem,
    isRecord(data) ? data : undefined,
  );
}

export const ITEM_LIMITS = { title: TITLE_MAX, premise: PREMISE_MAX, snapshot: SNAPSHOT_MAX, line: LINE_MAX };
