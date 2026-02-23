import type {
  RewriteFeedback,
  RewriteIntent,
  RewriteSection,
  RewriteTarget,
  TailoredResume,
} from "./schema";

export interface RewriteFeedbackPreset {
  intent: RewriteIntent;
  label: string;
  description: string;
  noteSnippet: string;
  instruction: string;
}

export const REWRITE_FEEDBACK_PRESETS: RewriteFeedbackPreset[] = [
  {
    intent: "give_me_something_else",
    label: "Give me something else",
    description: "Change the angle and avoid repeating the same idea.",
    noteSnippet: "Give me something else with a different approach.",
    instruction: "Take a different angle from the current wording and avoid near-duplicate phrasing.",
  },
  {
    intent: "improve_writing",
    label: "Improve writing",
    description: "Tighten clarity, grammar, and sentence flow.",
    noteSnippet: "Improve writing and make it clearer.",
    instruction: "Improve readability, grammar, and flow while keeping technical meaning intact.",
  },
  {
    intent: "stronger_impact",
    label: "Stronger impact",
    description: "Highlight ownership, outcomes, and measurable results.",
    noteSnippet: "Make the impact stronger with clear outcomes.",
    instruction: "Emphasize concrete impact, outcomes, and ownership with realistic metrics.",
  },
  {
    intent: "add_technology",
    label: "Add technology",
    description: "Include specific technical tools or platforms naturally.",
    noteSnippet: "Add relevant technology naturally in the bullet.",
    instruction: "Incorporate requested technologies naturally and show how they were used.",
  },
  {
    intent: "make_it_concise",
    label: "Make it concise",
    description: "Reduce verbosity while preserving signal.",
    noteSnippet: "Make it concise without losing technical depth.",
    instruction: "Reduce verbosity while preserving key technical details and outcomes.",
  },
];

const PRESET_BY_INTENT = new Map(
  REWRITE_FEEDBACK_PRESETS.map((preset) => [preset.intent, preset] as const)
);

export function getRewriteFeedbackPreset(intent: RewriteIntent): RewriteFeedbackPreset {
  const preset = PRESET_BY_INTENT.get(intent);
  if (!preset) {
    throw new Error(`Unknown rewrite intent: ${intent}`);
  }
  return preset;
}

export function buildIntentInstructions(intents: RewriteIntent[]): string[] {
  const selected = new Set(intents);
  const ordered: string[] = [];
  for (const preset of REWRITE_FEEDBACK_PRESETS) {
    if (!selected.has(preset.intent)) continue;
    ordered.push(preset.instruction);
  }
  return ordered;
}

export function buildPresetNote(intents: RewriteIntent[]): string {
  const selected = new Set(intents);
  const snippets: string[] = [];
  for (const preset of REWRITE_FEEDBACK_PRESETS) {
    if (!selected.has(preset.intent)) continue;
    snippets.push(preset.noteSnippet);
  }
  return snippets.join(" ");
}

export function buildDefaultRewriteFeedback(): RewriteFeedback {
  const intents: RewriteIntent[] = ["give_me_something_else"];
  return {
    intents,
    note: buildPresetNote(intents),
    requestedTechnology: "",
  };
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function getResumeEntry(
  resume: TailoredResume,
  section: RewriteSection,
  entryIndex: number
): { bullets: Array<{ text: string }> } | null {
  if (section === "experience") {
    return resume.experience[entryIndex] ?? null;
  }
  if (!resume.projects) return null;
  return resume.projects[entryIndex] ?? null;
}

export function computeTargetFingerprint(
  resume: TailoredResume,
  target: RewriteTarget
): string | null {
  const entry = getResumeEntry(resume, target.section, target.entryIndex);
  if (!entry) return null;
  const content = entry.bullets.map((bullet) => bullet.text.trim()).join("\n");
  return `${target.section}:${stableHash(content)}`;
}
