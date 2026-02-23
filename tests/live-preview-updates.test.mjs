import test from "node:test";
import assert from "node:assert/strict";
import {
  updateEducationField,
  updateExperienceBulletText,
  updateExperienceField,
  updateProjectBulletText,
  updateProjectField,
  updateResumeContactField,
  updateResumeSkillsFromEditorInput,
  updateResumeSummary,
} from "../src/lib/live-preview-updates.ts";
import { formatSkillsForEditor } from "../src/lib/skills.ts";

function createResume() {
  return {
    name: "Alex Doe",
    email: "alex@example.com",
    phone: "555-111-2222",
    linkedin: "linkedin.com/in/alex",
    github: "github.com/alex",
    website: null,
    summary: null,
    skills: ["Languages: TypeScript, Go", "Frameworks: React, Next.js"],
    experience: [
      {
        company: "Acme",
        title: "Software Engineer",
        location: "Remote",
        dateRange: "Jan 2022 - Present",
        bullets: [
          { text: "Built internal tools and improved release velocity." },
          { text: "Reduced on-call incidents by shipping resilient service patterns." },
        ],
      },
      {
        company: "Beta",
        title: "Engineer",
        location: "Remote",
        dateRange: "Jan 2020 - Dec 2021",
        bullets: [{ text: "Maintained APIs." }],
      },
    ],
    education: [
      {
        institution: "State University",
        degree: "B.S. Computer Science",
        dateRange: "2016 - 2020",
        gpa: "3.9",
        honors: "Magna Cum Laude",
      },
    ],
    projects: [
      {
        name: "Ops Console",
        technologies: "React, Node.js, PostgreSQL",
        bullets: [{ text: "Built operations dashboard." }],
      },
    ],
  };
}

test("contact and summary updates preserve immutability", () => {
  const resume = createResume();

  const nextName = updateResumeContactField(resume, "name", "Alexandra Doe");
  assert.notEqual(nextName, resume);
  assert.equal(nextName.name, "Alexandra Doe");
  assert.equal(nextName.experience, resume.experience);
  assert.equal(nextName.education, resume.education);

  const sameName = updateResumeContactField(nextName, "name", "Alexandra Doe");
  assert.equal(sameName, nextName);

  const clearedWebsite = updateResumeContactField(nextName, "website", "   ");
  assert.equal(clearedWebsite.website, null);

  const summarySet = updateResumeSummary(resume, "Builder of scalable systems.");
  assert.equal(summarySet.summary, "Builder of scalable systems.");

  const summaryNoChange = updateResumeSummary(summarySet, "Builder of scalable systems.");
  assert.equal(summaryNoChange, summarySet);
});

test("skills parsing updates only when content changes", () => {
  const resume = createResume();

  const sameSkills = updateResumeSkillsFromEditorInput(
    resume,
    formatSkillsForEditor(resume.skills)
  );
  assert.equal(sameSkills, resume);

  const nextSkills = updateResumeSkillsFromEditorInput(
    resume,
    "Languages: TypeScript, Go\nCloud: AWS, GCP"
  );
  assert.notEqual(nextSkills, resume);
  assert.deepEqual(nextSkills.skills, [
    "Languages: TypeScript, Go",
    "Cloud: AWS, GCP",
  ]);
  assert.equal(nextSkills.experience, resume.experience);
});

test("experience updates only replace touched branches", () => {
  const resume = createResume();

  const entryChanged = updateExperienceField(
    resume,
    0,
    "company",
    "Acme Platforms"
  );
  assert.notEqual(entryChanged, resume);
  assert.notEqual(entryChanged.experience, resume.experience);
  assert.notEqual(entryChanged.experience[0], resume.experience[0]);
  assert.equal(entryChanged.experience[1], resume.experience[1]);
  assert.equal(entryChanged.education, resume.education);

  const bulletChanged = updateExperienceBulletText(
    entryChanged,
    0,
    1,
    "Lowered incident rates with retry-safe async workflows."
  );
  assert.notEqual(bulletChanged, entryChanged);
  assert.notEqual(
    bulletChanged.experience[0].bullets,
    entryChanged.experience[0].bullets
  );
  assert.equal(
    bulletChanged.experience[0].bullets[1].text,
    "Lowered incident rates with retry-safe async workflows."
  );
  assert.equal(
    bulletChanged.experience[1],
    entryChanged.experience[1]
  );

  const noChange = updateExperienceBulletText(
    bulletChanged,
    0,
    1,
    "Lowered incident rates with retry-safe async workflows."
  );
  assert.equal(noChange, bulletChanged);
});

test("education and projects preserve shape and nullable fields", () => {
  const resume = createResume();

  const educationUpdated = updateEducationField(resume, 0, "gpa", " ");
  assert.equal(educationUpdated.education[0].gpa, null);
  assert.equal(educationUpdated.experience, resume.experience);

  const projectUpdated = updateProjectField(
    educationUpdated,
    0,
    "technologies",
    "React, Node.js, PostgreSQL, Redis"
  );
  assert.equal(
    projectUpdated.projects[0].technologies,
    "React, Node.js, PostgreSQL, Redis"
  );
  assert.notEqual(projectUpdated.projects, educationUpdated.projects);

  const projectBulletUpdated = updateProjectBulletText(
    projectUpdated,
    0,
    0,
    "Built an operations dashboard used by 100+ engineers."
  );
  assert.equal(
    projectBulletUpdated.projects[0].bullets[0].text,
    "Built an operations dashboard used by 100+ engineers."
  );
});
