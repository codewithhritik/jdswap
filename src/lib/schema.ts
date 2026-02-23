import { z } from "zod";

export const BulletPointSchema = z.object({
  text: z
    .string()
    .describe(
      "A single resume bullet point. Must be 160–220 characters. Bullets under 130 characters are too short."
    ),
});

export const ExperienceEntrySchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string(),
  dateRange: z.string().describe("e.g. 'Jan 2022 - Present'"),
  bullets: z
    .array(BulletPointSchema)
    .min(1)
    .max(5)
    .describe("1-5 bullet points per role."),
});

export const EducationEntrySchema = z.object({
  institution: z.string(),
  degree: z.string().describe("e.g. 'B.S. Computer Science'"),
  dateRange: z.string(),
  gpa: z.string().nullish(),
  honors: z.string().nullish(),
});

export const ProjectEntrySchema = z.object({
  name: z.string(),
  technologies: z.string().describe("e.g. 'React, Node.js, PostgreSQL'"),
  bullets: z
    .array(BulletPointSchema)
    .min(1)
    .max(3)
    .describe("1-3 bullet points per project"),
});

export const TailoredResumeSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  linkedin: z.string().nullish(),
  github: z.string().nullish(),
  website: z.string().nullish(),
  summary: z
    .string()
    .nullish()
    .describe("Not used. Always null."),
  skills: z
    .array(z.string())
    .describe(
      "Flat list of technical skills, prioritized by relevance to the JD. Group by category (e.g. 'Languages: Python, Java | Frameworks: React, Django | Cloud: AWS, GCP | Tools: Docker, Kubernetes')."
    ),
  experience: z.array(ExperienceEntrySchema),
  education: z.array(EducationEntrySchema),
  projects: z
    .array(ProjectEntrySchema)
    .nullish()
    .describe(
      "Optional projects section. Include only if space allows and projects are relevant to the JD."
    ),
});

export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

export const SourceSectionKindSchema = z.enum([
  "summary",
  "skills",
  "experience",
  "education",
  "projects",
  "custom",
]);

export const SourceSectionSchema = z.object({
  kind: SourceSectionKindSchema,
  heading: z.string(),
  lines: z.array(z.string()),
  educationDetailBlocks: z.array(z.array(z.string())).optional(),
});

export const SourceLayoutSchema = z.object({
  sections: z.array(SourceSectionSchema),
});

export type SourceSectionKind = z.infer<typeof SourceSectionKindSchema>;
export type SourceSection = z.infer<typeof SourceSectionSchema>;
export type SourceLayout = z.infer<typeof SourceLayoutSchema>;

// Parse step schema — accepts whatever bullet count is in the original resume (min 1),
// since we haven't rewritten anything yet.
export const ParsedResumeSchema = TailoredResumeSchema.extend({
  experience: z.array(
    ExperienceEntrySchema.extend({
      bullets: z.array(BulletPointSchema).min(1).max(10),
    })
  ),
  projects: z
    .array(
      ProjectEntrySchema.extend({
        bullets: z.array(BulletPointSchema).min(1).max(5),
      })
    )
    .nullish(),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

export const RewriteIntentSchema = z.enum([
  "give_me_something_else",
  "improve_writing",
  "stronger_impact",
  "add_technology",
  "make_it_concise",
]);

export const RewriteScopeSchema = z.enum(["bullet", "entry"]);
export const RewriteSectionSchema = z.enum(["experience", "projects"]);

export const RewriteTargetSchema = z
  .object({
    section: RewriteSectionSchema,
    scope: RewriteScopeSchema,
    entryIndex: z.number().int().min(0),
    bulletIndex: z.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === "bullet" && value.bulletIndex == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bulletIndex"],
        message: "bulletIndex is required when scope is bullet.",
      });
    }
    if (value.scope === "entry" && value.bulletIndex != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bulletIndex"],
        message: "bulletIndex is not allowed when scope is entry.",
      });
    }
  });

export const RewriteFeedbackSchema = z.object({
  intents: z.array(RewriteIntentSchema).max(5),
  note: z.string().max(1200).optional(),
  requestedTechnology: z.string().max(80).optional(),
});

export const RewriteBulletCountPolicySchema = z.enum(["fixed", "allow_plus_minus_one"]);

export const RewriteRequestSchema = z.object({
  parsed: ParsedResumeSchema,
  currentResume: ParsedResumeSchema,
  jdText: z.string().min(1).max(15000),
  target: RewriteTargetSchema,
  feedback: RewriteFeedbackSchema,
  bulletCountPolicy: RewriteBulletCountPolicySchema,
});

