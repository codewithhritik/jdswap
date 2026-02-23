import test from "node:test";
import assert from "node:assert/strict";
import { runRewrite, validateTargetBounds } from "../src/lib/rewrite-route.ts";

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

test("validateTargetBounds catches out-of-range indexes", () => {
  const resume = createParsed();

  const ok = validateTargetBounds({
    currentResume: resume,
    target: {
      section: "experience",
      scope: "bullet",
      entryIndex: 0,
      bulletIndex: 0,
    },
  });
  assert.deepEqual(ok, { ok: true });

  const bad = validateTargetBounds({
    currentResume: resume,
    target: {
      section: "projects",
      scope: "bullet",
      entryIndex: 0,
      bulletIndex: 99,
    },
  });
  assert.deepEqual(bad, { ok: false, reason: "index_out_of_bounds" });
});

test("runRewrite accepts bullet rewrites for projects and returns mock response", async () => {
  const parsed = createParsed();
  let called = false;

  const response = await runRewrite(
    {
      parsed,
      currentResume: parsed,
      jdText: "Need React and Terraform",
      target: {
        section: "projects",
        scope: "bullet",
        entryIndex: 0,
        bulletIndex: 0,
      },
      feedback: {
        intents: ["add_technology"],
        note: "Please tighten this.",
      },
      bulletCountPolicy: "fixed",
    },
    {
      rewriteFn: async (args) => {
        called = true;
        assert.equal(args.target.section, "projects");
        return {
          suggestion: {
            section: "projects",
            entryIndex: 0,
            scope: "bullet",
            bulletIndex: 0,
            bullets: [
              {
                text: "Implemented a multi-tenant reporting UI using React and Terraform-backed deployment workflows, improving analyst adoption and reducing reporting turnaround time by 34% across operations teams.",
              },
            ],
          },
          changedBulletIndexes: [0],
          warnings: [],
        };
      },
    }
  );

  assert.equal(called, true);
  assert.equal(response.suggestion.section, "projects");
  assert.deepEqual(response.changedBulletIndexes, [0]);
});

test("runRewrite passes requested technology without blocking", async () => {
  const parsed = createParsed();

  const response = await runRewrite(
    {
      parsed,
      currentResume: parsed,
      jdText: "Need React and AWS",
      target: {
        section: "experience",
        scope: "entry",
        entryIndex: 0,
      },
      feedback: {
        intents: ["add_technology", "improve_writing"],
        requestedTechnology: "Rust",
      },
      bulletCountPolicy: "allow_plus_minus_one",
    },
    {
      rewriteFn: async (args) => {
        assert.equal(args.feedback.requestedTechnology, "Rust");
        return {
          suggestion: {
            section: "experience",
            entryIndex: 0,
            scope: "entry",
            bullets: [
              {
                text: "Reframed platform delivery outcomes with clearer ownership language and stronger technical precision while keeping original role context, system boundaries, and measurable results intact.",
              },
            ],
          },
          changedBulletIndexes: [0],
          warnings: ["Requested technology not explicitly integrated."],
        };
      },
    }
  );

  assert.equal(response.suggestion.scope, "entry");
  assert.equal(response.warnings.length, 1);
});
