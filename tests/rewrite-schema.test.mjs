import test from "node:test";
import assert from "node:assert/strict";
import {
  RewriteRequestSchema,
  RewriteResponseSchema,
  RewriteTargetSchema,
} from "../src/lib/schema.ts";

function createParsed() {
  return {
    name: "Alex Doe",
    email: "alex@example.com",
    phone: "555-111-2222",
    linkedin: null,
    github: null,
    website: null,
    summary: null,
    skills: ["Languages: TypeScript"],
    experience: [
      {
        company: "Acme",
        title: "Software Engineer",
        location: "Remote",
        dateRange: "Jan 2022 - Present",
        bullets: [
          { text: "Built feature flags and release tooling that reduced rollback events by 22% while improving production deployment confidence across cross-functional product teams." },
          { text: "Optimized API request orchestration and caching strategy, reducing p95 latency from 780ms to 320ms for customer-facing dashboard traffic during peak usage windows." },
        ],
      },
    ],
    education: [
      {
        institution: "State University",
        degree: "B.S. Computer Science",
        dateRange: "2018 - 2022",
        gpa: null,
        honors: null,
      },
    ],
    projects: [
      {
        name: "Insights Hub",
        technologies: "React, Node.js",
        bullets: [
          { text: "Implemented a multi-tenant reporting UI with typed APIs and role-based controls, improving analyst adoption and reducing reporting turnaround times by 34% for operations teams." },
        ],
      },
    ],
  };
}

test("RewriteRequestSchema accepts valid bullet and entry requests", () => {
  const parsed = createParsed();

  const bulletRequest = RewriteRequestSchema.parse({
    parsed,
    currentResume: parsed,
    jdText: "Need TypeScript, React, and AWS experience.",
    target: {
      section: "experience",
      scope: "bullet",
      entryIndex: 0,
      bulletIndex: 0,
    },
    feedback: {
      intents: ["improve_writing", "stronger_impact"],
      note: "Make this sharper and less repetitive.",
    },
    bulletCountPolicy: "fixed",
  });

  assert.equal(bulletRequest.target.scope, "bullet");

  const entryRequest = RewriteRequestSchema.parse({
    parsed,
    currentResume: parsed,
    jdText: "Need TypeScript, React, and AWS experience.",
    target: {
      section: "projects",
      scope: "entry",
      entryIndex: 0,
    },
    feedback: {
      intents: ["add_technology", "make_it_concise"],
      requestedTechnology: "Terraform",
    },
    bulletCountPolicy: "allow_plus_minus_one",
  });

  assert.equal(entryRequest.target.scope, "entry");
});

test("RewriteTarget validation rejects invalid scope/index combinations", () => {
  assert.throws(
    () =>
      RewriteTargetSchema.parse({
        section: "experience",
        scope: "bullet",
        entryIndex: 0,
      }),
    /bulletIndex is required/
  );

  assert.throws(
    () =>
      RewriteTargetSchema.parse({
        section: "projects",
        scope: "entry",
        entryIndex: 0,
        bulletIndex: 0,
      }),
    /bulletIndex is not allowed/
  );
});

test("RewriteResponseSchema accepts suggestion payload", () => {
  const parsed = RewriteResponseSchema.parse({
    suggestion: {
      section: "experience",
      entryIndex: 0,
      scope: "entry",
      bullets: [
        { text: "Refined rewrite bullet with stronger impact and clearer ownership language while preserving role context and key outcomes from the original experience entry." },
      ],
    },
    changedBulletIndexes: [0],
    warnings: ["Some wording may overstate scope."],
  });

  assert.equal(parsed.suggestion.section, "experience");
  assert.equal(parsed.changedBulletIndexes[0], 0);
});
