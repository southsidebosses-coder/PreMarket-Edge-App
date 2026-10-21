/**
 * Unit tests for src/hooks/useSetupJournal.js
 *
 * Covers: save → newest-first + AsyncStorage write-through, the 50-entry
 * cap (oldest dropped), clearJournal, and hydration from cache on mount.
 *
 * Uses the proven RTL v14 / React 19 interaction pattern from
 * usePositionSizer.test.js: every state-touching call is wrapped in
 * `await act(async () => ...)` — bare sync act() does not reliably flush
 * commits in this environment.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSetupJournal } from '../src/hooks/useSetupJournal';

const JOURNAL_KEY = '@premarket_edge_journal';

const SETUP_A = {
  date: '2026-10-15',
  entry: '100',
  stop: '95',
  target: '112.50',
  maxShares: 30,
  asymmetryRating: 'EXCELLENT',
  riskRewardRatio: 2.5,
  maxDollarLoss: 150,
};

beforeEach(() => {
  AsyncStorage.getItem.mockReset();
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockClear();
});

test('saveSetup prepends newest first and persists write-through', async () => {
  const { result } = await renderHook(() => useSetupJournal());

  await act(async () => {
    result.current.saveSetup(SETUP_A);
  });
  expect(result.current.entries).toHaveLength(1);
  expect(result.current.entries[0]).toMatchObject({
    entry: '100',
    maxShares: 30,
    asymmetryRating: 'EXCELLENT',
  });
  expect(result.current.entries[0].id).toMatch(/^setup_\d+_/);
  expect(result.current.entries[0].ts).toBeGreaterThan(0);

  const second = { ...SETUP_A, entry: '50', maxShares: 60, asymmetryRating: 'ACCEPTABLE' };
  await act(async () => {
    result.current.saveSetup(second);
  });
  expect(result.current.entries).toHaveLength(2);
  expect(result.current.entries[0].entry).toBe('50'); // newest first
  expect(result.current.entries[1].entry).toBe('100');

  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    JOURNAL_KEY,
    expect.stringContaining('"maxShares":60')
  );
});

test('journal caps at 50 entries, dropping the oldest', async () => {
  const seed = Array.from({ length: 50 }, (_, i) => ({
    id: `setup_seed_${i}`,
    ts: i,
    entry: String(i),
  }));
  AsyncStorage.getItem.mockResolvedValue(JSON.stringify(seed));

  const { result } = await renderHook(() => useSetupJournal());
  await waitFor(
    () => expect(result.current?.entries).toHaveLength(50),
    { timeout: 3000 }
  );

  await act(async () => {
    result.current.saveSetup({ ...SETUP_A, entry: '999' });
  });
  expect(result.current.entries).toHaveLength(50); // capped, not 51
  expect(result.current.entries[0].entry).toBe('999'); // newest at top
  expect(result.current.entries[49].id).toBe('setup_seed_48'); // oldest (seed_49) dropped
});

test('clearJournal empties the list and persists the empty state', async () => {
  const { result } = await renderHook(() => useSetupJournal());
  await act(async () => {
    result.current.saveSetup(SETUP_A);
  });
  expect(result.current.entries).toHaveLength(1);

  await act(async () => {
    result.current.clearJournal();
  });
  expect(result.current.entries).toHaveLength(0);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(JOURNAL_KEY, '[]');
});

test('hydrates a saved journal from cache on mount', async () => {
  const saved = [
    { id: 'setup_1', ts: 1, entry: '100', maxShares: 30, asymmetryRating: 'EXCELLENT' },
    { id: 'setup_2', ts: 2, entry: '50', maxShares: 60, asymmetryRating: 'ACCEPTABLE' },
  ];
  AsyncStorage.getItem.mockResolvedValue(JSON.stringify(saved));

  const { result } = await renderHook(() => useSetupJournal());

  await waitFor(
    () => {
      expect(result.current?.isReady).toBe(true);
      expect(result.current?.entries).toHaveLength(2);
    },
    { timeout: 3000 }
  );
  expect(result.current.entries[0].id).toBe('setup_1'); // order preserved
});
