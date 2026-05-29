interface NowPlayingScreenSize {
  width: number;
  height: number;
}

interface NowPlayingLayoutMetrics {
  coverSize: number;
  coverAreaHeight: number;
  queueCardMaxHeight: number;
  glowLeft: number;
}

export const buildNowPlayingLayoutMetrics = ({
  width,
  height,
}: NowPlayingScreenSize): NowPlayingLayoutMetrics => {
  const coverSize = Math.min(width - 118, Math.max(140, Math.floor(height * 0.20)));

  return {
    coverSize,
    coverAreaHeight: coverSize + 8,
    queueCardMaxHeight: Math.min(236, Math.max(132, Math.floor(height * 0.27))),
    glowLeft: width / 2 - 130,
  };
};
