import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { useMarketClock } from '../hooks/useMarketClock';
import { useMarketContext } from '../hooks/useMarketContext';
import { useAds } from '../context/AdContext';
import { AdBanner } from '../components/AdBanner';
import { theme } from '../theme';

const CHECKLIST_ITEMS = [
  'Overnight futures & opening gap scanned',
  'Economic calendar checked (FOMC / CPI / NFP)',
  'Earnings dates confirmed for watchlist',
  'Key levels marked (VWAP, pivots, PDH/PDL)',
  'Daily max risk defined & written down',
  'Broker, alerts & data feeds verified',
];

const STATUS_META = {
  PRE_MARKET: { label: 'PRE-MARKET ACTIVE', color: theme.cyan },
  OPEN: { label: 'REGULAR SESSION — LIVE', color: theme.green },
  AFTER_HOURS: { label: 'AFTER-HOURS TAPE', color: theme.muted },
  CLOSED: { label: 'MARKET CLOSED', color: theme.red },
};

export default function MorningEdgeScreen() {
  const { status, countdownLabel, nextOpenLabel } = useMarketClock();
  const { isAdFree } = useAds();
  const [checked, setChecked] = useState(() => CHECKLIST_ITEMS.map(() => false));
  const [high, setHigh] = useState('');
  const [low, setLow] = useState('');
  const [close, setClose] = useState('');

  const mctx = useMarketContext('SPY');
  const applyContext = useCallback(() => {
    if (!mctx.data) return;
    setHigh(String(mctx.data.high));
    setLow(String(mctx.data.low));
    setClose(String(mctx.data.close));
  }, [mctx.data]);

  const toggleItem = useCallback((i) => {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }, []);

  const statusMeta = STATUS_META[status] || STATUS_META.CLOSED;
  const completedCount = checked.filter(Boolean).length;

  const levels = useMemo(() => {
    const h = parseFloat(high) || 0;
    const l = parseFloat(low) || 0;
    const c = parseFloat(close) || 0;
    if (h <= 0 || l <= 0 || c <= 0 || h < l) return null;
    const range = h - l;
    const pivot = (h + l + c) / 3;
    return {
      r2: pivot + range,
      r1: 2 * pivot - l,
      pivot,
      s1: 2 * pivot - h,
      s2: pivot - range,
      h3: c + (range * 1.1) / 4,
      l3: c - (range * 1.1) / 4,
    };
  }, [high, low, close]);

  const levelRows = levels
    ? [
        { label: 'R2 — RESISTANCE 2', value: levels.r2, color: theme.red },
        { label: 'R1 — RESISTANCE 1', value: levels.r1, color: theme.red },
        { label: 'H3 — CAMARILLA HIGH', value: levels.h3, color: theme.cyan },
        { label: 'P — FLOOR PIVOT', value: levels.pivot, color: theme.green },
        { label: 'L3 — CAMARILLA LOW', value: levels.l3, color: theme.cyan },
        { label: 'S1 — SUPPORT 1', value: levels.s1, color: theme.green },
        { label: 'S2 — SUPPORT 2', value: levels.s2, color: theme.green },
      ]
    : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <Text style={styles.screenTitle}>Morning Edge</Text>

        {/* Market clock */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>SESSION CLOCK</Text>
          <View style={styles.clockRow}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
              <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          </View>
          <Text style={styles.countdown}>{countdownLabel}</Text>
          <Text style={styles.countdownSub}>
            {status === 'OPEN' ? 'Regular session in progress' : `Until next open · ${nextOpenLabel}`}
          </Text>
        </View>

        {/* Pre-market checklist */}
        <View style={styles.card}>
          <View style={styles.metricHeaderRow}>
            <Text style={styles.cardHeader}>PRE-MARKET CHECKLIST</Text>
            <Text style={[styles.checklistProgress, { color: completedCount === CHECKLIST_ITEMS.length ? theme.green : theme.muted }]}>
              {completedCount}/{CHECKLIST_ITEMS.length}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(completedCount / CHECKLIST_ITEMS.length) * 100}%` },
              ]}
            />
          </View>
          {CHECKLIST_ITEMS.map((item, i) => (
            <Pressable key={item} style={styles.checkRow} onPress={() => toggleItem(i)} hitSlop={8}>
              <View style={[styles.checkbox, checked[i] && { backgroundColor: theme.green, borderColor: theme.green }]}>
                {checked[i] ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={[styles.checkLabel, checked[i] && { color: theme.muted, textDecorationLine: 'line-through' }]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Market context — previous completed session OHLC (cached offline) */}
        <View style={styles.card}>
          <View style={styles.metricHeaderRow}>
            <Text style={styles.cardHeader}>MARKET CONTEXT · {mctx.data ? mctx.data.symbol : 'SPY'}</Text>
            {mctx.data ? <Text style={styles.ctxDate}>{mctx.data.date}</Text> : null}
          </View>
          {mctx.loading && !mctx.error ? (
            <Text style={styles.ctxHint}>Fetching previous session OHLC…</Text>
          ) : mctx.error && mctx.data ? (
            <Text style={styles.ctxHint}>Offline — showing cached {mctx.data.date} levels.</Text>
          ) : mctx.error ? (
            <Text style={styles.ctxHint}>Offline — enter OHLC manually below.</Text>
          ) : null}
          {mctx.data ? (
            <>
              <View style={styles.row}>
                <View style={styles.ctxCell}>
                  <Text style={styles.label}>O</Text>
                  <Text style={styles.ctxValue}>{`$${mctx.data.open.toFixed(2)}`}</Text>
                </View>
                <View style={styles.ctxCell}>
                  <Text style={styles.label}>H</Text>
                  <Text style={styles.ctxValue}>{`$${mctx.data.high.toFixed(2)}`}</Text>
                </View>
                <View style={styles.ctxCell}>
                  <Text style={styles.label}>L</Text>
                  <Text style={styles.ctxValue}>{`$${mctx.data.low.toFixed(2)}`}</Text>
                </View>
                <View style={styles.ctxCell}>
                  <Text style={styles.label}>C</Text>
                  <Text style={styles.ctxValue}>{`$${mctx.data.close.toFixed(2)}`}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.applyButton} onPress={applyContext} activeOpacity={0.8}>
                <Text style={styles.applyButtonText}>USE THESE LEVELS →</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        {/* Floor pivot calculator */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>FLOOR PIVOT CALCULATOR</Text>
          <Text style={styles.cardSub}>Previous session OHLC (High / Low / Close)</Text>
          <View style={styles.row}>
            <View style={styles.inputThird}>
              <Text style={styles.label}>Prev High</Text>
              <TextInput keyboardType="decimal-pad" onChangeText={setHigh} placeholder="0.00" placeholderTextColor={theme.dim} style={styles.input} value={high} />
            </View>
            <View style={styles.inputThird}>
              <Text style={styles.label}>Prev Low</Text>
              <TextInput keyboardType="decimal-pad" onChangeText={setLow} placeholder="0.00" placeholderTextColor={theme.dim} style={styles.input} value={low} />
            </View>
            <View style={styles.inputThird}>
              <Text style={styles.label}>Prev Close</Text>
              <TextInput keyboardType="decimal-pad" onChangeText={setClose} placeholder="0.00" placeholderTextColor={theme.dim} style={styles.input} value={close} />
            </View>
          </View>

          {levelRows ? (
            <View style={styles.levelTable}>
              {levelRows.map((row) => (
                <View key={row.label} style={styles.levelRow}>
                  <Text style={styles.levelLabel}>{row.label}</Text>
                  <Text style={[styles.levelValue, { color: row.color }]}>${row.value.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>Enter valid H / L / C to project today's battle map.</Text>
          )}
        </View>

        {!isAdFree && <View style={styles.adSpacer} />}
      </ScrollView>
      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  screenTitle: { fontSize: 20, fontWeight: '700', color: theme.text, letterSpacing: 0.5, marginBottom: 16 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: { fontSize: 11, fontWeight: '700', color: theme.muted, letterSpacing: 1 },
  cardSub: { fontSize: 11, color: theme.dim, marginTop: 2, marginBottom: 4 },
  metricHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clockRow: { flexDirection: 'row', marginTop: 12 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  countdown: { fontSize: 40, fontWeight: '800', color: theme.text, letterSpacing: 2, marginTop: 12, textAlign: 'center' },
  countdownSub: { fontSize: 12, color: theme.muted, marginTop: 4, textAlign: 'center', marginBottom: 4 },
  progressTrack: { height: 4, backgroundColor: theme.bg, borderRadius: 2, marginTop: 10, marginBottom: 12, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: theme.green, borderRadius: 2 },
  checklistProgress: { fontSize: 11, fontWeight: '800' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkMark: { fontSize: 13, color: theme.bg, fontWeight: '900' },
  checkLabel: { flex: 1, fontSize: 13, color: theme.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  inputThird: { width: '31%' },
  label: { fontSize: 12, color: theme.muted, marginBottom: 6 },
  input: {
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 6,
    color: theme.text,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  levelTable: { marginTop: 14 },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  levelLabel: { fontSize: 11, fontWeight: '700', color: theme.muted, letterSpacing: 0.5 },
  levelValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  emptyHint: { fontSize: 12, color: theme.dim, marginTop: 14, textAlign: 'center' },
  adSpacer: { height: 50 },
  ctxDate: { fontSize: 11, color: theme.muted, fontWeight: '700' },
  ctxHint: { fontSize: 11, color: theme.dim, marginTop: 8 },
  ctxCell: { width: '23%' },
  ctxValue: { fontSize: 15, fontWeight: '700', color: theme.text, fontVariant: ['tabular-nums'] },
  applyButton: {
    marginTop: 12,
    backgroundColor: theme.cyan,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyButtonText: { color: theme.bg, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
