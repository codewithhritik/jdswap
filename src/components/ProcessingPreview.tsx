"use client";

import { motion, AnimatePresence } from "motion/react";
import type { LoadingProgress, ProgressStep } from "@/lib/schema";

interface ProcessingPreviewProps {
  progress: LoadingProgress | null;
}

function phaseOf(step?: ProgressStep): number {
  switch (step) {
    case "extracting":
      return 0;
    case "parsing":
      return 1;
    case "parsed":
      return 2;
    case "tailoring":
    case "reviewing":
    case "revising":
    case "optimizing":
      return 3;
    case "complete":
      return 4;
    default:
      return 0;
  }
}

function Skel({ w, className = "" }: { w: string; className?: string }) {
  return (
    <div
      className={`h-2 rounded-full bg-warm-faint/12 animate-pulse ${className}`}
      style={{ width: w }}
    />
  );
}

function SectionDivider({
  label,
  visible,
}: {
  label: string;
  visible: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5 mt-4 first:mt-0">
      {visible ? (
        <motion.span
          className="text-[10px] font-semibold uppercase tracking-wider text-accent/60 shrink-0"
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
        >
          {label}
        </motion.span>
      ) : (
        <Skel w="52px" className="h-1.5 shrink-0" />
      )}
      <div className="flex-1 h-px bg-surface-border/40" />
    </div>
  );
}

function BulletLine({ glowing }: { glowing: boolean }) {
  const width = `${72 + Math.random() * 20}%`;
  return (
    <div className="flex items-start gap-1.5 mb-1">
      <div className="w-1 h-1 rounded-full bg-warm-faint/20 mt-[3px] shrink-0" />
      <Skel
        w={width}
        className={`h-[5px] ${glowing ? "!bg-accent/10" : ""}`}
      />
    </div>
  );
}

export function ProcessingPreview({ progress }: ProcessingPreviewProps) {
  const phase = phaseOf(progress?.step);
  const hasSections = phase >= 2;
  const isTailoring = phase >= 3;
  const isComplete = phase >= 4;

  const roleCount = Math.min(progress?.roles ?? 2, 3);
  const keywords = progress?.keywords ?? [];

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      {/* Document card */}
      <div className="relative bg-surface-elevated/80 border border-surface-border/60 rounded-xl p-5 sm:p-6 overflow-hidden">
        {/* Scanning sweep during parsing */}
        <AnimatePresence>
          {phase === 1 && (
            <motion.div
              className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent"
              initial={{ top: 0, opacity: 0 }}
              animate={{ top: "100%", opacity: 1 }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                ease: "linear",
              }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Soft glow during tailoring */}
        {isTailoring && !isComplete && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 40%, rgba(226, 148, 90, 0.04) 0%, transparent 70%)",
            }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* ── Header area ── */}
        <div className="mb-1">
          <Skel w="42%" className="h-3 mb-2" />
          <div className="flex gap-2 flex-wrap">
            <Skel w="20%" className="h-[5px]" />
            <Skel w="16%" className="h-[5px]" />
            <Skel w="14%" className="h-[5px]" />
          </div>
        </div>

        {/* ── Skills ── */}
        <SectionDivider label="Skills" visible={hasSections} />
        <div className="mb-1">
          {isTailoring && keywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 items-center">
              {keywords.map((kw, i) => (
                <motion.span
                  key={kw}
                  className="px-2 py-0.5 text-[10px] bg-accent/10 text-accent border border-accent/20 rounded-full leading-none"
                  initial={{ opacity: 0, scale: 0.6, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    delay: i * 0.07,
                    type: "spring",
                    stiffness: 320,
                    damping: 18,
                  }}
                >
                  {kw}
                </motion.span>
              ))}
              <Skel w="20%" className="h-[5px]" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Skel w="88%" className="h-[5px]" />
              <Skel w="62%" className="h-[5px]" />
            </div>
          )}
        </div>

        {/* ── Experience ── */}
        <SectionDivider label="Experience" visible={hasSections} />
        {Array.from({ length: roleCount }).map((_, i) => (
          <div key={i} className="mb-3.5 last:mb-1">
            <div className="flex items-center justify-between mb-1">
              <Skel w={`${32 + i * 6}%`} className="h-2" />
              <Skel w="17%" className="h-[5px]" />
            </div>
            <Skel w="26%" className="h-[5px] mb-1.5" />
            <BulletLine glowing={isTailoring && !isComplete} />
            <BulletLine glowing={isTailoring && !isComplete} />
            <BulletLine glowing={isTailoring && !isComplete} />
          </div>
        ))}

        {/* ── Education ── */}
        <SectionDivider label="Education" visible={hasSections} />
        <div className="flex items-center justify-between mb-1">
          <Skel w="48%" className="h-2" />
          <Skel w="14%" className="h-[5px]" />
        </div>
        <Skel w="36%" className="h-[5px]" />

        {/* ── Complete overlay ── */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-surface-elevated/70 backdrop-blur-[2px] rounded-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <motion.svg
                className="w-10 h-10 text-success"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 14,
                }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </motion.svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating stats badge */}
      <AnimatePresence>
        {hasSections && !isComplete && (
          <motion.div
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-surface border border-accent/20 rounded-full px-3.5 py-1 shadow-lg shadow-black/30"
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            <span className="text-[11px] text-warm-muted whitespace-nowrap">
              Found{" "}
              <span className="text-accent font-medium">
                {progress?.roles}
              </span>{" "}
              role{(progress?.roles ?? 0) !== 1 ? "s" : ""}
              {" · "}
              <span className="text-accent font-medium">
                {progress?.skills}
              </span>{" "}
              skills
              {(progress?.education ?? 0) > 0 && (
                <>
                  {" · "}
                  <span className="text-accent font-medium">
                    {progress?.education}
                  </span>{" "}
                  degree{(progress?.education ?? 0) !== 1 ? "s" : ""}
                </>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
