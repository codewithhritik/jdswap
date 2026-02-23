import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLogger, getOrCreateRequestId } from "@/lib/logger";
import {
  SourceLayoutSchema,
  TailoredResumeSchema,
  type SourceLayout,
  type TailoredResume,
} from "@/lib/schema";
import { buildCompactedDocxBuffer } from "@/lib/export-pipeline";
import { computeExportRevision } from "@/lib/export-revision";

const DownloadDocxRequestSchema = z.object({
  resume: TailoredResumeSchema,
  sourceLayout: SourceLayoutSchema,
});

function buildDocxResponse(
  buffer: Buffer,
  requestId: string,
  exportRevision: string,
  pageCount: number
): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="tailored-resume.docx"',
      "Content-Length": String(buffer.length),
      "x-request-id": requestId,
      "x-export-revision": exportRevision,
      "x-docx-page-count": String(pageCount),
    },
  });
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const logger = createLogger({
    requestId,
    route: "/api/download/docx",
    component: "docx_download_route",
  });
  const requestStartedAt = Date.now();

  try {
    let parsed: { resume: TailoredResume; sourceLayout: SourceLayout };
    try {
      const body = await request.json();
      parsed = DownloadDocxRequestSchema.parse(body);
    } catch {
      logger.warn("docx.validation.failed", {
        reason: "invalid_payload",
        durationMs: Date.now() - requestStartedAt,
      });
      return NextResponse.json(
        { error: "Request body must include valid resume and sourceLayout." },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    logger.info("docx.request.received", {
      experienceCount: parsed.resume.experience.length,
      projectCount: parsed.resume.projects?.length ?? 0,
      skillsCount: parsed.resume.skills.length,
      sectionsCount: parsed.sourceLayout.sections.length,
    });
    const exportRevision = computeExportRevision({
      resume: parsed.resume,
      sourceLayout: parsed.sourceLayout,
    });

    const { docxBuffer, estimatedLines, pageCount } = await buildCompactedDocxBuffer(
      parsed.resume,
      parsed.sourceLayout
    );
    logger.info("docx.generate.done", {
      estimatedLines,
      pageCount,
      outputBytes: docxBuffer.length,
      exportRevision,
    });
    logger.info("docx.request.complete", {
      durationMs: Date.now() - requestStartedAt,
    });

    return buildDocxResponse(docxBuffer, requestId, exportRevision, pageCount);
  } catch (error) {
    logger.error("docx.request.failed", {
      durationMs: Date.now() - requestStartedAt,
      err: error,
    });
    return NextResponse.json(
      { error: "Failed to generate DOCX. Please try again." },
      { status: 500, headers: { "x-request-id": requestId } }
    );
  }
}
