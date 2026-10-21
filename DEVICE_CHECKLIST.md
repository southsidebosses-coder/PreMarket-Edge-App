# PreMarket Edge — Android Device Verification (one page)

**Status: PROCEDURE ONLY — no results recorded yet.** Device: ______  Date: ______  Tester: ______
Build: dev client (APK) · AdMob: banner `…/9162963083` + interstitial `…/8797412832` (test IDs in dev builds)

**Prep**
1. Install: open the EAS build page on the phone → download APK → allow unknown sources → install. Or `adb install -r <apk>`.
2. Start JS layer: `npx expo start --dev-client` → open the app on device.
3. Ad log stream: `adb logcat -c && adb logcat | grep -iE "Ads|gma|interstitial"`

| # | Action | Expected result | Pass |
|---|--------|-----------------|------|
| 1 | Launch PreMarket Edge in dev client | Morning Edge renders, no crash | ☐ |
| 2 | Tab 1: scroll to bottom | Banner strip (dev build shows Google **Test Ad**; may be blank ≤24 h warm-up) | ☐ |
| 3 | Tab 2: scroll to bottom | Banner strip present | ☐ |
| 4 | Sizer: 10000 / 1.5 / 100 / 95 / 112.50 → **LOG THIS SETUP** | `LOGGED ✓` | ☐ |
| 5 | First log of the session | Full-screen **test interstitial**; dismissible | ☐ |
| 6 | Tap LOG again immediately | **No** interstitial (3-min frequency cap) | ☐ |
| 7 | Wait >3 min, log again | Interstitial shows again | ☐ |
| 8 | Settings → Pro purchase (mock) | `PRO ACTIVE`; banners unmount on Tabs 1–2 | ☐ |
| 9 | Settings → RESTORE ADS | Banners return | ☐ |
| 10 | Force-stop, relaunch | Journal entries + Pro state persist | ☐ |

**Triage:** blank banner → warm-up 2–24 h · crash at launch → manifest `APPLICATION_ID` must be `ca-app-pub-2429928174841676~6523612445` · "no fill" in logcat → warm-up/region · "Invalid request" → unit/App-ID mismatch in AdMob.

**All 10 pass?** ☐ Yes — proceed to Play Console checklist · ☐ No — attach logcat excerpt.

Sign-off: ______________
