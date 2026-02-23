import {
  SourceLayoutSchema,
  TailoredResumeSchema,
  type SourceLayout,
  type TailoredResume,
} from "./schema";
import { buildRenderSections } from "./resume-layout";
import {
  compactSkillsForExport,
  normalizeSkillLines,
  removeOneSkillItemAtsPriority,
  reapplySkillTrimOperation,
  restoreSkillTrimOperation,
} from "./skills";

const DEFAULT_MAX_ESTIMATED_LINES = 60;
const TARGET_ESTIMATED_LINES_MIN = 56;
const TARGET_ESTIMATED_LINES_MAX = 60;
const CHARS_PER_LINE = 95;
const BULLET_CHARS_PER_LINE = 110;

export interface OnePageCompactionDiagnostics {
  initialEstimatedLines: number;
  finalEstimatedLines: number;
  removedProjects: number;
  removedProjectBullets: number;
  removedSkillItems: number;
  backfillApplied: number;
  preservedAtLeastOneProject: boolean;
  targetDensityHit: boolean;
}

export interface OnePageCompactionOptions {
  maxEstimatedLines?: number;
  targetEstimatedLinesMin?: number;
  targetEstimatedLinesMax?: number;
  enableBackfill?: boolean;
}

export interface OnePageCompactionResult {
  resume: TailoredResume;
  sourceLayout: SourceLayout;
  estimatedLines: number;
  fits: boolean;
  droppedSections: Array<"custom" | "projects">;
  reason?: string;
  diagnostics?: OnePageCompactionDiagnostics;
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
  const normalizedSkills = compactSkillsForExport(
    normalizeSkillLines(resume.skills)
  );

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
        const fallbackSkills = compactSkillsForExport(
          normalizeSkillLines(section.sourceLines)
        );
        const skillsLines =
          normalizedSkills.length > 0
            ? normalizedSkills
            : fallbackSkills.length > 0
              ? fallbackSkills
              : section.sourceLines;
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

function cloneSourceLayout(sourceLayout: SourceLayout): SourceLayout {
  return SourceLayoutSchema.parse(JSON.parse(JSON.stringify(sourceLayout)));
}

interface CompactionOperation {
  seq: number;
  restorePriority: number;
  restore: () => boolean;
  reapply: () => boolean;
}

function removeDroppedSection(
  droppedSections: Set<"custom" | "projects">,
  kind: "custom" | "projects",
  shouldDrop: boolean
) {
  if (shouldDrop) droppedSections.add(kind);
  else droppedSections.delete(kind);
}

export function compactResumeForOnePage(
  resume: TailoredResume,
  sourceLayout: SourceLayout,
  options?: OnePageCompactionOptions
): OnePageCompactionResult {
  const working = cloneResume(resume);
  const workingSourceLayout = cloneSourceLayout(sourceLayout);
  const droppedSections = new Set<"custom" | "projects">();
  const operations: CompactionOperation[] = [];
  const initialProjectsCount = working.projects?.length ?? 0;

  const maxEstimatedLines = Math.max(
    1,
    options?.maxEstimatedLines ?? DEFAULT_MAX_ESTIMATED_LINES
  );
  const targetEstimatedLinesMin = Math.min(
    Math.max(0, options?.targetEstimatedLinesMin ?? TARGET_ESTIMATED_LINES_MIN),
    maxEstimatedLines
  );
  const targetEstimatedLinesMax = Math.min(
    Math.max(
      targetEstimatedLinesMin,
      options?.targetEstimatedLinesMax ?? TARGET_ESTIMATED_LINES_MAX
    ),
    maxEstimatedLines
  );
  const enableBackfill = options?.enableBackfill ?? true;

  working.skills = normalizeSkillLines(working.skills);

  const diagnostics: OnePageCompactionDiagnostics = {
    initialEstimatedLines: 0,
    finalEstimatedLines: 0,
    removedProjects: 0,
    removedProjectBullets: 0,
    removedSkillItems: 0,
    backfillApplied: 0,
    preservedAtLeastOneProject: true,
    targetDensityHit: false,
  };

  let seq = 0;
  const recompute = () => estimateResumeLines(working, workingSourceLayout);
  let estimatedLines = recompute();
  diagnostics.initialEstimatedLines = estimatedLines;

  const addOperation = (
    restorePriority: number,
    restore: () => boolean,
    reapply: () => boolean
  ) => {
    operations.push({
      seq: seq++,
      restorePriority,
      restore,
      reapply,
    });
  };

  // Phase A: compress to fit strict one-page budget.
  if (estimatedLines > maxEstimatedLines) {
    const customSectionIndex = workingSourceLayout.sections.findIndex(
      (section) => section.kind === "custom"
    );
    if (customSectionIndex >= 0) {
      const [removedSection] = workingSourceLayout.sections.splice(customSectionIndex, 1);
      removeDroppedSection(droppedSections, "custom", true);

      addOperation(
        3,
        () => {
          const alreadyPresent = workingSourceLayout.sections.some(
            (section) =>
              section.kind === "custom" &&
              section.heading === removedSection!.heading &&
              section.lines.join("\n") === removedSection!.lines.join("\n")
          );
          if (alreadyPresent) return false;
          const insertAt = Math.min(customSectionIndex, workingSourceLayout.sections.length);
          workingSourceLayout.sections.splice(insertAt, 0, removedSection!);
          removeDroppedSection(droppedSections, "custom", false);
          return true;
        },
        () => {
          const idx = workingSourceLayout.sections.findIndex(
            (section) =>
              section.kind === "custom" &&
              section.heading === removedSection!.heading &&
              section.lines.join("\n") === removedSection!.lines.join("\n")
          );
          if (idx < 0) return false;
          workingSourceLayout.sections.splice(idx, 1);
          removeDroppedSection(droppedSections, "custom", true);
          return true;
        }
      );

      estimatedLines = recompute();
    }
  }

  while (estimatedLines > maxEstimatedLines && working.projects && working.projects.length > 0) {
    let removed = false;

    for (let projectIndex = working.projects.length - 1; projectIndex >= 0; projectIndex--) {
      const project = working.projects[projectIndex]!;
      if (project.bullets.length <= 1) continue;

      const removedBullet = project.bullets.pop()!;
      diagnostics.removedProjectBullets += 1;
      removed = true;

      addOperation(
        0,
        () => {
          const candidate = working.projects?.[projectIndex];
          if (!candidate) return false;
          candidate.bullets.push(removedBullet);
          return true;
        },
        () => {
          const candidate = working.projects?.[projectIndex];
          if (!candidate || candidate.bullets.length === 0) return false;
          const tail = candidate.bullets[candidate.bullets.length - 1];
          if (tail?.text !== removedBullet.text) return false;
          candidate.bullets.pop();
          return true;
        }
      );

      estimatedLines = recompute();
      if (estimatedLines <= maxEstimatedLines) break;
    }

    if (!removed) break;
  }

  while (estimatedLines > maxEstimatedLines && working.projects && working.projects.length > 1) {
    const removedProjectIndex = working.projects.length - 1;
    const [removedProject] = working.projects.splice(removedProjectIndex, 1);
    diagnostics.removedProjects += 1;

    addOperation(
      0,
      () => {
        if (!working.projects) working.projects = [];
        const insertAt = Math.min(removedProjectIndex, working.projects.length);
        working.projects.splice(insertAt, 0, removedProject!);
        return true;
      },
      () => {
        if (!working.projects || removedProjectIndex >= working.projects.length) return false;
        const candidate = working.projects[removedProjectIndex];
        if (candidate?.name !== removedProject!.name) return false;
        working.projects.splice(removedProjectIndex, 1);
        return true;
      }
    );

    estimatedLines = recompute();
  }

  while (estimatedLines > maxEstimatedLines && working.skills.length > 0) {
    let removal = removeOneSkillItemAtsPriority(working.skills, {
      enforceCoreMinimum: true,
    });

    if (!removal.removed) {
      removal = removeOneSkillItemAtsPriority(working.skills, {
        enforceCoreMinimum: false,
      });
    }

    if (!removal.removed) break;

    const removedSkill = removal.removed;
    working.skills = removal.nextLines;
    diagnostics.removedSkillItems += 1;

    addOperation(
      1,
      () => {
        working.skills = restoreSkillTrimOperation(working.skills, removedSkill);
        return true;
      },
      () => {
        const next = reapplySkillTrimOperation(working.skills, removedSkill);
        const changed =
          next.length !== working.skills.length ||
          next.some((line, idx) => line !== working.skills[idx]);
        working.skills = next;
        return changed;
      }
    );

    estimatedLines = recompute();
  }

  while (estimatedLines > maxEstimatedLines) {
    let removed = false;

    for (let roleIndex = working.experience.length - 1; roleIndex >= 0; roleIndex--) {
      const role = working.experience[roleIndex]!;
      if (role.bullets.length <= 1) continue;
      const removedBullet = role.bullets.pop()!;
      removed = true;

      addOperation(
        2,
        () => {
          const candidate = working.experience[roleIndex];
          if (!candidate) return false;
          candidate.bullets.push(removedBullet);
          return true;
        },
        () => {
          const candidate = working.experience[roleIndex];
          if (!candidate || candidate.bullets.length === 0) return false;
          const tail = candidate.bullets[candidate.bullets.length - 1];
          if (tail?.text !== removedBullet.text) return false;
          candidate.bullets.pop();
          return true;
        }
      );

      estimatedLines = recompute();
      if (estimatedLines <= maxEstimatedLines) break;
    }

    if (!removed) break;
  }

  // Drop the remaining projects section only after all higher-priority trims,
  // including last-resort experience bullet compaction, are exhausted.
  if (estimatedLines > maxEstimatedLines && working.projects && working.projects.length > 0) {
    const removedProjects = working.projects;
    const removedProjectCount = removedProjects.length;
    const removedSectionIndex = workingSourceLayout.sections.findIndex(
      (section) => section.kind === "projects"
    );
    const removedSection =
      removedSectionIndex >= 0
        ? workingSourceLayout.sections.splice(removedSectionIndex, 1)[0]!
        : null;

    working.projects = null;
    diagnostics.removedProjects += removedProjectCount;
    removeDroppedSection(droppedSections, "projects", true);

    addOperation(
      0,
      () => {
        if (working.projects && working.projects.length > 0) return false;
        working.projects = removedProjects;
        if (
          removedSection &&
          !workingSourceLayout.sections.some((section) => section.kind === "projects")
        ) {
          const insertAt = Math.min(
            removedSectionIndex >= 0 ? removedSectionIndex : workingSourceLayout.sections.length,
            workingSourceLayout.sections.length
          );
          workingSourceLayout.sections.splice(insertAt, 0, removedSection);
        }
        removeDroppedSection(droppedSections, "projects", false);
        return true;
      },
      () => {
        const hadProjects = Boolean(working.projects?.length);
        if (!hadProjects) return false;
        working.projects = null;
        const idx = workingSourceLayout.sections.findIndex(
          (section) =>
            section.kind === "projects" &&
            (!removedSection || section.heading === removedSection.heading)
        );
        if (idx >= 0) workingSourceLayout.sections.splice(idx, 1);
        removeDroppedSection(droppedSections, "projects", true);
        return true;
      }
    );

    estimatedLines = recompute();
  }

  if (estimatedLines > maxEstimatedLines) {
    diagnostics.finalEstimatedLines = estimatedLines;
    diagnostics.preservedAtLeastOneProject =
      initialProjectsCount === 0 || Boolean(working.projects?.length);
    diagnostics.targetDensityHit = false;
    return {
      resume: working,
      sourceLayout: workingSourceLayout,
      estimatedLines,
      fits: false,
      droppedSections: Array.from(droppedSections),
      reason:
        "Strict one-page fit conflicts with preserving core sections. Reduce required section content manually.",
      diagnostics,
    };
  }

  // Phase B: backfill to hit high-density target without exceeding page budget.
  if (enableBackfill && estimatedLines < targetEstimatedLinesMin && operations.length > 0) {
    const restoreQueue = [...operations].sort(
      (a, b) => a.restorePriority - b.restorePriority || b.seq - a.seq
    );

    for (const operation of restoreQueue) {
      if (estimatedLines >= targetEstimatedLinesMin) break;
      const restored = operation.restore();
      if (!restored) continue;

      const backfilledEstimate = recompute();
      if (
        backfilledEstimate > maxEstimatedLines ||
        backfilledEstimate > targetEstimatedLinesMax
      ) {
        operation.reapply();
        estimatedLines = recompute();
        continue;
      }

      estimatedLines = backfilledEstimate;
      diagnostics.backfillApplied += 1;
    }
  }

  diagnostics.finalEstimatedLines = estimatedLines;
  diagnostics.preservedAtLeastOneProject =
    initialProjectsCount === 0 || Boolean(working.projects?.length);
  diagnostics.targetDensityHit =
    estimatedLines >= targetEstimatedLinesMin && estimatedLines <= targetEstimatedLinesMax;

  return {
    resume: working,
    sourceLayout: workingSourceLayout,
    estimatedLines,
    fits: true,
    droppedSections: Array.from(droppedSections),
    diagnostics,
  };
}
