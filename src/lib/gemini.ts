import { GoogleGenAI, Type } from "@google/genai";
import {
  TailoredResumeSchema,
  ParsedResumeSchema,
  TailorReviewSchema,
  type TailorReview,
  type TailoredResume,
  type ParsedResume,
  type LoadingProgress,
} from "./schema";
import {
  PARSE_SYSTEM_PROMPT,
  TAILOR_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
  buildParsePrompt,
  buildTailorPrompt,
  buildReviewPrompt,
} from "./prompt";
import { normalizeSkillLines } from "./skills";
import { createLogger, type Logger } from "./logger";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const TAILOR_MODEL = "gemini-2.5-pro";
const REVIEW_MODEL = "gemini-2.5-flash";
const PARSE_MODEL = "gemini-2.5-flash";

function resolveLogger(logger?: Logger): Logger {
  return logger ?? createLogger({ component: "gemini" });
}

function compactSkills(skills: string[]): string[] {
  const cleaned = normalizeSkillLines(skills);
  if (cleaned.length <= 20) return cleaned;
  return cleaned.slice(0, 20);
}

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

function tokenize(text: string): string[] {
  return (
    text.toLowerCase().match(/[a-z0-9.+#-]+/g)?.filter((t) => t.length >= 2) ?? []
  );
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

function clampForSinglePage(
  parsed: ParsedResume,
  tailored: TailoredResume
): TailoredResume {
  const numRoles = tailored.experience.length;
  // Adaptive budget: more roles → fewer bullets per role to stay on one page
  const maxBulletsPerRole = numRoles >= 4 ? 3 : numRoles === 3 ? 4 : 5;
  // Reduce project budget when experience is dense
  const maxBulletsPerProject = numRoles >= 4 ? 1 : 2;

  const clampedExperience = tailored.experience.map((exp, i) => {
    const baselineCount = parsed.experience[i]?.bullets.length ?? exp.bullets.length;
    const maxCount = Math.min(Math.max(baselineCount, 1), maxBulletsPerRole);
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

// Hand-built Gemini-compatible schema (OpenAPI 3.0 subset).
// zodToJsonSchema produces $ref, additionalProperties, minItems etc. that Gemini rejects.
const bulletPointSchema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description:
        "A single resume bullet point. Must be 160–220 characters. Bullets under 130 characters are too short.",
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

// Step 2 — creative rewriting (structured JSON in → structured JSON out)
async function generateTailoredResume(
  parsed: ParsedResume,
  jdText: string,
  reviewerFeedback?: string,
  logger?: Logger
): Promise<TailoredResume> {
  const activeLogger = resolveLogger(logger).child({ component: "gemini_tailor_generate" });
  const startedAt = Date.now();
  activeLogger.info("gemini.tailor.generate.start", {
    model: TAILOR_MODEL,
    hasReviewerFeedback: Boolean(reviewerFeedback),
    roles: parsed.experience.length,
    jdLength: jdText.length,
  });

  try {
    const response = await ai.models.generateContent({
      model: TAILOR_MODEL,
      contents: buildTailorPrompt(parsed, jdText, reviewerFeedback),
      config: {
        systemInstruction: TAILOR_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: resumeResponseSchema,
        temperature: 0.75,
        topP: 0.9,
        maxOutputTokens: 16384,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response during tailor step");
    }
    const tailored = TailoredResumeSchema.parse(JSON.parse(text));
    activeLogger.info("gemini.tailor.generate.done", {
      model: TAILOR_MODEL,
      hasReviewerFeedback: Boolean(reviewerFeedback),
      durationMs: Date.now() - startedAt,
      experienceCount: tailored.experience.length,
      projectCount: tailored.projects?.length ?? 0,
      skillsCount: tailored.skills.length,
    });
    return tailored;
  } catch (error) {
    activeLogger.error("gemini.tailor.generate.failed", {
      model: TAILOR_MODEL,
      hasReviewerFeedback: Boolean(reviewerFeedback),
      durationMs: Date.now() - startedAt,
      err: error,
    });
    throw error;
  }
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

function buildFeedbackForRevision(review: TailorReview): string {
  const missing = review.missingRequirements.length
    ? `Missing JD requirements: ${review.missingRequirements.join(", ")}.`
    : "No explicit missing requirements listed.";
  const topBullet = review.topBulletIssues.length
    ? `Top bullet issues: ${review.topBulletIssues.join(" | ")}.`
    : "No top bullet issues listed.";
  return `${review.feedback}\n${missing}\n${topBullet}\nRaise relevance of first bullet for each role.`;
}

function postProcessTailored(
  parsed: ParsedResume,
  tailored: TailoredResume,
  jdText: string
): TailoredResume {
  const ranked = reorderBulletsByJdPriority(tailored, jdText);
  return TailoredResumeSchema.parse(clampForSinglePage(parsed, ranked));
}

export type TailorProgressCallback = (progress: Partial<LoadingProgress>) => void;

export async function tailorParsed(
  parsed: ParsedResume,
  jdText: string,
  onProgress?: TailorProgressCallback,
  logger?: Logger
): Promise<TailoredResume> {
  const activeLogger = resolveLogger(logger).child({ component: "gemini_tailor" });
  const startedAt = Date.now();

  const initial = await generateTailoredResume(parsed, jdText, undefined, activeLogger);

  onProgress?.({ step: "reviewing" });
  const firstReview = await reviewTailoredResume(initial, jdText, activeLogger);

  let selected = initial;
  let selectedReview = firstReview;

  if (firstReview) {
    onProgress?.({
      step: "reviewing",
      reviewScore: firstReview.score,
      reviewApproved: firstReview.approved,
    });
  }

  if (firstReview && !firstReview.approved) {
    onProgress?.({ step: "revising" });
    const revisionFeedback = buildFeedbackForRevision(firstReview);
    const revised = await generateTailoredResume(
      parsed,
      jdText,
      revisionFeedback,
      activeLogger
    );
    const secondReview = await reviewTailoredResume(revised, jdText, activeLogger);

    // Pick the stronger candidate by reviewer score.
    if (secondReview && secondReview.score >= firstReview.score) {
      selected = revised;
      selectedReview = secondReview;
      activeLogger.info("gemini.selection.decision", {
        selected: "revised",
        firstScore: firstReview.score,
        secondScore: secondReview.score,
      });
    } else if (secondReview === null) {
      // Second review failed; keep initial since we can't compare scores.
      activeLogger.info("gemini.selection.decision", {
        selected: "initial",
        firstScore: firstReview.score,
        reason: "second_review_missing",
      });
    } else {
      activeLogger.info("gemini.selection.decision", {
        selected: "initial",
        firstScore: firstReview.score,
        secondScore: secondReview.score,
      });
    }
  } else {
    activeLogger.info("gemini.selection.decision", {
      selected: "initial",
      firstScore: firstReview?.score ?? null,
      reason: firstReview ? "already_approved" : "first_review_missing",
    });
  }

  onProgress?.({ step: "optimizing" });
  const postProcessed = postProcessTailored(parsed, selected, jdText);
  activeLogger.info("gemini.postprocess.done", {
    durationMs: Date.now() - startedAt,
    experienceCount: postProcessed.experience.length,
    projectCount: postProcessed.projects?.length ?? 0,
    skillsCount: postProcessed.skills.length,
  });

  if (selectedReview && !selectedReview.approved) {
    activeLogger.warn("gemini.review.not_approved", {
      score: selectedReview.score,
      missingRequirementsCount: selectedReview.missingRequirements.length,
      topBulletIssuesCount: selectedReview.topBulletIssues.length,
    });
  }

  return postProcessed;
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
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    linkedin: parsed.linkedin,
    github: parsed.github,
    website: parsed.website,
    summary: null,
    education: parsed.education,
  });

  return { parsed, tailored: restoredTailored };
}
