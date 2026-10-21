/**
 * Unit tests for src/ads/interstitial.js
 *
 * Only the PURE frequency-cap logic and the production-config gate are
 * tested here. The native module (react-native-google-mobile-ads) is never
 * imported at module scope — maybeShowInterstitial lazy-requires it inside
 * its try/catch, so under Jest the native path is swallowed and returns
 * false (the never-block-the-flow guarantee tested below). The native show
 * path is validated on device (README: Deployment readiness).
 */
import {
  shouldShowInterstitial,
  maybeShowInterstitial,
  INTERSTITIAL_MIN_INTERVAL_MS,
} from '../src/ads/interstitial';
import { ADS, isRealAdsEnabled } from '../src/config/ads';

describe('shouldShowInterstitial — frequency cap', () => {
  test('never-shown (0 / undefined / NaN / negative) → allow', () => {
    expect(shouldShowInterstitial(0, Date.now())).toBe(true);
    expect(shouldShowInterstitial(undefined, Date.now())).toBe(true);
    expect(shouldShowInterstitial(NaN, Date.now())).toBe(true);
    expect(shouldShowInterstitial(-5, Date.now())).toBe(true);
  });

  test('within the interval → block; after it → allow', () => {
    const now = 1_000_000_000_000;
    expect(shouldShowInterstitial(now - 1000, now)).toBe(false); // 1s ago
    expect(shouldShowInterstitial(now - INTERSTITIAL_MIN_INTERVAL_MS, now)).toBe(true); // exactly at interval
    expect(shouldShowInterstitial(now - INTERSTITIAL_MIN_INTERVAL_MS - 1, now)).toBe(true);
  });

  test('custom interval is honored', () => {
    const now = 1_000_000_000_000;
    expect(shouldShowInterstitial(now - 5000, now, 10000)).toBe(false);
    expect(shouldShowInterstitial(now - 10000, now, 10000)).toBe(true);
  });
});

describe('maybeShowInterstitial — production config + Jest safety', () => {
  test('production config carries all real Android units behind the real-ads switch', () => {
    // Prod IDs live in the shipped config; screen suites pin their own mock
    // mode via jest.mock('../src/config/ads') so they never load these.
    expect(isRealAdsEnabled).toBe(true);
    expect(ADS.androidAppId).toBe('ca-app-pub-2429928174841676~6523612445');
    expect(ADS.bannerUnitId).toBe('ca-app-pub-2429928174841676/9162963083');
    expect(ADS.interstitialUnitId).toBe('ca-app-pub-2429928174841676/8797412832');
  });

  test('returns false under Jest without crashing — the never-block-the-flow guard', () => {
    // With the real interstitial ID configured, gate 1 passes and the lazy
    // native require/create runs — under Jest the native module is absent,
    // so the try/catch must swallow it and return false. If this THROWS
    // instead of returning false, the guard regressed.
    expect(maybeShowInterstitial()).toBe(false);
  });
});
