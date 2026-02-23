import JSZip from "jszip";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import type { CanonicalParagraphStyleOptions, CanonicalResumeDocumentModel } from "./export-model";
import {
  buildCanonicalPaginationPlan,
  type CanonicalPlannedParagraph,
  type CanonicalTextMeasure,
} from "./canonical-pagination";
import { getCanonicalParagraphStyleOptions } from "./export-model";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function runPropsXml(options?: CanonicalParagraphStyleOptions): string {
  const runProps: string[] = [];

  if (options?.bold) runProps.push("<w:b/>");
  if (options?.italic) runProps.push("<w:i/>");
  if (options?.fontSizeHalfPoints) {
    runProps.push(`<w:sz w:val="${options.fontSizeHalfPoints}"/>`);
    runProps.push(`<w:szCs w:val="${options.fontSizeHalfPoints}"/>`);
  }

  return runProps.length > 0 ? `<w:rPr>${runProps.join("")}</w:rPr>` : "";
}

function runXml(text: string, options?: CanonicalParagraphStyleOptions): string {
  const rPr = runPropsXml(options);
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function breakRunXml(type: "line" | "page"): string {
  return type === "page"
    ? "<w:r><w:br w:type=\"page\"/></w:r>"
    : "<w:r><w:br/></w:r>";
}

function paragraphXml(planned: CanonicalPlannedParagraph): string {
  const opts = getCanonicalParagraphStyleOptions(planned.paragraph.style);
  const pPr: string[] = [];

  if (opts.center) pPr.push('<w:jc w:val="center"/>');

  const spacingAttrs: string[] = [];
  if (typeof opts.spacingBefore === "number") spacingAttrs.push(`w:before="${opts.spacingBefore}"`);
  if (typeof opts.spacingAfter === "number") spacingAttrs.push(`w:after="${opts.spacingAfter}"`);
  if (typeof opts.lineHeightMultiple === "number") {
    const lineValue = Math.max(1, Math.round(opts.lineHeightMultiple * 240));
    spacingAttrs.push(`w:line="${lineValue}"`);
    spacingAttrs.push('w:lineRule="auto"');
  }
  if (spacingAttrs.length > 0) pPr.push(`<w:spacing ${spacingAttrs.join(" ")}/>`);

  if (typeof opts.indentLeft === "number" || typeof opts.hanging === "number") {
    const indentAttrs: string[] = [];
    if (typeof opts.indentLeft === "number") indentAttrs.push(`w:left="${opts.indentLeft}"`);
    if (typeof opts.hanging === "number") indentAttrs.push(`w:hanging="${opts.hanging}"`);
    pPr.push(`<w:ind ${indentAttrs.join(" ")}/>`);
  }

  if (opts.sectionDivider) {
    pPr.push(
      '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="000000"/></w:pBdr>'
    );
  }

  const pPrXml = pPr.length > 0 ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  const contentParts: string[] = [];

  if (planned.paragraph.semanticRole === "skillsLine") {
    for (const line of planned.lines) {
      if (line.breakBefore === "page") {
        contentParts.push(breakRunXml("page"));
      } else if (line.breakBefore === "line") {
        contentParts.push(breakRunXml("line"));
      }

      if (line.skillsLabel) {
        contentParts.push(runXml(line.skillsLabel, { ...opts, bold: true }));
      }
      if (line.text || !line.skillsLabel) {
        contentParts.push(runXml(line.text, opts));
      }
    }
  } else {
    let lineSegment = "";
    const flushLineSegment = () => {
      if (!lineSegment) return;
      contentParts.push(runXml(lineSegment, opts));
      lineSegment = "";
    };

    for (const line of planned.lines) {
      if (line.breakBefore === "page") {
        flushLineSegment();
        contentParts.push(breakRunXml("page"));
      }

      const lineText = line.bulletMarker ? `\u2022 ${line.text}` : line.text;
      if (!lineText) continue;
      lineSegment = lineSegment ? `${lineSegment} ${lineText}` : lineText;
    }

    flushLineSegment();
  }

  if (contentParts.length === 0) {
    contentParts.push(runXml(planned.paragraph.text, opts));
  }

  const contentXml = contentParts.join("");
  return `<w:p>${pPrXml}${contentXml}</w:p>`;
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

function documentXml(paragraphs: CanonicalPlannedParagraph[]): string {
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
  model: CanonicalResumeDocumentModel
): Promise<{ buffer: Buffer; pageCount: number }> {
  const measure = await createTimesMeasure();
  const paginationPlan = buildCanonicalPaginationPlan(model, measure);
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.folder("_rels")!.file(".rels", packageRelsXml());
  zip.folder("docProps")!.file("core.xml", corePropsXml());
  zip.folder("docProps")!.file("app.xml", appPropsXml());
  zip.folder("word")!.file("styles.xml", stylesXml());
  zip.folder("word")!.folder("_rels")!.file("document.xml.rels", documentRelsXml());
  zip.folder("word")!.file("document.xml", documentXml(paginationPlan.paragraphs));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return {
    buffer,
    pageCount: paginationPlan.pageCount,
  };
}

async function createTimesMeasure(): Promise<CanonicalTextMeasure> {
  const measurePdfDoc = await PDFDocument.create();
  const regular = await measurePdfDoc.embedFont(StandardFonts.TimesRoman);
  const bold = await measurePdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await measurePdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const boldItalic = await measurePdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const fonts: Record<"regular" | "bold" | "italic" | "boldItalic", PDFFont> = {
    regular,
    bold,
    italic,
    boldItalic,
  };

  return {
    widthOfTextAtSize: (text, font, fontSize) =>
      fonts[font].widthOfTextAtSize(text, fontSize),
  };
}
