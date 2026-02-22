import test from "node:test";
import assert from "node:assert/strict";

const { computeExportRevision } = await import(
  new URL("../src/lib/export-revision.ts", import.meta.url)
);

function buildPayload() {
  return {
    resume: {
      name: "Alex Doe",
      email: "alex@example.com",
      phone: "555-111-2222",
      linkedin: "linkedin.com/in/alex",
      github: "github.com/alex",
      website: null,
      summary: null,
      skills: ["Languages: TypeScript, Go"],
      experience: [],
      education: [],
      projects: null,
    },
    sourceLayout: {
      sections: [{ kind: "skills", heading: "SKILLS", lines: [] }],
    },
  };
}

test("computeExportRevision is deterministic for the same payload", () => {
  const payload = buildPayload();
  const a = computeExportRevision(payload);
  const b = computeExportRevision(payload);
  assert.equal(a, b);
});

test("computeExportRevision changes when payload content changes", () => {
  const payload = buildPayload();
  const base = computeExportRevision(payload);
  const next = computeExportRevision({
    ...payload,
    resume: {
      ...payload.resume,
      skills: [...payload.resume.skills, "Frameworks: React, Next.js"],
    },
  });
  assert.notEqual(base, next);
});
