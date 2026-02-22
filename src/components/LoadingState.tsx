"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LoadingProgress, ProgressStep } from "@/lib/schema";

interface LoadingStateProps {
  progress: LoadingProgress | null;
}

interface StepDef {
  key: string;
  label: string;
}

const BASE_STEPS: StepDef[] = [
  { key: "extracting", label: "Reading your document…" },
  { key: "parsing", label: "Parsing resume structure…" },
  { key: "parsed", label: "Analyzing job requirements…" },
  { key: "requirements_extracted", label: "Mapping JD requirements to roles…" },
  { key: "tailoring", label: "Rewriting with JD keywords…" },
  { key: "reviewing", label: "Reviewing JD alignment…" },
  { key: "scoring", label: "Scoring coverage and credibility…" },
  { key: "optimizing", label: "Finalizing export layout…" },
];

const REVISION_STEP: StepDef = {
  key: "revising",
  label: "Revising based on feedback…",
};

function stepIndex(steps: StepDef[], stepKey?: ProgressStep): number {
  if (!stepKey) return 0;

  const canonicalStep: ProgressStep =
    stepKey === "tailoring_role" ||
    stepKey === "validating_role" ||
    stepKey === "retrying_role"
      ? "tailoring"
      : stepKey;

  const idx = steps.findIndex((s) => s.key === canonicalStep);
  if (idx !== -1) return idx;
  if (canonicalStep === "complete") return steps.length;
  return 0;
}

function getStageHint(progress: LoadingProgress | null, showReassurance: boolean): string | null {
  if (!progress?.step) return "Preparing processing pipeline…";

  switch (progress.step) {
    case "extracting":
      return "Reading uploaded file and preparing plain text.";
    case "parsing":
      return "Detecting resume sections and formatting structure.";
    case "parsed":
      return "Extracting role, skill, and education signals from your resume.";
    case "requirements_extracted":
      return "Job requirements extracted and ready for alignment.";
    case "tailoring":
      return showReassurance
        ? "AI is rewriting your bullets. This is usually the longest step."
        : "Rewriting bullets to match job language while preserving factual accuracy.";
    case "tailoring_role":
      return "Tailoring bullets for the active role.";
    case "validating_role":
      return "Validating role bullets for specificity and credibility.";
    case "retrying_role":
      return "Retrying role rewrite with tighter constraints.";
    case "reviewing":
      return "Running final quality review against extracted requirements.";
    case "revising":
      return "Applying review feedback to improve alignment.";
    case "scoring":
      return "Computing coverage, credibility, and visibility scores.";
    case "optimizing":
      return "Preparing final DOCX/PDF output layout.";
    case "complete":
      return "Draft assembled. Opening the editor next.";
    default:
      return null;
  }
}

const dotVariants = {
  initial: { scale: 0.6, opacity: 0.3 },
  animate: { scale: 1, opacity: 1 },
};

