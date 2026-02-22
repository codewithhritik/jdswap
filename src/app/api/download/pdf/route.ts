import { NextRequest, NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createResumeDocument } from "@/lib/pdf/ResumeDocument";
import { registerFonts } from "@/lib/pdf/fonts";
import { TailoredResumeSchema } from "@/lib/schema";
import { createLogger, getOrCreateRequestId } from "@/lib/logger";
import { ZodError } from "zod";

registerFonts();

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const logger = createLogger({
    requestId,
    route: "/api/download/pdf",
    component: "pdf_download_route",
  });
  const requestStartedAt = Date.now();
  logger.info("pdf.request.received");

  try {
    const body = await request.json();
    let resume;
    try {
      resume = TailoredResumeSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn("pdf.validation.failed", {
          reason: "invalid_payload",
          issues: error.issues.length,
          durationMs: Date.now() - requestStartedAt,
        });
        return NextResponse.json(
          { error: "Invalid resume payload." },
          { status: 400, headers: { "x-request-id": requestId } }
        );
      }
      throw error;
    }

    logger.info("pdf.render.start");
    const renderStartedAt = Date.now();
    const doc = createResumeDocument(resume);
    const pdfStream = await renderToStream(doc as never);

    const chunks: Uint8Array[] = [];
    for await (const chunk of pdfStream) {
      chunks.push(
        chunk instanceof Uint8Array
          ? chunk
          : new Uint8Array(chunk as unknown as ArrayBuffer)
      );
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const pdfBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      pdfBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    logger.info("pdf.render.done", {
      outputBytes: pdfBuffer.length,
      durationMs: Date.now() - renderStartedAt,
    });
    logger.info("pdf.request.complete", {
      durationMs: Date.now() - requestStartedAt,
    });

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="tailored-resume.pdf"',
        "Content-Length": String(pdfBuffer.length),
        "x-request-id": requestId,
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
