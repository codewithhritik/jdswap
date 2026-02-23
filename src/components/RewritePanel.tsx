"use client";

import type { RewriteFeedbackPreset } from "@/lib/rewrite-feedback";
import type { RewriteIntent } from "@/lib/schema";

interface RewritePanelProps {
  targetLabel: string;
  focusedBulletIndex?: number;
  intents: RewriteIntent[];
  note: string;
  requestedTechnology: string;
  presets: RewriteFeedbackPreset[];
  disabled: boolean;
  canRewrite: boolean;
  isGenerating: boolean;
  error?: string | null;
  submitLabel: string;
  onToggleIntent: (intent: RewriteIntent) => void;
  onNoteChange: (value: string) => void;
  onRequestedTechnologyChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function RewritePanel({
  targetLabel,
  focusedBulletIndex,
  intents,
  note,
  requestedTechnology,
  presets,
  disabled,
  canRewrite,
  isGenerating,
  error,
  submitLabel,
  onToggleIntent,
  onNoteChange,
  onRequestedTechnologyChange,
  onSubmit,
  onCancel,
}: RewritePanelProps) {
  const focusLabel =
    typeof focusedBulletIndex === "number" && focusedBulletIndex >= 0
      ? `Editing Bullet ${focusedBulletIndex + 1}`
      : "Entry rewrite";

  return (
    <section className="rounded-xl border border-surface-border/80 bg-surface-elevated px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-warm">Rewrite Suggestion</h3>
          <p className="mt-1 text-xs text-warm-muted">{targetLabel}</p>
        </div>
        <span className="inline-flex h-7 items-center rounded-md border border-surface-border bg-base px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-warm-muted">
          {focusLabel}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-warm-faint">Quick Feedback</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const selected = intents.includes(preset.intent);
              return (
                <button
                  key={preset.intent}
                  type="button"
                  disabled={disabled || !canRewrite}
                  onClick={() => onToggleIntent(preset.intent)}
                  title={preset.description}
                  className={`inline-flex h-8 items-center rounded-md border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    selected
                      ? "border-accent/55 bg-accent/15 text-warm"
                      : "border-surface-border bg-base text-warm-muted hover:bg-surface-hover hover:text-warm"
                  } ${disabled || !canRewrite ? "opacity-55" : ""}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warm-faint">Feedback note</span>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            disabled={disabled || !canRewrite}
            placeholder="Tell the model what to change for this rewrite."
            className="w-full resize-y rounded-md border border-surface-border bg-base px-3 py-2 text-sm text-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warm-faint">Technology to add (optional)</span>
          <input
            value={requestedTechnology}
            onChange={(event) => onRequestedTechnologyChange(event.target.value)}
            disabled={disabled || !canRewrite}
            placeholder="e.g. Rust, Terraform, Kafka"
            className="w-full rounded-md border border-surface-border bg-base px-3 py-2 text-sm text-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          />
        </label>
      </div>

      {!canRewrite && (
        <p className="mt-3 text-xs text-danger">Rewrite tools are available after an initial tailoring run.</p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || !canRewrite}
          onClick={onSubmit}
          className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-semibold text-[rgb(var(--color-accent-contrast))] transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-elevated disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? "Generating..." : submitLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-md px-2 text-sm text-warm-muted transition-colors hover:bg-surface-hover hover:text-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
