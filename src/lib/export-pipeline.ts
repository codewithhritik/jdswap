import { generateCanonicalDocx } from "./docx-export";
import { buildCanonicalResumeDocumentModel } from "./export-model";
import { estimateResumeLines } from "./one-page";
import type { SourceLayout, TailoredResume } from "./schema";

export interface BuildCompactedDocxBufferResult {
  docxBuffer: Buffer;
  estimatedLines: number;
}

export async function buildCompactedDocxBuffer(
  resume: TailoredResume,
  sourceLayout: SourceLayout
): Promise<BuildCompactedDocxBufferResult> {
  const model = buildCanonicalResumeDocumentModel(
    resume,
    sourceLayout
  );
  const docxBuffer = await generateCanonicalDocx(model);

  return {
    docxBuffer,
    estimatedLines: estimateResumeLines(resume, sourceLayout),
  };
}
