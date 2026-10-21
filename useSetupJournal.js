import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Setup journal: persisted log of graded trade setups (entry/stop/target +
// the engine's sizing snapshot). Newest first, capped at JOURNAL_CAP so the
// AsyncStorage payload stays small forever.
const JOURNAL_KEY = '@premarket_edge_journal';
const JOURNAL_CAP = 50;

const persist = (next) => {
  AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(next)).catch(() => {});
};

export const useSetupJournal = () => {
  const [entries, setEntries] = useState([]);
  const [isReady, setIsReady] = useState(false);

  // Hydrate on mount
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(JOURNAL_KEY)
      .then((v) => {
        if (v && alive) {
          const parsed = JSON.parse(v);
          if (Array.isArray(parsed)) setEntries(parsed);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setIsReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const saveSetup = useCallback((setup) => {
    setEntries((prev) => {
      const entry = {
        id: `setup_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        ts: Date.now(),
        ...setup,
      };
      const next = [entry, ...prev].slice(0, JOURNAL_CAP);
      persist(next);
      return next;
    });
  }, []);

  const clearJournal = useCallback(() => {
    setEntries(() => {
      persist([]);
      return [];
    });
  }, []);

  return { entries, isReady, saveSetup, clearJournal };
};
