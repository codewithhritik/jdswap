import { GoogleGenAI, Type } from "@google/genai";
import {
  TailoredResumeSchema,
  ParsedResumeSchema,
  TailorReviewSchema,
  JdRequirementSchema,
  RoleFitAssignmentSchema,
  RoleValidationResultSchema,
  TailorDiagnosticsSchema,
  type TailorReview,
  type TailoredResume,
  type ParsedResume,
  type LoadingProgress,
  type JdRequirement,
  type RoleFitAssignment,
  type RoleValidationResult,
  type TailorDiagnostics,
} from "./schema";
import {
  PARSE_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
  buildParsePrompt,
  buildReviewPrompt,
} from "./prompt";
import { normalizeSkillLines } from "./skills";
import { createLogger, type Logger } from "./logger";
import { isNullLike, sanitizeText } from "./text";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const TAILOR_MODEL = "gemini-2.5-pro";
const REVIEW_MODEL = "gemini-2.5-flash";
const PARSE_MODEL = "gemini-2.5-flash";

const ACTION_VERBS = [
  "architected",
  "built",
  "reduced",
  "migrated",
  "automated",
  "shipped",
  "designed",
  "orchestrated",
  "accelerated",
  "streamlined",
  "deployed",
  "integrated",
  "optimized",
  "refactored",
  "implemented",
  "owned",
  "debugged",
  "scaled",
  "developed",
  "engineered",
  "improved",
];

const WEAK_PATTERNS = [
  "responsible for",
  "helped to",
  "worked on",
  "assisted with",
  "played a key role",
];

const IMPROBABLE_SCOPE_PATTERNS = [
  /managed\s+\d{2,}\s+engineers?/i,
  /set\s+company[- ]wide\s+strategy/i,
  /single-handedly/i,
  /global\s+transformation/i,
];

const IMPACT_PATTERNS = [
  /\d+\s*%/,
  /\$\s?\d+/,
  /\b\d+\s*(ms|s|sec|secs|seconds|minutes|mins|hours|hrs)\b/i,
  /\b\d+\s*(users?|mau|requests?\/s|req\/s|rps|services?|incidents?)\b/i,
  /\bfrom\b.+\bto\b/i,
];

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
  "you",
  "your",
  "we",
  "our",
  "will",
  "must",
  "required",
  "preferred",
  "experience",
  "years",
  "team",
  "work",
  "working",
  "knowledge",
  "ability",
  "strong",
]);

const TECH_CATALOG: Array<{ term: string; category: JdRequirement["category"] }> = [
  { term: "Java", category: "language" },
  { term: "Python", category: "language" },
  { term: "TypeScript", category: "language" },
  { term: "JavaScript", category: "language" },
  { term: "Go", category: "language" },
  { term: "Rust", category: "language" },
  { term: "C++", category: "language" },
  { term: "C#", category: "language" },
  { term: "Kotlin", category: "language" },
  { term: "Ruby", category: "language" },
  { term: "PHP", category: "language" },
  { term: "React", category: "framework" },
  { term: "Next.js", category: "framework" },
  { term: "Angular", category: "framework" },
  { term: "Vue", category: "framework" },
  { term: "Spring", category: "framework" },
  { term: "Spring Boot", category: "framework" },
  { term: "Django", category: "framework" },
  { term: "FastAPI", category: "framework" },
  { term: "Node.js", category: "framework" },
  { term: "Express", category: "framework" },
  { term: "Kafka", category: "tool" },
  { term: "RabbitMQ", category: "tool" },
  { term: "Docker", category: "tool" },
  { term: "Kubernetes", category: "tool" },
  { term: "Helm", category: "tool" },
  { term: "Terraform", category: "tool" },
  { term: "Airflow", category: "tool" },
  { term: "dbt", category: "tool" },
  { term: "Datadog", category: "tool" },
  { term: "Prometheus", category: "tool" },
  { term: "Grafana", category: "tool" },
  { term: "Jenkins", category: "tool" },
  { term: "GitHub Actions", category: "tool" },
  { term: "AWS", category: "cloud" },
  { term: "GCP", category: "cloud" },
  { term: "Azure", category: "cloud" },
  { term: "EKS", category: "cloud" },
  { term: "EC2", category: "cloud" },
  { term: "S3", category: "cloud" },
  { term: "Lambda", category: "cloud" },
  { term: "PostgreSQL", category: "database" },
  { term: "MySQL", category: "database" },
  { term: "MongoDB", category: "database" },
  { term: "Redis", category: "database" },
  { term: "DynamoDB", category: "database" },
  { term: "Snowflake", category: "database" },
  { term: "BigQuery", category: "database" },
  { term: "GraphQL", category: "methodology" },
  { term: "gRPC", category: "methodology" },
  { term: "REST", category: "methodology" },
  { term: "CI/CD", category: "methodology" },
  { term: "Microservices", category: "methodology" },
  { term: "OAuth", category: "methodology" },
  { term: "RBAC", category: "methodology" },
  { term: "Agile", category: "methodology" },
  { term: "Scrum", category: "methodology" },
];

const CATEGORY_LABELS: Record<JdRequirement["category"], string> = {
  language: "Languages",
  framework: "Frameworks",
  cloud: "Cloud",
  tool: "Tools",
  database: "Databases",
  methodology: "Methods",
  domain: "Domain",
  other: "Other",
};

