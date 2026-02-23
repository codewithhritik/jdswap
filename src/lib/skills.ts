function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeSkillLines(skills: string[]): string[] {
  const lines: string[] = [];

  for (const skill of skills) {
    const parts = skill
      .split(/\r?\n|\|/)
      .map(normalizeSpace)
      .filter(Boolean);
    lines.push(...parts);
  }

  return lines;
}

export function parseSkillsEditorInput(input: string): string[] {
  return normalizeSkillLines([input]);
}

export function formatSkillsForEditor(skills: string[]): string {
  return normalizeSkillLines(skills).join("\n");
}

interface ParsedSkillCategory {
  label: string;
  items: string[];
}

type ExportSkillCategoryKey =
  | "languages"
  | "frameworks"
  | "cloud"
  | "databases"
  | "tools"
  | "methods"
  | "domain"
  | "other";

export interface SkillTrimOperation {
  type: "item" | "line";
  lineIndex: number;
  label?: string;
  item?: string;
  line?: string;
}

function parseCategory(line: string): ParsedSkillCategory | null {
  const idx = line.indexOf(":");
  if (idx <= 0) return null;

  const label = normalizeSpace(line.slice(0, idx));
  const rawItems = line.slice(idx + 1);
  const items = rawItems
    .split(",")
    .map(normalizeSpace)
    .filter(Boolean);

  if (!label || items.length === 0) return null;
  return { label, items };
}

function formatCategory(category: ParsedSkillCategory): string {
  return `${category.label}: ${category.items.join(", ")}`;
}

const ATS_SKILL_TRIM_ORDER = [
  "other",
  "methods",
  "tools",
  "databases",
  "cloud",
  "frameworks",
  "languages",
] as const;

const CORE_CATEGORY_MIN_ITEMS: Record<string, number> = {
  languages: 3,
  frameworks: 2,
  cloud: 2,
};

function normalizeCategoryLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z]/g, "");
}

function resolveCategoryPriorityKey(label: string): (typeof ATS_SKILL_TRIM_ORDER)[number] {
  const normalized = normalizeCategoryLabel(label);
  if (normalized.includes("language")) return "languages";
  if (normalized.includes("framework")) return "frameworks";
  if (normalized.includes("cloud")) return "cloud";
  if (normalized.includes("database") || normalized.includes("data")) return "databases";
  if (normalized.includes("tool")) return "tools";
  if (normalized.includes("method")) return "methods";
  if (normalized.includes("other")) return "other";
  return "other";
}

