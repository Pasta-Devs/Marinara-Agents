import type { SlpDeepDetailsImageRun } from "../../../../../shared/src/slp/slp-deep-details.js";
import type { SlurpSettings } from "../../modules/settings/slp-settings.js";
import { slpIsAdmissionFailure } from "../../base/host/slp-admission.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";

/**
 * An empty image run for Deep details, holding what is known before the pipeline starts. The
 * pipeline fills the rest as each step runs. Only display fields of the connection are copied, so
 * no API key or base URL can reach the record.
 */
export function newSlurpImageRun(input: {
  imageConnection: {
    id: string;
    name?: string | null;
    provider?: string | null;
    model?: string | null;
    imageGenerationSource?: string | null;
    imageService?: string | null;
  };
  settings: Pick<
    SlurpSettings,
    "imageGenerationIncludeDescriptions" | "imageGenerationUseAvatarReferences" | "enableImageInterpretation"
  >;
  onImageRun?: { trigger: SlpDeepDetailsImageRun["trigger"] };
}): SlpDeepDetailsImageRun {
  const trigger = input.onImageRun?.trigger ?? "generation";
  return {
    trigger,
    startedAt: new Date().toISOString(),
    connection: {
      id: input.imageConnection.id,
      name: input.imageConnection.name || null,
      provider: input.imageConnection.provider || null,
      model: input.imageConnection.model || null,
      source: input.imageConnection.imageGenerationSource || null,
      service: input.imageConnection.imageService || null,
      hasFallback: false,
    },
    size: { width: null, height: null },
    styleProfile: { id: "", name: "", chosenBy: "none", styleText: "", positiveTags: "", negativeTags: "" },
    settings: {
      includeDescriptions: input.settings.imageGenerationIncludeDescriptions,
      avatarReferences: input.settings.imageGenerationUseAvatarReferences,
      interpretation: input.settings.enableImageInterpretation !== false,
    },
    appearance: { source: "none", text: "" },
    referenceImages: 0,
    templatePrompt: "",
    styledPrompt: "",
    rewrite: { status: "skipped", input: null, output: null, reason: null },
    finalPrompt: null,
    negativePrompt: null,
    attempts: [],
    result: { status: "failed", mediaPath: null, error: null },
  };
}

/**
 * Run the image pipeline and hand the finished run to `onImageRun`, success or failure. A busy
 * connection sent nothing and the post is handed back untouched, so a deferral records no run.
 */
export async function recordSlurpImageRun<T extends { preview: unknown; stagedMedia: { filePath: string } | null }>(
  run: SlpDeepDetailsImageRun,
  onImageRun: { record: (run: SlpDeepDetailsImageRun) => Promise<void> } | undefined,
  generate: () => Promise<T>,
): Promise<T> {
  let deferred = false;
  try {
    const result = await generate();
    run.result = {
      status: result.preview ? "preview" : "saved",
      mediaPath: result.stagedMedia?.filePath ?? null,
      error: null,
    };
    return result;
  } catch (error) {
    deferred = slpIsAdmissionFailure(error);
    run.result = { status: "failed", mediaPath: null, error: getErrorMessage(error).slice(0, 500) };
    throw error;
  } finally {
    if (!deferred) await onImageRun?.record(run);
  }
}

/** One provider call, timed and added to the run in order, whether it succeeds or throws. */
export async function trackSlurpImageAttempt<T>(
  run: SlpDeepDetailsImageRun,
  attempt: number,
  route: "host" | "bundled",
  generate: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  const entry: SlpDeepDetailsImageRun["attempts"][number] = {
    attempt,
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    route,
    ok: false,
    error: null,
  };
  run.attempts.push(entry);
  try {
    const generated = await generate();
    entry.ok = true;
    const served = generated as {
      effectivePrompt?: string;
      effectiveConnection?: { connectionId: string; connectionName: string; model?: string };
    } | null;
    if (served?.effectiveConnection) {
      const { connectionId, connectionName, model } = served.effectiveConnection;
      entry.servedBy = { id: connectionId, name: connectionName, model: model || null };
    }
    if (served?.effectivePrompt && served.effectivePrompt !== run.finalPrompt) {
      entry.effectivePrompt = served.effectivePrompt;
    }
    return generated;
  } catch (error) {
    entry.error = getErrorMessage(error).slice(0, 500);
    throw error;
  } finally {
    entry.durationMs = Date.now() - started;
  }
}

export function slurpImageRunStyle(
  profile: { id: string; name: string; styleText: string; positiveTags: string; negativeTags: string },
  chosenBy: SlpDeepDetailsImageRun["styleProfile"]["chosenBy"],
): SlpDeepDetailsImageRun["styleProfile"] {
  const { id, name, styleText, positiveTags, negativeTags } = profile;
  return { id, name, chosenBy, styleText, positiveTags, negativeTags };
}
