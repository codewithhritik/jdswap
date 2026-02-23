"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import {
  computeRewritePopoverPosition,
  type RewritePopoverPlacement,
} from "@/lib/rewrite-overlay-position";

interface RewriteAssistantOverlayProps {
  open: boolean;
  anchorRect: DOMRect | null;
  anchorMeta?: {
    scrollX: number;
    scrollY: number;
  } | null;
  onClose: () => void;
  children: React.ReactNode;
  zIndexClassName?: string;
}

const MOBILE_BREAKPOINT = 1024;
const DESKTOP_POPOVER_MAX_WIDTH = 380;

export function RewriteAssistantOverlay({
  open,
  anchorRect,
  anchorMeta,
  onClose,
  children,
  zIndexClassName = "z-[70]",
}: RewriteAssistantOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    placement: RewritePopoverPlacement;
  }>({
    top: 12,
    left: 12,
    placement: "right",
  });
  const [popoverWidth, setPopoverWidth] = useState(DESKTOP_POPOVER_MAX_WIDTH);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const updateMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    updateMobile();
    window.addEventListener("resize", updateMobile);
    return () => window.removeEventListener("resize", updateMobile);
  }, [isMounted]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!isMounted || !open || isMobile || !anchorRect) return;

    let frame = 0;
    let observer: ResizeObserver | null = null;

    const updatePosition = () => {
      if (!panelRef.current) return;

      const panelBounds = panelRef.current.getBoundingClientRect();
      const nextWidth = Math.min(DESKTOP_POPOVER_MAX_WIDTH, window.innerWidth - 24);
      const nextHeight = panelBounds.height > 0 ? panelBounds.height : Math.min(window.innerHeight - 24, 700);
      const next = computeRewritePopoverPosition({
        anchorRect: {
          top: anchorRect.top,
          left: anchorRect.left,
          right: anchorRect.right,
          width: anchorRect.width,
          height: anchorRect.height,
        },
        popoverSize: { width: panelBounds.width > 0 ? panelBounds.width : nextWidth, height: nextHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });

      setPopoverWidth(nextWidth);
      setPosition((prev) => {
        if (
          prev.top === next.top &&
          prev.left === next.left &&
          prev.placement === next.placement
        ) {
          return prev;
        }
        return next;
      });
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePosition);
    };

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    if (panelRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => scheduleUpdate());
      observer.observe(panelRef.current);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      observer?.disconnect();
    };
  }, [anchorMeta, anchorRect, isMobile, isMounted, open]);

  const desktopInitialX = useMemo(() => {
    if (position.placement === "left") return -10;
    return 10;
  }, [position.placement]);

  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 pointer-events-none ${zIndexClassName}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-base/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.32 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          />

          {isMobile ? (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="false"
              aria-label="Rewrite assistant"
              className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-surface-border/80 bg-surface-elevated shadow-[0_-14px_40px_rgba(0,0,0,0.35)]"
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 22, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <div className="px-4 pb-5 pt-4 sm:px-5">{children}</div>
            </motion.div>
          ) : (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="false"
              aria-label="Rewrite assistant"
              className="pointer-events-auto fixed max-h-[calc(100vh-24px)] overflow-y-auto rounded-xl border border-surface-border/85 bg-surface-elevated shadow-[0_20px_56px_rgba(0,0,0,0.42)] backdrop-blur-[2px]"
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${popoverWidth}px`,
              }}
              initial={{ x: desktopInitialX, opacity: 0, scale: 0.985 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: desktopInitialX, opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.16, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <div className="p-3.5">{children}</div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
