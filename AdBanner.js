import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAds } from '../context/AdContext';
import { theme } from '../theme';
import { ADS, isRealAdsEnabled } from '../config/ads';

// Real AdMob banner — the native module is only required (lazy) when real
// unit IDs are configured, so Jest and Expo Go never touch it.
const RealAdMobBanner = () => {
  useEffect(() => {
    try {
      // Initialize the Mobile Ads SDK on first mount.
      require('react-native-google-mobile-ads').default?.initialize?.();
    } catch (e) {
      // Native module missing (Expo Go / tests) — strip stays as-is.
    }
  }, []);

  let BannerAd = null;
  let BannerAdSize = null;
  let unitId = ADS.bannerUnitId;
  try {
    const ads = require('react-native-google-mobile-ads');
    BannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
    // Google's public test IDs in dev — never tap real ads while developing.
    if (__DEV__) unitId = ads.TestIds.BANNER;
  } catch (e) {
    return null;
  }
  if (!BannerAd) return null;

  return (
    <View style={styles.realContainer} pointerEvents="none">
      <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
};

export const AdBanner = () => {
  const { isAdFree } = useAds();
  if (isAdFree) return null;

  return isRealAdsEnabled ? <RealAdMobBanner /> : <MockStrip />;
};

// Identical markup/height to the legacy MockAdBanner — screen tests pin it.
const MockStrip = () => (
  <View style={styles.adContainer}>
    <Text style={styles.adLabel}>GOOGLE ADMOB MOCK BANNER</Text>
    <Text style={styles.adSub}>Upgrade to Pro in Settings to Remove Ads ($4.99)</Text>
  </View>
);

const styles = StyleSheet.create({
  realContainer: {
    height: 50,
    backgroundColor: theme.adBg,
    borderTopWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adContainer: {
    height: 50,
    backgroundColor: theme.adBg,
    borderTopWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adLabel: { color: theme.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  adSub: { color: theme.dim, fontSize: 9, marginTop: 2 },
});
