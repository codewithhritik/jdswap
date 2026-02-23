"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { motion } from "motion/react";
import type {
  ParsedResume,
  RewriteIntent,
  RewriteResponse,
  RewriteTarget,
  TailoredResume,
} from "@/lib/schema";
import {
  buildPresetNote,
  computeTargetFingerprint,
  REWRITE_FEEDBACK_PRESETS,
} from "@/lib/rewrite-feedback";
import { formatSkillsForEditor, parseSkillsEditorInput } from "@/lib/skills";
import { RewriteAssistantOverlay } from "@/components/RewriteAssistantOverlay";
import { RewritePanel } from "@/components/RewritePanel";
import { RewriteSuggestionCard } from "@/components/RewriteSuggestionCard";

interface ResumeEditorProps {
  resume: TailoredResume;
  parsed: ParsedResume | null;
  jdText: string | null;
  onChange: (resume: TailoredResume) => void;
  onApplyRewrite: (target: RewriteTarget, bullets: Array<{ text: string }>) => void;
}

interface RewriteSession {
  target: RewriteTarget;
  targetLabel: string;
  targetFingerprint: string;
  originalBullets: Array<{ text: string }>;
}

interface RewriteDraft {
  intents: RewriteIntent[];
  note: string;
  requestedTechnology: string;
  presetNote: string;
}

interface RewriteSuggestionState {
  session: RewriteSession;
  response: RewriteResponse;
}

interface RewriteAnchorMeta {
  scrollX: number;
  scrollY: number;
}

const DEFAULT_INTENTS: RewriteIntent[] = ["give_me_something_else"];

const sectionStagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
};

const sectionChild = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] as const } },
};

function createDefaultRewriteDraft(): RewriteDraft {
  const presetNote = buildPresetNote(DEFAULT_INTENTS);
  return {
    intents: [...DEFAULT_INTENTS],
    note: presetNote,
    requestedTechnology: "",
    presetNote,
  };
}

function mergeNoteWithPreset(currentNote: string, previousPreset: string, nextPreset: string): string {
  const normalizedCurrent = currentNote.trim();
  const normalizedPrevious = previousPreset.trim();

  if (!normalizedCurrent) return nextPreset;
  if (!normalizedPrevious) {
    return [nextPreset, normalizedCurrent].filter(Boolean).join(" ").trim();
  }
  if (normalizedCurrent.startsWith(normalizedPrevious)) {
    const customSuffix = normalizedCurrent.slice(normalizedPrevious.length).trim();
    return [nextPreset, customSuffix].filter(Boolean).join(" ").trim();
  }
  return [nextPreset, normalizedCurrent].filter(Boolean).join(" ").trim();
}

