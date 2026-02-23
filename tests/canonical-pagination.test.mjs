import test from "node:test";
import assert from "node:assert/strict";

const { buildCanonicalPaginationPlan } = await import(
  new URL("../src/lib/canonical-pagination.ts", import.meta.url)
);

const measure = {
  widthOfTextAtSize(text, fontKey, fontSize) {
    const weightFactor = fontKey === "bold" || fontKey === "boldItalic" ? 0.6 : 0.55;
    return text.length * fontSize * weightFactor;
  },
};

test("pagination planner wraps skills lines and bullet paragraphs deterministically", () => {
  const model = {
    paragraphs: [
      {
        style: "body",
        semanticRole: "skillsLine",
        text: `Languages: ${Array.from({ length: 120 }, () => "TypeScript").join(", ")}`,
      },
      {
        style: "bullet",
        text: `• ${Array.from({ length: 140 }, () => "Built scalable distributed services").join(" ")}`,
      },
    ],
  };

  const plan = buildCanonicalPaginationPlan(model, measure);
  const skillsParagraph = plan.paragraphs[0];
  const bulletParagraph = plan.paragraphs[1];

  assert.ok(skillsParagraph.lines.length > 1);
  assert.equal(skillsParagraph.lines[0]?.skillsLabel, "Languages:");
  assert.ok(
    skillsParagraph.lines.slice(1).every((line) => line.breakBefore === "line" || line.breakBefore === "page")
  );

  assert.ok(bulletParagraph.lines.length > 1);
  assert.equal(bulletParagraph.lines[0]?.bulletMarker, true);
  assert.ok(bulletParagraph.lines.slice(1).every((line) => !line.bulletMarker));
});

test("pagination planner emits page boundaries for dense content", () => {
  const denseText = Array.from({ length: 1800 }, () => "performance").join(" ");
  const model = {
    paragraphs: [
      { style: "name", text: "Candidate Example" },
      { style: "contact", text: "candidate@example.com | 555-123-4567" },
      { style: "sectionHeading", text: "EXPERIENCE" },
      { style: "body", text: denseText },
    ],
  };

  const plan = buildCanonicalPaginationPlan(model, measure);
  const hasPageBreak = plan.paragraphs.some((paragraph) =>
    paragraph.lines.some((line) => line.breakBefore === "page")
  );

  assert.ok(plan.pageCount > 1);
  assert.ok(hasPageBreak);
});
