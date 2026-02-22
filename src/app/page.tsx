"use client";

import { useState, useCallback, useEffect, useReducer } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ResumeForm } from "@/components/ResumeForm";
import { LoadingState } from "@/components/LoadingState";
import { ResumeWorkspace } from "@/components/ResumeWorkspace";
import { DownloadBar } from "@/components/DownloadBar";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LandingTrustStrip, type LandingTrustItem } from "@/components/LandingTrustStrip";
import { HowItWorks, type LandingStep } from "@/components/HowItWorks";
import type {
  TailoredResume,
  LoadingProgress,
  SourceLayout,
  ParsedResume,
} from "@/lib/schema";
import { editorReducer, type EditorState } from "@/lib/editor-state";
import { useExportPreview } from "@/lib/use-export-preview";

type AppState = "idle" | "loading" | "editing";

const stateTransition = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const heroStagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const heroChild = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] as const } },
};

const trustItems: LandingTrustItem[] = [
  { title: "No sign-up required" },
  { title: "You keep full editing control" },
  { title: "Export to PDF and DOCX" },
];

const howItWorksSteps: LandingStep[] = [
  { title: "Upload Resume", detail: "Start with your current .docx resume file." },
  { title: "Paste Job Description", detail: "Include responsibilities, requirements, and skills." },
  { title: "Edit and Export", detail: "Review the tailored draft, then export in your preferred format." },
];

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LoadingProgress | null>(null);
  const [editorState, dispatchEditor] = useReducer(
    editorReducer,
    null,
    () =>
      ({
        resume: null,
        sourceLayout: null,
      }) satisfies EditorState
  );
  const exportPreview = useExportPreview({
    resume: editorState.resume,
    sourceLayout: editorState.sourceLayout,
    enabled: state === "editing",
  });

  async function handleSubmit(file: File, jdText: string) {
    setState("loading");
    setError(null);
    setDownloadError(null);
    dispatchEditor({
      type: "BULK_REPLACE",
      payload: { resume: null, sourceLayout: null },
    });
    setProgress(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jdText", jdText);

      const response = await fetch("/api/tailor", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Request failed");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result:
        | { parsed: ParsedResume; tailored: TailoredResume; sourceLayout: SourceLayout }
        | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;

          let eventName = "";
          let eventData = "";
          for (const line of trimmed.split("\n")) {
            if (line.startsWith("event: ")) eventName = line.slice(7);
            else if (line.startsWith("data: ")) eventData = line.slice(6);
          }

          if (!eventName || !eventData) continue;

          if (eventName === "progress") {
            const data = JSON.parse(eventData) as Partial<LoadingProgress>;
            setProgress((prev) =>
              prev ? ({ ...prev, ...data } as LoadingProgress) : (data as LoadingProgress),
            );
          } else if (eventName === "result") {
            result = JSON.parse(eventData);
          } else if (eventName === "error") {
            throw new Error(
              (JSON.parse(eventData) as { message: string }).message,
            );
          }
        }
      }

      if (result) {
        dispatchEditor({
          type: "BULK_REPLACE",
          payload: { resume: result.tailored, sourceLayout: result.sourceLayout },
        });
        setState("editing");
      } else {
        throw new Error("No result received from server");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Check your file and try again.");
      setState("idle");
    }
  }

  const handleEditChange = useCallback((resume: TailoredResume) => {
    setDownloadError(null);
    dispatchEditor({ type: "FORM_PATCH", payload: { resume } });
  }, []);

  useEffect(() => {
    if (state !== "editing") return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  async function fetchExportBlob(path: "/api/download/pdf" | "/api/download/docx") {
    if (!editorState.resume || !editorState.sourceLayout) return null;

    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: editorState.resume,
        sourceLayout: editorState.sourceLayout,
      }),
    });

    if (!response.ok) {
      const errData = (await response.json()) as { error?: string };
      throw new Error(errData.error || "Export failed.");
    }

    return response.blob();
  }

  async function handleDownloadPdf() {
    if (!editorState.resume || !editorState.sourceLayout) return;
    setDownloadError(null);

    try {
      if (exportPreview.isGeneratingPreview || exportPreview.isPreviewStale) {
        setDownloadError("Preview is still syncing. Wait for it to finish before exporting.");
        return;
      }

      if (exportPreview.pdfBlob) {
        triggerDownload(exportPreview.pdfBlob, "tailored-resume.pdf");
        return;
      }

      const blob = await fetchExportBlob("/api/download/pdf");
      if (!blob) return;
      triggerDownload(blob, "tailored-resume.pdf");
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : "Failed to generate PDF. Please try again."
      );
    }
  }

  async function handleDownloadDocx() {
    if (!editorState.resume || !editorState.sourceLayout) return;
    setDownloadError(null);

    try {
      if (exportPreview.isGeneratingPreview || exportPreview.isPreviewStale) {
        setDownloadError("Preview is still syncing. Wait for it to finish before exporting.");
        return;
      }

      if (exportPreview.docxBlob) {
        triggerDownload(exportPreview.docxBlob, "tailored-resume.docx");
        return;
      }

      const blob = await fetchExportBlob("/api/download/docx");
      if (!blob) return;
      triggerDownload(blob, "tailored-resume.docx");
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : "Failed to generate DOCX. Please try again."
      );
    }
  }

  function handleReset() {
    if (!window.confirm("Discard your edits and start over?")) return;
    dispatchEditor({
      type: "BULK_REPLACE",
      payload: { resume: null, sourceLayout: null },
    });
    setState("idle");
    setError(null);
    setDownloadError(null);
  }

  return (
    <main id="main" className="min-h-screen scroll-mt-4 relative overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
        style={{
          background: "radial-gradient(ellipse 75% 42% at 50% -5%, rgb(var(--color-accent) / 0.09) 0%, transparent 72%)",
        }}
      />
      <div className="pointer-events-none fixed inset-0 dot-grid-bg" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-7 sm:px-6 sm:pb-20 sm:pt-10">
        <motion.div
          className="flex items-center justify-between gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <div className="flex items-center gap-3">
            <p className="font-display text-4xl italic tracking-tight text-warm sm:text-5xl">
              JDSwap
            </p>
            <span className="hidden rounded-full border border-surface-border bg-surface/75 px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.12em] text-warm-muted sm:inline-flex">
              ATS-ready
            </span>
          </div>
          <ThemeSwitcher />
        </motion.div>

        {error && (
          <motion.div
            role="alert"
            className="mt-6 rounded-xl border border-danger/20 bg-danger/10 p-4"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm text-danger">{error}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.section
              key="idle"
              className="mt-8 sm:mt-10"
              {...stateTransition}
              transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <motion.header
                className="max-w-[52rem]"
                variants={heroStagger}
                initial="initial"
                animate="animate"
              >
                <motion.h1
                  className="font-display text-4xl italic tracking-tight text-warm sm:text-6xl"
                  variants={heroChild}
                  style={{ textWrap: "balance" }}
                >
                  Tailor your resume to each job in under a minute
                </motion.h1>
                <motion.p
                  className="mt-4 max-w-[62ch] text-base leading-7 text-warm-muted sm:text-lg"
                  variants={heroChild}
                >
                  Upload your .docx, paste the job description, and get an ATS-ready draft you can edit before export.
                </motion.p>
              </motion.header>

              <LandingTrustStrip items={trustItems} />

              <motion.div
                className="mt-5"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.35 }}
              >
                <ResumeForm onSubmit={handleSubmit} />
              </motion.div>

              <HowItWorks steps={howItWorksSteps} />
            </motion.section>
          )}
          {state === "loading" && (
            <motion.section
              key="loading"
              className="mt-8 sm:mt-10"
              {...stateTransition}
              transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <header className="mb-6 max-w-2xl">
                <h1 className="font-display text-3xl italic tracking-tight text-warm sm:text-4xl">
                  Building your tailored draft
                </h1>
                <p className="mt-3 text-base leading-7 text-warm-muted">
                  Keep this tab open while we align your resume to the job description.
                </p>
              </header>
              <LoadingState progress={progress} />
            </motion.section>
          )}
          {state === "editing" && editorState.resume && editorState.sourceLayout && (
            <motion.section
              key="editing"
              className="mt-8 sm:mt-10"
              {...stateTransition}
              transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <header className="mb-6 max-w-2xl">
                <h1 className="font-display text-3xl italic tracking-tight text-warm sm:text-4xl">
                  Your tailored draft is ready
                </h1>
                <p className="mt-3 text-base leading-7 text-warm-muted">
                  Edit from the form. Preview renders the exact DOCX/PDF artifacts used for export.
                </p>
              </header>
              <ResumeWorkspace
                resume={editorState.resume}
                onFormChange={handleEditChange}
                pdfBlob={exportPreview.pdfBlob}
                docxBlob={exportPreview.docxBlob}
                previewRevision={exportPreview.revision}
                previewPageCount={exportPreview.pageCount}
                isGeneratingPreview={exportPreview.isGeneratingPreview}
                isPreviewStale={exportPreview.isPreviewStale}
                previewError={exportPreview.previewError}
                downloadError={downloadError}
              />
              <DownloadBar
                onDownloadPdf={handleDownloadPdf}
                onDownloadDocx={handleDownloadDocx}
                onReset={handleReset}
                exportsReady={
                  !exportPreview.isGeneratingPreview &&
                  !exportPreview.isPreviewStale &&
                  Boolean(exportPreview.pdfBlob && exportPreview.docxBlob)
                }
                statusText={
                  exportPreview.isGeneratingPreview || exportPreview.isPreviewStale
                    ? "Syncing preview artifacts..."
                    : exportPreview.revision
                      ? `Preview synced · rev ${exportPreview.revision.slice(0, 8)}`
                      : "Waiting for preview artifacts..."
                }
              />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
