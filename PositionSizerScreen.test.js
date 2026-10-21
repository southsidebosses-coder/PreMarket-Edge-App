/**
 * Smoke tests for src/screens/PositionSizerScreen.js
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
 * Suite split that follows from those rules:
 *   1. Tier-switch tests: render the screen once per tier with the hook
 *      mocked to that tier's exact metrics (non-interactive renders work
 *      repeatedly), asserting badge label AND colors per R:R tier, the
 *      short-setup notice, and the per-field empty-vs-zero diagnostics.
 *   2. ONE LIVE interaction test, run last in this file: real hook,
 *      fill the form via fireEvent, verify card + badge + grid through
 *      the single reliable flush.
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

const BADGE_TIERS = {
  EXCELLENT: { label: 'EXCELLENT', bg: 'rgba(0, 230, 118, 0.15)', border: '#00E676', text: '#00E676' },
  ACCEPTABLE: { label: 'ACCEPTABLE', bg: 'rgba(0, 176, 255, 0.15)', border: '#00B0FF', text: '#00B0FF' },
  REJECTED: { label: 'REJECTED', bg: 'rgba(255, 82, 82, 0.15)', border: '#FF5252', text: '#FF5252' },
  NEGATIVE_REWARD: { label: 'NEGATIVE REWARD', bg: 'rgba(255, 82, 82, 0.15)', border: '#FF5252', text: '#FF5252' },
};

// Context wrappers with plain values — keeps AsyncStorage out of component tests.
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

const makeHookValue = (overrides = {}) => {
  const value = {
    inputs: {
      accountBalance: '10000',
      riskPercentage: '1.5',
      entryPrice: '100',
      stopLossPrice: '95',
      targetPrice: '112.50',
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
      dollarRisk: 150,
      riskPerShare: 5,
      maxShares: 30,
      totalCapital: 3000,
      portfolioAllocationPct: 30,
      maxDollarLoss: 150,
      riskRewardRatio: 2.5,
      asymmetryRating: 'EXCELLENT',
      optionsContracts: 1,
      isOverAllocated: false,
    },
  };
  if (overrides.metrics) value.metrics = { ...value.metrics, ...overrides.metrics };
  if (overrides.inputs) value.inputs = { ...value.inputs, ...overrides.inputs };
  return value;
};

// Pull a style prop out of an RN style array (or single object).
const styleValue = (style, key) => {
  const list = Array.isArray(style) ? style : [style];
  const hit = list.find((s) => s && typeof s === 'object' && key in s);
  return hit ? hit[key] : undefined;
};

const expectBadge = (screen, tierKey) => {
  const tier = BADGE_TIERS[tierKey];
  const badgeText = screen.getByText(tier.label);

  // Text color (badgeTheme.text applied to badgeText style array)
  expect(styleValue(badgeText.props.style, 'color')).toBe(tier.text);

  // Badge View container: backgroundColor + borderColor
  const badgeView = badgeText.parent;
  expect(styleValue(badgeView.props.style, 'backgroundColor')).toBe(tier.bg);
  expect(styleValue(badgeView.props.style, 'borderColor')).toBe(tier.border);
};

describe('PositionSizerScreen — badge label & colors switch per R:R tier', () => {
  beforeEach(() => {
    usePositionSizer.mockImplementation((...args) => __actualHook(...args));
  });

  test('R:R ≥ 2.5 → EXCELLENT badge in Electric Mint (#00E676)', async () => {
    usePositionSizer.mockImplementation(() => makeHookValue({ metrics: { asymmetryRating: 'EXCELLENT', riskRewardRatio: 2.5 } }));
    const screen = await render(<PositionSizerScreen />, { wrapper });
    await screen.findByText('EXCELLENT', {}, { timeout: 3000 });
    expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
    expectBadge(screen, 'EXCELLENT');
    // The PUT notice belongs to the short path only — absent on long setups
    expect(screen.queryByText(/SHORT SETUP/)).toBeNull();
  });

  test('R:R 2.49 → ACCEPTABLE badge in Cyan Ice (#00B0FF)', async () => {
    usePositionSizer.mockImplementation(() => makeHookValue({ metrics: { asymmetryRating: 'ACCEPTABLE', riskRewardRatio: 2.49 } }));
    const screen = await render(<PositionSizerScreen />, { wrapper });
    await screen.findByText('ACCEPTABLE', {}, { timeout: 3000 });
    expectBadge(screen, 'ACCEPTABLE');
  });

  test('R:R 1.5 → ACCEPTABLE (lower cyan boundary)', async () => {
    usePositionSizer.mockImplementation(() => makeHookValue({ metrics: { asymmetryRating: 'ACCEPTABLE', riskRewardRatio: 1.5 } }));
    const screen = await render(<PositionSizerScreen />, { wrapper });
    await screen.findByText('ACCEPTABLE', {}, { timeout: 3000 });
    expectBadge(screen, 'ACCEPTABLE');
  });

  test('R:R < 1.5 → REJECTED badge in Crimson Coral (#FF5252) with warning copy and full card', async () => {
    usePositionSizer.mockImplementation(() => makeHookValue({ metrics: { asymmetryRating: 'REJECTED', riskRewardRatio: 1.0 } }));
    const screen = await render(<PositionSizerScreen />, { wrapper });
    await screen.findByText('REJECTED', {}, { timeout: 3000 });

    // Badge: red, correct label
    expectBadge(screen, 'REJECTED');

    // Warning copy: asymmetry rejection reason
    expect(screen.getByText('TRADE REJECTED')).toBeTruthy();
    expect(screen.getByText(/risk asymmetry below the 1 : 1.5 minimum/i)).toBeTruthy();

    // Full directive card still renders its values
    expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
    expect(screen.getByText('30 SHARES')).toBeTruthy();
    expect(screen.getByText(/1 Contract\(s\) \(Delta 0\.50\)/)).toBeTruthy();
    expect(screen.getByText('1 : 1')).toBeTruthy();
    expect(screen.getByText('$150.00')).toBeTruthy(); // MAX CASH RISK
    expect(screen.getByText('$3,000 (30%)')).toBeTruthy(); // CAPITAL OUTLAY
    expect(screen.getByText('$5 (5.00%)')).toBeTruthy(); // STOP DISTANCE
  });

  test('over-allocation → REJECTED badge + capital firewall copy + full card (despite R:R 50)', async () => {
    // Tiny stop distance sizes 999 shares = $49,950 outlay on a $10,000 account
    // (499.5%) — the capital firewall rejects it even though R:R is a juicy 50.
    usePositionSizer.mockImplementation(() =>
      makeHookValue({
        metrics: {
          asymmetryRating: 'REJECTED',
          riskRewardRatio: 50,
          isOverAllocated: true,
          maxShares: 999,
          totalCapital: 49950,
          portfolioAllocationPct: 499.5,
          maxDollarLoss: 199.8,
        },
      })
    );
    const screen = await render(<PositionSizerScreen />, { wrapper });
    await screen.findByText('REJECTED', {}, { timeout: 3000 });

    expectBadge(screen, 'REJECTED');
    expect(screen.getByText('TRADE REJECTED')).toBeTruthy();
    expect(screen.getByText(/capital outlay exceeds account balance/i)).toBeTruthy();

    expect(screen.getByText('999 SHARES')).toBeTruthy();
    expect(screen.getByText('1 : 50')).toBeTruthy();
    expect(screen.getByText('$199.80')).toBeTruthy(); // MAX CASH RISK
    expect(screen.getByText('$49,950 (499.5%)')).toBeTruthy(); // CAPITAL OUTLAY
    expect(screen.getByText('$5 (5.00%)')).toBeTruthy(); // STOP DISTANCE
  });

  test('wrong-side target → NEGATIVE REWARD badge (label gets the space, colors stay red)', async () => {
    usePositionSizer.mockImplementation(() => makeHookValue({ metrics: { asymmetryRating: 'NEGATIVE_REWARD', riskRewardRatio: 0 } }));
    const screen = await render(<PositionSizerScreen />, { wrapper });
    await screen.findByText('NEGATIVE REWARD', {}, { timeout: 3000 });
    expectBadge(screen, 'NEGATIVE_REWARD');
    // ratio 0 renders as N/A
    expect(screen.getByText('N/A')).toBeTruthy();
  });

  test('no-target INVALID setup overridden by the over-allocation firewall → REJECTED with N/A ratio', async () => {
    // The case the firewall exists for: NO target entered, so the R:R engine
    // has nothing to grade (riskRewardRatio 0 → would be INVALID / badge
    // hidden). But the sizing itself is not fundable — $2 risk budget, $0.20
    // stop distance → 999 shares × $50 = $49,950 outlay on a $10,000 account
    // (499.5%). The capital firewall rejects it and the card still renders,
    // with the ratio cell degrading to N/A.
    usePositionSizer.mockImplementation(() =>
      makeHookValue({
        inputs: { riskPercentage: '2', entryPrice: '50', stopLossPrice: '49.80', targetPrice: '' },
        metrics: {
          asymmetryRating: 'REJECTED',
          riskRewardRatio: 0,
          isOverAllocated: true,
          maxShares: 999,
          totalCapital: 49950,
          portfolioAllocationPct: 499.5,
          maxDollarLoss: 199.8,
          riskPerShare: 0.2,
          optionsContracts: 19,
        },
      })
    );
    const screen = await render(<PositionSizerScreen />, { wrapper });
    await screen.findByText('REJECTED', {}, { timeout: 3000 });

    expectBadge(screen, 'REJECTED');
    expect(screen.getByText('TRADE REJECTED')).toBeTruthy();
    expect(screen.getByText(/capital outlay exceeds account balance/i)).toBeTruthy();
    expect(screen.queryByText(/risk asymmetry below the 1 : 1.5 minimum/i)).toBeNull();

    expect(screen.getByText('999 SHARES')).toBeTruthy();
    expect(screen.getByText(/19 Contract\(s\) \(Delta 0\.50\)/)).toBeTruthy();
    expect(screen.getByText('N/A')).toBeTruthy(); // no target → ratio cell N/A
    expect(screen.getByText('$199.80')).toBeTruthy(); // MAX CASH RISK
    expect(screen.getByText('$49,950 (499.5%)')).toBeTruthy(); // CAPITAL OUTLAY
    expect(screen.getByText('$0.2 (0.40%)')).toBeTruthy(); // STOP DISTANCE
  });

  test('incomplete setup (blank levels) shows the always-on card: red INVALID badge, zeroed cells, per-field hints', async () => {
    // Blank entry/stop: the engine has nothing to size → isValid=false.
    // The card still renders — red INVALID badge, zeroed directive cells,
    // and per-field hints — instead of hiding (trader keeps context).
    usePositionSizer.mockImplementation(() =>
      makeHookValue({
        inputs: { entryPrice: '', stopLossPrice: '', targetPrice: '' },
        metrics: {
          isValid: false,
          asymmetryRating: 'INVALID',
          riskRewardRatio: 0,
          isOverAllocated: false,
          maxShares: 0,
          totalCapital: 0,
          portfolioAllocationPct: 0,
          maxDollarLoss: 0,
          riskPerShare: 0,
          optionsContracts: 0,
        },
      })
    );
    const screen = await render(<PositionSizerScreen />, { wrapper });
    await screen.findByText('Position Risk Engine', {}, { timeout: 3000 });

    // Card stays UP with the red INVALID badge — explicit identity
    expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
    const badgeText = screen.getByText('INVALID');
    const list = Array.isArray(badgeText.props.style) ? badgeText.props.style : [badgeText.props.style];
    expect(list.find((st) => st && 'color' in st).color).toBe('#FF5252');
    const badgeView = badgeText.parent;
    const vlist = Array.isArray(badgeView.props.style) ? badgeView.props.style : [badgeView.props.style];
    expect(vlist.find((st) => st && 'backgroundColor' in st).backgroundColor).toBe('rgba(255, 82, 82, 0.15)');
    expect(vlist.find((st) => st && 'borderColor' in st).borderColor).toBe('#FF5252');

    // Zeroed directive cells
    expect(screen.getByText('0 SHARES')).toBeTruthy();
    expect(screen.getByText('N/A')).toBeTruthy();
    expect(screen.getByText('$0.00')).toBeTruthy(); // MAX CASH RISK
    expect(screen.getByText('$0 (0%)')).toBeTruthy(); // CAPITAL OUTLAY

    // Firewall copy + per-field hints for the blank levels
    expect(screen.getByText(/arm the risk firewall/i)).toBeTruthy();
    expect(screen.getByText(/Entry Price is empty — enter a value\./)).toBeTruthy();
    expect(screen.getByText(/Stop Loss is empty — enter a value\./)).toBeTruthy();

    // Ad banner still shows
    expect(screen.getByText('GOOGLE ADMOB MOCK BANNER')).toBeTruthy();
  });

  test('SHORT setup (stop above entry): badge, PUT-contracts notice, and full directive card', async () => {
    // Short the tape: entry 95, stop 100 (risk/share $5), target 85 → reward
    // 10 / risk 5 = R:R 2.0 → ACCEPTABLE. Stop distance % = 5/95 = 5.26%.
    usePositionSizer.mockImplementation(() =>
      makeHookValue({
        inputs: { entryPrice: '95', stopLossPrice: '100', targetPrice: '85' },
        metrics: {
          isLong: false,
          asymmetryRating: 'ACCEPTABLE',
          riskRewardRatio: 2,
          maxShares: 30,
          optionsContracts: 1,
          totalCapital: 2850,
          portfolioAllocationPct: 28.5,
          maxDollarLoss: 150,
          riskPerShare: 5,
        },
      })
    );
    const screen = await render(<PositionSizerScreen />, { wrapper });
    await screen.findByText('ACCEPTABLE', {}, { timeout: 3000 });

    // Badge: cyan ACCEPTABLE for the 2:1 short
    expectBadge(screen, 'ACCEPTABLE');

    // PUT-contracts notice renders only on the short path
    expect(screen.getByText(/SHORT SETUP/)).toBeTruthy();
    expect(screen.getByText(/PUT contracts/)).toBeTruthy();

    // Full directive card — every grid cell, with short-specific values
    expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
    expect(screen.getByText('30 SHARES')).toBeTruthy();
    expect(screen.getByText(/1 Contract\(s\) \(Delta 0\.50\)/)).toBeTruthy();
    expect(screen.getByText('1 : 2')).toBeTruthy();
    expect(screen.getByText('$150.00')).toBeTruthy(); // MAX CASH RISK
    expect(screen.getByText('$2,850 (28.5%)')).toBeTruthy(); // CAPITAL OUTLAY
    expect(screen.getByText('$5 (5.26%)')).toBeTruthy(); // STOP DISTANCE (vs entry 95)
  });
});

describe('PositionSizerScreen — live interaction (real hook, first flush)', () => {
  beforeEach(() => {
    usePositionSizer.mockImplementation((...args) => __actualHook(...args));
  });

  test('initial state is ad-funded with the INVALID card; filling the form grades EXCELLENT', async () => {
    const screen = await render(<PositionSizerScreen />, { wrapper });
    await screen.findByText('Position Risk Engine', {}, { timeout: 3000 });

    // Ad-funded tier shows the banner; the directive card is always visible —
    // the invalid setup renders a red INVALID badge with zeroed cells + hints.
    expect(screen.getByText('GOOGLE ADMOB MOCK BANNER')).toBeTruthy();
    expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
    expect(screen.getByText('INVALID')).toBeTruthy();
    expect(screen.getByText('0 SHARES')).toBeTruthy();
    expect(screen.getByText(/arm the risk firewall/i)).toBeTruthy();
    expect(screen.getByText(/Entry Price is empty/)).toBeTruthy();
    expect(screen.getByText(/Stop Loss is empty/)).toBeTruthy();

    // Fill: balance & risk come from Settings defaults ('10000', '1.5').
    const [entryInput, stopInput] = screen.getAllByPlaceholderText('0.00');
    fireEvent.changeText(entryInput, '100');
    fireEvent.changeText(stopInput, '95');
    fireEvent.changeText(screen.getByPlaceholderText('Optional'), '112.50'); // R:R 2.5

    await screen.findByText('EXCELLENT', {}, { timeout: 3000 });
    expectBadge(screen, 'EXCELLENT');
    expect(screen.getByText('SIZING DIRECTIVE')).toBeTruthy();
    expect(screen.getByText('30 SHARES')).toBeTruthy();
    expect(screen.getByText(/1 Contract\(s\) \(Delta 0\.50\)/)).toBeTruthy();
    expect(screen.getByText('1 : 2.5')).toBeTruthy();
    expect(screen.getByText('$150.00')).toBeTruthy(); // MAX CASH RISK
    expect(screen.getByText('$3,000 (30%)')).toBeTruthy(); // CAPITAL OUTLAY
    expect(screen.getByText('$5 (5.00%)')).toBeTruthy(); // STOP DISTANCE
  });
});

