// AdMob configuration — paste your IDs from https://apps.admarto.google.com
// (Apps → your app → App settings for the App ID; Ad units for the banner).
// While these are empty, the app renders the mock banner strip and the
// 55-test suite runs without the native module. Real ads additionally
// require a dev-client build (prebuild/EAS) — AdMob does NOT work in Expo Go.
export const ADS = {
  iosAppId: '',  // not yet created in AdMob (Android app only) — add when you register the iOS app
  androidAppId: 'ca-app-pub-2429928174841676~6523612445',
  bannerUnitId: 'ca-app-pub-2429928174841676/9162963083',
  interstitialUnitId: 'ca-app-pub-2429928174841676/8797412832',
};

export const isRealAdsEnabled = Boolean(ADS.bannerUnitId && (ADS.iosAppId || ADS.androidAppId));
export const isRealInterstitialEnabled = Boolean(ADS.interstitialUnitId && isRealAdsEnabled);