function resolveLogger(logger?: Logger): Logger {
  return logger ?? createLogger({ component: "gemini" });
}

function compactSkills(skills: string[]): string[] {
  const cleaned = normalizeSkillLines(skills);
  if (cleaned.length <= 20) return cleaned;
  return cleaned.slice(0, 20);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9.+#-]+/g)?.filter((t) => t.length >= 2) ?? [];
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

function includesTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  return pattern.test(text);
}

function buildKeywordSets(jdText: string): {
  allKeywords: Set<string>;
  priorityKeywords: Set<string>;
} {
  const allKeywords = new Set<string>();
  for (const token of tokenize(jdText)) {
    if (!STOPWORDS.has(token)) allKeywords.add(token);
  }

  const priorityKeywords = new Set<string>();
  const lines = jdText.split(/\r?\n/);
  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (
      normalized.includes("must") ||
      normalized.includes("required") ||
      normalized.includes("need") ||
      normalized.includes("looking for")
    ) {
      for (const token of tokenize(line)) {
        if (!STOPWORDS.has(token)) priorityKeywords.add(token);
      }
    }
  }

  return { allKeywords, priorityKeywords };
}

function countMatches(text: string, keywords: Set<string>): number {
  const lowered = text.toLowerCase();
  let hits = 0;
  for (const kw of Array.from(keywords)) {
    if (lowered.includes(kw)) hits += 1;
  }
  return hits;
}

function reorderBulletsByJdPriority(
  tailored: TailoredResume,
  jdText: string
): TailoredResume {
  const { allKeywords, priorityKeywords } = buildKeywordSets(jdText);
  const experience = tailored.experience.map((entry) => {
    const scored = entry.bullets.map((bullet, idx) => {
      const priorityHits = countMatches(bullet.text, priorityKeywords);
      const allHits = countMatches(bullet.text, allKeywords);
      const score = priorityHits * 3 + allHits;
      return { bullet, idx, score, priorityHits, allHits };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.priorityHits !== a.priorityHits) return b.priorityHits - a.priorityHits;
      if (b.allHits !== a.allHits) return b.allHits - a.allHits;
      return a.idx - b.idx;
    });

    return {
      ...entry,
      bullets: scored.map((item) => item.bullet),
    };
  });

  return { ...tailored, experience };
}

function getMaxBulletsPerRole(numRoles: number): number {
  return numRoles >= 4 ? 3 : numRoles === 3 ? 4 : 5;
}

function getMaxBulletsPerProject(numRoles: number): number {
  return numRoles >= 4 ? 1 : 2;
}

function getTargetRoleBulletCount(parsed: ParsedResume, roleIndex: number): number {
  const baselineCount = Math.max(parsed.experience[roleIndex]?.bullets.length ?? 1, 1);
  const expandedCount = baselineCount === 1 ? 2 : baselineCount;
  return Math.min(expandedCount, getMaxBulletsPerRole(parsed.experience.length));
}

function clampForSinglePage(parsed: ParsedResume, tailored: TailoredResume): TailoredResume {
  const numRoles = tailored.experience.length;
  const maxBulletsPerProject = getMaxBulletsPerProject(numRoles);

  const clampedExperience = tailored.experience.map((exp, i) => {
    const maxCount = getTargetRoleBulletCount(parsed, i);
    return {
      ...exp,
      bullets: exp.bullets.slice(0, maxCount),
    };
  });

  const clampedProjects =
    parsed.projects && tailored.projects
      ? tailored.projects.map((proj, i) => {
          const baselineCount = parsed.projects?.[i]?.bullets.length ?? proj.bullets.length;
          const maxCount = Math.min(Math.max(baselineCount, 1), maxBulletsPerProject);
          return {
            ...proj,
            bullets: proj.bullets.slice(0, maxCount),
          };
        })
      : tailored.projects ?? null;

  return {
    ...tailored,
    skills: compactSkills(tailored.skills),
    experience: clampedExperience,
    projects: clampedProjects,
  };
}

const bulletPointSchema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description: "A single resume bullet point.",
    },
  },
  required: ["text"],
} as const;

const experienceSchema = {
  type: Type.OBJECT,
  properties: {
    company: { type: Type.STRING },
    title: { type: Type.STRING },
    location: { type: Type.STRING },
    dateRange: {
      type: Type.STRING,
      description: "e.g. 'Jan 2022 - Present'",
    },
    bullets: {
      type: Type.ARRAY,
      items: bulletPointSchema,
      description: "3-5 bullet points per role",
    },
  },
  required: ["company", "title", "location", "dateRange", "bullets"],
} as const;

const educationSchema = {
  type: Type.OBJECT,
  properties: {
    institution: { type: Type.STRING },
    degree: {
      type: Type.STRING,
      description: "e.g. 'B.S. Computer Science'",
    },
    dateRange: { type: Type.STRING },
    gpa: { type: Type.STRING, description: "Optional GPA", nullable: true },
    honors: {
      type: Type.STRING,
      description: "Optional honors",
      nullable: true,
    },
  },
  required: ["institution", "degree", "dateRange"],
} as const;

const projectSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    technologies: {
      type: Type.STRING,
      description: "e.g. 'React, Node.js, PostgreSQL'",
    },
    bullets: {
      type: Type.ARRAY,
      items: bulletPointSchema,
      description: "1-3 bullet points per project",
    },
  },
  required: ["name", "technologies", "bullets"],
} as const;

const resumeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    email: { type: Type.STRING },
    phone: { type: Type.STRING },
    linkedin: { type: Type.STRING, nullable: true },
    github: { type: Type.STRING, nullable: true },
    website: { type: Type.STRING, nullable: true },
    summary: {
      type: Type.STRING,
      nullable: true,
      description: "Not used. Always null.",
    },
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Technical skills prioritized by JD relevance",
    },
    experience: {
      type: Type.ARRAY,
      items: experienceSchema,
    },
    education: {
      type: Type.ARRAY,
      items: educationSchema,
    },
    projects: {
      type: Type.ARRAY,
      items: projectSchema,
      nullable: true,
      description: "Optional. Include only if relevant to JD and space allows.",
    },
  },
  required: ["name", "email", "phone", "skills", "experience", "education"],
} as const;

const reviewResponseSchema = {
  type: Type.OBJECT,
  properties: {
    approved: { type: Type.BOOLEAN },
    score: {
      type: Type.NUMBER,
      description: "Overall JD alignment score from 0 to 100.",
    },
    feedback: {
      type: Type.STRING,
      description: "Actionable recruiter-style feedback for revision.",
    },
    missingRequirements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    topBulletIssues: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Role-specific issues where first bullet is weak/unrelated to JD.",
    },
  },
  required: [
    "approved",
    "score",
    "feedback",
    "missingRequirements",
    "topBulletIssues",
  ],
} as const;

const roleTailorResponseSchema = {
  type: Type.OBJECT,
  properties: {
    bullets: {
      type: Type.ARRAY,
      items: bulletPointSchema,
      description: "Rewritten bullets for this role",
    },
  },
  required: ["bullets"],
} as const;

function parsePriorityFromLine(line: string): JdRequirement["priority"] {
  const lowered = line.toLowerCase();
  if (lowered.includes("must") || lowered.includes("required") || lowered.includes("need")) {
    return "required";
  }
  return "preferred";
}

export function extractJdRequirements(jdText: string): JdRequirement[] {
  const normalizedCatalog = TECH_CATALOG.map((item) => ({
    ...item,
    normalized: normalizeTerm(item.term),
  }));
  const lines = jdText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const found = new Map<string, JdRequirement>();

  for (const line of lines) {
    for (const item of normalizedCatalog) {
      if (!includesTerm(line, item.term)) continue;
      const key = item.normalized;
      const existing = found.get(key);
      const next: JdRequirement = {
        term: item.term,
        exactPhrase: item.term,
        category: item.category,
        priority: parsePriorityFromLine(line),
      };
      if (!existing || (existing.priority === "preferred" && next.priority === "required")) {
        found.set(key, next);
      }
    }
  }

  if (found.size === 0) {
    for (const token of tokenize(jdText)) {
      if (STOPWORDS.has(token)) continue;
      if (token.length < 3) continue;
      const normalized = normalizeTerm(token);
      if (found.has(normalized)) continue;
      found.set(normalized, {
        term: token,
        exactPhrase: token,
        category: "other",
        priority: "required",
      });
      if (found.size >= 15) break;
    }
  }

  const requirements = Array.from(found.values()).sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "required" ? -1 : 1;
    return a.term.localeCompare(b.term);
  });

  return JdRequirementSchema.array().parse(requirements).slice(0, 24);
}

function rankRoleForRequirement(parsed: ParsedResume, requirement: JdRequirement, roleIndex: number): number {
  const role = parsed.experience[roleIndex];
  if (!role) return 0;

  const roleText = `${role.title} ${role.company} ${role.location} ${role.bullets
    .map((b) => b.text)
    .join(" ")}`.toLowerCase();
  const term = requirement.term.toLowerCase();

  let score = 0;
  if (roleText.includes(term)) score += 7;

  const termTokens = tokenize(term).filter((token) => !STOPWORDS.has(token));
  for (const token of termTokens) {
    if (roleText.includes(token)) score += 2;
  }

  const title = role.title.toLowerCase();
  if (requirement.category === "language" && /(backend|software|engineer|developer)/.test(title)) {
    score += 2;
  }
  if (requirement.category === "framework" && /(frontend|full stack|engineer|developer)/.test(title)) {
    score += 2;
  }
  if (requirement.category === "cloud" && /(platform|backend|devops|site reliability|engineer)/.test(title)) {
    score += 2;
  }

  if (roleIndex === 0) score += 1;

  return score;
}

export function assignRoleFits(
  parsed: ParsedResume,
  requirements: JdRequirement[]
): RoleFitAssignment[] {
  const assignments: RoleFitAssignment[] = [];

  for (const requirement of requirements) {
    let bestRoleIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < parsed.experience.length; i += 1) {
      const score = rankRoleForRequirement(parsed, requirement, i);
      if (score > bestScore) {
        bestScore = score;
        bestRoleIndex = i;
      }
    }

    const fit: RoleFitAssignment["fit"] =
      bestScore >= 8 ? "strong_fit" : bestScore >= 4 ? "medium_fit" : "weak_fit";

    assignments.push({
      requirement,
      roleIndex: bestRoleIndex,
      fit,
    });
  }

  return RoleFitAssignmentSchema.array().parse(assignments);
}

