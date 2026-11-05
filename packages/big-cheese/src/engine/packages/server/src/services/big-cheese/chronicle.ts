// ──────────────────────────────────────────────
// Big Cheese: term reviews, the award and the yearbook (modules.md 4, design.md 15 `chronicle.term`)
// ──────────────────────────────────────────────
// GET shows the pending review and the yearbook pages. POST /review and /award give them. POST /chronicle writes the
// page of the open term. A page is a child document; its id holds the run and the term number, so a Board rewind plus
// replay writes the same document again and never a second one.
import type { CapabilityDocumentStore } from "@marinara-engine/shared";
import { z } from "zod";
import { runTask, withCallLog, type ModelCall } from "./ai/tasks.js";
import { withCast } from "./cast.js";
import { placeKitOf } from "./core/kits/index.js";
import { REVIEW_PICKS, giveAward, reviewPerson, termFacts } from "./core/reviews.js";
import { roll } from "./core/rng.js";
import type { Run } from "./core/types.js";
import { view } from "./game.js";
import { BigCheeseError, PACKAGE_ID, type RunStore } from "./store.js";

const Rev = z.object({ expectedRevision: z.number().int().min(0) });
const ReviewBody = Rev.extend({ who: z.string().max(60), pick: z.enum(REVIEW_PICKS) });
const AwardBody = Rev.extend({ who: z.string().max(60) });
const WriteBody = Rev.extend({ adult: z.boolean().optional() });

const pageId = (runId: string, term: number) => `${PACKAGE_ID}:yearbook:${runId}:${term}`;
interface Page {
  term: number;
  title: string;
  text: string;
  source: "model" | "lite";
}

export function createChronicle(
  store: RunStore,
  documents: CapabilityDocumentStore,
  getModel: () => Promise<ModelCall | undefined>,
) {
  const open = async <S extends z.ZodTypeAny>(id: unknown, body: unknown, schema: S, playing = true) => {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success)
      throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
    const run = await store.get(id);
    const data = parsed.data as z.infer<typeof Rev>;
    if (data.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (playing) {
      if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
      if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
      if (run.game.meeting && !run.game.meeting.done)
        throw new BigCheeseError(409, "Finish the meeting first.", "wrong-phase");
    }
    return { run, data: parsed.data as z.infer<S> };
  };
  const kitOf = (run: Awaited<ReturnType<RunStore["get"]>>) => withCast(placeKitOf(run), run.cast, run.game.clock);

  const change = async (run: Awaited<ReturnType<RunStore["get"]>>, fn: (g: Run) => void) => {
    const game = structuredClone(run.game);
    try {
      fn(game);
    } catch (e) {
      throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
    }
    return view(await store.update(run.id, run.revision, (r) => ({ ...r, game })));
  };

  return {
    async list(id: unknown) {
      const run = await store.get(id);
      const pages: Page[] = [];
      for (const docId of run.game.yearbook) {
        const rec = await documents.getById(PACKAGE_ID, docId);
        if (rec) pages.push(rec.data as Page);
      }
      return { pending: run.game.pendingTerm, pages };
    },

    async review(id: unknown, body: unknown) {
      const { run, data } = await open(id, body, ReviewBody);
      return change(run, (g) => reviewPerson(g, kitOf(run), data.who, data.pick));
    },

    async award(id: unknown, body: unknown) {
      const { run, data } = await open(id, body, AwardBody);
      return change(run, (g) => giveAward(g, data.who));
    },

    /** Writes (or writes again) the page of the open term. It changes no number, so it works after the run ends. */
    async write(id: unknown, body: unknown) {
      const { run, data } = await open(id, body, WriteBody, false);
      const p = run.game.pendingTerm;
      if (!p) throw new BigCheeseError(409, "No term has ended yet.", "wrong-phase");
      const kit = kitOf(run);
      const withAdult = !!(data.adult && run.game.adult);
      const h = { rng: run.game.rng };
      roll(h);
      const model = run.lite ? undefined : withCallLog(await getModel(), run.id);
      const { output, source } = await runTask(
        "chronicle.term",
        {
          kit,
          rng: h.rng,
          facts: termFacts(run.game, kit, withAdult),
          adult: withAdult ? (run.game.adult ?? null) : null,
        },
        { model },
      );
      const docId = pageId(run.id, p.term);
      const page: Page = { term: p.term, title: output.title, text: output.text, source };
      const now = new Date().toISOString();
      const rec = await documents.getById(PACKAGE_ID, docId);
      if (rec) {
        await documents.update({
          id: docId,
          packageId: PACKAGE_ID,
          expectedRevision: rec.revision,
          name: rec.name,
          description: rec.description,
          data: page,
          updatedAt: now,
        });
      } else {
        await documents.create({
          id: docId,
          packageId: PACKAGE_ID,
          kind: "yearbook",
          name: `Yearbook, term ${p.term}`,
          description: "",
          data: page,
          createdAt: now,
          updatedAt: now,
        });
      }
      return view(
        await store.update(run.id, run.revision, (r) => ({
          ...r,
          game: {
            ...r.game,
            yearbook: r.game.yearbook.includes(docId) ? r.game.yearbook : [...r.game.yearbook, docId],
          },
        })),
      );
    },

    /** A deleted run takes its yearbook pages with it. */
    async remove(id: unknown) {
      const prefix = pageId(typeof id === "string" ? id : "", 0).slice(0, -1);
      for (const rec of await documents.list(PACKAGE_ID, "yearbook")) {
        if (rec.id.startsWith(prefix)) await documents.remove(PACKAGE_ID, rec.id, rec.revision);
      }
    },
  };
}
