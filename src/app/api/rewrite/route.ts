import { NextRequest, NextResponse } from "next/server";
import { createLogger, getOrCreateRequestId } from "@/lib/logger";
import { RewriteRequestSchema } from "@/lib/schema";
import { runRewrite, validateTargetBounds } from "@/lib/rewrite-route";

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const logger = createLogger({
    requestId,
    route: "/api/rewrite",
    component: "rewrite_route",
  });
  const startedAt = Date.now();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logger.warn("rewrite.validation.failed", {
        reason: "invalid_json",
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    let payload;
    try {
      payload = RewriteRequestSchema.parse(body);
    } catch {
      logger.warn("rewrite.validation.failed", {
        reason: "invalid_payload",
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Request payload is invalid." },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    const bounds = validateTargetBounds({
      target: payload.target,
      currentResume: payload.currentResume,
    });
    if (!bounds.ok) {
      logger.warn("rewrite.validation.failed", {
        reason: bounds.reason,
        selected: payload.target.section,
        scope: payload.target.scope,
        entryIndex: payload.target.entryIndex,
        bulletIndex: payload.target.bulletIndex ?? null,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Rewrite target is out of bounds." },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    const response = await runRewrite(payload, { logger });
    logger.info("rewrite.request.complete", {
      durationMs: Date.now() - startedAt,
      changedBulletsCount: response.changedBulletIndexes.length,
      warningCount: response.warnings.length,
    });
    return NextResponse.json(response, {
      status: 200,
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    logger.error("rewrite.request.failed", {
      durationMs: Date.now() - startedAt,
      err: error,
    });
    return NextResponse.json(
      { error: "Failed to generate rewrite suggestion." },
      { status: 500, headers: { "x-request-id": requestId } }
    );
  }
}
