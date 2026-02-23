export type RewritePopoverPlacement = "right" | "left" | "clamped";

export interface RewritePopoverPositionArgs {
  anchorRect: {
    top: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
  popoverSize: { width: number; height: number };
  viewport: { width: number; height: number };
  gap?: number;
  margin?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeRewritePopoverPosition(args: RewritePopoverPositionArgs): {
  top: number;
  left: number;
  placement: RewritePopoverPlacement;
} {
  const gap = args.gap ?? 12;
  const margin = args.margin ?? 12;
  const { anchorRect, popoverSize, viewport } = args;

  const maxTop = Math.max(margin, viewport.height - margin - popoverSize.height);
  const top = Math.round(clamp(anchorRect.top, margin, maxTop));

  const rightCandidate = anchorRect.right + gap;
  const rightSpace = viewport.width - margin - rightCandidate;
  if (rightSpace >= popoverSize.width) {
    return {
      top,
      left: Math.round(rightCandidate),
      placement: "right",
    };
  }

  const leftCandidate = anchorRect.left - gap - popoverSize.width;
  if (leftCandidate >= margin) {
    return {
      top,
      left: Math.round(leftCandidate),
      placement: "left",
    };
  }

  const centeredLeft = anchorRect.left + anchorRect.width / 2 - popoverSize.width / 2;
  const maxLeft = Math.max(margin, viewport.width - margin - popoverSize.width);
  return {
    top,
    left: Math.round(clamp(centeredLeft, margin, maxLeft)),
    placement: "clamped",
  };
}
