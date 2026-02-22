import { PDFDocument, StandardFonts, type PDFFont, rgb } from "pdf-lib";
import type { CanonicalParagraph, CanonicalResumeDocumentModel } from "./export-model";
import { getCanonicalParagraphStyleOptions } from "./export-model";

const LETTER_WIDTH_POINTS = 612;
const LETTER_HEIGHT_POINTS = 792;
const TWIPS_PER_POINT = 20;

const LEFT_MARGIN = 640 / TWIPS_PER_POINT;
const RIGHT_MARGIN = 640 / TWIPS_PER_POINT;
const TOP_MARGIN = 680 / TWIPS_PER_POINT;
const BOTTOM_MARGIN = 680 / TWIPS_PER_POINT;
const CONTENT_WIDTH = LETTER_WIDTH_POINTS - LEFT_MARGIN - RIGHT_MARGIN;

const TEXT_COLOR = rgb(0, 0, 0);
const BULLET_PREFIX_REGEX = /^\s*\u2022\s*/;
const MIN_LINE_WIDTH = 1;

export interface RenderCanonicalResumePdfResult {
  bytes: Uint8Array;
  pageCount: number;
}

interface ParagraphRenderStyle {
  font: PDFFont;
  fontSize: number;
  lineHeight: number;
  spacingBefore: number;
  spacingAfter: number;
  indentLeft: number;
  hanging: number;
  center: boolean;
  sectionDivider: boolean;
}

function twipsToPoints(value?: number): number {
  return typeof value === "number" ? value / TWIPS_PER_POINT : 0;
}

function fontSizeFromHalfPoints(value?: number): number {
  return typeof value === "number" ? value / 2 : 10.5;
}

function splitLongWord(
  word: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  const pieces: string[] = [];
  let remaining = word;

  while (remaining.length > 0) {
    let nextSize = 1;
    while (
      nextSize <= remaining.length &&
      font.widthOfTextAtSize(remaining.slice(0, nextSize), fontSize) <= maxWidth
    ) {
      nextSize += 1;
    }

    const cut = Math.max(1, nextSize - 1);
    pieces.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }

  return pieces;
}

function lineWidthForIndex(widths: number[], lineIndex: number): number {
  if (widths.length === 0) return CONTENT_WIDTH;
  const width = widths[Math.min(lineIndex, widths.length - 1)] ?? CONTENT_WIDTH;
  return Math.max(MIN_LINE_WIDTH, width);
}

function wrapWords(
  words: string[],
  lineWidths: number[],
  font: PDFFont,
  fontSize: number
): string[] {
  const lines: string[] = [];
  let lineIndex = 0;
  let current = "";

  const flush = () => {
    lines.push(current);
    current = "";
    lineIndex += 1;
  };

  for (const word of words) {
    const maxWidth = lineWidthForIndex(lineWidths, lineIndex);
    const candidate = current.length > 0 ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      flush();
    }

    const freshWidth = lineWidthForIndex(lineWidths, lineIndex);
    if (font.widthOfTextAtSize(word, fontSize) <= freshWidth) {
      current = word;
      continue;
    }

    const pieces = splitLongWord(word, freshWidth, font, fontSize);
    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i] ?? "";
      const isLast = i === pieces.length - 1;
      if (isLast) current = piece;
      else {
        lines.push(piece);
        lineIndex += 1;
      }
    }
  }

  if (current.length > 0 || lines.length === 0) {
    lines.push(current);
  }

  return lines;
}

function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  const normalized = text.trim();
  if (!normalized) return [""];

  const logicalParagraphs = normalized.split(/\r?\n/);
  const wrapped: string[] = [];
  for (const logical of logicalParagraphs) {
    const words = logical.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      wrapped.push("");
      continue;
    }
    wrapped.push(...wrapWords(words, [maxWidth], font, fontSize));
  }

  return wrapped.length > 0 ? wrapped : [""];
}

function wrapTextWithFirstLineWidth(
  text: string,
  firstLineWidth: number,
  laterLineWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  const normalized = text.trim();
  if (!normalized) return [""];
  return wrapWords(
    normalized.split(/\s+/).filter(Boolean),
    [firstLineWidth, laterLineWidth],
    font,
    fontSize
  );
}

function buildParagraphStyle(
  paragraph: CanonicalParagraph,
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
    italic: PDFFont;
    boldItalic: PDFFont;
  }
): ParagraphRenderStyle {
  const opts = getCanonicalParagraphStyleOptions(paragraph.style);
  const fontSize = fontSizeFromHalfPoints(opts.fontSizeHalfPoints);
  const lineHeight = Math.max(12, fontSize * 1.24);
  const font =
    opts.bold && opts.italic
      ? fonts.boldItalic
      : opts.bold
        ? fonts.bold
        : opts.italic
          ? fonts.italic
          : fonts.regular;

  return {
    font,
    fontSize,
    lineHeight,
    spacingBefore: twipsToPoints(opts.spacingBefore),
    spacingAfter: twipsToPoints(opts.spacingAfter),
    indentLeft: twipsToPoints(opts.indentLeft),
    hanging: twipsToPoints(opts.hanging),
    center: Boolean(opts.center),
    sectionDivider: Boolean(opts.sectionDivider),
  };
}

