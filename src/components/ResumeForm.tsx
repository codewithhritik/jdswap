"use client";

import { useState, useRef } from "react";
import { motion } from "motion/react";

interface ResumeFormProps {
  onSubmit: (file: File, jdText: string) => void;
}

const formStagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const formChild = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.4, 0.25, 1] as const } },
};

export function ResumeForm({ onSubmit }: ResumeFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
  }

  function handleClearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !jdText.trim()) return;
    onSubmit(file, jdText.trim());
  }

  const isDisabled = !file || !jdText.trim();

  return (
    <motion.form
      onSubmit={handleSubmit}
      variants={formStagger}
      initial="initial"
      animate="animate"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_3fr] gap-x-5 gap-y-5">
        {/* Upload zone */}
        <motion.div variants={formChild} className="sm:self-start">
          <label
            htmlFor="resume-file"
            className="block text-sm font-medium text-warm-muted mb-2"
          >
            Your Resume
          </label>

          {!file ? (
            <motion.label
              htmlFor="resume-file"
              className="relative flex flex-col items-center justify-center w-full min-h-[10rem] cursor-pointer rounded-xl overflow-hidden group"
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {/* Gradient border effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/20 via-surface-border to-accent/10" />
              <div className="absolute inset-[1px] rounded-xl bg-surface" />
              <div className="relative z-10 flex flex-col items-center">
                <svg
                  className="w-7 h-7 text-warm-faint group-hover:text-accent transition-colors duration-300 mb-2"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 16V4m0 0l-4 4m4-4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"
                  />
                </svg>
                <span className="text-sm text-warm-muted group-hover:text-warm transition-colors duration-300">
                  Drop your .docx
                </span>
                <span className="text-xs text-warm-faint mt-1">
                  or click to browse
                </span>
              </div>
            </motion.label>
          ) : (
            <div className="flex items-center gap-3 bg-surface border border-surface-border rounded-xl px-4 py-3">
              <svg
                className="w-5 h-5 text-accent shrink-0"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-warm truncate">{file.name}</p>
                <p className="text-xs text-warm-faint font-mono">
                  {(file.size / 1024).toFixed(1)}&nbsp;KB
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearFile}
                aria-label="Remove file"
                className="text-warm-faint hover:text-danger transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            id="resume-file"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="hidden"
          />
        </motion.div>

        {/* Job Description textarea */}
        <motion.div variants={formChild}>
          <label
            htmlFor="jd"
            className="block text-sm font-medium text-warm-muted mb-2"
          >
            Job Description
          </label>
          <div className="relative">
            <textarea
              id="jd"
              name="jobDescription"
              autoComplete="off"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here — role title, responsibilities, qualifications, preferred skills..."
              className="w-full min-h-[10rem] bg-surface border border-surface-border rounded-xl px-4 py-3 pb-8 text-warm placeholder-warm-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent resize-y text-sm leading-relaxed transition-shadow duration-200"
              maxLength={15000}
            />
            <p className="absolute bottom-2.5 right-3 text-xs text-warm-faint font-mono pointer-events-none" style={{ fontVariantNumeric: "tabular-nums" }}>
              {jdText.length.toLocaleString()} / 15,000
            </p>
          </div>
        </motion.div>

        {/* Submit button -- inside the grid, spanning both columns */}
        <motion.div variants={formChild} className="col-span-1 sm:col-span-2 pt-1">
          <motion.button
            type="submit"
            disabled={isDisabled}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-accent to-accent-hover disabled:from-surface-border disabled:to-surface-border disabled:text-warm-faint text-white text-base font-semibold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base shadow-lg shadow-accent/10 disabled:shadow-none"
            whileHover={isDisabled ? undefined : { y: -1 }}
            whileTap={isDisabled ? undefined : { scale: 0.985 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            Tailor My Resume
          </motion.button>
        </motion.div>
      </div>
    </motion.form>
  );
}
