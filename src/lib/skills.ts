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

export function removeOneSkillItem(skillLines: string[]): string[] {
  const lines = [...skillLines];

  for (let i = lines.length - 1; i >= 0; i--) {
    const category = parseCategory(lines[i]!);
    if (!category) continue;
    if (category.items.length <= 1) continue;

    category.items.pop();
    lines[i] = formatCategory(category);
    return lines.filter(Boolean);
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    const category = parseCategory(lines[i]!);
    if (!category) continue;
    lines.splice(i, 1);
    return lines.filter(Boolean);
  }

  if (lines.length > 0) {
    lines.pop();
  }

  return lines.filter(Boolean);
}
