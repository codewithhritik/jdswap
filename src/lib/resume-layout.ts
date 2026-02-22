import {
  type SourceLayout,
  type SourceSection,
  type SourceSectionKind,
  type TailoredResume,
} from "./schema";
import { normalizeSkillLines } from "./skills";

export interface RenderSection {
  kind: SourceSectionKind;
  heading: string;
  sourceLines: string[];
  educationDetailBlocks?: string[][];
}

const KNOWN_SECTION_ORDER: SourceSectionKind[] = [
  "summary",
  "experience",
  "skills",
  "education",
  "projects",
];

const DEFAULT_HEADINGS: Record<SourceSectionKind, string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  custom: "Section",
};

function hasContent(
  kind: SourceSectionKind,
  resume: TailoredResume,
  sourceSection?: SourceSection
): boolean {
  switch (kind) {
    case "summary":
      return Boolean(resume.summary) || Boolean(sourceSection?.lines.length);
    case "skills":
      return (
        normalizeSkillLines(resume.skills).length > 0 ||
        Boolean(sourceSection?.lines.length)
      );
    case "experience":
      return resume.experience.length > 0 || Boolean(sourceSection?.lines.length);
    case "education":
      return resume.education.length > 0 || Boolean(sourceSection?.lines.length);
    case "projects":
      return (
        Boolean(resume.projects && resume.projects.length > 0) ||
        Boolean(sourceSection?.lines.length)
      );
    case "custom":
      return Boolean(sourceSection?.lines.length);
    default:
      return false;
  }
}

export function buildRenderSections(
  resume: TailoredResume,
  sourceLayout: SourceLayout
): RenderSection[] {
  const renderSections: RenderSection[] = [];
  const emittedKnownKinds = new Set<SourceSectionKind>();

  for (const section of sourceLayout.sections) {
    if (!hasContent(section.kind, resume, section)) continue;

    if (section.kind !== "custom") {
      if (emittedKnownKinds.has(section.kind)) continue;
      emittedKnownKinds.add(section.kind);
    }

    renderSections.push({
      kind: section.kind,
      heading: section.heading || DEFAULT_HEADINGS[section.kind],
      sourceLines: section.lines,
      educationDetailBlocks: section.educationDetailBlocks,
    });
  }

  for (const kind of KNOWN_SECTION_ORDER) {
    if (emittedKnownKinds.has(kind)) continue;
    if (!hasContent(kind, resume)) continue;

    renderSections.push({
      kind,
      heading: DEFAULT_HEADINGS[kind],
      sourceLines: [],
    });
  }

  return renderSections;
}