export function ResumeEditor({
  resume,
  parsed,
  jdText,
  onChange,
  onApplyRewrite,
}: ResumeEditorProps) {
  const update = useCallback(
    (patch: Partial<TailoredResume>) => onChange({ ...resume, ...patch }),
    [resume, onChange]
  );

  const canRewrite = Boolean(parsed && jdText);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteSession, setRewriteSession] = useState<RewriteSession | null>(null);
  const [rewriteDraft, setRewriteDraft] = useState<RewriteDraft>(() => createDefaultRewriteDraft());
  const [rewriteSuggestion, setRewriteSuggestion] = useState<RewriteSuggestionState | null>(null);
  const [rewriteAnchorRect, setRewriteAnchorRect] = useState<DOMRect | null>(null);
  const [rewriteAnchorMeta, setRewriteAnchorMeta] = useState<RewriteAnchorMeta | null>(null);
  const [rewriteAnchorElement, setRewriteAnchorElement] = useState<HTMLElement | null>(null);

  const syncAnchorFromElement = useCallback((element: HTMLElement | null) => {
    if (!element) return;

    const nextRect = element.getBoundingClientRect();
    setRewriteAnchorRect((previous) => {
      if (
        previous &&
        previous.top === nextRect.top &&
        previous.left === nextRect.left &&
        previous.width === nextRect.width &&
        previous.height === nextRect.height &&
        previous.right === nextRect.right &&
        previous.bottom === nextRect.bottom
      ) {
        return previous;
      }
      return nextRect;
    });
    setRewriteAnchorMeta({ scrollX: window.scrollX, scrollY: window.scrollY });
  }, []);

  const resetRewriteFlow = useCallback(() => {
    const focusTarget = rewriteAnchorElement;

    setRewriteSession(null);
    setRewriteDraft(createDefaultRewriteDraft());
    setRewriteSuggestion(null);
    setRewriteError(null);
    setRewriteAnchorRect(null);
    setRewriteAnchorMeta(null);
    setRewriteAnchorElement(null);

    if (focusTarget) {
      window.requestAnimationFrame(() => {
        if (focusTarget.isConnected) {
          focusTarget.focus();
        }
      });
    }
  }, [rewriteAnchorElement]);

  useEffect(() => {
    if (!rewriteSession || !rewriteAnchorElement) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!rewriteAnchorElement.isConnected) return;
        syncAnchorFromElement(rewriteAnchorElement);
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [rewriteAnchorElement, rewriteSession, syncAnchorFromElement]);

  const openRewriteTarget = useCallback(
    (
      target: RewriteTarget,
      targetLabel: string,
      bullets: Array<{ text: string }>,
      anchorElement: HTMLElement
    ) => {
      if (!canRewrite) {
        setRewriteError("Rewrite tools are available only after a tailoring run completes.");
        return;
      }

      const targetFingerprint = computeTargetFingerprint(resume, target);
      if (!targetFingerprint) {
        setRewriteError("Unable to locate the selected target for rewrite.");
        return;
      }

      setRewriteSession({
        target,
        targetLabel,
        targetFingerprint,
        originalBullets: bullets.map((bullet) => ({ text: bullet.text })),
      });
      setRewriteDraft(createDefaultRewriteDraft());
      setRewriteSuggestion(null);
      setRewriteError(null);
      setRewriteAnchorElement(anchorElement);
      syncAnchorFromElement(anchorElement);
    },
    [canRewrite, resume, syncAnchorFromElement]
  );

  const handleToggleIntent = useCallback((intent: RewriteIntent) => {
    setRewriteDraft((prev) => {
      const exists = prev.intents.includes(intent);
      const nextIntents = exists
        ? prev.intents.filter((item) => item !== intent)
        : [...prev.intents, intent];
      const nextPresetNote = buildPresetNote(nextIntents);
      const nextNote = mergeNoteWithPreset(prev.note, prev.presetNote, nextPresetNote);

      return {
        ...prev,
        intents: nextIntents,
        presetNote: nextPresetNote,
        note: nextNote,
      };
    });
  }, []);

  const requestRewrite = useCallback(async () => {
    if (!rewriteSession || !parsed || !jdText || isRewriting) return;

    setIsRewriting(true);
    setRewriteError(null);

    try {
      const payload = {
        parsed,
        currentResume: resume,
        jdText,
        target: rewriteSession.target,
        feedback: {
          intents: rewriteDraft.intents,
          note: rewriteDraft.note.trim() || undefined,
          requestedTechnology: rewriteDraft.requestedTechnology.trim() || undefined,
        },
        bulletCountPolicy:
          rewriteSession.target.scope === "entry" ? "allow_plus_minus_one" : "fixed",
      } as const;

      const response = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as RewriteResponse | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to generate rewrite suggestion.");
      }

      setRewriteSuggestion({
        session: rewriteSession,
        response: data as RewriteResponse,
      });
    } catch (error) {
      setRewriteError(
        error instanceof Error ? error.message : "Unable to generate rewrite suggestion."
      );
    } finally {
      setIsRewriting(false);
    }
  }, [isRewriting, jdText, parsed, resume, rewriteDraft, rewriteSession]);

  const applyRewrite = useCallback(() => {
    if (!rewriteSuggestion) return;

    const latestFingerprint = computeTargetFingerprint(resume, rewriteSuggestion.session.target);
    if (!latestFingerprint || latestFingerprint !== rewriteSuggestion.session.targetFingerprint) {
      setRewriteError("This entry changed after the suggestion was generated. Retry rewrite to refresh.");
      return;
    }

    const { section, scope, entryIndex, bulletIndex } = rewriteSuggestion.response.suggestion;
    onApplyRewrite(
      {
        section,
        scope,
        entryIndex,
        ...(typeof bulletIndex === "number" ? { bulletIndex } : {}),
      },
      rewriteSuggestion.response.suggestion.bullets
    );
    resetRewriteFlow();
  }, [onApplyRewrite, resetRewriteFlow, resume, rewriteSuggestion]);

  return (
    <motion.div
      className="space-y-8 pb-28"
      variants={sectionStagger}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={sectionChild}>
        <HeaderSection resume={resume} onUpdate={update} />
      </motion.div>

      <motion.div variants={sectionChild}>
        <SkillsSection
          skills={resume.skills}
          onChange={(skills) => update({ skills })}
        />
      </motion.div>
      <motion.div variants={sectionChild}>
        <ExperienceSection
          experience={resume.experience}
          onChange={(experience) => update({ experience })}
          rewriteDisabled={!canRewrite || isRewriting}
          activeRewriteTarget={rewriteSession?.target ?? null}
          onRewriteEntry={(entryIdx, label, bullets, trigger) =>
            openRewriteTarget(
              {
                section: "experience",
                scope: "entry",
                entryIndex: entryIdx,
              },
              label,
              bullets,
              trigger
            )
          }
          onRewriteBullet={(entryIdx, bulletIdx, label, bullets, trigger) =>
            openRewriteTarget(
              {
                section: "experience",
                scope: "bullet",
                entryIndex: entryIdx,
                bulletIndex: bulletIdx,
              },
              label,
              bullets,
              trigger
            )
          }
        />
      </motion.div>
      <motion.div variants={sectionChild}>
        <EducationSection
          education={resume.education}
          onChange={(education) => update({ education })}
        />
      </motion.div>
      {resume.projects && (
        <motion.div variants={sectionChild}>
          <ProjectsSection
            projects={resume.projects}
            onChange={(projects) => update({ projects })}
            rewriteDisabled={!canRewrite || isRewriting}
            activeRewriteTarget={rewriteSession?.target ?? null}
            onRewriteEntry={(entryIdx, label, bullets, trigger) =>
              openRewriteTarget(
                {
                  section: "projects",
                  scope: "entry",
                  entryIndex: entryIdx,
                },
                label,
                bullets,
                trigger
              )
            }
            onRewriteBullet={(entryIdx, bulletIdx, label, bullets, trigger) =>
              openRewriteTarget(
                {
                  section: "projects",
                  scope: "bullet",
                  entryIndex: entryIdx,
                  bulletIndex: bulletIdx,
                },
                label,
                bullets,
                trigger
              )
            }
          />
        </motion.div>
      )}

      <RewriteAssistantOverlay
        open={Boolean(rewriteSession)}
        anchorRect={rewriteAnchorRect}
        anchorMeta={rewriteAnchorMeta}
        onClose={resetRewriteFlow}
      >
        {rewriteSession && !rewriteSuggestion ? (
          <RewritePanel
            targetLabel={rewriteSession.targetLabel}
            focusedBulletIndex={
              rewriteSession.target.scope === "bullet" ? rewriteSession.target.bulletIndex : undefined
            }
            intents={rewriteDraft.intents}
            note={rewriteDraft.note}
            requestedTechnology={rewriteDraft.requestedTechnology}
            presets={REWRITE_FEEDBACK_PRESETS}
            disabled={isRewriting}
            canRewrite={canRewrite}
            isGenerating={isRewriting}
            error={rewriteError}
            submitLabel="Generate suggestion"
            onToggleIntent={handleToggleIntent}
            onNoteChange={(value) => setRewriteDraft((prev) => ({ ...prev, note: value }))}
            onRequestedTechnologyChange={(value) =>
              setRewriteDraft((prev) => ({ ...prev, requestedTechnology: value }))
            }
            onSubmit={requestRewrite}
            onCancel={resetRewriteFlow}
          />
        ) : null}

        {rewriteSession && rewriteSuggestion ? (
          <RewriteSuggestionCard
            targetLabel={rewriteSession.targetLabel}
            scope={rewriteSuggestion.response.suggestion.scope}
            originalBullets={rewriteSuggestion.session.originalBullets}
            suggestedBullets={rewriteSuggestion.response.suggestion.bullets}
            changedBulletIndexes={rewriteSuggestion.response.changedBulletIndexes}
            focusedBulletIndex={
              rewriteSuggestion.response.suggestion.scope === "bullet"
                ? rewriteSuggestion.response.suggestion.bulletIndex
                : undefined
            }
            warnings={rewriteSuggestion.response.warnings}
            isBusy={isRewriting}
            error={rewriteError}
            onApply={applyRewrite}
            onRetry={requestRewrite}
            onCancel={resetRewriteFlow}
          />
        ) : null}
      </RewriteAssistantOverlay>
    </motion.div>
  );
}

