"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ProcessingPreview } from "./ProcessingPreview";
import type { LoadingProgress, ProgressStep } from "@/lib/schema";

interface LoadingStateProps {
  progress: LoadingProgress | null;
}

interface StepDef {
  key: string;
  label: string;
}

const BASE_STEPS: StepDef[] = [
  { key: "extracting", label: "Reading your document\u2026" },
  { key: "parsing", label: "Parsing resume structure\u2026" },
  { key: "parsed", label: "Analyzing job requirements\u2026" },
  { key: "tailoring", label: "Rewriting with JD keywords\u2026" },
  { key: "reviewing", label: "Reviewing JD alignment\u2026" },
  { key: "optimizing", label: "Optimizing for one page\u2026" },
];

const REVISION_STEP: StepDef = {
  key: "revising",
  label: "Revising based on feedback\u2026",
};

function stepIndex(steps: StepDef[], stepKey: ProgressStep): number {
  const idx = steps.findIndex((s) => s.key === stepKey);
  if (idx !== -1) return idx;
  // "complete" is past the last step
  if (stepKey === "complete") return steps.length;
  return 0;
}

const dotVariants = {
  initial: { scale: 0.6, opacity: 0.3 },
  animate: { scale: 1, opacity: 1 },
};

export function LoadingState({ progress }: LoadingStateProps) {
  const [hasRevision, setHasRevision] = useState(false);
  const [showReassurance, setShowReassurance] = useState(false);

  // Detect when the revising step is reported
  useEffect(() => {
    if (progress?.step === "revising") {
      setHasRevision(true);
    }
  }, [progress?.step]);

  const steps = useMemo(() => {
    if (!hasRevision) return BASE_STEPS;
    // Insert the revision step before "optimizing" (last item)
    const optimizingIdx = BASE_STEPS.findIndex((s) => s.key === "optimizing");
    const withRevision = [...BASE_STEPS];
    withRevision.splice(optimizingIdx, 0, REVISION_STEP);
    return withRevision;
  }, [hasRevision]);

  const currentStep = stepIndex(steps, progress?.step ?? "extracting");

  // Show reassurance after 8s on the tailoring step
  useEffect(() => {
    if (progress?.step !== "tailoring") {
      setShowReassurance(false);
      return;
    }
    const timer = setTimeout(() => setShowReassurance(true), 8000);
    return () => clearTimeout(timer);
  }, [progress?.step]);

  return (
    <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 py-8 sm:py-12">
      {/* Off-center decorative circle — visible only when preview is hidden */}
      <div
        className="absolute -right-20 top-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full pointer-events-none lg:hidden"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle, rgba(226, 148, 90, 0.05) 0%, transparent 70%)",
        }}
      />

      {/* ── Left: Progress timeline ── */}
      <div className="w-full" role="status" aria-label="Processing">
        {/* Bouncing dots */}
        <div className="flex gap-1.5 mb-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-accent"
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

        {/* Timeline */}
        <div className="relative pl-6" aria-live="polite">
          <div
            className="absolute left-[3px] top-1 bottom-1 w-px bg-gradient-to-b from-accent/20 via-accent/10 to-transparent"
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
                    {/* Timeline node */}
                    <div className="absolute -left-6 top-1">
                      <AnimatePresence mode="wait">
                        {isDone ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0, rotate: -90 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 20,
                            }}
                          >
                            <svg
                              className="w-[7px] h-[7px] text-success"
                              viewBox="0 0 12 12"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <circle cx="6" cy="6" r="6" />
                            </svg>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="dot"
                            className={`w-[7px] h-[7px] rounded-full ${
                              isActive
                                ? "bg-accent animate-glow-pulse"
                                : "bg-surface-border"
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

                      {/* Review score badge */}
                      {step.key === "reviewing" &&
                        isDone &&
                        progress?.reviewScore != null && (
                          <motion.span
                            className={`text-xs font-medium px-1.5 py-0.5 rounded-full leading-none ${
                              progress.reviewApproved
                                ? "bg-success/15 text-success"
                                : "bg-accent/15 text-accent"
                            }`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 20,
                            }}
                          >
                            Score: {progress.reviewScore}/100
                          </motion.span>
                        )}
                    </div>

                    {/* Reassurance for the long tailoring step */}
                    <AnimatePresence>
                      {isActive &&
                        step.key === "tailoring" &&
                        showReassurance && (
                          <motion.p
                            className="text-xs text-warm-faint mt-1"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            AI is rewriting your bullets — this is the longest
                            step
                          </motion.p>
                        )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Right: Document preview (lg+ only) ── */}
      <div className="hidden lg:block">
        <ProcessingPreview progress={progress} />
      </div>
    </div>
  );
}