export function LoadingState({ progress }: LoadingStateProps) {
  const [hasRevision, setHasRevision] = useState(false);
  const [showReassurance, setShowReassurance] = useState(false);

  useEffect(() => {
    if (progress?.step === "revising") {
      setHasRevision(true);
    }
  }, [progress?.step]);

  const steps = useMemo(() => {
    if (!hasRevision) return BASE_STEPS;
    const optimizingIdx = BASE_STEPS.findIndex((s) => s.key === "optimizing");
    const withRevision = [...BASE_STEPS];
    withRevision.splice(optimizingIdx, 0, REVISION_STEP);
    return withRevision;
  }, [hasRevision]);

  const currentStep = stepIndex(steps, progress?.step);

  useEffect(() => {
    if (progress?.step !== "tailoring") {
      setShowReassurance(false);
      return;
    }

    const timer = setTimeout(() => setShowReassurance(true), 8000);
    return () => clearTimeout(timer);
  }, [progress?.step]);

  const activeRoleLabel =
    progress?.rolesTotal != null && progress.roleIndex != null
      ? `Role ${progress.roleIndex + 1} of ${progress.rolesTotal}`
      : null;

  const summaryItems = [
    progress?.roles != null ? { label: "Roles", value: progress.roles } : null,
    progress?.skills != null ? { label: "Skills", value: progress.skills } : null,
    progress?.education != null ? { label: "Education", value: progress.education } : null,
    progress?.keywords?.length ? { label: "Keywords", value: progress.keywords.length } : null,
  ].filter((item): item is { label: string; value: number } => item !== null);

  const hint = getStageHint(progress, showReassurance);

  return (
    <div
      className="relative rounded-2xl border border-surface-border/80 bg-surface/70 px-5 py-6 shadow-[0_12px_34px_rgba(0,0,0,0.12)] sm:px-7 sm:py-8"
      role="status"
      aria-label="Processing"
    >
      <div className="mb-7 flex items-center justify-between gap-5">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-accent"
              variants={dotVariants}
              animate="animate"
              initial="initial"
              transition={{
                repeat: Infinity,
                repeatType: "reverse",
                duration: 0.5,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        {activeRoleLabel && (
          <p className="text-xs font-mono uppercase tracking-[0.12em] text-warm-muted">{activeRoleLabel}</p>
        )}
      </div>

      <div className="relative pl-6" aria-live="polite">
        <div
          className="absolute bottom-1 left-[3px] top-1 w-px bg-gradient-to-b from-accent/20 via-accent/10 to-transparent"
          aria-hidden="true"
        />

        <div className="space-y-5">
          <AnimatePresence initial={false}>
            {steps.map((step, i) => {
              const isDone = i < currentStep;
              const isActive = i === currentStep;

              return (
                <motion.div
                  key={step.key}
                  className="relative flex items-start gap-3"
                  initial={{ opacity: 0, height: 0, x: -16 }}
                  animate={
                    isDone || isActive
                      ? { opacity: 1, height: "auto", x: 0 }
                      : { opacity: 0.3, height: "auto", x: 0 }
                  }
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: isDone || isActive ? i * 0.08 : 0,
                    ease: [0.25, 0.4, 0.25, 1] as const,
                  }}
                  aria-current={isActive ? "step" : undefined}
                >
                  <div className="absolute -left-6 top-1">
                    <AnimatePresence mode="wait">
                      {isDone ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <svg className="h-[7px] w-[7px] text-success" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <circle cx="6" cy="6" r="6" />
                          </svg>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="dot"
                          className={`h-[7px] w-[7px] rounded-full ${
                            isActive ? "animate-glow-pulse bg-accent" : "bg-surface-border"
                          }`}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm transition-colors duration-300 ${
                        isDone
                          ? "text-warm-faint line-through decoration-warm-faint/30"
                          : isActive
                            ? "text-warm"
                            : "text-warm-faint"
                      }`}
                    >
                      {step.label}
                    </span>

                    {step.key === "reviewing" && isDone && progress?.reviewScore != null && (
                      <motion.span
                        className={`rounded-full px-1.5 py-0.5 text-xs font-medium leading-none ${
                          progress.reviewApproved ? "bg-success/15 text-success" : "bg-accent/15 text-accent"
                        }`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        Score: {progress.reviewScore}/100
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {summaryItems.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2.5">
          {summaryItems.map((item) => (
            <span
              key={item.label}
              className="rounded-full border border-surface-border/70 bg-base/35 px-3 py-1.5 text-xs text-warm-muted"
            >
              <span className="mr-1 text-warm">{item.value}</span>
              {item.label}
            </span>
          ))}
        </div>
      )}

      {hint && (
        <div className="mt-4 rounded-xl border border-surface-border/70 bg-base/30 px-3 py-2 text-sm text-warm-muted">
          {hint}
        </div>
      )}

      {progress?.missingTerms?.length ? (
        <p className="mt-3 text-xs text-warm-faint">
          Tracking {progress.missingTerms.length} uncovered term
          {progress.missingTerms.length === 1 ? "" : "s"} for better coverage.
        </p>
      ) : null}
    </div>
  );
}
