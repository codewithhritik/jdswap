import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import type { TailoredResume } from "../schema";
import { createStyles } from "./styles";

interface ResumeDocumentProps {
  resume: TailoredResume;
  fontSize?: number;
  lineHeight?: number;
}

export function createResumeDocument(
  resume: TailoredResume,
  fontSize = 10,
  lineHeight = 1.3
) {
  return ResumeDocument({ resume, fontSize, lineHeight });
}

function ResumeDocument({
  resume,
  fontSize = 10,
  lineHeight = 1.3,
}: ResumeDocumentProps) {
  const styles = createStyles(fontSize, lineHeight);

  const contactParts: string[] = [resume.email, resume.phone];
  if (resume.linkedin) contactParts.push(resume.linkedin);
  if (resume.github) contactParts.push(resume.github);
  if (resume.website) contactParts.push(resume.website);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{resume.name}</Text>
          <View style={styles.contactRow}>
            {contactParts.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <Text style={styles.contactSeparator}>{" | "}</Text>
                )}
                <Text>{part}</Text>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Summary */}
        {resume.summary && (
          <View>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={{ fontSize: fontSize - 0.5 }}>{resume.summary}</Text>
          </View>
        )}

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Technical Skills</Text>
            <Text style={styles.skillsRow}>{resume.skills.join("  |  ")}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Experience</Text>
            {resume.experience.map((exp, i) => (
              <View key={i} style={styles.experienceEntry}>
                <View style={styles.entryRow}>
                  <View style={styles.entryLeft}>
                    <Text style={styles.companyName}>{exp.company}</Text>
                    <Text style={styles.titleSeparator}>{"  —  "}</Text>
                    <Text style={styles.jobTitle}>{exp.title}</Text>
                  </View>
                  <Text style={styles.dateLocation}>
                    {exp.location} | {exp.dateRange}
                  </Text>
                </View>
                {exp.bullets.map((bullet, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDot}>{"\u2022"}</Text>
                    <Text style={styles.bulletText}>{bullet.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {resume.education.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Education</Text>
            {resume.education.map((edu, i) => (
              <View key={i} style={styles.educationRow}>
                <View>
                  <Text style={styles.educationDegree}>
                    {edu.institution} — {edu.degree}
                  </Text>
                  {(edu.gpa || edu.honors) && (
                    <Text style={styles.educationDetails}>
                      {[edu.gpa && `GPA: ${edu.gpa}`, edu.honors]
                        .filter(Boolean)
                        .join("  |  ")}
                    </Text>
                  )}
                </View>
                <Text style={styles.dateLocation}>{edu.dateRange}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Projects */}
        {resume.projects && resume.projects.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Projects</Text>
            {resume.projects.map((proj, i) => (
              <View key={i} style={styles.experienceEntry}>
                <View style={styles.projectTechRow}>
                  <Text style={styles.projectName}>{proj.name}</Text>
                  <Text style={styles.projectTech}>{proj.technologies}</Text>
                </View>
                {proj.bullets.map((bullet, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDot}>{"\u2022"}</Text>
                    <Text style={styles.bulletText}>{bullet.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
