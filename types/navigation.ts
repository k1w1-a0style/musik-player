import type { APP_STACK_ROUTES, APP_TAB_ROUTES } from './routes';

type ValueOf<T> = T[keyof T];

export type AppStackRouteName = ValueOf<typeof APP_STACK_ROUTES>;
export type AppTabRouteName = ValueOf<typeof APP_TAB_ROUTES>;

export type AppStackParamList = Record<AppStackRouteName, undefined | { songId: string }> & {
  MainTabs: undefined;
  NowPlaying: undefined;
  TrackInfo: { songId: string };
};

export type AppTabParamList = Record<AppTabRouteName, undefined>;
