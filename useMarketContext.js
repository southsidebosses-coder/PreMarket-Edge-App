import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Market context: previous COMPLETED session OHLC for an index ETF, from
// Yahoo's keyless v8 chart endpoint, cached in AsyncStorage so the app
// stays fully usable offline (stale-while-revalidate).
const cacheKeyFor = (symbol) => `@premarket_edge_marketContext_${symbol}`;

const fetchUrl = (symbol) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;

// Today's date in the exchange timezone (America/New_York), YYYY-MM-DD.
const etToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

// Extract the last COMPLETED daily row: filter out null/negative quotes,
// then drop any row dated today (an in-progress session during market hours).
export const parseChartJson = (json) => {
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('EMPTY_CHART');
  const q = result.indicators?.quote?.[0];
  const today = etToday();
  const rows = (result.timestamp || [])
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: q?.open?.[i],
      high: q?.high?.[i],
      low: q?.low?.[i],
      close: q?.close?.[i],
    }))
    .filter(
      (r) =>
        r.date !== today &&
        [r.open, r.high, r.low, r.close].every((v) => typeof v === 'number' && v > 0)
    );
  if (!rows.length) throw new Error('NO_VALID_ROWS');
  return { ...rows[rows.length - 1] };
};

export const useMarketContext = (symbol = 'SPY') => {
  const [state, setState] = useState({ data: null, loading: true, error: null, lastUpdated: null });

  const fetchLatest = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(fetchUrl(symbol));
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const data = { symbol, ...parseChartJson(await res.json()) };
      const lastUpdated = Date.now();
      setState({ data, loading: false, error: null, lastUpdated });
      AsyncStorage.setItem(cacheKeyFor(symbol), JSON.stringify({ data, lastUpdated })).catch(() => {});
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e?.message || 'FETCH_FAILED' }));
    }
  }, [symbol]);

  // Mount: hydrate from cache first (instant levels), then revalidate.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(cacheKeyFor(symbol));
        if (raw && alive) {
          const cached = JSON.parse(raw);
          setState({ data: cached.data, loading: true, error: null, lastUpdated: cached.lastUpdated });
        }
      } catch {}
      if (alive) fetchLatest();
    })();
    return () => {
      alive = false;
    };
  }, [symbol, fetchLatest]);

  return { ...state, refresh: fetchLatest };
};
