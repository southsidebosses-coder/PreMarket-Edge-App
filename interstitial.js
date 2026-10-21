import { ADS, isRealAdsEnabled } from '../config/ads';

// Interstitial controller — same gate as the banner: everything is a no-op
// unless BOTH the global ads switch is on AND an interstitial unit ID is
// configured. The native module is required lazily inside the function
// body so Jest and Expo Go never touch it.
export const INTERSTITIAL_MIN_INTERVAL_MS = 180000; // 3 minutes between interstitials

// Pure frequency-cap decision (unit-tested): a valid past timestamp that is
// older than the interval allows a show; anything else (never shown, bad
// data, too recent) follows the cap.
export const shouldShowInterstitial = (lastShownTs, nowTs, minIntervalMs = INTERSTITIAL_MIN_INTERVAL_MS) => {
  if (typeof lastShownTs !== 'number' || !Number.isFinite(lastShownTs) || lastShownTs <= 0) return true;
  return nowTs - lastShownTs >= minIntervalMs;
};

let interstitialRef = null;
let lastShownTs = 0;

const loadNative = () => {
  const ads = require('react-native-google-mobile-ads');
  return ads;
};

export const maybeShowInterstitial = () => {
  // Gate 1: global ads switch + configured interstitial unit
  if (!isRealAdsEnabled || !ADS.interstitialUnitId) return false;
  // Gate 2: frequency cap (session-scoped)
  if (!shouldShowInterstitial(lastShownTs, Date.now())) return false;
  try {
    if (!interstitialRef) {
      const ads = loadNative();
      const unitId = __DEV__ ? ads.TestIds.INTERSTITIAL : ADS.interstitialUnitId;
      interstitialRef = ads.InterstitialAd.createForAdRequest(unitId, {
        requestAgent: 'premarket-edge',
      });
    }
    // Loaded on demand; show when ready. Errors (no fill, warm-up period)
    // are swallowed — the interstitial must never block the trading flow.
    interstitialRef.load();
    interstitialRef.show();
    lastShownTs = Date.now();
    return true;
  } catch (e) {
    return false;
  }
};

export const _resetForTests = () => {
  interstitialRef = null;
  lastShownTs = 0;
};
