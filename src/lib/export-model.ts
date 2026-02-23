import { buildRenderSections } from "./resume-layout";
import type { SourceLayout, TailoredResume } from "./schema";
import { compactSkillsForExport, normalizeSkillLines } from "./skills";
import { isNullLike, sanitizeText } from "./text";

export type CanonicalParagraphStyleName =
  | "name"
  | "contact"
  | "sectionHeading"
  | "skills"
  | "body"
  | "entryHeader"
  | "bullet";

export interface CanonicalParagraphStyleOptions {
  bold?: boolean;
  italic?: boolean;
  center?: boolean;
  fontSizeHalfPoints?: number;
  spacingBefore?: number;
  spacingAfter?: number;
  indentLeft?: number;
  hanging?: number;
  lineHeightMultiple?: number;
  sectionDivider?: boolean;
}

export interface CanonicalParagraph {
  style: CanonicalParagraphStyleName;
  text: string;
  semanticRole?: "skillsLine";
}

export interface CanonicalResumeDocumentModel {
  paragraphs: CanonicalParagraph[];
}

const STYLE_OPTIONS: Record<
  CanonicalParagraphStyleName,
  CanonicalParagraphStyleOptions
> = {
  name: {
    bold: true,
    center: true,
    fontSizeHalfPoints: 34,
    spacingAfter: 70,
  },
  contact: {
    center: true,
    fontSizeHalfPoints: 20,
    spacingAfter: 90,
  },
  sectionHeading: {
    bold: true,
    fontSizeHalfPoints: 22,
    spacingBefore: 120,
    spacingAfter: 55,
    sectionDivider: true,
  },
  skills: {
    fontSizeHalfPoints: 20,
    spacingAfter: 14,
    lineHeightMultiple: 1.12,
  },
  body: {
    fontSizeHalfPoints: 21,
    spacingAfter: 20,
  },
  entryHeader: {
    bold: true,
    fontSizeHalfPoints: 21,
    spacingAfter: 18,
  },
  bullet: {
    fontSizeHalfPoints: 20,
    spacingAfter: 12,
    indentLeft: 360,
    hanging: 220,
  },
};

export function getCanonicalParagraphStyleOptions(
  style: CanonicalParagraphStyleName
): CanonicalParagraphStyleOptions {
  return STYLE_OPTIONS[style];
}

function pushParagraph(
  paragraphs: CanonicalParagraph[],
  style: CanonicalParagraphStyleName,
  text: string,
  semanticRole?: CanonicalParagraph["semanticRole"]
) {
  const sanitized = sanitizeText(text);
  if (isNullLike(sanitized)) return;
  paragraphs.push({ style, text: sanitized, semanticRole });
}

export function buildCanonicalResumeDocumentModel(
  resume: TailoredResume,
  sourceLayout: SourceLayout
): CanonicalResumeDocumentModel {
  const paragraphs: CanonicalParagraph[] = [];

  const contactParts = [sanitizeText(resume.email), sanitizeText(resume.phone)].filter(
    (part) => !isNullLike(part)
  );
  if (!isNullLike(resume.linkedin)) contactParts.push(sanitizeText(resume.linkedin ?? ""));
  if (!isNullLike(resume.github)) contactParts.push(sanitizeText(resume.github ?? ""));
  if (!isNullLike(resume.website)) contactParts.push(sanitizeText(resume.website ?? ""));

  pushParagraph(paragraphs, "name", resume.name);
  if (contactParts.length > 0) {
    pushParagraph(paragraphs, "contact", contactParts.join(" | "));
  }

  const sections = buildRenderSections(resume, sourceLayout);
  const skillLines = compactSkillsForExport(
    normalizeSkillLines(resume.skills)
  )
    .map(sanitizeText)
    .filter((line) => !isNullLike(line));

  for (const section of sections) {
    pushParagraph(paragraphs, "sectionHeading", section.heading);

    if (section.kind === "summary") {
      if (!isNullLike(resume.summary)) {
        pushParagraph(paragraphs, "body", resume.summary ?? "");
      } else {
        for (const line of section.sourceLines) {
          if (isNullLike(line)) continue;
          pushParagraph(paragraphs, "body", line);
        }
      }
      continue;
    }

    if (section.kind === "skills") {
      const fallbackSkillLines = compactSkillsForExport(
        normalizeSkillLines(section.sourceLines)
      );
      const lines =
        skillLines.length > 0
          ? skillLines
          : fallbackSkillLines.length > 0
            ? fallbackSkillLines
            : section.sourceLines;
      for (const line of lines) {
        if (isNullLike(line)) continue;
        pushParagraph(paragraphs, "skills", line, "skillsLine");
      }
      continue;
    }

    if (section.kind === "experience") {
      if (resume.experience.length > 0) {
        for (const exp of resume.experience) {
          const locationPart = !isNullLike(exp.location)
            ? ` (${sanitizeText(exp.location ?? "")})`
            : "";
          const header = `${exp.title}, ${exp.company}${locationPart}  ${exp.dateRange}`;
          pushParagraph(paragraphs, "entryHeader", header);

          for (const bullet of exp.bullets) {
            if (isNullLike(bullet.text)) continue;
            pushParagraph(paragraphs, "bullet", `\u2022 ${bullet.text}`);
          }
        }
      } else {
        for (const line of section.sourceLines) {
          if (isNullLike(line)) continue;
          pushParagraph(paragraphs, "body", line);
        }
      }
      continue;
    }

    if (section.kind === "education") {
      if (resume.education.length > 0) {
        for (let i = 0; i < resume.education.length; i++) {
          const edu = resume.education[i]!;
          pushParagraph(
            paragraphs,
            "entryHeader",
            `${edu.degree}, ${edu.institution} - ${edu.dateRange}`
          );

          if (!isNullLike(edu.gpa)) {
            pushParagraph(paragraphs, "body", `GPA: ${sanitizeText(edu.gpa ?? "")}`);
          }
          if (!isNullLike(edu.honors)) {
            pushParagraph(paragraphs, "body", sanitizeText(edu.honors ?? ""));
          }

          const detailLines = section.educationDetailBlocks?.[i] ?? [];
          for (const detail of detailLines) {
            if (isNullLike(detail)) continue;
            pushParagraph(paragraphs, "body", detail);
          }
        }
      } else {
        for (const line of section.sourceLines) {
          if (isNullLike(line)) continue;
          pushParagraph(paragraphs, "body", line);
        }
      }
      continue;
    }

    if (section.kind === "projects") {
      if (resume.projects && resume.projects.length > 0) {
        for (const project of resume.projects) {
          const projectHeader = isNullLike(project.technologies)
            ? project.name
            : `${project.name}: ${project.technologies}`;
          pushParagraph(paragraphs, "entryHeader", projectHeader);

          for (const bullet of project.bullets) {
            if (isNullLike(bullet.text)) continue;
            pushParagraph(paragraphs, "bullet", `\u2022 ${bullet.text}`);
          }
        }
      } else {
        for (const line of section.sourceLines) {
          if (isNullLike(line)) continue;
          pushParagraph(paragraphs, "body", line);
        }
      }
      continue;
    }

    for (const line of section.sourceLines) {
      if (isNullLike(line)) continue;
      pushParagraph(paragraphs, "body", line);
    }
  }

  return { paragraphs };
}
