"use client";

import { useState } from "react";
import type { SourceLayout, TailoredResume } from "@/lib/schema";
import { ResumeEditor } from "@/components/ResumeEditor";
import { ExportPreview } from "@/components/ExportPreview";

interface ResumeWorkspaceProps {
  resume: TailoredResume;
  sourceLayout: SourceLayout;
  onFormChange: (resume: TailoredResume) => void;
  pdfBlob: Blob | null;
  docxBlob: Blob | null;
  previewRevision: string | null;
  previewPageCount: number | null;
  isGeneratingPreview: boolean;
  isPreviewStale: boolean;
  previewError?: string | null;
  downloadError?: string | null;
}

type WorkspacePane = "form" | "preview";

export function ResumeWorkspace({
  resume,
  sourceLayout,
  onFormChange,
  pdfBlob,
  docxBlob,
  previewRevision,
  previewPageCount,
  isGeneratingPreview,
  isPreviewStale,
  previewError,
  downloadError,
}: ResumeWorkspaceProps) {
  const [activePane, setActivePane] = useState<WorkspacePane>("form");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-surface-border bg-surface p-1 md:hidden">
        <PaneTab
          label="Form"
          active={activePane === "form"}
          onClick={() => setActivePane("form")}
        />
        <PaneTab
          label="Preview"
          active={activePane === "preview"}
          onClick={() => setActivePane("preview")}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] md:items-start">
        <div className={activePane === "form" ? "block" : "hidden md:block"}>
          <ResumeEditor resume={resume} onChange={onFormChange} />
        </div>

        <div className={activePane === "preview" ? "block" : "hidden md:block md:sticky md:top-6"}>
          <ExportPreview
            resume={resume}
            sourceLayout={sourceLayout}
            onResumeChange={onFormChange}
            pdfBlob={pdfBlob}
            docxBlob={docxBlob}
            revision={previewRevision}
            pageCount={previewPageCount}
            isGeneratingPreview={isGeneratingPreview}
            isPreviewStale={isPreviewStale}
            previewError={previewError ?? null}
            downloadError={downloadError ?? null}
          />
        </div>
      </div>
    </div>
  );
}

function PaneTab({
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
          : "text-warm-muted hover:text-warm"
      }`}
    >
      {label}
    </button>
  );
}
