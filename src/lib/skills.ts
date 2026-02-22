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
