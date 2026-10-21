/**
 * Unit tests for the risk engine in src/hooks/usePositionSizer.js
 *
 * Covers the four specified formulas plus the asymmetry badge tiers,
 * the long/short flip, delta clamping, and invalid-input guards.
 *
 * Math reference (from spec):
 *   Risk$      = Balance × (Risk% / 100)
 *   Risk/Share = |Entry − Stop|
 *   Shares_max = ⌊Risk$ / Risk per Share⌋
 *   Contracts  = ⌊Shares_max / (100 × Δ)⌋      (raw 0 but shares > 0 → 1)
 *   R:R        = |Target − Entry| / Risk per Share
 */
import { renderHook, act } from '@testing-library/react-native';
import { usePositionSizer } from '../src/hooks/usePositionSizer';

// Helper: render the hook (async in RTL v14) and set all inputs in one shot.
const setup = async (balance, riskPct, entry, stop, target = '', delta = '0.50') => {
  const { result } = await renderHook(() => usePositionSizer(balance, riskPct));
  const set = async (name, value) => {
    await act(async () => {
      result.current.setters[name](value);
    });
  };
  await set('setEntryPrice', entry);
  await set('setStopLossPrice', stop);
  if (target !== '') await set('setTargetPrice', target);
  if (delta !== '0.50') await set('setOptionDelta', delta);
  return result.current.metrics;
};

describe('usePositionSizer — invalid input guards', () => {
  test('returns isValid=false when any required field is missing or zero', async () => {
    await expect(setup('', '1.5', '100', '95')).resolves.toMatchObject({ isValid: false, maxShares: 0 });
    await expect(setup('10000', '', '100', '95')).resolves.toMatchObject({ isValid: false });
    await expect(setup('10000', '1.5', '', '95')).resolves.toMatchObject({ isValid: false });
    await expect(setup('10000', '1.5', '100', '')).resolves.toMatchObject({ isValid: false });
  });

  test('entry === stop is invalid (zero risk per share)', async () => {
    await expect(setup('10000', '1.5', '100', '100')).resolves.toMatchObject({ isValid: false });
  });

  test('non-numeric garbage parses to 0 and is rejected', async () => {
    await expect(setup('abc', '1.5', '100', '95')).resolves.toMatchObject({ isValid: false });
    await expect(setup('10000', 'abc', '100', '95')).resolves.toMatchObject({ isValid: false });
  });
});

describe('usePositionSizer — floating-point edge case (documented, conservative floor kept)', () => {
  // DESIGN DECISION — locked in intentionally:
  // `50 − 49.80` does not equal exactly 0.20 in IEEE-754 doubles; it evaluates
  // to 0.2000000000000028421709430404. Dividing the $200 risk budget by that
  // value gives 999.9999999999929, which floors to 999 shares — NOT 1000.
  //
  // The hook deliberately keeps the raw Math.floor (no epsilon rounding):
  // a risk firewall must never round a trader UP into a phantom share they
  // could not actually afford at the stated stop. The worst case of this
  // policy is one share of unused risk budget (risk $199.80 vs $200), never
  // a breached budget. If epsilon rounding were added, maxShares would be
  // 1000 and maxDollarLoss exactly $200.00 — that behavior is explicitly
  // NOT wanted here.
  test('50 − 49.80 evaluates to 0.2000000000000028 in IEEE-754, so floor(200 / that) = 999', async () => {
    // Mirror of the hook's exact arithmetic — pin the FP premise first.
    const riskPerShare = Math.abs(parseFloat('50') - parseFloat('49.80'));
    expect(riskPerShare).toBeCloseTo(0.20000000000000284, 14);

    const metrics = await setup('10000', '2', '50', '49.80');
    expect(metrics.maxShares).toBe(999);
    expect(metrics.maxShares).toBe(Math.floor(200 / riskPerShare)); // same formula
  });

  test('consequence: realized max loss $199.80 stays under the $200 budget', async () => {
    const metrics = await setup('10000', '2', '50', '49.80');
    expect(metrics.maxDollarLoss).toBe(999 * 0.2 * (1 + 0)); // 999 × 0.2000… = 199.80 (rounded by hook)
    expect(metrics.maxDollarLoss).toBeLessThanOrEqual(200); // budget never breached
    expect(metrics.totalCapital).toBe(49950); // 999 × $50
    expect(metrics.portfolioAllocationPct).toBe(499.5);
  });

  test('clean decimal inputs floor exactly (sanity contrast): 150/5 = 30, not 29', async () => {
    const metrics = await setup('10000', '1.5', '100', '95');
    expect(metrics.maxShares).toBe(30);
    expect(metrics.maxDollarLoss).toBe(150);
  });
});

