import {
  RewriteRequestSchema,
  RewriteResponseSchema,
  type RewriteRequest,
  type RewriteResponse,
} from "./schema";

interface RewriteLogger {
  info(event: string, meta?: Record<string, unknown>): void;
}

export function validateTargetBounds(args: {
  target: RewriteRequest["target"];
  currentResume: RewriteRequest["currentResume"];
}): { ok: true } | { ok: false; reason: string } {
  const { target, currentResume } = args;

  if (target.section === "experience") {
    const entry = currentResume.experience[target.entryIndex];
    if (!entry) return { ok: false, reason: "entry_out_of_bounds" };
    if (
      target.scope === "bullet" &&
      (target.bulletIndex == null ||
        target.bulletIndex < 0 ||
        target.bulletIndex >= entry.bullets.length)
    ) {
      return { ok: false, reason: "index_out_of_bounds" };
    }
    return { ok: true };
  }

  const projects = currentResume.projects ?? [];
  const project = projects[target.entryIndex];
  if (!project) return { ok: false, reason: "entry_out_of_bounds" };
  if (
    target.scope === "bullet" &&
    (target.bulletIndex == null ||
      target.bulletIndex < 0 ||
      target.bulletIndex >= project.bullets.length)
  ) {
    return { ok: false, reason: "index_out_of_bounds" };
  }
  return { ok: true };
}

export interface RunRewriteOptions {
  logger?: RewriteLogger;
  rewriteFn?: (args: {
    parsed: RewriteRequest["parsed"];
    currentResume: RewriteRequest["currentResume"];
    jdText: string;
    target: RewriteRequest["target"];
    feedback: RewriteRequest["feedback"];
    bulletCountPolicy: RewriteRequest["bulletCountPolicy"];
    logger?: RewriteLogger;
  }) => Promise<RewriteResponse>;
}

async function defaultRewriteFn(args: {
  parsed: RewriteRequest["parsed"];
  currentResume: RewriteRequest["currentResume"];
  jdText: string;
  target: RewriteRequest["target"];
  feedback: RewriteRequest["feedback"];
  bulletCountPolicy: RewriteRequest["bulletCountPolicy"];
  logger?: RewriteLogger;
}): Promise<RewriteResponse> {
  const { rewriteEntryWithFeedback } = await import("./gemini");
  return rewriteEntryWithFeedback(args);
}

export async function runRewrite(
  request: RewriteRequest,
  options?: RunRewriteOptions
): Promise<RewriteResponse> {
  const parsedRequest = RewriteRequestSchema.parse(request);
  const logger = options?.logger ?? { info() {} };
  const rewriteLogger = options?.logger;
  const rewriteFn = options?.rewriteFn ?? defaultRewriteFn;

  logger.info("rewrite.request.start", {
    selected: parsedRequest.target.section,
    scope: parsedRequest.target.scope,
    entryIndex: parsedRequest.target.entryIndex,
    bulletIndex: parsedRequest.target.bulletIndex ?? null,
    intentsCount: parsedRequest.feedback.intents.length,
    hasUserNote: Boolean(parsedRequest.feedback.note?.trim()),
    hasRequestedTechnology: Boolean(parsedRequest.feedback.requestedTechnology?.trim()),
  });

  const result = await rewriteFn({
    parsed: parsedRequest.parsed,
    currentResume: parsedRequest.currentResume,
    jdText: parsedRequest.jdText,
    target: parsedRequest.target,
    feedback: parsedRequest.feedback,
    bulletCountPolicy: parsedRequest.bulletCountPolicy,
    logger: rewriteLogger,
  });
  const response = RewriteResponseSchema.parse(result);

  logger.info("rewrite.request.done", {
    selected: response.suggestion.section,
    scope: response.suggestion.scope,
    entryIndex: response.suggestion.entryIndex,
    changedBulletsCount: response.changedBulletIndexes.length,
    warningCount: response.warnings.length,
  });

  return response;
}
