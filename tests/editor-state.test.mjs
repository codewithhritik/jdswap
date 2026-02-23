import test from "node:test";
import assert from "node:assert/strict";
import { editorReducer } from "../src/lib/editor-state.ts";

function createResume() {
  return {
    name: "Alex Doe",
    email: "alex@example.com",
    phone: "555-111-2222",
    linkedin: "linkedin.com/in/alex",
    github: "github.com/alex",
    website: null,
    summary: null,
    skills: ["Languages: TypeScript, Go", "Frameworks: Next.js, React"],
    experience: [
      {
        company: "Acme",
        title: "Software Engineer",
        location: "Remote",
        dateRange: "Jan 2022 - Present",
        bullets: [
          { text: "Built internal tools and improved delivery speed." },
          { text: "Reduced bug backlog by 28% through targeted refactors." },
          { text: "Introduced CI checks to catch regressions before release." },
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
        name: "Internal Analytics",
        technologies: "React, Node.js",
        bullets: [
          { text: "Built dashboarding tools used by 40+ internal stakeholders." },
          { text: "Improved load time by 42% with query and cache optimization." },
          { text: "Set up role-based access controls and audit trails." },
        ],
      },
    ],
  };
}

function createParsed() {
  return {
    ...createResume(),
    experience: [
      {
        company: "Acme",
        title: "Software Engineer",
        location: "Remote",
        dateRange: "Jan 2022 - Present",
        bullets: [
          { text: "Built internal tools and improved delivery speed." },
          { text: "Reduced bug backlog by 28% through targeted refactors." },
          { text: "Introduced CI checks to catch regressions before release." },
        ],
      },
    ],
    projects: [
      {
        name: "Internal Analytics",
        technologies: "React, Node.js",
        bullets: [
          { text: "Built dashboarding tools used by 40+ internal stakeholders." },
          { text: "Improved load time by 42% with query and cache optimization." },
          { text: "Set up role-based access controls and audit trails." },
        ],
      },
    ],
  };
}

test("editorReducer handles BULK_REPLACE and FORM_PATCH", () => {
  const resume = createResume();
  const parsed = createParsed();
  const sourceLayout = {
    sections: [
      { kind: "experience", heading: "Experience", lines: [] },
      { kind: "skills", heading: "Skills", lines: [] },
      { kind: "education", heading: "Education", lines: [] },
    ],
  };

  const replaced = editorReducer(
    { resume: null, sourceLayout: null, parsed: null, jdText: null },
    {
      type: "BULK_REPLACE",
      payload: { resume, sourceLayout, parsed, jdText: "Sample JD text" },
    }
  );
  assert.equal(replaced.resume?.name, "Alex Doe");
  assert.equal(replaced.sourceLayout?.sections.length, 3);
  assert.equal(replaced.parsed?.name, "Alex Doe");
  assert.equal(replaced.jdText, "Sample JD text");

  const patchedResume = { ...resume, name: "Alexandra Doe" };
  const patched = editorReducer(replaced, {
    type: "FORM_PATCH",
    payload: { resume: patchedResume },
  });
  assert.equal(patched.resume?.name, "Alexandra Doe");
  assert.equal(patched.parsed?.name, "Alex Doe");
  assert.equal(patched.jdText, "Sample JD text");
});

test("editorReducer applies rewrite patches to experience and projects", () => {
  const state = {
    resume: createResume(),
    sourceLayout: { sections: [] },
    parsed: createParsed(),
    jdText: "Sample JD text",
  };

  const afterExperienceRewrite = editorReducer(state, {
    type: "APPLY_REWRITE",
    payload: {
      target: {
        section: "experience",
        scope: "entry",
        entryIndex: 0,
      },
      bullets: [{ text: "Rewrote delivery pipeline and reduced lead time by 35%." }],
    },
  });
  assert.equal(
    afterExperienceRewrite.resume?.experience[0]?.bullets[0]?.text,
    "Rewrote delivery pipeline and reduced lead time by 35%."
  );

  const afterProjectRewrite = editorReducer(afterExperienceRewrite, {
    type: "APPLY_REWRITE",
    payload: {
      target: {
        section: "projects",
        scope: "entry",
        entryIndex: 0,
      },
      bullets: [{ text: "Refined project narrative with better impact focus." }],
    },
  });
  assert.equal(
    afterProjectRewrite.resume?.projects?.[0]?.bullets[0]?.text,
    "Refined project narrative with better impact focus."
  );
});

test("editorReducer bullet-scope rewrite updates only selected experience bullet", () => {
  const state = {
    resume: createResume(),
    sourceLayout: { sections: [] },
    parsed: createParsed(),
    jdText: "Sample JD text",
  };

  const next = editorReducer(state, {
    type: "APPLY_REWRITE",
    payload: {
      target: {
        section: "experience",
        scope: "bullet",
        entryIndex: 0,
        bulletIndex: 1,
      },
      bullets: [
        { text: "Changed hidden bullet 1." },
        { text: "Focused bullet rewritten with better quantified impact." },
        { text: "Changed hidden bullet 3." },
      ],
    },
  });

  assert.equal(
    next.resume?.experience[0]?.bullets[0]?.text,
    "Built internal tools and improved delivery speed."
  );
  assert.equal(
    next.resume?.experience[0]?.bullets[1]?.text,
    "Focused bullet rewritten with better quantified impact."
  );
  assert.equal(
    next.resume?.experience[0]?.bullets[2]?.text,
    "Introduced CI checks to catch regressions before release."
  );
});

test("editorReducer bullet-scope rewrite updates only selected project bullet", () => {
  const state = {
    resume: createResume(),
    sourceLayout: { sections: [] },
    parsed: createParsed(),
    jdText: "Sample JD text",
  };

  const next = editorReducer(state, {
    type: "APPLY_REWRITE",
    payload: {
      target: {
        section: "projects",
        scope: "bullet",
        entryIndex: 0,
        bulletIndex: 2,
      },
      bullets: [
        { text: "Changed hidden project bullet 1." },
        { text: "Changed hidden project bullet 2." },
        { text: "Focused project bullet rewritten for stronger clarity." },
      ],
    },
  });

  assert.equal(
    next.resume?.projects?.[0]?.bullets[0]?.text,
    "Built dashboarding tools used by 40+ internal stakeholders."
  );
  assert.equal(
    next.resume?.projects?.[0]?.bullets[1]?.text,
    "Improved load time by 42% with query and cache optimization."
  );
  assert.equal(
    next.resume?.projects?.[0]?.bullets[2]?.text,
    "Focused project bullet rewritten for stronger clarity."
  );
});

test("editorReducer bullet-scope rewrite with invalid index is a no-op", () => {
  const state = {
    resume: createResume(),
    sourceLayout: { sections: [] },
    parsed: createParsed(),
    jdText: "Sample JD text",
  };

  const next = editorReducer(state, {
    type: "APPLY_REWRITE",
    payload: {
      target: {
        section: "experience",
        scope: "bullet",
        entryIndex: 0,
        bulletIndex: 10,
      },
      bullets: [{ text: "Out-of-range result." }],
    },
  });

  assert.deepEqual(next, state);
});

