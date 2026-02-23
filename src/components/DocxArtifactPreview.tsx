"use client";

import { renderAsync } from "docx-preview";
import { useEffect, useRef, useState } from "react";

interface DocxArtifactPreviewProps {
  docxBlob: Blob;
}

export function DocxArtifactPreview({ docxBlob }: DocxArtifactPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    setRenderError(null);
    container.innerHTML = "";

    (async () => {
      try {
        const arrayBuffer = await docxBlob.arrayBuffer();
        if (disposed) return;

        await renderAsync(arrayBuffer, container, undefined, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          className: "jdswap-docx",
          breakPages: true,
        });
      } catch {
        if (!disposed) {
          setRenderError("Unable to render DOCX preview.");
        }
      }
    })();

    return () => {
      disposed = true;
      container.innerHTML = "";
    };
  }, [docxBlob]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-surface-border bg-base/10 px-3 py-2 text-xs text-warm-muted">
        Word preview is read-only and mirrors the exact DOCX artifact.
      </div>
      {renderError && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
          {renderError}
        </div>
      )}
      <div className="max-h-[76vh] overflow-auto rounded-lg border border-surface-border bg-base/10 p-2">
        <div ref={containerRef} />
      </div>
    </div>
  );
}
