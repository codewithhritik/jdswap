"use client";

import { renderAsync } from "docx-preview";
import { useCallback, useEffect, useRef, useState, type WheelEvent } from "react";

interface DocxArtifactPreviewProps {
  docxBlob: Blob;
  expectedPageCount?: number | null;
}

const MIN_ZOOM_PERCENT = 50;
const MAX_ZOOM_PERCENT = 200;
const ZOOM_STEP_PERCENT = 10;

function clampZoomPercent(value: number) {
  return Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, value));
}

export function DocxArtifactPreview({
  docxBlob,
  expectedPageCount = null,
}: DocxArtifactPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedPageCount, setRenderedPageCount] = useState<number | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const recalcViewportScale = useCallback(() => {
    const viewport = viewportRef.current;
    const container = containerRef.current;
    if (!viewport || !container) return;

    const pages = Array.from(
      container.querySelectorAll<HTMLElement>("section.jdswap-docx")
    );
    if (pages.length === 0) {
      setRenderedPageCount(null);
      setFitScale(1);
      setContentWidth(null);
      setContentHeight(null);
      return;
    }

    setRenderedPageCount(pages.length);
    const firstPage = pages[0]!;
    const pageWidth = firstPage.offsetWidth;
    const unscaledWidth = Math.max(1, container.scrollWidth);
    const unscaledHeight = Math.max(1, container.scrollHeight);
    const availableWidth = Math.max(1, viewport.clientWidth - 8);
    const nextFitScale = pageWidth > 0 ? Math.min(1, availableWidth / pageWidth) : 1;

    setFitScale((previous) =>
      Math.abs(previous - nextFitScale) < 0.001 ? previous : nextFitScale
    );
    setContentWidth(unscaledWidth);
    setContentHeight(unscaledHeight);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    setRenderError(null);
    setRenderedPageCount(null);
    setFitScale(1);
    setContentWidth(null);
    setContentHeight(null);
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

  const effectiveScale = fitScale * (zoomPercent / 100);
  const stageWidth = contentWidth ? Math.ceil(contentWidth * effectiveScale) : null;
  const stageHeight = contentHeight ? Math.ceil(contentHeight * effectiveScale) : null;
  const zoomDisplayPercent = Math.round(effectiveScale * 100);
  const isZoomInteractive = renderedPageCount !== null && !renderError;

  const adjustZoom = useCallback((delta: number) => {
    setZoomPercent((current) => clampZoomPercent(current + delta));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomPercent(100);
  }, []);

  const handleViewportWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (!isZoomInteractive) return;

      event.preventDefault();
      const zoomDelta = event.deltaY < 0 ? ZOOM_STEP_PERCENT : -ZOOM_STEP_PERCENT;
      adjustZoom(zoomDelta);
    },
    [adjustZoom, isZoomInteractive]
  );

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Rendered pages: {renderedPageCount ?? "--"}
            {expectedPageCount !== null ? ` · expected DOCX pages: ${expectedPageCount}` : ""}
            {` · zoom ${zoomDisplayPercent}%`}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => adjustZoom(-ZOOM_STEP_PERCENT)}
              disabled={!isZoomInteractive || zoomPercent <= MIN_ZOOM_PERCENT}
              aria-label="Zoom out preview"
              className="rounded-md border border-surface-border/80 px-2 py-1 text-[10px] text-warm-muted transition-colors hover:text-warm disabled:cursor-not-allowed disabled:opacity-45"
            >
              -
            </button>
            <button
              type="button"
              onClick={resetZoom}
              disabled={!isZoomInteractive || zoomPercent === 100}
              aria-label="Reset preview zoom to 100 percent"
              className="rounded-md border border-surface-border/80 px-2 py-1 text-[10px] text-warm-muted transition-colors hover:text-warm disabled:cursor-not-allowed disabled:opacity-45"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(ZOOM_STEP_PERCENT)}
              disabled={!isZoomInteractive || zoomPercent >= MAX_ZOOM_PERCENT}
              aria-label="Zoom in preview"
              className="rounded-md border border-surface-border/80 px-2 py-1 text-[10px] text-warm-muted transition-colors hover:text-warm disabled:cursor-not-allowed disabled:opacity-45"
            >
              +
            </button>
          </div>
        </div>
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
          onWheel={handleViewportWheel}
          className="max-h-[76vh] overflow-auto rounded-lg border border-surface-border/70 bg-base/20 p-2"
        >
          <div
            className="jdswap-docx-stage-shell"
            style={{
              width: stageWidth ? `${stageWidth}px` : "100%",
              height: stageHeight ? `${stageHeight}px` : undefined,
            }}
          >
            <div
              ref={containerRef}
              className="jdswap-docx-stage"
              style={{
                transform: `scale(${effectiveScale})`,
                width: contentWidth ? `${contentWidth}px` : undefined,
                height: contentHeight ? `${contentHeight}px` : undefined,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
