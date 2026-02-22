"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SourceLayout, TailoredResume } from "./schema";

interface ExportArtifacts {
  pdfBlob: Blob;
  docxBlob: Blob;
  revision: string;
  pageCount: number | null;
}

interface UseExportPreviewArgs {
  resume: TailoredResume | null;
  sourceLayout: SourceLayout | null;
  enabled: boolean;
  debounceMs?: number;
}

export interface UseExportPreviewResult {
  pdfBlob: Blob | null;
  docxBlob: Blob | null;
  revision: string | null;
  pageCount: number | null;
  isGeneratingPreview: boolean;
  isPreviewStale: boolean;
  previewError: string | null;
}

function parsePageCount(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function toErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    // Ignore JSON parsing failures and use default message.
  }
  return "Unable to generate export preview.";
}

async function fetchArtifacts(
  body: string,
  signal: AbortSignal
): Promise<ExportArtifacts> {
  const requestInit: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  };

  const [pdfResponse, docxResponse] = await Promise.all([
    fetch("/api/download/pdf", requestInit),
    fetch("/api/download/docx", requestInit),
  ]);

  if (!pdfResponse.ok) {
    throw new Error(await toErrorMessage(pdfResponse));
  }
  if (!docxResponse.ok) {
    throw new Error(await toErrorMessage(docxResponse));
  }

  const [pdfBlob, docxBlob] = await Promise.all([
    pdfResponse.blob(),
    docxResponse.blob(),
  ]);

  const revision =
    pdfResponse.headers.get("x-export-revision") ??
    docxResponse.headers.get("x-export-revision") ??
    "";

  return {
    pdfBlob,
    docxBlob,
    revision,
    pageCount: parsePageCount(pdfResponse.headers.get("x-page-count")),
  };
}

export function useExportPreview({
  resume,
  sourceLayout,
  enabled,
  debounceMs = 650,
}: UseExportPreviewArgs): UseExportPreviewResult {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isPreviewStale, setIsPreviewStale] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const requestBody = useMemo(() => {
    if (!resume || !sourceLayout) return null;
    return JSON.stringify({ resume, sourceLayout });
  }, [resume, sourceLayout]);

  useEffect(() => {
    if (!enabled || !requestBody) {
      setIsGeneratingPreview(false);
      setIsPreviewStale(false);
      setPreviewError(null);
      setPdfBlob(null);
      setDocxBlob(null);
      setRevision(null);
      setPageCount(null);
      return;
    }

    setIsPreviewStale(true);
    setPreviewError(null);
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        setIsGeneratingPreview(true);
        const next = await fetchArtifacts(requestBody, controller.signal);
        if (requestVersionRef.current !== requestVersion) return;

        setPdfBlob(next.pdfBlob);
        setDocxBlob(next.docxBlob);
        setRevision(next.revision || null);
        setPageCount(next.pageCount);
        setPreviewError(null);
        setIsPreviewStale(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (requestVersionRef.current !== requestVersion) return;
        setPreviewError(
          error instanceof Error
            ? error.message
            : "Failed to refresh export preview."
        );
      } finally {
        if (requestVersionRef.current === requestVersion) {
          setIsGeneratingPreview(false);
        }
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [debounceMs, enabled, requestBody]);

  return useMemo(
    () => ({
      pdfBlob,
      docxBlob,
      revision,
      pageCount,
      isGeneratingPreview,
      isPreviewStale,
      previewError,
    }),
    [
      docxBlob,
      isGeneratingPreview,
      isPreviewStale,
      pageCount,
      pdfBlob,
      previewError,
      revision,
    ]
  );
}
