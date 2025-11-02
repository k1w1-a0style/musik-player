module.exports = {
 expo: {
    name: 'Musik Player',
    slug: 'com-musikplayer-k1w1',
    platforms: ['ios', 'android'],
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#00FF00'
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: ['**/*']
  }
};