# Deployment Runbook — PreMarket Edge & Position Sizer (Android)

**Status:** code-complete · Android release config validated (`expo prebuild` bakes the
real AdMob App ID into the native manifest) · 60-test suite green.
**NOT device-validated.** Every runtime check in §3 is a *procedure to execute* — none
has been run yet. Record pass/fail as you go.

## 1. Build the development APK (EAS)

```bash
npm install -g eas-cli
eas login                     # browser auth with your Expo account
eas init                      # links this folder to an EAS project (prints project id)
eas build --profile development --platform android
```

- Profile `development` (see `eas.json`): dev client, **APK**, internal distribution.
- First build also asks to **generate a keystore** — answer yes (EAS stores it
  server-side; this is your upload key).
- Takes ~10–20 min. The CLI prints a build page URL + QR.

## 2. Install the APK

- Easiest: open the build page URL on your phone → download → allow "install unknown
  apps" for your browser → install.
- Or via adb from your computer:

```bash
adb install -r path/to/premarket-edge.apk
```

Then start the JS layer and connect:

```bash
npx expo start --dev-client    # scan the QR / open the shown URL on the phone
```

## 3. Runtime verification — EXECUTE ON DEVICE (not yet run)

Start `adb logcat` first for ad diagnostics:

```bash
adb logcat -c && adb logcat | grep -iE "Ads|gma|interstitial"
```

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Launch PreMarket Edge from the dev client | Splash → Morning Edge, no crash | ☐ |
| 2 | Scroll Tab 1 (and Tab 2) to the bottom | Banner strip renders; dev build shows **Google "Test Ad"** banner (may be blank while the new unit warms up — see §4) | ☐ |
| 3 | Position Sizer: enter valid setup (e.g. 10000 / 1.5 / 100 / 95 / 112.50) → tap **LOG THIS SETUP** | `LOGGED ✓` appears | ☐ |
| 4 | First log in a session | **Test interstitial** shows full-screen (dev builds always use Google test interstitial); close it | ☐ |
| 5 | Tap LOG again immediately | **No** interstitial (3-minute frequency cap holds) | ☐ |
| 6 | Wait >3 min, log again | Interstitial shows again | ☐ |
| 7 | Settings → toggle defaults / Pro purchase sim | Mock IAP flips `PRO ACTIVE`, banner strip unmounts on Tabs 1–2 | ☐ |

**Declarations:** no device validation has been performed yet; results TBD by the person
running §3. Do not ship or market "tested" until that table is green.

## 4. Failure triage

| Symptom | Likely cause → action |
|---|---|
| Blank banner area | New ad unit warm-up (2–24 h) — retry later; confirm no logcat "No fill" spam |
| Crash at launch | `APPLICATION_ID` mismatch — manifest ID must be `ca-app-pub-2429928174841676~6523612445`; re-run `npx expo prebuild -p android` |
| Interstitial never shows | Frequency cap (3 min) working as designed, or logcat shows "Ad failed to load / no fill" — same warm-up |
| "Invalid request" in logcat | Unit ID typo, or the unit doesn't belong to app `ca-app-pub-2429928174841676` in AdMob |

## 5. Play Console submission checklist

### 5.1 Account prerequisites
- [ ] Play Console developer account ($25, identity verification, 2FA)
- [ ] Create app record: name `PreMarket Edge & Sizer`, default language `en-US`, **App**, **Free**

### 5.2 Store listing (copy ready — paste)
- **Title (≤30):** `PreMarket Edge & Sizer`
- **Short description (≤80):** `Pre-market cockpit: pivot levels, position sizing, R:R risk firewall.`
- **Full description:**

