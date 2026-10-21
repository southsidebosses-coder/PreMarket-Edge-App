# EAS Signing → Production AAB → Play Internal Testing
**Package: `com.premarketedge.app`** · steps are exact but UNEXECUTED — they need your Expo/Play logins (never share credentials here; run interactively).

## 1. Prerequisites (one-time)
```bash
npm install -g eas-cli
eas login                       # your Expo account (browser auth)
eas init                        # from the project root; links to an EAS project
```

## 2. Signing keys
- First EAS build (any profile) offers to **generate a keystore** — accept. EAS holds it
  server-side; this becomes your Play **upload key**.
- Inspect/backup: `eas credentials --platform android` → choose the keystore option →
  download the `.jks`/`.keystore` **and** store its passwords in a password manager.
  Do NOT commit it or lose it (Play App Signing makes recovery possible, but be safe).
- On first AAB upload, **Play App Signing** is opt-in by default for new apps — accept it.
  Play then holds the release signing key; you keep uploading with the EAS upload key.

## 3. Production AAB
```bash
eas build --profile production --platform android
```
- Produces an **.aab** (EAS production default); `versionCode` auto-increments
  (`app.json` starts at 1, `eas.json → production.autoIncrement: true`).
- AdMob App ID is baked in at prebuild (`ca-app-pub-2429928174841676~6523612445`) —
  verified; do not change it between test and production tracks.
- Grab the artifact from the build page (Download).

## 4. Play Console — internal testing upload
1. Play Console → **Create app** (once): name `PreMarket Edge & Sizer`, default language
   en-US, **App**, **Free**.
2. Left menu → **Test and release → Testing → Internal testing** → **Create new release**.
3. **Upload the .aab** (drag from the EAS build page download). First upload also
   completes Play App Signing enrollment.
4. Release notes → Next → **Add testers** (email lists or Google Group) → Save.
5. Complete the required pre-launch items that gate the release:
   - **Store listing** (copy in DEPLOYMENT.md §5.2) + graphics (2+ device screenshots — block, capture while running §3 of DEVICE_CHECKLIST.md)
   - **Data safety** (exact wording in PLAY_DATA_SAFETY.md — owner confirmation first)
   - **Privacy policy** URL (host `privacy-policy.html` — steps are in its HTML comment)
   - **Content rating** questionnaire → expect Everyone · **Ads declaration**: Yes, contains ads
   - **App access**: none needed
6. Back on Internal testing → **Start rollout to internal testers** (may take minutes–hours
   to propagate; testers see it at the Play Store link shown on the page).

## 5. Promote (only after DEVICE_CHECKLIST.md is all-green)
Test and release → Promote release: internal → closed → production (staged 10% → 100%).
Then AdMob console → Apps → PreMarket Edge → link the Play listing (required for full ad serving).

## 6. Never do
- Never commit keystores/passwords. Never switch Play App Signing off after first release.
- Never ship with a different AdMob APPLICATION_ID than tested (crash-on-launch guard).
