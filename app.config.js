export default {
  expo: {
    name: 'neues-projekt',
    slug: 'neues-projekt',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    scheme: 'neues-projekt',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#000000'
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.k1w1.neuesprojekt'
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#000000'
      },
      package: 'com.k1w1.neuesprojekt'
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png'
    },
    plugins: [],
    experiments: {
      typedRoutes: false
    }
  }
};