function requirementsForRole(
  roleIndex: number,
  assignments: RoleFitAssignment[]
): RoleFitAssignment[] {
  return assignments
    .filter((assignment) => assignment.roleIndex === roleIndex)
    .sort((a, b) => {
      if (a.requirement.priority !== b.requirement.priority) {
        return a.requirement.priority === "required" ? -1 : 1;
      }
      if (a.fit !== b.fit) {
        const weight = { strong_fit: 3, medium_fit: 2, weak_fit: 1 } as const;
        return weight[b.fit] - weight[a.fit];
      }
      return a.requirement.term.localeCompare(b.requirement.term);
    });
}

function getRoleBulletBounds(roleIndex: number): { min: number; max: number } {
  void roleIndex;
  return { min: 190, max: 240 };
}

function sanitizeBulletText(text: string): string {
  return sanitizeText(text).replace(/[•]/g, "");
}

function hasImpactSignal(text: string): boolean {
  return IMPACT_PATTERNS.some((pattern) => pattern.test(text));
}

function extractRoleTechHints(role: ParsedResume["experience"][number]): string[] {
  const joined = `${role.title} ${role.bullets.map((bullet) => bullet.text).join(" ")}`;
  const found: string[] = [];

  for (const item of TECH_CATALOG) {
    if (!includesTerm(joined, item.term)) continue;
    if (!found.includes(item.term)) found.push(item.term);
  }

  return found.slice(0, 8);
}

function capTermsByPriority(
  roleAssignments: RoleFitAssignment[],
  priority: JdRequirement["priority"],
  maxCount: number
): string[] {
  return roleAssignments
    .filter((assignment) => assignment.requirement.priority === priority)
    .slice(0, maxCount)
    .map((assignment) => assignment.requirement.term);
}

function buildRoleTailorPrompt(args: {
  parsed: ParsedResume;
  roleIndex: number;
  jdText: string;
  assignments: RoleFitAssignment[];
  targetBulletCount: number;
  previousFeedback?: string;
}): string {
  const role = args.parsed.experience[args.roleIndex];
  const bounds = getRoleBulletBounds(args.roleIndex);
  const roleAssignments = requirementsForRole(args.roleIndex, args.assignments);
  const requiredTerms = capTermsByPriority(roleAssignments, "required", 3);
  const preferredTerms = capTermsByPriority(roleAssignments, "preferred", 2);
  const originalRoleTech = extractRoleTechHints(role);

  const feedbackSection = args.previousFeedback
    ? `\n## RETRY FEEDBACK\n${args.previousFeedback}\n`
    : "";

  return `You are rewriting bullets for a single resume experience entry.

## ROLE TO REWRITE (immutable fields must stay unchanged)
${JSON.stringify(role, null, 2)}

## TARGET JOB DESCRIPTION
${args.jdText}

## REQUIREMENT ALLOCATION FOR THIS ROLE
Required terms to include naturally in bullets: ${requiredTerms.join(", ") || "None"}
Preferred terms to include when natural: ${preferredTerms.join(", ") || "None"}
Original technologies to preserve context: ${originalRoleTech.join(", ") || "None listed"}
Target bullet count: ${args.targetBulletCount}

## CONTROLLED FABRICATION POLICY
- You MAY inject missing JD technologies when source evidence is sparse.
- Keep claims believable for this title and role seniority.
- Use moderate metrics and realistic scope.
- Never create implausible ownership (for example: company-wide strategy, managing large orgs).

## HARD RULES
1. Return exactly ${args.targetBulletCount} bullets.
2. Keep each bullet at ${bounds.min}-${bounds.max} chars.
3. Every bullet must include: action + concrete implementation detail + impact.
4. Use max 2 technologies in one bullet.
5. For role index 0, first bullet must include at least one required term when required terms exist.
6. Avoid filler phrases: responsible for, helped to, worked on, assisted with.
7. Never use em dash or en dash characters. Use hyphen-minus (-) or commas instead.
8. Do not force one JD technology into every bullet. Any single required term should appear in at most 2 bullets for this role.
9. Preserve role authenticity: keep at least half of bullets anchored to original role context/outcomes, not pure stack swapping.
10. Prioritize impact over tool-listing. Metrics and outcome should be the strongest signal in each bullet.
11. Output JSON only using schema {"bullets": [{"text": "..."}]}.${feedbackSection}
`;
}

function countTechMentions(text: string): number {
  let count = 0;
  for (const item of TECH_CATALOG) {
    if (includesTerm(text, item.term)) count += 1;
  }
  return count;
}

