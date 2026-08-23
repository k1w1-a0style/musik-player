export const SOUNDCLOUD_WAVEFORM_POINT_COUNT = 160;
export const SOUNDCLOUD_QUEUE_ROW_HEIGHT = 68;

const clampUnit = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

export const resolveSoundCloudSeekRatio = ({
  startRatio,
  translationX,
  travelWidth,
}: {
  startRatio: number;
  translationX: number;
  travelWidth: number;
}): number => {
  if (!Number.isFinite(travelWidth) || travelWidth <= 0) return clampUnit(startRatio);
  const safeTranslation = Number.isFinite(translationX) ? translationX : 0;
  return clampUnit(clampUnit(startRatio) - safeTranslation / travelWidth);
};

export const shouldCommitSoundCloudSwipe = ({
  translationX,
  translationY,
  velocityX,
  width,
}: {
  translationX: number;
  translationY: number;
  velocityX: number;
  width: number;
}): boolean => {
  if (![translationX, translationY, velocityX, width].every(Number.isFinite) || width <= 0) return false;
  const horizontalDistance = Math.abs(translationX);
  const hasHorizontalIntent = horizontalDistance >= 18
    && horizontalDistance > Math.abs(translationY) * 1.2;
  const passesDistance = horizontalDistance >= width * 0.26;
  const passesVelocity = Math.abs(velocityX) >= 850;
  return hasHorizontalIntent && (passesDistance || passesVelocity);
};

export const shouldCollapseSoundCloudPlayer = ({
  translationY,
  velocityY,
  height,
}: {
  translationY: number;
  velocityY: number;
  height: number;
}): boolean => {
  if (![translationY, velocityY, height].every(Number.isFinite) || height <= 0 || translationY <= 0) return false;
  return translationY >= height * 0.18 || velocityY >= 900;
};

export const shouldOpenSoundCloudQueue = ({
  translationX,
  translationY,
  velocityY,
  height,
}: {
  translationX: number;
  translationY: number;
  velocityY: number;
  height: number;
}): boolean => {
  if (![translationX, translationY, velocityY, height].every(Number.isFinite)
    || height <= 0 || translationY >= 0) return false;
  const verticalDistance = Math.abs(translationY);
  const hasVerticalIntent = verticalDistance > Math.abs(translationX) * 1.2;
  return hasVerticalIntent && (verticalDistance >= height * 0.12 || velocityY <= -850);
};

export const shouldCloseSoundCloudQueue = ({
  translationY,
  velocityY,
  height,
}: {
  translationY: number;
  velocityY: number;
  height: number;
}): boolean => {
  if (![translationY, velocityY, height].every(Number.isFinite)
    || height <= 0 || translationY <= 0) return false;
  return translationY >= height * 0.14 || velocityY >= 850;
};

export const getQueuePreviewOffset = ({
  index,
  dragIndex,
  targetIndex,
  rowHeight,
}: {
  index: number;
  dragIndex: number;
  targetIndex: number;
  rowHeight: number;
}): number => {
  if (index === dragIndex || rowHeight <= 0) return 0;
  if (dragIndex < targetIndex && index > dragIndex && index <= targetIndex) return -rowHeight;
  if (targetIndex < dragIndex && index >= targetIndex && index < dragIndex) return rowHeight;
  return 0;
};

export const resolveQueueReorderTargetIndex = ({
  index,
  dy,
  rowHeight,
  startScrollOffset,
  currentScrollOffset,
  minIndex,
  maxIndex,
}: {
  index: number;
  dy: number;
  rowHeight: number;
  startScrollOffset: number;
  currentScrollOffset: number;
  minIndex: number;
  maxIndex: number;
}): number => {
  const safeRowHeight = Math.max(1, Number.isFinite(rowHeight) ? rowHeight : 1);
  const scrollDelta = currentScrollOffset - startScrollOffset;
  const deltaRows = Math.round((dy + scrollDelta) / safeRowHeight);
  return Math.max(minIndex, Math.min(maxIndex, index + deltaRows));
};

export const resolveQueueAutoScrollDirection = ({
  index,
  dragY,
  movementDirection,
  scrollOffset,
  viewportHeight,
  rowHeight = SOUNDCLOUD_QUEUE_ROW_HEIGHT,
}: {
  index: number;
  dragY: number;
  movementDirection: -1 | 0 | 1;
  scrollOffset: number;
  viewportHeight: number;
  rowHeight?: number;
}): -1 | 0 | 1 => {
  if (viewportHeight <= 0) return 0;
  const edgeZone = rowHeight * 1.25;
  const visibleTop = index * rowHeight - scrollOffset + dragY;
  const visibleBottom = visibleTop + rowHeight;
  if (movementDirection < 0 && visibleTop < edgeZone) return -1;
  if (movementDirection > 0 && visibleBottom > viewportHeight - edgeZone) return 1;
  return 0;
};
