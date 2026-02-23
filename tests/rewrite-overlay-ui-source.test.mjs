import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("resume editor uses overlay assistant and no inline rewrite container", async () => {
  const source = await readFile(
    new URL("../src/components/ResumeEditor.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /import\s+\{\s*RewriteAssistantOverlay\s*\}\s+from\s+"@\/components\/RewriteAssistantOverlay"/);
  assert.match(source, /<RewriteAssistantOverlay/);
  assert.match(source, /anchorRect=\{rewriteAnchorRect\}/);
  assert.match(source, /anchorMeta=\{rewriteAnchorMeta\}/);
  assert.match(source, /focusedBulletIndex=\{/);
  assert.match(source, /activeBulletIndex=\{/);
  assert.doesNotMatch(
    source,
    /rewriteSession\s*&&\s*\([\s\S]*?<motion\.div\s+variants=\{sectionChild\}\s+className="space-y-3"/
  );
});

test("overlay component is portal-based, non-blocking, and dialog-accessible", async () => {
  const source = await readFile(
    new URL("../src/components/RewriteAssistantOverlay.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /createPortal\(/);
  assert.match(source, /pointer-events-none/);
  assert.match(source, /pointer-events-auto/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="false"/);
  assert.match(source, /window\.addEventListener\("scroll",\s*scheduleUpdate,\s*true\)/);
});

test("rewrite suggestion card supports focused bullet rendering", async () => {
  const source = await readFile(
    new URL("../src/components/RewriteSuggestionCard.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /focusedBulletIndex\?: number/);
  assert.match(source, /scope === "bullet"/);
  assert.match(source, /Editing Bullet/);
  assert.match(source, /originalBullets\[focusedBulletIndex!\]\?\.text/);
  assert.match(source, /suggestedBullets\[focusedBulletIndex!\]\?\.text/);
});

