"use client";

import { useEffect, useState } from "react";

interface PdfExactPreviewProps {
  pdfBlob: Blob;
  pageCountHint?: number | null;
}

const PAGE_WIDTH_MAX = 760;

export function PdfExactPreview({ pdfBlob, pageCountHint }: PdfExactPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const nextUrl = URL.createObjectURL(pdfBlob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [pdfBlob]);

  if (!url) {
    return <PreviewPlaceholder label="Preparing PDF preview..." />;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.1em] text-warm-faint">
        Exact exported PDF{pageCountHint ? ` · ${pageCountHint} page${pageCountHint > 1 ? "s" : ""}` : ""}
      </p>
      <div className="rounded-lg border border-surface-border bg-base/10 p-2">
        <iframe
          title="Exact exported PDF preview"
          src={url}
          className="h-[76vh] w-full rounded bg-white"
          style={{ maxWidth: `${PAGE_WIDTH_MAX + 32}px`, margin: "0 auto", display: "block" }}
        />
      </div>
    </div>
  );
}

function PreviewPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-base/10 px-3 py-5 text-center text-xs text-warm-muted">
      {label}
    </div>
  );
}
