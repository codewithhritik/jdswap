"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { LiveEditablePreview } from "@/components/LiveEditablePreview";
import type { SourceLayout, TailoredResume } from "@/lib/schema";

const PdfExactPreview = dynamic(
  () => import("@/components/PdfExactPreview").then((mod) => mod.PdfExactPreview),
  {
    ssr: false,
    loading: () => <PreviewPlaceholder label="Loading PDF preview..." />,
  }
);

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

type PreviewTab = "live" | "pdf" | "docx";

interface ExportPreviewProps {
  resume: TailoredResume;
  sourceLayout: SourceLayout;
  onResumeChange: (resume: TailoredResume) => void;
  pdfBlob: Blob | null;
  docxBlob: Blob | null;
  revision: string | null;
  pageCount: number | null;
  isGeneratingPreview: boolean;
  isPreviewStale: boolean;
  previewError: string | null;
  downloadError?: string | null;
}

export function ExportPreview({
  resume,
  sourceLayout,
  onResumeChange,
  pdfBlob,
  docxBlob,
  revision,
  pageCount,
  isGeneratingPreview,
  isPreviewStale,
  previewError,
  downloadError,
}: ExportPreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("live");

  const pageCountText = useMemo(() => {
    if (!pageCount) return "Pages: --";
    return pageCount === 1 ? "Pages: 1" : `Pages: ${pageCount}`;
  }, [pageCount]);

  return (
    <section className="rounded-2xl border border-surface-border/85 bg-surface/95 p-4 shadow-[0_14px_36px_rgba(0,0,0,0.16)] sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl italic tracking-tight text-warm">
            Export Preview
          </h2>
          <p className="mt-1 text-xs text-warm-muted">
            Preview renders the exact PDF and DOCX artifacts used for download.
          </p>
        </div>

        <div className="rounded-lg border border-surface-border bg-base/20 px-3 py-2 text-[11px] uppercase tracking-[0.09em] text-warm-faint">
          {pageCountText}
          {revision ? ` · rev ${revision.slice(0, 8)}` : ""}
        </div>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <TabButton
          label="Live (Editable)"
          active={activeTab === "live"}
          onClick={() => setActiveTab("live")}
        />
        <TabButton
          label="PDF (Exact)"
          active={activeTab === "pdf"}
          onClick={() => setActiveTab("pdf")}
        />
        <TabButton
          label="DOCX"
          active={activeTab === "docx"}
          onClick={() => setActiveTab("docx")}
        />
        <div className="ml-auto text-xs text-warm-muted">
          {isGeneratingPreview
            ? "Syncing preview..."
            : isPreviewStale
              ? "Preview refresh pending..."
              : "Preview synced"}
        </div>
      </div>
      {activeTab !== "live" && (
        <div className="mb-3 rounded-lg border border-surface-border bg-base/10 px-3 py-2 text-xs text-warm-muted">
          Exact previews are read-only. Edit text in the Live tab or the form.
        </div>
      )}

      {previewError && (
        <Alert color="danger" message={previewError} />
      )}
      {downloadError && (
        <Alert color="danger" message={downloadError} />
      )}

      {activeTab === "live" ? (
        <LiveEditablePreview
          resume={resume}
          sourceLayout={sourceLayout}
          onChange={onResumeChange}
        />
      ) : !pdfBlob || !docxBlob ? (
        <PreviewPlaceholder label="Generating preview artifacts..." />
      ) : activeTab === "pdf" ? (
        <PdfExactPreview pdfBlob={pdfBlob} pageCountHint={pageCount} />
      ) : (
        <DocxArtifactPreview docxBlob={docxBlob} />
      )}
    </section>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active
          ? "bg-accent text-[rgb(var(--color-accent-contrast))]"
          : "border border-surface-border bg-base/20 text-warm-muted hover:text-warm"
      }`}
    >
      {label}
    </button>
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
