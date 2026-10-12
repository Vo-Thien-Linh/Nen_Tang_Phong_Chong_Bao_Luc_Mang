export function computePopoverPlacement({ anchorRect, popoverSize, viewport, gap = 8 }) {
  const safeGap = Number(gap) || 0;
  const spaceAbove = anchorRect.top;
  const spaceBelow = viewport.height - anchorRect.bottom;
  const placement = spaceAbove >= popoverSize.height + safeGap || spaceAbove >= spaceBelow
    ? 'top'
    : 'bottom';

  const rawTop = placement === 'top'
    ? anchorRect.top - popoverSize.height - safeGap
    : anchorRect.bottom + safeGap;

  const maxLeft = Math.max(safeGap, viewport.width - popoverSize.width - safeGap);
  const preferredLeft = anchorRect.left;
  const left = Math.min(Math.max(preferredLeft, safeGap), maxLeft);
  const top = Math.max(safeGap, Math.min(rawTop, viewport.height - popoverSize.height - safeGap));

  return { placement, top, left };
}

export function hasMeasuredPopoverSize(popoverSize) {
  return Number(popoverSize?.width || 0) > 0 && Number(popoverSize?.height || 0) > 0;
}

export function computeMeasuredPopoverPlacement({ anchorRect, popoverSize, viewport, gap = 8 }) {
  if (!hasMeasuredPopoverSize(popoverSize)) {
    return { ready: false, placement: 'top', top: 0, left: 0 };
  }

  return {
    ready: true,
    ...computePopoverPlacement({ anchorRect, popoverSize, viewport, gap }),
  };
}
