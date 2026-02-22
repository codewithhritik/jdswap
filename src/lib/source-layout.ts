import {
  SourceLayoutSchema,
  type ParsedResume,
  type SourceLayout,
  type SourceSection,
  type SourceSectionKind,
} from "./schema";

const HEADING_WITH_KEYWORD_RE =
  /^(work experience|professional experience|experience|skills|technical skills|core skills|skills & technologies|core competencies|education|project experience|projects|project work|summary|achievements|awards|certifications|publications|leadership|volunteer experience)$/i;

const GENERIC_HEADING_RE = /^[A-Z][A-Z0-9\s&/+.-]{2,40}$/;
const ARTIFACT_LINES = new Set(["top of form", "bottom of form"]);

function normalizeLine(line: string): string {
  return line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim();
}

function classifyHeading(heading: string): SourceSectionKind {
  const lowered = heading.toLowerCase();

  if (lowered.includes("summary")) return "summary";
  if (lowered.includes("skill") || lowered.includes("competenc")) return "skills";
  if (lowered.includes("education")) return "education";
  if (lowered.includes("project")) return "projects";
  if (lowered.includes("experience")) return "experience";

  return "custom";
}

function isKeywordHeading(line: string): boolean {
  return HEADING_WITH_KEYWORD_RE.test(line);
}

function isGenericHeading(line: string): boolean {
  if (!GENERIC_HEADING_RE.test(line)) return false;
  if (line.includes("@")) return false;
  if (/\d/.test(line)) return false;
  if (/[,;:]/.test(line)) return false;

  return true;
}

function isArtifact(line: string): boolean {
  return ARTIFACT_LINES.has(line.toLowerCase());
}

function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((part) => part.length >= 4) ?? []
  );
}

function buildEduTokenSets(parsed: ParsedResume): Array<Set<string>> {
  return parsed.education.map((entry) => {
    const tokens = new Set<string>();
    for (const token of tokenize(`${entry.institution} ${entry.degree}`)) {
      tokens.add(token);
    }
    return tokens;
  });
}

function findEducationIndexForLine(
  line: string,
  tokenSets: Array<Set<string>>
): number {
  const tokens = tokenize(line);
  if (tokens.length === 0) return -1;

  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < tokenSets.length; i++) {
    const set = tokenSets[i]!;
    let score = 0;
    for (const token of tokens) {
      if (set.has(token)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestScore >= 2 ? bestIdx : -1;
}

function enrichEducationSection(
  section: SourceSection,
  parsed: ParsedResume
): SourceSection {
  if (section.kind !== "education") return section;
  if (parsed.education.length === 0) return section;

  const tokenSets = buildEduTokenSets(parsed);
  const detailBlocks = parsed.education.map(() => [] as string[]);
  let activeEduIndex = -1;

  for (const line of section.lines) {
    const matchedEduIndex = findEducationIndexForLine(line, tokenSets);
    if (matchedEduIndex !== -1) {
      activeEduIndex = matchedEduIndex;
      continue;
    }

    if (activeEduIndex === -1) {
      continue;
    }

    detailBlocks[activeEduIndex]!.push(line);
  }

  return {
    ...section,
    educationDetailBlocks: detailBlocks,
  };
}

function buildDefaultLayout(parsed: ParsedResume): SourceLayout {
  const sections: SourceSection[] = [
    { kind: "experience", heading: "Experience", lines: [] },
    { kind: "skills", heading: "Skills", lines: [] },
    { kind: "education", heading: "Education", lines: [] },
  ];

  if (parsed.projects && parsed.projects.length > 0) {
    sections.push({ kind: "projects", heading: "Projects", lines: [] });
  }

  return SourceLayoutSchema.parse({ sections });
}

export function extractSourceLayout(
  rawText: string,
  parsed: ParsedResume
): SourceLayout {
  const lines = rawText.split(/\r?\n/);
  const sections: SourceSection[] = [];
  let started = false;
  let current: SourceSection | null = null;

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);
    if (!line) continue;
    if (isArtifact(line)) continue;

    const keywordHeading = isKeywordHeading(line);
    const genericHeading = started && isGenericHeading(line);

    if (keywordHeading || genericHeading) {
      started = true;
      current = {
        kind: classifyHeading(line),
        heading: line,
        lines: [],
      };
      sections.push(current);
      continue;
    }

    if (!current) continue;
    current.lines.push(line);
  }

  if (sections.length === 0) {
    return buildDefaultLayout(parsed);
  }

  const enriched = sections.map((section) => enrichEducationSection(section, parsed));
  return SourceLayoutSchema.parse({ sections: enriched });
}
