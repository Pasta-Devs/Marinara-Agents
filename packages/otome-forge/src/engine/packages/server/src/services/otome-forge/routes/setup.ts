// ──────────────────────────────────────────────
// Otome Forge: premise suggestions, the forge's Retry and consent, and the art routes (plan M1 "Routes")
// ──────────────────────────────────────────────
// POST /premise/suggest {language, connectionId}                       → {premise}
// POST /runs/:run/forge/retry {step}                                   → {forge}  (failed steps only)
// POST /runs/:run/forge/consent {steps}                                → {forge}  (paint steps waiting for consent)
// POST /runs/:run/art/prompt {target:{kind:"look", owner}}             → {prompt, negativePrompt}
// POST /runs/:run/art/paint {target, prompt?, negativePrompt?}         → {paint} (pending, 0.46.3)
// POST /runs/:run/art/expressions/prompt {li}                         → {base, prompts} (five read-only previews)
// POST /runs/:run/art/expressions {li, base?, prompts?}               → {paint} (one explicit replacement set, pending)
// GET  /image-style-profiles                                          → {defaultProfileId, profiles: [{id, name, promptMode}]}
//                                                                        (the Engine's, for Settings → Images)
// `owner` is "player" or "li:<li id>". The paint route is the explicit tap: it paints once and keeps an edited prompt's
// safety tags. 0.46.3: it and the expressions route answer once their record is pending, and the paint goes on in the
// background (the maintainer's request): the run view shows it painting, then `ready`, or `failed` with Retry (its
// step's, or Repaint expressions again). What is wrong before the paint starts (another paint of that look, no image
// connection, a look not painted or reviewed against another one) is still the answer.
import { z } from "zod";
import { expressionPromptsFor } from "../art/expressions.js";
import { FACES } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { imagesOf, lookPromptFor, parseLookOwner, type LookOwner } from "../art/paint.js";
import { generateJson } from "../generation.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type RegisterRoutes } from "../http.js";
import { isLiId } from "../ids.js";
import { answerOnceStarted } from "../art/paint.js";
import { consentForge, retryForgeStep, startPaintWithStep } from "../setup/forge.js";
import { premiseMessages } from "../prompts.js";
import { normalizePremise, PremiseSchema } from "../setup/cast.js";

const STEP_ID = z.string().min(1).max(80);
const PremiseBody = z.object({ language: z.string().min(1).max(80), connectionId: z.string().min(1).max(200) });
const RetryBody = z.object({ step: STEP_ID });
const ConsentBody = z.object({ steps: z.array(STEP_ID).min(1).max(12) });
const LookTarget = z.object({ kind: z.literal("look"), owner: z.string().min(1).max(80) });
const PromptBody = z.object({ target: LookTarget });
const PaintBody = z.object({
  target: LookTarget,
  prompt: z.string().max(4000).optional(),
  negativePrompt: z.string().max(4000).optional(),
});
const ExpressionBody = z
  .object({
    li: z.string().refine(isLiId),
    base: z.string().optional(),
    prompts: z
      .record(
        z.enum(FACES),
        z.object({
          prompt: z.string().refine((value) => value.trim().length > 0, "A reviewed prompt cannot be blank."),
          negativePrompt: z.string(),
        }),
      )
      .optional(),
  })
  .refine((body) => body.prompts === undefined || body.base !== undefined, {
    message: "Reviewed prompts need the look they were reviewed against.",
    path: ["base"],
  });

function ownerOf(target: { owner: string }): LookOwner {
  const owner = parseLookOwner(target.owner);
  if (!owner) throw new OtomeForgeError(400, "A look belongs to the player or to li:<id>.", "bad-request");
  return owner;
}

export const registerSetupRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;

  router.get(
    "/image-style-profiles",
    handle(async () => {
      const images = imagesOf(deps);
      return (await images.styleProfiles?.()) ?? { defaultProfileId: "", profiles: [] };
    }),
  );

  router.post(
    "/runs/:run/art/expressions/prompt",
    handle(async (request) => {
      const { runId } = runParam(request);
      const { li } = parseBody(ExpressionBody, request.body);
      return expressionPromptsFor(deps, runId, li);
    }),
  );
  router.post(
    "/runs/:run/art/expressions",
    handle(async (request) => {
      const { runId } = runParam(request);
      const { li, base, prompts } = parseBody(ExpressionBody, request.body);
      const art = deps.art;
      if (!art) throw new OtomeForgeError(503, "The art service is unavailable.", "no-connection");
      return {
        paint: await answerOnceStarted(deps, `faces:${li}`, (started) =>
          art.repaintExpressions(runId, li, { base, prompts, debugMode: debugModeOf(request), started }),
        ),
      };
    }),
  );

  router.post(
    "/premise/suggest",
    handle(async (request) => {
      const { language, connectionId } = parseBody(PremiseBody, request.body);
      const { value } = await generateJson(deps, {
        runId: null,
        connectionId,
        job: "structured",
        label: "premise-suggest",
        messages: premiseMessages(language.trim()),
        schema: PremiseSchema,
        normalize: normalizePremise,
        maxTokens: 600,
        debugMode: debugModeOf(request),
        lane: "foreground",
      });
      return { premise: value.premise };
    }),
  );

  router.post(
    "/runs/:run/forge/retry",
    handle(async (request) => {
      const { runId } = runParam(request);
      const { step } = parseBody(RetryBody, request.body);
      return { forge: await retryForgeStep(deps, runId, step, { debugMode: debugModeOf(request) }) };
    }),
  );

  router.post(
    "/runs/:run/forge/consent",
    handle(async (request) => {
      const { runId } = runParam(request);
      const { steps } = parseBody(ConsentBody, request.body);
      return { forge: await consentForge(deps, runId, steps, { debugMode: debugModeOf(request) }) };
    }),
  );

  router.post(
    "/runs/:run/art/prompt",
    handle(async (request) => {
      const { runId } = runParam(request);
      const { target } = parseBody(PromptBody, request.body);
      const { prompt, negativePrompt } = await lookPromptFor(deps, runId, ownerOf(target), {}, debugModeOf(request));
      return { prompt, negativePrompt };
    }),
  );

  router.post(
    "/runs/:run/art/paint",
    handle(async (request) => {
      const { runId } = runParam(request);
      const { target, prompt, negativePrompt } = parseBody(PaintBody, request.body);
      const paint = await startPaintWithStep(deps, runId, ownerOf(target), {
        prompt,
        negativePrompt,
        debugMode: debugModeOf(request),
      });
      return { paint };
    }),
  );
};
