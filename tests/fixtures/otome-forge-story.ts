// A forged Otome Forge world for the story regressions (M2a, M2b): three love interests with bibles, a ready world, the
// story and arc routes on a fake router, scripted model replies, and builders for a chapter plan, a beat reply and a
// Confrontation reply.
import assert from "node:assert/strict";
import { createForgeStoryCancellation } from "@forge-kit/story-cancel-server.mjs";
import type {
  Bible,
  LiState,
  RunState,
} from "../../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import { runForeground } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteDeps,
  type RouteHandler,
} from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  INDEX_TARGET,
  playerId,
  runDocTarget,
  runIdOf,
  stateId,
  unitId,
  worldId,
} from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerArcRoutes } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/arcs.ts";
import { registerStoryRoutes } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/story.ts";
import { normalizeIndex } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/index.ts";
import { normalizePlayer } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  defaultLiState,
  normalizeState,
} from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBible,
  normalizeUnit,
} from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { createOtomeStore } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
import { createFakeDocuments, createFakeRuntime, type FakeReply } from "./otome-forge-fakes.ts";

export const at = "2026-10-28T10:00:00.000Z";
export const HE = { subject: "he", object: "him", possessive: "his" };
export const SHE = { subject: "she", object: "her", possessive: "her" };
export const KAI = "li-kai-ab12";
export const MIR = "li-mireille-cd34";
export const SOL = "li-sol-ef56";
export const CAST = [
  { id: KAI, name: "Kai" },
  { id: MIR, name: "Mireille" },
  { id: SOL, name: "Sol" },
];

export function bible(changes: Partial<Bible> = {}): Bible {
  const base = normalizeBible({})!;
  return {
    ...base,
    age: 29,
    pronouns: HE,
    role: "Lighthouse keeper",
    want: "to keep the harbour lights burning",
    mask: { presents: "Unbothered", tells: ["polishes clean glass", "counts the bells", "won't sit"] },
    secrets: [
      {
        id: "north-light",
        truth: "HIDDEN-TRUTH: he let the north light go dark.",
        tells: ["flinches at the bell"],
        revealAt: { stage: 4 },
      },
    ],
    ...changes,
  };
}

/** The ready world: index, world, player, three LIs with bibles, and their state (`lis` overrides per LI). */
export async function storyWorld({
  runKey,
  replies = [],
  lis = {},
  content = defaultContent(),
  cancellation = false,
}: {
  runKey: string;
  replies?: FakeReply[];
  lis?: Record<string, Partial<LiState>>;
  content?: ReturnType<typeof defaultContent>;
  cancellation?: boolean;
}) {
  const fake = createFakeDocuments();
  const store = createOtomeStore(fake.documents);
  const { runtime, logs, calls } = createFakeRuntime({ documents: fake.documents, replies });
  const runId = runIdOf(runKey);
  await store.mutateDoc(INDEX_TARGET, normalizeIndex, (index) => ({
    ...index,
    runs: [{ runKey, title: "The Lantern Court", createdAt: at, lastPlayedAt: null }],
    activeRun: runKey,
  }));
  await store.mutateDoc(runDocTarget("player", playerId(runId)), normalizePlayer, (player) => ({
    ...player,
    personaId: "persona-ines",
    name: "Ines",
    pronouns: SHE,
    goal: "Find out why the lights die.",
  }));
  for (const li of CAST) {
    await store.mutateDoc(runDocTarget("unit", unitId(runId, li.id)), normalizeUnit, (unit) => ({
      ...unit,
      id: li.id,
      name: li.name,
      pronouns: HE,
      bible: bible(),
      createdAt: at,
    }));
  }
  await store.mutateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) => ({
    ...state,
    lis: Object.fromEntries(CAST.map((li) => [li.id, { ...defaultLiState(), ...lis[li.id] }])),
  }));
  await store.mutateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (world) => ({
    ...world,
    title: "The Lantern Court",
    premise: "Someone is putting out the harbour's lanterns.",
    setting: "A harbour city lit by lanterns that must never go out.",
    mystery: { question: "Who puts out the lanterns?", truth: "MYSTERY-TRUTH: the harbour master.", pieces: {} },
    openingSituation: "The lanterns along the quay go dark one by one.",
    createdAt: at,
    content,
    connections: { narration: "conn-text" },
    forge: { phase: "ready", steps: [] },
  }));
  const deps: RouteDeps = {
    runtime,
    store,
    handle: createHandle(runtime.logger),
    ...(cancellation ? { cancellation: createForgeStoryCancellation() } : {}),
  };
  const call = storyRoutes(deps, runKey);
  const state = async (): Promise<RunState> => (await store.readDoc(stateId(runId), normalizeState))!;
  /** Lets every queued foreground task (the lookahead) finish. */
  const settle = async () => {
    for (let round = 0; round < 6; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      await runForeground(runId, async () => undefined);
    }
  };
  return { fake, store, runtime, logs, calls, deps, runId, call, state, settle };
}