export const RewriteSuggestionSchema = z.object({
  section: RewriteSectionSchema,
  entryIndex: z.number().int().min(0),
  scope: RewriteScopeSchema,
  bulletIndex: z.number().int().min(0).optional(),
  bullets: z.array(BulletPointSchema).min(1).max(10),
});

export const RewriteResponseSchema = z.object({
  suggestion: RewriteSuggestionSchema,
  changedBulletIndexes: z.array(z.number().int().min(0)),
  warnings: z.array(z.string()),
});

export type RewriteIntent = z.infer<typeof RewriteIntentSchema>;
export type RewriteScope = z.infer<typeof RewriteScopeSchema>;
export type RewriteSection = z.infer<typeof RewriteSectionSchema>;
export type RewriteTarget = z.infer<typeof RewriteTargetSchema>;
export type RewriteFeedback = z.infer<typeof RewriteFeedbackSchema>;
export type RewriteBulletCountPolicy = z.infer<typeof RewriteBulletCountPolicySchema>;
export type RewriteRequest = z.infer<typeof RewriteRequestSchema>;
export type RewriteSuggestion = z.infer<typeof RewriteSuggestionSchema>;
export type RewriteResponse = z.infer<typeof RewriteResponseSchema>;

export const TailorReviewSchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(100),
  feedback: z.string(),
  missingRequirements: z.array(z.string()),
  topBulletIssues: z.array(z.string()),
});

export type TailorReview = z.infer<typeof TailorReviewSchema>;

export const JdRequirementPrioritySchema = z.enum(["required", "preferred"]);
export const JdRequirementCategorySchema = z.enum([
  "language",
  "framework",
  "cloud",
  "tool",
  "database",
  "methodology",
  "domain",
  "other",
]);

export const JdRequirementSchema = z.object({
  term: z.string(),
  priority: JdRequirementPrioritySchema,
  category: JdRequirementCategorySchema,
  exactPhrase: z.string(),
});

export type JdRequirement = z.infer<typeof JdRequirementSchema>;

export const RoleFitLevelSchema = z.enum(["strong_fit", "medium_fit", "weak_fit"]);

export const RoleFitAssignmentSchema = z.object({
  requirement: JdRequirementSchema,
  roleIndex: z.number().int().min(0),
  fit: RoleFitLevelSchema,
});

export type RoleFitAssignment = z.infer<typeof RoleFitAssignmentSchema>;

export const RoleValidationResultSchema = z.object({
  roleIndex: z.number().int().min(0),
  passed: z.boolean(),
  missingRequirements: z.array(z.string()),
  credibilityIssues: z.array(z.string()),
  specificityIssues: z.array(z.string()),
  coverageScore: z.number().min(0).max(100),
  role0VisibilityScore: z.number().min(0).max(100),
  credibilityScore: z.number().min(0).max(100),
});

export type RoleValidationResult = z.infer<typeof RoleValidationResultSchema>;

export const TailorDiagnosticsSchema = z.object({
  requiredTerms: z.array(z.string()),
  coveredRequiredTerms: z.array(z.string()),
  missingRequiredTerms: z.array(z.string()),
  unsupportedClaims: z.array(z.string()),
  roleResults: z.array(RoleValidationResultSchema),
  jdCoverageScore: z.number().min(0).max(100),
  role0VisibilityScore: z.number().min(0).max(100),
  credibilityScore: z.number().min(0).max(100),
});

export type TailorDiagnostics = z.infer<typeof TailorDiagnosticsSchema>;

export type ProgressStep =
  | "extracting"
  | "parsing"
  | "parsed"
  | "requirements_extracted"
  | "tailoring"
  | "tailoring_skills"
  | "tailoring_role"
  | "reviewing"
  | "validating_role"
  | "retrying_role"
  | "revising"
  | "scoring"
  | "optimizing"
  | "complete";

export interface LoadingProgress {
  step: ProgressStep;
  charCount?: number;
  roles?: number;
  skills?: number;
  education?: number;
  projects?: number;
  keywords?: string[];
  roleIndex?: number;
  roleCompany?: string;
  roleTitle?: string;
  roleAttempt?: number;
  rolesTotal?: number;
  requiredTerms?: string[];
  missingTerms?: string[];
  coverageScore?: number;
  credibilityScore?: number;
  role0VisibilityScore?: number;
  reviewScore?: number;
  reviewApproved?: boolean;
}
