"use client";

interface RewriteSuggestionCardProps {
  targetLabel: string;
  scope: "bullet" | "entry";
  originalBullets: Array<{ text: string }>;
  suggestedBullets: Array<{ text: string }>;
  changedBulletIndexes: number[];
  focusedBulletIndex?: number;
  warnings: string[];
  isBusy: boolean;
  error?: string | null;
  onApply: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

export function RewriteSuggestionCard({
  targetLabel,
  scope,
  originalBullets,
  suggestedBullets,
  changedBulletIndexes,
  focusedBulletIndex,
  warnings,
  isBusy,
  error,
  onApply,
  onRetry,
  onCancel,
}: RewriteSuggestionCardProps) {
  const changedSet = new Set(changedBulletIndexes);
  const hasFocusedBullet =
    scope === "bullet" &&
    typeof focusedBulletIndex === "number" &&
    focusedBulletIndex >= 0 &&
    focusedBulletIndex < originalBullets.length &&
    focusedBulletIndex < suggestedBullets.length;
  const focusLabel = hasFocusedBullet ? `Editing Bullet ${(focusedBulletIndex ?? 0) + 1}` : "Entry rewrite";

  return (
    <section className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-warm">Rewrite Preview</h3>
          <p className="mt-1 text-xs text-warm-muted">
            {targetLabel} · {scope === "bullet" ? "Bullet-focused" : "Entry revamp"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-accent/45 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-accent">
            {focusLabel}
          </span>
          <span className="rounded-full border border-accent/45 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-accent">
            Review First
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-surface-border bg-surface px-3 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-warm-faint">Current</p>
          <div className="space-y-2">
            {hasFocusedBullet ? (
              <p className="text-xs text-warm-muted">
                {(focusedBulletIndex ?? 0) + 1}. {originalBullets[focusedBulletIndex!]?.text}
              </p>
            ) : (
              originalBullets.map((bullet, idx) => (
                <p key={`current-${idx}`} className="text-xs text-warm-muted">
                  {idx + 1}. {bullet.text}
                </p>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-accent/35 bg-surface px-3 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-warm-faint">Suggested</p>
          <div className="space-y-2">
            {hasFocusedBullet ? (
              <p className={`text-xs ${changedSet.has(focusedBulletIndex!) ? "text-warm" : "text-warm-muted"}`}>
                {(focusedBulletIndex ?? 0) + 1}. {suggestedBullets[focusedBulletIndex!]?.text}
              </p>
            ) : (
              suggestedBullets.map((bullet, idx) => (
                <p
                  key={`suggested-${idx}`}
                  className={`text-xs ${changedSet.has(idx) ? "text-warm" : "text-warm-muted"}`}
                >
                  {idx + 1}. {bullet.text}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2">
          <p className="text-xs font-medium text-danger">Review notes</p>
          <div className="mt-1 space-y-1">
            {warnings.map((warning, idx) => (
              <p key={`warning-${idx}`} className="text-xs text-danger">
                {warning}
              </p>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={onApply}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[rgb(var(--color-accent-contrast))] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          Apply
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={onRetry}
          className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
        >
          Retry
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={onCancel}
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-warm-muted transition-colors hover:text-warm disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

