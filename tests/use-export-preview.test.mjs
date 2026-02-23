import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("use-export-preview hook performs debounced parallel export fetches", async () => {
  const source = await readFile(
    new URL("../src/lib/use-export-preview.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /Promise\.all\(\[/);
  assert.match(source, /fetch\("\/api\/download\/pdf"/);
  assert.match(source, /fetch\("\/api\/download\/docx"/);
  assert.match(source, /setTimeout/);
  assert.match(source, /AbortController/);
});

test("use-export-preview tracks stale state and export revision", async () => {
  const source = await readFile(
    new URL("../src/lib/use-export-preview.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /isPreviewStale/);
  assert.match(source, /x-export-revision/);
  assert.match(source, /x-page-count/);
  assert.match(source, /x-docx-page-count/);
});
