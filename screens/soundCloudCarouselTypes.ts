import type React from 'react';
import type { Song } from '../types/Song';

export type SoundCloudCarouselPageRole = 'previous' | 'current' | 'next';

export interface SoundCloudCarouselRenderPageArgs {
  song: Song | null;
  role: SoundCloudCarouselPageRole;
}

export type SoundCloudCarouselRenderPage = (args: SoundCloudCarouselRenderPageArgs) => React.ReactNode;
