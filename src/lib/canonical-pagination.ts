import type { CanonicalParagraph, CanonicalResumeDocumentModel } from "./export-model";
import { getCanonicalParagraphStyleOptions } from "./export-model";

export const LETTER_WIDTH_POINTS = 612;
export const LETTER_HEIGHT_POINTS = 792;
export const TWIPS_PER_POINT = 20;

export const LEFT_MARGIN = 640 / TWIPS_PER_POINT;
export const RIGHT_MARGIN = 640 / TWIPS_PER_POINT;
export const TOP_MARGIN = 680 / TWIPS_PER_POINT;
export const BOTTOM_MARGIN = 680 / TWIPS_PER_POINT;
export const CONTENT_WIDTH = LETTER_WIDTH_POINTS - LEFT_MARGIN - RIGHT_MARGIN;

const MIN_LINE_WIDTH = 1;
const BULLET_PREFIX_REGEX = /^\s*\u2022\s*/;

export type CanonicalFontKey = "regular" | "bold" | "italic" | "boldItalic";
export type CanonicalLineBreak = "none" | "line" | "page";

export interface CanonicalTextMeasure {
  widthOfTextAtSize: (
    text: string,
    font: CanonicalFontKey,
    fontSize: number
  ) => number;
}

export interface CanonicalPlannedParagraphStyle {
  fontKey: CanonicalFontKey;
  fontSize: number;
  lineHeight: number;
  spacingBefore: number;
  spacingAfter: number;
  indentLeft: number;
  hanging: number;
  center: boolean;
  sectionDivider: boolean;
  maxWidth: number;
  baseX: number;
  firstLineX: number;
  bulletX: number;
}

export interface CanonicalPlannedLine {
  breakBefore: CanonicalLineBreak;
  text: string;
  skillsLabel?: string;
  bulletMarker?: boolean;
}

export interface CanonicalPlannedParagraph {
  paragraph: CanonicalParagraph;
  style: CanonicalPlannedParagraphStyle;
  lines: CanonicalPlannedLine[];
}

export interface CanonicalPaginationPlan {
  paragraphs: CanonicalPlannedParagraph[];
  pageCount: number;
}

interface UnbrokenLine {
  text: string;
  skillsLabel?: string;
  bulletMarker?: boolean;
}

function twipsToPoints(value?: number): number {
  return typeof value === "number" ? value / TWIPS_PER_POINT : 0;
}

function fontSizeFromHalfPoints(value?: number): number {
  return typeof value === "number" ? value / 2 : 10.5;
}

function resolveFontKey(bold?: boolean, italic?: boolean): CanonicalFontKey {
  if (bold && italic) return "boldItalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "regular";
}

function buildParagraphStyle(
  paragraph: CanonicalParagraph
): CanonicalPlannedParagraphStyle {
  const opts = getCanonicalParagraphStyleOptions(paragraph.style);
  const fontSize = fontSizeFromHalfPoints(opts.fontSizeHalfPoints);
  const lineHeight = Math.max(12, fontSize * 1.24);
  const indentLeft = twipsToPoints(opts.indentLeft);
  const hanging = twipsToPoints(opts.hanging);
  const maxWidth = Math.max(MIN_LINE_WIDTH, CONTENT_WIDTH - indentLeft);
  const baseX = LEFT_MARGIN + indentLeft;

  return {
    fontKey: resolveFontKey(opts.bold, opts.italic),
    fontSize,
    lineHeight,
    spacingBefore: twipsToPoints(opts.spacingBefore),
    spacingAfter: twipsToPoints(opts.spacingAfter),
    indentLeft,
    hanging,
    center: Boolean(opts.center),
    sectionDivider: Boolean(opts.sectionDivider),
    maxWidth,
    baseX,
    firstLineX: baseX - hanging,
    bulletX: baseX - hanging,
  };
}

function splitSkillsLine(text: string): { label: string; value: string } | null {
  const separatorIndex = text.indexOf(":");
  if (separatorIndex <= 0) return null;
  return {
    label: text.slice(0, separatorIndex + 1),
    value: text.slice(separatorIndex + 1).trim(),
  };
}