function normalizeExportCategoryBucket(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveExportCategoryKey(label: string): ExportSkillCategoryKey {
  const normalized = normalizeCategoryLabel(label);
  if (normalized.includes("language")) return "languages";
  if (normalized.includes("framework")) return "frameworks";
  if (normalized.includes("cloud")) return "cloud";
  if (normalized.includes("database") || normalized.includes("data")) return "databases";
  if (normalized.includes("tool")) return "tools";
  if (normalized.includes("method")) return "methods";
  if (normalized.includes("domain")) return "domain";
  if (normalized.includes("other")) return "other";
  return "other";
}

const EXPORT_LINE_CHAR_BUDGET = 105;
const EXPORT_UNCATEGORIZED_LINE_LIMIT = 2;

const EXPORT_CATEGORY_ITEM_CAP: Record<ExportSkillCategoryKey, number> = {
  languages: 6,
  frameworks: 6,
  cloud: 5,
  databases: 4,
  tools: 6,
  methods: 4,
  domain: 3,
  other: 3,
};

const EXPORT_CATEGORY_MIN_ITEMS: Record<ExportSkillCategoryKey, number> = {
  languages: 2,
  frameworks: 2,
  cloud: 1,
  databases: 1,
  tools: 1,
  methods: 1,
  domain: 1,
  other: 1,
};

const LOW_SIGNAL_METHOD_OTHER_TERMS = new Set([
  "agile",
  "agile development",
  "scrum",
  "kanban",
  "code review",
  "code reviews",
  "design patterns",
  "documentation",
  "collaboration",
  "communication",
  "cross functional collaboration",
  "problem solving",
  "teamwork",
  "leadership",
  "mentorship",
  "mentoring",
  "ownership",
  "stakeholder management",
  "vibe coding",
]);

const HIGH_SIGNAL_TECH_HINT =
  /[#/+.]|\d|\b(api|apis|graphql|grpc|ci\/cd|kubernetes|docker|terraform|aws|gcp|azure|react|next\.js|node\.js|spring|sql|nosql|redis|mongodb|postgresql|mysql|linux|unix|html|css|scss|tailwind|typescript|javascript|python|java|go|rust|c\+\+|c#|flask|django|fastapi|kafka|spark|airflow|dbt|s3|ec2|lambda|rds|eks|oauth|rbac|microservices|rest)\b/i;

interface ExportSkillCategory {
  label: string;
  key: ExportSkillCategoryKey;
  items: string[];
  seenItems: Set<string>;
}

function isHighSignalSkillToken(value: string): boolean {
  return HIGH_SIGNAL_TECH_HINT.test(value);
}

function isLowSignalMethodOrOther(value: string): boolean {
  const normalized = normalizeSpace(value).toLowerCase();
  if (!normalized) return true;
  if (isHighSignalSkillToken(normalized)) return false;
  return LOW_SIGNAL_METHOD_OTHER_TERMS.has(normalized);
}

function selectItemsByCategoryPriority(
  key: ExportSkillCategoryKey,
  items: string[],
  cap: number
): string[] {
  if (items.length <= cap) return [...items];
  if (key !== "methods" && key !== "other") return items.slice(0, cap);

  const selectedIndices = new Set<number>();
  for (let i = 0; i < items.length && selectedIndices.size < cap; i += 1) {
    if (!isLowSignalMethodOrOther(items[i]!)) selectedIndices.add(i);
  }

  for (let i = 0; i < items.length && selectedIndices.size < cap; i += 1) {
    selectedIndices.add(i);
  }

  return Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .map((index) => items[index]!)
    .slice(0, cap);
}

function clampItemsToLineBudget(
  label: string,
  items: string[],
  minItems: number,
  budget: number
): string[] {
  if (items.length === 0) return [];

  const required = Math.max(1, Math.min(minItems, items.length));
  const kept = items.slice(0, required);

  for (let i = required; i < items.length; i += 1) {
    const nextItem = items[i]!;
    const candidate = [...kept, nextItem];
    const line = `${label}: ${candidate.join(", ")}`;
    if (line.length > budget) break;
    kept.push(nextItem);
  }

  return kept;
}

function upsertCategory(
  categories: Map<string, ExportSkillCategory>,
  orderedKeys: string[],
  category: ParsedSkillCategory
): ExportSkillCategory {
  const normalizedLabel = normalizeExportCategoryBucket(category.label);
  const existing = categories.get(normalizedLabel);
  if (existing) return existing;

  const created: ExportSkillCategory = {
    label: category.label,
    key: resolveExportCategoryKey(category.label),
    items: [],
    seenItems: new Set<string>(),
  };
  categories.set(normalizedLabel, created);
  orderedKeys.push(normalizedLabel);
  return created;
}

export function compactSkillsForExport(skillLines: string[]): string[] {
  const normalized = normalizeSkillLines(skillLines).map(normalizeSpace).filter(Boolean);
  if (normalized.length === 0) return [];

  const categories = new Map<string, ExportSkillCategory>();
  const orderedCategoryKeys: string[] = [];
  const uncategorized: string[] = [];
  const seenUncategorized = new Set<string>();

  for (const line of normalized) {
    const parsed = parseCategory(line);
    if (!parsed) {
      const key = line.toLowerCase();
      if (!seenUncategorized.has(key)) {
        uncategorized.push(line);
        seenUncategorized.add(key);
      }
      continue;
    }

    const target = upsertCategory(categories, orderedCategoryKeys, parsed);
    for (const item of parsed.items) {
      const cleaned = normalizeSpace(item);
      if (!cleaned) continue;
      const dedupeKey = cleaned.toLowerCase();
      if (target.seenItems.has(dedupeKey)) continue;
      target.items.push(cleaned);
      target.seenItems.add(dedupeKey);
    }
  }

  const compacted: string[] = [];
  for (const key of orderedCategoryKeys) {
    const category = categories.get(key);
    if (!category || category.items.length === 0) continue;

    const minItems = Math.min(
      category.items.length,
      EXPORT_CATEGORY_MIN_ITEMS[category.key] ?? 1
    );
    const cap = Math.max(
      minItems,
      Math.min(category.items.length, EXPORT_CATEGORY_ITEM_CAP[category.key] ?? 3)
    );
    const prioritizedItems = selectItemsByCategoryPriority(
      category.key,
      category.items,
      cap
    );
    const lineItems = clampItemsToLineBudget(
      category.label,
      prioritizedItems,
      minItems,
      EXPORT_LINE_CHAR_BUDGET
    );
    if (lineItems.length === 0) continue;
    compacted.push(formatCategory({ label: category.label, items: lineItems }));
  }

  return compacted.concat(
    uncategorized.slice(0, EXPORT_UNCATEGORIZED_LINE_LIMIT)
  );
}

export function removeOneSkillItemAtsPriority(
  skillLines: string[],
  options?: { enforceCoreMinimum?: boolean }
): { nextLines: string[]; removed: SkillTrimOperation | null } {
  const lines = [...skillLines];
  const enforceCoreMinimum = options?.enforceCoreMinimum ?? true;

  for (const categoryKey of ATS_SKILL_TRIM_ORDER) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const category = parseCategory(lines[i]!);
      if (!category) continue;
      if (resolveCategoryPriorityKey(category.label) !== categoryKey) continue;

      const minItems = enforceCoreMinimum ? (CORE_CATEGORY_MIN_ITEMS[categoryKey] ?? 0) : 0;

      if (category.items.length > Math.max(1, minItems)) {
        const removedItem = category.items.pop()!;
        lines[i] = formatCategory(category);
        return {
          nextLines: lines.filter(Boolean),
          removed: {
            type: "item",
            lineIndex: i,
            label: category.label,
            item: removedItem,
          },
        };
      }

      if (category.items.length === 1 && minItems === 0) {
        const [removedLine] = lines.splice(i, 1);
        return {
          nextLines: lines.filter(Boolean),
          removed: {
            type: "line",
            lineIndex: i,
            line: removedLine,
          },
        };
      }
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    const [removedLine] = lines.splice(i, 1);
    return {
      nextLines: lines.filter(Boolean),
      removed: {
        type: "line",
        lineIndex: i,
        line: removedLine,
      },
    };
  }

  return { nextLines: [], removed: null };
}

export function restoreSkillTrimOperation(
  skillLines: string[],
  operation: SkillTrimOperation
): string[] {
  const lines = [...skillLines];

  if (operation.type === "line") {
    const line = normalizeSpace(operation.line ?? "");
    if (!line) return lines.filter(Boolean);
    const idx = Math.max(0, Math.min(operation.lineIndex, lines.length));
    lines.splice(idx, 0, line);
    return lines.filter(Boolean);
  }

  const label = normalizeSpace(operation.label ?? "");
  const item = normalizeSpace(operation.item ?? "");
  if (!label || !item) return lines.filter(Boolean);

  const idx = Math.max(0, Math.min(operation.lineIndex, lines.length - 1));
  const target = lines[idx];
  const parsed = target ? parseCategory(target) : null;
  if (parsed && normalizeCategoryLabel(parsed.label) === normalizeCategoryLabel(label)) {
    if (!parsed.items.includes(item)) {
      parsed.items.push(item);
      lines[idx] = formatCategory(parsed);
    }
    return lines.filter(Boolean);
  }

  const insertIdx = Math.max(0, Math.min(operation.lineIndex, lines.length));
  lines.splice(insertIdx, 0, `${label}: ${item}`);
  return lines.filter(Boolean);
}

export function reapplySkillTrimOperation(
  skillLines: string[],
  operation: SkillTrimOperation
): string[] {
  const lines = [...skillLines];

  if (operation.type === "line") {
    const line = normalizeSpace(operation.line ?? "");
    if (!line) return lines.filter(Boolean);

    if (operation.lineIndex >= 0 && operation.lineIndex < lines.length && lines[operation.lineIndex] === line) {
      lines.splice(operation.lineIndex, 1);
      return lines.filter(Boolean);
    }

    const fallbackIndex = lines.lastIndexOf(line);
    if (fallbackIndex >= 0) lines.splice(fallbackIndex, 1);
    return lines.filter(Boolean);
  }

  const labelKey = normalizeCategoryLabel(operation.label ?? "");
  const item = normalizeSpace(operation.item ?? "");
  if (!labelKey || !item) return lines.filter(Boolean);

  const removeItemFromCategoryLine = (lineIndex: number): boolean => {
    const parsed = parseCategory(lines[lineIndex]!);
    if (!parsed) return false;
    if (normalizeCategoryLabel(parsed.label) !== labelKey) return false;
    const itemIndex = parsed.items.lastIndexOf(item);
    if (itemIndex < 0) return false;

    parsed.items.splice(itemIndex, 1);
    if (parsed.items.length === 0) {
      lines.splice(lineIndex, 1);
    } else {
      lines[lineIndex] = formatCategory(parsed);
    }
    return true;
  };

  if (operation.lineIndex >= 0 && operation.lineIndex < lines.length) {
    if (removeItemFromCategoryLine(operation.lineIndex)) {
      return lines.filter(Boolean);
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    if (removeItemFromCategoryLine(i)) break;
  }

  return lines.filter(Boolean);
}

export function removeOneSkillItem(skillLines: string[]): string[] {
  const firstPass = removeOneSkillItemAtsPriority(skillLines, {
    enforceCoreMinimum: true,
  });
  if (firstPass.removed) return firstPass.nextLines;

  const secondPass = removeOneSkillItemAtsPriority(skillLines, {
    enforceCoreMinimum: false,
  });
  if (secondPass.removed) return secondPass.nextLines;

  const lines = [...skillLines];
  if (lines.length > 0) {
    lines.pop();
  }

  return lines.filter(Boolean);
}