> PRE-MARKET COCKPIT · RISK FIREWALL · POSITION SIZER
>
> Built for options and swing traders who refuse to size on gut feel. Before the market opens, PreMarket Edge gives you the levels and the discipline — and before you place an order, it enforces your risk math.
>
> MORNING EDGE
> • Live countdown to the 09:30 ET open, pre-market aware
> • Six-point pre-market checklist with progress tracking
> • SPY market context: previous session OHLC, cached for offline use
> • Floor pivots P, S1, S2, R1, R2 plus Camarilla H3/L3 — one tap pre-fills from live levels
>
> POSITION SIZER
> • Max safe shares from account size and risk budget — floored, never rounded up
> • Options contract equivalent, delta-adjusted
> • Capital outlay and portfolio allocation %
> • Risk-reward badge: EXCELLENT (≥2.5), ACCEPTABLE (≥1.5), REJECTED — with zeroed cells and hints when a setup is incomplete
> • Capital firewall rejects any size that overruns the account, however pretty the R:R
>
> SETUP JOURNAL
> • Log every graded setup in one tap; tap a row to reload it for review
> • Saved on your device — no account, no cloud, no tracking beyond ads
>
> FREE WITH ONE AD PER BREAK
> Banner ads between tabs; a single interstitial after logging a setup, rate-limited to once every 3 minutes. Remove ads forever for a one-time $4.99.
>
> DISCLAIMER: PreMarket Edge is an analytical tool, not financial advice. Trading options involves substantial risk of loss. Verify every level before ordering.

- **Graphics:** icon `assets/play-icon-512.png` (generated ✓) · feature graphic
  `assets/play-feature-graphic.png` (1024×500, generated ✓) · **screenshots: blocker** —
  capture ≥2 from the running device (§3), 9:16 or 16:9.

### 5.3 Data safety form (exact answers — AdMob SDK discloses these)
| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| Device or other IDs (advertising ID) | Yes | Yes | Advertising, Analytics |
| App interactions (ad events) | Yes | Yes | Analytics |
| Approximate location (coarse, IP-derived) | Yes | Yes | Advertising |
| Journal & settings (AsyncStorage) | **No** — on-device only, never transmitted | — | — |

- Encrypted in transit: **Yes** (all traffic HTTPS)
- Deletion mechanism: **Yes** (uninstall clears all local data; contact email for ad-data deletion)
- Final confirmation is the developer's responsibility — cross-check against
  Google's "Disclose data collection" guidance for the Mobile Ads SDK.

### 5.4 Privacy policy (blocker: hosting)
- Must live at a **public, permanent, non-expiring URL** (GitHub Pages is fine).
- Must disclose: AdMob use + Google ad policies link, data types in §5.3,
  on-device-only journal, retention, deletion contact, "not financial advice".
- Link it in Play listing **and** the Data-safety form. (Optional hardening: add a
  "Privacy Policy" row to the in-app Settings screen.)

### 5.5 Signing & package details
- Package: `com.premarketedge.app` · `versionCode` auto-increments (`eas.json` production)
- Production build type = **AAB** (EAS default); use **Play App Signing** (default for
  new apps) — EAS generates/holds your upload keystore (`eas credentials` to inspect).
- Back up the keystore; losing it only matters if Play App Signing is off.

### 5.6 Rollout
- [ ] Internal testing track first: upload AAB → add yourself as tester → promote after §3 passes
- [ ] Content rating questionnaire (finance tools, ads present) → expected **Everyone**
- [ ] Ads declaration: **Yes, contains ads**
- [ ] After publish: link the AdMob app to the store listing (AdMob → Apps → your app)

## 6. Remaining blockers (exact)

1. **EAS build + §3 runtime verification** — needs your Expo login + a device. Not run.
2. **Screenshots** — device capture (≥2).
3. **Privacy policy URL** — write/host (outline in §5.4), fill your contact email.
4. **Play Console forms** — account, listing paste (§5.2/5.3), rating, internal release.
5. **iOS path** — deferred by decision: register the iOS app in AdMob first; only then
   `iosAppId` in `src/config/ads.js` + plugin block. ATT/consent flow follows.
6. **AdMob warm-up** — both units are new; expect hours before first serve.