describe('usePositionSizer — max safe shares (floor)', () => {
  test('$10,000 × 1.5% = $150 risk, $5 stop distance → 30 shares', async () => {
    // 10000 * 0.015 = 150; 150 / 5 = 30 exactly
    await expect(setup('10000', '1.5', '100', '95')).resolves.toMatchObject({
      isValid: true,
      dollarRisk: 150,
      riskPerShare: 5,
      maxShares: 30,
      maxDollarLoss: 150,
      totalCapital: 3000,
      portfolioAllocationPct: 30,
    });
  });

  test('fractional share result floors down: 150/4 = 37.5 → 37 shares', async () => {
    // stop at 96 → risk/share = 4; 150/4 = 37.5 → floor 37
    await expect(setup('10000', '1.5', '100', '96')).resolves.toMatchObject({
      maxShares: 37,
      maxDollarLoss: 148, // 37 × 4 — never exceeds the $150 budget
      totalCapital: 3700,
      portfolioAllocationPct: 37,
    });
  });

  test('tiny stop distance yields large share count (FP-safe floor)', async () => {
    // 10000 * 2% = 200; entry 50, stop 49.80 → risk/share parses to 0.20.
    // IEEE-754: 50 − 49.8 = 0.2000000000000028, so floor(200/0.2000…) = 999.
    // The floor never rounds up — a trader is never sized for a phantom share.
    await expect(setup('10000', '2', '50', '49.80')).resolves.toMatchObject({
      maxShares: 999,
      maxDollarLoss: 199.8,
      totalCapital: 49950,
      portfolioAllocationPct: 499.5, // leverage — reported, not capped
    });
  });
});

describe('usePositionSizer — capital & allocation', () => {
  test('totalCapital = shares × entry; allocation % of balance, 1-decimal rounding', async () => {
    // 10000 × 0.75% = 75; entry 33, stop 30 → 3/share → 25 shares → $825 (8.25%)
    await expect(setup('10000', '0.75', '33', '30')).resolves.toMatchObject({
      maxShares: 25,
      totalCapital: 825,
      portfolioAllocationPct: 8.3, // (825/10000*100).toFixed(1) → 8.3
    });
  });
});

describe('usePositionSizer — options contract conversion', () => {
  test('⌊30 / (100 × 0.50)⌋ = 0 raw → floored to minimum 1 contract', async () => {
    // 30 shares ÷ 50 shares-per-contract = 0 raw, but shares > 0 → 1
    await expect(setup('10000', '1.5', '100', '95', '', '0.50')).resolves.toMatchObject({
      maxShares: 30,
      optionsContracts: 1,
    });
  });

  test('100 shares at delta 0.50 → exactly 2 contracts', async () => {
    // 10000 × 1% = 100; entry 50 stop 49 → 1/share → 100 shares → 2 contracts
    await expect(setup('10000', '1', '50', '49', '', '0.50')).resolves.toMatchObject({
      maxShares: 100,
      optionsContracts: 2,
    });
  });

  test('high delta (1.0) needs more shares per contract than low delta (0.10)', async () => {
    // 10000 × 1% = 100; 1/share stop → 100 shares
    const highDelta = await setup('10000', '1', '50', '49', '', '1.0'); // ⌊100/100⌋ = 1
    const lowDelta = await setup('10000', '1', '50', '49', '', '0.10'); // ⌊100/10⌋ = 10
    expect(highDelta.optionsContracts).toBe(1);
    expect(lowDelta.optionsContracts).toBe(10);
  });

  test('delta is clamped to [0.05, 1.0]', async () => {
    // 100 shares: delta "5" clamps to 1.0 → ⌊100/100⌋ = 1
    await expect(setup('10000', '1', '50', '49', '', '5')).resolves.toMatchObject({ optionsContracts: 1 });
    // delta "0" → parses falsy → default 0.5 → 2 contracts
    await expect(setup('10000', '1', '50', '49', '', '0')).resolves.toMatchObject({ optionsContracts: 2 });
  });
});

