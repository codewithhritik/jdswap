import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLogger, getOrCreateRequestId } from "@/lib/logger";
import {
  SourceLayoutSchema,
  TailoredResumeSchema,
  type SourceLayout,
  type TailoredResume,
} from "@/lib/schema";
import { buildCompactedPdfResult } from "@/lib/pdf-export-pipeline";
import { computeExportRevision } from "@/lib/export-revision";

const DownloadPdfRequestSchema = z.object({
  resume: TailoredResumeSchema,
  sourceLayout: SourceLayoutSchema,
});

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const logger = createLogger({
    requestId,
    route: "/api/download/pdf",
    component: "pdf_download_route",
  });
  const requestStartedAt = Date.now();

  try {
    let parsedPayload: { resume: TailoredResume; sourceLayout: SourceLayout };
    try {
      const body = await request.json();
      parsedPayload = DownloadPdfRequestSchema.parse(body);
    } catch {
      logger.warn("pdf.validation.failed", {
        reason: "invalid_payload",
        durationMs: Date.now() - requestStartedAt,
      });
      return NextResponse.json(
        { error: "Request body must include valid resume and sourceLayout." },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    logger.info("pdf.request.received", {
      experienceCount: parsedPayload.resume.experience.length,
      projectCount: parsedPayload.resume.projects?.length ?? 0,
      skillsCount: parsedPayload.resume.skills.length,
      sectionsCount: parsedPayload.sourceLayout.sections.length,
    });
    const exportRevision = computeExportRevision({
      resume: parsedPayload.resume,
      sourceLayout: parsedPayload.sourceLayout,
    });

    const pdfResult = await buildCompactedPdfResult(
      parsedPayload.resume,
      parsedPayload.sourceLayout
    );

    logger.info("pdf.convert.start", {
      estimatedLines: pdfResult.estimatedLines,
      exportRevision,
    });
    const convertStartedAt = Date.now();
    const pdfBuffer = pdfResult.pdfBytes;
    logger.info("pdf.convert.done", {
      outputBytes: pdfBuffer.length,
      pageCount: pdfResult.pageCount,
      durationMs: Date.now() - convertStartedAt,
    });
    logger.info("pdf.request.complete", {
      durationMs: Date.now() - requestStartedAt,
    });

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="tailored-resume.pdf"',
        "Content-Length": String(pdfBuffer.length),
        "x-request-id": requestId,
        "x-export-revision": exportRevision,
        "x-page-count": String(pdfResult.pageCount),
      },
    });
  } catch (error) {
    logger.error("pdf.request.failed", {
      durationMs: Date.now() - requestStartedAt,
      err: error,
    });
    return NextResponse.json(
      { error: "Failed to generate PDF. Please try again." },
      { status: 500, headers: { "x-request-id": requestId } }
    );
  }
}