function splitLongWord(
  word: string,
  maxWidth: number,
  measure: CanonicalTextMeasure,
  font: CanonicalFontKey,
  fontSize: number
): string[] {
  const pieces: string[] = [];
  let remaining = word;

  while (remaining.length > 0) {
    let nextSize = 1;
    while (
      nextSize <= remaining.length &&
      measure.widthOfTextAtSize(remaining.slice(0, nextSize), font, fontSize) <= maxWidth
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
  measure: CanonicalTextMeasure,
  font: CanonicalFontKey,
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

    if (measure.widthOfTextAtSize(candidate, font, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      flush();
    }

    const freshWidth = lineWidthForIndex(lineWidths, lineIndex);
    if (measure.widthOfTextAtSize(word, font, fontSize) <= freshWidth) {
      current = word;
      continue;
    }

    const pieces = splitLongWord(word, freshWidth, measure, font, fontSize);
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
  measure: CanonicalTextMeasure,
  font: CanonicalFontKey,
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
    wrapped.push(...wrapWords(words, [maxWidth], measure, font, fontSize));
  }

  return wrapped.length > 0 ? wrapped : [""];
}

function wrapTextWithFirstLineWidth(
  text: string,
  firstLineWidth: number,
  laterLineWidth: number,
  measure: CanonicalTextMeasure,
  font: CanonicalFontKey,
  fontSize: number
): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  return wrapWords(
    normalized.split(/\s+/).filter(Boolean),
    [firstLineWidth, laterLineWidth],
    measure,
    font,
    fontSize
  );
}

function planParagraphLines(
  paragraph: CanonicalParagraph,
  style: CanonicalPlannedParagraphStyle,
  measure: CanonicalTextMeasure
): UnbrokenLine[] {
  if (paragraph.semanticRole === "skillsLine") {
    const split = splitSkillsLine(paragraph.text);
    if (split) {
      const lines: UnbrokenLine[] = [];
      const labelWidth = measure.widthOfTextAtSize(split.label, "bold", style.fontSize);
      const firstValueWidth = style.maxWidth - labelWidth;
      const drawSkillValueOnNewLine = firstValueWidth < MIN_LINE_WIDTH * 8;
      const valueLines =
        split.value.length === 0
          ? []
          : drawSkillValueOnNewLine
            ? wrapText(split.value, style.maxWidth, measure, "regular", style.fontSize)
            : wrapTextWithFirstLineWidth(
                split.value,
                firstValueWidth,
                style.maxWidth,
                measure,
                "regular",
                style.fontSize
              );

      lines.push({
        skillsLabel: split.label,
        text:
          drawSkillValueOnNewLine || !valueLines[0]
            ? ""
            : ` ${valueLines[0]}`,
      });

      const startIndex = drawSkillValueOnNewLine ? 0 : 1;
      for (let i = startIndex; i < valueLines.length; i += 1) {
        lines.push({ skillsLabel: "", text: valueLines[i] ?? "" });
      }

      return lines;
    }
  }

  const isBullet =
    paragraph.style === "bullet" && BULLET_PREFIX_REGEX.test(paragraph.text);
  const text = isBullet
    ? paragraph.text.replace(BULLET_PREFIX_REGEX, "").trim()
    : paragraph.text;
  const wrapped = wrapText(text, style.maxWidth, measure, style.fontKey, style.fontSize);
  return wrapped.map((line, index) => ({
    text: line,
    bulletMarker: isBullet && index === 0,
  }));
}

export function buildCanonicalPaginationPlan(
  model: CanonicalResumeDocumentModel,
  measure: CanonicalTextMeasure
): CanonicalPaginationPlan {
  let y = LETTER_HEIGHT_POINTS - TOP_MARGIN;
  let pageCount = 1;
  const plannedParagraphs: CanonicalPlannedParagraph[] = [];

  for (const paragraph of model.paragraphs) {
    const style = buildParagraphStyle(paragraph);
    const unbroken = planParagraphLines(paragraph, style, measure);
    const lines: CanonicalPlannedLine[] = [];

    y -= style.spacingBefore;

    for (let i = 0; i < unbroken.length; i += 1) {
      let breakBefore: CanonicalLineBreak = i === 0 ? "none" : "line";
      if (y - style.lineHeight < BOTTOM_MARGIN) {
        pageCount += 1;
        y = LETTER_HEIGHT_POINTS - TOP_MARGIN;
        breakBefore = "page";
      }

      lines.push({
        ...unbroken[i],
        breakBefore,
      });
      y -= style.lineHeight;
    }

    y -= style.spacingAfter;
    plannedParagraphs.push({ paragraph, style, lines });
  }

  return {
    paragraphs: plannedParagraphs,
    pageCount,
  };
}
