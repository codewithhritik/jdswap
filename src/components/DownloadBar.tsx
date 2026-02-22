"use client";

import { useState } from "react";
import { motion } from "motion/react";

interface DownloadBarProps {
  onDownloadPdf: () => Promise<void>;
  onDownloadDocx: () => Promise<void>;
  onReset: () => void;
}

export function DownloadBar({
  onDownloadPdf,
  onDownloadDocx,
  onReset,
}: DownloadBarProps) {
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);

  async function handleDownload(type: "pdf" | "docx") {
    setDownloading(type);
    try {
      if (type === "pdf") {
        await onDownloadPdf();
      } else {
        await onDownloadDocx();
      }
    } finally {
      setDownloading(null);
    }
  }

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
    >
      <div
        className="bg-surface/95 backdrop-blur-xl border-t border-white/[0.04] shadow-[0_-4px_24px_rgba(0,0,0,0.3)]"
        style={{ overscrollBehaviorY: "contain" }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <button
            onClick={onReset}
            className="text-sm text-warm-faint hover:text-warm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            Start Over
          </button>
          <div className="flex-1" />
          <motion.button
            onClick={() => handleDownload("docx")}
            disabled={downloading !== null}
            className="px-5 py-2 text-sm font-medium bg-surface-hover hover:bg-surface-elevated disabled:opacity-50 text-warm rounded-lg transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface border border-surface-border"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            {downloading === "docx" ? (
              <Spinner />
            ) : (
              <DocxIcon />
            )}
            Download DOCX
          </motion.button>
          <motion.button
            onClick={() => handleDownload("pdf")}
            disabled={downloading !== null}
            className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-accent to-accent-hover disabled:opacity-50 text-white rounded-lg transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface shadow-lg shadow-accent/15"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            {downloading === "pdf" ? (
              <Spinner />
            ) : (
              <PdfIcon />
            )}
            Download PDF
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20v-8H7v8" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12h10" />
    </svg>
  );
}

function DocxIcon() {
  return (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
