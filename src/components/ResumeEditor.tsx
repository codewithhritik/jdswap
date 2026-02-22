"use client";

import { useCallback, useId, useMemo } from "react";
import { motion } from "motion/react";
import type { TailoredResume } from "@/lib/schema";
import { formatSkillsForEditor, parseSkillsEditorInput } from "@/lib/skills";

interface ResumeEditorProps {
  resume: TailoredResume;
  onChange: (resume: TailoredResume) => void;
}

const sectionStagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
};

const sectionChild = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] as const } },
};

export function ResumeEditor({ resume, onChange }: ResumeEditorProps) {
  const update = useCallback(
    (patch: Partial<TailoredResume>) => onChange({ ...resume, ...patch }),
    [resume, onChange]
  );

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
          />
        </motion.div>
      )}
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
}: {
  experience: TailoredResume["experience"];
  onChange: (e: TailoredResume["experience"]) => void;
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
            <BulletList
              bullets={exp.bullets}
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
}: {
  projects: NonNullable<TailoredResume["projects"]>;
  onChange: (p: NonNullable<TailoredResume["projects"]>) => void;
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
            <BulletList
              bullets={proj.bullets}
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
  onUpdate,
  onAdd,
  onRemove,
}: {
  bullets: { text: string }[];
  onUpdate: (idx: number, text: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-warm-muted mb-2">Bullets</p>
      <div className="space-y-2">
        {bullets.map((bullet, bi) => (
          <div key={bi} className="flex gap-2">
            <span className="text-accent/50 mt-2 text-sm select-none" aria-hidden="true">&bull;</span>
            <textarea
              value={bullet.text}
              onChange={(e) => onUpdate(bi, e.target.value)}
              rows={2}
              className="flex-1 bg-base border border-surface-border rounded-lg px-3 py-2 text-sm text-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent resize-y transition-shadow duration-200"
            />
            <button
              type="button"
              onClick={() => onRemove(bi)}
              aria-label="Remove bullet"
              className="text-warm-faint hover:text-danger transition-colors mt-2 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger"
            >
              <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 text-xs text-accent hover:text-accent-hover transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        + Add Bullet
      </button>
    </div>
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
