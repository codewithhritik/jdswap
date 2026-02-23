import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("export preview defaults to live editable tab and keeps exact read-only messaging", async () => {
  const source = await readFile(
    new URL("../src/components/ExportPreview.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /type PreviewTab = "live" \| "pdf" \| "docx"/);
  assert.match(source, /useState<PreviewTab>\("live"\)/);
  assert.match(source, /label="Live \(Editable\)"/);
  assert.match(source, /Exact previews are read-only/);
  assert.match(source, /<LiveEditablePreview/);
});

test("docx preview className and global selectors stay aligned", async () => {
  const [docxComponentSource, cssSource] = await Promise.all([
    readFile(
      new URL("../src/components/DocxArtifactPreview.tsx", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(docxComponentSource, /className:\s*"jdswap-docx"/);
  assert.match(cssSource, /\.jdswap-docx-wrapper/);
  assert.match(cssSource, /section\.jdswap-docx/);
});
