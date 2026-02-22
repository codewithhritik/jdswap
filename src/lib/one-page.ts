import {
  TailoredResumeSchema,
  type SourceLayout,
  type TailoredResume,
} from "./schema";
import { buildRenderSections } from "./resume-layout";
import { normalizeSkillLines, removeOneSkillItem } from "./skills";

const MAX_ESTIMATED_LINES = 58;
const CHARS_PER_LINE = 95;
const BULLET_CHARS_PER_LINE = 110;

export interface OnePageCompactionResult {
  resume: TailoredResume;
  estimatedLines: number;
  fits: boolean;
  reason?: string;
}

function estimateWrappedLines(text: string, charsPerLine = CHARS_PER_LINE): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / charsPerLine));
}

export function estimateResumeLines(
  resume: TailoredResume,
  sourceLayout: SourceLayout
): number {
  let lines = 0;

  lines += 2; // name + contact row

  const sections = buildRenderSections(resume, sourceLayout);
  const normalizedSkills = normalizeSkillLines(resume.skills);

  for (const section of sections) {
    lines += 1; // section heading

    switch (section.kind) {
      case "summary": {
        if (resume.summary) {
          lines += estimateWrappedLines(resume.summary);
        } else {
          for (const line of section.sourceLines) {
            lines += estimateWrappedLines(line);
          }
        }
        break;
      }
      case "skills": {
        const skillsLines =
          normalizedSkills.length > 0 ? normalizedSkills : section.sourceLines;
        for (const line of skillsLines) {
          lines += estimateWrappedLines(line);
        }
        break;
      }
      case "experience": {
        if (resume.experience.length > 0) {
          for (const exp of resume.experience) {
            lines += 1;
            for (const bullet of exp.bullets) {
              lines += estimateWrappedLines(bullet.text, BULLET_CHARS_PER_LINE);
            }
          }
        } else {
          for (const line of section.sourceLines) {
            lines += estimateWrappedLines(line);
          }
        }
        break;
      }
      case "education": {
        if (resume.education.length > 0) {
          for (let i = 0; i < resume.education.length; i++) {
            const edu = resume.education[i]!;
            lines += 1;

            const detailLines = section.educationDetailBlocks?.[i] ?? [];
            for (const detail of detailLines) {
              lines += estimateWrappedLines(detail);
            }

            if (edu.gpa) lines += estimateWrappedLines(`GPA: ${edu.gpa}`);
            if (edu.honors) lines += estimateWrappedLines(edu.honors);
          }
        } else {
          for (const line of section.sourceLines) {
            lines += estimateWrappedLines(line);
          }
        }
        break;
      }
      case "projects": {
        if (resume.projects && resume.projects.length > 0) {
          for (const project of resume.projects) {
            lines += 1;
            for (const bullet of project.bullets) {
              lines += estimateWrappedLines(bullet.text, BULLET_CHARS_PER_LINE);
            }
          }
        } else {
          for (const line of section.sourceLines) {
            lines += estimateWrappedLines(line);
          }
        }
        break;
      }
      case "custom": {
        for (const line of section.sourceLines) {
          lines += estimateWrappedLines(line);
        }
        break;
      }
      default:
        break;
    }

    lines += 1; // section spacing
  }

  return lines;
}

function cloneResume(resume: TailoredResume): TailoredResume {
  return TailoredResumeSchema.parse(JSON.parse(JSON.stringify(resume)));
}

export function compactResumeForOnePage(
  resume: TailoredResume,
  sourceLayout: SourceLayout
): OnePageCompactionResult {
  const working = cloneResume(resume);
  working.skills = normalizeSkillLines(working.skills);

  const recompute = () => estimateResumeLines(working, sourceLayout);

  let estimatedLines = recompute();
  if (estimatedLines <= MAX_ESTIMATED_LINES) {
    return { resume: working, estimatedLines, fits: true };
  }

  while (estimatedLines > MAX_ESTIMATED_LINES) {
    let removed = false;

    for (let roleIndex = working.experience.length - 1; roleIndex >= 0; roleIndex--) {
      const role = working.experience[roleIndex]!;
      if (role.bullets.length <= 1) continue;
      role.bullets = role.bullets.slice(0, -1);
      removed = true;

      estimatedLines = recompute();
      if (estimatedLines <= MAX_ESTIMATED_LINES) {
        return { resume: working, estimatedLines, fits: true };
      }
    }

    if (!removed) break;
  }

  if (working.projects && working.projects.length > 0) {
    while (estimatedLines > MAX_ESTIMATED_LINES) {
      let removed = false;

      for (
        let projectIndex = working.projects.length - 1;
        projectIndex >= 0;
        projectIndex--
      ) {
        const project = working.projects[projectIndex]!;
        if (project.bullets.length <= 1) continue;
        project.bullets = project.bullets.slice(0, -1);
        removed = true;

        estimatedLines = recompute();
        if (estimatedLines <= MAX_ESTIMATED_LINES) {
          return { resume: working, estimatedLines, fits: true };
        }
      }

      if (!removed) break;
    }
  }

  while (estimatedLines > MAX_ESTIMATED_LINES && working.skills.length > 0) {
    const next = removeOneSkillItem(working.skills);
    if (next.length === working.skills.length && next.every((x, i) => x === working.skills[i])) {
      break;
    }

    working.skills = next;
    estimatedLines = recompute();
    if (estimatedLines <= MAX_ESTIMATED_LINES) {
      return { resume: working, estimatedLines, fits: true };
    }
  }

  return {
    resume: working,
    estimatedLines,
    fits: false,
    reason:
      "Strict one-page fit conflicts with preserving all source sections. Reduce content manually or remove non-core sections.",
  };
}