export function validateRoleOutput(args: {
  roleIndex: number;
  role: ParsedResume["experience"][number];
  bullets: Array<{ text: string }>;
  assignments: RoleFitAssignment[];
  expectedBulletCount: number;
}): RoleValidationResult {
  const bounds = getRoleBulletBounds(args.roleIndex);
  const roleAssignments = requirementsForRole(args.roleIndex, args.assignments);
  const requiredTerms = capTermsByPriority(roleAssignments, "required", 3);

  const texts = args.bullets.map((b) => String(b.text ?? ""));
  const allText = texts.join("\n").toLowerCase();
  const originalRoleTech = extractRoleTechHints(args.role);
  const minAnchoredBullets = Math.max(1, Math.ceil(texts.length / 2));

  const missingRequirements = requiredTerms.filter((term) => !includesTerm(allText, term));

  const specificityIssues: string[] = [];
  const credibilityIssues: string[] = [];

  if (texts.length !== args.expectedBulletCount) {
    specificityIssues.push(
      `Bullet count mismatch (${texts.length}, expected ${args.expectedBulletCount}).`
    );
  }

  for (const text of texts) {
    const lowered = text.toLowerCase();

    if (text.length < bounds.min || text.length > bounds.max) {
      specificityIssues.push(
        `Bullet length out of range (${text.length}, expected ${bounds.min}-${bounds.max}): ${text.slice(0, 70)}...`
      );
    }

    if (/[–—]/.test(text)) {
      specificityIssues.push(`Bullet uses em/en dash: ${text.slice(0, 70)}...`);
    }

    const hasActionVerb = ACTION_VERBS.some((verb) => lowered.includes(verb));
    if (!hasActionVerb) {
      specificityIssues.push(`Bullet lacks a clear action verb: ${text.slice(0, 70)}...`);
    }

    if (!hasImpactSignal(text)) {
      specificityIssues.push(`Bullet lacks quantified impact: ${text.slice(0, 70)}...`);
    }

    if (countTechMentions(text) > 2) {
      specificityIssues.push(`Bullet appears keyword-heavy: ${text.slice(0, 70)}...`);
    }

    if (WEAK_PATTERNS.some((p) => lowered.includes(p))) {
      specificityIssues.push(`Bullet uses weak phrasing: ${text.slice(0, 70)}...`);
    }

    if (IMPROBABLE_SCOPE_PATTERNS.some((pattern) => pattern.test(text))) {
      credibilityIssues.push(`Bullet has implausible scope: ${text.slice(0, 70)}...`);
    }
  }

  for (const term of requiredTerms) {
    const bulletsWithTerm = texts.filter((text) => includesTerm(text, term)).length;
    if (bulletsWithTerm > 2) {
      specificityIssues.push(
        `Technology overused across bullets (${term} appears ${bulletsWithTerm} times).`
      );
    }
  }

  if (originalRoleTech.length > 0) {
    let anchoredBullets = 0;
    for (const text of texts) {
      if (originalRoleTech.some((term) => includesTerm(text, term))) {
        anchoredBullets += 1;
      }
    }
    if (anchoredBullets < minAnchoredBullets) {
      credibilityIssues.push(
        `Too many bullets drift from original role context (${anchoredBullets}/${texts.length} anchored).`
      );
    }
  }

  const firstBullet = texts[0] ?? "";
  const firstBulletHasRequired = requiredTerms.length
    ? requiredTerms.some((term) => includesTerm(firstBullet, term))
    : true;

  const coverageScore = requiredTerms.length
    ? Math.round(((requiredTerms.length - missingRequirements.length) / requiredTerms.length) * 100)
    : 100;
  const role0VisibilityScore =
    args.roleIndex === 0 ? (firstBulletHasRequired ? 100 : 30) : firstBulletHasRequired ? 100 : 60;

  const issueCount = credibilityIssues.length + specificityIssues.length;
  const credibilityScore = Math.max(0, 100 - issueCount * 12);

  const passed = missingRequirements.length === 0 && credibilityIssues.length === 0 && specificityIssues.length <= 2;

  return RoleValidationResultSchema.parse({
    roleIndex: args.roleIndex,
    passed,
    missingRequirements,
    credibilityIssues,
    specificityIssues,
    coverageScore,
    role0VisibilityScore,
    credibilityScore,
  });
}

