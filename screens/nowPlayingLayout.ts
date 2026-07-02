interface NowPlayingScreenSize {
  width: number;
  height: number;
}

interface NowPlayingLayoutMetrics {
  coverSize: number;
  coverAreaHeight: number;
  queueCardMaxHeight: number;
  glowLeft: number;
  /** Height of a single snap page, based on the measured available content area. */
  snapPageHeight: number;
  /** Height of the queue page list area inside the second snap page. */
  detailPageListHeight: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const buildNowPlayingLayoutMetrics = ({
  width,
  height,
}: NowPlayingScreenSize): NowPlayingLayoutMetrics => {
  const safeWidth = Math.max(1, width);
  const availableHeight = Math.max(1, height);
  const horizontalGutter = safeWidth < 340 ? 48 : 64;
  const maxCoverByWidth = Math.max(148, safeWidth - horizontalGutter);
  const maxCoverByHeight = Math.floor(availableHeight * (availableHeight < 620 ? 0.34 : 0.4));
  const minCover = availableHeight < 560 ? 156 : 196;
  const effectiveMinCover = Math.min(minCover, maxCoverByWidth);
  const coverSize = Math.floor(clamp(maxCoverByHeight, effectiveMinCover, maxCoverByWidth));
  const coverAreaHeight = coverSize + (availableHeight < 560 ? 12 : 18);
  const snapPageHeight = availableHeight;
  const detailPageListHeight = Math.max(240, Math.floor(availableHeight - 84));

  return {
    coverSize,
    coverAreaHeight,
    queueCardMaxHeight: detailPageListHeight,
    glowLeft: safeWidth / 2 - 130,
    snapPageHeight,
    detailPageListHeight,
  };
};
