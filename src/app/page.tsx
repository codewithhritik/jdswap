"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ResumeForm } from "@/components/ResumeForm";
import { LoadingState } from "@/components/LoadingState";
import { ResumeEditor } from "@/components/ResumeEditor";
import { DownloadBar } from "@/components/DownloadBar";
import type {
  TailoredResume,
  LoadingProgress,
  SourceLayout,
  ParsedResume,
} from "@/lib/schema";

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

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [editedResume, setEditedResume] = useState<TailoredResume | null>(null);
  const [sourceLayout, setSourceLayout] = useState<SourceLayout | null>(null);
  const [progress, setProgress] = useState<LoadingProgress | null>(null);

  async function handleSubmit(file: File, jdText: string) {
    setState("loading");
    setError(null);
    setSourceLayout(null);
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
        setEditedResume(result.tailored);
        setSourceLayout(result.sourceLayout);
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
    setEditedResume(resume);
  }, []);

  useEffect(() => {
    if (state !== "editing") return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  async function handleDownloadPdf() {
    if (!editedResume) return;

    const response = await fetch("/api/download/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editedResume),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "PDF generation failed");
    }

    const blob = await response.blob();
    triggerDownload(blob, "tailored-resume.pdf");
  }

  async function handleDownloadDocx() {
    if (!editedResume || !sourceLayout) return;

    const response = await fetch("/api/download/docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: editedResume, sourceLayout }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "DOCX generation failed");
    }

    const blob = await response.blob();
    triggerDownload(blob, "tailored-resume.docx");
  }

  function handleReset() {
    if (!window.confirm("Discard your edits and start over?")) return;
    setEditedResume(null);
    setSourceLayout(null);
    setState("idle");
    setError(null);
  }

  return (
    <main id="main" className="min-h-screen scroll-mt-4 relative overflow-hidden">
      {/* Background radial glow */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(226, 148, 90, 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Dot grid background */}
      <div className="pointer-events-none fixed inset-0 dot-grid-bg" aria-hidden="true" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        {/* Hero header */}
        <motion.header
          className="mb-12 relative diagonal-accent"
          variants={heroStagger}
          initial="initial"
          animate="animate"
        >
          <motion.h1
            className="font-display italic text-5xl sm:text-6xl tracking-tight text-warm"
            variants={heroChild}
            style={{ textWrap: "balance" }}
          >
            JDSwap
          </motion.h1>
          <motion.p
            className="text-warm-muted mt-3 text-base sm:text-lg max-w-lg"
            variants={heroChild}
          >
            {state === "editing"
              ? "Review and edit your tailored resume, then download."
              : "Upload your resume and a job description. Tailored in seconds."}
          </motion.p>
        </motion.header>

        {error && (
          <motion.div
            role="alert"
            className="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-8"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-danger text-sm">{error}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div
              key="idle"
              {...stateTransition}
              transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <ResumeForm onSubmit={handleSubmit} />
            </motion.div>
          )}
          {state === "loading" && (
            <motion.div
              key="loading"
              {...stateTransition}
              transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <LoadingState progress={progress} />
            </motion.div>
          )}
          {state === "editing" && editedResume && (
            <motion.div
              key="editing"
              {...stateTransition}
              transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <ResumeEditor
                resume={editedResume}
                onChange={handleEditChange}
              />
              <DownloadBar
                onDownloadPdf={handleDownloadPdf}
                onDownloadDocx={handleDownloadDocx}
                onReset={handleReset}
              />
            </motion.div>
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
