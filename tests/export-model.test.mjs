import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("canonical export model defines stable style tokens and formatting constants", async () => {
  const source = await readFile(
    new URL("../src/lib/export-model.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /"name"\s*\|\s*"contact"\s*\|\s*"sectionHeading"/);
  assert.match(source, /"skills"\s*\|\s*"body"\s*\|\s*"entryHeader"\s*\|\s*"bullet"/);

  assert.match(
    source,
    /name:\s*\{\s*bold:\s*true,\s*center:\s*true,\s*fontSizeHalfPoints:\s*34,\s*spacingAfter:\s*70,\s*\}/
  );
  assert.match(
    source,
    /sectionHeading:\s*\{\s*bold:\s*true,\s*fontSizeHalfPoints:\s*22,\s*spacingBefore:\s*120,\s*spacingAfter:\s*55,\s*sectionDivider:\s*true,\s*\}/
  );
  assert.match(
    source,
    /skills:\s*\{\s*fontSizeHalfPoints:\s*20,\s*spacingAfter:\s*14,\s*lineHeightMultiple:\s*1\.12,\s*\}/
  );
  assert.match(
    source,
    /bullet:\s*\{\s*fontSizeHalfPoints:\s*20,\s*spacingAfter:\s*12,\s*indentLeft:\s*360,\s*hanging:\s*220,\s*\}/
  );
  assert.match(source, /pushParagraph\(paragraphs,\s*"name",\s*resume\.name\)/);
  assert.match(
    source,
    /pushParagraph\(paragraphs,\s*"contact",\s*contactParts\.join\(" \| "\)\)/
  );
  assert.match(source, /semanticRole\?:\s*"skillsLine"/);
  assert.match(source, /lineHeightMultiple\?:\s*number/);
  assert.match(source, /pushParagraph\(paragraphs,\s*"skills",\s*line,\s*"skillsLine"\)/);
  assert.match(source, /compactSkillsForExport\(/);
});

test("DOCX generator and PDF route consume shared export pipeline contracts", async () => {
  const [docxSource, pipelineSource, pdfRouteSource, pdfPipelineSource] = await Promise.all([
    readFile(new URL("../src/lib/docx-export.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/export-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/download/pdf/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/pdf-export-pipeline.ts", import.meta.url), "utf8"),
  ]);

  assert.match(docxSource, /CanonicalResumeDocumentModel/);
  assert.match(docxSource, /from "\.\/export-model"/);
  assert.match(pipelineSource, /buildCanonicalResumeDocumentModel/);
  assert.match(pipelineSource, /generateCanonicalDocx/);
  assert.match(pdfRouteSource, /buildCompactedPdfResult/);
  assert.match(pdfRouteSource, /x-page-count/);
  assert.match(pdfRouteSource, /x-export-revision/);
  assert.match(pdfPipelineSource, /estimateResumeLines/);
  assert.match(pdfPipelineSource, /renderCanonicalResumePdf/);
});
