"use client";

import { useCallback, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";

export const SPLIT_MIN = 0.3;
export const SPLIT_MAX = 0.7;
export const SPLIT_DEFAULT = 0.5;
const SPLIT_STEP = 0.02;

export function clampSplitRatio(value: number): number {
  if (!Number.isFinite(value)) return SPLIT_DEFAULT;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));
}

interface SplitHandleProps {
  /** Current split ratio (left pane share, already clamped to [SPLIT_MIN, SPLIT_MAX]). */
  ratio: number;
  /** Report a new ratio; caller is responsible for clamping/persisting. */
  onRatioChange: (next: number) => void;
  /** Container spanning both panes — used to translate pointer x into a ratio. */
  containerRef: RefObject<HTMLElement | null>;
  /** Fired on drag start/end so the caller can freeze transitions + text selection. */
  onDraggingChange?: (dragging: boolean) => void;
}

/**
 * Slim, keyboard-accessible drag handle that sits between the input/output panes
 * on desktop (md+). It is purely a controller: it never stores the ratio itself,
 * it only reports changes upward so a single source of truth (the page) can apply
 * the flex ratio and persist it.
 *
 * Hidden below md because the layout stacks vertically there and the split is not
 * user-resizable.
 */
export function SplitHandle({ ratio, onRatioChange, containerRef, onDraggingChange }: SplitHandleProps) {
  const applyFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      onRatioChange(clampSplitRatio((clientX - rect.left) / rect.width));
    },
    [containerRef, onRatioChange],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Only respond to the primary button / touch / pen contact.
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onDraggingChange?.(true);
    },
    [onDraggingChange],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Pointer capture guarantees we only get moves once a drag is underway.
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      applyFromClientX(event.clientX);
    },
    [applyFromClientX],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onDraggingChange?.(false);
    },
    [onDraggingChange],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowDown":
          event.preventDefault();
          onRatioChange(clampSplitRatio(ratio - SPLIT_STEP));
          break;
        case "ArrowRight":
        case "ArrowUp":
          event.preventDefault();
          onRatioChange(clampSplitRatio(ratio + SPLIT_STEP));
          break;
        case "Home":
          event.preventDefault();
          onRatioChange(SPLIT_MIN);
          break;
        case "End":
          event.preventDefault();
          onRatioChange(SPLIT_MAX);
          break;
        default:
          break;
      }
    },
    [ratio, onRatioChange],
  );

  const handleDoubleClick = useCallback(() => {
    onRatioChange(SPLIT_DEFAULT);
  }, [onRatioChange]);

  const percent = Math.round(ratio * 100);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize input and output panels"
      aria-valuenow={percent}
      aria-valuemin={Math.round(SPLIT_MIN * 100)}
      aria-valuemax={Math.round(SPLIT_MAX * 100)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      // ~10px hit area, full height, hidden on the stacked mobile layout.
      className="group relative hidden md:flex w-[10px] shrink-0 cursor-col-resize touch-none select-none items-center justify-center self-stretch rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
    >
      {/* 1px separator line */}
      <span className="pointer-events-none absolute h-full w-px bg-[var(--border)]" aria-hidden="true" />
      {/* 24px centered grip pill, brightens to amber on hover/drag/focus */}
      <span
        className="pointer-events-none relative h-6 w-[3px] rounded-full bg-[var(--border)] transition-colors duration-150 ease-out group-hover:bg-[var(--amber)] group-focus-visible:bg-[var(--amber)] group-active:bg-[var(--amber)] motion-reduce:transition-none"
        aria-hidden="true"
      />
    </div>
  );
}
