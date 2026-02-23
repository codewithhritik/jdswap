import { PDFDocument, StandardFonts, type PDFFont, rgb } from "pdf-lib";
import type { CanonicalResumeDocumentModel } from "./export-model";
import {
  BOTTOM_MARGIN,
  CONTENT_WIDTH,
  LEFT_MARGIN,
  LETTER_HEIGHT_POINTS,
  LETTER_WIDTH_POINTS,
  RIGHT_MARGIN,
  TOP_MARGIN,
  buildCanonicalPaginationPlan,
  type CanonicalFontKey,
} from "./canonical-pagination";

const TEXT_COLOR = rgb(0, 0, 0);

export interface RenderCanonicalResumePdfResult {
  bytes: Uint8Array;
  pageCount: number;
}

function pickFont(
  key: CanonicalFontKey,
  fonts: Record<CanonicalFontKey, PDFFont>
): PDFFont {
  return fonts[key];
}

export async function renderCanonicalResumePdf(
  model: CanonicalResumeDocumentModel
): Promise<RenderCanonicalResumePdfResult> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const boldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const fonts: Record<CanonicalFontKey, PDFFont> = {
    regular,
    bold,
    italic,
    boldItalic,
  };

  const plan = buildCanonicalPaginationPlan(model, {
    widthOfTextAtSize: (text, fontKey, fontSize) =>
      fonts[fontKey].widthOfTextAtSize(text, fontSize),
  });

  let page = pdfDoc.addPage([LETTER_WIDTH_POINTS, LETTER_HEIGHT_POINTS]);
  let y = LETTER_HEIGHT_POINTS - TOP_MARGIN;

  for (const planned of plan.paragraphs) {
    const style = planned.style;
    const paragraphFont = pickFont(style.fontKey, fonts);
    y -= style.spacingBefore;

    for (let i = 0; i < planned.lines.length; i += 1) {
      const line = planned.lines[i]!;
      if (line.breakBefore === "page") {
        page = pdfDoc.addPage([LETTER_WIDTH_POINTS, LETTER_HEIGHT_POINTS]);
        y = LETTER_HEIGHT_POINTS - TOP_MARGIN;
      }

      if (line.skillsLabel !== undefined) {
        const label = line.skillsLabel;
        const value = line.text;
        let valueX = style.baseX;

        if (label) {
          page.drawText(label, {
            x: style.baseX,
            y: y - style.fontSize,
            font: fonts.bold,
            size: style.fontSize,
            color: TEXT_COLOR,
          });
          valueX += fonts.bold.widthOfTextAtSize(label, style.fontSize);
        }

        if (value) {
          page.drawText(value, {
            x: valueX,
            y: y - style.fontSize,
            font: fonts.regular,
            size: style.fontSize,
            color: TEXT_COLOR,
          });
        }
      } else {
        let x = style.firstLineX;
        if (style.center) {
          const lineWidth = paragraphFont.widthOfTextAtSize(line.text, style.fontSize);
          x = LEFT_MARGIN + Math.max(0, (CONTENT_WIDTH - lineWidth) / 2);
        } else if (line.bulletMarker) {
          x = style.baseX;
        } else if (i > 0) {
          x = style.baseX;
        }

        if (line.bulletMarker) {
          page.drawText("\u2022", {
            x: style.bulletX,
            y: y - style.fontSize,
            font: paragraphFont,
            size: style.fontSize,
            color: TEXT_COLOR,
          });
        }

        page.drawText(line.text, {
          x,
          y: y - style.fontSize,
          font: paragraphFont,
          size: style.fontSize,
          color: TEXT_COLOR,
        });
      }

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
