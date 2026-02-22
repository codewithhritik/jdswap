import { createHash } from "node:crypto";
import type { SourceLayout, TailoredResume } from "./schema";

interface ExportRevisionPayload {
  resume: TailoredResume;
  sourceLayout: SourceLayout;
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  const valueType = typeof value;

  if (valueType === "string") return JSON.stringify(value);
  if (valueType === "number" || valueType === "boolean") return String(value);
  if (valueType !== "object") return JSON.stringify(String(value));

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`);
  return `{${parts.join(",")}}`;
}

export function computeExportRevision(payload: ExportRevisionPayload): string {
  return createHash("sha256")
    .update(stableSerialize(payload))
    .digest("hex")
    .slice(0, 24);
}