function splitSkillsLine(text: string): { label: string; value: string } | null {
  const separator = text.indexOf(":");
  if (separator <= 0) return null;
  return {
    label: text.slice(0, separator + 1),
    value: text.slice(separator + 1).trim(),
  };
}

export async function renderCanonicalResumePdf(
  model: CanonicalResumeDocumentModel
): Promise<RenderCanonicalResumePdfResult> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const boldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);

  const fonts = { regular, bold, italic, boldItalic };

  let page = pdfDoc.addPage([LETTER_WIDTH_POINTS, LETTER_HEIGHT_POINTS]);
  let y = LETTER_HEIGHT_POINTS - TOP_MARGIN;

  const ensureLineSpace = (lineHeight: number) => {
    if (y - lineHeight < BOTTOM_MARGIN) {
      page = pdfDoc.addPage([LETTER_WIDTH_POINTS, LETTER_HEIGHT_POINTS]);
      y = LETTER_HEIGHT_POINTS - TOP_MARGIN;
    }
  };

  for (const paragraph of model.paragraphs) {
    const style = buildParagraphStyle(paragraph, fonts);
    const baseX = LEFT_MARGIN + style.indentLeft;
    const maxWidth = Math.max(MIN_LINE_WIDTH, CONTENT_WIDTH - style.indentLeft);
    const genericFirstLineX = baseX - style.hanging;

    y -= style.spacingBefore;

    if (paragraph.semanticRole === "skillsLine") {
      const split = splitSkillsLine(paragraph.text);
      if (split) {
        const labelWidth = bold.widthOfTextAtSize(split.label, style.fontSize);
        const firstValueWidth = maxWidth - labelWidth;

        const drawSkillValueOnNewLine = firstValueWidth < MIN_LINE_WIDTH * 8;
        const valueLines = drawSkillValueOnNewLine
          ? wrapText(split.value, maxWidth, regular, style.fontSize)
          : wrapTextWithFirstLineWidth(
              split.value,
              firstValueWidth,
              maxWidth,
              regular,
              style.fontSize
            );

        ensureLineSpace(style.lineHeight);
        page.drawText(split.label, {
          x: baseX,
          y: y - style.fontSize,
          font: bold,
          size: style.fontSize,
          color: TEXT_COLOR,
        });

        if (!drawSkillValueOnNewLine && valueLines[0]) {
          page.drawText(valueLines[0], {
            x: baseX + labelWidth,
            y: y - style.fontSize,
            font: regular,
            size: style.fontSize,
            color: TEXT_COLOR,
          });
        }

        y -= style.lineHeight;

        const startIndex = drawSkillValueOnNewLine ? 0 : 1;
        for (let i = startIndex; i < valueLines.length; i += 1) {
          const line = valueLines[i] ?? "";
          ensureLineSpace(style.lineHeight);
          page.drawText(line, {
            x: baseX,
            y: y - style.fontSize,
            font: regular,
            size: style.fontSize,
            color: TEXT_COLOR,
          });
          y -= style.lineHeight;
        }

        if (style.sectionDivider) {
          const dividerY = y + Math.max(1, style.spacingAfter * 0.5);
          if (dividerY >= BOTTOM_MARGIN) {
            page.drawLine({
              start: { x: LEFT_MARGIN, y: dividerY },
              end: { x: LETTER_WIDTH_POINTS - RIGHT_MARGIN, y: dividerY },
              thickness: 0.8,
              color: TEXT_COLOR,
            });
          }
        }

        y -= style.spacingAfter;
        continue;
      }
    }

    const isBullet =
      paragraph.style === "bullet" && BULLET_PREFIX_REGEX.test(paragraph.text);
    const text = isBullet
      ? paragraph.text.replace(BULLET_PREFIX_REGEX, "").trim()
      : paragraph.text;
    const lines = wrapText(text, maxWidth, style.font, style.fontSize);
    const bulletX = baseX - style.hanging;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      ensureLineSpace(style.lineHeight);

      let x = genericFirstLineX;
      if (style.center) {
        const lineWidth = style.font.widthOfTextAtSize(line, style.fontSize);
        x = LEFT_MARGIN + Math.max(0, (CONTENT_WIDTH - lineWidth) / 2);
      } else if (isBullet) {
        x = baseX;
      } else if (i > 0) {
        x = baseX;
      }

      if (isBullet && i === 0) {
        page.drawText("\u2022", {
          x: bulletX,
          y: y - style.fontSize,
          font: style.font,
          size: style.fontSize,
          color: TEXT_COLOR,
        });
      }

      page.drawText(line, {
        x,
        y: y - style.fontSize,
        font: style.font,
        size: style.fontSize,
        color: TEXT_COLOR,
      });
      y -= style.lineHeight;
    }

    if (style.sectionDivider) {
      const dividerY = y + Math.max(1, style.spacingAfter * 0.5);
      if (dividerY >= BOTTOM_MARGIN) {
        page.drawLine({
          start: { x: LEFT_MARGIN, y: dividerY },
          end: { x: LETTER_WIDTH_POINTS - RIGHT_MARGIN, y: dividerY },
          thickness: 0.8,
          color: TEXT_COLOR,
        });
      }
    }

    y -= style.spacingAfter;
  }

  const bytes = await pdfDoc.save();
  return {
    bytes,
    pageCount: pdfDoc.getPageCount(),
  };
}
