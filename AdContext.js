import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme';

const STORAGE_KEY = '@premarket_edge_isAdFree';

export const AdContext = createContext({
  isAdFree: false,
  isReady: false,
  purchaseAdFree: () => {},
  restoreAds: () => {},
});

export const AdProvider = ({ children }) => {
  const [isAdFree, setIsAdFree] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Hydrate the purchase flag so "Remove Ads" survives app restarts.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'true') setIsAdFree(true);
      })
      .catch(() => {})
      .finally(() => setIsReady(true));
  }, []);

  // Mock IAP: in production this is where react-native-iap / expo-in-app-purchases
  // would resolve the $4.99 non-consumable, then flip the flag on success.
  const purchaseAdFree = useCallback(() => {
    setIsAdFree(true);
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
  }, []);

  const restoreAds = useCallback(() => {
    setIsAdFree(false);
    AsyncStorage.setItem(STORAGE_KEY, 'false').catch(() => {});
  }, []);

  return (
    <AdContext.Provider value={{ isAdFree, isReady, purchaseAdFree, restoreAds }}>
      {children}
    </AdContext.Provider>
  );
};

export const useAds = () => useContext(AdContext);

// Bottom-anchored mock AdMob banner. Unmounts completely when isAdFree === true,
// returning the screen real estate to content.
export const MockAdBanner = () => {
  const { isAdFree } = useAds();
  if (isAdFree) return null;

  return (
    <View style={adStyles.adContainer}>
      <Text style={adStyles.adLabel}>GOOGLE ADMOB MOCK BANNER</Text>
      <Text style={adStyles.adSub}>Upgrade to Pro in Settings to Remove Ads ($4.99)</Text>
    </View>
  );
};

const adStyles = StyleSheet.create({
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
