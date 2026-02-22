import { buildCanonicalResumeDocumentModel } from "./export-model";
import { estimateResumeLines } from "./one-page";
import { renderCanonicalResumePdf } from "./pdf-renderer";
import type { SourceLayout, TailoredResume } from "./schema";

export interface BuildCompactedPdfResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  estimatedLines: number;
}

interface PdfExportPipelineDeps {
  buildCanonicalResumeDocumentModel: typeof buildCanonicalResumeDocumentModel;
  renderCanonicalResumePdf: typeof renderCanonicalResumePdf;
  estimateResumeLines: typeof estimateResumeLines;
}

const defaultDeps: PdfExportPipelineDeps = {
  buildCanonicalResumeDocumentModel,
  renderCanonicalResumePdf,
  estimateResumeLines,
};

export function createCompactedPdfResultBuilder(
  overrides: Partial<PdfExportPipelineDeps> = {}
) {
  const deps: PdfExportPipelineDeps = { ...defaultDeps, ...overrides };

  return async function buildCompactedPdfResultInner(
    resume: TailoredResume,
    sourceLayout: SourceLayout
  ): Promise<BuildCompactedPdfResult> {
    const model = deps.buildCanonicalResumeDocumentModel(
      resume,
      sourceLayout
    );
    const rendered = await deps.renderCanonicalResumePdf(model);

    return {
      pdfBytes: rendered.bytes,
      pageCount: rendered.pageCount,
      estimatedLines: deps.estimateResumeLines(resume, sourceLayout),
    };
  };
}

export const buildCompactedPdfResult = createCompactedPdfResultBuilder();
