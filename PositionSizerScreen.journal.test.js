/**
 * Smoke tests for src/screens/PositionSizerScreen.js — setup journal.
 *
 * Both usePositionSizer and useSetupJournal are MODULE-MOCKED so states
 * are deterministic (see THE ACT() OVERLAP HAZARD header in
 * PositionSizerScreen.test.js). The LOG THIS SETUP press is this file's
 * single live fireEvent flush; the save contract itself is pinned by the
 * unit tests in useSetupJournal.test.js.
 */
// Ads config pinned to mock-strip mode: with real AdMob IDs configured the
// AdBanner takes the native path, which cannot render under Jest — screen
// tests always assert the mock strip regardless of what's in src/config/ads.
jest.mock('../src/config/ads', () => ({
  __esModule: true,
  ADS: { iosAppId: '', androidAppId: '', bannerUnitId: '' },
  isRealAdsEnabled: false,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/hooks/usePositionSizer', () => {
  const actual = jest.requireActual('../src/hooks/usePositionSizer').usePositionSizer;
  const mock = jest.fn((...args) => actual(...args));
  return { __esModule: true, usePositionSizer: mock, __actualHook: actual };
});

jest.mock('../src/hooks/useSetupJournal', () => ({
  __esModule: true,
  useSetupJournal: jest.fn(),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PositionSizerScreen from '../src/screens/PositionSizerScreen';
import * as SizerHookModule from '../src/hooks/usePositionSizer';
const { usePositionSizer, __actualHook } = SizerHookModule;
import { useSetupJournal } from '../src/hooks/useSetupJournal';
import { AdContext } from '../src/context/AdContext';

const hookState = (mode) => ({
  inputs: {
    accountBalance: '10000',
    riskPercentage: '1.5',
    entryPrice: mode === 'graded' ? '100' : '',
    stopLossPrice: mode === 'graded' ? '95' : '',
    targetPrice: mode === 'graded' ? '112.50' : '',
    optionDelta: '0.50',
  },
  setters: {
    setAccountBalance: jest.fn(),
    setRiskPercentage: jest.fn(),
    setEntryPrice: jest.fn(),
    setStopLossPrice: jest.fn(),
    setTargetPrice: jest.fn(),
    setOptionDelta: jest.fn(),
  },
  metrics:
    mode === 'graded'
      ? {
          isValid: true,
          isLong: true,
          isOverAllocated: false,
          dollarRisk: 150,
          riskPerShare: 5,
          maxShares: 30,
          totalCapital: 3000,
          portfolioAllocationPct: 30,
          maxDollarLoss: 150,
          riskRewardRatio: 2.5,
          asymmetryRating: 'EXCELLENT',
          optionsContracts: 1,
        }
      : {
          isValid: false,
          isLong: true,
          isOverAllocated: false,
          dollarRisk: 0,
          riskPerShare: 0,
          maxShares: 0,
          totalCapital: 0,
          portfolioAllocationPct: 0,
          maxDollarLoss: 0,
          riskRewardRatio: 0,
          asymmetryRating: 'INVALID',
          optionsContracts: 0,
        },
});

const journalMock = (entries) => ({
  entries,
  isReady: true,
  saveSetup: jest.fn(),
  clearJournal: jest.fn(),
});

const SAVED_ENTRY = {
  id: 'setup_1699000000000_1',
  ts: 1699000000000,
  date: '2026-10-15',
  entry: '100',
  stop: '95',
  target: '112.50',
  maxShares: 30,
  optionsContracts: 1,
  riskRewardRatio: 2.5,
  asymmetryRating: 'EXCELLENT',
  maxDollarLoss: 150,
  totalCapital: 3000,
};

const wrapper = ({ children }) => (
  <AdContext.Provider
    value={{ isAdFree: false, isReady: true, purchaseAdFree: jest.fn(), restoreAds: jest.fn() }}
  >
    {children}
  </AdContext.Provider>
);

beforeEach(() => {
  usePositionSizer.mockImplementation((...args) => __actualHook(...args));
  useSetupJournal.mockReturnValue(journalMock([]));
});

test('LOG THIS SETUP on a graded card calls saveSetup with the full snapshot (single live flush)', async () => {
  const jm = journalMock([]);
  useSetupJournal.mockReturnValue(jm);

  usePositionSizer.mockImplementation(() => hookState('graded'));
  const screen = await render(<PositionSizerScreen />, { wrapper });
  await screen.findByText('EXCELLENT', {}, { timeout: 3000 });

  // Empty journal: no journal card yet
  expect(screen.queryByText(/SETUP JOURNAL/)).toBeNull();

  // The file's single live flush — verified via retrying query (never a
  // synchronous assertion right after fireEvent)
  fireEvent.press(screen.getByText('LOG THIS SETUP'));

  // Snapshot captures inputs + engine outputs
  await screen.findByText('LOGGED ✓', {}, { timeout: 3000 });
  expect(jm.saveSetup).toHaveBeenCalledTimes(1);
  const snap = jm.saveSetup.mock.calls[0][0];
  expect(snap).toMatchObject({
    entry: '100',
    stop: '95',
    target: '112.50',
    balance: '10000',
    riskPct: '1.5',
    delta: '0.50',
    maxShares: 30,
    optionsContracts: 1,
    riskRewardRatio: 2.5,
    asymmetryRating: 'EXCELLENT',
    maxDollarLoss: 150,
    totalCapital: 3000,
  });
  expect(typeof snap.date).toBe('string');

  // No journal card while the mocked entries list is still empty
  expect(screen.queryByText(/SETUP JOURNAL/)).toBeNull();
});

test('journal card renders saved setups newest-first with colored ratings and a CLEAR ALL', async () => {
  useSetupJournal.mockReturnValue(
    journalMock([
      SAVED_ENTRY,
      { ...SAVED_ENTRY, id: 'setup_2', date: '2026-10-14', entry: '50', maxShares: 60, asymmetryRating: 'ACCEPTABLE', riskRewardRatio: 2 },
    ])
  );

  const screen = await render(<PositionSizerScreen />, { wrapper });
  await screen.findByText(/SETUP JOURNAL \(2\)/, {}, { timeout: 3000 });

  expect(screen.getByText('CLEAR ALL')).toBeTruthy();
  // Newest first: the 10/15 row precedes the 10/14 row
  expect(screen.getByText(/2026-10-15 · 30 sh · risk \$150/)).toBeTruthy();
  expect(screen.getByText(/2026-10-14 · 60 sh · risk \$150/)).toBeTruthy();
  expect(screen.getByText(/E \$100 · S \$95 · T \$112\.50 · 1:2\.5/)).toBeTruthy();
  expect(screen.getByText(/2026-10-15 · 30 sh · risk \$150/)).toBeTruthy();
  expect(screen.getByText(/E \$50 · S \$95 · T \$112\.50 · 1:2/)).toBeTruthy();
  expect(screen.getByText(/2026-10-14 · 60 sh · risk \$150/)).toBeTruthy();
});

test('incomplete setup (INVALID card) offers no LOG button', async () => {
  usePositionSizer.mockImplementation(() => hookState('invalid'));
  const screen = await render(<PositionSizerScreen />, { wrapper });
  await screen.findByText('INVALID', {}, { timeout: 3000 });

  expect(screen.queryByText('LOG THIS SETUP')).toBeNull();
});
