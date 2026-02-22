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
        bullets: [{ text: "Built internal tools and improved delivery speed." }],
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
    projects: null,
  };
}

test("editorReducer handles BULK_REPLACE and FORM_PATCH", () => {
  const resume = createResume();
  const sourceLayout = {
    sections: [
      { kind: "experience", heading: "Experience", lines: [] },
      { kind: "skills", heading: "Skills", lines: [] },
      { kind: "education", heading: "Education", lines: [] },
    ],
  };

  const replaced = editorReducer(
    { resume: null, sourceLayout: null },
    { type: "BULK_REPLACE", payload: { resume, sourceLayout } }
  );
  assert.equal(replaced.resume?.name, "Alex Doe");
  assert.equal(replaced.sourceLayout?.sections.length, 3);

  const patchedResume = { ...resume, name: "Alexandra Doe" };
  const patched = editorReducer(replaced, {
    type: "FORM_PATCH",
    payload: { resume: patchedResume },
  });
  assert.equal(patched.resume?.name, "Alexandra Doe");
});
