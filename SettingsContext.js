import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULTS_KEY = '@premarket_edge_defaults';

const DEFAULT_SETTINGS = {
  accountBalance: '10000',
  riskPercentage: '1.5',
  optionDelta: '0.50',
};

export const SettingsContext = createContext({
  settings: DEFAULT_SETTINGS,
  saveSettings: () => {},
});

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(DEFAULTS_KEY)
      .then((v) => {
        if (v) setSettings((s) => ({ ...s, ...JSON.parse(v) }));
      })
      .catch(() => {});
  }, []);

  const saveSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(DEFAULTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
