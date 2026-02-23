"use client";

import { renderAsync } from "docx-preview";
import { useCallback, useEffect, useRef, useState } from "react";

interface DocxArtifactPreviewProps {
  docxBlob: Blob;
  expectedPageCount?: number | null;
}

export function DocxArtifactPreview({
  docxBlob,
  expectedPageCount = null,
}: DocxArtifactPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedPageCount, setRenderedPageCount] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [stageWidth, setStageWidth] = useState<number | null>(null);
  const [stageHeight, setStageHeight] = useState<number | null>(null);

  const recalcViewportScale = useCallback(() => {
    const viewport = viewportRef.current;
    const container = containerRef.current;
    if (!viewport || !container) return;

    const pages = Array.from(
      container.querySelectorAll<HTMLElement>("section.jdswap-docx")
    );
    if (pages.length === 0) {
      setRenderedPageCount(null);
      setScale(1);
      setStageWidth(null);
      setStageHeight(null);
      return;
    }

    setRenderedPageCount(pages.length);
    const firstPage = pages[0]!;
    const pageWidth = firstPage.offsetWidth;
    const unscaledWidth = Math.max(1, container.scrollWidth);
    const unscaledHeight = Math.max(1, container.scrollHeight);
    const availableWidth = Math.max(1, viewport.clientWidth - 8);
    const nextScale = pageWidth > 0 ? Math.min(1, availableWidth / pageWidth) : 1;

    setScale((previous) =>
      Math.abs(previous - nextScale) < 0.001 ? previous : nextScale
    );
    setStageWidth(Math.ceil(unscaledWidth * nextScale));
    setStageHeight(Math.ceil(unscaledHeight * nextScale));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    setRenderError(null);
    setRenderedPageCount(null);
    setScale(1);
    setStageWidth(null);
    setStageHeight(null);
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
          ignoreLastRenderedPageBreak: false,
        });
        requestAnimationFrame(() => {
          if (!disposed) recalcViewportScale();
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
  }, [docxBlob, recalcViewportScale]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      recalcViewportScale();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [recalcViewportScale]);

  const hasPageCountMismatch =
    expectedPageCount !== null &&
    renderedPageCount !== null &&
    expectedPageCount !== renderedPageCount;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-surface-border/80 bg-base/10 px-3 py-2 text-xs text-warm-muted">
        Read-only Word view. Edit content in the form, then this document syncs automatically.
      </div>
      <div className="rounded-lg border border-surface-border/70 bg-base/10 px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-warm-faint">
        Rendered pages: {renderedPageCount ?? "--"}
        {expectedPageCount !== null ? ` · expected DOCX pages: ${expectedPageCount}` : ""}
        {` · zoom ${Math.round(scale * 100)}%`}
      </div>
      {hasPageCountMismatch && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
          Preview page count does not match the generated DOCX yet. Downloaded DOCX remains the
          source of truth.
        </div>
      )}
      {renderError && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
          {renderError}
        </div>
      )}
      <div className="rounded-xl border border-surface-border bg-[linear-gradient(165deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_55%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div
          ref={viewportRef}
          className="max-h-[76vh] overflow-auto rounded-lg border border-surface-border/70 bg-base/20 p-2"
        >
          <div
            className="jdswap-docx-stage-shell"
            style={{
              width: stageWidth ? `${stageWidth}px` : "100%",
              minHeight: stageHeight ? `${stageHeight}px` : undefined,
            }}
          >
            <div
              ref={containerRef}
              className="jdswap-docx-stage"
              style={{ transform: `scale(${scale})` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
