import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { usePositionSizer } from '../hooks/usePositionSizer';
import { useSetupJournal } from '../hooks/useSetupJournal';
import { maybeShowInterstitial } from '../ads/interstitial';
import { useSettings } from '../context/SettingsContext';
import { useAds } from '../context/AdContext';
import { AdBanner } from '../components/AdBanner';
import { theme } from '../theme';

// Per-field diagnostics for the disarmed card: distinguish a BLANK field
// ("enter a value") from a literal ZERO ("cannot be zero") from garbage
// ("not a valid number") off the raw input strings — the numeric pipeline
// (parseFloat(...) || 0) stays untouched.
const diagnoseField = (label, raw) => {
  const t = String(raw).trim();
  if (t === '') return `${label} is empty — enter a value.`;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return `${label} is not a valid number.`;
  if (n === 0) return `${label} cannot be zero.`;
  return null;
};

export default function PositionSizerScreen() {
  const { settings } = useSettings();
  const { isAdFree } = useAds();
  const { inputs, setters, metrics } = usePositionSizer(settings.accountBalance, settings.riskPercentage);

  const entryNum = parseFloat(inputs.entryPrice);
  const stopPct =
    Number.isFinite(entryNum) && entryNum > 0
      ? ((metrics.riskPerShare / entryNum) * 100).toFixed(2)
      : null;

  const diagnostics = !metrics.isValid
    ? [
        diagnoseField('Account Size', inputs.accountBalance),
        diagnoseField('Risk Budget', inputs.riskPercentage),
        diagnoseField('Entry Price', inputs.entryPrice),
        diagnoseField('Stop Loss', inputs.stopLossPrice),
        (() => {
          const e = parseFloat(inputs.entryPrice);
          const s = parseFloat(inputs.stopLossPrice);
          if (!Number.isNaN(e) && !Number.isNaN(s) && e > 0 && s > 0 && e === s) {
            return 'Entry and stop must be distinct levels.';
          }
          return null;
        })(),
      ].filter(Boolean)
    : [];

  const { entries, saveSetup, clearJournal } = useSetupJournal();
  const [justLogged, setJustLogged] = useState(false);
  // Journal review: tapping a row reloads that setup into the sizer via the
  // hook's own setters — the same controlled-input path as typing.
  const loadSetup = (e) => {
    setters.setAccountBalance(e.balance || '10000');
    setters.setRiskPercentage(e.riskPct || '1.5');
    setters.setEntryPrice(e.entry);
    setters.setStopLossPrice(e.stop);
    setters.setTargetPrice(e.target || '');
    setters.setOptionDelta(e.delta || '0.50');
  };
  const logCurrentSetup = () => {
    saveSetup({
      date: new Date().toISOString().slice(0, 10),
      entry: inputs.entryPrice,
      stop: inputs.stopLossPrice,
      target: inputs.targetPrice,
      balance: inputs.accountBalance,
      riskPct: inputs.riskPercentage,
      delta: inputs.optionDelta,
      maxShares: metrics.maxShares,
      optionsContracts: metrics.optionsContracts,
      riskRewardRatio: metrics.riskRewardRatio,
      asymmetryRating: metrics.asymmetryRating,
      maxDollarLoss: metrics.maxDollarLoss,
      totalCapital: metrics.totalCapital,
    });
    setJustLogged(true);
    // Natural break: interstitial after the trader completes logging (gated
    // by the same isRealAdsEnabled switch + 3-min frequency cap; no-op in
    // mock mode). Never blocks the trading flow — errors are swallowed.
    maybeShowInterstitial();
  };

  const getBadgeStyle = (rating) => {
    switch (rating) {
      case 'EXCELLENT':
        return { backgroundColor: 'rgba(0, 230, 118, 0.15)', borderColor: theme.green, text: theme.green };
      case 'ACCEPTABLE':
        return { backgroundColor: 'rgba(0, 176, 255, 0.15)', borderColor: theme.cyan, text: theme.cyan };
      case 'REJECTED':
        return { backgroundColor: 'rgba(255, 82, 82, 0.15)', borderColor: theme.red, text: theme.red };
      default:
        return { backgroundColor: 'rgba(255, 82, 82, 0.15)', borderColor: theme.red, text: theme.red };
    }
  };

  const badgeTheme = getBadgeStyle(metrics.asymmetryRating);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <Text style={styles.screenTitle}>Position Risk Engine</Text>

        <View style={styles.card}>
          <Text style={styles.cardHeader}>ACCOUNT & RISK PARAMS</Text>
          <View style={styles.row}>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Account Size ($)</Text>
              <TextInput keyboardType="numeric" onChangeText={setters.setAccountBalance} placeholder="10000" placeholderTextColor={theme.dim} style={styles.input} value={inputs.accountBalance} />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Risk Budget (%)</Text>
              <TextInput keyboardType="numeric" onChangeText={setters.setRiskPercentage} placeholder="1.5" placeholderTextColor={theme.dim} style={styles.input} value={inputs.riskPercentage} />
            </View>
          </View>

          <Text style={[styles.cardHeader, { marginTop: 16 }]}>TRADE SETUP LEVELS</Text>
          <View style={styles.row}>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Entry Price ($)</Text>
              <TextInput keyboardType="numeric" onChangeText={setters.setEntryPrice} placeholder="0.00" placeholderTextColor={theme.dim} style={styles.input} value={inputs.entryPrice} />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Stop Loss ($)</Text>
              <TextInput keyboardType="numeric" onChangeText={setters.setStopLossPrice} placeholder="0.00" placeholderTextColor={theme.dim} style={styles.input} value={inputs.stopLossPrice} />
            </View>
          </View>

          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Target 1 ($)</Text>
              <TextInput keyboardType="numeric" onChangeText={setters.setTargetPrice} placeholder="Optional" placeholderTextColor={theme.dim} style={styles.input} value={inputs.targetPrice} />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Option Delta</Text>
              <TextInput keyboardType="numeric" onChangeText={setters.setOptionDelta} placeholder="0.50" placeholderTextColor={theme.dim} style={styles.input} value={inputs.optionDelta} />
            </View>
          </View>
        </View>

        {/* Sizing directive card — ALWAYS visible: complete setups show live
            tier badges; incomplete ones show the red INVALID badge with zeroed
            cells and per-field hints (trader keeps their context on screen). */}
        <View style={styles.card}>
          <View style={styles.metricHeaderRow}>
            <Text style={styles.cardHeader}>SIZING DIRECTIVE</Text>
            <View style={[styles.badge, { backgroundColor: badgeTheme.backgroundColor, borderColor: badgeTheme.borderColor }]}>
              <Text style={[styles.badgeText, { color: badgeTheme.text }]}>
                {metrics.asymmetryRating.replace('_', ' ')}
              </Text>
            </View>
          </View>

          <View style={styles.primaryMetric}>
            <Text style={styles.primaryMetricValue}>{metrics.maxShares} SHARES</Text>
            <Text style={styles.primaryMetricSub}>
              or ~{metrics.optionsContracts} Contract(s) (Delta {inputs.optionDelta})
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>MAX CASH RISK</Text>
              <Text style={[styles.gridValue, { color: theme.red }]}>
                ${metrics.maxDollarLoss.toFixed(2)}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>CAPITAL OUTLAY</Text>
              <Text style={styles.gridValue}>
                ${metrics.totalCapital.toLocaleString()} ({metrics.portfolioAllocationPct}%)
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>RISK : REWARD</Text>
              <Text style={[styles.gridValue, { color: badgeTheme.text }]}>
                {metrics.riskRewardRatio > 0 ? `1 : ${metrics.riskRewardRatio}` : 'N/A'}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>STOP DISTANCE</Text>
              <Text style={styles.gridValue}>{`$${metrics.riskPerShare}${stopPct ? ` (${stopPct}%)` : ''}`}</Text>
            </View>
          </View>

          {metrics.asymmetryRating === 'REJECTED' && (
            <View style={styles.rejectNote}>
              <Text style={styles.rejectNoteTitle}>TRADE REJECTED</Text>
              {metrics.isOverAllocated ? (
                <Text style={styles.rejectNoteText}>
                  Capital outlay exceeds account balance. Cut size until outlay fits the account.
                </Text>
              ) : (
                <Text style={styles.rejectNoteText}>
                  Risk asymmetry below the 1 : 1.5 minimum. Skip or restructure the setup.
                </Text>
              )}
            </View>
          )}
          {!metrics.isLong && (
            <View style={styles.shortNote}>
              <Text style={styles.shortNoteText}>
                SHORT SETUP — stop sits above entry. Options leg requires PUT contracts.
              </Text>
            </View>
          )}
          {metrics.isValid && (
            <TouchableOpacity style={styles.logButton} onPress={logCurrentSetup} activeOpacity={0.8}>
              <Text style={styles.logButtonText}>{justLogged ? 'LOGGED ✓' : 'LOG THIS SETUP'}</Text>
            </TouchableOpacity>
          )}
          {!metrics.isValid && (
            <>
              <Text style={styles.emptyHint}>
                Enter account size, risk %, entry and a distinct stop loss to arm the risk firewall.
              </Text>
              {diagnostics.map((d) => (
                <Text key={d} style={styles.diagItem}>{`• ${d}`}</Text>
              ))}
            </>
          )}
        </View>

        {/* Setup journal — persisted log of graded setups */}
        {entries.length > 0 && (
          <View style={styles.card}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.cardHeader}>{`SETUP JOURNAL (${entries.length})`}</Text>
              <TouchableOpacity onPress={clearJournal} hitSlop={8}>
                <Text style={styles.clearText}>CLEAR ALL</Text>
              </TouchableOpacity>
            </View>
            {entries.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={styles.journalRow}
                onPress={() => loadSetup(e)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Load setup from ${e.date}`}
              >
                <Text
                  style={[
                    styles.journalRating,
                    {
                      color:
                        e.asymmetryRating === 'EXCELLENT'
                          ? theme.green
                          : e.asymmetryRating === 'ACCEPTABLE'
                          ? theme.cyan
                          : theme.red,
                    },
                  ]}
                >
                  {e.asymmetryRating}
                </Text>
                <View style={styles.journalBody}>
                  <Text style={styles.journalMeta}>{`${e.date} · ${e.maxShares} sh · risk $${e.maxDollarLoss}`}</Text>
                  <Text style={styles.journalLevels}>{`E $${e.entry} · S $${e.stop} · T ${e.target ? `$${e.target}` : '—'} · 1:${e.riskRewardRatio}`}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

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
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  inputHalf: { width: '48%' },
  label: { fontSize: 12, color: theme.muted, marginBottom: 6 },
  input: {
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 6,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  metricHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  primaryMetric: { alignItems: 'center', marginVertical: 16 },
  primaryMetricValue: { fontSize: 32, fontWeight: '800', color: theme.green, letterSpacing: 0.5 },
  primaryMetricSub: { fontSize: 13, color: theme.muted, marginTop: 4 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '48%', marginVertical: 6 },
  gridLabel: { fontSize: 10, fontWeight: '700', color: theme.muted, letterSpacing: 0.5 },
  gridValue: { fontSize: 15, fontWeight: '600', color: theme.text, marginTop: 2 },
  shortNote: { marginTop: 10, padding: 10, borderRadius: 6, backgroundColor: 'rgba(255, 82, 82, 0.08)' },
  shortNoteText: { fontSize: 11, color: theme.red, fontWeight: '600' },
  rejectNote: { marginTop: 10, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: theme.red, backgroundColor: 'rgba(255, 82, 82, 0.08)' },
  rejectNoteTitle: { fontSize: 12, fontWeight: '900', color: theme.red, letterSpacing: 1 },
  rejectNoteText: { fontSize: 11, color: theme.red, marginTop: 4, lineHeight: 15 },
  emptyHint: { fontSize: 12, color: theme.dim, textAlign: 'center' },
  diagItem: { fontSize: 11, color: theme.muted, marginTop: 8, lineHeight: 15 },
  logButton: {
    marginTop: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.cyan,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logButtonText: { color: theme.cyan, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  clearText: { fontSize: 11, fontWeight: '700', color: theme.red, letterSpacing: 0.5 },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  journalRating: { fontSize: 10, fontWeight: '800', width: 90, letterSpacing: 0.5 },
  journalBody: { flex: 1 },
  journalMeta: { fontSize: 11, fontWeight: '700', color: theme.text },
  journalLevels: { fontSize: 11, color: theme.muted, marginTop: 2 },
  adSpacer: { height: 50 },
});
