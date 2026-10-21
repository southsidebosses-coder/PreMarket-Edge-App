import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useAds } from '../context/AdContext';
import { theme } from '../theme';

export default function SettingsScreen() {
  const { settings, saveSettings } = useSettings();
  const { isAdFree, isReady, purchaseAdFree, restoreAds } = useAds();

  const [draftBalance, setDraftBalance] = useState(settings.accountBalance);
  const [draftRisk, setDraftRisk] = useState(settings.riskPercentage);
  const [draftDelta, setDraftDelta] = useState(settings.optionDelta);
  const [savedAt, setSavedAt] = useState(null);

  const handleSave = () => {
    saveSettings({
      accountBalance: draftBalance.trim() || settings.accountBalance,
      riskPercentage: draftRisk.trim() || settings.riskPercentage,
      optionDelta: draftDelta.trim() || settings.optionDelta,
    });
    setSavedAt(Date.now());
  };

  const handlePurchase = () => {
    Alert.alert(
      'Confirm Purchase',
      'Remove Ads Forever — $4.99 (mock IAP, no real charge).',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Purchase', onPress: purchaseAdFree },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Settings & Upgrade</Text>

        {/* Risk defaults */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>RISK PARAMETER DEFAULTS</Text>
          <Text style={styles.cardSub}>Pre-loads the Position Sizer on every launch.</Text>
          <View style={styles.row}>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Default Account ($)</Text>
              <TextInput keyboardType="numeric" onChangeText={setDraftBalance} placeholder="10000" placeholderTextColor={theme.dim} style={styles.input} value={draftBalance} />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Default Risk (%)</Text>
              <TextInput keyboardType="numeric" onChangeText={setDraftRisk} placeholder="1.5" placeholderTextColor={theme.dim} style={styles.input} value={draftRisk} />
            </View>
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Default Option Delta</Text>
              <TextInput keyboardType="numeric" onChangeText={setDraftDelta} placeholder="0.50" placeholderTextColor={theme.dim} style={styles.input} value={draftDelta} />
            </View>
            <View style={styles.inputHalf}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.saveButtonText}>SAVE DEFAULTS</Text>
              </TouchableOpacity>
              {savedAt ? <Text style={styles.savedHint}>Defaults saved ✓</Text> : null}
            </View>
          </View>
        </View>

        {/* IAP simulation */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>PRO UPGRADE</Text>
          {!isAdFree ? (
            <>
              <View style={styles.priceRow}>
                <View style={styles.priceInfo}>
                  <Text style={styles.priceTitle}>Remove Ads Forever</Text>
                  <Text style={styles.priceSub}>One-time non-consumable purchase · unlocks both tab banners</Text>
                </View>
                <Text style={styles.priceTag}>$4.99</Text>
              </View>
              <TouchableOpacity style={styles.purchaseButton} onPress={handlePurchase} activeOpacity={0.8}>
                <Text style={styles.purchaseButtonText}>PURCHASE — MOCK IAP</Text>
              </TouchableOpacity>
              <Text style={styles.legalHint}>Simulation only. Wire expo-in-app-purchases / RevenueCat before shipping.</Text>
            </>
          ) : (
            <>
              <View style={styles.proBanner}>
                <Text style={styles.proBadge}>PRO ACTIVE</Text>
                <Text style={styles.proText}>Ads removed forever. Thank you for supporting the desk.</Text>
              </View>
              <TouchableOpacity style={styles.restoreButton} onPress={restoreAds} activeOpacity={0.8}>
                <Text style={styles.restoreButtonText}>RESTORE ADS (TEST RESET)</Text>
              </TouchableOpacity>
            </>
          )}
          {!isReady && <Text style={styles.legalHint}>Restoring purchase state…</Text>}
        </View>

        {/* App info */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>APP INFO</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0 (Expo Managed)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Theme</Text>
            <Text style={styles.infoValue}>Terminal Dark · #0B0E14</Text>
          </View>
          <Text style={styles.disclaimer}>
            PreMarket Edge is an analytical tool, not financial advice. Verify every level and size before
            submitting orders to your brokerage. Trading options involves substantial risk of loss.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
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
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, alignItems: 'flex-end' },
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
  saveButton: {
    backgroundColor: theme.cyan,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: theme.bg, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  savedHint: { fontSize: 11, color: theme.green, marginTop: 6, textAlign: 'center' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 14 },
  priceInfo: { flex: 1, marginRight: 12 },
  priceTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
  priceSub: { fontSize: 11, color: theme.muted, marginTop: 3 },
  priceTag: { fontSize: 20, fontWeight: '800', color: theme.green },
  purchaseButton: {
    backgroundColor: theme.green,
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
  },
  purchaseButtonText: { color: theme.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  legalHint: { fontSize: 10, color: theme.dim, marginTop: 8 },
  proBanner: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.green,
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    padding: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  proBadge: { color: theme.green, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  proText: { color: theme.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },
  restoreButton: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 6,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 12,
  },
  restoreButtonText: { color: theme.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  infoLabel: { fontSize: 12, color: theme.muted },
  infoValue: { fontSize: 12, fontWeight: '600', color: theme.text },
  disclaimer: { fontSize: 10, color: theme.dim, marginTop: 12, lineHeight: 15 },
});