function HeaderSection({
  resume,
  onUpdate,
}: {
  resume: TailoredResume;
  onUpdate: (patch: Partial<TailoredResume>) => void;
}) {
  return (
    <section className="relative bg-surface rounded-xl pt-6 pb-5 px-5 border-t border-white/[0.04] shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]">
      <SectionLabel>Contact Info</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <Field label="Name" name="name" autoComplete="name" value={resume.name} onChange={(name) => onUpdate({ name })} />
        <Field label="Email" name="email" type="email" autoComplete="email" spellCheck={false} value={resume.email} onChange={(email) => onUpdate({ email })} />
        <Field label="Phone" name="tel" type="tel" autoComplete="tel" value={resume.phone} onChange={(phone) => onUpdate({ phone })} />
        <Field label="LinkedIn" name="linkedin" type="url" autoComplete="url" spellCheck={false} value={resume.linkedin ?? ""} onChange={(v) => onUpdate({ linkedin: v || null })} />
        <Field label="GitHub" name="github" type="url" autoComplete="url" spellCheck={false} value={resume.github ?? ""} onChange={(v) => onUpdate({ github: v || null })} />
        <Field label="Website" name="website" type="url" autoComplete="url" spellCheck={false} value={resume.website ?? ""} onChange={(v) => onUpdate({ website: v || null })} />
      </div>
    </section>
  );
}

