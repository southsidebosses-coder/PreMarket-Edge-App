/**
 * Smoke tests: clearing entry, stop, or target on the always-visible card.
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
 * Clear-path semantics: incomplete setups (blank entry/stop) keep the
 * card up with a red INVALID badge, zeroed cells, and per-field
 * empty-vs-zero hints; clearing the optional target keeps the card ARMED
 * with the INVALID badge and an N/A ratio (target is optional, never an
 * error). All legs here are mock transitions (rule 2); the live
 * keystroke path is covered by the LIVE test in
 * PositionSizerScreen.test.js. The cleared field is asserted as
 * still-mounted and hook-controlled rather than visually blank (rule 4),
 * and negative getByDisplayValue checks are avoided — they raced with
 * act scopes (rule 3's overlap, observed firsthand).
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
import { render, waitFor } from '@testing-library/react-native';
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

const hookState = (mode, inputs) => ({
  inputs: {
    accountBalance: '10000',
    riskPercentage: '1.5',
    entryPrice: '100',
    stopLossPrice: '95',
    targetPrice: '112.50',
    optionDelta: '0.50',
    ...inputs,
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
      : mode === 'noTarget'
        ? {
            // Real engine semantics: target is OPTIONAL. With valid levels
            // and no target the setup stays isValid=true — the card stays
            // up with an INVALID badge and an N/A ratio cell.
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

beforeEach(() => {
  usePositionSizer.mockImplementation((...args) => __actualHook(...args));
});

test('clearing the target keeps the card armed with INVALID badge and N/A ratio — no wipe of entry/stop', async () => {
  usePositionSizer.mockImplementation(() => hookState('graded'));
  const screen = await render(<PositionSizerScreen />, { wrapper });
  await screen.findByText('EXCELLENT', {}, { timeout: 3000 });
  expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
  expect(screen.getByDisplayValue('100')).toBeTruthy();
  expect(screen.getByDisplayValue('95')).toBeTruthy();

  // Trader clears the OPTIONAL target → engine stays isValid=true
  usePositionSizer.mockImplementation(() => hookState('noTarget', { targetPrice: '' }));
  await screen.rerender(<PositionSizerScreen />, { wrapper });

  // Card stays UP (target is optional), badge degrades to the red INVALID
  // tier — explicit label + colors, same matcher style as the tier tests
  const badgeText = screen.getByText('INVALID');
  expect(badgeText).toBeTruthy();
  const list = Array.isArray(badgeText.props.style) ? badgeText.props.style : [badgeText.props.style];
  expect(list.find((st) => st && 'color' in st).color).toBe('#FF5252'); // badge text red
  const badgeView = badgeText.parent;
  const vlist = Array.isArray(badgeView.props.style) ? badgeView.props.style : [badgeView.props.style];
  expect(vlist.find((st) => st && 'backgroundColor' in st).backgroundColor).toBe('rgba(255, 82, 82, 0.15)');
  expect(vlist.find((st) => st && 'borderColor' in st).borderColor).toBe('#FF5252');

  // Ratio cell explicitly degrades to N/A (riskRewardRatio 0) while sizing
  // values stay live: 30 shares from the unchanged entry/stop levels
  expect(screen.getByText('N/A')).toBeTruthy();
  expect(screen.getByText('30 SHARES')).toBeTruthy();
  expect(screen.getByText(/Contract\(s\) \(Delta 0\.50\)/)).toBeTruthy();

  // No diagnostics: a missing target is not an error — target is not diagnosed
  expect(screen.queryByText(/is empty/)).toBeNull();
  expect(screen.queryByText(/cannot be zero/)).toBeNull();
  expect(screen.queryByText(/arm the risk firewall/i)).toBeNull();

  // Entry/stop untouched
  expect(screen.getByDisplayValue('100')).toBeTruthy();
  expect(screen.getByDisplayValue('95')).toBeTruthy();
});

test('clearing the entry flips the card to the red INVALID badge with zeroed cells and its own hint', async () => {
  usePositionSizer.mockImplementation(() => hookState('graded'));
  const screen = await render(<PositionSizerScreen />, { wrapper });
  await screen.findByText('EXCELLENT', {}, { timeout: 3000 });
  expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();

  usePositionSizer.mockImplementation(() => hookState('invalid', { entryPrice: '' }));
  await screen.rerender(<PositionSizerScreen />, { wrapper });

  // Card STAYS VISIBLE — armed-off, not hidden
  expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();

  // Red INVALID badge, explicit identity
  const badgeText = screen.getByText('INVALID');
  const list = Array.isArray(badgeText.props.style) ? badgeText.props.style : [badgeText.props.style];
  expect(list.find((st) => st && 'color' in st).color).toBe('#FF5252');
  const badgeView = badgeText.parent;
  const vlist = Array.isArray(badgeView.props.style) ? badgeView.props.style : [badgeView.props.style];
  expect(vlist.find((st) => st && 'backgroundColor' in st).backgroundColor).toBe('rgba(255, 82, 82, 0.15)');
  expect(vlist.find((st) => st && 'borderColor' in st).borderColor).toBe('#FF5252');

  // Zeroed directive cells (no computable sizing without an entry)
  expect(screen.getByText('0 SHARES')).toBeTruthy();
  expect(screen.getByText('N/A')).toBeTruthy();
  expect(screen.getByText('$0.00')).toBeTruthy();
  expect(screen.getByText('$0 (0%)')).toBeTruthy();

  // Firewall copy + the entry field's own hint (only the entry)
  expect(screen.getByText(/arm the risk firewall/i)).toBeTruthy();
  expect(screen.getByText(/Entry Price is empty — enter a value\./)).toBeTruthy();
  expect(screen.queryByText(/Stop Loss is empty/)).toBeNull();

  // Stop/target survive untouched
  expect(screen.getByDisplayValue('95')).toBeTruthy();
  expect(screen.getByDisplayValue('112.50')).toBeTruthy();
});

test('clearing the stop flips the card to the red INVALID badge with zeroed cells and its own hint', async () => {
  usePositionSizer.mockImplementation(() => hookState('graded'));
  const screen = await render(<PositionSizerScreen />, { wrapper });
  await screen.findByText('EXCELLENT', {}, { timeout: 3000 });

  // Pre-clear: the EXCELLENT badge carries its full mint identity — the
  // same explicit style as the INVALID assertions below
  const preBadge = screen.getByText('EXCELLENT');
  const preList = Array.isArray(preBadge.props.style) ? preBadge.props.style : [preBadge.props.style];
  expect(preList.find((st) => st && 'color' in st).color).toBe('#00E676');
  const preView = preBadge.parent;
  const preViewList = Array.isArray(preView.props.style) ? preView.props.style : [preView.props.style];
  expect(preViewList.find((st) => st && 'backgroundColor' in st).backgroundColor).toBe('rgba(0, 230, 118, 0.15)');
  expect(preViewList.find((st) => st && 'borderColor' in st).borderColor).toBe('#00E676');
  expect(screen.getByText('$5 (5.00%)')).toBeTruthy(); // live stop distance

  usePositionSizer.mockImplementation(() => hookState('invalid', { stopLossPrice: '' }));
  await screen.rerender(<PositionSizerScreen />, { wrapper });

  // Card STAYS VISIBLE — armed-off with the red INVALID badge, explicit identity
  expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
  const badgeText = screen.getByText('INVALID');
  const list = Array.isArray(badgeText.props.style) ? badgeText.props.style : [badgeText.props.style];
  expect(list.find((st) => st && 'color' in st).color).toBe('#FF5252');
  const badgeView = badgeText.parent;
  const vlist = Array.isArray(badgeView.props.style) ? badgeView.props.style : [badgeView.props.style];
  expect(vlist.find((st) => st && 'backgroundColor' in st).backgroundColor).toBe('rgba(255, 82, 82, 0.15)');
  expect(vlist.find((st) => st && 'borderColor' in st).borderColor).toBe('#FF5252');

  // Zeroed directive cells; stop distance degrades to $0 but keeps the
  // percentage (entry 100 is still a valid denominator)
  expect(screen.getByText('0 SHARES')).toBeTruthy();
  expect(screen.getByText('N/A')).toBeTruthy();
  expect(screen.getByText('$0.00')).toBeTruthy();
  expect(screen.getByText('$0 (0%)')).toBeTruthy();
  expect(screen.getByText('$0 (0.00%)')).toBeTruthy();

  // Firewall copy + the stop field's own hint (only the stop)
  expect(screen.getByText(/arm the risk firewall/i)).toBeTruthy();
  expect(screen.getByText(/Stop Loss is empty — enter a value\./)).toBeTruthy();
  expect(screen.queryByText(/Entry Price is empty/)).toBeNull();

  // Entry/target survive untouched
  expect(screen.getByDisplayValue('100')).toBeTruthy();
  expect(screen.getByDisplayValue('112.50')).toBeTruthy();
});

test('clearing stop then target: INVALID card throughout, stop hint persists, no target hint, entry intact', async () => {
  usePositionSizer.mockImplementation(() => hookState('graded'));
  const screen = await render(<PositionSizerScreen />, { wrapper });
  await screen.findByText('EXCELLENT', {}, { timeout: 3000 });

  // ── Leg 1: clear the stop → INVALID card, entry + target intact ──
  usePositionSizer.mockImplementation(() => hookState('invalid', { stopLossPrice: '' }));
  await screen.rerender(<PositionSizerScreen />, { wrapper });

  expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
  expect(screen.getByText('INVALID')).toBeTruthy();
  expect(screen.getByText('0 SHARES')).toBeTruthy();
  await waitFor(
    () => expect(screen.getByText(/Stop Loss is empty — enter a value\./)).toBeTruthy(),
    { timeout: 3000 }
  );
  expect(screen.getByDisplayValue('100')).toBeTruthy();
  expect(screen.getByDisplayValue('112.50')).toBeTruthy();

  // ── Leg 2: then clear the target too → still INVALID; the stop hint
  //    persists and NO target hint appears (target is never diagnosed);
  //    entry has never been wiped across both transitions ──
  usePositionSizer.mockImplementation(() =>
    hookState('invalid', { stopLossPrice: '', targetPrice: '' })
  );
  await screen.rerender(<PositionSizerScreen />, { wrapper });

  expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
  expect(screen.getByText('INVALID')).toBeTruthy();
  expect(screen.queryByText('TRADE REJECTED')).toBeNull();
  expect(screen.getByText(/Stop Loss is empty — enter a value\./)).toBeTruthy();
  expect(screen.queryByText(/Target 1 is empty/)).toBeNull();
  expect(screen.getByDisplayValue('100')).toBeTruthy();
});
