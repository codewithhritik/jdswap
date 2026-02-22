import { buildRenderSections } from "./resume-layout";
import type { SourceLayout, TailoredResume } from "./schema";
import { normalizeSkillLines } from "./skills";
import { isNullLike, sanitizeText } from "./text";

export type CanonicalParagraphStyleName =
  | "name"
  | "contact"
  | "sectionHeading"
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
    spacingBefore: 140,
    spacingAfter: 70,
    sectionDivider: true,
  },
  body: {
    fontSizeHalfPoints: 21,
    spacingAfter: 30,
  },
  entryHeader: {
    bold: true,
    fontSizeHalfPoints: 21,
    spacingAfter: 25,
  },
  bullet: {
    fontSizeHalfPoints: 20,
    spacingAfter: 20,
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
  const skillLines = normalizeSkillLines(resume.skills)
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
      const lines = skillLines.length > 0 ? skillLines : section.sourceLines;
      for (const line of lines) {
        if (isNullLike(line)) continue;
        pushParagraph(paragraphs, "body", line, "skillsLine");
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
