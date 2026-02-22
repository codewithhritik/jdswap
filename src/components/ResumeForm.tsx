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
      className="rounded-2xl border border-surface-border/85 bg-surface/95 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.16)] sm:p-6"
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)] md:items-start">
        {/* Upload zone */}
        <motion.div variants={formChild} className="md:self-start">
          <label
            htmlFor="resume-file"
            className="block text-base font-medium text-warm"
          >
            Your Resume (.docx)
          </label>
          <p className="mt-1 text-sm text-warm-muted">
            Best results with a recent, well-structured resume.
          </p>

          {!file ? (
            <motion.label
              htmlFor="resume-file"
              className="group relative mt-3 flex min-h-[12.75rem] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-surface-border bg-base/30 p-4 text-center transition-colors duration-200 hover:border-accent/45 hover:bg-base/40 focus-within:border-accent/55"
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <div className="relative z-10 flex flex-col items-center">
                <svg
                  className="mb-2 h-7 w-7 text-warm-faint transition-colors duration-300 group-hover:text-accent"
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
                <span className="text-base text-warm-muted transition-colors duration-300 group-hover:text-warm">
                  Drop your .docx
                </span>
                <span className="mt-1 text-sm text-warm-faint">
                  or click to browse
                </span>
              </div>
            </motion.label>
          ) : (
            <div className="mt-3 flex min-h-[12.75rem] flex-col justify-between rounded-xl border border-surface-border bg-base/30 px-4 py-4">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-accent"
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-warm">{file.name}</p>
                  <p className="mt-1 font-mono text-sm text-warm-faint">
                    {(file.size / 1024).toFixed(1)}&nbsp;KB
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-surface-border/55 pt-3">
                <span className="text-sm text-warm-muted">Ready to tailor</span>
                <button
                  type="button"
                  onClick={handleClearFile}
                  aria-label="Remove file"
                  className="grid h-10 w-10 place-items-center rounded-md text-warm-faint transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <svg className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
            className="block text-base font-medium text-warm"
          >
            Job Description
          </label>
          <p className="mt-1 text-sm text-warm-muted">
            Paste responsibilities, required skills, and qualifications.
          </p>
          <div className="relative mt-3">
            <textarea
              id="jd"
              name="jobDescription"
              autoComplete="off"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description: responsibilities, required skills, and qualifications."
              className="min-h-[12.75rem] w-full resize-y rounded-xl border border-surface-border bg-base/30 px-4 py-3 pb-10 text-base leading-7 text-warm placeholder:text-warm-muted transition-colors duration-200 focus-visible:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              maxLength={15000}
            />
            <p
              className="pointer-events-none absolute bottom-3 right-3 font-mono text-sm text-warm-muted"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {jdText.length.toLocaleString()} / 15,000
            </p>
          </div>
        </motion.div>

        {/* Submit button -- inside the grid, spanning both columns */}
        <motion.div variants={formChild} className="col-span-1 md:col-span-2">
          <motion.button
            type="submit"
            disabled={isDisabled}
            className="min-h-12 w-full rounded-xl border border-transparent bg-accent px-6 text-base font-semibold text-[rgb(var(--color-accent-contrast))] shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:border-surface-border/80 disabled:bg-surface-hover disabled:text-warm-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