export async function tailorRole(args: {
  parsed: ParsedResume;
  jdText: string;
  roleIndex: number;
  assignments: RoleFitAssignment[];
  logger?: Logger;
  onProgress?: TailorProgressCallback;
}): Promise<{ bullets: Array<{ text: string }>; validation: RoleValidationResult }> {
  const activeLogger = resolveLogger(args.logger).child({ component: "gemini_tailor_role" });
  const maxAttempts = args.roleIndex === 0 ? 3 : 2;
  const expectedBulletCount = getTargetRoleBulletCount(args.parsed, args.roleIndex);

  let bestBullets =
    args.parsed.experience[args.roleIndex]?.bullets.map((bullet) => ({
      text: sanitizeBulletText(bullet.text),
    })) ?? [];
  let bestValidation = validateRoleOutput({
    roleIndex: args.roleIndex,
    role: args.parsed.experience[args.roleIndex]!,
    bullets: bestBullets,
    assignments: args.assignments,
    expectedBulletCount,
  });
  let retryFeedback: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    args.onProgress?.({
      step: "tailoring_role",
      roleIndex: args.roleIndex,
      roleAttempt: attempt,
      rolesTotal: args.parsed.experience.length,
    });

    const response = await ai.models.generateContent({
      model: TAILOR_MODEL,
      contents: buildRoleTailorPrompt({
        parsed: args.parsed,
        roleIndex: args.roleIndex,
        jdText: args.jdText,
        assignments: args.assignments,
        targetBulletCount: expectedBulletCount,
        previousFeedback: retryFeedback,
      }),
      config: {
        responseMimeType: "application/json",
        responseSchema: roleTailorResponseSchema,
        temperature: attempt === 1 ? 0.75 : 0.55,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error(`Gemini returned empty role tailoring response for role ${args.roleIndex}`);
    }

    const parsedResponse = JSON.parse(text) as { bullets: Array<{ text: string }> };
    const rawBullets = (parsedResponse.bullets ?? []).map((bullet) => ({
      text: String(bullet.text ?? ""),
    }));
    const bullets = rawBullets.map((bullet) => ({
      text: sanitizeBulletText(bullet.text),
    }));

    args.onProgress?.({ step: "validating_role", roleIndex: args.roleIndex, roleAttempt: attempt });
    const validation = validateRoleOutput({
      roleIndex: args.roleIndex,
      role: args.parsed.experience[args.roleIndex]!,
      bullets: rawBullets,
      assignments: args.assignments,
      expectedBulletCount,
    });

    activeLogger.info("gemini.tailor.role.validation", {
      roleIndex: args.roleIndex,
      roleAttempt: attempt,
      coverageScore: validation.coverageScore,
      credibilityScore: validation.credibilityScore,
      missingTerms: validation.missingRequirements,
      credibilityIssueCount: validation.credibilityIssues.length,
      specificityIssueCount: validation.specificityIssues.length,
      expectedBulletCount,
      actualBulletCount: bullets.length,
    });

    const currentScore = validation.coverageScore * 0.5 + validation.role0VisibilityScore * 0.3 + validation.credibilityScore * 0.2;
    const bestScore = bestValidation.coverageScore * 0.5 + bestValidation.role0VisibilityScore * 0.3 + bestValidation.credibilityScore * 0.2;

    if (currentScore >= bestScore) {
      bestBullets = bullets;
      bestValidation = validation;
    }

    if (validation.passed) {
      return { bullets, validation };
    }

    if (attempt < maxAttempts) {
      args.onProgress?.({
        step: "retrying_role",
        roleIndex: args.roleIndex,
        roleAttempt: attempt + 1,
        missingTerms: validation.missingRequirements,
      });
      retryFeedback = [
        validation.missingRequirements.length
          ? `Missing required terms: ${validation.missingRequirements.join(", ")}`
          : "No missing required terms.",
        validation.credibilityIssues.length
          ? `Credibility issues: ${validation.credibilityIssues.join(" | ")}`
          : "No credibility issues.",
        validation.specificityIssues.length
          ? `Specificity issues: ${validation.specificityIssues.join(" | ")}`
          : "No specificity issues.",
        "Keep tech coverage high while making claims realistic and role-aligned.",
        "Do not overuse one technology across all bullets; emphasize impact and outcomes first.",
      ].join("\n");
    }
  }

  return { bullets: bestBullets, validation: bestValidation };
}

function generateSkillsPass(
  originalSkills: string[],
  requirements: JdRequirement[],
  tailoredExperience: TailoredResume["experience"]
): string[] {
  const normalizedOriginal = normalizeSkillLines(originalSkills);
  const skillSet = new Map<string, string>();

  for (const skill of normalizedOriginal) {
    const cleaned = sanitizeText(skill);
    if (isNullLike(cleaned)) continue;
    skillSet.set(normalizeTerm(cleaned), cleaned);
  }

  const experienceText = tailoredExperience
    .map((role) => role.bullets.map((b) => b.text).join(" "))
    .join(" ");

  for (const req of requirements) {
    if (req.priority !== "required") continue;
    if (includesTerm(experienceText, req.term) || req.category !== "other") {
      const cleaned = sanitizeText(req.term);
      if (!isNullLike(cleaned)) {
        skillSet.set(normalizeTerm(cleaned), cleaned);
      }
    }
  }

  for (const req of requirements) {
    if (req.priority === "preferred") {
      const cleaned = sanitizeText(req.term);
      if (!isNullLike(cleaned)) {
        skillSet.set(normalizeTerm(cleaned), cleaned);
      }
    }
  }

  const grouped = new Map<string, string[]>();

  for (const skill of Array.from(skillSet.values())) {
    const catalogMatch = TECH_CATALOG.find((item) => normalizeTerm(item.term) === normalizeTerm(skill));
    const reqMatch = requirements.find((item) => normalizeTerm(item.term) === normalizeTerm(skill));
    const category = reqMatch?.category ?? catalogMatch?.category ?? "other";
    const label = CATEGORY_LABELS[category];
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(skill);
  }

  const orderedLabels = [
    "Languages",
    "Frameworks",
    "Cloud",
    "Databases",
    "Tools",
    "Methods",
    "Domain",
    "Other",
  ];

  const lines: string[] = [];
  for (const label of orderedLabels) {
    const items = grouped.get(label);
    if (!items?.length) continue;

    const uniqueSorted = Array.from(new Set(items)).sort((a, b) => {
      const aReq = requirements.find((req) => normalizeTerm(req.term) === normalizeTerm(a));
      const bReq = requirements.find((req) => normalizeTerm(req.term) === normalizeTerm(b));
      if (aReq && !bReq) return -1;
      if (!aReq && bReq) return 1;
      if (aReq && bReq && aReq.priority !== bReq.priority) {
        return aReq.priority === "required" ? -1 : 1;
      }
      return a.localeCompare(b);
    });

    lines.push(sanitizeText(`${label}: ${uniqueSorted.join(", ")}`));
  }

  return compactSkills(lines);
}

function computeDiagnostics(
  requirements: JdRequirement[],
  roleResults: RoleValidationResult[],
  tailored: TailoredResume
): TailorDiagnostics {
  const requiredTerms = requirements
    .filter((req) => req.priority === "required")
    .map((req) => req.term);
  const allText = tailored.experience.map((exp) => exp.bullets.map((b) => b.text).join(" ")).join(" ");

  const coveredRequiredTerms = requiredTerms.filter((term) => includesTerm(allText, term));
  const missingRequiredTerms = requiredTerms.filter((term) => !includesTerm(allText, term));

  const unsupportedClaims: string[] = [];
  for (const result of roleResults) {
    unsupportedClaims.push(...result.credibilityIssues);
  }

  const jdCoverageScore = requiredTerms.length
    ? Math.round((coveredRequiredTerms.length / requiredTerms.length) * 100)
    : 100;

  const role0VisibilityScore = roleResults.find((result) => result.roleIndex === 0)?.role0VisibilityScore ?? 100;
  const credibilityScore = roleResults.length
    ? Math.round(roleResults.reduce((sum, result) => sum + result.credibilityScore, 0) / roleResults.length)
    : 100;

  return TailorDiagnosticsSchema.parse({
    requiredTerms,
    coveredRequiredTerms,
    missingRequiredTerms,
    unsupportedClaims,
    roleResults,
    jdCoverageScore,
    role0VisibilityScore,
    credibilityScore,
  });
}

async function reviewTailoredResume(
  tailored: TailoredResume,
  jdText: string,
  logger?: Logger
): Promise<TailorReview | null> {
  const activeLogger = resolveLogger(logger).child({ component: "gemini_review" });
  const startedAt = Date.now();
  activeLogger.info("gemini.review.start", {
    model: REVIEW_MODEL,
    experienceCount: tailored.experience.length,
    projectCount: tailored.projects?.length ?? 0,
    jdLength: jdText.length,
  });

  try {
    const response = await ai.models.generateContent({
      model: REVIEW_MODEL,
      contents: buildReviewPrompt(JSON.stringify(tailored, null, 2), jdText),
      config: {
        systemInstruction: REVIEW_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: reviewResponseSchema,
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    const text = response.text;
    if (!text) {
      activeLogger.warn("gemini.review.empty", {
        model: REVIEW_MODEL,
        durationMs: Date.now() - startedAt,
      });
      return null;
    }
    const review = TailorReviewSchema.parse(JSON.parse(text));
    activeLogger.info("gemini.review.done", {
      model: REVIEW_MODEL,
      durationMs: Date.now() - startedAt,
      approved: review.approved,
      score: review.score,
      missingRequirementsCount: review.missingRequirements.length,
      topBulletIssuesCount: review.topBulletIssues.length,
    });
    return review;
  } catch (error) {
    activeLogger.warn("gemini.review.failed", {
      model: REVIEW_MODEL,
      durationMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return null;
  }
}

function postProcessTailored(parsed: ParsedResume, tailored: TailoredResume, jdText: string): TailoredResume {
  const ranked = reorderBulletsByJdPriority(tailored, jdText);
  return TailoredResumeSchema.parse(clampForSinglePage(parsed, ranked));
}

export type TailorProgressCallback = (progress: Partial<LoadingProgress>) => void;

// Step 1 — faithful extraction (deterministic, low temperature)
export async function parseResume(rawText: string, logger?: Logger): Promise<ParsedResume> {
  const activeLogger = resolveLogger(logger).child({ component: "gemini_parse" });
  const startedAt = Date.now();
  activeLogger.info("gemini.parse.start", {
    model: PARSE_MODEL,
    inputLength: rawText.length,
  });

  try {
    const response = await ai.models.generateContent({
      model: PARSE_MODEL,
      contents: buildParsePrompt(rawText),
      config: {
        systemInstruction: PARSE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: resumeResponseSchema,
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response during parse step");
    }

    const parsed = ParsedResumeSchema.parse(JSON.parse(text));
    activeLogger.info("gemini.parse.done", {
      model: PARSE_MODEL,
      durationMs: Date.now() - startedAt,
      roles: parsed.experience.length,
      skillsCount: parsed.skills.length,
      educationCount: parsed.education.length,
      projectsCount: parsed.projects?.length ?? 0,
    });
    return parsed;
  } catch (error) {
    activeLogger.error("gemini.parse.failed", {
      model: PARSE_MODEL,
      durationMs: Date.now() - startedAt,
      err: error,
    });
    throw error;
  }
}

export async function tailorParsedV2(
  parsed: ParsedResume,
  jdText: string,
  onProgress?: TailorProgressCallback,
  logger?: Logger
): Promise<TailoredResume> {
  const activeLogger = resolveLogger(logger).child({ component: "gemini_tailor_v2" });
  const startedAt = Date.now();

  const requirements = extractJdRequirements(jdText);
  onProgress?.({
    step: "requirements_extracted",
    requiredTerms: requirements.filter((r) => r.priority === "required").map((r) => r.term),
  });

  activeLogger.info("gemini.requirements.extracted", {
    requiredCount: requirements.filter((r) => r.priority === "required").length,
    preferredCount: requirements.filter((r) => r.priority === "preferred").length,
  });

  const assignments = assignRoleFits(parsed, requirements);

  const tailoredExperience: TailoredResume["experience"] = [];
  const roleResults: RoleValidationResult[] = [];

  for (let roleIndex = 0; roleIndex < parsed.experience.length; roleIndex += 1) {
    const role = parsed.experience[roleIndex]!;
    const result = await tailorRole({
      parsed,
      jdText,
      roleIndex,
      assignments,
      logger: activeLogger,
      onProgress,
    });

    tailoredExperience.push({
      company: role.company,
      title: role.title,
      location: role.location,
      dateRange: role.dateRange,
      bullets: result.bullets,
    });
    roleResults.push(result.validation);
  }

  const tailoredDraft: TailoredResume = TailoredResumeSchema.parse({
    name: sanitizeText(parsed.name),
    email: sanitizeText(parsed.email),
    phone: sanitizeText(parsed.phone),
    linkedin: isNullLike(parsed.linkedin) ? null : sanitizeText(parsed.linkedin ?? ""),
    github: isNullLike(parsed.github) ? null : sanitizeText(parsed.github ?? ""),
    website: isNullLike(parsed.website) ? null : sanitizeText(parsed.website ?? ""),
    summary: null,
    skills: generateSkillsPass(parsed.skills, requirements, tailoredExperience).map(sanitizeText),
    experience: tailoredExperience.map((role) => ({
      ...role,
      company: sanitizeText(role.company),
      title: sanitizeText(role.title),
      location: sanitizeText(role.location),
      dateRange: sanitizeText(role.dateRange),
      bullets: role.bullets.map((bullet) => ({ text: sanitizeBulletText(bullet.text) })),
    })),
    education: parsed.education.map((entry) => ({
      institution: sanitizeText(entry.institution),
      degree: sanitizeText(entry.degree),
      dateRange: sanitizeText(entry.dateRange),
      gpa: isNullLike(entry.gpa) ? null : sanitizeText(entry.gpa ?? ""),
      honors: isNullLike(entry.honors) ? null : sanitizeText(entry.honors ?? ""),
    })),
    projects:
      parsed.projects?.map((project) => ({
        name: sanitizeText(project.name),
        technologies: sanitizeText(project.technologies),
        bullets: project.bullets.map((bullet) => ({ text: sanitizeBulletText(bullet.text) })),
      })) ?? null,
  });

  onProgress?.({ step: "scoring" });
  const diagnostics = computeDiagnostics(requirements, roleResults, tailoredDraft);

  const review = await reviewTailoredResume(tailoredDraft, jdText, activeLogger);
  if (review) {
    onProgress?.({ step: "reviewing", reviewScore: review.score, reviewApproved: review.approved });
  }

  activeLogger.info("gemini.scoring.done", {
    jdCoverageScore: diagnostics.jdCoverageScore,
    role0VisibilityScore: diagnostics.role0VisibilityScore,
    credibilityScore: diagnostics.credibilityScore,
    reviewerScore: review?.score ?? null,
    reviewerApproved: review?.approved ?? null,
    missingRequiredCount: diagnostics.missingRequiredTerms.length,
  });

  onProgress?.({
    step: "optimizing",
    coverageScore: diagnostics.jdCoverageScore,
    role0VisibilityScore: diagnostics.role0VisibilityScore,
    credibilityScore: diagnostics.credibilityScore,
  });

  const postProcessed = postProcessTailored(parsed, tailoredDraft, jdText);

  activeLogger.info("gemini.tailor.v2.done", {
    durationMs: Date.now() - startedAt,
    roles: postProcessed.experience.length,
    skillsCount: postProcessed.skills.length,
  });

  return postProcessed;
}

export async function tailorParsed(
  parsed: ParsedResume,
  jdText: string,
  onProgress?: TailorProgressCallback,
  logger?: Logger
): Promise<TailoredResume> {
  return tailorParsedV2(parsed, jdText, onProgress, logger);
}

export interface ProcessResumeResult {
  parsed: ParsedResume;
  tailored: TailoredResume;
}

export async function processResume(
  rawText: string,
  jdText: string,
  logger?: Logger
): Promise<ProcessResumeResult> {
  const activeLogger = resolveLogger(logger).child({ component: "gemini_process_resume" });
  const parsed = await parseResume(rawText, activeLogger);
  const tailored = await tailorParsed(parsed, jdText, undefined, activeLogger);

  const restoredTailored = TailoredResumeSchema.parse({
    ...tailored,
    name: sanitizeText(parsed.name),
    email: sanitizeText(parsed.email),
    phone: sanitizeText(parsed.phone),
    linkedin: isNullLike(parsed.linkedin) ? null : sanitizeText(parsed.linkedin ?? ""),
    github: isNullLike(parsed.github) ? null : sanitizeText(parsed.github ?? ""),
    website: isNullLike(parsed.website) ? null : sanitizeText(parsed.website ?? ""),
    summary: null,
    education: parsed.education.map((entry) => ({
      institution: sanitizeText(entry.institution),
      degree: sanitizeText(entry.degree),
      dateRange: sanitizeText(entry.dateRange),
      gpa: isNullLike(entry.gpa) ? null : sanitizeText(entry.gpa ?? ""),
      honors: isNullLike(entry.honors) ? null : sanitizeText(entry.honors ?? ""),
    })),
  });

  return { parsed, tailored: restoredTailored };
}
