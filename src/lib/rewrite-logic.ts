import type {
  RewriteBulletCountPolicy,
  RewriteIntent,
  RewriteScope,
  RewriteSection,
} from "./schema";
import { buildIntentInstructions } from "./rewrite-feedback";
import { sanitizeText } from "./text";

const HIGH_RISK_PATTERNS = [
  /single-handedly/i,
  /company[- ]wide strategy/i,
  /managed\s+\d{2,}\s+engineers?/i,
  /global transformation/i,
];

const WEAK_LANGUAGE_PATTERNS = [
  /responsible for/i,
  /helped to/i,
  /worked on/i,
  /assisted with/i,
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getSectionBulletBounds(section: RewriteSection): { min: number; max: number } {
  return section === "experience" ? { min: 1, max: 5 } : { min: 1, max: 3 };
}

export function applyBulletCountPolicy(args: {
  scope: RewriteScope;
  section: RewriteSection;
  policy: RewriteBulletCountPolicy;
  baselineCount: number;
  requestedCount?: number;
}): { minCount: number; maxCount: number; targetCount: number } {
  const bounds = getSectionBulletBounds(args.section);
  const baseline = clamp(args.baselineCount, bounds.min, bounds.max);

  if (args.scope === "bullet" || args.policy === "fixed") {
    return {
      minCount: baseline,
      maxCount: baseline,
      targetCount: baseline,
    };
  }

  const minCount = clamp(baseline - 1, bounds.min, bounds.max);
  const maxCount = clamp(baseline + 1, bounds.min, bounds.max);
  const targetCount = clamp(args.requestedCount ?? baseline, minCount, maxCount);

  return {
    minCount,
    maxCount,
    targetCount,
  };
}

export function computeChangedBulletIndexes(
  beforeBullets: string[],
  afterBullets: string[]
): number[] {
  const maxLen = Math.max(beforeBullets.length, afterBullets.length);
  const changed: number[] = [];

  for (let index = 0; index < maxLen; index += 1) {
    const previous = sanitizeText(beforeBullets[index] ?? "");
    const next = sanitizeText(afterBullets[index] ?? "");
    if (previous !== next) changed.push(index);
  }

  return changed;
}

export function collectRewriteWarnings(args: {
  bullets: string[];
  requestedTechnology?: string;
  intents: RewriteIntent[];
}): string[] {
  const warnings = new Set<string>();

  for (const bullet of args.bullets) {
    if (!bullet.trim()) {
      warnings.add("One or more rewritten bullets are empty.");
      continue;
    }

    if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(bullet))) {
      warnings.add("Some wording may overstate scope. Verify claims before applying.");
    }

    if (WEAK_LANGUAGE_PATTERNS.some((pattern) => pattern.test(bullet))) {
      warnings.add("Some bullets still use weak phrasing and may need manual tightening.");
    }
  }

  const requestedTechnology = sanitizeText(args.requestedTechnology ?? "");
  if (requestedTechnology) {
    const found = args.bullets.some((bullet) =>
      bullet.toLowerCase().includes(requestedTechnology.toLowerCase())
    );
    if (!found) {
      warnings.add(
        `Requested technology "${requestedTechnology}" was not explicitly mentioned in the suggestion.`
      );
    }
  }

  if (args.intents.length === 0) {
    warnings.add("No feedback intent was selected. Output may be generic.");
  }

  return Array.from(warnings);
}

export function mapIntentInstructions(intents: RewriteIntent[]): string[] {
  return buildIntentInstructions(intents);
}
