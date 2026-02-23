import test from "node:test";
import assert from "node:assert/strict";
import { computeRewritePopoverPosition } from "../src/lib/rewrite-overlay-position.ts";

test("computeRewritePopoverPosition prefers right placement when space allows", () => {
  const result = computeRewritePopoverPosition({
    anchorRect: { top: 120, left: 160, right: 220, width: 60, height: 28 },
    popoverSize: { width: 320, height: 260 },
    viewport: { width: 1200, height: 900 },
  });

  assert.equal(result.placement, "right");
  assert.equal(result.left, 232);
  assert.equal(result.top, 120);
});

test("computeRewritePopoverPosition falls back to left when right overflows", () => {
  const result = computeRewritePopoverPosition({
    anchorRect: { top: 80, left: 860, right: 920, width: 60, height: 28 },
    popoverSize: { width: 320, height: 260 },
    viewport: { width: 980, height: 740 },
  });

  assert.equal(result.placement, "left");
  assert.equal(result.left, 528);
  assert.equal(result.top, 80);
});

test("computeRewritePopoverPosition clamps when neither side fully fits", () => {
  const result = computeRewritePopoverPosition({
    anchorRect: { top: 50, left: 120, right: 180, width: 60, height: 28 },
    popoverSize: { width: 420, height: 260 },
    viewport: { width: 500, height: 700 },
  });

  assert.equal(result.placement, "clamped");
  assert.equal(result.left, 12);
  assert.equal(result.top, 50);
});

test("computeRewritePopoverPosition clamps top near viewport bottom", () => {
  const result = computeRewritePopoverPosition({
    anchorRect: { top: 690, left: 200, right: 260, width: 60, height: 28 },
    popoverSize: { width: 320, height: 260 },
    viewport: { width: 1200, height: 760 },
  });

  assert.equal(result.top, 488);
});
