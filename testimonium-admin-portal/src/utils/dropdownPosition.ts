export interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface DropdownPositionInput {
  triggerRect: RectLike;
  containerRect: RectLike | null;
  viewportWidth: number;
  viewportHeight: number;
  minWidth?: number;
  margin?: number;
  gap?: number;
}

export interface DropdownPositionResult {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

/**
 * Computes fixed-position coordinates and size for a floating dropdown menu so
 * narrow triggers keep a readable menu without overflowing or causing
 * horizontal scrollbars inside modals or narrow viewports.
 */
export function computeDropdownPosition({
  triggerRect,
  containerRect,
  viewportWidth,
  viewportHeight,
  minWidth = 200,
  margin = 8,
  gap = 6,
}: DropdownPositionInput): DropdownPositionResult {
  const boundLeft = containerRect
    ? Math.max(margin, containerRect.left + margin)
    : margin;
  const boundRight = containerRect
    ? Math.min(viewportWidth - margin, containerRect.right - margin)
    : viewportWidth - margin;

  const availableWidth = Math.max(120, boundRight - boundLeft);
  const width = Math.min(Math.max(triggerRect.width, minWidth), availableWidth);

  let left = triggerRect.left;
  if (left + width > boundRight) {
    left = Math.max(boundLeft, Math.min(triggerRect.right - width, boundRight - width));
  }
  if (left < boundLeft) {
    left = boundLeft;
  }

  const spaceBelow = viewportHeight - triggerRect.bottom - margin;
  const spaceAbove = triggerRect.top - margin;
  const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(150, (openUpward ? spaceAbove : spaceBelow) - gap);

  return {
    left,
    width,
    maxHeight,
    ...(openUpward
      ? { bottom: viewportHeight - triggerRect.top + gap }
      : { top: triggerRect.bottom + gap }),
  };
}

