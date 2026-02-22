import JSZip from "jszip";
import type { SourceLayout, TailoredResume } from "./schema";
import { buildRenderSections } from "./resume-layout";
import { normalizeSkillLines } from "./skills";

interface ParagraphOptions {
  bold?: boolean;
  italic?: boolean;
  center?: boolean;
  fontSizeHalfPoints?: number;
  spacingBefore?: number;
  spacingAfter?: number;
  indentLeft?: number;
  hanging?: number;
}

interface Paragraph {
  text: string;
  options?: ParagraphOptions;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function runXml(text: string, options?: ParagraphOptions): string {
  const runProps: string[] = [];

  if (options?.bold) runProps.push("<w:b/>");
  if (options?.italic) runProps.push("<w:i/>");
  if (options?.fontSizeHalfPoints) {
    runProps.push(`<w:sz w:val="${options.fontSizeHalfPoints}"/>`);
    runProps.push(`<w:szCs w:val="${options.fontSizeHalfPoints}"/>`);
  }

  const rPr = runProps.length > 0 ? `<w:rPr>${runProps.join("")}</w:rPr>` : "";
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function paragraphXml(paragraph: Paragraph): string {
  const opts = paragraph.options ?? {};
  const pPr: string[] = [];

  if (opts.center) pPr.push('<w:jc w:val="center"/>');

  const spacingAttrs: string[] = [];
  if (typeof opts.spacingBefore === "number") spacingAttrs.push(`w:before="${opts.spacingBefore}"`);
  if (typeof opts.spacingAfter === "number") spacingAttrs.push(`w:after="${opts.spacingAfter}"`);
  if (spacingAttrs.length > 0) pPr.push(`<w:spacing ${spacingAttrs.join(" ")}/>`);

  if (typeof opts.indentLeft === "number" || typeof opts.hanging === "number") {
    const indentAttrs: string[] = [];
    if (typeof opts.indentLeft === "number") indentAttrs.push(`w:left="${opts.indentLeft}"`);
    if (typeof opts.hanging === "number") indentAttrs.push(`w:hanging="${opts.hanging}"`);
    pPr.push(`<w:ind ${indentAttrs.join(" ")}/>`);
  }

  const pPrXml = pPr.length > 0 ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  return `<w:p>${pPrXml}${runXml(paragraph.text, opts)}</w:p>`;
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function packageRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function corePropsXml(): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Tailored Resume</dc:title>
  <dc:creator>JDSwap</dc:creator>
  <cp:lastModifiedBy>JDSwap</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function appPropsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>JDSwap</Application>
</Properties>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
      <w:sz w:val="21"/>
      <w:szCs w:val="21"/>
    </w:rPr>
  </w:style>
</w:styles>`;
}

function documentRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
}

function sectionHeading(text: string): Paragraph {
  return {
    text,
    options: {
      bold: true,
      fontSizeHalfPoints: 22,
      spacingBefore: 140,
      spacingAfter: 70,
    },
  };
}

function bodyLine(text: string): Paragraph {
  return {
    text,
    options: {
      fontSizeHalfPoints: 21,
      spacingAfter: 30,
    },
  };
}

function bulletLine(text: string): Paragraph {
  return {
    text: `• ${text}`,
    options: {
      fontSizeHalfPoints: 20,
      spacingAfter: 20,
      indentLeft: 360,
      hanging: 220,
    },
  };
}

function buildParagraphs(resume: TailoredResume, sourceLayout: SourceLayout): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  const contactParts = [resume.email, resume.phone];
  if (resume.linkedin) contactParts.push(resume.linkedin);
  if (resume.github) contactParts.push(resume.github);
  if (resume.website) contactParts.push(resume.website);

  paragraphs.push({
    text: resume.name,
    options: {
      bold: true,
      center: true,
      fontSizeHalfPoints: 34,
      spacingAfter: 70,
    },
  });
  paragraphs.push({
    text: contactParts.join(" | "),
    options: {
      center: true,
      fontSizeHalfPoints: 20,
      spacingAfter: 90,
    },
  });

  const sections = buildRenderSections(resume, sourceLayout);
  const skillLines = normalizeSkillLines(resume.skills);

  for (const section of sections) {
    paragraphs.push(sectionHeading(section.heading));

    if (section.kind === "summary") {
      if (resume.summary) {
        paragraphs.push(bodyLine(resume.summary));
      } else {
        for (const line of section.sourceLines) {
          paragraphs.push(bodyLine(line));
        }
      }
      continue;
    }

    if (section.kind === "skills") {
      const lines = skillLines.length > 0 ? skillLines : section.sourceLines;
      for (const line of lines) {
        paragraphs.push(bodyLine(line));
      }
      continue;
    }

    if (section.kind === "experience") {
      if (resume.experience.length > 0) {
        for (const exp of resume.experience) {
          const header = `${exp.title}, ${exp.company}${
            exp.location ? ` (${exp.location})` : ""
          }  ${exp.dateRange}`;
          paragraphs.push({
            text: header,
            options: {
              bold: true,
              fontSizeHalfPoints: 21,
              spacingAfter: 25,
            },
          });

          for (const bullet of exp.bullets) {
            paragraphs.push(bulletLine(bullet.text));
          }
        }
      } else {
        for (const line of section.sourceLines) {
          paragraphs.push(bodyLine(line));
        }
      }
      continue;
    }

    if (section.kind === "education") {
      if (resume.education.length > 0) {
        for (let i = 0; i < resume.education.length; i++) {
          const edu = resume.education[i]!;
          paragraphs.push({
            text: `${edu.degree}, ${edu.institution} — ${edu.dateRange}`,
            options: {
              bold: true,
              fontSizeHalfPoints: 21,
              spacingAfter: 25,
            },
          });

          if (edu.gpa) {
            paragraphs.push(bodyLine(`GPA: ${edu.gpa}`));
          }
          if (edu.honors) {
            paragraphs.push(bodyLine(edu.honors));
          }

          const detailLines = section.educationDetailBlocks?.[i] ?? [];
          for (const detail of detailLines) {
            paragraphs.push(bodyLine(detail));
          }
        }
      } else {
        for (const line of section.sourceLines) {
          paragraphs.push(bodyLine(line));
        }
      }
      continue;
    }

    if (section.kind === "projects") {
      if (resume.projects && resume.projects.length > 0) {
        for (const project of resume.projects) {
          paragraphs.push({
            text: `${project.name}: ${project.technologies}`,
            options: {
              bold: true,
              fontSizeHalfPoints: 21,
              spacingAfter: 25,
            },
          });
          for (const bullet of project.bullets) {
            paragraphs.push(bulletLine(bullet.text));
          }
        }
      } else {
        for (const line of section.sourceLines) {
          paragraphs.push(bodyLine(line));
        }
      }
      continue;
    }

    for (const line of section.sourceLines) {
      paragraphs.push(bodyLine(line));
    }
  }

  return paragraphs;
}

function documentXml(paragraphs: Paragraph[]): string {
  const paragraphXmls = paragraphs.map(paragraphXml).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphXmls}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="680" w:right="640" w:bottom="680" w:left="640" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

export async function generateCanonicalDocx(
  resume: TailoredResume,
  sourceLayout: SourceLayout
): Promise<Buffer> {
  const paragraphs = buildParagraphs(resume, sourceLayout);

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.folder("_rels")!.file(".rels", packageRelsXml());
  zip.folder("docProps")!.file("core.xml", corePropsXml());
  zip.folder("docProps")!.file("app.xml", appPropsXml());
  zip.folder("word")!.file("styles.xml", stylesXml());
  zip.folder("word")!.folder("_rels")!.file("document.xml.rels", documentRelsXml());
  zip.folder("word")!.file("document.xml", documentXml(paragraphs));

  return zip.generateAsync({ type: "nodebuffer" });
}
