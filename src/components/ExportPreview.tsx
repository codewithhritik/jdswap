"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const DocxArtifactPreview = dynamic(
  () =>
    import("@/components/DocxArtifactPreview").then(
      (mod) => mod.DocxArtifactPreview
    ),
  {
    ssr: false,
    loading: () => <PreviewPlaceholder label="Loading DOCX preview..." />,
  }
);

interface ExportPreviewProps {
  docxBlob: Blob | null;
  revision: string | null;
  docxPageCount: number | null;
  isGeneratingPreview: boolean;
  isPreviewStale: boolean;
  previewError: string | null;
  downloadError?: string | null;
}

export function ExportPreview({
  docxBlob,
  revision,
  docxPageCount,
  isGeneratingPreview,
  isPreviewStale,
  previewError,
  downloadError,
}: ExportPreviewProps) {
  const statusText = useMemo(() => {
    if (isGeneratingPreview) return "Syncing Word preview...";
    if (isPreviewStale) return "Preview refresh pending...";
    return "Word preview synced";
  }, [isGeneratingPreview, isPreviewStale]);

  return (
    <section className="rounded-2xl border border-surface-border/85 bg-surface/95 p-4 shadow-[0_14px_36px_rgba(0,0,0,0.16)] sm:p-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-warm-faint">
            Final Artifact
          </p>
          <h2 className="font-display text-2xl italic tracking-tight text-warm">
            Word Preview
          </h2>
          <p className="mt-1 text-xs text-warm-muted">
            This preview is layout-locked to the generated DOCX so pages match your download.
          </p>
        </div>

        <div className="rounded-lg border border-surface-border bg-base/20 px-3 py-2 text-[11px] uppercase tracking-[0.09em] text-warm-faint">
          {docxPageCount ? `${docxPageCount} page${docxPageCount > 1 ? "s" : ""} · ` : ""}
          {revision ? `rev ${revision.slice(0, 8)}` : "rev --"}
        </div>
      </header>

      <div className="mb-4 rounded-lg border border-surface-border/70 bg-base/20 px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="uppercase tracking-[0.1em] text-warm-faint">
            Document Sync
          </span>
          <span className="text-warm-muted">{statusText}</span>
        </div>
      </div>

      {previewError && (
        <Alert color="danger" message={previewError} />
      )}
      {downloadError && (
        <Alert color="danger" message={downloadError} />
      )}

      {!docxBlob ? (
        <PreviewPlaceholder label="Generating Word preview..." />
      ) : (
        <DocxArtifactPreview
          docxBlob={docxBlob}
          expectedPageCount={docxPageCount}
        />
      )}
    </section>
  );
}

function Alert({ color, message }: { color: "danger"; message: string }) {
  const className =
    color === "danger"
      ? "mb-3 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger"
      : "mb-3 rounded-lg border border-surface-border px-3 py-2 text-xs";
  return <div className={className}>{message}</div>;
}

function PreviewPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-base/10 px-3 py-8 text-center text-xs text-warm-muted">
      {label}
    </div>
  );
}
