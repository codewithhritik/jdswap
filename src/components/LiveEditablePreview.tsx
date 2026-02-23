"use client";

import { useCallback, useId, useMemo, type ReactNode } from "react";
import { buildRenderSections } from "@/lib/resume-layout";
import type { SourceLayout, TailoredResume } from "@/lib/schema";
import { formatSkillsForEditor } from "@/lib/skills";
import {
  type ContactField,
  type EducationField,
  type ExperienceField,
  type ProjectField,
  updateEducationField,
  updateExperienceBulletText,
  updateExperienceField,
  updateProjectBulletText,
  updateProjectField,
  updateResumeContactField,
  updateResumeSkillsFromEditorInput,
  updateResumeSummary,
} from "@/lib/live-preview-updates";

interface LiveEditablePreviewProps {
  resume: TailoredResume;
  sourceLayout: SourceLayout;
  onChange: (resume: TailoredResume) => void;
}

export function LiveEditablePreview({
  resume,
  sourceLayout,
  onChange,
}: LiveEditablePreviewProps) {
  const renderSections = useMemo(
    () => buildRenderSections(resume, sourceLayout),
    [resume, sourceLayout]
  );
  const skillsValue = useMemo(
    () => formatSkillsForEditor(resume.skills),
    [resume.skills]
  );

  const commit = useCallback(
    (next: TailoredResume) => {
      if (next !== resume) onChange(next);
    },
    [onChange, resume]
  );

  const handleContactChange = useCallback(
    (field: ContactField, value: string) => {
      commit(updateResumeContactField(resume, field, value));
    },
    [commit, resume]
  );

  const handleExperienceFieldChange = useCallback(
    (entryIndex: number, field: ExperienceField, value: string) => {
      commit(updateExperienceField(resume, entryIndex, field, value));
    },
    [commit, resume]
  );

  const handleExperienceBulletChange = useCallback(
    (entryIndex: number, bulletIndex: number, text: string) => {
      commit(updateExperienceBulletText(resume, entryIndex, bulletIndex, text));
    },
    [commit, resume]
  );

  const handleEducationChange = useCallback(
    (entryIndex: number, field: EducationField, value: string) => {
      commit(updateEducationField(resume, entryIndex, field, value));
    },
    [commit, resume]
  );

  const handleProjectFieldChange = useCallback(
    (entryIndex: number, field: ProjectField, value: string) => {
      commit(updateProjectField(resume, entryIndex, field, value));
    },
    [commit, resume]
  );

  const handleProjectBulletChange = useCallback(
    (entryIndex: number, bulletIndex: number, text: string) => {
      commit(updateProjectBulletText(resume, entryIndex, bulletIndex, text));
    },
    [commit, resume]
  );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-warm-muted">
        Live preview is editable and stays synced with the form and exports.
      </div>
      <div className="max-h-[76vh] overflow-auto rounded-lg border border-surface-border bg-base/10 p-2 sm:p-3">
        <section className="mx-auto w-full max-w-[820px] rounded-md bg-white px-4 py-5 text-black shadow-[0_10px_28px_rgba(0,0,0,0.18)] sm:px-7 sm:py-6">
          <header className="mb-5 border-b border-black/15 pb-4">
            <Field
              label="Name"
              value={resume.name}
              onChange={(value) => handleContactChange("name", value)}
              className="text-center text-[1.9rem] font-semibold tracking-tight"
            />
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Email"
                type="email"
                value={resume.email}
                onChange={(value) => handleContactChange("email", value)}
              />
              <Field
                label="Phone"
                value={resume.phone}
                onChange={(value) => handleContactChange("phone", value)}
              />
              <Field
                label="LinkedIn"
                type="url"
                value={resume.linkedin ?? ""}
                onChange={(value) => handleContactChange("linkedin", value)}
              />
              <Field
                label="GitHub"
                type="url"
                value={resume.github ?? ""}
                onChange={(value) => handleContactChange("github", value)}
              />
              <Field
                label="Website"
                type="url"
                value={resume.website ?? ""}
                onChange={(value) => handleContactChange("website", value)}
                className="sm:col-span-2"
              />
            </div>
          </header>

          <div className="space-y-5">
            {renderSections.map((section) => {
              if (section.kind === "summary") {
                return (
                  <SectionBlock key={`${section.kind}-${section.heading}`} heading={section.heading}>
                    <Area
                      value={resume.summary ?? ""}
                      rows={3}
                      onChange={(value) => commit(updateResumeSummary(resume, value))}
                    />
                  </SectionBlock>
                );
              }

              if (section.kind === "skills") {
                return (
                  <SectionBlock key={`${section.kind}-${section.heading}`} heading={section.heading}>
                    <Area
                      value={skillsValue}
                      rows={4}
                      onChange={(value) =>
                        commit(updateResumeSkillsFromEditorInput(resume, value))
                      }
                    />
                  </SectionBlock>
                );
              }

              if (section.kind === "experience") {
                return (
                  <SectionBlock key={`${section.kind}-${section.heading}`} heading={section.heading}>
                    <div className="space-y-4">
                      {resume.experience.map((exp, expIndex) => (
                        <article key={`${exp.company}-${expIndex}`} className="rounded-md border border-black/10 p-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field
                              label="Company"
                              value={exp.company}
                              onChange={(value) =>
                                handleExperienceFieldChange(expIndex, "company", value)
                              }
                            />
                            <Field
                              label="Title"
                              value={exp.title}
                              onChange={(value) =>
                                handleExperienceFieldChange(expIndex, "title", value)
                              }
                            />
                            <Field
                              label="Location"
                              value={exp.location}
                              onChange={(value) =>
                                handleExperienceFieldChange(expIndex, "location", value)
                              }
                            />
                            <Field
                              label="Date Range"
                              value={exp.dateRange}
                              onChange={(value) =>
                                handleExperienceFieldChange(expIndex, "dateRange", value)
                              }
                            />
                          </div>
                          <div className="mt-3 space-y-2">
                            {exp.bullets.map((bullet, bulletIndex) => (
                              <div key={`${expIndex}-${bulletIndex}`} className="flex gap-2">
                                <span aria-hidden="true" className="pt-1 text-black/55">
                                  •
                                </span>
                                <Area
                                  rows={2}
                                  value={bullet.text}
                                  onChange={(value) =>
                                    handleExperienceBulletChange(
                                      expIndex,
                                      bulletIndex,
                                      value
                                    )
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </SectionBlock>
                );
              }

              if (section.kind === "education") {
                return (
                  <SectionBlock key={`${section.kind}-${section.heading}`} heading={section.heading}>
                    <div className="space-y-4">
                      {resume.education.map((education, eduIndex) => (
                        <article key={`${education.institution}-${eduIndex}`} className="rounded-md border border-black/10 p-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field
                              label="Institution"
                              value={education.institution}
                              onChange={(value) =>
                                handleEducationChange(eduIndex, "institution", value)
                              }
                            />
                            <Field
                              label="Degree"
                              value={education.degree}
                              onChange={(value) =>
                                handleEducationChange(eduIndex, "degree", value)
                              }
                            />
                            <Field
                              label="Date Range"
                              value={education.dateRange}
                              onChange={(value) =>
                                handleEducationChange(eduIndex, "dateRange", value)
                              }
                            />
                            <Field
                              label="GPA"
                              value={education.gpa ?? ""}
                              onChange={(value) =>
                                handleEducationChange(eduIndex, "gpa", value)
                              }
                            />
                            <Field
                              label="Honors"
                              value={education.honors ?? ""}
                              onChange={(value) =>
                                handleEducationChange(eduIndex, "honors", value)
                              }
                              className="sm:col-span-2"
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  </SectionBlock>
                );
              }

              if (section.kind === "projects" && resume.projects) {
                return (
                  <SectionBlock key={`${section.kind}-${section.heading}`} heading={section.heading}>
                    <div className="space-y-4">
                      {resume.projects.map((project, projectIndex) => (
                        <article key={`${project.name}-${projectIndex}`} className="rounded-md border border-black/10 p-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field
                              label="Project"
                              value={project.name}
                              onChange={(value) =>
                                handleProjectFieldChange(projectIndex, "name", value)
                              }
                            />
                            <Field
                              label="Technologies"
                              value={project.technologies}
                              onChange={(value) =>
                                handleProjectFieldChange(
                                  projectIndex,
                                  "technologies",
                                  value
                                )
                              }
                            />
                          </div>
                          <div className="mt-3 space-y-2">
                            {project.bullets.map((bullet, bulletIndex) => (
                              <div key={`${projectIndex}-${bulletIndex}`} className="flex gap-2">
                                <span aria-hidden="true" className="pt-1 text-black/55">
                                  •
                                </span>
                                <Area
                                  rows={2}
                                  value={bullet.text}
                                  onChange={(value) =>
                                    handleProjectBulletChange(
                                      projectIndex,
                                      bulletIndex,
                                      value
                                    )
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </SectionBlock>
                );
              }

              return (
                <SectionBlock key={`${section.kind}-${section.heading}`} heading={section.heading}>
                  <p className="text-xs text-black/60">
                    Custom section content is shown for reference and remains form-driven.
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-black/80">
                    {section.sourceLines.map((line, index) => (
                      <p key={`${section.heading}-${index}`}>{line}</p>
                    ))}
                  </div>
                </SectionBlock>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionBlock({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="border-b border-black/15 pb-1 text-[0.82rem] font-semibold uppercase tracking-[0.12em] text-black/70">
        {heading}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-[0.68rem] uppercase tracking-[0.1em] text-black/55">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-black/20 bg-white px-2.5 py-1.5 text-sm text-black outline-none transition-shadow focus:border-black/40 focus:ring-2 focus:ring-black/10"
      />
    </div>
  );
}

function Area({
  value,
  onChange,
  rows,
}: {
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      className="w-full resize-y rounded border border-black/20 bg-white px-2.5 py-1.5 text-sm text-black outline-none transition-shadow focus:border-black/40 focus:ring-2 focus:ring-black/10"
    />
  );
}
