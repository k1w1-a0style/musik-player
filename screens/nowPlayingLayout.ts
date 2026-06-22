interface NowPlayingScreenSize {
  width: number;
  height: number;
}

interface NowPlayingLayoutMetrics {
  coverSize: number;
  coverAreaHeight: number;
  queueCardMaxHeight: number;
  glowLeft: number;
  /** Height of a single snap page – ideally equal to the screen content height. */
  snapPageHeight: number;
  /** Height of the queue page list area inside the second snap page. */
  detailPageListHeight: number;
}

export const buildNowPlayingLayoutMetrics = ({
  width,
  height,
}: NowPlayingScreenSize): NowPlayingLayoutMetrics => {
  // Bigger primary cover when we have the whole snap page to ourselves – clamp
  // so smaller phones don't crop it and tablets keep proportions.
  const coverSize = Math.min(width - 64, Math.max(220, Math.floor(height * 0.42)));
  const snapPageHeight = Math.max(480, height);
  return {
    coverSize,
    coverAreaHeight: coverSize + 24,
    queueCardMaxHeight: Math.min(360, Math.max(220, Math.floor(height * 0.5))),
    glowLeft: width / 2 - 130,
    snapPageHeight,
    detailPageListHeight: Math.max(320, Math.floor(height * 0.62)),
  };
};