function SkillsSection({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (s: string[]) => void;
}) {
  const raw = useMemo(() => formatSkillsForEditor(skills), [skills]);
  const id = useId();

  function handleChange(value: string) {
    const parsed = parseSkillsEditorInput(value);
    onChange(parsed);
  }

  return (
    <section className="relative bg-surface rounded-xl pt-6 pb-5 px-5 border-t border-white/[0.04] shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]">
      <SectionLabel id={id}>Skills</SectionLabel>
      <textarea
        aria-labelledby={id}
        name="skills"
        autoComplete="off"
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        rows={5}
        placeholder={"Languages: Python, Java\nFrameworks: React, Django\nCloud: AWS, GCP"}
        className="mt-4 w-full bg-base border border-surface-border rounded-lg px-3 py-2 text-sm text-warm placeholder-warm-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent resize-y transition-shadow duration-200"
      />
    </section>
  );
}

function ExperienceSection({
  experience,
  onChange,
  rewriteDisabled,
  activeRewriteTarget,
  onRewriteEntry,
  onRewriteBullet,
}: {
  experience: TailoredResume["experience"];
  onChange: (e: TailoredResume["experience"]) => void;
  rewriteDisabled: boolean;
  activeRewriteTarget?: RewriteTarget | null;
  onRewriteEntry: (
    entryIdx: number,
    label: string,
    bullets: Array<{ text: string }>,
    trigger: HTMLElement
  ) => void;
  onRewriteBullet: (
    entryIdx: number,
    bulletIdx: number,
    label: string,
    bullets: Array<{ text: string }>,
    trigger: HTMLElement
  ) => void;
}) {
  function updateEntry(idx: number, patch: Partial<TailoredResume["experience"][number]>) {
    const next = [...experience];
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  }

  function updateBullet(entryIdx: number, bulletIdx: number, text: string) {
    const next = [...experience];
    const entry = { ...next[entryIdx]! };
    const bullets = [...entry.bullets];
    bullets[bulletIdx] = { text };
    entry.bullets = bullets;
    next[entryIdx] = entry;
    onChange(next);
  }

  function addBullet(entryIdx: number) {
    const next = [...experience];
    const entry = { ...next[entryIdx]! };
    entry.bullets = [...entry.bullets, { text: "" }];
    next[entryIdx] = entry;
    onChange(next);
  }

  function removeBullet(entryIdx: number, bulletIdx: number) {
    const next = [...experience];
    const entry = { ...next[entryIdx]! };
    entry.bullets = entry.bullets.filter((_, i) => i !== bulletIdx);
    next[entryIdx] = entry;
    onChange(next);
  }

  return (
    <section className="relative bg-surface rounded-xl pt-6 pb-5 px-5 border-t border-white/[0.04] shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]">
      <SectionLabel>Experience</SectionLabel>
      <div className="mt-4 space-y-6">
        {experience.map((exp, ei) => (
          <div key={ei} className="border-l-2 border-accent/25 pl-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Company" value={exp.company} onChange={(v) => updateEntry(ei, { company: v })} />
              <Field label="Title" value={exp.title} onChange={(v) => updateEntry(ei, { title: v })} />
              <Field label="Location" value={exp.location} onChange={(v) => updateEntry(ei, { location: v })} />
              <Field label="Date Range" value={exp.dateRange} onChange={(v) => updateEntry(ei, { dateRange: v })} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-warm-faint">{exp.company} · {exp.title}</p>
              <ActionButton
                ariaLabel="Revamp entry"
                title="Revamp entry"
                iconOnly
                disabled={rewriteDisabled}
                onClick={(event) =>
                  onRewriteEntry(ei, `${exp.company} - ${exp.title}`, exp.bullets, event.currentTarget)
                }
              >
                <RevampIcon />
              </ActionButton>
            </div>
            <BulletList
              bullets={exp.bullets}
              rewriteDisabled={rewriteDisabled}
              activeBulletIndex={
                activeRewriteTarget?.section === "experience" &&
                activeRewriteTarget.entryIndex === ei &&
                activeRewriteTarget.scope === "bullet"
                  ? activeRewriteTarget.bulletIndex
                  : undefined
              }
              onRewrite={(bi, trigger) =>
                onRewriteBullet(ei, bi, `${exp.company} - Bullet ${bi + 1}`, exp.bullets, trigger)
              }
              onUpdate={(bi, text) => updateBullet(ei, bi, text)}
              onAdd={() => addBullet(ei)}
              onRemove={(bi) => removeBullet(ei, bi)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function EducationSection({
  education,
  onChange,
}: {
  education: TailoredResume["education"];
  onChange: (e: TailoredResume["education"]) => void;
}) {
  function updateEntry(idx: number, patch: Partial<TailoredResume["education"][number]>) {
    const next = [...education];
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  }

  return (
    <section className="relative bg-surface rounded-xl pt-6 pb-5 px-5 border-t border-white/[0.04] shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]">
      <SectionLabel>Education</SectionLabel>
      <div className="mt-4 space-y-5">
        {education.map((edu, i) => (
          <div key={i} className="border-l-2 border-accent/15 pl-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Institution" value={edu.institution} onChange={(v) => updateEntry(i, { institution: v })} />
              <Field label="Degree" value={edu.degree} onChange={(v) => updateEntry(i, { degree: v })} />
              <Field label="Date Range" value={edu.dateRange} onChange={(v) => updateEntry(i, { dateRange: v })} />
              <Field label="GPA" value={edu.gpa ?? ""} onChange={(v) => updateEntry(i, { gpa: v || null })} />
              <Field label="Honors" value={edu.honors ?? ""} onChange={(v) => updateEntry(i, { honors: v || null })} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProjectsSection({
  projects,
  onChange,
  rewriteDisabled,
  activeRewriteTarget,
  onRewriteEntry,
  onRewriteBullet,
}: {
  projects: NonNullable<TailoredResume["projects"]>;
  onChange: (p: NonNullable<TailoredResume["projects"]>) => void;
  rewriteDisabled: boolean;
  activeRewriteTarget?: RewriteTarget | null;
  onRewriteEntry: (
    entryIdx: number,
    label: string,
    bullets: Array<{ text: string }>,
    trigger: HTMLElement
  ) => void;
  onRewriteBullet: (
    entryIdx: number,
    bulletIdx: number,
    label: string,
    bullets: Array<{ text: string }>,
    trigger: HTMLElement
  ) => void;
}) {
  function updateEntry(idx: number, patch: Partial<NonNullable<TailoredResume["projects"]>[number]>) {
    const next = [...projects];
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  }

  function updateBullet(entryIdx: number, bulletIdx: number, text: string) {
    const next = [...projects];
    const entry = { ...next[entryIdx]! };
    const bullets = [...entry.bullets];
    bullets[bulletIdx] = { text };
    entry.bullets = bullets;
    next[entryIdx] = entry;
    onChange(next);
  }

  function addBullet(entryIdx: number) {
    const next = [...projects];
    const entry = { ...next[entryIdx]! };
    entry.bullets = [...entry.bullets, { text: "" }];
    next[entryIdx] = entry;
    onChange(next);
  }

  function removeBullet(entryIdx: number, bulletIdx: number) {
    const next = [...projects];
    const entry = { ...next[entryIdx]! };
    entry.bullets = entry.bullets.filter((_, i) => i !== bulletIdx);
    next[entryIdx] = entry;
    onChange(next);
  }

  return (
    <section className="relative bg-surface rounded-xl pt-6 pb-5 px-5 border-t border-white/[0.04] shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]">
      <SectionLabel>Projects</SectionLabel>
      <div className="mt-4 space-y-6">
        {projects.map((proj, pi) => (
          <div key={pi} className="border-l-2 border-accent/25 pl-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name" value={proj.name} onChange={(v) => updateEntry(pi, { name: v })} />
              <Field label="Technologies" value={proj.technologies} onChange={(v) => updateEntry(pi, { technologies: v })} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-warm-faint">{proj.name}</p>
              <ActionButton
                ariaLabel="Revamp entry"
                title="Revamp entry"
                iconOnly
                disabled={rewriteDisabled}
                onClick={(event) =>
                  onRewriteEntry(pi, `${proj.name} project`, proj.bullets, event.currentTarget)
                }
              >
                <RevampIcon />
              </ActionButton>
            </div>
            <BulletList
              bullets={proj.bullets}
              rewriteDisabled={rewriteDisabled}
              activeBulletIndex={
                activeRewriteTarget?.section === "projects" &&
                activeRewriteTarget.entryIndex === pi &&
                activeRewriteTarget.scope === "bullet"
                  ? activeRewriteTarget.bulletIndex
                  : undefined
              }
              onRewrite={(bi, trigger) =>
                onRewriteBullet(pi, bi, `${proj.name} - Bullet ${bi + 1}`, proj.bullets, trigger)
              }
              onUpdate={(bi, text) => updateBullet(pi, bi, text)}
              onAdd={() => addBullet(pi)}
              onRemove={(bi) => removeBullet(pi, bi)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function BulletList({
  bullets,
  rewriteDisabled,
  activeBulletIndex,
  onRewrite,
  onUpdate,
  onAdd,
  onRemove,
}: {
  bullets: { text: string }[];
  rewriteDisabled: boolean;
  activeBulletIndex?: number;
  onRewrite?: (idx: number, trigger: HTMLElement) => void;
  onUpdate: (idx: number, text: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-warm-muted mb-2">Bullets</p>
      <div className="space-y-2">
        {bullets.map((bullet, bi) => (
          <div
            key={bi}
            className={`flex gap-2 rounded-lg px-1 py-1 ${
              activeBulletIndex === bi
                ? "border border-accent/45 bg-accent/10 ring-1 ring-accent/30"
                : "border border-transparent"
            }`}
          >
            <span
              className={`mt-2 text-sm select-none ${activeBulletIndex === bi ? "text-accent" : "text-accent/50"}`}
              aria-hidden="true"
            >
              &bull;
            </span>
            <textarea
              value={bullet.text}
              onChange={(e) => onUpdate(bi, e.target.value)}
              rows={2}
              className="flex-1 bg-base border border-surface-border rounded-lg px-3 py-2 text-sm text-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent resize-y transition-shadow duration-200"
            />
            <div className="mt-0.5 flex flex-col gap-1.5">
              {onRewrite && (
                <ActionButton
                  ariaLabel="Rewrite bullet"
                  title="Rewrite bullet"
                  iconOnly
                  disabled={rewriteDisabled}
                  onClick={(event) => onRewrite(bi, event.currentTarget)}
                >
                  <RewriteIcon />
                </ActionButton>
              )}
              <button
                type="button"
                onClick={() => onRemove(bi)}
                aria-label="Remove bullet"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-surface-border bg-base text-warm-muted transition-colors hover:border-danger/45 hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-60"
              >
                <svg className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex h-8 items-center rounded-md border border-surface-border bg-base px-2.5 text-xs font-medium text-warm-muted transition-colors hover:bg-surface-hover hover:text-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        + Add Bullet
      </button>
    </div>
  );
}

function ActionButton({
  children,
  ariaLabel,
  title,
  iconOnly = false,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  ariaLabel?: string;
  title?: string;
  iconOnly?: boolean;
  disabled: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border border-surface-border bg-base text-warm-muted transition-colors hover:bg-surface-hover hover:text-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${
        iconOnly
          ? "inline-flex h-8 w-8 items-center justify-center"
          : "inline-flex h-8 items-center px-2.5 text-[11px] uppercase tracking-[0.08em]"
      }`}
    >
      {children}
    </button>
  );
}

function RevampIcon() {
  return (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h5M20 20v-5h-5M19 9a7 7 0 00-12-3M5 15a7 7 0 0012 3"
      />
    </svg>
  );
}

function RewriteIcon() {
  return (
    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16.862 4.487a2.1 2.1 0 113.03 2.898L9.56 18.01 5 19l.988-4.56 10.874-9.953z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 6l3 3" />
    </svg>
  );
}

function SectionLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="font-display italic text-lg text-warm relative -top-3 -mb-1 inline-block bg-surface px-1"
    >
      {children}
    </h2>
  );
}

function Field({
  label,
  value,
  onChange,
  name,
  type = "text",
  autoComplete,
  spellCheck,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  name?: string;
  type?: string;
  autoComplete?: string;
  spellCheck?: boolean;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="block text-xs text-warm-faint mb-1">{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-base border border-surface-border rounded-lg px-3 py-1.5 text-sm text-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent transition-shadow duration-200"
      />
    </div>
  );
}
