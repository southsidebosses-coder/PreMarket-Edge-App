/**
 * Smoke test: journal review — tapping a row reloads that setup into the
 * sizer (the hook's own setters), completing the save → review → reuse loop.
 *
 * Own file = this file's single live interaction budget (see THE ACT()
 * OVERLAP HAZARD header in PositionSizerScreen.test.js). The assertions
 * are on the setters' jest.spy calls, which run synchronously inside the
 * press handler — no re-render commit needed, so multiple presses in one
 * test stay deterministic even under the flush hazard.
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

// Spy setters captured per render so the test can assert the reload calls.
let spySetters;

const makeSizerState = (inputs) => {
  const state = {
    inputs: {
      accountBalance: '10000',
      riskPercentage: '1.5',
      entryPrice: inputs?.entry ?? '100',
      stopLossPrice: inputs?.stop ?? '95',
      targetPrice: inputs?.target ?? '112.50',
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
    metrics: {
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
    },
  };
  spySetters = state.setters;
  return state;
};

const ENTRIES = [
  {
    id: 'setup_a', ts: 2, date: '2026-10-15', entry: '100', stop: '95', target: '112.50',
    balance: '25000', riskPct: '1', delta: '0.35', maxShares: 50, optionsContracts: 1,
    riskRewardRatio: 2.5, asymmetryRating: 'EXCELLENT', maxDollarLoss: 250, totalCapital: 5000,
  },
  {
    id: 'setup_b', ts: 1, date: '2026-10-14', entry: '50', stop: '52', target: '',
    balance: '10000', riskPct: '1.5', delta: '0.50', maxShares: 75, optionsContracts: 1,
    riskRewardRatio: 2, asymmetryRating: 'ACCEPTABLE', maxDollarLoss: 150, totalCapital: 3750,
  },
];

const wrapper = ({ children }) => (
  <AdContext.Provider
    value={{ isAdFree: false, isReady: true, purchaseAdFree: jest.fn(), restoreAds: jest.fn() }}
  >
    {children}
  </AdContext.Provider>
);

beforeEach(() => {
  usePositionSizer.mockImplementation((...args) => __actualHook(...args));
  useSetupJournal.mockReturnValue({
    entries: ENTRIES,
    isReady: true,
    saveSetup: jest.fn(),
    clearJournal: jest.fn(),
  });
});

test('tapping journal rows reloads each setup into the sizer setters', async () => {
  usePositionSizer.mockImplementation(() => makeSizerState());
  const screen = await render(<PositionSizerScreen />, { wrapper });
  await screen.findByText(/SETUP JOURNAL \(2\)/, {}, { timeout: 3000 });

  // ── Tap the newest row (graded long setup) → full reload ──
  fireEvent.press(screen.getByText(/E \$100 · S \$95 · T \$112\.50/));
  expect(spySetters.setAccountBalance).toHaveBeenCalledWith('25000');
  expect(spySetters.setRiskPercentage).toHaveBeenCalledWith('1');
  expect(spySetters.setEntryPrice).toHaveBeenCalledWith('100');
  expect(spySetters.setStopLossPrice).toHaveBeenCalledWith('95');
  expect(spySetters.setTargetPrice).toHaveBeenCalledWith('112.50');
  expect(spySetters.setOptionDelta).toHaveBeenCalledWith('0.35');

  // ── Tap the second row (targetless short) → target reloads as blank ──
  fireEvent.press(screen.getByText(/E \$50 · S \$52 · T —/));
  expect(spySetters.setEntryPrice).toHaveBeenLastCalledWith('50');
  expect(spySetters.setStopLossPrice).toHaveBeenLastCalledWith('52');
  expect(spySetters.setTargetPrice).toHaveBeenLastCalledWith(''); // optional target → blank
  expect(spySetters.setAccountBalance).toHaveBeenLastCalledWith('10000');
  expect(spySetters.setOptionDelta).toHaveBeenLastCalledWith('0.50');

  // Journal persists after review — rows are still on screen
  expect(screen.getByText(/SETUP JOURNAL \(2\)/)).toBeTruthy();
});
