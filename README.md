# PreMarket Edge & Position Sizer

A production-ready React Native (Expo, Managed Workflow) pre-market cockpit and risk-enforcement firewall for options & swing traders. Bloomberg / Terminal dark theme (#0B0E14).

## Tabs

| Tab | What it does |
|---|---|
| **Morning Edge** | Live countdown to the 09:30 ET open (DST-safe, weekend-aware), 6-point pre-market checklist with progress bar, **market context card (SPY previous-session OHLC from Yahoo's keyless chart API, AsyncStorage-cached with offline fallback, one-tap USE THESE LEVELS pre-fill)**, and a floor pivot calculator (P, S1, S2, R1, R2 + Camarilla H3/L3). |
| **Position Sizer** | The journal is two-way — tapping a saved row reloads that setup into the sizer for review or reuse. The directive card is ALWAYS visible: complete setups show live tier badges, incomplete ones keep the card up with a red INVALID badge, zeroed cells, and per-field empty-vs-zero hints. Quantitative risk engine: max safe shares, capital outlay & portfolio allocation %, delta-adjusted options contracts, R:R asymmetry badge (EXCELLENT ≥ 2.5 / ACCEPTABLE ≥ 1.5 / REJECTED < 1.5). A capital firewall additionally forces REJECTED when the outlay exceeds the account balance, regardless of R:R. Handles short setups (stop above entry). |
| **Settings & Upgrade** | Persistent risk defaults (balance / risk % / delta), mock "Remove Ads Forever — $4.99" IAP simulation, restore-ads test reset. |

## Monetization (`AdContext`)

- Global `isAdFree` flag (default `false`), persisted with AsyncStorage.
- Mock AdMob banner (50 pt strip) anchored at the bottom of Tabs 1 & 2.
- When `isAdFree === true` the banner **unmounts** and content reclaims the space.
- Purchase simulation in Settings flips the flag and persists it across restarts. Swap `purchaseAdFree` for `react-native-iap` / RevenueCat before shipping to stores.

## Math (as specified)

```
Risk$        = Account Balance × (Risk% / 100)
Risk/Share   = |Entry − Stop|
Max Shares   = ⌊Risk$ / Risk per Share⌋
Contracts    = ⌊Max Shares / (100 × Δ)⌋     (Δ clamped to [0.05, 1.0])
R:R          = |Target − Entry| / Risk per Share
```

## Run it

```bash
npm install
npx expo start        # then press i (iOS) / a (Android), or scan the QR
```

To refresh dependency versions against the SDK in use: `npx expo install --fix`.

## Tests

```bash
npm test        # 60 tests: engine + clock + market-context units, screen smoke tests
```

`__tests__/usePositionSizer.test.js` covers: share flooring, capital & allocation %, delta-adjusted contracts (incl. the raw-0→1 minimum and [0.05, 1.0] delta clamp), R:R badge tiers at exact boundaries (2.5 → EXCELLENT, 1.5 → ACCEPTABLE, below → POOR), NEGATIVE_REWARD targets, short setups, and invalid-input guards — including the IEEE-754 case where `50 − 49.80` floors to 999 shares instead of 1000 (by design: never size a phantom share).

`__tests__/PositionSizerScreen.test.js` renders the real screen and asserts the asymmetry badge switches **label + colors** per tier (EXCELLENT #00E676 / ACCEPTABLE #00B0FF / POOR & NEGATIVE REWARD #FF5252), that a SHORT setup renders the PUT-contracts notice alongside the full directive card (badge, shares, contracts, R:R, max risk, outlay, stop distance), and — via a live fireEvent pass with the real hook — that the directive card and full metric grid render from real inputs while the ad banner shows. Tier renders are non-interactive (hook mocked per tier) because React 19 + jest-expo only reliably commits re-renders for the first interactive root in a process; the badge-switch math itself is pinned by the hook unit tests.

## Structure

```
App.js                              # Tab navigator + providers (dark nav theme)
src/theme.js                        # Design tokens
src/context/AdContext.js            # isAdFree state + persistence
src/components/AdBanner.js          # AdMob banner (real when configured) / mock strip fallback
src/config/ads.js                   # AdMob IDs — paste yours here
src/context/SettingsContext.js      # Risk defaults + persistence
src/hooks/usePositionSizer.js       # Risk engine (useMemo, clamped delta)
src/hooks/useMarketClock.js         # DST-safe ET market clock (Intl-based)
src/hooks/useMarketContext.js       # Prev-session OHLC fetch + offline cache (Yahoo v8, keyless)
src/hooks/useSetupJournal.js       # Persisted setup journal (newest-first, 50-cap)
src/screens/MorningEdgeScreen.js
src/screens/PositionSizerScreen.js
src/screens/SettingsScreen.js
```

## Deployment docs

- `DEPLOYMENT.md` — runbook overview, device-test path, Play checklist, blocker list
- `DEVICE_CHECKLIST.md` — printable one-page on-device verification (procedure only)
- `PLAY_DATA_SAFETY.md` — exact data-safety wording (owner-confirmation-gated)
- `PLAY_RELEASE.md` — EAS signing, production AAB, internal-testing upload steps
- `privacy-policy.html` — ready-to-publish policy (placeholders: contact email, effective date) + GitHub Pages steps in its header comment

## Disclaimer

Analytical tool only — not financial advice. Verify every level and position size before submitting orders. Options trading involves substantial risk of loss.

## Deployment readiness (Android first)

**Full runbook: [DEPLOYMENT.md](DEPLOYMENT.md)** — exact EAS/install/runtime-verification commands, Play Console checklist with ready-to-paste listing copy, data-safety answers, signing details, and the precise blocker list. Store graphics generated: `assets/play-icon-512.png`, `assets/play-feature-graphic.png`.

### Device-test path (real ads require a dev build — not Expo Go)

```bash
npx expo prebuild --platform android      # validated: bakes your AdMob App ID into AndroidManifest
npx expo run:android                      # local device/emulator with dev client
# — or cloud —
eas build --profile development --platform android   # APK for sideload/dev-client
npx expo start --dev-client               # JS over the dev build
```

AdMob state (verified via prebuild): `APPLICATION_ID ca-app-pub-2429928174841676~6523612445`
is baked into the native AndroidManifest; banner unit `…/9162963083` is read at runtime.
Dev builds automatically use Google's public test ad IDs (no billable impressions).

### Interstitial (live)

`src/ads/interstitial.js` shows a frequency-capped interstitial (3-min min interval,
session-scoped, Google test IDs in dev) at the natural break — after the trader logs a
setup — behind the same `isRealAdsEnabled` gate. Unit:
`ca-app-pub-2429928174841676/8797412832` (wired in `src/config/ads.js` +
`app.json → extra`). Allow the usual warm-up before first serve.

### Deployment blockers (cannot be resolved from this sandbox)

1. ~~**Interstitial unit**~~ — done: `…/8797412832` wired (AdMob warm-up still applies).
2. **iOS AdMob ID** — do not add until an iOS app is registered in AdMob (then: `iosAppId`
   in `src/config/ads.js` + plugin block).
3. **Store signing** — Play: upload keystore via EAS (`eas credentials`) or Play App
   Signing; requires an Expo/EAS account login (interactive).
4. **Play Console listing** — create the app record, complete data-safety form (AdMob +
   AsyncStorage usage), privacy policy URL (must be hosted by you).
5. **iOS store path** — ATT consent flow + privacy nutrition labels once iOS is built.
6. **AdMob warm-up** — new ad units take hours to serve; blank banner ≠ broken wiring.
