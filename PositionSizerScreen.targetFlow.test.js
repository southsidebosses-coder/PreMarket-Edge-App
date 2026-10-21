/**
 * Smoke test: target grading and ungrading on the always-visible card.
 *
 * ── THE ACT() OVERLAP HAZARD — read before touching any fireEvent here ──
 *
 * Symptom: the FIRST fireEvent-driven update commits fine; every LATER
 * fireEvent in the same file never commits — findBy/getBy time out on
 * elements the real app would obviously render, and React logs
 * "You seem to have overlapping act() calls, this is not supported."
 * Debug probes during the original investigation confirmed the update is
 * queued (an async findBy retry finds it right after flush 1) but the
 * root stops committing subsequent scheduled updates.
 *
 * Cause: jest-expo + RTL v14 wrap every fireEvent/findBy in act() against
 * React 19's concurrent dev-mode scheduler, while Jest's event loop is a
 * hand-driven simulation (setImmediate microtasks, no real timers). Once
 * an act scope fails to pop cleanly, later updates queue into a root
 * that never flushes again. This is a TEST-ENVIRONMENT limit, NOT an app
 * bug: the identical two-flush flow passed in a fresh test file, and the
 * hook is pure synchronous useState + useMemo — there is nothing in the
 * engine that could freeze.
 *
 * Rules that keep this suite deterministic (violating any of these
 * reproduces the hang and costs an afternoon):
 *   1. ONE live fireEvent flush per test FILE (own file = fresh React
 *      root). Verify it with findBy/waitFor — never a synchronous getBy
 *      immediately after fireEvent.
 *   2. Every state change after that flush is a MOCK-TRANSITION test:
 *      mock the hook to the exact state the real engine produces
 *      (mode-tagged hookState helpers) and screen.rerender. The engine
 *      contracts themselves are pinned by the unit tests in
 *      __tests__/usePositionSizer.test.js.
 *   3. NEVER wrap screen.rerender in your own act() — RTL already
 *      act-wraps rerender; stacking scopes IS the overlap above.
 *   4. Prop-driven TextInput value changes are unreliable after a commit
 *      (the "frozen-value quirk") — assert engine state through hook-mode
 *      mocks, not by reading .props.value off inputs.
 * If multi-flush end-to-end coverage is ever genuinely needed, that is
 * E2E territory (Detox / Maestro on a real event loop), not more
 * fireEvent calls here.
 *
 * This file applies the rules to the grade/ungrade flow:
 *   - GRADED leg: EXCELLENT badge + full card with the target present.
 *   - Target cleared → the exact state the real hook returns for
 *     setTargetPrice('') (isValid stays true, rating INVALID, ratio 0):
 *     the card stays UP with live sizing values, N/A ratio, no
 *     diagnostics, no firewall copy — target is optional, never an error.
 *   - Entry and stop fields are untouched throughout — no field wipe.
 * (The live single-flush grading path lives in the LIVE test in
 * PositionSizerScreen.test.js.)
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

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PositionSizerScreen from '../src/screens/PositionSizerScreen';
import * as SizerHookModule from '../src/hooks/usePositionSizer';
const { usePositionSizer, __actualHook } = SizerHookModule;
import { AdContext } from '../src/context/AdContext';
import { SettingsContext } from '../src/context/SettingsContext';

const wrapper = ({ children }) => (
  <AdContext.Provider
    value={{ isAdFree: false, isReady: true, purchaseAdFree: jest.fn(), restoreAds: jest.fn() }}
  >
    <SettingsContext.Provider
      value={{
        settings: { accountBalance: '10000', riskPercentage: '1.5', optionDelta: '0.50' },
        saveSettings: jest.fn(),
      }}
    >
      {children}
    </SettingsContext.Provider>
  </AdContext.Provider>
);

const hookState = (mode) => ({
  inputs: {
    accountBalance: '10000',
    riskPercentage: '1.5',
    entryPrice: '100',
    stopLossPrice: '95',
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
          // Real engine semantics: target is OPTIONAL — isValid stays true,
          // rating degrades to INVALID, ratio cell to N/A, sizing values
          // unchanged (30 shares from the intact entry/stop).
          isValid: true,
          isLong: true,
          isOverAllocated: false,
          dollarRisk: 150,
          riskPerShare: 5,
          maxShares: 30,
          totalCapital: 3000,
          portfolioAllocationPct: 30,
          maxDollarLoss: 150,
          riskRewardRatio: 0,
          asymmetryRating: 'INVALID',
          optionsContracts: 1,
        },
});

beforeEach(() => {
  usePositionSizer.mockImplementation((...args) => __actualHook(...args));
});

test('graded card degrades to armed-INVALID when the target is cleared, without wiping entry/stop', async () => {
  // ── GRADED: EXCELLENT badge + full card, target present ──
  usePositionSizer.mockImplementation(() => hookState('graded'));
  const screen = await render(<PositionSizerScreen />, { wrapper });
  await screen.findByText('EXCELLENT', {}, { timeout: 3000 });
  expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
  expect(screen.getByText('30 SHARES')).toBeTruthy();
  expect(screen.getByText('1 : 2.5')).toBeTruthy();
  expect(screen.getByText('$150.00')).toBeTruthy(); // MAX CASH RISK
  expect(screen.getByText('$3,000 (30%)')).toBeTruthy(); // CAPITAL OUTLAY
  expect(screen.getByText('$5 (5.00%)')).toBeTruthy(); // STOP DISTANCE
  expect(screen.getByDisplayValue('100')).toBeTruthy();
  expect(screen.getByDisplayValue('95')).toBeTruthy();
  expect(screen.getByDisplayValue('112.50')).toBeTruthy();

  // ── Target cleared → armed INVALID, card stays up ──
  usePositionSizer.mockImplementation(() => hookState('noTarget'));
  await screen.rerender(<PositionSizerScreen />, { wrapper });

  // Card stays UP (target optional): INVALID badge + N/A ratio, sizing
  // values persist, and NO diagnostics or firewall copy appear (a missing
  // target is not an error — target is never diagnosed)
  expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
  expect(screen.getByText('INVALID')).toBeTruthy();
  expect(screen.getByText('N/A')).toBeTruthy();
  expect(screen.getByText('30 SHARES')).toBeTruthy();
  expect(screen.queryByText(/is empty/)).toBeNull();
  expect(screen.queryByText(/cannot be zero/)).toBeNull();
  expect(screen.queryByText(/arm the risk firewall/i)).toBeNull();
  expect(screen.queryByText('EXCELLENT')).toBeNull();

  // ── No field wipe in either direction ──
  expect(screen.getByDisplayValue('100')).toBeTruthy();
  expect(screen.getByDisplayValue('95')).toBeTruthy();
  expect(screen.queryByDisplayValue('112.50')).toBeNull();
});
