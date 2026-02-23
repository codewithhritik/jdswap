import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBulletCountPolicy,
  collectRewriteWarnings,
  computeChangedBulletIndexes,
  mapIntentInstructions,
} from "../src/lib/rewrite-logic.ts";

test("intent instruction mapping is deterministic and deduped", () => {
  const instructions = mapIntentInstructions([
    "make_it_concise",
    "improve_writing",
    "improve_writing",
    "add_technology",
  ]);

  assert.equal(instructions.length, 3);
  assert.match(instructions[0], /Improve readability/);
  assert.match(instructions[1], /Incorporate requested technologies/);
  assert.match(instructions[2], /Reduce verbosity/);
});

test("applyBulletCountPolicy enforces fixed and flexible limits", () => {
  const fixed = applyBulletCountPolicy({
    scope: "bullet",
    section: "experience",
    policy: "fixed",
    baselineCount: 4,
    requestedCount: 2,
  });
  assert.deepEqual(fixed, { minCount: 4, maxCount: 4, targetCount: 4 });

  const flexible = applyBulletCountPolicy({
    scope: "entry",
    section: "projects",
    policy: "allow_plus_minus_one",
    baselineCount: 2,
    requestedCount: 4,
  });
  assert.deepEqual(flexible, { minCount: 1, maxCount: 3, targetCount: 3 });
});

test("computeChangedBulletIndexes tracks changed and appended bullets", () => {
  const changed = computeChangedBulletIndexes(
    ["one", "two", "three"],
    ["one", "two updated", "three", "four"]
  );

  assert.deepEqual(changed, [1, 3]);
});

test("collectRewriteWarnings emits non-blocking guidance", () => {
  const warnings = collectRewriteWarnings({
    bullets: [
      "Responsible for platform migration and global transformation planning.",
      "Single-handedly managed 120 engineers while improving reliability.",
    ],
    requestedTechnology: "Terraform",
    intents: ["stronger_impact"],
  });

  assert.ok(warnings.some((warning) => /overstate scope/i.test(warning)));
  assert.ok(warnings.some((warning) => /weak phrasing/i.test(warning)));
  assert.ok(warnings.some((warning) => /Requested technology/i.test(warning)));
});
