export function sanitizeText(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function isNullLike(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;

  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === "null" ||
    normalized === "undefined" ||
    normalized === "n/a" ||
    normalized === "-"
  );
}

export function sanitizeNullableText(value: unknown): string | null {
  if (isNullLike(value)) return null;
  return sanitizeText(String(value));
}