/** The story and arc routes on a fake router; `call` answers like Fastify ({status, body}). */
export function storyRoutes(deps: RouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  const router = {
    get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
    post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
  };
  registerStoryRoutes(router, deps);
  registerArcRoutes(router, deps);
  return async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        params: { run: runKey, ...params },
        query: method === "GET" ? { ...fields, ...body } : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

type PlanNode = { kind: string; moment?: string; guide: string; cast: string[]; cg?: boolean; resolves?: string[] };

/** A valid P5 reply for chapter 1 led by Kai: seven nodes, one moment, the confrontation last but one. */
export function planReply(changes: Record<string, unknown> = {}): Record<string, any> {
  const nodes: PlanNode[] = [
    { kind: "beat", guide: "The quay goes dark; Kai finds Ines at the lamp.", cast: [KAI] },
    { kind: "beat", guide: "Mireille arrives with the harbour ledger.", cast: [KAI, "Mireille"] },
    { kind: "moment", moment: "read-him", guide: "Ines reads Kai's face at the bell.", cast: [KAI] },
    { kind: "beat", guide: "Sol plays on the pier while the lights fail.", cast: [SOL, KAI] },
    { kind: "beat", guide: "Kai and Ines climb the lighthouse.", cast: [KAI] },
    { kind: "confrontation", guide: "Ines confronts Kai about the north light.", cast: [KAI], cg: true },
    { kind: "beat", guide: "Dawn; Kai keeps the lamp lit.", cast: [KAI, MIR] },
  ];
  return {
    title: "The Dark Quay",
    tags: ["violence-others", "jealousy", "not-a-tag"],
    foil: "Mireille",
    summary: "The lights fail, and Kai knows why.",
    nodes,
    ledger: {
      relationship: [{ li: KAI, line: "Kai let her see the lamp room." }],
      conflict: [{ li: KAI, type: "secret", action: "plant" }],
      offscreen: [],
    },
    ...changes,
  };
}

/** A P6 reply: three segments, and (optionally) the kit's choices with Otome's effects. */
export function beatReply(changes: Record<string, unknown> = {}): Record<string, any> {
  return {
    musicMood: "tense",
    places: [{ name: "The Lamp Room", tags: "lighthouse interior, great lens, no humans" }],
    segments: [
      { speaker: "", text: "The lamp hisses.", place: "The Lamp Room" },
      { speaker: "Kai", text: "You came back. How inefficient of you.", expression: "cold" },
      { speaker: "Ines", text: "Someone had to.", thought: false },
    ],
    ...changes,
  };
}

export const json = (value: unknown) => JSON.stringify(value);

/**
 * Kai's rows as the shared story (main-1) and Mireille's own route and repair chapters left them (M3's ownView keeps
 * the second kind from every prompt for Kai alone): a grievance, a disclosure and the newest relationship and
 * off-screen lines of each, and a rupture whose grievance opened in Mireille's route. The markers name which is which.
 */
export const KAI_SHARED = ["KAI-MAIN-GRIEVANCE", "KAI-MAIN-DISCLOSURE", "KAI-MAIN-RELATIONSHIP", "KAI-MAIN-OFFSCREEN"];
export const MIREILLE_ONLY = [
  "MIR-ROUTE-GRIEVANCE",
  "MIR-ROUTE-RUPTURE",
  "MIR-REPAIR-DISCLOSURE",
  "MIR-ROUTE-RELATIONSHIP",
  "MIR-REPAIR-OFFSCREEN",
];
export const RUPTURE_ID = "g-3";
export function withMireillesPrivateRows(state: RunState, { rupture = false } = {}): RunState {
  const kai = state.lis[KAI]!;
  const grievance = (id: string, text: string, opened: string, severity: "minor" | "rupture" = "minor") => ({
    id,
    li: KAI,
    by: "li" as const,
    text,
    severity,
    opened,
    status: "open" as const,
  });
  return {
    ...state,
    ledgers: {
      ...state.ledgers,
      // The shared row first, so the newest row Kai may know is the shared one and the newest of all is Mireille's.
      relationship: [
        { key: "main-1", li: KAI, line: "KAI-MAIN-RELATIONSHIP: he let her hold the lamp." },
        { key: `route-${MIR}-2`, li: KAI, line: "MIR-ROUTE-RELATIONSHIP: he saw the forged pages." },
      ],
      offscreen: [
        { key: "main-1", li: KAI, line: "KAI-MAIN-OFFSCREEN: Kai rewired the bell." },
        { key: `repair-${MIR}-1`, li: KAI, line: "MIR-REPAIR-OFFSCREEN: Kai watched the key change hands." },
      ],
    },
    lis: {
      ...state.lis,
      [KAI]: {
        ...kai,
        grievances: [
          grievance("g-1", "KAI-MAIN-GRIEVANCE: the lamp.", "main-1/0"),
          grievance("g-2", "MIR-ROUTE-GRIEVANCE: the burned page.", `route-${MIR}-2/0`),
          ...(rupture
            ? [grievance(RUPTURE_ID, "MIR-ROUTE-RUPTURE: the ledger he hid.", `route-${MIR}-2/1`, "rupture")]
            : []),
        ],
        disclosures: [
          { text: "KAI-MAIN-DISCLOSURE: she fears the sea.", at, ref: "main-1/0" },
          { text: "MIR-REPAIR-DISCLOSURE: she kept the key.", at, ref: `repair-${MIR}-1/0` },
        ],
        rupture: rupture ? { grievanceId: RUPTURE_ID, since: at } : null,
      },
    },
  };
}

/** True for a P12 call (the Confrontation narrator). */
export const isConfrontationPrompt = (messages: Array<{ content: string }>) =>
  messages[0]!.content.includes("stance game");

type Move = -1 | 0 | 1;

/**
 * A P12 reply: an opening, three rounds of four stances and the three endings. `moves` sets each stance's composure
 * move in every round (by default Press closes him off, Hold does nothing, Yield and Reveal get through).
 */
export function confrontationReply(
  changes: Record<string, unknown> = {},
  moves: Record<"press" | "hold" | "yield" | "reveal", Move> = { press: 1, hold: 0, yield: -1, reveal: -1 },
): Record<string, any> {
  const option = (stance: string, round: number) => ({
    label: `${stance} ${round}`,
    selection: { kind: "dialogue", text: `${stance.toUpperCase()}-${round}: Tell me the truth.` },
    segments: [{ speaker: "Kai", text: `ANSWER-${stance}-${round}`, expression: "hurt" }],
    composure: moves[stance as keyof typeof moves],
  });
  const round = (k: number) => ({
    lines: [{ speaker: "Kai", text: `HIS-${k}: You don't know what you're asking.`, expression: "cold" }],
    options: {
      press: option("press", k),
      hold: option("hold", k),
      yield: option("yield", k),
      reveal: option("reveal", k),
    },
  });
  return {
    musicMood: "angst",
    places: [{ name: "The Lamp Room", tags: "lighthouse interior, great lens, no humans" }],
    opening: [
      { speaker: "", text: "OPENING: the lamp turns.", place: "The Lamp Room" },
      { speaker: "Kai", text: "Say it, then.", expression: "angry" },
    ],
    rounds: [round(1), round(2), round(3)],
    endings: {
      truth: [{ speaker: "Kai", text: "ENDING-TRUTH: I let it go dark.", expression: "hurt" }],
      walkout: [{ speaker: "", text: "ENDING-WALKOUT: the door slams." }],
      standoff: [{ speaker: "", text: "ENDING-STANDOFF: neither of you moves." }],
    },
    grievance: { text: "She called him a liar in his own lighthouse.", severity: "major" },
    disclosure: "Ines said she was the one who rang the bell that night.",
    ...changes,
  };
}
