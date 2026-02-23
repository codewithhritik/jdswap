import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("export preview renders a single DOCX-first preview without tab controls", async () => {
  const source = await readFile(
    new URL("../src/components/ExportPreview.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /type PreviewTab/);
  assert.doesNotMatch(source, /LiveEditablePreview/);
  assert.doesNotMatch(source, /PDF \(Exact\)/);
  assert.match(source, /Word Preview/);
  assert.match(source, /Generating Word preview/);
  assert.match(source, /docxPageCount/);
  assert.match(source, /<DocxArtifactPreview/);
  assert.match(source, /expectedPageCount=\{docxPageCount\}/);
});

test("docx preview className, scaling hooks, and global selectors stay aligned", async () => {
  const [docxComponentSource, cssSource] = await Promise.all([
    readFile(
      new URL("../src/components/DocxArtifactPreview.tsx", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(docxComponentSource, /className:\s*"jdswap-docx"/);
  assert.match(docxComponentSource, /ResizeObserver/);
  assert.match(docxComponentSource, /jdswap-docx-stage-shell/);
  assert.match(docxComponentSource, /expectedPageCount/);
  assert.match(cssSource, /\.jdswap-docx-wrapper/);
  assert.match(cssSource, /section\.jdswap-docx/);
  assert.match(cssSource, /\.jdswap-docx-stage/);
});
