/**
 * Smoke tests for src/screens/MorningEdgeScreen.js — market context card.
 *
 * useMarketClock and useMarketContext are MODULE-MOCKED (the clock runs a
 * real setInterval that churns act scopes in tests; the context hook does
 * real network I/O — both are covered by their own unit suites
 * (useMarketContext.test.js) and would make these renders nondeterministic).
 *
 * Act-cycle budget: the APPLY button press is this file's single live
 * fireEvent flush (see THE ACT() OVERLAP HAZARD header in
 * PositionSizerScreen.test.js for the environment rules).
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

jest.mock('../src/hooks/useMarketClock', () => ({
  __esModule: true,
  useMarketClock: () => ({ status: 'PRE_MARKET', countdownLabel: '01:02:03', nextOpenLabel: '10/15 · 09:30 ET' }),
}));

jest.mock('../src/hooks/useMarketContext', () => ({
  __esModule: true,
  useMarketContext: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MorningEdgeScreen from '../src/screens/MorningEdgeScreen';
import { useMarketContext } from '../src/hooks/useMarketContext';
import { AdContext } from '../src/context/AdContext';

const CTX_DATA = {
  symbol: 'SPY',
  date: '2026-10-13',
  open: 770.5,
  high: 776.3,
  low: 766.71,
  close: 769.6,
};

const wrapper = ({ children }) => (
  <AdContext.Provider
    value={{ isAdFree: false, isReady: true, purchaseAdFree: jest.fn(), restoreAds: jest.fn() }}
  >
    {children}
  </AdContext.Provider>
);

beforeEach(() => {
  useMarketContext.mockReturnValue({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
    refresh: jest.fn(),
  });
});

test('loading state shows the fetch hint and no levels', async () => {
  const screen = await render(<MorningEdgeScreen />, { wrapper });
  await screen.findByText(/Fetching previous session OHLC/, {}, { timeout: 3000 });
  expect(screen.queryByText('USE THESE LEVELS →')).toBeNull();
});

test('data state shows OHLC and APPLY pre-fills the pivot calculator (single live flush)', async () => {
  useMarketContext.mockReturnValue({
    data: CTX_DATA,
    loading: false,
    error: null,
    lastUpdated: 1700000000000,
    refresh: jest.fn(),
  });

  const screen = await render(<MorningEdgeScreen />, { wrapper });
  await screen.findByText('MARKET CONTEXT · SPY', {}, { timeout: 3000 });

  expect(screen.getByText('2026-10-13')).toBeTruthy();
  expect(screen.getByText('$776.30')).toBeTruthy(); // H
  expect(screen.getByText('$769.60')).toBeTruthy(); // C

  // The one live flush in this file: APPLY feeds H/L/C into the pivot calc
  fireEvent.press(screen.getByText('USE THESE LEVELS →'));

  await waitFor(
    () => {
      expect(screen.getByDisplayValue('776.3')).toBeTruthy(); // Prev High
      expect(screen.getByDisplayValue('766.71')).toBeTruthy(); // Prev Low
      expect(screen.getByDisplayValue('769.6')).toBeTruthy(); // Prev Close
    },
    { timeout: 3000 }
  );

  // Pivot table came alive from the applied levels (H=776.3 L=766.71 C=769.6)
  expect(screen.getByText('R2 — RESISTANCE 2')).toBeTruthy();
});

test('error with cache shows the offline hint while keeping cached levels and APPLY', async () => {
  useMarketContext.mockReturnValue({
    data: CTX_DATA,
    loading: false,
    error: 'HTTP_500',
    lastUpdated: 1700000000000,
    refresh: jest.fn(),
  });

  const screen = await render(<MorningEdgeScreen />, { wrapper });
  await screen.findByText(/Offline — showing cached 2026-10-13 levels/, {}, { timeout: 3000 });

  // Cached levels remain usable
  expect(screen.getByText('$776.30')).toBeTruthy();
  expect(screen.getByText('USE THESE LEVELS →')).toBeTruthy();
});
