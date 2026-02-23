import { parseSkillsEditorInput } from "./skills";
import type { TailoredResume } from "./schema";

export type ContactField =
  | "name"
  | "email"
  | "phone"
  | "linkedin"
  | "github"
  | "website";

export type ExperienceField = "company" | "title" | "location" | "dateRange";
export type EducationField =
  | "institution"
  | "degree"
  | "dateRange"
  | "gpa"
  | "honors";
export type ProjectField = "name" | "technologies";

function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

export function updateResumeContactField(
  resume: TailoredResume,
  field: ContactField,
  value: string
): TailoredResume {
  const nextValue =
    field === "linkedin" || field === "github" || field === "website"
      ? toNullableText(value)
      : value;

  if (resume[field] === nextValue) return resume;
  return { ...resume, [field]: nextValue };
}

export function updateResumeSummary(
  resume: TailoredResume,
  value: string
): TailoredResume {
  const nextSummary = toNullableText(value);
  if (resume.summary === nextSummary) return resume;
  return { ...resume, summary: nextSummary };
}

export function updateResumeSkillsFromEditorInput(
  resume: TailoredResume,
  editorValue: string
): TailoredResume {
  const parsedSkills = parseSkillsEditorInput(editorValue);
  if (arraysEqual(resume.skills, parsedSkills)) return resume;
  return { ...resume, skills: parsedSkills };
}

export function updateExperienceField(
  resume: TailoredResume,
  entryIndex: number,
  field: ExperienceField,
  value: string
): TailoredResume {
  const current = resume.experience[entryIndex];
  if (!current || current[field] === value) return resume;

  const nextExperience = [...resume.experience];
  nextExperience[entryIndex] = { ...current, [field]: value };
  return { ...resume, experience: nextExperience };
}

export function updateExperienceBulletText(
  resume: TailoredResume,
  entryIndex: number,
  bulletIndex: number,
  text: string
): TailoredResume {
  const currentEntry = resume.experience[entryIndex];
  const currentBullet = currentEntry?.bullets[bulletIndex];
  if (!currentEntry || !currentBullet || currentBullet.text === text) return resume;

  const nextBullets = [...currentEntry.bullets];
  nextBullets[bulletIndex] = { text };
  const nextExperience = [...resume.experience];
  nextExperience[entryIndex] = { ...currentEntry, bullets: nextBullets };

  return { ...resume, experience: nextExperience };
}

export function updateEducationField(
  resume: TailoredResume,
  entryIndex: number,
  field: EducationField,
  value: string
): TailoredResume {
  const current = resume.education[entryIndex];
  if (!current) return resume;

  const nextValue =
    field === "gpa" || field === "honors" ? toNullableText(value) : value;

  if (current[field] === nextValue) return resume;

  const nextEducation = [...resume.education];
  nextEducation[entryIndex] = { ...current, [field]: nextValue };
  return { ...resume, education: nextEducation };
}

export function updateProjectField(
  resume: TailoredResume,
  entryIndex: number,
  field: ProjectField,
  value: string
): TailoredResume {
  if (!resume.projects) return resume;
  const current = resume.projects[entryIndex];
  if (!current || current[field] === value) return resume;

  const nextProjects = [...resume.projects];
  nextProjects[entryIndex] = { ...current, [field]: value };
  return { ...resume, projects: nextProjects };
}

export function updateProjectBulletText(
  resume: TailoredResume,
  entryIndex: number,
  bulletIndex: number,
  text: string
): TailoredResume {
  if (!resume.projects) return resume;

  const currentEntry = resume.projects[entryIndex];
  const currentBullet = currentEntry?.bullets[bulletIndex];
  if (!currentEntry || !currentBullet || currentBullet.text === text) return resume;

  const nextBullets = [...currentEntry.bullets];
  nextBullets[bulletIndex] = { text };
  const nextProjects = [...resume.projects];
  nextProjects[entryIndex] = { ...currentEntry, bullets: nextBullets };

  return { ...resume, projects: nextProjects };
}