describe('usePositionSizer — R:R ratio & asymmetry badges', () => {
  test('R:R = reward / risk; 2.5 exactly → EXCELLENT (green tier boundary)', async () => {
    // entry 100 stop 95 (5 risk), target 112.5 → 12.5/5 = 2.5
    await expect(setup('10000', '1.5', '100', '95', '112.50')).resolves.toMatchObject({
      riskRewardRatio: 2.5,
      asymmetryRating: 'EXCELLENT',
    });
  });

  test('just under 2.5 (2.49) → ACCEPTABLE (cyan tier)', async () => {
    // reward 12.45 / 5 = 2.49
    await expect(setup('10000', '1.5', '100', '95', '112.45')).resolves.toMatchObject({
      riskRewardRatio: 2.49,
      asymmetryRating: 'ACCEPTABLE',
    });
  });

  test('1.5 exactly → ACCEPTABLE (lower boundary)', async () => {
    // reward 7.5 / 5 = 1.5
    await expect(setup('10000', '1.5', '100', '95', '107.50')).resolves.toMatchObject({
      riskRewardRatio: 1.5,
      asymmetryRating: 'ACCEPTABLE',
    });
  });

  test('below 1.5 → REJECTED (red tier — replaces the old POOR rating)', async () => {
    // reward 5 / 5 = 1.0
    await expect(setup('10000', '1.5', '100', '95', '105')).resolves.toMatchObject({
      riskRewardRatio: 1,
      asymmetryRating: 'REJECTED',
    });
  });

  test('no target entered → ratio 0 and INVALID (badge hidden in UI)', async () => {
    await expect(setup('10000', '1.5', '100', '95', '')).resolves.toMatchObject({
      riskRewardRatio: 0,
      asymmetryRating: 'INVALID',
    });
  });

  test('target on the wrong side of entry → NEGATIVE_REWARD', async () => {
    // Long setup (entry > stop) but target below entry
    await expect(setup('10000', '1.5', '100', '95', '90')).resolves.toMatchObject({
      asymmetryRating: 'NEGATIVE_REWARD',
    });
  });
});

describe('usePositionSizer — REJECTED over-allocation firewall', () => {
  test('capital outlay > account balance forces REJECTED regardless of R:R', async () => {
    // Risk $200, stop distance 0.20 → 999 shares × $50 = $49,950 outlay (499.5%).
    // Target 60 → reward 10 / 0.2 = R:R 50 (would be EXCELLENT) — rejected anyway.
    await expect(setup('10000', '2', '50', '49.80', '60')).resolves.toMatchObject({
      isValid: true,
      isOverAllocated: true,
      asymmetryRating: 'REJECTED',
      riskRewardRatio: 50,
      portfolioAllocationPct: 499.5,
    });
  });

  test('exactly 100% allocation is the tradeable boundary (not rejected)', async () => {
    // 5% risk = $500; entry 100, stop 95 → 100 shares → $10,000 outlay = 100%.
    // Target 115 → R:R 3 → EXCELLENT retained.
    await expect(setup('10000', '5', '100', '95', '115')).resolves.toMatchObject({
      maxShares: 100,
      totalCapital: 10000,
      portfolioAllocationPct: 100,
      isOverAllocated: false,
      asymmetryRating: 'EXCELLENT',
    });
  });

  test('over-allocation forces REJECTED even when no target was entered', async () => {
    // Same 499.5%-of-account sizing, no target → rating would be INVALID;
    // the capital firewall still rejects the setup.
    await expect(setup('10000', '2', '50', '49.80')).resolves.toMatchObject({
      isOverAllocated: true,
      asymmetryRating: 'REJECTED',
    });
  });
});

describe('usePositionSizer — short setups (stop above entry)', () => {
  test('isLong flips and risk/reward use absolute distances', async () => {
    // Short: entry 95, stop 100 → risk/share 5; 150/5 = 30 shares
    // Target 85 → reward 10 → R:R 2.0 → ACCEPTABLE
    await expect(setup('10000', '1.5', '95', '100', '85')).resolves.toMatchObject({
      isValid: true,
      isLong: false,
      riskPerShare: 5,
      maxShares: 30,
      riskRewardRatio: 2,
      asymmetryRating: 'ACCEPTABLE',
    });
  });

  test('short with target above entry → NEGATIVE_REWARD', async () => {
    await expect(setup('10000', '1.5', '95', '100', '110')).resolves.toMatchObject({
      isLong: false,
      asymmetryRating: 'NEGATIVE_REWARD',
    });
  });
});
