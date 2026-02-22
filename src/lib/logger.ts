import { NextRequest } from "next/server";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LOG_LEVEL: LogLevel = "info";
const SAFE_STRING_KEYS = new Set([
  "phase",
  "status",
  "reason",
  "code",
  "model",
  "step",
  "selected",
  "route",
  "component",
  "event",
]);
const BLOCKED_KEYS = new Set([
  "rawtext",
  "jdtext",
  "email",
  "phone",
  "linkedin",
  "github",
  "website",
  "name",
  "summary",
  "bullets",
  "skills",
  "feedback",
  "replacements",
  "old",
  "new",
  "text",
]);

export interface LogContext {
  requestId?: string;
  route?: string;
  component: string;
}

export interface LogMeta {
  [key: string]: unknown;
}

export interface Logger {
  info(event: string, meta?: LogMeta): void;
  warn(event: string, meta?: LogMeta): void;
  error(event: string, meta?: LogMeta & { err?: unknown }): void;
  debug(event: string, meta?: LogMeta): void;
  child(extraContext: Partial<LogContext>): Logger;
}

function resolveLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return DEFAULT_LOG_LEVEL;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[resolveLogLevel()];
}

function stringifyError(err: unknown): { type: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return {
      type: err.name,
      message: err.message,
      ...(process.env.NODE_ENV === "development" && err.stack
        ? { stack: err.stack.split("\n").slice(0, 8).join("\n") }
        : {}),
    };
  }
  if (typeof err === "string") {
    return { type: "Error", message: err };
  }
  return { type: "UnknownError", message: "Unknown error" };
}

function sanitizeMetaValue(
  value: unknown,
  key?: string,
  depth = 0
): unknown {
  if (depth > 4) return "[max_depth]";
  if (value === null || value === undefined) return value;

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalizedKey = key?.toLowerCase();
    if (normalizedKey && SAFE_STRING_KEYS.has(normalizedKey)) {
      return value.length <= 80 ? value : `${value.slice(0, 80)}...`;
    }
    return `[string:${value.length}]`;
  }

  if (Array.isArray(value)) {
    const sample = value.slice(0, 20).map((item) => sanitizeMetaValue(item, key, depth + 1));
    return value.length > 20 ? [...sample, "[truncated]"] : sample;
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 50);

    for (const [k, v] of entries) {
      const lowered = k.toLowerCase();
      if (BLOCKED_KEYS.has(lowered)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = sanitizeMetaValue(v, k, depth + 1);
    }
    return out;
  }

  return String(value);
}

function emit(level: LogLevel, event: string, context: LogContext, meta?: LogMeta & { err?: unknown }) {
  if (!shouldLog(level)) return;

  const { err, ...restMeta } = meta ?? {};
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId: context.requestId ?? "n/a",
    route: context.route ?? "n/a",
    component: context.component,
    ...(Object.keys(restMeta).length > 0 ? { meta: sanitizeMetaValue(restMeta) } : {}),
    ...(err ? { error: sanitizeMetaValue(stringifyError(err)) } : {}),
  };

  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

function mergeContext(base: LogContext, extra?: Partial<LogContext>): LogContext {
  return {
    component: extra?.component ?? base.component,
    requestId: extra?.requestId ?? base.requestId,
    route: extra?.route ?? base.route,
  };
}

export function createLogger(context: LogContext): Logger {
  return {
    info(event: string, meta?: LogMeta) {
      emit("info", event, context, meta);
    },
    warn(event: string, meta?: LogMeta) {
      emit("warn", event, context, meta);
    },
    error(event: string, meta?: LogMeta & { err?: unknown }) {
      emit("error", event, context, meta);
    },
    debug(event: string, meta?: LogMeta) {
      emit("debug", event, context, meta);
    },
    child(extraContext: Partial<LogContext>) {
      return createLogger(mergeContext(context, extraContext));
    },
  };
}

export function getOrCreateRequestId(req: NextRequest): string {
  const fromHeader = req.headers.get("x-request-id")?.trim();
  if (fromHeader && fromHeader.length <= 128) return fromHeader;
  return crypto.randomUUID();
}
